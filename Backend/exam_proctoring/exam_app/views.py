# backend/exam_app/views.py
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .models import Exam, ExamAttempt, Question, Option, Answer
from .serializers import (
    ExamSerializer, ShuffledExamSerializer, ExamAttemptSerializer,
    SubmitAnswerSerializer, AnswerSerializer
)

# backend/exam_app/views.py (update ExamListView)
class ExamListView(generics.ListAPIView):
    serializer_class = ExamSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        try:
            now = timezone.now()
            
            # More lenient filtering - show exams that are active and not ended
            exams = Exam.objects.filter(
                is_active=True,
                end_time__gte=now  # Only check that exam hasn't ended
            ).select_related('subject').prefetch_related('questions__options')
            
            print(f"Current time: {now}")
            print(f"Total exams in DB: {Exam.objects.count()}")
            print(f"Active exams (not ended): {exams.count()}")
            
            for exam in exams:
                print(f"Exam: {exam.title}")
                print(f"  - Created by: {exam.created_by}")
                print(f"  - Start: {exam.start_time}")
                print(f"  - End: {exam.end_time}")
                print(f"  - Is Active: {exam.is_active}")
                print(f"  - Questions: {exam.questions.count()}")
                print(f"  - Available: {exam.start_time <= now <= exam.end_time}")
            
            return exams
        except Exception as e:
            print(f"Error in ExamListView: {e}")
            import traceback
            traceback.print_exc()
            return Exam.objects.none()
    
    def list(self, request, *args, **kwargs):
        try:
            queryset = self.get_queryset()
            serializer = self.get_serializer(queryset, many=True)
            
            print(f"Serialized {len(serializer.data)} exams")
            for exam_data in serializer.data:
                print(f"Returning exam: {exam_data['title']} - Questions: {len(exam_data.get('questions', []))}")
            
            return Response(serializer.data)
        except Exception as e:
            print(f"Error in ExamListView.list: {e}")
            import traceback
            traceback.print_exc()
            return Response([], status=status.HTTP_200_OK)



class ExamDetailView(generics.RetrieveAPIView):
    serializer_class = ShuffledExamSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return Exam.objects.filter(is_active=True)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def start_exam(request, exam_id):
    exam = get_object_or_404(Exam, id=exam_id, is_active=True)
    
    # Check if user already has an attempt
    existing_attempt = ExamAttempt.objects.filter(
        user=request.user, 
        exam=exam
    ).first()
    
    if existing_attempt:
        if existing_attempt.status == 'COMPLETED':
            return Response({
                'error': 'You have already completed this exam'
            }, status=status.HTTP_400_BAD_REQUEST)
        else:
            # Resume existing attempt
            serializer = ExamAttemptSerializer(existing_attempt)
            return Response(serializer.data)
    
    # Create new attempt
    attempt = ExamAttempt.objects.create(
        user=request.user,
        exam=exam,
        total_questions=exam.questions.count(),
        status='IN_PROGRESS'
    )
    
    serializer = ExamAttemptSerializer(attempt)
    return Response(serializer.data, status=status.HTTP_201_CREATED)

# backend/exam_app/views.py (update submit_answer function)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def submit_answer(request, attempt_id):
    attempt = get_object_or_404(
        ExamAttempt, 
        id=attempt_id, 
        user=request.user,
        status='IN_PROGRESS'
    )
    
    serializer = SubmitAnswerSerializer(data=request.data)
    if serializer.is_valid():
        question_id = serializer.validated_data['question_id']
        selected_option_id = serializer.validated_data.get('selected_option_id')
        answer_text = serializer.validated_data.get('answer_text', '')
        
        question = get_object_or_404(Question, id=question_id, exam=attempt.exam)
        
        # Get or create answer
        answer, created = Answer.objects.get_or_create(
            attempt=attempt,
            question=question,
            defaults={
                'selected_option_id': selected_option_id,
                'answer_text': answer_text
            }
        )
        
        if not created:
            # Update existing answer
            answer.selected_option_id = selected_option_id
            answer.answer_text = answer_text
            answer.save()  # This will trigger the auto-calculation of is_correct
        
        print(f"Answer saved: Question {question_id}, Option {selected_option_id}, Correct: {answer.is_correct}")
        
        return Response({
            'message': 'Answer submitted successfully',
            'is_correct': answer.is_correct
        })
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# backend/exam_app/views.py (update submit_exam function)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def submit_exam(request, attempt_id):
    attempt = get_object_or_404(
        ExamAttempt, 
        id=attempt_id, 
        user=request.user,
        status='IN_PROGRESS'
    )
    
    # Calculate score properly
    answers = Answer.objects.filter(attempt=attempt).select_related('question', 'selected_option')
    
    correct_answers_count = 0
    total_score = 0
    
    for answer in answers:
        if answer.is_correct:
            correct_answers_count += 1
            total_score += answer.question.marks
    
    # Update attempt
    attempt.status = 'COMPLETED'
    attempt.end_time = timezone.now()
    attempt.correct_answers = correct_answers_count
    attempt.score = total_score
    attempt.save()
    
    print(f"Exam submitted: {correct_answers_count} correct, {total_score} total score")
    
    serializer = ExamAttemptSerializer(attempt)
    return Response(serializer.data)


# backend/exam_app/views.py (update exam_results function)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def exam_results(request, attempt_id):
    attempt = get_object_or_404(
        ExamAttempt, 
        id=attempt_id, 
        user=request.user,
        status='COMPLETED'
    )
    
    # Get answers with all related data
    answers = Answer.objects.filter(attempt=attempt).select_related(
        'question', 'selected_option'
    ).prefetch_related('question__options')
    
    # Prepare answer data with question and option details
    answer_data = []
    for answer in answers:
        # Get all options for the question
        question_options = list(answer.question.options.all())
        
        # Find the correct option
        correct_option = next((opt for opt in question_options if opt.is_correct), None)
        
        answer_info = {
            'id': answer.id,
            'question': {
                'id': answer.question.id,
                'question_text': answer.question.question_text,
                'question_type': answer.question.question_type,
                'marks': answer.question.marks,
                'options': [
                    {
                        'id': opt.id,
                        'option_text': opt.option_text,
                        'is_correct': opt.is_correct,
                        'order': opt.order
                    } for opt in question_options
                ]
            },
            'selected_option': {
                'id': answer.selected_option.id,
                'option_text': answer.selected_option.option_text,
                'is_correct': answer.selected_option.is_correct
            } if answer.selected_option else None,
            'answer_text': answer.answer_text,
            'is_correct': answer.is_correct,
            'answered_at': answer.answered_at
        }
        answer_data.append(answer_info)
    
    # Prepare attempt data with exam details
    attempt_data = {
        'id': attempt.id,
        'exam_title': attempt.exam.title,
        'user_name': attempt.user.username,
        'start_time': attempt.start_time,
        'end_time': attempt.end_time,
        'status': attempt.status,
        'score': attempt.score,
        'correct_answers': attempt.correct_answers,
        'total_questions': attempt.total_questions,
        'exam': {
            'id': attempt.exam.id,
            'title': attempt.exam.title,
            'total_marks': attempt.exam.total_marks,
            'passing_marks': attempt.exam.passing_marks,
            'duration_minutes': attempt.exam.duration_minutes
        }
    }
    
    return Response({
        'attempt': attempt_data,
        'answers': answer_data
    })
