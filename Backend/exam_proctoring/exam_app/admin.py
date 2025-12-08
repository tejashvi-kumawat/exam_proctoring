# backend/exam_app/admin.py
from django.contrib import admin
from django.utils import timezone
from django.contrib import messages
from .models import Subject, Exam, Question, Option, ExamAttempt, Answer, ExamActivityLog

class OptionInline(admin.TabularInline):
    model = Option
    extra = 4
    fields = ('option_text', 'is_correct', 'order')

class QuestionInline(admin.StackedInline):
    model = Question
    extra = 0
    fields = ('question_text', 'question_type', 'marks', 'order')

@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ('name', 'created_at')
    search_fields = ('name',)
    ordering = ('name',)

@admin.register(Exam)
class ExamAdmin(admin.ModelAdmin):
    list_display = ('title', 'subject', 'duration_minutes', 'total_marks', 'is_active', 'created_by', 'start_time')
    list_filter = ('subject', 'is_active', 'created_at', 'start_time')
    search_fields = ('title', 'description')
    ordering = ('-created_at',)
    inlines = [QuestionInline]
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('title', 'subject', 'description', 'created_by')
        }),
        ('Exam Settings', {
            'fields': ('duration_minutes', 'total_marks', 'passing_marks', 'is_active')
        }),
        ('Question Settings', {
            'fields': ('shuffle_questions', 'shuffle_options')
        }),
        ('Schedule', {
            'fields': ('start_time', 'end_time')
        }),
    )
    
    def save_model(self, request, obj, form, change):
        if not change:  # If creating new exam
            obj.created_by = request.user
        super().save_model(request, obj, form, change)

@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ('question_text_short', 'exam', 'question_type', 'marks', 'order')
    list_filter = ('exam', 'question_type', 'marks')
    search_fields = ('question_text', 'exam__title')
    ordering = ('exam', 'order')
    inlines = [OptionInline]
    
    def question_text_short(self, obj):
        return obj.question_text[:50] + "..." if len(obj.question_text) > 50 else obj.question_text
    question_text_short.short_description = 'Question'

@admin.register(Option)
class OptionAdmin(admin.ModelAdmin):
    list_display = ('option_text_short', 'question', 'is_correct', 'order')
    list_filter = ('is_correct', 'question__exam')
    search_fields = ('option_text', 'question__question_text')
    ordering = ('question', 'order')
    
    def option_text_short(self, obj):
        return obj.option_text[:30] + "..." if len(obj.option_text) > 30 else obj.option_text
    option_text_short.short_description = 'Option'

@admin.register(ExamAttempt)
class ExamAttemptAdmin(admin.ModelAdmin):
    list_display = ('user', 'exam', 'status', 'score', 'percentage_score', 'results_ready_badge', 'correct_answers', 'total_questions', 'start_time')
    list_filter = ('status', 'exam', 'start_time', 'is_proctored', 'results_ready')
    search_fields = ('user__username', 'exam__title')
    ordering = ('-start_time',)
    readonly_fields = ('start_time', 'end_time', 'evaluated_at')
    actions = ['release_results_action', 'unrelease_results_action']
    
    fieldsets = (
        ('Attempt Information', {
            'fields': ('user', 'exam', 'status', 'is_proctored')
        }),
        ('Timing', {
            'fields': ('start_time', 'end_time', 'evaluated_at')
        }),
        ('Results', {
            'fields': ('score', 'percentage_score', 'correct_answers', 'wrong_answers', 'total_questions', 'is_passed', 'results_ready')
        }),
    )
    
    def results_ready_badge(self, obj):
        if obj.status == 'COMPLETED':
            if obj.results_ready:
                return '<span style="background: #10b981; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;">✓ Released</span>'
            else:
                return '<span style="background: #f59e0b; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;">⏳ Pending</span>'
        return '<span style="color: #6b7280;">-</span>'
    results_ready_badge.short_description = 'Results Status'
    results_ready_badge.allow_tags = True
    
    def release_results_action(self, request, queryset):
        """Admin action to release results for selected attempts"""
        count = 0
        for attempt in queryset:
            if attempt.status == 'COMPLETED' and not attempt.results_ready:
                attempt.results_ready = True
                attempt.save()
                
                # Log activity
                ExamActivityLog.objects.create(
                    attempt=attempt,
                    activity_type='RESULTS_RELEASED',
                    description=f'Admin released results via Django admin',
                    metadata={
                        'released_by': request.user.username,
                        'released_at': timezone.now().isoformat()
                    }
                )
                count += 1
        
        if count > 0:
            self.message_user(request, f'Successfully released results for {count} attempt(s).', messages.SUCCESS)
        else:
            self.message_user(request, 'No eligible attempts selected. Only completed attempts with unreleased results can be released.', messages.WARNING)
    release_results_action.short_description = 'Release Results for Selected Attempts'
    
    def unrelease_results_action(self, request, queryset):
        """Admin action to unrelease results for selected attempts"""
        count = 0
        for attempt in queryset:
            if attempt.results_ready:
                attempt.results_ready = False
                attempt.save()
                count += 1
        
        if count > 0:
            self.message_user(request, f'Successfully unreleased results for {count} attempt(s).', messages.SUCCESS)
        else:
            self.message_user(request, 'No attempts with released results selected.', messages.WARNING)
    unrelease_results_action.short_description = 'Unrelease Results for Selected Attempts'

@admin.register(Answer)
class AnswerAdmin(admin.ModelAdmin):
    list_display = ('attempt', 'question_short', 'question_type', 'selected_option_short', 'marks_awarded', 'is_correct', 'answered_at')
    list_filter = ('is_correct', 'attempt__exam', 'answered_at', 'question__question_type')
    search_fields = ('attempt__user__username', 'question__question_text', 'answer_text')
    ordering = ('-answered_at',)
    readonly_fields = ('answered_at',)
    list_editable = ('marks_awarded', 'is_correct')  # Allow quick editing of marks
    
    fieldsets = (
        ('Answer Information', {
            'fields': ('attempt', 'question', 'answered_at')
        }),
        ('Answer Content', {
            'fields': ('selected_option', 'answer_text', 'answer_images')
        }),
        ('Grading', {
            'fields': ('marks_awarded', 'is_correct')
        }),
    )
    
    def question_short(self, obj):
        return obj.question.question_text[:30] + "..." if len(obj.question.question_text) > 30 else obj.question.question_text
    question_short.short_description = 'Question'
    
    def question_type(self, obj):
        return obj.question.question_type
    question_type.short_description = 'Type'
    
    def selected_option_short(self, obj):
        if obj.selected_option:
            return obj.selected_option.option_text[:30] + "..." if len(obj.selected_option.option_text) > 30 else obj.selected_option.option_text
        if obj.answer_text:
            return obj.answer_text[:30] + "..." if len(obj.answer_text) > 30 else obj.answer_text
        if obj.answer_images.exists():
            return f"[{obj.answer_images.count()} image(s)]"
        return "Not answered"
    selected_option_short.short_description = 'Answer'
