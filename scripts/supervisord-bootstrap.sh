#!/bin/bash

set -e

# echo "waiting for mysql on '${WDAE_DB_HOST}:${WDAE_DB_PORT}'..."
# /wait-for-it.sh ${WDAE_DB_HOST}:${WDAE_DB_PORT} -t 300
# echo "done..."


source /gpf/bin/activate

DJANGO_SETTINGS_MODULE='gpf_web_annotation_project.settings' django-admin migrate

DJANGO_SETTINGS_MODULE='gpf_web_annotation_project.settings' django-admin  collectstatic --noinput

supervisorctl start celery

supervisorctl start gpfwa

/wait-for-it.sh localhost:9001 -t 240

rc=$?
if [ $rc -ne 0 ]; then
    echo -e "\n---------------------------------------"
    echo -e "  gpf gunicorn not ready! Exiting..."
    echo -e "---------------------------------------"
    exit 1
fi

echo -e "\n\n------------------------------------------------------------------------"
echo -e "gpf gunicorn running..."
echo -e "------------------------------------------------------------------------\n\n"


a2enmod headers

echo "enabling apache site: localhost..."
a2ensite localhost

supervisorctl start apache2

/wait-for-it.sh localhost:80 -t 240

rc=$?
if [ $rc -ne 0 ]; then
    echo -e "\n---------------------------------------"
    echo -e "  Apache2 not ready! Exiting..."
    echo -e "---------------------------------------"
    exit 1
fi

echo -e "\n\n--------------------------------------------------------------------------------"
echo -e "Apache2 running..."
echo -e "--------------------------------------------------------------------------------\n\n"
