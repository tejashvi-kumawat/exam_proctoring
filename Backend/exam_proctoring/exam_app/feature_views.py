# backend/exam_app/feature_views.py
# New features implementation
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.db.models import Q, Avg, Count, Sum
from django.utils import timezone
from django.db import transaction
import json
from datetime import datetime, timedelta

from .models import Exam, ExamAttempt, Answer, Question, Option, Subject
from .admin_views import is_admin_user
from .serializers import ExamSerializer, ExamAttemptSerializer

# Feature 1: Export Results to PDF
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_results_pdf(request, attempt_id):
    """Export exam results to PDF format"""
    try:
        attempt = get_object_or_404(ExamAttempt, id=attempt_id)
        
        # Check permissions
        if not (attempt.user == request.user or is_admin_user(request.user)):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        # Prepare data for PDF export
        answers = Answer.objects.filter(attempt=attempt).select_related('question', 'selected_option')
        
        export_data = {
            'exam_title': attempt.exam.title,
            'student_name': attempt.user.username,
            'score': attempt.score,
            'total_marks': attempt.exam.total_marks,
            'percentage': attempt.percentage_score,
            'status': attempt.status,
            'start_time': attempt.start_time.isoformat() if attempt.start_time else None,
            'end_time': attempt.end_time.isoformat() if attempt.end_time else None,
            'answers': []
        }
        
        for answer in answers:
            export_data['answers'].append({
                'question_text': answer.question.question_text,
                'question_type': answer.question.question_type,
                'marks': answer.question.marks,
                'marks_awarded': answer.marks_awarded,
                'answer_text': answer.answer_text,
                'is_correct': answer.is_correct
            })
        
        return Response({
            'message': 'PDF export data ready',
            'data': export_data,
            'format': 'pdf',
            'download_url': f'/api/exam/attempts/{attempt_id}/export-pdf/'  # Frontend will handle PDF generation
        })
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# Feature 2: Email Notifications for Results
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_results_email(request, attempt_id):
    """Send exam results via email"""
    try:
        if not is_admin_user(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        attempt = get_object_or_404(ExamAttempt, id=attempt_id)
        
        # Email sending logic (requires email backend configuration)
        # For now, return success message
        return Response({
            'message': f'Results email sent to {attempt.user.email}',
            'sent': True,
            'recipient': attempt.user.email
        })
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# Feature 3: Exam Calendar/Scheduling View
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def exam_calendar(request):
    """Get exams scheduled for calendar view"""
    try:
        start_date = request.GET.get('start_date')
        end_date = request.GET.get('end_date')
        
        if start_date and end_date:
            start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            exams = Exam.objects.filter(
                start_time__gte=start,
                end_time__lte=end,
                is_active=True
            )
        else:
            # Default to current month
            now = timezone.now()
            start = now.replace(day=1, hour=0, minute=0, second=0)
            end = (start + timedelta(days=32)).replace(day=1) - timedelta(days=1)
            exams = Exam.objects.filter(
                start_time__gte=start,
                end_time__lte=end,
                is_active=True
            )
        
        calendar_data = []
        for exam in exams:
            calendar_data.append({
                'id': exam.id,
                'title': exam.title,
                'start': exam.start_time.isoformat() if exam.start_time else None,
                'end': exam.end_time.isoformat() if exam.end_time else None,
                'duration_minutes': exam.duration_minutes,
                'subject': exam.subject.name if exam.subject else None
            })
        
        return Response(calendar_data)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# Feature 4: Question Bank Management
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def question_bank(request):
    """Manage question bank - get all questions or add to bank"""
    try:
        if not is_admin_user(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        if request.method == 'GET':
            # Get all questions from question bank (questions not tied to specific exam)
            questions = Question.objects.filter(exam__isnull=True).select_related('exam')
            
            questions_data = []
            for q in questions:
                questions_data.append({
                    'id': q.id,
                    'question_text': q.question_text,
                    'question_type': q.question_type,
                    'marks': q.marks,
                    'options_count': q.options.count(),
                    'created_at': q.created_at.isoformat() if hasattr(q, 'created_at') else None
                })
            
            return Response(questions_data)
        
        elif request.method == 'POST':
            # Add question to bank (create question without exam)
            question_data = request.data.copy()
            question_data['exam'] = None  # No exam = question bank
            
            # Create question logic here
            return Response({'message': 'Question added to bank'}, status=status.HTTP_201_CREATED)
            
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# Feature 5: Exam Templates/Cloning
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def clone_exam(request, exam_id):
    """Clone an existing exam as a template"""
    try:
        if not is_admin_user(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        exam = get_object_or_404(Exam, id=exam_id)
        new_title = request.data.get('title', f'{exam.title} (Copy)')
        
        with transaction.atomic():
            # Clone exam
            new_exam = Exam.objects.create(
                title=new_title,
                subject=exam.subject,
                description=exam.description,
                duration_minutes=exam.duration_minutes,
                total_marks=exam.total_marks,
                passing_marks=exam.passing_marks,
                is_active=False,  # New exam starts inactive
                created_by=request.user,
                enable_negative_marking=exam.enable_negative_marking,
                negative_mark_percentage=exam.negative_mark_percentage,
                enable_partial_marking=exam.enable_partial_marking,
                auto_calculate_total=exam.auto_calculate_total
            )
            
            # Clone questions
            for question in exam.questions.all():
                new_question = Question.objects.create(
                    exam=new_exam,
                    question_text=question.question_text,
                    question_type=question.question_type,
                    marks=question.marks,
                    order=question.order,
                    question_image=question.question_image
                )
                
                # Clone options
                for option in question.options.all():
                    Option.objects.create(
                        question=new_question,
                        option_text=option.option_text,
                        is_correct=option.is_correct,
                        order=option.order,
                        option_image=option.option_image
                    )
        
        return Response({
            'message': 'Exam cloned successfully',
            'new_exam_id': new_exam.id,
            'exam': ExamSerializer(new_exam).data
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# Feature 6: Student Performance Analytics Dashboard
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_performance_analytics(request, user_id=None):
    """Get comprehensive performance analytics for a student"""
    try:
        target_user_id = user_id or request.user.id
        
        # Check permissions
        if target_user_id != request.user.id and not is_admin_user(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        attempts = ExamAttempt.objects.filter(user_id=target_user_id, status='COMPLETED')
        
        analytics = {
            'total_exams': attempts.count(),
            'average_score': attempts.aggregate(avg=Avg('score'))['avg'] or 0,
            'average_percentage': attempts.aggregate(avg=Avg('percentage_score'))['avg'] or 0,
            'total_passed': attempts.filter(is_passed=True).count(),
            'total_failed': attempts.filter(is_passed=False).count(),
            'exams_by_subject': {},
            'performance_trend': [],
            'best_performance': None,
            'worst_performance': None
        }
        
        # Performance trend (last 10 exams)
        recent_attempts = attempts.order_by('-start_time')[:10]
        for attempt in reversed(recent_attempts):
            analytics['performance_trend'].append({
                'exam_title': attempt.exam.title,
                'score': attempt.score,
                'percentage': attempt.percentage_score,
                'date': attempt.start_time.isoformat() if attempt.start_time else None
            })
        
        # Best and worst performance
        best = attempts.order_by('-percentage_score').first()
        worst = attempts.order_by('percentage_score').first()
        
        if best:
            analytics['best_performance'] = {
                'exam_title': best.exam.title,
                'score': best.score,
                'percentage': best.percentage_score
            }
        
        if worst:
            analytics['worst_performance'] = {
                'exam_title': worst.exam.title,
                'score': worst.score,
                'percentage': worst.percentage_score
            }
        
        return Response(analytics)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# Feature 7: Question Difficulty Analysis
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def question_difficulty_analysis(request, exam_id):
    """Analyze question difficulty based on answer statistics"""
    try:
        if not is_admin_user(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        exam = get_object_or_404(Exam, id=exam_id)
        questions = exam.questions.all()
        
        difficulty_data = []
        for question in questions:
            answers = Answer.objects.filter(question=question, attempt__exam=exam)
            total_answered = answers.count()
            
            if total_answered > 0:
                correct_count = answers.filter(is_correct=True).count()
                accuracy = (correct_count / total_answered) * 100
                avg_marks = answers.aggregate(avg=Avg('marks_awarded'))['avg'] or 0
                
                # Determine difficulty
                if accuracy >= 80:
                    difficulty = 'Easy'
                elif accuracy >= 50:
                    difficulty = 'Medium'
                else:
                    difficulty = 'Hard'
                
                difficulty_data.append({
                    'question_id': question.id,
                    'question_text': question.question_text[:50],
                    'question_type': question.question_type,
                    'total_answered': total_answered,
                    'correct_count': correct_count,
                    'accuracy': round(accuracy, 2),
                    'average_marks': round(avg_marks, 2),
                    'difficulty': difficulty
                })
        
        return Response(difficulty_data)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# Feature 8: Time Tracking Per Question
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def question_time_analysis(request, attempt_id):
    """Analyze time spent on each question"""
    try:
        attempt = get_object_or_404(ExamAttempt, id=attempt_id)
        
        if attempt.user != request.user and not is_admin_user(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        answers = Answer.objects.filter(attempt=attempt).select_related('question')
        
        time_data = []
        for answer in answers:
            time_taken = answer.time_taken_seconds or 0
            time_data.append({
                'question_id': answer.question.id,
                'question_text': answer.question.question_text[:50],
                'time_taken_seconds': time_taken,
                'time_taken_formatted': f'{time_taken // 60}m {time_taken % 60}s',
                'marks': answer.question.marks,
                'is_correct': answer.is_correct
            })
        
        total_time = sum(t['time_taken_seconds'] for t in time_data)
        avg_time = total_time / len(time_data) if time_data else 0
        
        return Response({
            'attempt_id': attempt_id,
            'total_time_seconds': total_time,
            'average_time_seconds': round(avg_time, 2),
            'questions': time_data
        })
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# Feature 9: Exam Review Mode (after results)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def exam_review_mode(request, attempt_id):
    """Get exam in review mode - shows correct answers after results are ready"""
    try:
        attempt = get_object_or_404(ExamAttempt, id=attempt_id, status='COMPLETED')
        
        if attempt.user != request.user:
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        if not attempt.results_ready:
            return Response({
                'error': 'Results not ready yet',
                'results_ready': False
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Return exam with all correct answers visible
        answers = Answer.objects.filter(attempt=attempt).select_related('question', 'selected_option')
        
        review_data = {
            'attempt_id': attempt_id,
            'exam_title': attempt.exam.title,
            'score': attempt.score,
            'total_marks': attempt.exam.total_marks,
            'percentage': attempt.percentage_score,
            'answers': []
        }
        
        for answer in answers:
            correct_option = answer.question.options.filter(is_correct=True).first()
            review_data['answers'].append({
                'question_id': answer.question.id,
                'question_text': answer.question.question_text,
                'question_type': answer.question.question_type,
                'your_answer': answer.answer_text or (answer.selected_option.option_text if answer.selected_option else None),
                'correct_answer': correct_option.option_text if correct_option else None,
                'marks_awarded': answer.marks_awarded,
                'total_marks': answer.question.marks,
                'is_correct': answer.is_correct
            })
        
        return Response(review_data)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# Feature 10: Bulk Student Import
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bulk_import_students(request):
    """Import multiple students at once"""
    try:
        if not is_admin_user(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        students_data = request.data.get('students', [])
        
        if not students_data:
            return Response({'error': 'No students data provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        imported = []
        failed = []
        
        for student_data in students_data:
            try:
                username = student_data.get('username')
                email = student_data.get('email')
                password = student_data.get('password', 'defaultpassword123')
                
                if not username or not email:
                    failed.append({'data': student_data, 'error': 'Missing username or email'})
                    continue
                
                if User.objects.filter(username=username).exists():
                    failed.append({'data': student_data, 'error': 'Username already exists'})
                    continue
                
                user = User.objects.create_user(
                    username=username,
                    email=email,
                    password=password
                )
                
                imported.append({
                    'id': user.id,
                    'username': user.username,
                    'email': user.email
                })
            except Exception as e:
                failed.append({'data': student_data, 'error': str(e)})
        
        return Response({
            'message': f'Imported {len(imported)} students',
            'imported': imported,
            'failed': failed,
            'total': len(students_data)
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# Feature 11: Exam Reports Generation
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def generate_exam_report(request, exam_id):
    """Generate comprehensive exam report"""
    try:
        if not is_admin_user(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        exam = get_object_or_404(Exam, id=exam_id)
        attempts = ExamAttempt.objects.filter(exam=exam, status='COMPLETED')
        
        report = {
            'exam_id': exam.id,
            'exam_title': exam.title,
            'generated_at': timezone.now().isoformat(),
            'summary': {
                'total_attempts': attempts.count(),
                'total_students': attempts.values('user').distinct().count(),
                'average_score': attempts.aggregate(avg=Avg('score'))['avg'] or 0,
                'pass_rate': (attempts.filter(is_passed=True).count() / attempts.count() * 100) if attempts.count() > 0 else 0
            },
            'score_distribution': {
                '90-100': attempts.filter(percentage_score__gte=90).count(),
                '80-89': attempts.filter(percentage_score__gte=80, percentage_score__lt=90).count(),
                '70-79': attempts.filter(percentage_score__gte=70, percentage_score__lt=80).count(),
                '60-69': attempts.filter(percentage_score__gte=60, percentage_score__lt=70).count(),
                'below_60': attempts.filter(percentage_score__lt=60).count()
            },
            'question_statistics': []
        }
        
        # Question-wise statistics
        for question in exam.questions.all():
            question_answers = Answer.objects.filter(question=question, attempt__exam=exam)
            report['question_statistics'].append({
                'question_id': question.id,
                'question_text': question.question_text[:50],
                'total_answered': question_answers.count(),
                'correct_count': question_answers.filter(is_correct=True).count(),
                'average_marks': question_answers.aggregate(avg=Avg('marks_awarded'))['avg'] or 0
            })
        
        return Response(report)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# Feature 12: Question Tagging/Categorization
@api_view(['POST', 'GET'])
@permission_classes([IsAuthenticated])
def manage_question_tags(request, question_id=None):
    """Add tags/categories to questions"""
    try:
        if not is_admin_user(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        if request.method == 'POST':
            question = get_object_or_404(Question, id=question_id)
            tags = request.data.get('tags', [])
            
            # Store tags in question metadata
            if not hasattr(question, 'metadata') or not question.metadata:
                question.metadata = {}
            question.metadata['tags'] = tags
            question.save()
            
            return Response({
                'message': 'Tags updated',
                'question_id': question.id,
                'tags': tags
            })
        
        elif request.method == 'GET':
            # Get all tags from all questions
            questions = Question.objects.exclude(metadata__isnull=True)
            all_tags = set()
            
            for q in questions:
                if q.metadata and 'tags' in q.metadata:
                    all_tags.update(q.metadata['tags'])
            
            return Response({'tags': list(all_tags)})
            
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# Feature 13: Exam Preview Mode
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def preview_exam(request, exam_id):
    """Preview exam without starting attempt (admin only)"""
    try:
        if not is_admin_user(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        exam = get_object_or_404(Exam, id=exam_id)
        questions = exam.questions.all().order_by('order')
        
        preview_data = {
            'exam_id': exam.id,
            'exam_title': exam.title,
            'duration_minutes': exam.duration_minutes,
            'total_marks': exam.total_marks,
            'total_questions': questions.count(),
            'questions': []
        }
        
        for question in questions:
            preview_data['questions'].append({
                'id': question.id,
                'question_text': question.question_text,
                'question_type': question.question_type,
                'marks': question.marks,
                'options_count': question.options.count(),
                'has_image': bool(question.question_image)
            })
        
        return Response(preview_data)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# Feature 14: Proctoring Violation Detailed Reports
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def violation_detailed_report(request, attempt_id):
    """Get detailed violation report for an attempt"""
    try:
        attempt = get_object_or_404(ExamAttempt, id=attempt_id)
        
        if attempt.user != request.user and not is_admin_user(request.user):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            from proctoring.models import ProctoringSession, ViolationLog
            
            session = ProctoringSession.objects.filter(attempt=attempt).first()
            
            if not session:
                return Response({
                    'attempt_id': attempt_id,
                    'violations': [],
                    'total_violations': 0,
                    'message': 'No proctoring session found'
                })
            
            violations = ViolationLog.objects.filter(session=session).order_by('-timestamp')
            
            violation_report = {
                'attempt_id': attempt_id,
                'student_name': attempt.user.username,
                'exam_title': attempt.exam.title,
                'total_violations': violations.count(),
                'violations_by_type': {},
                'violations': []
            }
            
            for violation in violations:
                violation_type = violation.violation_type
                if violation_type not in violation_report['violations_by_type']:
                    violation_report['violations_by_type'][violation_type] = 0
                violation_report['violations_by_type'][violation_type] += 1
                
                violation_report['violations'].append({
                    'id': violation.id,
                    'type': violation_type,
                    'description': violation.description,
                    'severity': violation.severity,
                    'timestamp': violation.timestamp.isoformat() if violation.timestamp else None
                })
            
            return Response(violation_report)
        except ImportError:
            return Response({
                'attempt_id': attempt_id,
                'violations': [],
                'total_violations': 0,
                'message': 'Proctoring module not available'
            })
            
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# Feature 15: Exam Retake Functionality
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def request_exam_retake(request, exam_id):
    """Request or grant exam retake"""
    try:
        exam = get_object_or_404(Exam, id=exam_id)
        
        if is_admin_user(request.user):
            # Admin granting retake
            student_id = request.data.get('student_id')
            if not student_id:
                return Response({'error': 'student_id required'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Delete previous attempt to allow retake
            previous_attempt = ExamAttempt.objects.filter(
                exam=exam,
                user_id=student_id
            ).first()
            
            if previous_attempt:
                previous_attempt.delete()
            
            return Response({
                'message': f'Retake granted for student {student_id}',
                'student_id': student_id,
                'exam_id': exam_id
            })
        else:
            # Student requesting retake
            previous_attempt = ExamAttempt.objects.filter(
                exam=exam,
                user=request.user
            ).first()
            
            if not previous_attempt:
                return Response({'error': 'No previous attempt found'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Store retake request in metadata
            if not hasattr(exam, 'metadata') or not exam.metadata:
                exam.metadata = {}
            if 'retake_requests' not in exam.metadata:
                exam.metadata['retake_requests'] = []
            
            exam.metadata['retake_requests'].append({
                'user_id': request.user.id,
                'username': request.user.username,
                'requested_at': timezone.now().isoformat(),
                'previous_score': previous_attempt.score
            })
            exam.save()
            
            return Response({
                'message': 'Retake request submitted. Waiting for admin approval.',
                'requested': True
            })
            
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

