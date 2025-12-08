# backend/exam_app/signals.py
"""
Django signals for sending WebSocket updates to admins
when activities occur during exams
"""
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.db import transaction
from django.db.models import Sum
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import ExamActivityLog, ExamAttempt, Question, Option, Answer


@receiver(post_save, sender=ExamActivityLog)
def notify_admin_activity(sender, instance, created, **kwargs):
    """Notify admins when activity is logged"""
    if created:
        channel_layer = get_channel_layer()
        if channel_layer:
            # Send to exam monitoring group
            exam_id = instance.attempt.exam.id
            attempt_id = instance.attempt.id
            
            activity_data = {
                'id': instance.id,
                'activity_type': instance.activity_type,
                'description': instance.description,
                'metadata': instance.metadata,
                'timestamp': instance.timestamp.isoformat(),
                'attempt_id': attempt_id,
                'user_name': instance.attempt.user.username,
            }
            
            # Notify exam monitoring group
            async_to_sync(channel_layer.group_send)(
                f'admin_exam_{exam_id}',
                {
                    'type': 'activity_update',
                    'data': activity_data
                }
            )
            
            # Notify attempt monitoring group
            async_to_sync(channel_layer.group_send)(
                f'admin_attempt_{attempt_id}',
                {
                    'type': 'activity_update',
                    'data': activity_data
                }
            )


@receiver(post_save, sender=ExamAttempt)
def notify_admin_attempt_update(sender, instance, created, **kwargs):
    """Notify admins when attempt status changes"""
    if not created:  # Only notify on updates
        channel_layer = get_channel_layer()
        if channel_layer:
            exam_id = instance.exam.id
            attempt_id = instance.id
            
            attempt_data = {
                'id': attempt_id,
                'status': instance.status,
                'score': instance.score,
                'percentage_score': instance.percentage_score,
                'correct_answers': instance.correct_answers,
                'wrong_answers': instance.wrong_answers,
                'user_name': instance.user.username,
            }
            
            # Notify exam monitoring group
            async_to_sync(channel_layer.group_send)(
                f'admin_exam_{exam_id}',
                {
                    'type': 'attempt_update',
                    'data': attempt_data
                }
            )


@receiver(post_save, sender=Option)
def update_answers_on_option_change(sender, instance, created, **kwargs):
    """Update all answers when option's is_correct status changes"""
    if not created:  # Only on updates
        question = instance.question
        # Check if this option is now correct
        if instance.is_correct:
            # Find all answers that selected this option
            answers_to_update = Answer.objects.filter(
                question=question,
                selected_option=instance
            )
            
            with transaction.atomic():
                for answer in answers_to_update:
                    # Recalculate marks based on new correct status
                    answer.is_correct = True
                    answer.marks_awarded = float(question.marks)
                    answer.save()
                    
                    # Recalculate attempt score
                    attempt = answer.attempt
                    total_marks = Answer.objects.filter(attempt=attempt).aggregate(
                        total=Sum('marks_awarded')
                    )['total'] or 0.0
                    attempt.score = float(total_marks)
                    attempt.save()
        
        # Check if any other option was previously correct and is now incorrect
        # This handles the case when admin changes correct answer
        if not instance.is_correct:
            # Find all answers that selected this option (now incorrect)
            answers_to_update = Answer.objects.filter(
                question=question,
                selected_option=instance,
                is_correct=True  # Was previously correct
            )
            
            with transaction.atomic():
                for answer in answers_to_update:
                    answer.is_correct = False
                    # Apply negative marking if enabled
                    attempt = answer.attempt
                    if attempt.exam.enable_negative_marking:
                        answer.marks_awarded = -float(question.marks) * attempt.exam.negative_mark_percentage
                    else:
                        answer.marks_awarded = 0.0
                    answer.save()
                    
                    # Recalculate attempt score
                    total_marks = Answer.objects.filter(attempt=attempt).aggregate(
                        total=models.Sum('marks_awarded')
                    )['total'] or 0.0
                    attempt.score = float(total_marks)
                    attempt.save()


@receiver(post_delete, sender=Option)
def update_answers_on_option_delete(sender, instance, **kwargs):
    """Update answers when an option is deleted"""
    question = instance.question
    # Find all answers that selected this deleted option
    answers_to_update = Answer.objects.filter(
        question=question,
        selected_option=instance
    )
    
    with transaction.atomic():
        for answer in answers_to_update:
            answer.selected_option = None
            answer.is_correct = False
            answer.marks_awarded = 0.0
            answer.save()
            
            # Recalculate attempt score
            attempt = answer.attempt
            total_marks = Answer.objects.filter(attempt=attempt).aggregate(
                total=models.Sum('marks_awarded')
            )['total'] or 0.0
            attempt.score = float(total_marks)
            attempt.save()

