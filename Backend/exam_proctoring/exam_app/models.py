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
    
    # Enhanced marking system
    enable_negative_marking = models.BooleanField(default=False)
    negative_mark_percentage = models.FloatField(default=0.25, help_text="Percentage of marks to deduct for wrong answer (e.g., 0.25 = 25%)")
    enable_partial_marking = models.BooleanField(default=False, help_text="Enable partial marks for partially correct answers")
    auto_calculate_total = models.BooleanField(default=True, help_text="Automatically calculate total marks from questions")
    metadata = models.JSONField(default=dict, blank=True, help_text="Additional data like retake requests, tags, etc.")
    
    def calculate_total_marks(self):
        """Calculate total marks from all questions"""
        return self.questions.aggregate(total=models.Sum('marks'))['total'] or 0
    
    def save(self, *args, **kwargs):
        # Save first to get primary key
        super().save(*args, **kwargs)
        
        # If auto_calculate_total is True, calculate total marks from questions
        # Only do this if exam has been saved (has primary key) and has questions
        if self.auto_calculate_total and self.pk:
            calculated_total = self.calculate_total_marks()
            if calculated_total > 0:
                # Update total_marks if calculated value is different
                if self.total_marks != calculated_total:
                    self.total_marks = calculated_total
                    # Save again to update total_marks
                    super().save(update_fields=['total_marks'], *args, **kwargs)

    def __str__(self):
        return self.title
    
class ExamAttempt(models.Model):
    STATUS_CHOICES = [
        ('STARTED', 'Started'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
        ('TERMINATED', 'Terminated'),
        ('PAUSED', 'Paused'),
    ]
    
    # Change this line to use settings.AUTH_USER_MODEL
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE)
    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='STARTED')
    score = models.FloatField(null=True, blank=True, help_text="Final score after evaluation")
    percentage_score = models.FloatField(null=True, blank=True, help_text="Percentage score")
    total_questions = models.IntegerField()
    correct_answers = models.IntegerField(default=0)
    wrong_answers = models.IntegerField(default=0)
    unanswered_questions = models.IntegerField(default=0)
    is_proctored = models.BooleanField(default=True)
    is_passed = models.BooleanField(null=True, blank=True, help_text="Whether candidate passed based on passing marks")
    evaluated_at = models.DateTimeField(null=True, blank=True)
    evaluation_notes = models.TextField(blank=True, null=True, help_text="Admin notes about the evaluation")
    results_ready = models.BooleanField(default=False, help_text="Whether all manual marking is complete and results are ready to show")
    
    class Meta:
        unique_together = ['user', 'exam']
        indexes = [
            models.Index(fields=['user', 'exam']),
            models.Index(fields=['status']),
            models.Index(fields=['exam', 'status']),
        ]

    def calculate_score(self):
        """Enhanced score calculation with negative marking support and manual marking for SA/TEXT/IMAGE_UPLOAD"""
        answers = self.answers.all().select_related('question', 'selected_option')
        total_score = 0.0
        correct_count = 0
        wrong_count = 0
        unanswered_count = 0
        
        for answer in answers:
            question = answer.question
            marks_awarded = 0.0
            
            # For SA, TEXT, IMAGE_UPLOAD - use manually awarded marks
            if question.question_type in ['SA', 'TEXT', 'IMAGE_UPLOAD']:
                if answer.marks_awarded is not None:
                    # Answer has been manually marked
                    marks_awarded = float(answer.marks_awarded)
                    if marks_awarded > 0:
                        correct_count += 1
                    else:
                        wrong_count += 1
                else:
                    # Answer not yet marked - don't count in score
                    unanswered_count += 1
                    continue
            else:
                # MCQ/TF - use automatic marking
                if answer.selected_option:
                    if answer.is_correct:
                        marks_awarded = float(question.marks)
                        correct_count += 1
                    else:
                        # Negative marking
                        if self.exam.enable_negative_marking:
                            marks_awarded = -float(question.marks) * self.exam.negative_mark_percentage
                        wrong_count += 1
                else:
                    unanswered_count += 1
            
            total_score += marks_awarded
        
        # Ensure score doesn't go negative
        total_score = max(0.0, total_score)
        
        # Calculate percentage
        total_possible = self.exam.total_marks
        percentage = (total_score / total_possible * 100) if total_possible > 0 else 0
        
        # Check if passed (only if all answers are marked)
        is_passed = percentage >= self.exam.passing_marks if total_possible > 0 else False
        
        return {
            'score': round(total_score, 2),
            'percentage': round(percentage, 2),
            'correct_answers': correct_count,
            'wrong_answers': wrong_count,
            'unanswered': unanswered_count,
            'is_passed': is_passed
        }

    def __str__(self):
        return f"{self.user.username} - {self.exam.title}"


