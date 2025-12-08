# backend/exam_app/views.py
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import transaction
from .models import Exam, ExamAttempt, Question, Option, Answer, AnswerImage, ExamActivityLog
from .admin_views import is_admin_user
from .serializers import (
    ExamSerializer, ShuffledExamSerializer, ExamAttemptSerializer,
    SubmitAnswerSerializer, AnswerSerializer
)
import logging

logger = logging.getLogger(__name__)

# backend/exam_app/views.py (update ExamListView)
class ExamListView(generics.ListAPIView):
    serializer_class = ExamSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        try:
            now = timezone.now()
            
            # More lenient filtering - show exams that are active and not ended
            exams = Exam.objects.filter(
                is_active=True,
                end_time__gte=now  # Only check that exam hasn't ended
            ).select_related('subject').prefetch_related('questions__options')
            
            print(f"Current time: {now}")
            print(f"Total exams in DB: {Exam.objects.count()}")
            print(f"Active exams (not ended): {exams.count()}")
            
            for exam in exams:
                print(f"Exam: {exam.title}")
                print(f"  - Created by: {exam.created_by}")
                print(f"  - Start: {exam.start_time}")
                print(f"  - End: {exam.end_time}")
                print(f"  - Is Active: {exam.is_active}")
                print(f"  - Questions: {exam.questions.count()}")
                print(f"  - Available: {exam.start_time <= now <= exam.end_time}")
            
            return exams
        except Exception as e:
            print(f"Error in ExamListView: {e}")
            import traceback
            traceback.print_exc()
            return Exam.objects.none()
    
    def list(self, request, *args, **kwargs):
        try:
            queryset = self.get_queryset()
            serializer = self.get_serializer(queryset, many=True)
            
            print(f"Serialized {len(serializer.data)} exams")
            for exam_data in serializer.data:
                print(f"Returning exam: {exam_data['title']} - Questions: {len(exam_data.get('questions', []))}")
            
            return Response(serializer.data)
        except Exception as e:
            print(f"Error in ExamListView.list: {e}")
            import traceback
            traceback.print_exc()
            return Response([], status=status.HTTP_200_OK)



