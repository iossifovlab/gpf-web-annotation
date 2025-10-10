#!/usr/bin/bash

/opt/conda/bin/conda run --no-capture-output -n gpf \
    pip install --root-user-action ignore -e /wd/backend

cd /wd/
mkdir -p /wd/backend/results

/opt/conda/bin/conda run --no-capture-output -n gpf ruff check \
    --exit-zero \
    --output-format=pylint \
    --output-file=/wd/backend/results/ruff_report backend/web_annotation || true

/opt/conda/bin/conda run --no-capture-output -n gpf \
    pylint backend/web_annotation -f parseable --reports=no -j 4 \
    --exit-zero > /wd/backend/results/pylint_report || true

/opt/conda/bin/conda run --no-capture-output -n gpf mypy \
    backend/web_annotation \
    --pretty \
    --show-error-context \
    --no-incremental > /wd/backend/results/mypy_report || true
