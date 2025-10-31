# pylint: disable=C0114,C0116
import gzip
import io

from django.core.files.uploadedfile import SimpleUploadedFile

from web_annotation.annotate_helpers import columns_file_preview


def _gzip_file(name: str, content: str) -> SimpleUploadedFile:
    buffer = io.BytesIO()
    with gzip.GzipFile(fileobj=buffer, mode="wb") as gz_file:
        gz_file.write(content.encode())
    return SimpleUploadedFile(name, buffer.getvalue())


def test_columns_file_preview_detects_separator_from_gzip() -> None:
    file_content = "col1,col2\n1,2\n3,4\n5,6\n7,8\n9,10\n"
    uploaded_file = _gzip_file("data.csv.gz", file_content)

    preview = columns_file_preview(uploaded_file, separator=None)

    assert preview["separator"] == ","
    assert preview["columns"] == ["col1", "col2"]
    assert preview["preview"] == [
        {"col1": "1", "col2": "2"},
        {"col1": "3", "col2": "4"},
        {"col1": "5", "col2": "6"},
        {"col1": "7", "col2": "8"},
    ]


def test_columns_file_preview_uses_provided_separator() -> None:
    file_content = "col1\tcol2\n1\t2\n3\t4\n5\t6\n7\t8\n"
    uploaded_file = SimpleUploadedFile("data.tsv", file_content.encode())

    preview = columns_file_preview(uploaded_file, separator="\t")

    assert preview["separator"] == "\t"
    assert preview["columns"] == ["col1", "col2"]
    assert preview["preview"] == [
        {"col1": "1", "col2": "2"},
        {"col1": "3", "col2": "4"},
        {"col1": "5", "col2": "6"},
        {"col1": "7", "col2": "8"},
    ]
