# backend/proctoring/admin_consumer.py
"""
WebSocket consumer for real-time admin monitoring
Allows admins to monitor live exam attempts
"""
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from exam_app.models import ExamAttempt, ExamActivityLog

User = get_user_model()


class AdminMonitoringConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for admin real-time monitoring"""
    
    async def connect(self):
        self.user = self.scope["user"]
        self.exam_id = self.scope['url_route']['kwargs'].get('exam_id')
        self.attempt_id = self.scope['url_route']['kwargs'].get('attempt_id')
        
        # Check if user is admin
        if self.user.is_anonymous:
            await self.close()
            return
        
        is_admin = await self.check_admin_permissions()
        if not is_admin:
            await self.close()
            return
        
        # Join room group
        if self.exam_id:
            self.room_group_name = f'admin_exam_{self.exam_id}'
        elif self.attempt_id:
            self.room_group_name = f'admin_attempt_{self.attempt_id}'
        else:
            self.room_group_name = 'admin_monitoring'
        
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        
        # Send initial data
        await self.send_initial_data()
    
    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
    
    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'get_live_attempts':
                await self.send_live_attempts()
            elif message_type == 'get_attempt_details':
                attempt_id = data.get('attempt_id')
                if attempt_id:
                    await self.send_attempt_details(attempt_id)
            elif message_type == 'get_activities':
                attempt_id = data.get('attempt_id')
                if attempt_id:
                    await self.send_activities(attempt_id)
            elif message_type == 'ping':
                await self.send(text_data=json.dumps({'type': 'pong'}))
                
        except Exception as e:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': str(e)
            }))
    
    async def send_initial_data(self):
        """Send initial monitoring data"""
        if self.exam_id:
            await self.send_live_attempts()
        elif self.attempt_id:
            await self.send_attempt_details(self.attempt_id)
    
    async def send_live_attempts(self):
        """Send live attempts for an exam"""
        if not self.exam_id:
            return
        
        attempts_data = await self.get_live_attempts_data(self.exam_id)
        
        await self.send(text_data=json.dumps({
            'type': 'live_attempts',
            'data': attempts_data
        }))
    
    async def send_attempt_details(self, attempt_id):
        """Send detailed attempt information"""
        details = await self.get_attempt_details_data(attempt_id)
        
        await self.send(text_data=json.dumps({
            'type': 'attempt_details',
            'data': details
        }))
    
    async def send_activities(self, attempt_id):
        """Send activity logs for an attempt"""
        activities = await self.get_activities_data(attempt_id)
        
        await self.send(text_data=json.dumps({
            'type': 'activities',
            'data': activities
        }))
    
    # Activity update handler (called when activity is logged)
    async def activity_update(self, event):
        """Handle activity update from channel layer"""
        await self.send(text_data=json.dumps({
            'type': 'activity_update',
            'data': event['data']
        }))
    
    # Attempt update handler
    async def attempt_update(self, event):
        """Handle attempt update from channel layer"""
        await self.send(text_data=json.dumps({
            'type': 'attempt_update',
            'data': event['data']
        }))
    
    @database_sync_to_async
    def check_admin_permissions(self):
        """Check if user has admin permissions"""
        return self.user.is_staff or getattr(self.user, 'is_instructor', False)
    
    @database_sync_to_async
    def get_live_attempts_data(self, exam_id):
        """Get live attempts data"""
        from django.utils import timezone
        from proctoring.models import ProctoringSession, ViolationLog, FaceDetectionLog
        
        attempts = ExamAttempt.objects.filter(
            exam_id=exam_id,
            status__in=['STARTED', 'IN_PROGRESS']
        ).select_related('user')
        
        attempts_data = []
        for attempt in attempts:
            violations_count = 0
            camera_status = False
            face_detected = False
            audio_status = False
            
            try:
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
            
            latest_activity = ExamActivityLog.objects.filter(attempt=attempt).order_by('-timestamp').first()
            last_activity = None
            if latest_activity:
                last_activity = {
                    'type': latest_activity.activity_type,
                    'timestamp': latest_activity.timestamp.isoformat(),
                    'description': latest_activity.description
                }
            
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
        
        return attempts_data
    
    @database_sync_to_async
    def get_attempt_details_data(self, attempt_id):
        """Get detailed attempt data"""
        from proctoring.models import ProctoringSession, ViolationLog, FaceDetectionLog
        
        attempt = ExamAttempt.objects.get(id=attempt_id)
        
        camera_enabled = False
        microphone_enabled = False
        face_detected = False
        violations_count = 0
        
        try:
            session = ProctoringSession.objects.filter(attempt=attempt).first()
            if session:
                camera_enabled = session.camera_enabled
                microphone_enabled = session.microphone_enabled
                violations_count = ViolationLog.objects.filter(session=session).count()
                latest_face = FaceDetectionLog.objects.filter(session=session).order_by('-timestamp').first()
                if latest_face:
                    face_detected = latest_face.faces_detected > 0
        except Exception:
            pass
        
        activity_logs = ExamActivityLog.objects.filter(attempt=attempt).order_by('-timestamp')[:50]
        activities = [{
            'activity_type': log.activity_type,
            'description': log.description,
            'timestamp': log.timestamp.isoformat(),
            'metadata': log.metadata
        } for log in activity_logs]
        
        return {
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
            'camera_enabled': camera_enabled,
            'microphone_enabled': microphone_enabled,
            'face_detected': face_detected,
            'violations_count': violations_count,
            'activity_logs': activities,
        }
    
    @database_sync_to_async
    def get_activities_data(self, attempt_id):
        """Get activities data"""
        activities = ExamActivityLog.objects.filter(attempt_id=attempt_id).order_by('-timestamp')
        
        return [{
            'id': log.id,
            'activity_type': log.activity_type,
            'description': log.description,
            'metadata': log.metadata,
            'timestamp': log.timestamp.isoformat(),
            'ip_address': str(log.ip_address) if log.ip_address else None
        } for log in activities]

