import gzip
from typing import Any

from django.core.files.uploadedfile import UploadedFile


def is_compressed_filename(path: str) -> bool:
    return path.endswith(".gz") or path.endswith(".bgz")


def extract_header(path: str, input_separator: str) -> list[str]:
    """Extract header columns from a file."""
    if is_compressed_filename(path):
        with gzip.open(path, "rt") as infile:
            raw_header = infile.readline()
    else:
        with open(path, "rt") as infile:
            raw_header = infile.readline()

    return [
        c.strip("#")
        for c in raw_header.strip("\r\n").split(input_separator)
    ]


def check_separator(separator: str, lines: list[str]) -> bool:
    """Check if a separator produces consistent columns."""

    lengths = [len(line.split(separator)) for line in lines]
    longest_line_len = max(lengths)
    shortest_line_len = min(lengths)

    if longest_line_len in (0, 1):
        return False
    if longest_line_len == shortest_line_len:
        return True
    return False

def get_separator(lines: list[str]) -> str | None:
    for separator in [",", "\t"]:
        if check_separator(separator, lines):
            return separator
    return None


def columns_file_preview(
    infile: UploadedFile,
    separator: str | None,
) -> dict[str, Any]:
    """Generate a preview of the columns file."""
    if infile.name.endswith(".gz") or infile.name.endswith(".bgz"):
        raw_content = gzip.open(infile, "rb")
    else:
        raw_content = infile

    lines = []
    for index, line in enumerate(raw_content.readlines()):
        lines.append(line.decode().strip("\r\n"))
        if index >= 20:
            break

    if separator is None:
        separator = get_separator(lines)

    if separator:
        rows = [line.split(separator) for line in lines]
    else:
        rows = [[line] for line in lines]

    header = [
        c.strip("#") for c in rows[0]
    ]
    rows_content = rows[1:5]
    preview = [
        dict(zip(header, row, strict=True)) for row in rows_content]
    return {
        "separator": separator,
        "columns": header,
        "preview": preview,
    }
