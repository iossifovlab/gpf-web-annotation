from rest_framework import permissions


def has_job_permission(job, user) -> bool:
    return job.owner == user


class IsOwner(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return has_job_permission(obj, request.user)
