import pytest
import time
from web_annotation.executor import (
    SynchronousJobExecutor,
    ThreadPollJobExecutor,
)
from concurrent.futures import TimeoutError
from unittest.mock import MagicMock


def test_synchronous_job_executor_execute() -> None:
    executor = SynchronousJobExecutor()

    fn = MagicMock()
    callback = MagicMock()

    executor.execute(fn, 1, 2, callback=callback, key="value")

    assert fn.call_count == 1
    fn.assert_called_once_with(1, 2, key="value")

    assert callback.call_count == 1


def test_thread_pool_job_executor_execute() -> None:
    executor = ThreadPollJobExecutor(max_workers=1)

    fn = MagicMock(return_value="result")
    callback = MagicMock()

    executor.execute(fn, 1, 2, callback=callback, key="value")

    # Wait for all tasks to complete
    executor.wait_all(timeout=5)

    assert fn.call_count == 1
    fn.assert_called_once_with(1, 2, key="value")

    assert callback.call_count == 1
    callback.assert_called_once_with(executor._futures[0])


def test_thread_pool_executor_timeout() -> None:
    executor = ThreadPollJobExecutor(max_workers=2)

    def fn() -> None:
        time.sleep(2)

    executor.execute(fn)

    with pytest.raises(TimeoutError):
        executor.wait_all(timeout=1)

