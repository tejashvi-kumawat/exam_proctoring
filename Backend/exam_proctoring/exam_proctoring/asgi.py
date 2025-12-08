# backend/exam_proctoring/asgi.py
import os

# Set Django settings BEFORE importing anything that uses Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'exam_proctoring.settings')

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from proctoring.urls import websocket_urlpatterns
from proctoring.middleware import TokenAuthMiddlewareStack

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": TokenAuthMiddlewareStack(
        URLRouter(
            websocket_urlpatterns
        )
    ),
})
