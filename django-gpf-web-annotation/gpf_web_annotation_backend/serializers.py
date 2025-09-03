from rest_framework import serializers

from .models import Job, User


class JobSerializer(serializers.ModelSerializer):
    owner = serializers.ReadOnlyField(source='owner.email')

    class Meta:
        model = Job
        fields = ["id", "created", "status", "owner"]


class UserSerializer(serializers.ModelSerializer):
    jobs = serializers.PrimaryKeyRelatedField(many=True, queryset=Job.objects.all())

    class Meta:
        model = User
        fields = ["email", "jobs"]
