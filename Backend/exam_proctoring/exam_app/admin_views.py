# backend/exam_app/admin_views.py (update imports)
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db import transaction
import traceback
from .models import Subject, Exam, Question, Option, ExamAttempt
from .serializers import ExamSerializer, QuestionSerializer, ExamAttemptSerializer, SubjectSerializer  # Import from serializers

User = get_user_model()

# Remove the SubjectSerializer class definition from here

def is_admin_user(user):
    """Check if user has admin privileges"""
    return user.is_staff or getattr(user, 'is_instructor', False)

class SubjectListCreateView(generics.ListCreateAPIView):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        if is_admin_user(self.request.user):
            return Subject.objects.all()
        return Subject.objects.none()

# backend/exam_app/admin_views.py (update ExamAdminListCreateView)
class ExamAdminListCreateView(generics.ListCreateAPIView):
    queryset = Exam.objects.all()
    serializer_class = ExamSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        if is_admin_user(self.request.user):
            return Exam.objects.all().order_by('-created_at')
        return Exam.objects.none()
    
    def create(self, request, *args, **kwargs):
        try:
            print(f"Creating exam with data: {request.data}")
            
            # Validate that subject exists
            subject_id = request.data.get('subject')
            if not subject_id:
                return Response(
                    {'error': 'Subject is required'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            try:
                subject = Subject.objects.get(id=subject_id)
                print(f"Found subject: {subject.name}")
            except Subject.DoesNotExist:
                return Response(
                    {'error': 'Invalid subject selected'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Ensure datetime fields are properly formatted
            exam_data = request.data.copy()
            
            # Convert datetime strings to proper datetime objects if needed
            if 'start_time' in exam_data and isinstance(exam_data['start_time'], str):
                try:
                    from datetime import datetime
                    exam_data['start_time'] = datetime.fromisoformat(exam_data['start_time'].replace('T', ' '))
                except:
                    pass
            
            if 'end_time' in exam_data and isinstance(exam_data['end_time'], str):
                try:
                    from datetime import datetime
                    exam_data['end_time'] = datetime.fromisoformat(exam_data['end_time'].replace('T', ' '))
                except:
                    pass
            
            serializer = self.get_serializer(data=exam_data)
            if serializer.is_valid():
                exam = serializer.save(created_by=request.user)
                print(f"Created exam: {exam.title} (ID: {exam.id})")
                print(f"Exam details: Active={exam.is_active}, Start={exam.start_time}, End={exam.end_time}")
                
                # Clear any potential cache
                from django.core.cache import cache
                cache.clear()
                
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            else:
                print(f"Serializer errors: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            print(f"Error creating exam: {e}")
            import traceback
            traceback.print_exc()
            return Response(
                {'error': f'Internal server error: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_stats(request):
    """Get admin dashboard statistics"""
    try:
        if not is_admin_user(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        total_exams = Exam.objects.count()
        active_students = User.objects.filter(is_active=True).count()
        total_attempts = ExamAttempt.objects.count()
        
        # Get violations count for today
        today = timezone.now().date()
        violations_today = 0
        
        try:
            from proctoring.models import ViolationLog
            violations_today = ViolationLog.objects.filter(
                timestamp__date=today
            ).count()
        except Exception:
            violations_today = 0
        
        return Response({
            'total_exams': total_exams,
            'active_students': active_students,
            'total_attempts': total_attempts,
            'violations_today': violations_today
        })
    except Exception as e:
        print(f"Error in admin_stats: {e}")
        print(traceback.format_exc())
        return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def recent_attempts(request):
    """Get recent exam attempts"""
    try:
        if not is_admin_user(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        attempts = ExamAttempt.objects.select_related('user', 'exam').order_by('-start_time')[:20]
        
        attempts_data = []
        for attempt in attempts:
            violations_count = 0
            try:
                from proctoring.models import ViolationLog, ProctoringSession
                session = ProctoringSession.objects.filter(attempt=attempt).first()
                if session:
                    violations_count = ViolationLog.objects.filter(session=session).count()
            except Exception:
                pass
            
            attempts_data.append({
                'id': attempt.id,
                'user_name': attempt.user.username,
                'exam_title': attempt.exam.title,
                'status': attempt.status,
                'score': attempt.score,
                'total_marks': attempt.exam.total_marks,
                'start_time': attempt.start_time.isoformat() if attempt.start_time else None,
                'violations_count': violations_count
            })
        
        return Response(attempts_data)
    except Exception as e:
        print(f"Error in recent_attempts: {e}")
        print(traceback.format_exc())
        return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def active_exams(request):
    """Get currently active exams"""
    try:
        if not is_admin_user(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        now = timezone.now()
        active_exams_qs = Exam.objects.filter(
            is_active=True,
            start_time__lte=now,
            end_time__gte=now
        )
        
        exams_data = []
        for exam in active_exams_qs:
            active_attempts = ExamAttempt.objects.filter(
                exam=exam,
                status__in=['STARTED', 'IN_PROGRESS']
            ).count()
            
            violations_count = 0
            try:
                from proctoring.models import ViolationLog, ProctoringSession
                sessions = ProctoringSession.objects.filter(attempt__exam=exam)
                violations_count = ViolationLog.objects.filter(session__in=sessions).count()
            except Exception:
                pass
            
            exams_data.append({
                'id': exam.id,
                'title': exam.title,
                'start_time': exam.start_time.isoformat() if exam.start_time else None,
                'end_time': exam.end_time.isoformat() if exam.end_time else None,
                'active_attempts': active_attempts,
                'violations_count': violations_count
            })
        
        return Response(exams_data)
    except Exception as e:
        print(f"Error in active_exams: {e}")
        print(traceback.format_exc())
        return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def exam_questions(request, exam_id):
    """Get questions for a specific exam"""
    try:
        if not is_admin_user(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        exam = get_object_or_404(Exam, id=exam_id)
        questions = Question.objects.filter(exam=exam).order_by('order')
        serializer = QuestionSerializer(questions, many=True)
        return Response(serializer.data)
    except Exception as e:
        print(f"Error in exam_questions: {e}")
        print(traceback.format_exc())
        return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
# backend/exam_app/admin_views.py (update create_question function)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_question(request):
    """Create a new question"""
    try:
        if not is_admin_user(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        print(f"Received question data: {request.data}")  # Debug log
        
        # Validate required fields
        if not request.data.get('exam'):
            return Response({'error': 'Exam ID is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        if not request.data.get('question_text'):
            return Response({'error': 'Question text is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if exam exists
        try:
            exam = Exam.objects.get(id=request.data.get('exam'))
            print(f"Found exam: {exam.title}")
        except Exam.DoesNotExist:
            return Response({'error': 'Invalid exam selected'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Create question data
        question_data = {
            'exam': exam.id,
            'question_text': request.data.get('question_text'),
            'question_type': request.data.get('question_type', 'MCQ'),
            'marks': request.data.get('marks', 1),
            'order': request.data.get('order', 0)
        }
        
        serializer = QuestionSerializer(data=question_data)
        if serializer.is_valid():
            question = serializer.save()
            print(f"Created question: {question.id}")
            
            # Create options if provided
            options_data = request.data.get('options', [])
            for i, option_data in enumerate(options_data):
                if option_data.get('option_text'):  # Only create non-empty options
                    Option.objects.create(
                        question=question,
                        option_text=option_data.get('option_text', ''),
                        is_correct=option_data.get('is_correct', False),
                        order=i
                    )
                    print(f"Created option: {option_data.get('option_text')}")
            
            # Return question with options
            question_with_options = QuestionSerializer(question).data
            return Response(question_with_options, status=status.HTTP_201_CREATED)
        else:
            print(f"Serializer errors: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
    except Exception as e:
        print(f"Error creating question: {e}")
        print(traceback.format_exc())
        return Response(
            {'error': f'Internal server error: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def manage_question(request, question_id):
    """Update or delete a question"""
    try:
        if not is_admin_user(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        question = get_object_or_404(Question, id=question_id)
        print(f"Managing question: {question.id}")
        
        if request.method == 'PUT':
            # Update question
            question_data = {
                'question_text': request.data.get('question_text', question.question_text),
                'question_type': request.data.get('question_type', question.question_type),
                'marks': request.data.get('marks', question.marks),
                'order': request.data.get('order', question.order)
            }
            
            serializer = QuestionSerializer(question, data=question_data, partial=True)
            if serializer.is_valid():
                question = serializer.save()
                
                # Update options
                question.options.all().delete()  # Remove existing options
                options_data = request.data.get('options', [])
                for i, option_data in enumerate(options_data):
                    if option_data.get('option_text'):  # Only create non-empty options
                        Option.objects.create(
                            question=question,
                            option_text=option_data.get('option_text', ''),
                            is_correct=option_data.get('is_correct', False),
                            order=i
                        )
                
                question_with_options = QuestionSerializer(question).data
                return Response(question_with_options)
            else:
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        elif request.method == 'DELETE':
            question.delete()
            return Response({'message': 'Question deleted successfully'}, status=status.HTTP_204_NO_CONTENT)
            
    except Exception as e:
        print(f"Error managing question: {e}")
        print(traceback.format_exc())
        return Response(
            {'error': f'Internal server error: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def manage_question(request, question_id):
    """Update or delete a question"""
    try:
        if not is_admin_user(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        question = get_object_or_404(Question, id=question_id)
        
        if request.method == 'PUT':
            serializer = QuestionSerializer(question, data=request.data)
            if serializer.is_valid():
                question = serializer.save()
                
                # Update options
                question.options.all().delete()  # Remove existing options
                options_data = request.data.get('options', [])
                for option_data in options_data:
                    Option.objects.create(
                        question=question,
                        option_text=option_data.get('option_text', ''),
                        is_correct=option_data.get('is_correct', False),
                        order=option_data.get('order', 0)
                    )
                
                return Response(QuestionSerializer(question).data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        elif request.method == 'DELETE':
            question.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
    except Exception as e:
        print(f"Error in manage_question: {e}")
        print(traceback.format_exc())
        return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
# backend/exam_app/admin_views.py (add missing functions)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def attempt_details(request, attempt_id):
    """Get details for a specific attempt"""
    try:
        if not is_admin_user(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        attempt = get_object_or_404(ExamAttempt, id=attempt_id)
        
        attempt_data = {
            'id': attempt.id,
            'user_name': attempt.user.username,
            'user_email': attempt.user.email,
            'exam_title': attempt.exam.title,
            'status': attempt.status,
            'score': attempt.score,
            'total_marks': attempt.exam.total_marks,
            'start_time': attempt.start_time.isoformat() if attempt.start_time else None,
            'end_time': attempt.end_time.isoformat() if attempt.end_time else None,
            'camera_enabled': True,  # Add actual proctoring data here
            'microphone_enabled': True,
            'face_detected': True,
        }
        
        return Response(attempt_data)
    except Exception as e:
        print(f"Error in attempt_details: {e}")
        return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def live_attempts(request, exam_id):
    """Get live attempts for a specific exam"""
    try:
        if not is_admin_user(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        exam = get_object_or_404(Exam, id=exam_id)
        attempts = ExamAttempt.objects.filter(
            exam=exam,
            status__in=['STARTED', 'IN_PROGRESS']
        ).select_related('user')
        
        attempts_data = []
        for attempt in attempts:
            attempts_data.append({
                'id': attempt.id,
                'user_name': attempt.user.username,
                'status': attempt.status,
                'start_time': attempt.start_time.isoformat() if attempt.start_time else None,
                'answered_questions': attempt.answers.count(),
                'total_questions': attempt.total_questions,
                'violations_count': 0,  # Add actual violation count
                'camera_status': True,
                'face_detected': True,
                'audio_status': True,
            })
        
        return Response(attempts_data)
    except Exception as e:
        print(f"Error in live_attempts: {e}")
        return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# backend/exam_app/admin_views.py (update create method)
def create(self, request, *args, **kwargs):
    try:
        print(f"Creating exam with data: {request.data}")
        
        # Validate that subject exists
        subject_id = request.data.get('subject')
        if not subject_id:
            return Response(
                {'error': 'Subject is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            subject = Subject.objects.get(id=subject_id)
            print(f"Found subject: {subject.name}")
        except Subject.DoesNotExist:
            return Response(
                {'error': 'Invalid subject selected'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Handle datetime conversion
        exam_data = request.data.copy()
        
        # Parse datetime strings properly
        if 'start_time' in exam_data:
            try:
                from dateutil import parser
                start_time = parser.parse(exam_data['start_time'])
                exam_data['start_time'] = start_time
                print(f"Parsed start time: {start_time}")
            except Exception as e:
                print(f"Error parsing start_time: {e}")
        
        if 'end_time' in exam_data:
            try:
                from dateutil import parser
                end_time = parser.parse(exam_data['end_time'])
                exam_data['end_time'] = end_time
                print(f"Parsed end time: {end_time}")
            except Exception as e:
                print(f"Error parsing end_time: {e}")
        
        serializer = self.get_serializer(data=exam_data)
        if serializer.is_valid():
            exam = serializer.save(created_by=request.user)
            print(f"Created exam: {exam.title} (ID: {exam.id})")
            print(f"Exam details: Active={exam.is_active}, Start={exam.start_time}, End={exam.end_time}")
            
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        else:
            print(f"Serializer errors: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
    except Exception as e:
        print(f"Error creating exam: {e}")
        import traceback
        traceback.print_exc()
        return Response(
            {'error': f'Internal server error: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
