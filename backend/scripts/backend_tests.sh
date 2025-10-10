#!/usr/bin/bash

/opt/conda/bin/conda run --no-capture-output -n gpf \
    pip install --root-user-action ignore -e /wd/backend

/opt/conda/bin/conda run --no-capture-output -n gpf \
    celery -A web_annotation.celery_app worker -l INFO -c 4 -D

sleep 5

c=0
while true; do
    sleep 2
    /opt/conda/bin/conda run --no-capture-output -n gpf \
        celery -A web_annotation.celery_app status && break
    c=$(($c+1))
    echo $c
    if [ $c -gt 10 ]; then
        echo "Celery worker did not start in time"
        exit 1
    fi
done

cd /wd/backend/
mkdir -p /wd/backend/results

/opt/conda/bin/conda run --no-capture-output -n gpf \
    py.test -v web_annotation/tests \
        --cov-config /wd/backend/coveragerc \
        --cov web_annotation \
        --junitxml=/wd/backend/results/backend-tests-junit.xml \
        --mailhog http://mail:8025

/opt/conda/bin/conda run -n gpf \
    coverage xml

/opt/conda/bin/conda run -n gpf \
    coverage html --title web_annotation -d /wd/backend/results/coverage-html


cp /wd/backend/coverage.xml /wd/backend/results/backend-coverage.xml
