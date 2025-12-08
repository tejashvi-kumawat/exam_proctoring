# backend/exam_app/admin_views.py (update imports)
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db import transaction
from django.db.models import Sum, Avg, Q, Exists, OuterRef
import traceback
from .models import Subject, Exam, Question, Option, ExamAttempt, ExamActivityLog, AnswerImage, Answer, AnswerAttachment, SolutionAttachment
from .serializers import ExamSerializer, QuestionSerializer, ExamAttemptSerializer, SubjectSerializer  # Import from serializers
from .question_import import import_questions_from_json, import_questions_from_csv, import_questions_from_docx, QuestionImportError

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
        serializer = QuestionSerializer(questions, many=True, context={'request': request})
        
        # Calculate total marks from questions
        total_question_marks = sum(q.marks for q in questions)
        
        return Response({
            'questions': serializer.data,
            'total_question_marks': total_question_marks,
            'exam_total_marks': exam.total_marks,
            'marks_match': total_question_marks == exam.total_marks,
            'marks_difference': exam.total_marks - total_question_marks
        })
    except Exception as e:
        print(f"Error in exam_questions: {e}")
        print(traceback.format_exc())
        return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reorder_questions(request, exam_id):
    """Reorder questions for a specific exam"""
    try:
        if not is_admin_user(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        exam = get_object_or_404(Exam, id=exam_id)
        questions_order = request.data.get('questions', [])
        
        if not questions_order:
            return Response({'error': 'Questions order data is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Update order for each question
        for item in questions_order:
            question_id = item.get('id')
            new_order = item.get('order')
            
            if question_id is not None and new_order is not None:
                Question.objects.filter(id=question_id, exam=exam).update(order=new_order)
        
        return Response({'message': 'Questions reordered successfully'}, status=status.HTTP_200_OK)
    except Exception as e:
        print(f"Error in reorder_questions: {e}")
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
        
        # Handle multipart/form-data for image uploads
        question_image = None
        if 'question_image' in request.FILES:
            question_image = request.FILES['question_image']
        
        # Create question data
        question_data = {
            'exam': exam.id,
            'question_text': request.data.get('question_text'),
            'question_type': request.data.get('question_type', 'MCQ'),
            'marks': request.data.get('marks', 1),
            'order': request.data.get('order', 0)
        }
        if question_image:
            question_data['question_image'] = question_image
        
        serializer = QuestionSerializer(data=question_data)
        if serializer.is_valid():
            question = serializer.save()
            print(f"Created question: {question.id}")
            
            # Create options if provided
            options_data = request.data.get('options', [])
            
            # Try JSON string format first (new approach)
            if not options_data and 'options_json' in request.data:
                import json
                try:
                    options_data = json.loads(request.data.get('options_json'))
                    print(f"Parsed options from JSON string: {len(options_data)} options")
                except json.JSONDecodeError as e:
                    print(f"Error parsing options_json: {e}")
                    options_data = []
            
            for i, option_data in enumerate(options_data):
                option_text = option_data.get('option_text', '').strip() if isinstance(option_data, dict) else str(option_data).strip()
                is_correct = option_data.get('is_correct', False) if isinstance(option_data, dict) else False
                
                # Handle option image - check indexed key first (option_image_0, option_image_1)
                option_image = None
                image_key = f'option_image_{i}'
                if image_key in request.FILES:
                    option_image = request.FILES[image_key]
                    print(f"  - New image for option {i}")
                elif 'option_images' in request.FILES:
                    # Fallback to old list format
                    option_images = request.FILES.getlist('option_images')
                    if i < len(option_images):
                        option_image = option_images[i]
                
                if option_text or option_image:
                    Option.objects.create(
                        question=question,
                        option_text=option_text,
                        option_image=option_image,
                        is_correct=bool(is_correct),
                        order=i
                    )
                    print(f"Created option {i}: '{option_text[:30]}...'  (correct={is_correct})")
            
            # Update exam total marks if auto_calculate_total is enabled
            exam.refresh_from_db()
            if exam.auto_calculate_total:
                calculated_total = exam.calculate_total_marks()
                if calculated_total > 0:
                    exam.total_marks = calculated_total
                    exam.save()
            
            # Return question with options and updated exam info
            question_with_options = QuestionSerializer(question, context={'request': request}).data
            response_data = question_with_options
            response_data['exam_total_marks'] = exam.total_marks
            response_data['calculated_total_marks'] = exam.calculate_total_marks()
            
            return Response(response_data, status=status.HTTP_201_CREATED)
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
            # Handle question image update if provided
            if 'question_image' in request.FILES:
                question.question_image = request.FILES['question_image']
                question.save()
            
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
                
                # Store existing option images before deletion (to preserve them)
                existing_option_images = {}
                for idx, opt in enumerate(question.options.all().order_by('order')):
                    if opt.option_image:
                        existing_option_images[idx] = opt.option_image
                
                # Update options
                question.options.all().delete()  # Remove existing options
                
                # Parse options - try multiple formats
                options_data = request.data.get('options', [])
                
                # Try JSON string format (new cleaner approach)
                if not options_data and 'options_json' in request.data:
                    import json
                    try:
                        options_data = json.loads(request.data.get('options_json'))
                        print(f"Parsed options from JSON string: {len(options_data)} options")
                    except json.JSONDecodeError as e:
                        print(f"Error parsing options_json: {e}")
                        options_data = []
                
                # Fallback: Parse FormData format: options[0][option_text], etc.
                if not options_data:
                    parsed_options = {}
                    for key in request.data.keys():
                        if key.startswith('options['):
                            # Extract index and field name from 'options[0][option_text]'
                            import re
                            match = re.match(r'options\[(\d+)\]\[(\w+)\]', key)
                            if match:
                                index = int(match.group(1))
                                field = match.group(2)
                                if index not in parsed_options:
                                    parsed_options[index] = {}
                                parsed_options[index][field] = request.data.get(key)
                    
                    # Convert dict to list
                    if parsed_options:
                        options_data = [parsed_options[i] for i in sorted(parsed_options.keys())]
                        print(f"Parsed options from FormData keys: {len(options_data)} options")
                
                print(f"DEBUG: Total {len(options_data)} options parsed for question {question.id}")
                for i, opt in enumerate(options_data):
                    print(f"  Option {i}: text='{opt.get('option_text')}', is_correct={opt.get('is_correct')}")
                
                # Create options from parsed data
                created_count = 0
                for i, option_data in enumerate(options_data):
                    option_text = option_data.get('option_text', '').strip()
                    
                    # Parse is_correct - handle both boolean and string formats
                    is_correct = option_data.get('is_correct', False)
                    if isinstance(is_correct, str):
                        is_correct = is_correct.lower() in ['true', '1', 'yes']
                    
                    # Determine option image
                    option_image = None
                    
                    # Check for new image upload (indexed: option_image_0, option_image_1)
                    image_key = f'option_image_{i}'
                    if image_key in request.FILES:
                        option_image = request.FILES[image_key]
                    # Check if existing image should be preserved
                    elif option_data.get('has_existing_image') and i in existing_option_images:
                        option_image = existing_option_images[i]
                    
                    # ALWAYS create option if it has text (even if empty after strip)
                    # This ensures MCQ options are never lost
                    if option_text or option_image:
                        Option.objects.create(
                            question=question,
                            option_text=option_text,
                            option_image=option_image,
                            is_correct=bool(is_correct),
                            order=i
                        )
                        created_count += 1
                        print(f"  ✓ Created option {i}: '{option_text[:40]}' (correct={is_correct}, has_image={option_image is not None})")
                
                print(f"  ✓ Total {created_count} options created for question {question.id}")
                
                # Update exam total marks if auto_calculate_total is enabled
                exam.refresh_from_db()
                if exam.auto_calculate_total:
                    calculated_total = exam.calculate_total_marks()
                    if calculated_total > 0:
                        exam.total_marks = calculated_total
                        exam.save()
                
                question_with_options = QuestionSerializer(question, context={'request': request}).data
                response_data = question_with_options
                response_data['exam_total_marks'] = exam.total_marks
                response_data['calculated_total_marks'] = exam.calculate_total_marks()
                
                return Response(response_data)
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
            # Preserve the original order if not explicitly provided
            original_order = question.order
            data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
            
            # If order is not in the request, use the original order
            if 'order' not in data:
                data['order'] = original_order
            
            serializer = QuestionSerializer(question, data=data, partial=True)
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

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def attempt_details(request, attempt_id):
    """Get details for a specific attempt with enhanced monitoring data"""
    try:
        if not is_admin_user(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        attempt = get_object_or_404(ExamAttempt, id=attempt_id)
        
        # Get proctoring session data
        camera_enabled = False
        microphone_enabled = False
        face_detected = False
        violations_count = 0
        
        try:
            from proctoring.models import ProctoringSession, ViolationLog, FaceDetectionLog
            session = ProctoringSession.objects.filter(attempt=attempt).first()
            if session:
                camera_enabled = session.camera_enabled
                microphone_enabled = session.microphone_enabled
                violations_count = ViolationLog.objects.filter(session=session).count()
                # Get latest face detection
                latest_face = FaceDetectionLog.objects.filter(session=session).order_by('-timestamp').first()
                if latest_face:
                    face_detected = latest_face.faces_detected > 0
        except Exception:
            pass
        
        # Get activity logs
        activity_logs = ExamActivityLog.objects.filter(attempt=attempt).order_by('-timestamp')[:50]
        activities = [{
            'activity_type': log.activity_type,
            'description': log.description,
            'timestamp': log.timestamp.isoformat(),
            'metadata': log.metadata
        } for log in activity_logs]
        
        # Get all questions from the exam
        all_questions = Question.objects.filter(exam=attempt.exam).prefetch_related('options').order_by('order')
        
        # Get all answers for this attempt
        answers_dict = {}
        answers = Answer.objects.filter(attempt=attempt).select_related(
            'question', 'selected_option'
        ).prefetch_related('question__options', 'answer_images')
        
        for answer in answers:
            answers_dict[answer.question.id] = answer
        
        answer_data = []
        
        # Include all questions, even if not answered
        for question in all_questions:
            answer = answers_dict.get(question.id)
            if answer:
                # Get answer images
                answer_images = []
                for img in answer.answer_images.all().order_by('order'):
                    answer_images.append({
                        'id': img.id,
                        'image_url': request.build_absolute_uri(img.image.url) if img.image else None,
                        'order': img.order
                    })
                
                # Get answer attachments
                answer_attachments = []
                for attachment in answer.attachments.all().order_by('uploaded_at'):
                    answer_attachments.append({
                        'id': attachment.id,
                        'file_name': attachment.file_name,
                        'file_type': attachment.file_type,
                        'file_url': request.build_absolute_uri(attachment.file.url) if attachment.file else None,
                        'file_size': attachment.file_size,
                        'uploaded_at': attachment.uploaded_at.isoformat() if attachment.uploaded_at else None
                    })
                
                # Check if answer needs manual marking
                needs_manual_marking = question.question_type in ['SA', 'TEXT', 'IMAGE_UPLOAD']
                is_manually_marked = needs_manual_marking and answer.marks_awarded is not None
                
                answer_info = {
                    'id': answer.id,
                    'question': {
                        'id': question.id,
                        'question_text': question.question_text,
                        'question_type': question.question_type,
                        'question_image_url': request.build_absolute_uri(question.question_image.url) if question.question_image else None,
                        'marks': question.marks,
                        'options': [
                            {
                                'id': opt.id,
                                'option_text': opt.option_text,
                                'option_image_url': request.build_absolute_uri(opt.option_image.url) if opt.option_image else None,
                                'is_correct': opt.is_correct,
                                'order': opt.order
                            } for opt in question.options.all()
                        ]
                    },
                    'selected_option': {
                        'id': answer.selected_option.id,
                        'option_text': answer.selected_option.option_text,
                        'option_image_url': request.build_absolute_uri(answer.selected_option.option_image.url) if answer.selected_option.option_image else None,
                        'is_correct': answer.selected_option.is_correct
                    } if answer.selected_option else None,
                    'answer_text': answer.answer_text,
                    'answer_images': answer_images,
                    'attachments': answer_attachments,
                    'is_correct': answer.is_correct,
                    'marks_awarded': answer.marks_awarded,
                    'needs_manual_marking': needs_manual_marking,
                    'is_manually_marked': is_manually_marked,
                    'solution_text': answer.solution_text,
                    'solution_attachments': [
                        {
                            'id': sa.id,
                            'file_name': sa.file_name,
                            'file_type': sa.file_type,
                            'file_url': request.build_absolute_uri(sa.file.url) if sa.file else None,
                            'uploaded_at': sa.uploaded_at.isoformat() if sa.uploaded_at else None,
                            'uploaded_by': sa.uploaded_by.username if sa.uploaded_by else None
                        } for sa in answer.solution_attachments.all()
                    ],
                    'answered_at': answer.answered_at.isoformat() if answer.answered_at else None
                }
            else:
                # Question was not answered - create placeholder entry
                needs_manual_marking = question.question_type in ['SA', 'TEXT', 'IMAGE_UPLOAD']
                
                answer_info = {
                    'id': None,  # No answer ID for unanswered questions
                    'question': {
                        'id': question.id,
                        'question_text': question.question_text,
                        'question_type': question.question_type,
                        'question_image_url': request.build_absolute_uri(question.question_image.url) if question.question_image else None,
                        'marks': question.marks,
                        'options': [
                            {
                                'id': opt.id,
                                'option_text': opt.option_text,
                                'option_image_url': request.build_absolute_uri(opt.option_image.url) if opt.option_image else None,
                                'is_correct': opt.is_correct,
                                'order': opt.order
                            } for opt in question.options.all()
                        ]
                    },
                    'selected_option': None,
                    'answer_text': '',
                    'answer_images': [],
                    'attachments': [],
                    'is_correct': False,
                    'marks_awarded': 0,
                    'needs_manual_marking': needs_manual_marking,
                    'is_manually_marked': False,
                    'solution_text': None,
                    'solution_attachments': [],
                    'answered_at': None
                }
            
            answer_data.append(answer_info)
        
        attempt_data = {
            'id': attempt.id,
            'user_name': attempt.user.username,
            'user_email': attempt.user.email,
            'exam_title': attempt.exam.title,
            'status': attempt.status,
            'score': attempt.score,
            'percentage_score': attempt.percentage_score,
            'total_marks': attempt.exam.total_marks,
            'correct_answers': attempt.correct_answers,
            'wrong_answers': attempt.wrong_answers,
            'unanswered_questions': attempt.unanswered_questions,
            'is_passed': attempt.is_passed,
            'start_time': attempt.start_time.isoformat() if attempt.start_time else None,
            'end_time': attempt.end_time.isoformat() if attempt.end_time else None,
            'evaluated_at': attempt.evaluated_at.isoformat() if attempt.evaluated_at else None,
            'camera_enabled': camera_enabled,
            'microphone_enabled': microphone_enabled,
            'face_detected': face_detected,
            'violations_count': violations_count,
            'activity_logs': activities,
            'total_activities': ExamActivityLog.objects.filter(attempt=attempt).count(),
            'answers': answer_data
        }
        
        return Response(attempt_data)
    except Exception as e:
        print(f"Error in attempt_details: {e}")
        traceback.print_exc()
        return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def live_attempts(request, exam_id):
    """Get live attempts for a specific exam with real-time monitoring data"""
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
            # Get proctoring data
            violations_count = 0
            camera_status = False
            face_detected = False
            audio_status = False
            last_activity = None
            
            try:
                from proctoring.models import ProctoringSession, ViolationLog, FaceDetectionLog, AudioMonitoringLog
                session = ProctoringSession.objects.filter(attempt=attempt).first()
                if session:
                    camera_status = session.camera_enabled
                    audio_status = session.microphone_enabled
                    violations_count = ViolationLog.objects.filter(session=session).count()
                    latest_face = FaceDetectionLog.objects.filter(session=session).order_by('-timestamp').first()
                    if latest_face:
                        face_detected = latest_face.faces_detected > 0
            except Exception:
                pass
            
            # Get latest activity
            latest_activity = ExamActivityLog.objects.filter(attempt=attempt).order_by('-timestamp').first()
            if latest_activity:
                last_activity = {
                    'type': latest_activity.activity_type,
                    'timestamp': latest_activity.timestamp.isoformat(),
                    'description': latest_activity.description
                }
            
            # Calculate time elapsed
            from django.utils import timezone
            time_elapsed = None
            if attempt.start_time:
                elapsed = timezone.now() - attempt.start_time
                time_elapsed = int(elapsed.total_seconds())
            
            attempts_data.append({
                'id': attempt.id,
                'user_name': attempt.user.username,
                'user_email': attempt.user.email,
                'status': attempt.status,
                'start_time': attempt.start_time.isoformat() if attempt.start_time else None,
                'time_elapsed_seconds': time_elapsed,
                'answered_questions': attempt.answers.count(),
                'total_questions': attempt.total_questions,
                'progress_percentage': round((attempt.answers.count() / attempt.total_questions * 100) if attempt.total_questions > 0 else 0, 2),
                'violations_count': violations_count,
                'camera_status': camera_status,
                'face_detected': face_detected,
                'audio_status': audio_status,
                'last_activity': last_activity,
            })
        
        return Response(attempts_data)
    except Exception as e:
        print(f"Error in live_attempts: {e}")
        traceback.print_exc()
        return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def exam_all_attempts(request, exam_id):
    """Get all attempts (completed + live) for a specific exam"""
    try:
        if not is_admin_user(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        exam = get_object_or_404(Exam, id=exam_id)
        attempts = ExamAttempt.objects.filter(exam=exam).select_related('user').order_by('-start_time')
        
        attempts_data = []
        for attempt in attempts:
            # Get proctoring data
            violations_count = 0
            camera_status = False
            face_detected = False
            audio_status = False
            
            try:
                from proctoring.models import ProctoringSession, ViolationLog, FaceDetectionLog
                session = ProctoringSession.objects.filter(attempt=attempt).first()
                if session:
                    camera_status = session.camera_enabled
                    audio_status = session.microphone_enabled
                    violations_count = ViolationLog.objects.filter(session=session).count()
                    latest_face = FaceDetectionLog.objects.filter(session=session).order_by('-timestamp').first()
                    if latest_face:
                        face_detected = latest_face.faces_detected > 0
            except Exception:
                pass
            
            attempts_data.append({
                'id': attempt.id,
                'user_name': attempt.user.username,
                'user_email': attempt.user.email,
                'status': attempt.status,
                'score': attempt.score,
                'total_marks': attempt.exam.total_marks,
                'percentage_score': attempt.percentage_score,
                'is_passed': attempt.is_passed,
                'start_time': attempt.start_time.isoformat() if attempt.start_time else None,
                'end_time': attempt.end_time.isoformat() if attempt.end_time else None,
                'evaluated_at': attempt.evaluated_at.isoformat() if attempt.evaluated_at else None,
                'answered_questions': attempt.answers.count(),
                'total_questions': attempt.total_questions,
                'violations_count': violations_count,
                'camera_status': camera_status,
                'face_detected': face_detected,
                'audio_status': audio_status,
            })
        
        return Response(attempts_data)
    except Exception as e:
        print(f"Error in exam_all_attempts: {e}")
        traceback.print_exc()
        return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def import_questions(request, exam_id):
    """Import questions from JSON or CSV file"""
    try:
        if not is_admin_user(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        exam = get_object_or_404(Exam, id=exam_id)
        
        # Check if file is uploaded
        if 'file' not in request.FILES and 'json_data' not in request.data:
            return Response({
                'error': 'Either file upload or json_data is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        overwrite = request.data.get('overwrite', False)
        
        try:
            if 'file' in request.FILES:
                # Handle file upload
                uploaded_file = request.FILES['file']
                file_name = uploaded_file.name.lower()
                file_content = uploaded_file.read()
                
                # Check file extension
                if file_name.endswith('.csv'):
                    # CSV file
                    result = import_questions_from_csv(exam_id, file_content, overwrite)
                elif file_name.endswith('.json'):
                    # JSON file
                    import json
                    json_data = json.loads(file_content.decode('utf-8'))
                    result = import_questions_from_json(exam_id, json_data, overwrite)
                elif file_name.endswith(('.docx', '.doc')):
                    # DOCX file
                    try:
                        result = import_questions_from_docx(exam_id, file_content, overwrite)
                    except QuestionImportError as docx_error:
                        print(f"DOCX import error: {docx_error}")
                        return Response({
                            'error': str(docx_error)
                        }, status=status.HTTP_400_BAD_REQUEST)
                else:
                    # Try to detect format by content
                    try:
                        # Try JSON first
                        import json
                        json_data = json.loads(file_content.decode('utf-8'))
                        result = import_questions_from_json(exam_id, json_data, overwrite)
                    except:
                        try:
                            # Try CSV
                            result = import_questions_from_csv(exam_id, file_content, overwrite)
                        except:
                            # Try DOCX
                            try:
                                result = import_questions_from_docx(exam_id, file_content, overwrite)
                            except QuestionImportError as docx_error:
                                print(f"DOCX import error: {docx_error}")
                                return Response({
                                    'error': str(docx_error)
                                }, status=status.HTTP_400_BAD_REQUEST)
            else:
                # Handle JSON data directly
                json_data = request.data.get('json_data')
                if isinstance(json_data, str):
                    import json
                    json_data = json.loads(json_data)
                result = import_questions_from_json(exam_id, json_data, overwrite)
            
            return Response({
                'message': f'Successfully imported {result["imported"]} out of {result["total"]} questions',
                'imported': result['imported'],
                'total': result['total'],
                'errors': result['errors']
            }, status=status.HTTP_200_OK)
            
        except QuestionImportError as e:
            return Response({
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print(f"Error importing questions: {e}")
            traceback.print_exc()
            return Response({
                'error': f'Error importing questions: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
    except Exception as e:
        print(f"Error in import_questions: {e}")
        traceback.print_exc()
        return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def attempt_activities(request, attempt_id):
    """Get all activities for a specific attempt"""
    try:
        if not is_admin_user(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        attempt = get_object_or_404(ExamAttempt, id=attempt_id)
        
        activities = ExamActivityLog.objects.filter(attempt=attempt).order_by('-timestamp')
        
        activities_data = [{
            'id': log.id,
            'activity_type': log.activity_type,
            'description': log.description,
            'metadata': log.metadata,
            'timestamp': log.timestamp.isoformat(),
            'ip_address': str(log.ip_address) if log.ip_address else None
        } for log in activities]
        
        return Response({
            'attempt_id': attempt_id,
            'user_name': attempt.user.username,
            'exam_title': attempt.exam.title,
            'total_activities': len(activities_data),
            'activities': activities_data
        })
    except Exception as e:
        print(f"Error in attempt_activities: {e}")
        traceback.print_exc()
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




def get_client_ip(request):
    """Get client IP address from request"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_all_data(request):
    """Admin endpoint to delete all exam data (for space management)"""
    try:
        if not is_admin_user(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        # Get confirmation from request
        confirm = request.data.get('confirm', False)
        if not confirm:
            return Response(
                {'error': 'Confirmation required. Set confirm=true in request body'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from django.db import transaction
        import os
        from django.conf import settings
        
        deleted_counts = {}
        
        with transaction.atomic():
            # Delete AnswerImages and their files
            answer_images = AnswerImage.objects.all()
            image_count = answer_images.count()
            for img in answer_images:
                if img.image:
                    file_path = os.path.join(settings.MEDIA_ROOT, img.image.name)
                    if os.path.exists(file_path):
                        try:
                            os.remove(file_path)
                        except Exception as e:
                            print(f"Error deleting image file {file_path}: {e}")
            answer_images.delete()
            deleted_counts['answer_images'] = image_count
            
            # Delete Answers
            answers_count = Answer.objects.count()
            Answer.objects.all().delete()
            deleted_counts['answers'] = answers_count
            
            # Delete ExamActivityLogs
            logs_count = ExamActivityLog.objects.count()
            ExamActivityLog.objects.all().delete()
            deleted_counts['activity_logs'] = logs_count
            
            # Delete ExamAttempts
            attempts_count = ExamAttempt.objects.count()
            ExamAttempt.objects.all().delete()
            deleted_counts['exam_attempts'] = attempts_count
            
            # Delete Questions and their images
            questions = Question.objects.all()
            question_count = questions.count()
            for q in questions:
                if q.question_image:
                    file_path = os.path.join(settings.MEDIA_ROOT, q.question_image.name)
                    if os.path.exists(file_path):
                        try:
                            os.remove(file_path)
                        except Exception as e:
                            print(f"Error deleting question image {file_path}: {e}")
            questions.delete()
            deleted_counts['questions'] = question_count
            
            # Delete Options and their images
            options = Option.objects.all()
            option_count = options.count()
            for opt in options:
                if opt.option_image:
                    file_path = os.path.join(settings.MEDIA_ROOT, opt.option_image.name)
                    if os.path.exists(file_path):
                        try:
                            os.remove(file_path)
                        except Exception as e:
                            print(f"Error deleting option image {file_path}: {e}")
            options.delete()
            deleted_counts['options'] = option_count
            
            # Delete Exams (but keep Subjects)
            exams_count = Exam.objects.count()
            Exam.objects.all().delete()
            deleted_counts['exams'] = exams_count
        
        return Response({
            'message': 'All exam data deleted successfully',
            'deleted_counts': deleted_counts,
            'subjects_preserved': Subject.objects.count()
        })
        
    except Exception as e:
        print(f"Error deleting data: {e}")
        import traceback
        traceback.print_exc()
        return Response(
            {'error': f'Internal server error: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


def get_client_ip(request):
    """Get client IP address from request"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR', '0.0.0.0')
    return ip


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_all_exam_questions(request, exam_id):
    """Delete all questions of a specific exam"""
    try:
        if not is_admin_user(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        exam = get_object_or_404(Exam, id=exam_id)
        
        # Get all questions for this exam
        questions = Question.objects.filter(exam=exam)
        question_count = questions.count()
        
        # Delete question images and option images
        import os
        from django.conf import settings
        
        for question in questions:
            # Delete question image
            if question.question_image:
                file_path = os.path.join(settings.MEDIA_ROOT, question.question_image.name)
                if os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                    except Exception as e:
                        print(f"Error deleting question image {file_path}: {e}")
            
            # Delete option images
            for option in question.options.all():
                if option.option_image:
                    file_path = os.path.join(settings.MEDIA_ROOT, option.option_image.name)
                    if os.path.exists(file_path):
                        try:
                            os.remove(file_path)
                        except Exception as e:
                            print(f"Error deleting option image {file_path}: {e}")
        
        # Delete questions (CASCADE will delete options)
        questions.delete()
        
        # Reset exam total marks if auto-calculate
        if exam.auto_calculate_total:
            exam.total_marks = 0
            exam.save()
        
        return Response({
            'message': f'Successfully deleted {question_count} questions from exam "{exam.title}"',
            'deleted_count': question_count,
            'exam_title': exam.title
        })
        
    except Exception as e:
        print(f"Error deleting exam questions: {e}")
        import traceback
        traceback.print_exc()
        return Response(
            {'error': f'Internal server error: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_attempt_solutions(request, attempt_id):
    """Delete all solution files (images/attachments) for a specific attempt"""
    try:
        if not is_admin_user(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        attempt = get_object_or_404(ExamAttempt, id=attempt_id)
        
        # Get all answers for this attempt
        from exam_app.models import Answer, AnswerImage, AnswerAttachment
        import os
        
        answers = Answer.objects.filter(attempt=attempt)
        
        deleted_counts = {
            'images': 0,
            'attachments': 0
        }
        
        # Delete image files and records
        for answer in answers:
            # Delete answer images
            for img in answer.answer_images.all():
                if img.image and os.path.isfile(img.image.path):
                    try:
                        os.remove(img.image.path)
                        deleted_counts['images'] += 1
                    except Exception as e:
                        print(f"Error deleting image {img.image.path}: {e}")
            
            # Delete answer attachments
            for attachment in answer.attachments.all():
                if attachment.file and os.path.isfile(attachment.file.path):
                    try:
                        os.remove(attachment.file.path)
                        deleted_counts['attachments'] += 1
                    except Exception as e:
                        print(f"Error deleting attachment {attachment.file.path}: {e}")
            
            # Delete database records
            answer.answer_images.all().delete()
            answer.attachments.all().delete()
        
        return Response({
            'message': f'Successfully deleted solution files for attempt #{attempt_id}',
            'deleted_counts': deleted_counts,
            'student': attempt.user.username,
            'exam': attempt.exam.title
        })
        
    except Exception as e:
        print(f"Error deleting attempt solutions: {e}")
        import traceback
        traceback.print_exc()
        return Response(
            {'error': f'Internal server error: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST', 'PUT'])
@permission_classes([IsAuthenticated])
def mark_answer(request, answer_id):
    """Admin endpoint to manually mark/update marks for any answer type"""
    try:
        if not is_admin_user(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        answer = get_object_or_404(Answer, id=answer_id)
        
        marks_awarded = request.data.get('marks_awarded')
        is_correct = request.data.get('is_correct', None)
        comment = request.data.get('comment', '')
        solution_text = request.data.get('solution_text', None)
        
        # Allow editing marks for all question types
        # For MCQ/TF, admin can override auto-calculated marks
        # For SA/TEXT/IMAGE_UPLOAD, admin can set initial marks
        
        if marks_awarded is None:
            return Response({
                'error': 'marks_awarded is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate marks
        marks_awarded = float(marks_awarded)
        max_marks = float(answer.question.marks)
        
        if marks_awarded < 0 or marks_awarded > max_marks:
            return Response({
                'error': f'Marks must be between 0 and {max_marks}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Update answer
        with transaction.atomic():
            # Set marks_awarded directly
            answer.marks_awarded = marks_awarded
            # Save solution text if provided
            if solution_text is not None:
                answer.solution_text = solution_text
            
            # Set is_correct
            if is_correct is not None:
                answer.is_correct = bool(is_correct)
                answer._is_correct_manually_set = True  # Flag to prevent auto-override
            elif answer.question.question_type in ['SA', 'TEXT', 'IMAGE_UPLOAD']:
                # Auto-determine is_correct based on marks for manual marking types
                answer.is_correct = marks_awarded > 0
                answer._is_correct_manually_set = True  # Flag to prevent auto-override
            
            # Note: Answer model doesn't have metadata field, so we skip storing comment there
            # Save with update_fields to ensure marks_awarded is preserved
            # Include solution_text if present
            update_fields = ['marks_awarded', 'is_correct', 'updated_at']
            if solution_text is not None:
                update_fields.append('solution_text')
            answer.save(update_fields=update_fields)
            
            # Recalculate attempt score
            attempt = answer.attempt
            total_marks = Answer.objects.filter(attempt=attempt).aggregate(
                total=Sum('marks_awarded')
            )['total'] or 0.0
            
            attempt.score = float(total_marks)
            
            # Recalculate percentage score
            if attempt.exam.total_marks > 0:
                attempt.percentage_score = (attempt.score / attempt.exam.total_marks) * 100
            else:
                attempt.percentage_score = 0.0
            
            # Recalculate correct/wrong answers count
            correct_count = Answer.objects.filter(attempt=attempt, is_correct=True).count()
            wrong_count = Answer.objects.filter(attempt=attempt, is_correct=False).exclude(marks_awarded__isnull=True).count()
            attempt.correct_answers = correct_count
            attempt.wrong_answers = wrong_count
            
            # Check if passed
            attempt.is_passed = attempt.percentage_score >= attempt.exam.passing_marks if attempt.exam.total_marks > 0 else False
            
            # Don't auto-set results_ready here
            # Admin will manually release results using release_results endpoint
            # Just save the attempt with updated marks
            attempt.save()
            
            # Log activity
            ExamActivityLog.objects.create(
                attempt=attempt,
                activity_type='ANSWER_MARKED',
                description=f'Admin marked answer for question {answer.question.order} with {marks_awarded} marks',
                metadata={
                    'question_id': answer.question.id,
                    'question_type': answer.question.question_type,
                    'marks_awarded': marks_awarded,
                    'is_correct': answer.is_correct,
                    'comment': comment
                },
                ip_address=get_client_ip(request)
            )

            # Note: solution attachments are managed via separate endpoints.
            created_attachments = []
        
        return Response({
            'message': 'Answer marked successfully',
            'answer': {
                'id': answer.id,
                'marks_awarded': answer.marks_awarded,
                'is_correct': answer.is_correct
            },
            'attempt_score': attempt.score,
            
            'attempt_percentage': attempt.percentage_score
        })
        
    except Exception as e:
        print(f"Error marking answer: {e}")
        import traceback
        traceback.print_exc()
        return Response(
            {'error': f'Internal server error: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bulk_mark_answers(request):
    """Bulk update marks for multiple answers"""
    try:
        if not is_admin_user(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        answers_data = request.data.get('answers', [])
        if not answers_data:
            return Response({'error': 'answers array is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        updated_answers = []
        failed_updates = []
        
        with transaction.atomic():
            for answer_data in answers_data:
                answer_id = answer_data.get('answer_id')
                marks_awarded = answer_data.get('marks_awarded')
                
                if not answer_id or marks_awarded is None:
                    failed_updates.append({'answer_id': answer_id, 'error': 'Missing required fields'})
                    continue
                
                try:
                    answer = Answer.objects.get(id=answer_id)
                    max_marks = float(answer.question.marks)
                    marks_awarded = float(marks_awarded)
                    
                    if marks_awarded < 0 or marks_awarded > max_marks:
                        failed_updates.append({
                            'answer_id': answer_id, 
                            'error': f'Marks must be between 0 and {max_marks}'
                        })
                        continue
                    
                    answer.marks_awarded = marks_awarded
                    if answer.question.question_type in ['SA', 'TEXT', 'IMAGE_UPLOAD']:
                        answer.is_correct = marks_awarded > 0
                        answer._is_correct_manually_set = True  # Flag to prevent auto-override
                    # Save with update_fields to ensure marks_awarded is preserved
                    answer.save(update_fields=['marks_awarded', 'is_correct', 'updated_at'])
                    
                    updated_answers.append({
                        'answer_id': answer.id,
                        'marks_awarded': answer.marks_awarded,
                        'is_correct': answer.is_correct
                    })
                    
                except Answer.DoesNotExist:
                    failed_updates.append({'answer_id': answer_id, 'error': 'Answer not found'})
                except Exception as e:
                    failed_updates.append({'answer_id': answer_id, 'error': str(e)})
            
            # Recalculate scores for all affected attempts
            attempt_ids = set()
            for answer_data in answers_data:
                try:
                    answer = Answer.objects.get(id=answer_data.get('answer_id'))
                    attempt_ids.add(answer.attempt.id)
                except:
                    pass
            
            for attempt_id in attempt_ids:
                attempt = ExamAttempt.objects.get(id=attempt_id)
                total_marks = Answer.objects.filter(attempt=attempt).aggregate(
                    total=Sum('marks_awarded')
                )['total'] or 0.0
                attempt.score = float(total_marks)
                
                # Recalculate percentage score
                if attempt.exam.total_marks > 0:
                    attempt.percentage_score = (attempt.score / attempt.exam.total_marks) * 100
                else:
                    attempt.percentage_score = 0.0
                
                # Recalculate correct/wrong answers count
                correct_count = Answer.objects.filter(attempt=attempt, is_correct=True).count()
                wrong_count = Answer.objects.filter(attempt=attempt, is_correct=False).exclude(marks_awarded__isnull=True).count()
                attempt.correct_answers = correct_count
                attempt.wrong_answers = wrong_count
                
                # Check if passed
                attempt.is_passed = attempt.percentage_score >= attempt.exam.passing_marks if attempt.exam.total_marks > 0 else False
                
                # Check if all manual marking questions are marked
                manual_marking_questions = Answer.objects.filter(
                    attempt=attempt,
                    question__question_type__in=['SA', 'TEXT', 'IMAGE_UPLOAD']
                )
                all_manual_marked = all(
                    ans.marks_awarded is not None 
                    for ans in manual_marking_questions
                )
                attempt.results_ready = all_manual_marked
                attempt.save()
        
        return Response({
            'message': f'Bulk update completed: {len(updated_answers)} updated, {len(failed_updates)} failed',
            'updated_answers': updated_answers,
            'failed_updates': failed_updates
        })
        
    except Exception as e:
        return Response(
            {'error': f'Internal server error: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )



@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def edit_solution_text(request, answer_id):
    """Edit only the solution text for an answer (admin).
    This keeps solution edits separate from marking operations.
    """
    try:
        if not is_admin_user(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        answer = get_object_or_404(Answer, id=answer_id)
        solution_text = request.data.get('solution_text', '')
        answer.solution_text = solution_text
        answer.save(update_fields=['solution_text', 'updated_at'])

        ExamActivityLog.objects.create(
            attempt=answer.attempt,
            activity_type='SOLUTION_UPDATED',
            description=f'Admin edited solution text for question {answer.question.order}',
            metadata={'answer_id': answer.id, 'edited_by': request.user.username},
            ip_address=get_client_ip(request)
        )

        return Response({
            'message': 'Solution text updated',
            'solution_text': answer.solution_text
        })
    except Exception as e:
        print(f"Error updating solution text: {e}")
        import traceback; traceback.print_exc()
        return Response({'error': f'Internal server error: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_solution_attachments(request, answer_id):
    """Add one or more solution attachments for an answer (admin).
    Expects multipart/form-data with files in the `files` field.
    """
    try:
        if not is_admin_user(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        answer = get_object_or_404(Answer, id=answer_id)
        created = []
        files = request.FILES.getlist('files') if hasattr(request, 'FILES') else []
        for f in files:
            sa = SolutionAttachment.objects.create(
                answer=answer,
                file=f,
                file_name=getattr(f, 'name', ''),
                file_type=(getattr(f, 'content_type', '') or '').split('/')[-1],
                uploaded_by=request.user
            )
            created.append({
                'id': sa.id,
                'file_name': sa.file_name,
                'file_type': sa.file_type,
                'file_url': request.build_absolute_uri(sa.file.url) if sa.file else None,
                'uploaded_at': sa.uploaded_at.isoformat() if sa.uploaded_at else None,
                'uploaded_by': sa.uploaded_by.username if sa.uploaded_by else None
            })

        ExamActivityLog.objects.create(
            attempt=answer.attempt,
            activity_type='SOLUTION_ATTACHMENT_ADDED',
            description=f'Admin added {len(created)} solution attachment(s) for question {answer.question.order}',
            metadata={'answer_id': answer.id, 'added_by': request.user.username, 'count': len(created)},
            ip_address=get_client_ip(request)
        )

        return Response({'created': created})
    except Exception as e:
        print(f"Error adding solution attachments: {e}")
        import traceback; traceback.print_exc()
        return Response({'error': f'Internal server error: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_solution_attachment(request, attachment_id):
    """Delete a solution attachment by id (admin)."""
    try:
        if not is_admin_user(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        sa = get_object_or_404(SolutionAttachment, id=attachment_id)
        answer = sa.answer
        sa.delete()

        ExamActivityLog.objects.create(
            attempt=answer.attempt,
            activity_type='SOLUTION_ATTACHMENT_DELETED',
            description=f'Admin deleted solution attachment {attachment_id} for question {answer.question.order}',
            metadata={'attachment_id': attachment_id, 'deleted_by': request.user.username},
            ip_address=get_client_ip(request)
        )

        return Response({'message': 'Attachment deleted'})
    except Exception as e:
        print(f"Error deleting solution attachment: {e}")
        import traceback; traceback.print_exc()
        return Response({'error': f'Internal server error: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def exam_analytics(request, exam_id):
    """Get comprehensive analytics for an exam"""
    try:
        if not is_admin_user(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        exam = get_object_or_404(Exam, id=exam_id)
        attempts = ExamAttempt.objects.filter(exam=exam, status='COMPLETED')
        
        # Basic stats
        total_attempts = attempts.count()
        total_students = attempts.values('user').distinct().count()
        
        # Score statistics
        scores = [a.score for a in attempts if a.score is not None]
        avg_score = sum(scores) / len(scores) if scores else 0
        max_score = max(scores) if scores else 0
        min_score = min(scores) if scores else 0
        
        # Question-wise statistics
        question_stats = []
        for question in exam.questions.all():
            question_answers = Answer.objects.filter(question=question, attempt__exam=exam)
            total_answered = question_answers.count()
            correct_count = question_answers.filter(is_correct=True).count()
            avg_marks = question_answers.aggregate(
                avg=Avg('marks_awarded')
            )['avg'] or 0
            
            question_stats.append({
                'question_id': question.id,
                'question_text': question.question_text[:50],
                'question_type': question.question_type,
                'total_answered': total_answered,
                'correct_count': correct_count,
                'accuracy': (correct_count / total_answered * 100) if total_answered > 0 else 0,
                'average_marks': float(avg_marks),
                'max_marks': float(question.marks)
            })
        
        # Time statistics
        durations = []
        for attempt in attempts:
            if attempt.start_time and attempt.end_time:
                duration = (attempt.end_time - attempt.start_time).total_seconds() / 60
                durations.append(duration)
        
        avg_duration = sum(durations) / len(durations) if durations else 0
        
        # Grade distribution
        grade_distribution = {
            'A': len([s for s in scores if s >= exam.total_marks * 0.9]),
            'B': len([s for s in scores if exam.total_marks * 0.8 <= s < exam.total_marks * 0.9]),
            'C': len([s for s in scores if exam.total_marks * 0.7 <= s < exam.total_marks * 0.8]),
            'D': len([s for s in scores if exam.total_marks * 0.6 <= s < exam.total_marks * 0.7]),
            'F': len([s for s in scores if s < exam.total_marks * 0.6])
        }
        
        return Response({
            'exam_id': exam.id,
            'exam_title': exam.title,
            'total_attempts': total_attempts,
            'total_students': total_students,
            'score_statistics': {
                'average': float(avg_score),
                'maximum': float(max_score),
                'minimum': float(min_score),
                'total_marks': float(exam.total_marks)
            },
            'question_statistics': question_stats,
            'time_statistics': {
                'average_duration_minutes': float(avg_duration),
                'exam_duration_minutes': exam.duration_minutes
            },
            'grade_distribution': grade_distribution
        })
        
    except Exception as e:
        return Response(
            {'error': f'Internal server error: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def manage_exam(request, exam_id):
    """Update or delete an exam"""
    try:
        if not is_admin_user(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        exam = get_object_or_404(Exam, id=exam_id)
        
        if request.method == 'PUT':
            # Update exam
            serializer = ExamSerializer(exam, data=request.data, partial=True)
            if serializer.is_valid():
                exam = serializer.save()
                
                # Update exam total marks if auto_calculate_total is enabled
                if exam.auto_calculate_total:
                    calculated_total = exam.calculate_total_marks()
                    if calculated_total > 0:
                        exam.total_marks = calculated_total
                        exam.save()
                
                return Response(ExamSerializer(exam).data)
            else:
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        elif request.method == 'DELETE':
            # Check if exam has attempts
            attempts_count = ExamAttempt.objects.filter(exam=exam).count()
            if attempts_count > 0:
                return Response({
                    'error': f'Cannot delete exam with {attempts_count} attempt(s). Delete attempts first.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            exam_title = exam.title
            exam.delete()
            return Response({
                'message': f'Exam "{exam_title}" deleted successfully'
            }, status=status.HTTP_200_OK)
            
    except Exception as e:
        print(f"Error managing exam: {e}")
        traceback.print_exc()
        return Response(
            {'error': f'Internal server error: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def recalculate_exam_scores(request, exam_id):
    """Recalculate all scores for an exam (useful after question/option changes)"""
    try:
        if not is_admin_user(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        exam = get_object_or_404(Exam, id=exam_id)
        attempts = ExamAttempt.objects.filter(exam=exam)
        
        updated_count = 0
        with transaction.atomic():
            for attempt in attempts:
                total_marks = Answer.objects.filter(attempt=attempt).aggregate(
                    total=Sum('marks_awarded')
                )['total'] or 0.0
                
                old_score = attempt.score
                attempt.score = float(total_marks)
                attempt.save()
                
                if old_score != attempt.score:
                    updated_count += 1
        
        return Response({
            'message': f'Recalculated scores for {updated_count} attempts',
            'total_attempts': attempts.count(),
            'updated_count': updated_count
        })
        
    except Exception as e:
        return Response(
            {'error': f'Internal server error: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def release_results(request, attempt_id):
    """Admin endpoint to release results for an exam attempt.
    This endpoint only toggles `results_ready` and does not accept or process
    solution text/files. Per-question solutions must be attached via the
    marking endpoint.
    """
    try:
        if not is_admin_user(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        attempt = get_object_or_404(ExamAttempt, id=attempt_id)
        
        # Set results_ready to True. Do NOT process any solution payloads here.
        attempt.results_ready = True
        attempt.save()
        # Log activity
        ExamActivityLog.objects.create(
            attempt=attempt,
            activity_type='RESULTS_RELEASED',
            description=f'Admin released results for exam attempt',
            metadata={
                'released_by': request.user.username,
                'released_at': timezone.now().isoformat(),
            }
        )
        
        return Response({
            'message': 'Results released successfully',
            'results_ready': True
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        print(f"Error releasing results: {e}")
        traceback.print_exc()
        return Response(
            {'error': f'Internal server error: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def restart_exam_attempt(request, attempt_id):
    """Admin endpoint to restart an exam attempt for a student"""
    try:
        if not is_admin_user(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        attempt = get_object_or_404(ExamAttempt, id=attempt_id)
        
        # Get the old attempt data before restarting
        old_user = attempt.user
        old_exam = attempt.exam
        old_attempt_id = attempt.id
        
        # Delete all answers and related data for this attempt
        from exam_app.models import Answer, AnswerImage, AnswerAttachment
        import os
        
        # Get all answers for this attempt
        answers = Answer.objects.filter(attempt=attempt)
        
        # Delete image files
        for answer in answers:
            # Delete answer images
            for img in answer.answer_images.all():
                if img.image and os.path.isfile(img.image.path):
                    try:
                        os.remove(img.image.path)
                    except Exception as e:
                        print(f"Error deleting image {img.image.path}: {e}")
            
            # Delete answer attachments
            for attachment in answer.attachments.all():
                if attachment.file and os.path.isfile(attachment.file.path):
                    try:
                        os.remove(attachment.file.path)
                    except Exception as e:
                        print(f"Error deleting attachment {attachment.file.path}: {e}")
        
        # Delete database records (CASCADE will delete related images/attachments)
        answers.delete()
        
        # Delete the attempt record
        attempt.delete()
        
        # Create a new attempt for the same user and exam
        new_attempt = ExamAttempt.objects.create(
            user=old_user,
            exam=old_exam,
            status='STARTED',
            total_questions=old_exam.questions.count()
        )
        
        # Log activity in admin
        ExamActivityLog.objects.create(
            attempt=new_attempt,
            activity_type='EXAM_RESTARTED',
            description=f'Admin restarted exam for student {old_user.username}',
            metadata={
                'restarted_by': request.user.username,
                'restarted_at': timezone.now().isoformat(),
                'old_attempt_id': old_attempt_id
            }
        )
        
        return Response({
            'message': 'Exam restarted successfully',
            'new_attempt_id': new_attempt.id,
            'student': old_user.username,
            'exam': old_exam.title
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        print(f"Error restarting exam: {e}")
        traceback.print_exc()
        return Response(
            {'error': f'Internal server error: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
