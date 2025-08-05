from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('web_annotation/', include("web_annotation.urls")),
    path('admin/', admin.site.urls),
]
