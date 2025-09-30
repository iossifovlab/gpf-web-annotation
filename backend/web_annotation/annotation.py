from fsspec.asyn import reset_lock
from dae.annotation.annotate_vcf import cli


def annotate_vcf_file(
    input_file_path: str,
    annotation_config_path: str,
    output_file_path: str,
    work_dir_path: str,
    grr_directory: str | None,
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
    if grr_directory is not None:
        args.extend(["--grr-directory", grr_directory])

    cli(args)