# backend/exam_app/models.py (verify these models)
class Question(models.Model):
    QUESTION_TYPES = [
        ('MCQ', 'Multiple Choice'),
        ('TF', 'True/False'),
        ('SA', 'Short Answer'),
        ('TEXT', 'Text Answer'),
        ('IMAGE_UPLOAD', 'Image Upload Answer'),
    ]
    
    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name='questions')
    question_text = models.TextField()
    question_type = models.CharField(max_length=15, choices=QUESTION_TYPES, default='MCQ')
    question_image = models.ImageField(upload_to='questions/', blank=True, null=True, help_text="Image for the question")
    marks = models.IntegerField(default=1)
    order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    metadata = models.JSONField(default=dict, blank=True, help_text="Additional data like tags, difficulty, etc.")

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.exam.title} - Q{self.order}"

class Option(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='options')
    option_text = models.CharField(max_length=500)
    option_image = models.ImageField(upload_to='options/', blank=True, null=True, help_text="Image for the option")
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
    marks_awarded = models.FloatField(null=True, blank=True, help_text="Marks awarded for this answer")
    answered_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    time_taken_seconds = models.IntegerField(null=True, blank=True, help_text="Time taken to answer in seconds")
    
    # Solution fields (optional, added by admin when releasing results)
    solution_text = models.TextField(blank=True, null=True, help_text="Correct solution explanation")
    is_manually_marked = models.BooleanField(default=False, help_text="Whether this answer was manually marked by admin")
    needs_manual_marking = models.BooleanField(default=False, help_text="Whether this question type requires manual marking")
    
    class Meta:
        unique_together = ['attempt', 'question']
        indexes = [
            models.Index(fields=['attempt', 'question']),
            models.Index(fields=['is_correct']),
        ]

    def save(self, *args, **kwargs):
        # Check if admin is manually setting marks (via update_fields)
        # If update_fields includes marks_awarded, it means admin is explicitly setting it
        update_fields = kwargs.get('update_fields', None)
        preserve_manual_marks = update_fields and 'marks_awarded' in update_fields
        
        # Also preserve marks for manual marking question types
        if not preserve_manual_marks:
            manual_marking_types = ['SA', 'TEXT', 'IMAGE_UPLOAD']
            if (self.marks_awarded is not None and 
                hasattr(self, 'question') and 
                self.question and 
                self.question.question_type in manual_marking_types):
                # For manual marking types, preserve marks if they're being set
                preserve_manual_marks = True
        
        # Auto-calculate is_correct when saving (but don't override if manually set)
        if self.selected_option:
            # Only auto-set is_correct if not already explicitly set
            if not hasattr(self, '_is_correct_manually_set') or not self._is_correct_manually_set:
                self.is_correct = self.selected_option.is_correct
            
            # Only auto-calculate marks if not manually set by admin
            if not preserve_manual_marks:
                # Calculate marks awarded (only if attempt and exam exist and are saved)
                try:
                    if self.pk and hasattr(self, 'attempt_id') and self.attempt_id:
                        attempt = self.attempt
                        if hasattr(attempt, 'exam') and attempt.exam:
                            if self.is_correct:
                                self.marks_awarded = float(self.question.marks)
                            elif attempt.exam.enable_negative_marking:
                                self.marks_awarded = -float(self.question.marks) * attempt.exam.negative_mark_percentage
                            else:
                                self.marks_awarded = 0.0
                        else:
                            # Default calculation without exam context
                            self.marks_awarded = float(self.question.marks) if self.is_correct else 0.0
                    else:
                        # Default calculation for new answers
                        self.marks_awarded = float(self.question.marks) if self.is_correct else 0.0
                except Exception:
                    # Fallback calculation
                    self.marks_awarded = float(self.question.marks) if self.is_correct else 0.0
        else:
            # For non-option questions, only set marks_awarded to 0 if not manually set
            if not preserve_manual_marks:
                self.marks_awarded = 0.0
        
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.attempt.user.username} - {self.question.question_text[:50]}"


