# backend/exam_app/urls.py (add missing URLs)
from django.urls import path
from . import views, admin_views

urlpatterns = [
    # Student URLs
    path('exams/', views.ExamListView.as_view(), name='exam-list'),
    path('exams/<int:pk>/', views.ExamDetailView.as_view(), name='exam-detail'),
    path('exams/<int:exam_id>/start/', views.start_exam, name='start-exam'),
    path('attempts/<int:attempt_id>/submit-answer/', views.submit_answer, name='submit-answer'),
    path('attempts/<int:attempt_id>/submit/', views.submit_exam, name='submit-exam'),
    path('attempts/<int:attempt_id>/results/', views.exam_results, name='exam-results'),
    
    # Admin URLs
    path('admin/subjects/', admin_views.SubjectListCreateView.as_view(), name='admin-subjects'),
    path('admin/exams/', admin_views.ExamAdminListCreateView.as_view(), name='admin-exams'),
    path('admin/stats/', admin_views.admin_stats, name='admin-stats'),
    path('admin/recent-attempts/', admin_views.recent_attempts, name='admin-recent-attempts'),
    path('admin/active-exams/', admin_views.active_exams, name='admin-active-exams'),
    path('admin/exams/<int:exam_id>/questions/', admin_views.exam_questions, name='admin-exam-questions'),
    path('admin/questions/', admin_views.create_question, name='admin-create-question'),
    path('admin/questions/<int:question_id>/', admin_views.manage_question, name='admin-manage-question'),
    
    # Add these missing URLs
    path('admin/attempts/<int:attempt_id>/', admin_views.attempt_details, name='admin-attempt-details'),
    path('admin/exams/<int:exam_id>/live-attempts/', admin_views.live_attempts, name='admin-live-attempts'),
]
