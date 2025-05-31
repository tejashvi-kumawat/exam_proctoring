# backend/exam_proctoring/asgi.py
import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
import Backend.exam_proctoring.proctoring.urls

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'exam_proctoring.settings')

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AuthMiddlewareStack(
        URLRouter(
            proctoring.urls.websocket_urlpatterns
        )
    ),
})
