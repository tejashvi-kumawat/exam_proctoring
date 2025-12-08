# backend/proctoring/consumers.py
import json
import base64
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import ProctoringSession, ViolationLog, FaceDetectionLog
from exam_app.models import ExamAttempt

# Optional imports for face detection
try:
    import cv2
    import numpy as np
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False
    cv2 = None
    np = None

class ProctoringConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]
        self.attempt_id = self.scope['url_route']['kwargs']['attempt_id']
        
        # Debug logging
        print(f"WebSocket connection attempt - User: {self.user}, Attempt ID: {self.attempt_id}, Anonymous: {self.user.is_anonymous}")
        
        if self.user.is_anonymous:
            print("WebSocket connection rejected: Anonymous user")
            await self.close(code=4001)  # Unauthorized
            return
        
        try:
            await self.accept()
            print(f"WebSocket connection accepted for user {self.user.id}, attempt {self.attempt_id}")
            
            # Initialize proctoring session
            await self.init_proctoring_session()
        except Exception as e:
            print(f"WebSocket connection error: {e}")
            await self.close(code=4000)  # Internal error

    async def disconnect(self, close_code):
        pass

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'face_detection':
                await self.handle_face_detection(data)
            elif message_type == 'audio_level':
                await self.handle_audio_monitoring(data)
            elif message_type == 'violation':
                await self.handle_violation(data)
            elif message_type == 'heartbeat':
                await self.send(text_data=json.dumps({'type': 'heartbeat_ack'}))
                
        except Exception as e:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': str(e)
            }))

    async def handle_face_detection(self, data):
        try:
            # Receive face detection data WITHOUT image processing
            # Frontend sends only face count and confidence, no image data
            faces_detected = data.get('faces_detected', 0)
            confidence = data.get('confidence', 0)
            
            # Log face detection (without image processing)
            await self.log_face_detection(faces_detected, confidence)
            
            # Check for violations based on face count
            if faces_detected == 0:
                violation = await self.log_violation('FACE_NOT_DETECTED', 'No face detected')
                # notify admins watching this attempt
                await self.channel_layer.group_send(
                    f'admin_attempt_{self.attempt_id}',
                    {
                        'type': 'attempt_update',
                        'data': {
                            'event': 'violation',
                            'violation': violation,
                            'attempt_id': int(self.attempt_id)
                        }
                    }
                )
            elif faces_detected > 1:
                violation = await self.log_violation('MULTIPLE_FACES', f'{faces_detected} faces detected')
                await self.channel_layer.group_send(
                    f'admin_attempt_{self.attempt_id}',
                    {
                        'type': 'attempt_update',
                        'data': {
                            'event': 'violation',
                            'violation': violation,
                            'attempt_id': int(self.attempt_id)
                        }
                    }
                )
            
            # Send acknowledgment back
            await self.send(text_data=json.dumps({
                'type': 'face_detection_result',
                'faces_detected': faces_detected,
                'confidence': confidence
            }))
            
        except Exception as e:
            print(f"Face detection error: {e}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': f'Face detection error: {str(e)}'
            }))

    async def handle_audio_monitoring(self, data):
        try:
            noise_level = data.get('level', 0)
            threshold = 0.7  # Adjust based on requirements
            
            threshold_exceeded = noise_level > threshold
            
            await self.log_audio_monitoring(noise_level, threshold_exceeded)
            
            if threshold_exceeded:
                violation = await self.log_violation('NOISE_DETECTED', f'Noise level: {noise_level}')
                await self.channel_layer.group_send(
                    f'admin_attempt_{self.attempt_id}',
                    {
                        'type': 'attempt_update',
                        'data': {
                            'event': 'violation',
                            'violation': violation,
                            'attempt_id': int(self.attempt_id)
                        }
                    }
                )
            
        except Exception as e:
            print(f"Audio monitoring error: {e}")

    async def handle_violation(self, data):
        violation_type = data.get('violation_type')
        description = data.get('description', '')
        violation = await self.log_violation(violation_type, description)
        # notify admins for this attempt
        await self.channel_layer.group_send(
            f'admin_attempt_{self.attempt_id}',
            {
                'type': 'attempt_update',
                'data': {
                    'event': 'violation',
                    'violation': violation,
                    'attempt_id': int(self.attempt_id)
                }
            }
        )

    @database_sync_to_async
    def init_proctoring_session(self):
        try:
            attempt = ExamAttempt.objects.get(id=self.attempt_id, user=self.user)
            session, created = ProctoringSession.objects.get_or_create(
                attempt=attempt,
                defaults={
                    'camera_enabled': True,
                    'microphone_enabled': True,
                    'face_detection_enabled': True,
                    'audio_monitoring_enabled': True
                }
            )
            self.session = session
        except ExamAttempt.DoesNotExist:
            raise Exception("Invalid exam attempt")

    @database_sync_to_async
    def log_face_detection(self, faces_count, confidence):
        FaceDetectionLog.objects.create(
            session=self.session,
            faces_detected=faces_count,
            confidence_score=confidence
        )

    @database_sync_to_async
    def log_audio_monitoring(self, noise_level, threshold_exceeded):
        from .models import AudioMonitoringLog
        AudioMonitoringLog.objects.create(
            session=self.session,
            noise_level=noise_level,
            threshold_exceeded=threshold_exceeded
        )

    @database_sync_to_async
    def log_violation(self, violation_type, description):
        severity_map = {
            'FACE_NOT_DETECTED': 'HIGH',
            'MULTIPLE_FACES': 'CRITICAL',
            'TAB_SWITCH': 'MEDIUM',
            'WINDOW_BLUR': 'MEDIUM',
            'COPY_PASTE': 'HIGH',
            'RIGHT_CLICK': 'LOW',
            'NOISE_DETECTED': 'MEDIUM',
        }
        
        v = ViolationLog.objects.create(
            session=self.session,
            violation_type=violation_type,
            description=description,
            severity=severity_map.get(violation_type, 'MEDIUM')
        )
        # return a serializable dict so async code can broadcast it
        return {
            'id': v.id,
            'violation_type': v.violation_type,
            'description': v.description,
            'severity': v.severity,
            'timestamp': v.timestamp.isoformat() if v.timestamp else None
        }
