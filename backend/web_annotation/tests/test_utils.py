
# pylint: disable=W0621,C0114,C0116,W0212,W0613
import pytest

from web_annotation.utils import bytes_to_readable

@pytest.mark.parametrize(
    "raw_bytes, result",
    [
        (79345670000000, "79.3 TB"),
        (13000030600, "13.0 GB"),
        (19004345, "19.0 MB"),
        (1203000, "1.2 MB"),
        (900000, "900.0 KB"),
        (15600, "15.6 KB"),
        (3333, "3.3 KB"),
        (150, "0.1 KB"),
    ]
)
def test_bytes_to_readable(
  raw_bytes: int,
  result: str,
) -> None:
    assert bytes_to_readable(raw_bytes) == result
