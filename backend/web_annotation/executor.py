import abc
from collections.abc import Callable
from concurrent.futures import Future, ThreadPoolExecutor
from typing import Any


class JobExecutor(abc.ABC):
    """Abstract base class for job executors."""

    @abc.abstractmethod
    def execute(
        self, fn: Callable, *args: Any,
        callback: Callable[[Any], None] | None = None,
        **kwargs: Any,
    ) -> None:
        """Run a given function with provided arguments."""

    @abc.abstractmethod
    def wait_all(self, timeout: int) -> None:
        """Wait for given number of seconds."""


class SynchronousJobExecutor(JobExecutor):
    """Synchronous job executor."""
    def execute(
        self, fn: Callable, *args: Any,
        callback: Callable[[Any], None] | None = None,
        **kwargs: Any,
    ) -> None:
        if callback is not None:
            callback(fn(*args, **kwargs))
        else:
            fn(*args, **kwargs)

    def wait_all(self, timeout: int) -> None:
        return


class ThreadPollJobExecutor(JobExecutor):
    """Thread pool based job executor."""
    def __init__(self, max_workers: int = 4) -> None:
        self._executor = ThreadPoolExecutor(max_workers=max_workers)
        self._futures: list[Future] = []

    def execute(
        self, fn: Callable, *args: Any,
        callback: Callable[[Future[Any]], None] | None = None,
        **kwargs: Any,
    ) -> None:
        future = self._executor.submit(fn, *args, **kwargs)
        self._futures.append(future)
        if callback is not None:
            future.add_done_callback(callback)

    def wait_all(self, timeout: int) -> None:
        for future in self._futures:
            future.result(timeout=timeout)
