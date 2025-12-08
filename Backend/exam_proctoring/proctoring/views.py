# backend/proctoring/views.py
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from exam_app.models import ExamAttempt
from .models import ProctoringSession, ViolationLog, FaceDetectionLog, AudioMonitoringLog
from .serializers import (
    ProctoringSessionSerializer, ViolationLogSerializer, 
    FaceDetectionLogSerializer, AudioMonitoringLogSerializer
)
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_proctoring_session(request, attempt_id):
    """Get proctoring session details for an exam attempt"""
    attempt = get_object_or_404(ExamAttempt, id=attempt_id, user=request.user)
    
    try:
        session = ProctoringSession.objects.get(attempt=attempt)
        serializer = ProctoringSessionSerializer(session)
        return Response(serializer.data)
    except ProctoringSession.DoesNotExist:
        return Response({
            'error': 'Proctoring session not found'
        }, status=status.HTTP_404_NOT_FOUND)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_violations(request, attempt_id):
    """Get all violations for a proctoring session"""
    attempt = get_object_or_404(ExamAttempt, id=attempt_id, user=request.user)
    
    try:
        session = ProctoringSession.objects.get(attempt=attempt)
        violations = ViolationLog.objects.filter(session=session).order_by('-timestamp')
        serializer = ViolationLogSerializer(violations, many=True)
        return Response(serializer.data)
    except ProctoringSession.DoesNotExist:
        return Response({
            'error': 'Proctoring session not found'
        }, status=status.HTTP_404_NOT_FOUND)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_session_logs(request, attempt_id):
    """Get all logs (face detection, audio monitoring) for a session"""
    attempt = get_object_or_404(ExamAttempt, id=attempt_id, user=request.user)
    
    try:
        session = ProctoringSession.objects.get(attempt=attempt)
        
        face_logs = FaceDetectionLog.objects.filter(session=session).order_by('-timestamp')[:50]
        audio_logs = AudioMonitoringLog.objects.filter(session=session).order_by('-timestamp')[:50]
        
        return Response({
            'face_detection_logs': FaceDetectionLogSerializer(face_logs, many=True).data,
            'audio_monitoring_logs': AudioMonitoringLogSerializer(audio_logs, many=True).data
        })
    except ProctoringSession.DoesNotExist:
        return Response({
            'error': 'Proctoring session not found'
        }, status=status.HTTP_404_NOT_FOUND)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def report_violation(request):
    """Report a violation manually"""
    violation_type = request.data.get('violation_type')
    description = request.data.get('description', '')
    attempt_id = request.data.get('attempt_id')
    
    if not violation_type or not attempt_id:
        return Response({
            'error': 'violation_type and attempt_id are required'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    attempt = get_object_or_404(ExamAttempt, id=attempt_id, user=request.user)
    
    try:
        session = ProctoringSession.objects.get(attempt=attempt)
        
        violation = ViolationLog.objects.create(
            session=session,
            violation_type=violation_type,
            description=description,
            severity='MEDIUM'
        )
        
        serializer = ViolationLogSerializer(violation)
        # Broadcast to admin monitoring group so admins receive realtime updates
        try:
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f'admin_attempt_{attempt_id}',
                {
                    'type': 'attempt_update',
                    'data': {
                        'event': 'violation',
                        'violation': serializer.data,
                        'attempt_id': attempt_id,
                    }
                }
            )
        except Exception:
            # Don't fail the API if broadcasting fails
            pass
        return Response(serializer.data, status=status.HTTP_201_CREATED)
        
    except ProctoringSession.DoesNotExist:
        return Response({
            'error': 'Proctoring session not found'
        }, status=status.HTTP_404_NOT_FOUND)
