# backend/proctoring/admin_views.py (create this file)
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
import traceback

try:
    from .models import ViolationLog, ProctoringSession
    from exam_app.models import ExamAttempt
    PROCTORING_AVAILABLE = True
except ImportError:
    PROCTORING_AVAILABLE = False

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def recent_violations(request):
    """Get recent violations for admin"""
    try:
        if not (request.user.is_staff or getattr(request.user, 'is_instructor', False)):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        if not PROCTORING_AVAILABLE:
            return Response([])
        
        violations = ViolationLog.objects.select_related(
            'session__attempt__user', 
            'session__attempt__exam'
        ).order_by('-timestamp')[:50]
        
        violations_data = []
        for violation in violations:
            violations_data.append({
                'id': violation.id,
                'violation_type': violation.violation_type,
                'description': violation.description,
                'severity': violation.severity,
                'timestamp': violation.timestamp.isoformat() if violation.timestamp else None,
                'student_name': violation.session.attempt.user.username,
                'exam_title': violation.session.attempt.exam.title
            })
        
        return Response(violations_data)
    except Exception as e:
        print(f"Error in recent_violations: {e}")
        print(traceback.format_exc())
        return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def attempt_violations(request, attempt_id):
    """Get violations for a specific attempt"""
    try:
        if not (request.user.is_staff or getattr(request.user, 'is_instructor', False)):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        if not PROCTORING_AVAILABLE:
            return Response([])
        
        attempt = get_object_or_404(ExamAttempt, id=attempt_id)
        session = ProctoringSession.objects.filter(attempt=attempt).first()
        
        if not session:
            return Response([])
        
        violations = ViolationLog.objects.filter(session=session).order_by('-timestamp')
        
        violations_data = []
        for violation in violations:
            violations_data.append({
                'id': violation.id,
                'violation_type': violation.violation_type,
                'description': violation.description,
                'severity': violation.severity,
                'timestamp': violation.timestamp.isoformat() if violation.timestamp else None
            })
        
        return Response(violations_data)
    except Exception as e:
        print(f"Error in attempt_violations: {e}")
        print(traceback.format_exc())
        return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
# backend/proctoring/admin_views.py (add missing function)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def exam_violations(request, exam_id):
    """Get violations for a specific exam"""
    try:
        if not (request.user.is_staff or getattr(request.user, 'is_instructor', False)):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        if not PROCTORING_AVAILABLE:
            return Response([])
        
        # Get all attempts for this exam
        from exam_app.models import ExamAttempt
        attempts = ExamAttempt.objects.filter(exam_id=exam_id)
        sessions = ProctoringSession.objects.filter(attempt__in=attempts)
        
        violations = ViolationLog.objects.filter(session__in=sessions).order_by('-timestamp')[:50]
        
        violations_data = []
        for violation in violations:
            violations_data.append({
                'id': violation.id,
                'violation_type': violation.violation_type,
                'description': violation.description,
                'severity': violation.severity,
                'timestamp': violation.timestamp.isoformat() if violation.timestamp else None,
                'student_name': violation.session.attempt.user.username,
                'exam_title': violation.session.attempt.exam.title
            })
        
        return Response(violations_data)
    except Exception as e:
        print(f"Error in exam_violations: {e}")
        return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
