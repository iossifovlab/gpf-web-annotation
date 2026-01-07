
import argparse
import sys
from pysam import VariantFile
from dae.annotation.annotation_factory import load_pipeline_from_file
from dae.annotation.annotate_vcf import _VCFWriter
from dae.genomic_resources.repository_factory import (
    build_genomic_resource_repository,
)
import itertools

def _build_argument_parser() -> argparse.ArgumentParser:
    """Construct and configure argument parser."""
    parser = argparse.ArgumentParser(
        description="",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "input",
        help="the input vcf file")
    parser.add_argument(
        "pipeline",
        help="the pipeline config path to use")
    parser.add_argument(
        "grr",
        help="the grr definition file to use")
    parser.add_argument(
        "--limit", default=None, type=int, nargs="?",
        help="variants limit")

    return parser


def main(argv: list[str] | None = None) -> int:
    """Validate VCF file."""
    if not argv:
        argv = sys.argv[1:]
    arg_parser = _build_argument_parser()
    args = vars(arg_parser.parse_args(argv))

    grr = build_genomic_resource_repository(file_name=args["grr"])
    vcf_file = VariantFile(args["input"])
    pipeline = load_pipeline_from_file(args["pipeline"], grr)
    variants_limit = args["limit"]

    annotation_attributes = [
        attr for attr in pipeline.get_attributes()
        if not attr.internal
    ]

    header = _VCFWriter._update_header(
        vcf_file.header.copy(),
        annotation_attributes,
        [],
    )

    variants = itertools.islice(
        vcf_file.fetch(),
        None,
        variants_limit + 1 if variants_limit else None,
    )

    for i, variant in enumerate(variants):
        if variants_limit and i >= variants_limit:
            print("exceeded", file=sys.stdout)
            return 0
        variant.translate(header)

    print("valid", file=sys.stdout)
    return 0


if __name__ == '__main__':
    main()
