# backend/authentication/admin_views.py (UPDATE this existing file)
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.utils import timezone
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
            'instructor_approved': getattr(user, 'instructor_approved', False),
            'approval_requested': getattr(user, 'approval_requested', False),
            'approval_status': getattr(user, 'approval_status', 'none'),
            'date_joined': user.date_joined.isoformat() if user.date_joined else None,
            'last_login': user.last_login.isoformat() if user.last_login else None
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

# NEW INSTRUCTOR APPROVAL FUNCTIONS - ADD THESE TO YOUR EXISTING FILE

@api_view(['GET'])
@permission_classes([IsAdminUser])
def pending_instructor_requests(request):
    """Get all pending instructor approval requests"""
    try:
        pending_users = User.objects.filter(
            approval_requested=True,
            instructor_approved=False,
            rejection_reason__isnull=True
        ).order_by('-approval_requested_at')
        
        users_data = []
        for user in pending_users:
            users_data.append({
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'phone_number': getattr(user, 'phone_number', ''),
                'approval_requested_at': user.approval_requested_at.isoformat() if user.approval_requested_at else None,
                'date_joined': user.date_joined.isoformat() if user.date_joined else None
            })
        
        return Response(users_data)
    except Exception as e:
        print(f"Error in pending_instructor_requests: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAdminUser])
def approve_instructor(request, user_id):
    """Approve instructor request"""
    try:
        user = get_object_or_404(User, id=user_id)
        
        if not getattr(user, 'approval_requested', False):
            return Response(
                {'error': 'No approval request found for this user'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Approve the user
        user.is_instructor = True
        user.instructor_approved = True
        user.approved_by = request.user
        user.approved_at = timezone.now()
        user.approval_requested = False
        user.save()
        
        print(f"Instructor approved: {user.username} by {request.user.username}")
        
        return Response({
            'message': f'User {user.username} has been approved as an instructor',
            'user': UserSerializer(user).data
        })
    except Exception as e:
        print(f"Error in approve_instructor: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAdminUser])
def reject_instructor(request, user_id):
    """Reject instructor request"""
    try:
        user = get_object_or_404(User, id=user_id)
        rejection_reason = request.data.get('reason', 'No reason provided')
        
        if not getattr(user, 'approval_requested', False):
            return Response(
                {'error': 'No approval request found for this user'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Reject the user
        user.rejection_reason = rejection_reason
        user.approval_requested = False
        user.is_instructor = False
        user.instructor_approved = False
        user.save()
        
        print(f"Instructor rejected: {user.username} by {request.user.username}, reason: {rejection_reason}")
        
        return Response({
            'message': f'User {user.username} instructor request has been rejected',
            'reason': rejection_reason
        })
    except Exception as e:
        print(f"Error in reject_instructor: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAdminUser])
def instructor_approval_history(request):
    """Get history of all instructor approvals/rejections"""
    try:
        # Approved instructors
        approved = User.objects.filter(
            instructor_approved=True
        ).order_by('-approved_at')
        
        # Rejected requests
        rejected = User.objects.filter(
            rejection_reason__isnull=False
        ).order_by('-updated_at')
        
        history_data = {
            'approved': [],
            'rejected': []
        }
        
        for user in approved:
            history_data['approved'].append({
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'approved_at': user.approved_at.isoformat() if user.approved_at else None,
                'approved_by': user.approved_by.username if user.approved_by else None
            })
        
        for user in rejected:
            history_data['rejected'].append({
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'rejection_reason': user.rejection_reason,
                'rejected_at': user.updated_at.isoformat() if user.updated_at else None
            })
        
        return Response(history_data)
    except Exception as e:
        print(f"Error in instructor_approval_history: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
