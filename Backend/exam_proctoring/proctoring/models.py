# backend/proctoring/models.py
from django.db import models
from django.contrib.auth.models import User
from exam_app.models import ExamAttempt

class ProctoringSession(models.Model):
    attempt = models.OneToOneField(ExamAttempt, on_delete=models.CASCADE)
    camera_enabled = models.BooleanField(default=False)
    microphone_enabled = models.BooleanField(default=False)
    screen_sharing_enabled = models.BooleanField(default=False)
    face_detection_enabled = models.BooleanField(default=True)
    audio_monitoring_enabled = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

class ViolationLog(models.Model):
    VIOLATION_TYPES = [
        ('FACE_NOT_DETECTED', 'Face Not Detected'),
        ('MULTIPLE_FACES', 'Multiple Faces Detected'),
        ('TAB_SWITCH', 'Tab Switch'),
        ('WINDOW_BLUR', 'Window Lost Focus'),
        ('COPY_PASTE', 'Copy/Paste Attempt'),
        ('RIGHT_CLICK', 'Right Click'),
        ('NOISE_DETECTED', 'Excessive Noise'),
        ('SCREEN_SHARE_STOPPED', 'Screen Share Stopped'),
    ]
    
    session = models.ForeignKey(ProctoringSession, on_delete=models.CASCADE, related_name='violations')
    violation_type = models.CharField(max_length=30, choices=VIOLATION_TYPES)
    description = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    severity = models.CharField(max_length=10, choices=[
        ('LOW', 'Low'),
        ('MEDIUM', 'Medium'),
        ('HIGH', 'High'),
        ('CRITICAL', 'Critical')
    ], default='MEDIUM')

class FaceDetectionLog(models.Model):
    session = models.ForeignKey(ProctoringSession, on_delete=models.CASCADE)
    faces_detected = models.IntegerField()
    confidence_score = models.FloatField()
    timestamp = models.DateTimeField(auto_now_add=True)
    image_path = models.CharField(max_length=500, blank=True)

class AudioMonitoringLog(models.Model):
    session = models.ForeignKey(ProctoringSession, on_delete=models.CASCADE)
    noise_level = models.FloatField()
    threshold_exceeded = models.BooleanField(default=False)
    timestamp = models.DateTimeField(auto_now_add=True)
