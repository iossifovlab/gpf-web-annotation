import abc
import logging
import threading
import time
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

    @abc.abstractmethod
    def size(self) -> int:
        """Return the number of pending tasks."""


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
                logger.debug("Task completed with result: %s", result)
                callback_success(result)
        except BaseException as e:
            logger.error("Task failed with exception: %s", e)
            if callback_failure is not None:
                callback_failure(e)

    def wait_all(self, timeout: float) -> None:
        return

    def shutdown(self) -> None:
        return

    def size(self) -> int:
        return 0


class ThreadedTaskExecutor(TaskExecutor):
    """Thread pool based job executor."""
    def __init__(self, max_workers: int = 4) -> None:
        self._executor = ThreadPoolExecutor(max_workers=max_workers)
        self._futures: list[Future] = []
        self._lock = threading.Lock()

    def size(self) -> int:
        with self._lock:
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
        with self._lock:
            self._futures.remove(future)
            logger.debug("Remaining tasks: %d", len(self._futures))

    def execute(
        self, fn: Callable, *args: Any,
        callback_success: Callable[[list[Any]], None] | None = None,
        callback_failure: Callable[[BaseException], None] | None = None,
        **kwargs: Any,
    ) -> None:
        future = self._executor.submit(fn, *args, **kwargs)
        with self._lock:
            self._futures.append(future)
        def wrapper(fut: Future) -> None:
            self._callback_wrapper(
                fut,
                callback_success=callback_success,
                callback_failure=callback_failure,
            )
        future.add_done_callback(wrapper)

    def wait_all(self, timeout: float) -> None:
        start = time.time()
        elapsed = 0.0
        while self.size() > 0:
            with self._lock:
                if not self._futures:
                    return
                future = self._futures[0]
            future.result(timeout=timeout - elapsed)
            elapsed = time.time() - start
            if elapsed >= timeout:
                return


    def shutdown(self) -> None:
        self._executor.shutdown(wait=True, cancel_futures=True)
        with self._lock:
            self._futures.clear()
