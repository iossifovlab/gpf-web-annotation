from django.urls import path, re_path
from .views import favicon, index, serve_if_found_else_index


urlpatterns = [
    path('/favicon.ico', favicon),
    path('/', index),
    re_path(r'^.*$', serve_if_found_else_index),
]
