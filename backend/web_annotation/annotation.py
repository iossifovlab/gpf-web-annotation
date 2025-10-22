"""Module for annotation CLI function adaptations."""
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
    """Run annotate vcf on the files from a task."""
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


def annotate_columns_file(  # pylint: disable=too-many-arguments
    reference_genome: str,
    input_file_path: str,
    annotation_config_path: str,
    output_file_path: str,
    work_dir_path: str,
    grr_definition: str | None,
    *,
    separator: str,
    col_chrom: str,
    col_pos: str,
    col_ref: str,
    col_alt: str,
) -> None:
    """Run annotate columns on the files from a task."""
    reset_lock()
    args = [
        input_file_path,
        annotation_config_path,
        "--reference-genome-resource-id", reference_genome,
        "--col-chrom", col_chrom,
        "--col-pos", col_pos,
        "--col-ref", col_ref,
        "--col-alt", col_alt,
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
