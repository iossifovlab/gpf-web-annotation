# pylint: disable=W0621,C0114,C0116,W0212,W0613
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Callable, cast
import pytest
from pytest_mock import MockerFixture

from dae.annotation.annotatable import VCFAllele
from dae.annotation.annotation_factory import load_pipeline_from_yaml
from dae.annotation.annotation_pipeline import AnnotationPipeline
from dae.genomic_resources.repository import GenomicResourceRepo
from web_annotation.executor import SequentialTaskExecutor, ThreadedTaskExecutor
from web_annotation.annotation_base_view import AnnotationBaseView
from web_annotation.models import (
    AnonymousPipeline,
    Pipeline,
    User,
    WebAnnotationAnonymousUser,
)
from web_annotation.pipeline_cache import (
    LRUPipelineCache,
    ThreadSafePipeline,
)

@pytest.fixture
def sample_pipeline_factory(
    test_grr: GenomicResourceRepo,
) -> Callable[[], AnnotationPipeline]:
    def pipeline_factory() -> AnnotationPipeline:
        pipeline_config = "- position_score: scores/pos1"
        return load_pipeline_from_yaml(
            pipeline_config,
            test_grr,
        )
    return pipeline_factory


def test_thread_safe_pipeline(
    sample_pipeline_factory: Callable[[], AnnotationPipeline],
) -> None:
    pipeline = sample_pipeline_factory()
    cached_pipeline = ThreadSafePipeline(pipeline)

    cached_pipeline.open()
    assert pipeline._is_open  # pylint: disable=protected-access
    result = cached_pipeline.annotate(
        VCFAllele("chr1", 3, "A", "T"),
        {},
    )
    assert result == {"pos1": 0.1}
    cached_pipeline.close()
    assert not pipeline._is_open  # pylint: disable=protected-access


def test_thread_safe_pipeline_concurrent(
    sample_pipeline_factory: Callable[[], AnnotationPipeline],
) -> None:
    pipeline = ThreadSafePipeline(sample_pipeline_factory())

    pipeline.open()
    assert pipeline.pipeline._is_open  # pylint: disable=protected-access

    def annotate_allele(pos: int) -> dict:
        return pipeline.annotate(
            VCFAllele("chr1", pos, "A", "T"),
            {},
        )

    positions = [3, 4, 5, 6, 7]
    expected_results = [
        {"pos1": 0.1},
        {"pos1": 0.2},
        {"pos1": 0.2},
        {"pos1": 0.3},
        {"pos1": 0.4},
    ]

    executor = ThreadPoolExecutor(max_workers=5)

    futures = [executor.submit(annotate_allele, pos) for pos in positions]
    results = [
        future.result() for future in as_completed(futures)
    ]

    assert sorted(results, key=lambda x: x["pos1"]) == expected_results

    pipeline.close()
    assert not pipeline._is_open  # pylint: disable=protected-access


def test_lru_pipeline_cache_uses_executor(
    test_grr: GenomicResourceRepo,
    mocker: MockerFixture,
) -> None:
    lru_cache = LRUPipelineCache(test_grr, 2)
    execute_spy = mocker.spy(lru_cache._load_executor, "execute")

    assert len(lru_cache._cache) == 0  # pylint: disable=protected-access

    lru_cache.put_pipeline(
        ("sample", "pipeline1"), "- position_score: scores/pos1")
    assert len(lru_cache._cache) == 1  # pylint: disable=protected-access
    assert len(execute_spy.call_args_list) == 1
    call_args = execute_spy.call_args_list[0]
    assert call_args[0][0] == \
        lru_cache._load_pipeline_raw  # pylint: disable=comparison-with-callable
    assert call_args[1]["raw"] == \
        "- position_score: scores/pos1"
    assert call_args[1]["grr"] == test_grr


