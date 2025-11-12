import abc
import logging
import threading
from collections.abc import Callable
from concurrent.futures import Future, ThreadPoolExecutor
from typing import Any

logger = logging.getLogger(__name__)


class TaskExecutor(abc.ABC):
    """Abstract base class for job executors."""

    @abc.abstractmethod
    def execute(
        self, fn: Callable,
        callback_success: Callable[[Any], None] | None = None,
        callback_failure: Callable[[BaseException], None] | None = None,
        **kwargs: Any,
    ) -> None:
        """Run a given function with provided arguments."""

    @abc.abstractmethod
    def wait_all(self, timeout: float) -> None:
        """Wait for given number of seconds."""

    @abc.abstractmethod
    def shutdown(self) -> None:
        """Shutdown the executor, cleaning up resources if needed."""


class SequentialTaskExecutor(TaskExecutor):
    """Synchronous job executor."""
    def execute(
        self, fn: Callable,
        callback_success: Callable[[list[Any]], None] | None = None,
        callback_failure: Callable[[BaseException], None] | None = None,
        **kwargs: Any,
    ) -> None:
        try:
            result = fn(**kwargs)
            if callback_success is not None:
                callback_success(result)
        except BaseException as e:
            if callback_failure is not None:
                callback_failure(e)

    def wait_all(self, timeout: float) -> None:
        return

    def shutdown(self) -> None:
        return


class ThreadedTaskExecutor(TaskExecutor):
    """Thread pool based job executor."""
    def __init__(self, max_workers: int = 4) -> None:
        self._executor = ThreadPoolExecutor(max_workers=max_workers)
        self._futures: list[Future] = []
        self._lock = threading.Lock()

    def size(self) -> int:
        return len(self._futures)

    def _callback_wrapper(
        self,
        future: Future[Any],
        callback_success: Callable[[list[Any]], None] | None = None,
        callback_failure: Callable[[BaseException], None] | None = None,
    ) -> None:
        exception = future.exception()
        if exception is not None:
            logger.error("Task failed with exception: %s", exception)
            if callback_failure is not None:
                callback_failure(exception)
        else:
            result = future.result()
            logger.debug("Task completed with result: %s", result)
            if callback_success is not None:
                callback_success(result)
        self._futures.remove(future)

    def execute(
        self, fn: Callable, *args: Any,
        callback_success: Callable[[list[Any]], None] | None = None,
        callback_failure: Callable[[BaseException], None] | None = None,
        **kwargs: Any,
    ) -> None:
        with self._lock:
            future = self._executor.submit(fn, *args, **kwargs)
            self._futures.append(future)
            def wrapper(fut: Future) -> None:
                self._callback_wrapper(
                    fut,
                    callback_success=callback_success,
                    callback_failure=callback_failure,
                )
            future.add_done_callback(wrapper)

    def wait_all(self, timeout: float) -> None:
        for future in self._futures:
            future.result(timeout=timeout)

    def shutdown(self) -> None:
        for future in self._futures:
            future.cancel()
        self._executor.shutdown(wait=True)
        self._futures.clear()
