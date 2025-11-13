# pylint: disable=W0621,C0114,C0116,W0212,W0613
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Callable
import pytest
from dae.annotation.annotatable import VCFAllele
from dae.annotation.annotation_factory import load_pipeline_from_yaml
from dae.annotation.annotation_pipeline import AnnotationPipeline
from dae.genomic_resources.repository import GenomicResourceRepo
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


def test_lru_pipeline_cache_basic_sources(
    sample_pipeline_factory: Callable[[], AnnotationPipeline],
) -> None:
    lru_cache = LRUPipelineCache(2)

    assert len(lru_cache._cache) == 0  # pylint: disable=protected-access

    pipeline1 = sample_pipeline_factory()
    lru_cache.put_pipeline("pipeline1", pipeline1)
    assert len(lru_cache._cache) == 1  # pylint: disable=protected-access
    pipeline_ids = set(
        lru_cache._cache.keys())  # pylint: disable=protected-access
    assert pipeline_ids == {"pipeline1"}

    pipeline2 = sample_pipeline_factory()
    lru_cache.put_pipeline("pipeline2", pipeline2)
    assert len(lru_cache._cache) == 2  # pylint: disable=protected-access
    pipeline_ids = set(
        lru_cache._cache.keys())  # pylint: disable=protected-access
    assert pipeline_ids == {"pipeline1", "pipeline2"}

    pipeline3 = sample_pipeline_factory()
    lru_cache.put_pipeline("pipeline3", pipeline3)
    assert len(lru_cache._cache) == 2  # pylint: disable=protected-access
    pipeline_ids = set(
        lru_cache._cache.keys())  # pylint: disable=protected-access
    assert pipeline_ids == {"pipeline2", "pipeline3"}

    pipeline4 = sample_pipeline_factory()
    lru_cache.get_pipeline("pipeline2")
    lru_cache.put_pipeline("pipeline4", pipeline4)
    assert len(lru_cache._cache) == 2  # pylint: disable=protected-access
    pipeline_ids = set(
        lru_cache._cache.keys())  # pylint: disable=protected-access
    assert pipeline_ids == {"pipeline2", "pipeline4"}
