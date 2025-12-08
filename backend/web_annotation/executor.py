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
        self, fn: Callable, *,
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
        self, fn: Callable, *,
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
    def __init__(
        self, max_workers: int = 4, job_timeout: float = 2*60*60,
    ) -> None:
        self._executor = ThreadPoolExecutor(max_workers=max_workers)
        self._futures: list[tuple[float, Future]] = []
        self._lock = threading.Lock()
        self.job_timeout = job_timeout

    def size(self) -> int:
        with self._lock:
            return len(self._futures)

    def _callback_wrapper(
        self,
        start_time: float,
        future: Future[Any],
        callback_success: Callable[[list[Any]], None] | None = None,
        callback_failure: Callable[[BaseException], None] | None = None,
    ) -> None:
        if future.cancelled():
            return
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
            self._futures.remove((start_time, future))
            logger.debug("Remaining tasks: %d", len(self._futures))

    def execute(
        self, fn: Callable, *,
        callback_success: Callable[[list[Any]], None] | None = None,
        callback_failure: Callable[[BaseException], None] | None = None,
        **kwargs: Any,
    ) -> None:
        now = time.time()
        to_remove = []
        with self._lock:
            for time_started, future in self._futures:
                if now - time_started > self.job_timeout:
                    logger.warning(
                        "Cancelling long-running task started at %s",
                        time_started,
                    )
                    future.cancel()
                    to_remove.append((time_started, future))
            for time_started, future in to_remove:
                self._futures.remove((time_started, future))
        future = self._executor.submit(fn, **kwargs)
        with self._lock:
            self._futures.append((now, future))

        def wrapper(fut: Future) -> None:
            self._callback_wrapper(
                now,
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
                _, future = self._futures[0]
            try:
                future.result(timeout=timeout - elapsed)
            except TimeoutError as ex:
                raise TimeoutError("Task timed out") from ex
            except BaseException:
                pass
            elapsed = time.time() - start
            if elapsed >= timeout:
                raise TimeoutError("Waiting for tasks timed out")


    def shutdown(self) -> None:
        self._executor.shutdown(wait=True, cancel_futures=True)
        with self._lock:
            self._futures.clear()
