import os
from celery import Celery


rabbitmq_host = os.environ.get("RABBITMQ_HOST", "localhost")

app = Celery(
    "gpf-web-annotation", backend="rpc://", broker=f"pyamqp://{rabbitmq_host}"
)

app.config_from_object("django.conf:settings", namespace="CELERY")

app.autodiscover_tasks()
