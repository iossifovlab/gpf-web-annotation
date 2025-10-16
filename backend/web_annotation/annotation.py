from fsspec.asyn import reset_lock
from dae.annotation.annotate_vcf import cli as vcf_cli
from dae.annotation.annotate_columns import cli as columns_cli


def annotate_vcf_file(
    input_file_path: str,
    annotation_config_path: str,
    output_file_path: str,
    work_dir_path: str,
    grr_definition: str | None,
) -> None:
    reset_lock()

    args = [
        input_file_path,
        annotation_config_path,
        "-o", output_file_path,
        "-w", work_dir_path,
        "-j 1",
        "-vv",
    ]
    if grr_definition is not None:
        args.extend(["--grr-filename", grr_definition])

    vcf_cli(args)


def annotate_columns_file(
    input_file_path: str,
    annotation_config_path: str,
    output_file_path: str,
    work_dir_path: str,
    separator: str,
    chrom_col: str,
    pos_col: str,
    ref_col: str,
    alt_col: str,
    grr_definition: str | None,
) -> None:
    reset_lock()

    args = [
        input_file_path,
        annotation_config_path,
        "--col-chrom", chrom_col,
        "--col-pos", pos_col,
        "--col-ref", ref_col,
        "--col-alt", alt_col,
        "--input-separator", separator,
        "--output-separator", separator,
        "-o", output_file_path,
        "-w", work_dir_path,
        "-j 1",
        "-vv",
    ]
    if grr_definition is not None:
        args.extend(["--grr-filename", grr_definition])

    columns_cli(args)
