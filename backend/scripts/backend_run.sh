#!/usr/bin/bash

/opt/conda/bin/conda run --no-capture-output -n gpf pip install -e /wd/backend

/opt/conda/bin/conda run --no-capture-output -n gpf \
    celery -A web_annotation.celery_app worker -l INFO -c 4 -D

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
while true; do
    /opt/conda/bin/conda run --no-capture-output -n gpf \
        django-admin runserver 0.0.0.0:8000
    sleep 1
done
