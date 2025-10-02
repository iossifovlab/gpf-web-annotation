"""
URL configuration for gpf_web_annotation project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.urls import path, include

from web_annotation import views


urlpatterns = [
    path('api-auth', include('rest_framework.urls')),

    path('api/jobs', views.JobList.as_view()),
    path('api/jobs/all', views.JobAll.as_view()),
    path('api/jobs/create', views.JobCreate.as_view()),
    path('api/jobs/<int:pk>', views.JobDetail.as_view()),
    path('api/jobs/<int:pk>/file/<str:file>', views.JobGetFile.as_view()),

    path('api/pipelines', views.ListPipelines.as_view()),

    path('api/users', views.UserList.as_view()),
    path('api/users/<int:pk>', views.UserDetail.as_view()),

    path('api/login', views.Login.as_view()),
    path('api/logout', views.Logout.as_view()),
    path('api/register', views.Registration.as_view()),
    path('api/user_info', views.UserInfo.as_view()),
    path('api/jobs/validate', views.AnnotationConfigValidation.as_view()),
]
