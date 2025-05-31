# backend/authentication/admin_views.py (create this new file)
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from .serializers import UserSerializer

User = get_user_model()

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_users_list(request):
    """Get all users for admin management"""
    if not (request.user.is_staff or getattr(request.user, 'is_instructor', False)):
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
    
    users = User.objects.all().order_by('-date_joined')
    
    users_data = []
    for user in users:
        users_data.append({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'is_active': user.is_active,
            'is_staff': user.is_staff,
            'is_student': getattr(user, 'is_student', True),
            'is_instructor': getattr(user, 'is_instructor', False),
            'date_joined': user.date_joined,
            'last_login': user.last_login
        })
    
    return Response(users_data)

@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def manage_user(request, user_id):
    """Update or delete a user"""
    if not request.user.is_staff:
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
    
    user = get_object_or_404(User, id=user_id)
    
    if request.method == 'PATCH':
        # Update user fields
        for field in ['is_active', 'is_staff', 'is_student', 'is_instructor']:
            if field in request.data:
                setattr(user, field, request.data[field])
        user.save()
        
        return Response({'message': 'User updated successfully'})
    
    elif request.method == 'DELETE':
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
