# backend/proctoring/urls.py (add missing URLs)
from django.urls import path, re_path
from .consumers import ProctoringConsumer
from .admin_consumer import AdminMonitoringConsumer

# WebSocket URL patterns - Import these first (before Django settings are accessed)
# Note: Don't use ^ anchor - Channels handles path matching differently
websocket_urlpatterns = [
    re_path(r'ws/proctoring/(?P<attempt_id>\d+)/$', ProctoringConsumer.as_asgi()),
    re_path(r'ws/proctoring/attempt/(?P<attempt_id>\d+)/$', ProctoringConsumer.as_asgi()),  # Alternative pattern
    re_path(r'ws/admin/monitor/exam/(?P<exam_id>\d+)/$', AdminMonitoringConsumer.as_asgi()),
    re_path(r'ws/admin/monitor/attempt/(?P<attempt_id>\d+)/$', AdminMonitoringConsumer.as_asgi()),
]

# HTTP URL patterns - Import views/admin_views lazily to avoid Django settings access before configuration
def get_urlpatterns():
    """Lazy import of views to avoid Django settings access before configuration"""
    try:
        from django.conf import settings
        # Only import if Django settings are configured
        if not settings.configured:
            return []
    except:
        # Django not configured yet, return empty list
        return []
    
    from . import views, admin_views
    
    return [
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

# Create urlpatterns lazily - only when Django is ready
try:
    from django.conf import settings
    if settings.configured:
        urlpatterns = get_urlpatterns()
    else:
        urlpatterns = []
except:
    urlpatterns = []
