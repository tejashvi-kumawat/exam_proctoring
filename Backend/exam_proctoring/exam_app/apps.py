from django.apps import AppConfig


class ExamAppConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'exam_app'
    
    def ready(self):
        import exam_app.signals  # Register signals