class AnswerImage(models.Model):
    """Store uploaded images for answers (max 3 images per answer, 10MB each)"""
    answer = models.ForeignKey(Answer, on_delete=models.CASCADE, related_name='answer_images')
    image = models.ImageField(upload_to='answers/', help_text="Answer image (max 10MB)")
    order = models.IntegerField(default=0, help_text="Order of image (0-2)")
    uploaded_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['order']
        unique_together = ['answer', 'order']
    
    def __str__(self):
        return f"Image {self.order + 1} for Answer {self.answer.id}"


class AnswerAttachment(models.Model):
    """Store uploaded attachments (documents, files) for textual answers"""
    answer = models.ForeignKey(Answer, on_delete=models.CASCADE, related_name='attachments')
    file = models.FileField(upload_to='answer_attachments/', help_text="Answer attachment (PDF, DOC, DOCX, etc.)")
    file_name = models.CharField(max_length=255, blank=True)
    file_type = models.CharField(max_length=50, blank=True, help_text="e.g., pdf, doc, docx, txt, xlsx")
    file_size = models.IntegerField(blank=True, null=True, help_text="File size in bytes")
    uploaded_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-uploaded_at']
    
    def __str__(self):
        return f"Attachment for Answer {self.answer.id} - {self.file_name}"


class SolutionAttachment(models.Model):
    """Store solution attachments (documents, images, etc.) for answers"""
    answer = models.ForeignKey(Answer, on_delete=models.CASCADE, related_name='solution_attachments')
    file = models.FileField(upload_to='solutions/', help_text="Solution attachment file (PDF, DOC, etc.)")
    file_name = models.CharField(max_length=255, blank=True)
    file_type = models.CharField(max_length=50, blank=True, help_text="e.g., pdf, doc, docx, jpg, png")
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, help_text="Admin who uploaded this")
    
    class Meta:
        ordering = ['-uploaded_at']
    
    def __str__(self):
        return f"Solution Attachment for Answer {self.answer.id}"


# Activity Logging Model for Admin Monitoring
class ExamActivityLog(models.Model):
    """Track all activities during exam for admin monitoring"""
    ACTIVITY_TYPES = [
        ('ANSWER_SUBMITTED', 'Answer Submitted'),
        ('ANSWER_CHANGED', 'Answer Changed'),
        ('QUESTION_VIEWED', 'Question Viewed'),
        ('EXAM_STARTED', 'Exam Started'),
        ('EXAM_SUBMITTED', 'Exam Submitted'),
        ('TAB_SWITCHED', 'Tab Switched'),
        ('WINDOW_FOCUS_LOST', 'Window Focus Lost'),
        ('WINDOW_FOCUS_GAINED', 'Window Focus Gained'),
        ('COPY_ATTEMPTED', 'Copy Attempted'),
        ('PASTE_ATTEMPTED', 'Paste Attempted'),
        ('RIGHT_CLICK', 'Right Click Detected'),
        ('KEYBOARD_SHORTCUT', 'Keyboard Shortcut Used'),
    ]
    
    attempt = models.ForeignKey(ExamAttempt, on_delete=models.CASCADE, related_name='activity_logs')
    activity_type = models.CharField(max_length=30, choices=ACTIVITY_TYPES)
    description = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True, help_text="Additional data about the activity")
    timestamp = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    
    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['attempt', 'timestamp']),
            models.Index(fields=['activity_type', 'timestamp']),
        ]
    
    def __str__(self):
        return f"{self.attempt.user.username} - {self.activity_type} at {self.timestamp}"

