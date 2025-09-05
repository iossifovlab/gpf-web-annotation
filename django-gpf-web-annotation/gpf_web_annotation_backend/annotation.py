import fsspec
from dae.annotation.annotate_vcf import cli


def run_job(
    input_file_path: str,
    annotation_config_path: str,
    output_file_path: str,
    work_dir_path: str,
):
    fsspec.asyn.reset_lock()

    cli([
        input_file_path,
        annotation_config_path,
        "-o", output_file_path,
        "-w", work_dir_path,
        "-j 1",
        "-vv",
    ])
