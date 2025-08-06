from django.contrib.auth.models import User
from rest_framework import serializers

from web_annotation.models import Job


class JobSerializer(serializers.ModelSerializer):
    class Meta:
        model = Job
        fields = ["id", "input_path", "config_path", "result_path", "created", "status"]


class UserSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = User
        fields = ['url', 'username', 'email', 'groups']
