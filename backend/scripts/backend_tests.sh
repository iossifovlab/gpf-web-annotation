#!/usr/bin/bash

/opt/conda/bin/conda run --no-capture-output -n gpf pip install -e /wd/backend

/opt/conda/bin/conda run --no-capture-output -n gpf \
    celery -A web_annotation.celery_app worker -l INFO -c 4 -D

c=0
while true; do
    sleep 1
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
/opt/conda/bin/conda run --no-capture-output -n gpf \
    py.test -v web_annotation/tests \
        --cov-config /wd/backend/coveragerc \
        --cov web_annotation \
        --junitxml=/wd/results/backend-tests-junit.xml

/opt/conda/bin/conda run -n gpf \
    coverage xml

/opt/conda/bin/conda run -n gpf \
    coverage html --title web_annotation -d /wd/results/coverage-html


cp /wd/backend/coverage.xml /wd/results/backend-coverage.xml
