from django.contrib.auth.models import User
from rest_framework import serializers

from web_annotation.models import Job


class JobSerializer(serializers.ModelSerializer):
    owner = serializers.ReadOnlyField(source='owner.username')

    class Meta:
        model = Job
        fields = ["id", "created", "status", "owner"]


class UserSerializer(serializers.ModelSerializer):
    jobs = serializers.PrimaryKeyRelatedField(many=True, queryset=Job.objects.all())

    class Meta:
        model = User
        fields = ["username", "email", "jobs"]
