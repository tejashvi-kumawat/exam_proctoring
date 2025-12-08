# backend/exam_app/urls.py (add missing URLs)
from django.urls import path
from . import views, admin_views, feature_views

urlpatterns = [
    # Student URLs
    path('exams/', views.ExamListView.as_view(), name='exam-list'),
    path('exams/<int:pk>/', views.ExamDetailView.as_view(), name='exam-detail'),
    path('exams/<int:exam_id>/start/', views.start_exam, name='start-exam'),
    path('attempts/<int:attempt_id>/submit-answer/', views.submit_answer, name='submit-answer'),
    path('attempts/<int:attempt_id>/submit/', views.submit_exam, name='submit-exam'),
    path('attempts/<int:attempt_id>/results/', views.exam_results, name='exam-results'),
    path('attempts/<int:attempt_id>/pause/', views.pause_exam, name='pause-exam'),
    path('attempts/<int:attempt_id>/resume/', views.resume_exam, name='resume-exam'),
    path('user/attempts/', views.user_attempts, name='user-attempts'),
    
    # Admin URLs
    path('admin/subjects/', admin_views.SubjectListCreateView.as_view(), name='admin-subjects'),
    path('admin/exams/', admin_views.ExamAdminListCreateView.as_view(), name='admin-exams'),
    path('admin/exams/<int:exam_id>/', admin_views.manage_exam, name='admin-manage-exam'),
    path('admin/stats/', admin_views.admin_stats, name='admin-stats'),
    path('admin/recent-attempts/', admin_views.recent_attempts, name='admin-recent-attempts'),
    path('admin/active-exams/', admin_views.active_exams, name='admin-active-exams'),
    path('admin/exams/<int:exam_id>/questions/', admin_views.exam_questions, name='admin-exam-questions'),
    path('admin/exams/<int:exam_id>/reorder-questions/', admin_views.reorder_questions, name='admin-reorder-questions'),
    path('admin/questions/', admin_views.create_question, name='admin-create-question'),
    path('admin/questions/<int:question_id>/', admin_views.manage_question, name='admin-manage-question'),
    
    # Add these missing URLs
    path('admin/attempts/<int:attempt_id>/', admin_views.attempt_details, name='admin-attempt-details'),
    path('admin/attempts/<int:attempt_id>/release-results/', admin_views.release_results, name='admin-release-results'),
    path('admin/exams/<int:exam_id>/live-attempts/', admin_views.live_attempts, name='admin-live-attempts'),
    path('admin/exams/<int:exam_id>/all-attempts/', admin_views.exam_all_attempts, name='admin-exam-all-attempts'),
    path('admin/exams/<int:exam_id>/import-questions/', admin_views.import_questions, name='admin-import-questions'),
    path('admin/attempts/<int:attempt_id>/activities/', admin_views.attempt_activities, name='admin-attempt-activities'),
    path('admin/attempts/<int:attempt_id>/restart/', admin_views.restart_exam_attempt, name='admin-restart-attempt'),
    path('admin/delete-all-data/', admin_views.delete_all_data, name='admin-delete-all-data'),
    path('admin/answers/<int:answer_id>/mark/', admin_views.mark_answer, name='admin-mark-answer'),
    path('admin/answers/bulk-mark/', admin_views.bulk_mark_answers, name='admin-bulk-mark-answers'),
    path('admin/answers/<int:answer_id>/solution/', admin_views.edit_solution_text, name='admin-edit-solution-text'),
    path('admin/answers/<int:answer_id>/solutions/', admin_views.add_solution_attachments, name='admin-add-solution-attachments'),
    path('admin/answers/solutions/<int:attachment_id>/', admin_views.delete_solution_attachment, name='admin-delete-solution-attachment'),
    path('admin/exams/<int:exam_id>/analytics/', admin_views.exam_analytics, name='admin-exam-analytics'),
    path('admin/exams/<int:exam_id>/recalculate-scores/', admin_views.recalculate_exam_scores, name='admin-recalculate-scores'),
    
    # New Features (15 features)
    path('attempts/<int:attempt_id>/export-pdf/', feature_views.export_results_pdf, name='export-results-pdf'),
    path('attempts/<int:attempt_id>/send-email/', feature_views.send_results_email, name='send-results-email'),
    path('calendar/', feature_views.exam_calendar, name='exam-calendar'),
    path('question-bank/', feature_views.question_bank, name='question-bank'),
    path('admin/exams/<int:exam_id>/clone/', feature_views.clone_exam, name='clone-exam'),
    path('analytics/student/', feature_views.student_performance_analytics, name='student-performance-analytics'),
    path('analytics/student/<int:user_id>/', feature_views.student_performance_analytics, name='student-performance-analytics-user'),
    path('admin/exams/<int:exam_id>/difficulty-analysis/', feature_views.question_difficulty_analysis, name='question-difficulty-analysis'),
    path('attempts/<int:attempt_id>/time-analysis/', feature_views.question_time_analysis, name='question-time-analysis'),
    path('attempts/<int:attempt_id>/review/', feature_views.exam_review_mode, name='exam-review-mode'),
    path('admin/bulk-import-students/', feature_views.bulk_import_students, name='bulk-import-students'),
    path('admin/exams/<int:exam_id>/report/', feature_views.generate_exam_report, name='generate-exam-report'),
    path('admin/questions/<int:question_id>/tags/', feature_views.manage_question_tags, name='manage-question-tags'),
    path('admin/questions/tags/', feature_views.manage_question_tags, name='get-all-tags'),
    path('admin/exams/<int:exam_id>/preview/', feature_views.preview_exam, name='preview-exam'),
    path('attempts/<int:attempt_id>/violations-report/', feature_views.violation_detailed_report, name='violation-detailed-report'),
    path('exams/<int:exam_id>/retake/', feature_views.request_exam_retake, name='request-exam-retake'),
]
