# backend/authentication/views.py
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes
from django.contrib.auth import authenticate
from django.contrib.auth import get_user_model
from .serializers import (
    UserSerializer, RegisterSerializer, ChangePasswordSerializer, 
    UpdateProfileSerializer
)

User = get_user_model()

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # Create token for the new user
        token, created = Token.objects.get_or_create(user=user)
        
        return Response({
            'user': UserSerializer(user).data,
            'token': token.key,
            'message': 'User registered successfully'
        }, status=status.HTTP_201_CREATED)

class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        
        if not username or not password:
            return Response({
                'error': 'Username and password are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        user = authenticate(username=username, password=password)
        
        if user:
            if user.is_active:
                token, created = Token.objects.get_or_create(user=user)
                user_data = UserSerializer(user).data
                return Response({
                    'token': token.key, 
                    'user': user_data,
                    'message': 'Login successful'
                })
            else:
                return Response({
                    'error': 'Account is deactivated'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        return Response({
            'error': 'Invalid credentials'
        }, status=status.HTTP_400_BAD_REQUEST)

class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            request.user.auth_token.delete()
            return Response({
                'message': 'Logout successful'
            }, status=status.HTTP_200_OK)
        except:
            return Response({
                'error': 'Error logging out'
            }, status=status.HTTP_400_BAD_REQUEST)

class UserDetailView(generics.RetrieveAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

class UpdateProfileView(generics.UpdateAPIView):
    serializer_class = UpdateProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        
        if serializer.is_valid():
            user = request.user
            
            # Check old password
            if not user.check_password(serializer.validated_data['old_password']):
                return Response({
                    'error': 'Old password is incorrect'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Set new password
            user.set_password(serializer.validated_data['new_password'])
            user.save()
            
            return Response({
                'message': 'Password changed successfully'
            }, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# backend/authentication/views.py (update user_stats function)
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def user_stats(request):
    """Get user statistics"""
    try:
        user = request.user
        
        # Import here to avoid circular imports
        from exam_app.models import ExamAttempt
        
        attempts = ExamAttempt.objects.filter(user=user)
        completed_exams = attempts.filter(status='COMPLETED').count()
        
        # Calculate total and average score
        completed_attempts = attempts.filter(status='COMPLETED', score__isnull=False)
        total_score = sum([attempt.score for attempt in completed_attempts])
        avg_score = total_score / completed_exams if completed_exams > 0 else 0
        
        stats = {
            'total_attempts': attempts.count(),
            'completed_exams': completed_exams,
            'average_score': round(avg_score, 2),
            'total_score': total_score
        }
        
        print(f"User stats for {user.username}: {stats}")
        return Response(stats)
        
    except Exception as e:
        print(f"Error in user_stats: {e}")
        return Response({
            'total_attempts': 0,
            'completed_exams': 0,
            'average_score': 0,
            'total_score': 0
        })
