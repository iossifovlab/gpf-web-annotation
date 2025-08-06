from django.urls import include, path
from rest_framework import routers

from web_annotation import views


router = routers.DefaultRouter()
router.register(r'users', views.UserViewSet)


urlpatterns = [
    path('', include(router.urls)),
    path('api-auth/', include('rest_framework.urls', namespace='rest_framework')),
    path('jobs/', views.JobList.as_view()),
    path('jobs/create/', views.JobCreate.as_view()),
    path('jobs/<int:pk>/', views.JobDetail.as_view()),
    path('jobs/<int:pk>/input/', views.JobGetInput.as_view()),
    path('jobs/<int:pk>/config/', views.JobGetConfig.as_view()),
    path('jobs/<int:pk>/result/', views.JobGetResult.as_view()),
]
