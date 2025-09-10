#!/usr/bin/bash

/opt/conda/bin/conda run --no-capture-output -n gpf pip install -e /wd/django-gpf-web-annotation

/opt/conda/bin/conda run --no-capture-output -n gpf \
    celery -A gpf_web_annotation_backend.celery_app worker -l INFO -c 4 -D

c=0
while true; do
    sleep 1
    /opt/conda/bin/conda run --no-capture-output -n gpf \
        celery -A gpf_web_annotation_backend.celery_app status && break
    c=$(($c+1))
    echo $c
    if [ $c -gt 2 ]; then
        echo "Celery worker did not start in time"
        exit 1
    fi
done

cd /wd/django-gpf-web-annotation/gpf_web_annotation_backend
/opt/conda/bin/conda run --no-capture-output -n gpf \
    py.test -v tests
