# backend/proctoring/consumers.py
import json
import base64
import cv2
import numpy as np
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import ProctoringSession, ViolationLog, FaceDetectionLog
from exam_app.models import ExamAttempt

class ProctoringConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]
        self.attempt_id = self.scope['url_route']['kwargs']['attempt_id']
        
        if self.user.is_anonymous:
            await self.close()
            return
        
        await self.accept()
        
        # Initialize proctoring session
        await self.init_proctoring_session()

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
            # Decode base64 image
            image_data = data.get('image', '').split(',')[1]
            image_bytes = base64.b64decode(image_data)
            
            # Convert to OpenCV format
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            # Face detection using OpenCV
            face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, 1.1, 4)
            
            faces_count = len(faces)
            confidence = 0.8 if faces_count == 1 else 0.3
            
            # Log face detection
            await self.log_face_detection(faces_count, confidence)
            
            # Check for violations
            if faces_count == 0:
                await self.log_violation('FACE_NOT_DETECTED', 'No face detected in frame')
            elif faces_count > 1:
                await self.log_violation('MULTIPLE_FACES', f'{faces_count} faces detected')
            
            await self.send(text_data=json.dumps({
                'type': 'face_detection_result',
                'faces_detected': faces_count,
                'confidence': confidence
            }))
            
        except Exception as e:
            print(f"Face detection error: {e}")

    async def handle_audio_monitoring(self, data):
        try:
            noise_level = data.get('level', 0)
            threshold = 0.7  # Adjust based on requirements
            
            threshold_exceeded = noise_level > threshold
            
            await self.log_audio_monitoring(noise_level, threshold_exceeded)
            
            if threshold_exceeded:
                await self.log_violation('NOISE_DETECTED', f'Noise level: {noise_level}')
            
        except Exception as e:
            print(f"Audio monitoring error: {e}")

    async def handle_violation(self, data):
        violation_type = data.get('violation_type')
        description = data.get('description', '')
        
        await self.log_violation(violation_type, description)

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
        
        ViolationLog.objects.create(
            session=self.session,
            violation_type=violation_type,
            description=description,
            severity=severity_map.get(violation_type, 'MEDIUM')
        )
