from django.urls import include, path, re_path
from rest_framework import routers

from web_annotation import views


router = routers.DefaultRouter()
router.register(r'users', views.UserViewSet)


urlpatterns = [
    path('', include(router.urls)),
    path('api-auth/', include('rest_framework.urls', namespace='rest_framework')),
    re_path(r'^upload$', views.FileUploadView.as_view())
]
