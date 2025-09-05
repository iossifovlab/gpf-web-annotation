from django.contrib.staticfiles import finders
from django.contrib.staticfiles.views import serve
from django.http import FileResponse, HttpRequest, HttpResponse
from django.shortcuts import render
from django.conf import settings

import sys

def index(request: HttpRequest, arg2=None) -> HttpResponse | FileResponse:
    return serve(request, "index.html")


def favicon(request: HttpRequest) -> HttpResponse | FileResponse:
    return render(request, "favicon.ico")


def serve_if_found_else_index(request: HttpRequest) -> HttpResponse | FileResponse:
    static_file_path = request.path.removeprefix(settings.STATIC_URL.removesuffix('/'))
    if finders.find(static_file_path):
        return serve(request, static_file_path)
    return index(request)

