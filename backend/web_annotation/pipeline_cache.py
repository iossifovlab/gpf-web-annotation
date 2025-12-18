"""Module for thread-safe annotation utilities."""
import logging
from threading import Lock
from types import TracebackType
from typing import Callable, Sequence
from dae.annotation.annotatable import Annotatable
from dae.annotation.annotation_config import (
    AnnotationPreamble,
    AnnotatorInfo,
    AttributeInfo,
    RawPipelineConfig,
)
from dae.annotation.annotation_pipeline import AnnotationPipeline, Annotator
from dae.genomic_resources.repository import GenomicResourceRepo


logger = logging.getLogger(__name__)


class ThreadSafePipeline(AnnotationPipeline):
    """Thread-safe annotation pipeline wrapper."""

    def __init__(
        self, pipeline: AnnotationPipeline,
    ):  # pylint: disable=super-init-not-called
        self.pipeline = pipeline
        self.lock = Lock()

    @property
    def annotators(self) -> list[Annotator]:  # type: ignore
        """Return the list of annotators in the pipeline."""
        return self.pipeline.annotators

    @property
    def preamble(self) -> AnnotationPreamble | None:  # type: ignore
        """Return the pipeline's preamble."""
        return self.pipeline.preamble

    @property
    def raw(self) -> RawPipelineConfig:  # type: ignore
        """Return the pipeline's raw configuration."""
        return self.pipeline.raw

    @property
    def repository(self) -> GenomicResourceRepo:  # type: ignore
        """Return the pipeline's repository"""
        return self.pipeline.repository

    @property
    def _is_open(self) -> bool:  # type: ignore
        """Return whether the pipeline is open."""
        return self.pipeline._is_open  # pylint: disable=protected-access

    def get_info(self) -> list[AnnotatorInfo]:
        return self.pipeline.get_info()

    def get_attributes(self) -> list[AttributeInfo]:
        return self.pipeline.get_attributes()

    def get_attribute_info(
            self, attribute_name: str) -> AttributeInfo | None:
        return self.pipeline.get_attribute_info(attribute_name)

    def get_resource_ids(self) -> set[str]:
        return self.pipeline.get_resource_ids()

    def get_annotator_by_attribute_info(
        self, attribute_info: AttributeInfo,
    ) -> Annotator | None:
        return self.pipeline.get_annotator_by_attribute_info(attribute_info)

    def add_annotator(self, annotator: Annotator) -> None:
        with self.lock:
            self.pipeline.add_annotator(annotator)

    def annotate(
        self, annotatable: Annotatable | None,
        context: dict | None = None,
    ) -> dict:
        with self.lock:
            return self.pipeline.annotate(annotatable, context)

    def batch_annotate(
        self, annotatables: Sequence[Annotatable | None],
        contexts: list[dict] | None = None,
        batch_work_dir: str | None = None,
    ) -> list[dict]:
        with self.lock:
            return self.pipeline.batch_annotate(
                annotatables, contexts=contexts, batch_work_dir=batch_work_dir,
            )

    def open(self) -> AnnotationPipeline:
        with self.lock:
            return self.pipeline.open()

    def close(self) -> None:
        with self.lock:
            self.pipeline.close()

    def print(self) -> None:
        self.pipeline.print()

    def __enter__(self) -> AnnotationPipeline:
        return self

    def __exit__(
            self,
            exc_type: type[BaseException] | None,
            exc_value: BaseException | None,
            exc_tb: TracebackType | None) -> bool:
        if exc_type is not None:
            logger.error(
                "exception during annotation: %s, %s, %s",
                exc_type, exc_value, exc_tb)
        self.close()
        return exc_type is None


class LRUPipelineCache:
    """LRU cache that wraps and provides thread-safe annotation pipelines."""

    def __init__(
        self, capacity: int,
    ):
        self.capacity = capacity
        self._cache: dict[tuple[str, str], ThreadSafePipeline] = {}
        self._pipeline_callbacks: dict[tuple[str, str], Callable | None] = {}
        self._cache_lock: Lock = Lock()
        self._order: list[tuple[str, str]] = []

    def put_pipeline(
        self, pipeline_id: tuple[str, str], pipeline: AnnotationPipeline,
        callback: Callable[[ThreadSafePipeline], None] | None = None,
    ) -> ThreadSafePipeline:
        """Put a pipeline into the cache."""
        with self._cache_lock:
            if len(self._cache) >= self.capacity:
                last_pipeline_id = self._order.pop(0)
                delete_cb = self._pipeline_callbacks.get(last_pipeline_id)
                if delete_cb:
                    try:
                        delete_cb(self._cache[last_pipeline_id])
                    except Exception as e:  # pylint: disable=broad-except
                        logger.error(
                            "Error during pipeline deletion callback: %s", e)
                del self._cache[last_pipeline_id]
                del self._pipeline_callbacks[last_pipeline_id]

            self._order.append(pipeline_id)
            wrapped = ThreadSafePipeline(pipeline)
            wrapped.open()
            self._cache[pipeline_id] = wrapped
            self._pipeline_callbacks[pipeline_id] = callback
            return wrapped

    def get_pipeline(
        self, pipeline_id: tuple[str, str],
    ) -> ThreadSafePipeline | None:
        """Get a pipeline by its ID, loading it if necessary."""
        with self._cache_lock:
            if pipeline_id in self._cache:
                self._order.remove(pipeline_id)
                self._order.append(pipeline_id)
                return self._cache[pipeline_id]

            return None

    def has_pipeline(
        self, pipeline_id: tuple[str, str],
    ) -> bool:
        """Check if a pipeline is in the cache."""
        with self._cache_lock:
            return pipeline_id in self._cache

    def unload_pipeline(
        self, pipeline_id: tuple[str, str],
    ) -> None:
        """Unload a pipeline from the cache."""
        with self._cache_lock:
            if pipeline_id in self._cache:
                delete_cb = self._pipeline_callbacks.get(pipeline_id)
                if delete_cb:
                    try:
                        delete_cb(self._cache[pipeline_id])
                    except Exception as e:  # pylint: disable=broad-except
                        logger.error(
                            "Error during pipeline deletion callback: %s", e)
                del self._cache[pipeline_id]
                del self._pipeline_callbacks[pipeline_id]
                self._order.remove(pipeline_id)
