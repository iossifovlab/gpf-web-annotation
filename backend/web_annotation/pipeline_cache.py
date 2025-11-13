"""Module for thread-safe annotation utilities."""
import logging
from threading import Lock
from types import TracebackType
from typing import Sequence
from dae.annotation.annotatable import Annotatable
from dae.annotation.annotation_config import AnnotatorInfo, AttributeInfo
from dae.annotation.annotation_pipeline import AnnotationPipeline, Annotator


logger = logging.getLogger(__name__)


class ThreadSafePipeline(AnnotationPipeline):
    """Thread-safe annotation pipeline wrapper."""

    def __init__(self, pipeline: AnnotationPipeline):
        super().__init__(pipeline.repository)
        self.pipeline = pipeline
        self.annotators = pipeline.annotators
        self.preamble = pipeline.preamble
        self.raw = pipeline.raw
        self.lock = Lock()

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
        self._cache: dict[str, ThreadSafePipeline] = {}
        self._cache_lock: Lock = Lock()
        self._order: list[str] = []

    def put_pipeline(
        self, pipeline_id: str, pipeline: AnnotationPipeline
    ) -> ThreadSafePipeline:
        """Put a pipeline into the cache."""
        with self._cache_lock:
            if pipeline_id in self._cache:
                raise KeyError(f"Pipeline '{pipeline_id}' already in cache.")
            if len(self._cache) >= self.capacity:
                last_pipeline_id = self._order.pop(0)
                del self._cache[last_pipeline_id]

            self._order.append(pipeline_id)
            wrapped = ThreadSafePipeline(pipeline)
            wrapped.open()
            self._cache[pipeline_id] = wrapped
            return wrapped

    def get_pipeline(self, pipeline_id: str) -> ThreadSafePipeline | None:
        """Get a pipeline by its ID, loading it if necessary."""
        with self._cache_lock:
            if pipeline_id in self._cache:
                self._order.remove(pipeline_id)
                self._order.append(pipeline_id)
                return self._cache[pipeline_id]

            return None
