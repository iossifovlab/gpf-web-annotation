import abc
from collections.abc import Callable
from typing import Any


class JobExecutor(abc.ABC):
    """Abstract base class for job executors."""

    @abc.abstractmethod
    def execute(
        self, fn: Callable, args: list[Any],
        callback: Callable[[Any], None] | None = None,
    ) -> None:
        pass

    @abc.abstractmethod
    def wait_all(self, timeout: int) -> None:
        """Wait for given number of seconds."""


class SynchronousJobExecutor(JobExecutor):
    """Synchronous job executor."""
    ...


class ThreadPollJobExecutor(JobExecutor):
    """Thread pool based job executor."""
    ...
