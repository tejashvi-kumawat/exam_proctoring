# backend/proctoring/admin.py
from django.contrib import admin
from .models import ProctoringSession, ViolationLog, FaceDetectionLog, AudioMonitoringLog

@admin.register(ProctoringSession)
class ProctoringSessionAdmin(admin.ModelAdmin):
    list_display = ('attempt', 'camera_enabled', 'microphone_enabled', 'face_detection_enabled', 'created_at')
    list_filter = ('camera_enabled', 'microphone_enabled', 'face_detection_enabled', 'audio_monitoring_enabled', 'created_at')
    search_fields = ('attempt__user__username', 'attempt__exam__title')
    ordering = ('-created_at',)
    readonly_fields = ('created_at',)
    
    fieldsets = (
        ('Session Information', {
            'fields': ('attempt', 'created_at')
        }),
        ('Monitoring Settings', {
            'fields': ('camera_enabled', 'microphone_enabled', 'screen_sharing_enabled', 
                      'face_detection_enabled', 'audio_monitoring_enabled')
        }),
    )

@admin.register(ViolationLog)
class ViolationLogAdmin(admin.ModelAdmin):
    list_display = ('session_user', 'violation_type', 'severity', 'timestamp')
    list_filter = ('violation_type', 'severity', 'timestamp')
    search_fields = ('session__attempt__user__username', 'description')
    ordering = ('-timestamp',)
    readonly_fields = ('timestamp',)
    
    def session_user(self, obj):
        return obj.session.attempt.user.username
    session_user.short_description = 'User'
    
    fieldsets = (
        ('Violation Information', {
            'fields': ('session', 'violation_type', 'severity', 'timestamp')
        }),
        ('Details', {
            'fields': ('description',)
        }),
    )

@admin.register(FaceDetectionLog)
class FaceDetectionLogAdmin(admin.ModelAdmin):
    list_display = ('session_user', 'faces_detected', 'confidence_score', 'timestamp')
    list_filter = ('faces_detected', 'timestamp')
    search_fields = ('session__attempt__user__username',)
    ordering = ('-timestamp',)
    readonly_fields = ('timestamp',)
    
    def session_user(self, obj):
        return obj.session.attempt.user.username
    session_user.short_description = 'User'

@admin.register(AudioMonitoringLog)
class AudioMonitoringLogAdmin(admin.ModelAdmin):
    list_display = ('session_user', 'noise_level', 'threshold_exceeded', 'timestamp')
    list_filter = ('threshold_exceeded', 'timestamp')
    search_fields = ('session__attempt__user__username',)
    ordering = ('-timestamp',)
    readonly_fields = ('timestamp',)
    
    def session_user(self, obj):
        return obj.session.attempt.user.username
    session_user.short_description = 'User'
