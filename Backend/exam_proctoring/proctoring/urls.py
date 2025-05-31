# backend/proctoring/urls.py (add missing URLs)
from django.urls import path
from . import views, admin_views

urlpatterns = [
    path('session/<int:attempt_id>/', views.get_proctoring_session, name='proctoring-session'),
    path('session/<int:attempt_id>/violations/', views.get_violations, name='proctoring-violations'),
    path('session/<int:attempt_id>/logs/', views.get_session_logs, name='proctoring-logs'),
    path('violations/report/', views.report_violation, name='report-violation'),
    
    # Admin URLs
    path('admin/recent-violations/', admin_views.recent_violations, name='admin-recent-violations'),
    path('admin/attempts/<int:attempt_id>/violations/', admin_views.attempt_violations, name='admin-attempt-violations'),
    
    # Add this missing URL
    path('admin/exams/<int:exam_id>/violations/', admin_views.exam_violations, name='admin-exam-violations'),
]
