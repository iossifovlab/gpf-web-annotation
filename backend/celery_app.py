from celery import Celery

app = Celery(
    "gpf-web-annotation", backend="rpc://", broker="pyamqp://localhost"
)

app.config_from_object("django.conf:settings", namespace="CELERY")

app.autodiscover_tasks()
