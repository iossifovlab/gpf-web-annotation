from django.contrib.staticfiles import finders
from django.contrib.staticfiles.views import serve
from django.http import FileResponse, HttpRequest, HttpResponse
from django.shortcuts import render


def index(request: HttpRequest) -> HttpResponse | FileResponse:
    return serve(request, "index.html")


def favicon(request: HttpRequest) -> HttpResponse | FileResponse:
    return render(request, "favicon.ico")


def serve_if_found_else_index(request: HttpRequest) -> HttpResponse | FileResponse:
    if finders.find(request.path.removeprefix("/")):
        return serve(request, request.path)
    return index(request)

