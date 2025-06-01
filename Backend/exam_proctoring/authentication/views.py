# backend/authentication/views.py
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework.views import APIView
from django.contrib.auth import authenticate, get_user_model
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.utils import timezone
from .serializers import UserSerializer, RegisterSerializer

CustomUser = get_user_model()

@method_decorator(csrf_exempt, name='dispatch')
class RegisterView(generics.CreateAPIView):
    queryset = CustomUser.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]  # Allow anyone to register
    authentication_classes = []  # No authentication required for registration

    def create(self, request, *args, **kwargs):
        print(f"Registration attempt with data: {request.data}")  # Debug log
        
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            user_data = serializer.validated_data
            
            # Check if user wants to be an instructor
            wants_instructor = user_data.get('is_instructor', False)
            
            try:
                # Create user
                user = CustomUser.objects.create_user(
                    username=user_data['username'],
                    email=user_data['email'],
                    password=user_data['password'],
                    first_name=user_data.get('first_name', ''),
                    last_name=user_data.get('last_name', ''),
                    phone_number=user_data.get('phone_number', ''),
                    is_student=user_data.get('is_student', True)
                )
                
                if wants_instructor:
                    # Set approval request flags
                    user.approval_requested = True
                    user.approval_requested_at = timezone.now()
                    user.is_instructor = False
                    user.instructor_approved = False
                    user.save()
                    
                    return Response({
                        'message': 'Registration successful. Your instructor request has been submitted for admin approval.',
                        'approval_status': 'pending',
                        'user': UserSerializer(user).data
                    }, status=status.HTTP_201_CREATED)
                else:
                    # Regular student registration
                    token, created = Token.objects.get_or_create(user=user)
                    return Response({
                        'token': token.key,
                        'user': UserSerializer(user).data
                    }, status=status.HTTP_201_CREATED)
                    
            except Exception as e:
                print(f"Error creating user: {e}")
                return Response({
                    'error': 'Failed to create user'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        print(f"Registration validation errors: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@method_decorator(csrf_exempt, name='dispatch')
class LoginView(generics.GenericAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')

        print(f"Login attempt for username: {username}")

        if username and password:
            user = authenticate(username=username, password=password)
            if user:
                if user.is_active:
                    token, created = Token.objects.get_or_create(user=user)
                    return Response({
                        'token': token.key,
                        'user': UserSerializer(user).data
                    })
                else:
                    return Response({
                        'error': 'Account is disabled'
                    }, status=status.HTTP_401_UNAUTHORIZED)
            else:
                return Response({
                    'error': 'Invalid credentials'
                }, status=status.HTTP_401_UNAUTHORIZED)
        else:
            return Response({
                'error': 'Username and password required'
            }, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
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
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

class UpdateProfileView(generics.UpdateAPIView):
    serializer_class = UserSerializer  # Use UserSerializer or create UpdateProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')
        
        if not old_password or not new_password:
            return Response({
                'error': 'Both old and new passwords are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        user = request.user
        
        # Check old password
        if not user.check_password(old_password):
            return Response({
                'error': 'Old password is incorrect'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Set new password
        user.set_password(new_password)
        user.save()
        
        return Response({
            'message': 'Password changed successfully'
        }, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
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
