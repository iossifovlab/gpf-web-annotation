from django.urls import path, include

from web_annotation import views


urlpatterns = [
    path('api-auth/', include('rest_framework.urls')),

    path('jobs/', views.JobList.as_view()),
    path('jobs/create/', views.JobCreate.as_view()),
    path('jobs/<int:pk>/', views.JobDetail.as_view()),
    path('jobs/<int:pk>/input/', views.JobGetInput.as_view()),
    path('jobs/<int:pk>/config/', views.JobGetConfig.as_view()),
    path('jobs/<int:pk>/result/', views.JobGetResult.as_view()),

    path('users/', views.UserList.as_view()),
    path('users/<int:pk>/', views.UserDetail.as_view()),
    path('register/', views.Registration.as_view()),
]