class ExamDetailView(generics.RetrieveAPIView):
    serializer_class = ShuffledExamSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return Exam.objects.filter(is_active=True)
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def start_exam(request, exam_id):
    exam = get_object_or_404(Exam, id=exam_id, is_active=True)
    
    # Check exam timing
    now = timezone.now()
    if exam.start_time and now < exam.start_time:
        return Response({
            'error': 'Exam has not started yet'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    if exam.end_time and now > exam.end_time:
        return Response({
            'error': 'Exam has ended'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Check if user already has an attempt
    existing_attempt = ExamAttempt.objects.filter(
        user=request.user, 
        exam=exam
    ).first()
    
    if existing_attempt:
        if existing_attempt.status == 'COMPLETED':
            return Response({
                'error': 'You have already completed this exam'
            }, status=status.HTTP_400_BAD_REQUEST)
        else:
            # Resume existing attempt
            # Log activity
            ExamActivityLog.objects.create(
                attempt=existing_attempt,
                activity_type='EXAM_STARTED',
                description='Resumed exam attempt',
                ip_address=get_client_ip(request)
            )
            serializer = ExamAttemptSerializer(existing_attempt)
            return Response(serializer.data)
    
    # Create new attempt
    attempt = ExamAttempt.objects.create(
        user=request.user,
        exam=exam,
        total_questions=exam.questions.count(),
        status='IN_PROGRESS'
    )
    
    # Log activity
    ExamActivityLog.objects.create(
        attempt=attempt,
        activity_type='EXAM_STARTED',
        description='Started new exam attempt',
        ip_address=get_client_ip(request)
    )
    
    serializer = ExamAttemptSerializer(attempt)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


def get_client_ip(request):
    """Get client IP address from request"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip

# backend/exam_app/views.py (update submit_answer function)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def submit_answer(request, attempt_id):
    attempt = get_object_or_404(
        ExamAttempt, 
        id=attempt_id, 
        user=request.user,
        status__in=['IN_PROGRESS', 'STARTED', 'PAUSED']
    )
    
    # Handle multipart/form-data for image uploads
    if request.content_type and 'multipart/form-data' in request.content_type:
        question_id = request.data.get('question_id')
        selected_option_id_raw = request.data.get('selected_option_id')
        answer_text = request.data.get('answer_text', '')
        time_taken = request.data.get('time_taken_seconds')
        images = request.FILES.getlist('images')  # Get all uploaded images
        attachments = request.FILES.getlist('attachments')  # Get all uploaded attachments
        
        # Handle selected_option_id - it might come as array, string, or None
        if selected_option_id_raw:
            if isinstance(selected_option_id_raw, list):
                selected_option_id = int(selected_option_id_raw[0]) if selected_option_id_raw[0] else None
            elif isinstance(selected_option_id_raw, str) and selected_option_id_raw.lower() in ['null', 'none', '']:
                selected_option_id = None
            else:
                try:
                    selected_option_id = int(selected_option_id_raw)
                except (ValueError, TypeError):
                    selected_option_id = None
        else:
            selected_option_id = None
    else:
        # Handle JSON requests - extract data safely
        # For JSON, request.data should be a dict, but handle QueryDict case too
        raw_data = request.data
        
        # Convert QueryDict to dict if needed, handling arrays properly
        if hasattr(raw_data, 'getlist'):
            # It's a QueryDict
            data = {}
            for key in raw_data.keys():
                # Use get() which returns single value (last if multiple)
                val = raw_data.get(key)
                # If it's still a list (shouldn't happen with get(), but be safe)
                if isinstance(val, list):
                    if len(val) > 0:
                        data[key] = val[-1]  # Last value
                    # Skip empty lists
                else:
                    data[key] = val
        else:
            # Already a dict
            data = raw_data.copy() if isinstance(raw_data, dict) else dict(raw_data)
        
        # CRITICAL: Remove selected_option_id completely if it's null, empty, or array
        # This prevents serializer validation errors
        if 'selected_option_id' in data:
            val = data['selected_option_id']
            should_remove = False
            
            if val is None:
                should_remove = True
            elif isinstance(val, list):
                # Always remove arrays - we don't want arrays for this field
                should_remove = True
            elif val == '' or str(val).lower() in ['null', 'none', 'undefined']:
                should_remove = True
            
            if should_remove:
                del data['selected_option_id']
            else:
                # Try to convert to int
                try:
                    data['selected_option_id'] = int(val)
                except (ValueError, TypeError):
                    del data['selected_option_id']
        
        # Validate required fields manually before serializer
        if 'question_id' not in data:
            return Response({'question_id': ['This field is required.']}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            question_id = int(data['question_id'])
        except (ValueError, TypeError):
            return Response({'question_id': ['Invalid question_id.']}, status=status.HTTP_400_BAD_REQUEST)
        
        # Extract other fields
        selected_option_id = data.get('selected_option_id')
        if selected_option_id is not None:
            try:
                selected_option_id = int(selected_option_id)
            except (ValueError, TypeError):
                selected_option_id = None
        
        answer_text = data.get('answer_text', '')
        time_taken = data.get('time_taken_seconds')
        if time_taken is not None:
            try:
                time_taken = int(time_taken)
            except (ValueError, TypeError):
                time_taken = None
        
        images = []
        attachments = []
    
    question = get_object_or_404(Question, id=question_id, exam=attempt.exam)
    
    # Validate images (max 3, 10MB each)
    MAX_IMAGES = 3
    MAX_SIZE = 10 * 1024 * 1024  # 10MB in bytes
    
    if len(images) > MAX_IMAGES:
        return Response(
            {'error': f'Maximum {MAX_IMAGES} images allowed per answer'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    for img in images:
        if img.size > MAX_SIZE:
            return Response(
                {'error': f'Image {img.name} exceeds 10MB limit'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        # Validate image format
        if not img.content_type.startswith('image/'):
            return Response(
                {'error': f'{img.name} is not a valid image file'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
    
    # Get existing answer if any
    existing_answer = Answer.objects.filter(
        attempt=attempt,
        question=question
    ).first()
    
    with transaction.atomic():
        if existing_answer:
            # Update existing answer
            was_correct = existing_answer.is_correct
            existing_answer.selected_option_id = selected_option_id
            existing_answer.answer_text = answer_text
            if time_taken:
                existing_answer.time_taken_seconds = time_taken
            existing_answer.save()
            
            # Delete existing images if new ones are being uploaded
            if images:
                existing_answer.answer_images.all().delete()
                # Create new answer images
                for idx, img in enumerate(images[:MAX_IMAGES]):
                    AnswerImage.objects.create(
                        answer=existing_answer,
                        image=img,
                        order=idx
                    )
            
            # Delete existing attachments if new ones are being uploaded
            if attachments:
                existing_answer.attachments.all().delete()
                # Create new attachments
                from exam_app.models import AnswerAttachment
                MAX_ATTACHMENTS = 5
                MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024  # 25MB per attachment
                
                for att in attachments[:MAX_ATTACHMENTS]:
                    if att.size <= MAX_ATTACHMENT_SIZE:
                        AnswerAttachment.objects.create(
                            answer=existing_answer,
                            file=att,
                            file_name=att.name,
                            file_type=att.name.split('.')[-1] if '.' in att.name else 'unknown',
                            file_size=att.size
                        )
            
            # Log activity
            activity_type = 'ANSWER_CHANGED' if existing_answer.is_correct != was_correct else 'ANSWER_SUBMITTED'
            ExamActivityLog.objects.create(
                attempt=attempt,
                activity_type=activity_type,
                description=f'{"Changed" if activity_type == "ANSWER_CHANGED" else "Submitted"} answer for question {question.order}',
                metadata={
                    'question_id': question_id,
                    'selected_option_id': selected_option_id,
                    'is_correct': existing_answer.is_correct,
                    'marks_awarded': existing_answer.marks_awarded,
                    'has_images': len(images) > 0,
                    'has_attachments': len(attachments) > 0,
                    'has_images': len(images) > 0
                },
                ip_address=get_client_ip(request)
            )
            answer = existing_answer
        else:
            # Create new answer
            answer = Answer.objects.create(
                attempt=attempt,
                question=question,
                selected_option_id=selected_option_id,
                answer_text=answer_text,
                time_taken_seconds=time_taken
            )
            
            # Create answer images
            for idx, img in enumerate(images[:MAX_IMAGES]):
                AnswerImage.objects.create(
                    answer=answer,
                    image=img,
                    order=idx
                )
            
            # Create answer attachments
            from exam_app.models import AnswerAttachment
            MAX_ATTACHMENTS = 5
            MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024  # 25MB per attachment
            
            for att in attachments[:MAX_ATTACHMENTS]:
                if att.size <= MAX_ATTACHMENT_SIZE:
                    AnswerAttachment.objects.create(
                        answer=answer,
                        file=att,
                        file_name=att.name,
                        file_type=att.name.split('.')[-1] if '.' in att.name else 'unknown',
                        file_size=att.size
                    )
            
            # Log activity
            ExamActivityLog.objects.create(
                attempt=attempt,
                activity_type='ANSWER_SUBMITTED',
                description=f'Submitted answer for question {question.order}',
                metadata={
                    'question_id': question_id,
                    'selected_option_id': selected_option_id,
                    'is_correct': answer.is_correct,
                    'marks_awarded': answer.marks_awarded,
                    'has_images': len(images) > 0,
                    'has_attachments': len(attachments) > 0
                },
                ip_address=get_client_ip(request)
            )
        
        logger.info(f"Answer saved: Question {question_id}, Option {selected_option_id}, Correct: {answer.is_correct}, Marks: {answer.marks_awarded}, Images: {len(images)}")
        
        return Response({
            'message': 'Answer submitted successfully',
            'is_correct': answer.is_correct,
            'marks_awarded': answer.marks_awarded
        })


# backend/exam_app/views.py (update submit_exam function)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def submit_exam(request, attempt_id):
    attempt = get_object_or_404(
        ExamAttempt, 
        id=attempt_id, 
        user=request.user,
        status__in=['IN_PROGRESS', 'STARTED', 'PAUSED']
    )
    
    with transaction.atomic():
        # Calculate score using enhanced method
        score_data = attempt.calculate_score()
        
        # Calculate unanswered questions
        total_questions = attempt.total_questions
        answered_questions = attempt.answers.count()
        unanswered = total_questions - answered_questions
        
        # Update attempt with enhanced scoring
        attempt.status = 'COMPLETED'
        attempt.end_time = timezone.now()
        attempt.score = score_data['score']
        attempt.percentage_score = score_data['percentage']
        attempt.correct_answers = score_data['correct_answers']
        attempt.wrong_answers = score_data['wrong_answers']
        attempt.unanswered_questions = unanswered
        attempt.is_passed = score_data['is_passed']
        attempt.evaluated_at = timezone.now()
        
        # Always set results_ready = False initially
        # Admin will release results manually after marking
        attempt.results_ready = False
        attempt.save()
        
        # Log activity
        ExamActivityLog.objects.create(
            attempt=attempt,
            activity_type='EXAM_SUBMITTED',
            description=f'Submitted exam with score: {score_data["score"]}/{attempt.exam.total_marks} ({score_data["percentage"]}%)',
            metadata={
                'score': score_data['score'],
                'percentage': score_data['percentage'],
                'correct_answers': score_data['correct_answers'],
                'wrong_answers': score_data['wrong_answers'],
                'unanswered': unanswered,
                'is_passed': score_data['is_passed']
            },
            ip_address=get_client_ip(request)
        )
    
    logger.info(f"Exam submitted: User {attempt.user.username}, Exam {attempt.exam.title}, Score: {score_data['score']}/{attempt.exam.total_marks}, Percentage: {score_data['percentage']}%")
    
    serializer = ExamAttemptSerializer(attempt)
    return Response({
        **serializer.data,
        'percentage_score': score_data['percentage'],
        'is_passed': score_data['is_passed'],
        'wrong_answers': score_data['wrong_answers'],
        'unanswered_questions': unanswered
    })


# backend/exam_app/views.py (update exam_results function)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def exam_results(request, attempt_id):
    # Refresh attempt from database to get latest data
    attempt = get_object_or_404(
        ExamAttempt, 
        id=attempt_id, 
        user=request.user,
        status='COMPLETED'
    )
    
    # Get answers with all related data - fresh query from database
    answers = Answer.objects.filter(attempt=attempt).select_related(
        'question', 'selected_option'
    ).prefetch_related('question__options', 'answer_images').order_by('question__order')
    
    # Prepare answer data with question and option details
    answer_data = []
    for answer in answers:
        # Get all options for the question
        question_options = list(answer.question.options.all())
        
        # Find the correct option
        correct_option = next((opt for opt in question_options if opt.is_correct), None)
        
        # Get answer images
        answer_images = []
        for img in answer.answer_images.all().order_by('order'):
            answer_images.append({
                'id': img.id,
                'image_url': request.build_absolute_uri(img.image.url) if img.image else None,
                'order': img.order
            })
        
        # Check if answer needs manual marking (SA or IMAGE_UPLOAD types)
        needs_manual_marking = answer.question.question_type in ['SA', 'TEXT', 'IMAGE_UPLOAD']
        is_manually_marked = needs_manual_marking and answer.marks_awarded is not None
        
        answer_info = {
            'id': answer.id,
            'question': {
                'id': answer.question.id,
                'question_text': answer.question.question_text,
                'question_type': answer.question.question_type,
                'question_image_url': request.build_absolute_uri(answer.question.question_image.url) if answer.question.question_image else None,
                'marks': answer.question.marks,
                'options': [
                    {
                        'id': opt.id,
                        'option_text': opt.option_text,
                        'option_image_url': request.build_absolute_uri(opt.option_image.url) if opt.option_image else None,
                        'is_correct': opt.is_correct,
                        'order': opt.order
                    } for opt in question_options
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
            'is_correct': answer.is_correct,
            'marks_awarded': answer.marks_awarded,
            'needs_manual_marking': needs_manual_marking,
            'is_manually_marked': is_manually_marked,
            'answered_at': answer.answered_at,
            # Include solution text & attachments only if results are released or user is admin
            'solution_text': answer.solution_text if attempt.results_ready or is_admin_user(request.user) else None,
            'solution_attachments': [
                {
                    'id': sa.id,
                    'file_name': sa.file_name,
                    'file_type': sa.file_type,
                    'file_url': request.build_absolute_uri(sa.file.url) if sa.file else None,
                    'uploaded_at': sa.uploaded_at.isoformat() if sa.uploaded_at else None,
                    'uploaded_by': sa.uploaded_by.username if sa.uploaded_by else None
                } for sa in answer.solution_attachments.all()
            ] if (attempt.results_ready or is_admin_user(request.user)) else []
        }
        answer_data.append(answer_info)
    
    # Prepare attempt data with exam details
    attempt_data = {
        'id': attempt.id,
        'exam_title': attempt.exam.title,
        'user_name': attempt.user.username,
        'start_time': attempt.start_time,
        'end_time': attempt.end_time,
        'status': attempt.status,
        'score': attempt.score or 0.0,
        'percentage_score': attempt.percentage_score or 0.0,
        'correct_answers': attempt.correct_answers or 0,
        'wrong_answers': attempt.wrong_answers or 0,
        'total_questions': attempt.total_questions,
        'results_ready': attempt.results_ready,
        'is_passed': attempt.is_passed,
        'exam': {
            'id': attempt.exam.id,
            'title': attempt.exam.title,
            'total_marks': attempt.exam.total_marks,
            'passing_marks': attempt.exam.passing_marks,
            'duration_minutes': attempt.exam.duration_minutes
        }
    }
    
    return Response({
        'attempt': attempt_data,
        'answers': answer_data
    })


# Pause exam endpoint
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def pause_exam(request, attempt_id):
    """Pause an exam attempt (e.g., when user exits fullscreen)"""
    attempt = get_object_or_404(
        ExamAttempt,
        id=attempt_id,
        user=request.user,
        status__in=['IN_PROGRESS', 'STARTED']
    )
    
    attempt.status = 'PAUSED'
    attempt.save()
    
    # Log activity
    ExamActivityLog.objects.create(
        attempt=attempt,
        activity_type='EXAM_STARTED',
        description='Exam paused (fullscreen exited)',
        metadata={'reason': 'fullscreen_exit'},
        ip_address=get_client_ip(request)
    )
    
    return Response({
        'message': 'Exam paused successfully',
        'status': 'PAUSED'
    })


# Resume exam endpoint (for students)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def resume_exam(request, attempt_id):
    """Resume a paused exam attempt"""
    attempt = get_object_or_404(
        ExamAttempt,
        id=attempt_id,
        user=request.user,
        status='PAUSED'
    )
    
    attempt.status = 'IN_PROGRESS'
    attempt.save()
    
    # Log activity
    ExamActivityLog.objects.create(
        attempt=attempt,
        activity_type='EXAM_STARTED',
        description='Exam resumed',
        metadata={'reason': 'user_resume'},
        ip_address=get_client_ip(request)
    )
    
    return Response({
        'message': 'Exam resumed successfully',
        'status': 'IN_PROGRESS'
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_attempts(request):
    """Get all exam attempts for the current user"""
    try:
        attempts = ExamAttempt.objects.filter(user=request.user).select_related('exam', 'exam__subject').order_by('-start_time')
        
        attempts_data = []
        for attempt in attempts:
            attempts_data.append({
                'id': attempt.id,
                'exam_id': attempt.exam.id,
                'exam_title': attempt.exam.title,
                'subject_name': attempt.exam.subject.name if attempt.exam.subject else 'N/A',
                'status': attempt.status,
                'score': attempt.score,
                'total_marks': attempt.exam.total_marks,
                'percentage_score': attempt.percentage_score,
                'is_passed': attempt.is_passed,
                'start_time': attempt.start_time.isoformat() if attempt.start_time else None,
                'end_time': attempt.end_time.isoformat() if attempt.end_time else None,
                'evaluated_at': attempt.evaluated_at.isoformat() if attempt.evaluated_at else None,
                'results_ready': attempt.results_ready,  # Include results_ready flag
            })
        
        return Response(attempts_data)
    except Exception as e:
        import traceback
        logger.error(f"Error fetching user attempts: {e}")
        traceback.print_exc()
        return Response({'error': f'Failed to fetch attempts: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
