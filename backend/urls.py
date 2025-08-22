from django.urls import path, re_path, include
from django.conf.urls.static import static
from django.contrib.staticfiles import views as staticviews
from django.conf import settings
from django.views.generic.base import RedirectView
from django.views.static import serve

from web_annotation import views


urlpatterns = [
    path('api-auth', include('rest_framework.urls')),

    path('jobs', views.JobList.as_view()),
    path('jobs/all', views.JobAll.as_view()),
    path('jobs/create', views.JobCreate.as_view()),
    path('jobs/<int:pk>', views.JobDetail.as_view()),
    path('jobs/<int:pk>/file/<str:file>', views.JobGetFile.as_view()),

    path('users', views.UserList.as_view()),
    path('users/<int:pk>', views.UserDetail.as_view()),

    path('login', views.Login.as_view()),
    path('register', views.Registration.as_view()),
    path('static', serve, {'document_root': 'pesho', "show_indexes": True, "path": "index.html"})
    # path('', RedirectView.as_view(url=settings.STATIC_URL)),
    # re_path(r"^static/$", staticviews.serve),
] + static(settings.STATIC_URL, document_root=settings.STATIC_ROOT, show_indexes=True)