def test_lru_pipeline_cache_basic_sources(
    test_grr: GenomicResourceRepo
) -> None:
    lru_cache = LRUPipelineCache(test_grr, 2)

    assert len(lru_cache._cache) == 0  # pylint: disable=protected-access

    lru_cache.put_pipeline(
        ("sample", "pipeline1"), "- position_score: scores/pos1")
    assert len(lru_cache._cache) == 1  # pylint: disable=protected-access
    pipeline_ids = set(
        lru_cache._cache.keys())  # pylint: disable=protected-access
    assert pipeline_ids == {("sample", "pipeline1")}

    lru_cache.put_pipeline(
        ("sample", "pipeline2"), "- position_score: scores/pos1")
    assert len(lru_cache._cache) == 2  # pylint: disable=protected-access
    pipeline_ids = set(
        lru_cache._cache.keys())  # pylint: disable=protected-access
    assert pipeline_ids == {("sample", "pipeline1"), ("sample", "pipeline2")}

    lru_cache.put_pipeline(
        ("sample", "pipeline3"), "- position_score: scores/pos1")
    assert len(lru_cache._cache) == 2  # pylint: disable=protected-access
    pipeline_ids = set(
        lru_cache._cache.keys())  # pylint: disable=protected-access
    assert pipeline_ids == {("sample", "pipeline2"), ("sample", "pipeline3")}

    lru_cache.get_pipeline(("sample", "pipeline2"))
    lru_cache.put_pipeline(
        ("sample", "pipeline4"), "- position_score: scores/pos1")
    assert len(lru_cache._cache) == 2  # pylint: disable=protected-access
    pipeline_ids = set(
        lru_cache._cache.keys())  # pylint: disable=protected-access
    assert pipeline_ids == {("sample", "pipeline2"), ("sample", "pipeline4")}


def test_lru_pipeline_cache_pipeline_loaded_check(
    test_grr: GenomicResourceRepo,
) -> None:
    lru_cache = LRUPipelineCache(test_grr, 2)

    assert len(lru_cache._cache) == 0  # pylint: disable=protected-access

    assert lru_cache.has_pipeline(("sample", "pipeline1")) is False
    lru_cache.put_pipeline(
        ("sample", "pipeline1"), "- position_score: scores/pos1")
    assert lru_cache.has_pipeline(("sample", "pipeline1")) is True
    assert len(lru_cache._cache) == 1  # pylint: disable=protected-access
    pipeline_ids = set(
        lru_cache._cache.keys())  # pylint: disable=protected-access
    assert pipeline_ids == {("sample", "pipeline1")}


def test_lru_pipeline_cache_callbacks(
    test_grr: GenomicResourceRepo,
) -> None:
    lru_cache = LRUPipelineCache(test_grr, 1)
    lru_cache._load_executor = cast(
        ThreadedTaskExecutor,
        SequentialTaskExecutor(),
    )
    deleted_pipelines = []

    def delete_callback(pipeline: ThreadSafePipeline) -> None:
        deleted_pipelines.append(pipeline)

    lru_cache.put_pipeline(
        ("sample", "pipeline1"),
        "- position_score: scores/pos1",
        delete_callback=delete_callback,
    )
    assert len(lru_cache._cache) == 1  # pylint: disable=protected-access

    lru_cache.put_pipeline(
        ("sample", "pipeline2"),
        "- position_score: scores/pos1",
        delete_callback=delete_callback,
    )
    assert len(lru_cache._cache) == 1  # pylint: disable=protected-access

    assert len(deleted_pipelines) == 1
    assert deleted_pipelines[0].pipeline_id == ("sample", "pipeline1")


@pytest.mark.django_db
def test_writing_same_id_pipelines_to_cache(
    mocker: MockerFixture,
    test_grr: GenomicResourceRepo,
) -> None:
    base_view = AnnotationBaseView()
    lru_cache = LRUPipelineCache(test_grr, 16)

    pipeline_config = "- position_score: scores/pos1"
    mocker.patch.object(
        base_view, "_get_user_pipeline_yaml", return_value=pipeline_config)
    mocker.patch.object(
        base_view, "lru_cache", new=lru_cache)
    anonymous_user = WebAnnotationAnonymousUser(ip="test", session_id="sess1")
    anonymous_pipeline = AnonymousPipeline(
        owner=anonymous_user.as_owner, config_path="", is_temporary=True,
        pk=100,
    )
    anonymous_pipeline.save()
    test_user = User(email="test@test.com")
    test_user.save()
    user_pipeline = Pipeline(
        owner=test_user, config_path="",
        pk=100,
    )
    user_pipeline.save()

    assert len(
        base_view.lru_cache._cache) == 0  # pylint: disable=protected-access

    base_view.put_pipeline(("anonymous", "100"), user=anonymous_user)

    assert len(
        base_view.lru_cache._cache) == 1  # pylint: disable=protected-access

    base_view.put_pipeline(("user", "100"), user=test_user)

    assert len(
        base_view.lru_cache._cache) == 2  # pylint: disable=protected-access

    assert base_view.lru_cache._cache.keys() == {
        ("anonymous", "100"),
        ("user", "100"),
    }
    pipeline = base_view.get_pipeline("100", test_user)
    assert pipeline is not None
