# pylint: disable=W0621,C0114,C0116,W0212,W0613
import pytest
import time
from web_annotation.executor import (
    SequentialTaskExecutor,
    ThreadedTaskExecutor,
)
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


def test_threaded_task_executor_failure() -> None:
    executor = ThreadedTaskExecutor(max_workers=1)

    def fn() -> None:
        raise ValueError("Test error")

    callback_success = MagicMock()
    callback_failure = MagicMock()

    executor.execute(
        fn,
        callback_success=callback_success,
        callback_failure=callback_failure)

    # Wait for all tasks to complete
    executor.wait_all(timeout=5)

    assert callback_success.call_count == 0
    assert callback_failure.call_count == 1

    # Check that the exception was passed to callback_failure
    args, _ = callback_failure.call_args
    assert isinstance(args[0], ValueError)
    assert str(args[0]) == "Test error"

    executor.shutdown()


def test_threaded_task_executor_multiple_tasks() -> None:
    executor = ThreadedTaskExecutor(max_workers=2)

    fn1 = MagicMock(return_value="result1")
    fn2 = MagicMock(return_value="result2")
    fn3 = MagicMock(return_value="result3")

    callback_success = MagicMock()

    executor.execute(fn1, callback_success=callback_success)
    executor.execute(fn2, callback_success=callback_success)
    executor.execute(fn3, callback_success=callback_success)

    # Wait for all tasks to complete
    executor.wait_all(timeout=5)

    assert fn1.call_count == 1
    assert fn2.call_count == 1
    assert fn3.call_count == 1
    assert callback_success.call_count == 3

    executor.shutdown()


def test_threaded_task_executor_size() -> None:
    executor = ThreadedTaskExecutor(max_workers=2)

    def slow_fn() -> None:
        time.sleep(0.5)

    assert executor.size() == 0

    executor.execute(slow_fn)
    executor.execute(slow_fn)

    # Check size before tasks complete
    assert executor.size() == 2

    # Wait for tasks to complete
    executor.wait_all(timeout=5)

    # Size should be 0 after completion
    assert executor.size() == 0

    executor.shutdown()


def test_threaded_task_executor_shutdown() -> None:
    executor = ThreadedTaskExecutor(max_workers=2)

    def slow_fn() -> None:
        time.sleep(0.1)

    executor.execute(slow_fn)
    executor.execute(slow_fn)

    # Shutdown should wait for tasks to complete
    executor.shutdown()

    # After shutdown, futures list should be cleared
    assert executor.size() == 0


def test_threaded_task_executor_mixed_results() -> None:
    executor = ThreadedTaskExecutor(max_workers=3)

    success_fn = MagicMock(return_value="success")

    def failure_fn() -> None:
        raise RuntimeError("Task failed")

    callback_success = MagicMock()
    callback_failure = MagicMock()

    executor.execute(
        success_fn,
        callback_success=callback_success,
        callback_failure=callback_failure)

    executor.execute(
        failure_fn,
        callback_success=callback_success,
        callback_failure=callback_failure)

    executor.execute(
        success_fn,
        callback_success=callback_success,
        callback_failure=callback_failure)

    # Wait for all tasks to complete
    executor.wait_all(timeout=5)

    assert callback_success.call_count == 2
    assert callback_failure.call_count == 1
    assert success_fn.call_count == 2

    executor.shutdown()


def test_threaded_task_executor_with_args_and_kwargs() -> None:
    executor = ThreadedTaskExecutor(max_workers=1)

    fn = MagicMock(return_value="result")
    callback_success = MagicMock()

    executor.execute(
        fn,
        1, 2, 3,  # positional args
        callback_success=callback_success,
        key1="value1",
        key2="value2")

    executor.wait_all(timeout=5)

    fn.assert_called_once_with(1, 2, 3, key1="value1", key2="value2")
    callback_success.assert_called_once_with("result")

    executor.shutdown()
