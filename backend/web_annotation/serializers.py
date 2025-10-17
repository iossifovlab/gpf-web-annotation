from rest_framework import serializers

from .models import Job, User


class JobSerializer(serializers.ModelSerializer):
    """Job model serializer class."""
    owner = serializers.ReadOnlyField(source='owner.email')

    class Meta:  # pylint: disable=too-few-public-methods
        """Meta class for job serializer."""
        model = Job
        fields = ["id", "created", "status", "owner"]


class UserSerializer(serializers.ModelSerializer):
    """User model serializer class."""
    jobs = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Job.objects.all())

    class Meta:  # pylint: disable=too-few-public-methods
        """Meta class for user serializer."""
        model = User
        fields = ["email", "jobs"]
