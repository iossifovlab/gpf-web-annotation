"""
URL configuration for gpf_web_annotation_project project.

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
from django.urls import path, re_path, include
from django.conf.urls.static import static
from django.conf import settings
from django.contrib.staticfiles import finders
from django.views.generic.base import RedirectView

from gpf_web_annotation_backend import views

import os

urlpatterns = [
    path('api-auth/', include('rest_framework.urls')),

    path('jobs/', views.JobList.as_view()),
    path('jobs/all/', views.JobAll.as_view()),
    path('jobs/create/', views.JobCreate.as_view()),
    path('jobs/<int:pk>/', views.JobDetail.as_view()),
    path('jobs/<int:pk>/file/<str:file>/', views.JobGetFile.as_view()),

    path('pipelines/', views.ListPipelines.as_view()),

    path('users/', views.UserList.as_view()),
    path('users/<int:pk>/', views.UserDetail.as_view()),

    path('login/', views.Login.as_view()),
    path('logout/', views.Logout.as_view()),
    path('register/', views.Registration.as_view()),
    path('user_info/', views.UserInfo.as_view()),

    path('static', include('gpf_web_annotation_frontend.urls')),
    *static(settings.STATIC_URL, document_root=os.path.dirname(finders.find("index.html"))),
    re_path(r'^.*$', RedirectView.as_view(url=settings.STATIC_URL.removesuffix("/"))),
]
