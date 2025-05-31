# backend/exam_app/admin.py
from django.contrib import admin
from .models import Subject, Exam, Question, Option, ExamAttempt, Answer

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
    list_display = ('user', 'exam', 'status', 'score', 'correct_answers', 'total_questions', 'start_time')
    list_filter = ('status', 'exam', 'start_time', 'is_proctored')
    search_fields = ('user__username', 'exam__title')
    ordering = ('-start_time',)
    readonly_fields = ('start_time', 'end_time')
    
    fieldsets = (
        ('Attempt Information', {
            'fields': ('user', 'exam', 'status', 'is_proctored')
        }),
        ('Timing', {
            'fields': ('start_time', 'end_time')
        }),
        ('Results', {
            'fields': ('score', 'correct_answers', 'total_questions')
        }),
    )

@admin.register(Answer)
class AnswerAdmin(admin.ModelAdmin):
    list_display = ('attempt', 'question_short', 'selected_option_short', 'is_correct', 'answered_at')
    list_filter = ('is_correct', 'attempt__exam', 'answered_at')
    search_fields = ('attempt__user__username', 'question__question_text')
    ordering = ('-answered_at',)
    
    def question_short(self, obj):
        return obj.question.question_text[:30] + "..." if len(obj.question.question_text) > 30 else obj.question.question_text
    question_short.short_description = 'Question'
    
    def selected_option_short(self, obj):
        if obj.selected_option:
            return obj.selected_option.option_text[:30] + "..." if len(obj.selected_option.option_text) > 30 else obj.selected_option.option_text
        return obj.answer_text[:30] + "..." if obj.answer_text and len(obj.answer_text) > 30 else obj.answer_text
    selected_option_short.short_description = 'Answer'
