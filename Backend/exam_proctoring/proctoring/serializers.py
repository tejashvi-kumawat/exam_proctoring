# backend/proctoring/serializers.py (add to existing file or create if missing)
from rest_framework import serializers
from .models import ProctoringSession, ViolationLog, FaceDetectionLog, AudioMonitoringLog

class ViolationLogSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='session.attempt.user.username', read_only=True)
    exam_title = serializers.CharField(source='session.attempt.exam.title', read_only=True)
    
    class Meta:
        model = ViolationLog
        fields = [
            'id', 'violation_type', 'description', 'timestamp', 
            'severity', 'student_name', 'exam_title'
        ]

class ProctoringSessionSerializer(serializers.ModelSerializer):
    exam_title = serializers.CharField(source='attempt.exam.title', read_only=True)
    user_name = serializers.CharField(source='attempt.user.username', read_only=True)
    
    class Meta:
        model = ProctoringSession
        fields = [
            'id', 'exam_title', 'user_name', 'camera_enabled', 
            'microphone_enabled', 'screen_sharing_enabled', 
            'face_detection_enabled', 'audio_monitoring_enabled', 'created_at'
        ]

class FaceDetectionLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = FaceDetectionLog
        fields = ['id', 'faces_detected', 'confidence_score', 'timestamp', 'image_path']

class AudioMonitoringLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AudioMonitoringLog
        fields = ['id', 'noise_level', 'threshold_exceeded', 'timestamp']
