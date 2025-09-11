#!/usr/bin/bash

/opt/conda/bin/conda run --no-capture-output -n gpf pip install -e /wd/backend

cd /wd/backend/

/opt/conda/bin/conda run --no-capture-output -n gpf ruff check \
    --exit-zero \
    --output-format=pylint \
    --output-file=/wd/results/ruff_report web_annotation || true

/opt/conda/bin/conda run --no-capture-output -n gpf \
    pylint web_annotation -f parseable --reports=no -j 4 \
    --exit-zero > /wd/results/pylint_report || true

/opt/conda/bin/conda run --no-capture-output -n gpf mypy web_annotation \
    --pretty \
    --show-error-context \
    --no-incremental \
    > /wd/results/mypy_report || true

