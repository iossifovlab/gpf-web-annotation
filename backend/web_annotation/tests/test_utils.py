
# pylint: disable=W0621,C0114,C0116,W0212,W0613
from pathlib import Path
from subprocess import CalledProcessError
import textwrap
import pytest
from pytest_mock import MockerFixture

from web_annotation.utils import bytes_to_readable, validate_vcf

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


def test_validate_vcf_file_valid(
  tmp_path: Path,
) -> None:
    vcf = textwrap.dedent("""
        ##fileformat=VCFv4.1
        ##contig=<ID=chr1>
        #CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO
        chr1	1	.	C	A	.	.	.
    """).strip("\n")
    vcf_path = tmp_path / "valid.vcf"
    vcf_path.write_text(vcf)

    assert validate_vcf(str(vcf_path), 1) is True


def test_validate_vcf_file_limit(
  tmp_path: Path,
  mocker: MockerFixture,
) -> None:
    vcf = textwrap.dedent("""
        ##fileformat=VCFv4.1
        ##contig=<ID=chr1>
        #CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO
        chr1	1	.	C	A	.	.	.
        chr1	2	.	B	A	.	.	.
        chr1	3	.	T	A	.	.	.
    """).strip("\n")
    vcf_path = tmp_path / "invalid.vcf"
    vcf_path.write_text(vcf)

    assert validate_vcf(str(vcf_path), 2) is False


def test_validate_vcf_file_invalid_chromosome(
  tmp_path: Path,
  mocker: MockerFixture,
) -> None:
    vcf = textwrap.dedent("""
        ##fileformat=VCFv4.1
        ##contig=<ID=chr1>
        #CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO
        chr1	1	.	C	A	.	.	.
        chr1	2	.	B	A	.	.	.
        chr2	3	.	T	A	.	.	.
    """).strip("\n")
    vcf_path = tmp_path / "invalid.vcf"
    vcf_path.write_text(vcf)

    with pytest.raises(CalledProcessError) as err:
        validate_vcf(str(vcf_path))

    assert "1 Contig not defined in header" in str(err.value.stderr)


def test_validate_vcf_file_invalid_header(
  tmp_path: Path,
  mocker: MockerFixture,
) -> None:
    vcf = textwrap.dedent("""
        ##fileformat=VCFv4.1
        ##contig=<ID=chr1>
        chr1	1	.	C	A	.	.	.
        chr1	2	.	B	A	.	.	.
        chr1	3	.	T	A	.	.	.
    """).strip("\n")
    vcf_path = tmp_path / "invalid.vcf"
    vcf_path.write_text(vcf)

    with pytest.raises(CalledProcessError) as err:
        validate_vcf(str(vcf_path))

    assert "does not have valid header" in str(err.value.stderr)
