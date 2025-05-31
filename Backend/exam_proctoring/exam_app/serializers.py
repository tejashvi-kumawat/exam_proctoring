# backend/exam_app/serializers.py
from rest_framework import serializers
from .models import Subject, Exam, Question, Option, ExamAttempt, Answer
import random

class OptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Option
        fields = ['id', 'option_text', 'order']


class QuestionSerializer(serializers.ModelSerializer):
    options = OptionSerializer(many=True, read_only=True)
    
    class Meta:
        model = Question
        fields = ['id', 'question_text', 'question_type', 'marks', 'order', 'options', 'exam']  # Add exam field
    
    def validate(self, data):
        """Custom validation for questions"""
        if data.get('marks', 0) <= 0:
            raise serializers.ValidationError("Marks must be greater than 0")
        return data


# backend/exam_app/serializers.py (update ExamSerializer)
class ExamSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    
    class Meta:
        model = Exam
        fields = ['id', 'title', 'subject', 'subject_name', 'description', 'duration_minutes', 
                 'total_marks', 'passing_marks', 'start_time', 'end_time', 'questions',
                 'shuffle_questions', 'shuffle_options', 'is_active']  # Added missing fields
    
    def validate(self, data):
        """Custom validation"""
        if data.get('passing_marks', 0) >= data.get('total_marks', 0):
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
        
        # Shuffle questions if enabled
        if obj.shuffle_questions:
            random.shuffle(questions)
        
        # Serialize questions with shuffled options
        serialized_questions = []
        for question in questions:
            question_data = QuestionSerializer(question).data
            
            # Shuffle options if enabled
            if obj.shuffle_options and question.options.exists():
                options = list(question.options.all())
                random.shuffle(options)
                question_data['options'] = OptionSerializer(options, many=True).data
            
            serialized_questions.append(question_data)
        
        return serialized_questions

class ExamAttemptSerializer(serializers.ModelSerializer):
    exam_title = serializers.CharField(source='exam.title', read_only=True)
    user_name = serializers.CharField(source='user.username', read_only=True)
    
    class Meta:
        model = ExamAttempt
        fields = ['id', 'exam_title', 'user_name', 'start_time', 'end_time', 
                 'status', 'score', 'total_questions', 'correct_answers']

# backend/exam_app/serializers.py (update AnswerSerializer)
class AnswerSerializer(serializers.ModelSerializer):
    question_text = serializers.CharField(source='question.question_text', read_only=True)
    question_marks = serializers.IntegerField(source='question.marks', read_only=True)
    selected_option_text = serializers.CharField(source='selected_option.option_text', read_only=True)
    
    class Meta:
        model = Answer
        fields = [
            'id', 'question', 'question_text', 'question_marks',
            'selected_option', 'selected_option_text', 'answer_text', 
            'is_correct', 'answered_at'
        ]


class SubmitAnswerSerializer(serializers.Serializer):
    question_id = serializers.IntegerField()
    selected_option_id = serializers.IntegerField(required=False)
    answer_text = serializers.CharField(required=False, allow_blank=True)

# backend/exam_app/serializers.py (add this to your existing file)

class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ['id', 'name', 'description', 'created_at']
