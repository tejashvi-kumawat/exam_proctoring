# backend/exam_app/serializers.py
from rest_framework import serializers
from .models import Subject, Exam, Question, Option, ExamAttempt, Answer, AnswerImage
import random

class OptionSerializer(serializers.ModelSerializer):
    option_image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Option
        fields = ['id', 'option_text', 'option_image', 'option_image_url', 'order', 'is_correct']
    
    def get_option_image_url(self, obj):
        if obj.option_image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.option_image.url)
            return obj.option_image.url
        return None


class QuestionSerializer(serializers.ModelSerializer):
    options = OptionSerializer(many=True, read_only=True, context={'request': None})
    question_image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Question
        fields = ['id', 'question_text', 'question_type', 'question_image', 'question_image_url', 'marks', 'order', 'options', 'exam']
    
    def get_question_image_url(self, obj):
        if obj.question_image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.question_image.url)
            return obj.question_image.url
        return None
    
    def to_representation(self, instance):
        representation = super().to_representation(instance)
        # Pass request context to nested serializers
        if 'options' in representation and instance.options.exists():
            representation['options'] = OptionSerializer(
                instance.options.all(), 
                many=True, 
                context=self.context
            ).data
        return representation
    
    def validate(self, data):
        """Custom validation for questions"""
        if data.get('marks', 0) <= 0:
            raise serializers.ValidationError("Marks must be greater than 0")
        return data


# backend/exam_app/serializers.py (update ExamSerializer)
class ExamSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    questions_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Exam
        fields = [
            'id', 'title', 'subject', 'subject_name', 'description', 
            'duration_minutes', 'total_marks', 'passing_marks', 
            'start_time', 'end_time', 'questions', 'questions_count',
            'shuffle_questions', 'shuffle_options', 'is_active', 'created_at',
            'enable_negative_marking', 'negative_mark_percentage', 
            'enable_partial_marking', 'auto_calculate_total'
        ]
    
    def get_questions_count(self, obj):
        return obj.questions.count()
    
    def validate(self, data):
        # Only validate passing_marks if auto_calculate_total is False
        auto_calculate = data.get('auto_calculate_total', True)
        if not auto_calculate:
            total_marks = data.get('total_marks', 0)
            passing_marks = data.get('passing_marks', 0)
            if total_marks > 0 and passing_marks >= total_marks:
                raise serializers.ValidationError("Passing marks must be less than total marks")
        
        if data.get('end_time') and data.get('start_time'):
            if data['end_time'] <= data['start_time']:
                raise serializers.ValidationError("End time must be after start time")
        
        return data



class ShuffledExamSerializer(serializers.ModelSerializer):
    questions = serializers.SerializerMethodField()
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    
    class Meta:
        model = Exam
        fields = ['id', 'title', 'subject_name', 'description', 'duration_minutes', 
                 'total_marks', 'passing_marks', 'start_time', 'end_time', 'questions']
    
    def get_questions(self, obj):
        questions = list(obj.questions.all())
        request = self.context.get('request')
        
        # Shuffle questions if enabled
        if obj.shuffle_questions:
            random.shuffle(questions)
        
        # Serialize questions with shuffled options
        serialized_questions = []
        for question in questions:
            question_data = QuestionSerializer(question, context={'request': request}).data
            
            # Shuffle options if enabled
            if obj.shuffle_options and question.options.exists():
                options = list(question.options.all())
                random.shuffle(options)
                question_data['options'] = OptionSerializer(options, many=True, context={'request': request}).data
            
            serialized_questions.append(question_data)
        
        return serialized_questions

class ExamAttemptSerializer(serializers.ModelSerializer):
    exam_title = serializers.CharField(source='exam.title', read_only=True)
    user_name = serializers.CharField(source='user.username', read_only=True)
    total_marks = serializers.IntegerField(source='exam.total_marks', read_only=True)
    user_email = serializers.EmailField(source='user.email', read_only=True)
    
    class Meta:
        model = ExamAttempt
        fields = ['id', 'exam_title', 'user_name', 'user_email', 'start_time', 'end_time', 
                 'status', 'score', 'percentage_score', 'total_questions', 'total_marks',
                 'correct_answers', 'wrong_answers', 'unanswered_questions', 
                 'is_passed', 'evaluated_at', 'results_ready']

class AnswerImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = AnswerImage
        fields = ['id', 'image', 'image_url', 'order', 'uploaded_at']
    
    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None

# backend/exam_app/serializers.py (update AnswerSerializer)
class AnswerSerializer(serializers.ModelSerializer):
    question_text = serializers.CharField(source='question.question_text', read_only=True)
    question_marks = serializers.IntegerField(source='question.marks', read_only=True)
    selected_option_text = serializers.CharField(source='selected_option.option_text', read_only=True)
    answer_images = AnswerImageSerializer(many=True, read_only=True)
    solution_attachments = serializers.SerializerMethodField()
    attachments = serializers.SerializerMethodField()
    
    class Meta:
        model = Answer
        fields = [
            'id', 'question', 'question_text', 'question_marks',
            'selected_option', 'selected_option_text', 'answer_text', 
            'answer_images', 'is_correct', 'marks_awarded', 'answered_at', 'updated_at',
            'time_taken_seconds', 'solution_text', 'solution_attachments', 'is_manually_marked', 
            'needs_manual_marking', 'attachments'
        ]
    
    def get_solution_attachments(self, obj):
        attachments = obj.solution_attachments.all()
        return [{
            'id': att.id,
            'file_name': att.file_name,
            'file_type': att.file_type,
            'file_url': att.file.url if att.file else None,
            'uploaded_at': att.uploaded_at
        } for att in attachments]
    
    def get_attachments(self, obj):
        attachments = obj.attachments.all()
        return [{
            'id': att.id,
            'file_name': att.file_name,
            'file_type': att.file_type,
            'file_url': att.file.url if att.file else None,
            'file_size': att.file_size,
            'uploaded_at': att.uploaded_at
        } for att in attachments]


class FlexibleIntegerField(serializers.Field):
    """A field that accepts integers, arrays, strings, or None"""
    def __init__(self, **kwargs):
        kwargs['required'] = kwargs.get('required', False)
        kwargs['allow_null'] = kwargs.get('allow_null', True)
        super().__init__(**kwargs)
    
    def to_internal_value(self, data):
        if data is None:
            return None
        
        # If it's already an integer, return it
        if isinstance(data, int):
            return data
        
        # If it's a list/array, take the first element
        if isinstance(data, list):
            if len(data) > 0:
                try:
                    return int(data[0]) if data[0] else None
                except (ValueError, TypeError):
                    return None
            return None
        
        # If it's a string, try to convert
        if isinstance(data, str):
            if data.lower() in ['null', 'none', '']:
                return None
            try:
                return int(data)
            except (ValueError, TypeError):
                return None
        
        # Try to convert to int
        try:
            return int(data)
        except (ValueError, TypeError):
            return None
    
    def to_representation(self, value):
        return value


class SubmitAnswerSerializer(serializers.Serializer):
    question_id = serializers.IntegerField()
    selected_option_id = FlexibleIntegerField(required=False, allow_null=True)
    answer_text = serializers.CharField(required=False, allow_blank=True)
    time_taken_seconds = serializers.IntegerField(required=False, allow_null=True)
    # Note: Images will be handled via multipart/form-data in the view

# backend/exam_app/serializers.py (add this to your existing file)

class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ['id', 'name', 'description', 'created_at']
