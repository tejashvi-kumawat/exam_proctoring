# backend/exam_app/models.py
from django.db import models
from django.contrib.auth import get_user_model
from django.conf import settings
import random

# Get the user model
User = get_user_model()

class Subject(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)  # Make nullable
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class Exam(models.Model):
    title = models.CharField(max_length=200)
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, null=True, blank=True)  # Make nullable temporarily
    description = models.TextField(blank=True, null=True)  # Make nullable
    duration_minutes = models.IntegerField(default=60)
    total_marks = models.IntegerField(default=100)
    passing_marks = models.IntegerField(default=40)
    is_active = models.BooleanField(default=True)
    shuffle_questions = models.BooleanField(default=True)
    shuffle_options = models.BooleanField(default=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    start_time = models.DateTimeField(null=True, blank=True)
    end_time = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.title
    
class ExamAttempt(models.Model):
    STATUS_CHOICES = [
        ('STARTED', 'Started'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
        ('TERMINATED', 'Terminated'),
    ]
    
    # Change this line to use settings.AUTH_USER_MODEL
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE)
    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='STARTED')
    score = models.IntegerField(null=True, blank=True)
    total_questions = models.IntegerField()
    correct_answers = models.IntegerField(default=0)
    is_proctored = models.BooleanField(default=True)
    
    class Meta:
        unique_together = ['user', 'exam']

    def __str__(self):
        return f"{self.user.username} - {self.exam.title}"


# backend/exam_app/models.py (verify these models)
class Question(models.Model):
    QUESTION_TYPES = [
        ('MCQ', 'Multiple Choice'),
        ('TF', 'True/False'),
        ('SA', 'Short Answer'),
    ]
    
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name='questions')
    question_text = models.TextField()
    question_type = models.CharField(max_length=3, choices=QUESTION_TYPES, default='MCQ')
    marks = models.IntegerField(default=1)
    order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.exam.title} - Q{self.order}"

class Option(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='options')
    option_text = models.CharField(max_length=500)
    is_correct = models.BooleanField(default=False)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return self.option_text

class Answer(models.Model):
    attempt = models.ForeignKey(ExamAttempt, on_delete=models.CASCADE, related_name='answers')
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    selected_option = models.ForeignKey(Option, on_delete=models.CASCADE, null=True, blank=True)
    answer_text = models.TextField(blank=True)
    is_correct = models.BooleanField(default=False)
    answered_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['attempt', 'question']  # Prevent duplicate answers

    def save(self, *args, **kwargs):
        # Auto-calculate is_correct when saving
        if self.selected_option:
            self.is_correct = self.selected_option.is_correct
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.attempt.user.username} - {self.question.question_text[:50]}"

