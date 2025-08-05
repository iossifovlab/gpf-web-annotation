from django.http import JsonResponse
from django.views.decorators.http import require_http_methods


@require_http_methods(["GET"])
def basic(request):
    return JsonResponse({"content": "hello"})
