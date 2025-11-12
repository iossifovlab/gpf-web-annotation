# pylint: disable=W0621,C0114,C0116,W0212,W0613
import pytest
import time
from web_annotation.executor import (
    SequentialTaskExecutor,
    ThreadedTaskExecutor,
)
# from concurrent.futures import TimeoutError
from unittest.mock import MagicMock


def test_sequential_task_executor_execute() -> None:
    executor = SequentialTaskExecutor()

    fn = MagicMock()
    callback_success = MagicMock()
    callback_failure = MagicMock()

    executor.execute(
        fn,
        callback_success=callback_success,
        callback_failure=callback_failure,
        args=(1, 2),
        key="value")

    assert fn.call_count == 1
    fn.assert_called_once_with(args=(1, 2), key="value")

    assert callback_success.call_count == 1


def test_threaded_task_executor_execute() -> None:
    executor = ThreadedTaskExecutor(max_workers=1)

    fn = MagicMock(return_value="result")
    callback_success = MagicMock()
    callback_failure = MagicMock()

    executor.execute(
        fn,
        callback_success=callback_success,
        callback_failure=callback_failure,
        args=(1, 2),
        key="value")

    # Wait for all tasks to complete
    executor.wait_all(timeout=5)

    assert fn.call_count == 1
    fn.assert_called_once_with(args=(1, 2), key="value")

    assert callback_success.call_count == 1
    callback_success.assert_called_once_with("result")


def test_threaded_task_executor_timeout() -> None:
    executor = ThreadedTaskExecutor(max_workers=2)

    def fn() -> None:
        time.sleep(1)

    executor.execute(fn)

    with pytest.raises(TimeoutError):
        executor.wait_all(timeout=0.1)

    executor.shutdown()
