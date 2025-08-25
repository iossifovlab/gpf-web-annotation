import os
from django.urls import path, re_path, include
from django.conf.urls.static import static
from django.conf import settings
from django.contrib.staticfiles import finders
from django.views.generic.base import RedirectView

# from . import views


urlpatterns = []

# urlpatterns = [
#     path('api-auth', include('rest_framework.urls')),
# 
#     path('jobs', views.JobList.as_view()),
#     path('jobs/all', views.JobAll.as_view()),
#     path('jobs/create', views.JobCreate.as_view()),
#     path('jobs/<int:pk>', views.JobDetail.as_view()),
#     path('jobs/<int:pk>/file/<str:file>', views.JobGetFile.as_view()),
# 
#     path('users', views.UserList.as_view()),
#     path('users/<int:pk>', views.UserDetail.as_view()),
# 
#     path('login', views.Login.as_view()),
#     path('register', views.Registration.as_view()),
#     path('static', include('gpf_web_annotation_frontend.urls')),
#     # path('static', serve, {'document_root': os.path.dirname(finders.find("index.html")), "show_indexes": True, "path": "index.html"}),
#     *static(settings.STATIC_URL, document_root=os.path.dirname(finders.find("index.html"))),
#     re_path(r'^.*$', RedirectView.as_view(url=settings.STATIC_URL.removesuffix("/"))),
# ]
