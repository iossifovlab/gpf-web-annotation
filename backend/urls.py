from django.urls import path, include

from web_annotation import views


urlpatterns = [
    path('api-auth/', include('rest_framework.urls')),

    path('jobs/', views.JobList.as_view()),
    path('jobs/all/', views.JobAll.as_view()),
    path('jobs/create/', views.JobCreate.as_view()),
    path('jobs/<int:pk>/', views.JobDetail.as_view()),
    path('jobs/<int:pk>/file/<str:file>/', views.JobGetFile.as_view()),

    path('users/', views.UserList.as_view()),
    path('users/<int:pk>/', views.UserDetail.as_view()),

    path('login/', views.Login.as_view()),
    path('register/', views.Registration.as_view()),
    path('user_info/', views.UserInfo.as_view()),
]
