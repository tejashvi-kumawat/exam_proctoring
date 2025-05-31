# backend/exam_proctoring/urls.py
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import HttpResponse
def my_html_view(request):
    html_content = "<h1>You are on wrong place brother</h1>"
    return HttpResponse(html_content)
    
urlpatterns = [
    path('/', my_html_view, name='html_view'),
    path('admin/', admin.site.urls),
    path('api/auth/', include('authentication.urls')),
    path('api/exam/', include('exam_app.urls')),
    path('api/proctoring/', include('proctoring.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
