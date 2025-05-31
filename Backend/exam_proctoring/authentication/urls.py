# backend/authentication/urls.py
from django.urls import path
from .views import (
    RegisterView, LoginView, LogoutView, UserDetailView, 
    UpdateProfileView, ChangePasswordView, user_stats
)
from . import admin_views

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('user/', UserDetailView.as_view(), name='user-detail'),
    path('profile/update/', UpdateProfileView.as_view(), name='update-profile'),
    path('password/change/', ChangePasswordView.as_view(), name='change-password'),
    path('stats/', user_stats, name='user-stats'),
    
    # Admin URLs
    path('admin/users/', admin_views.admin_users_list, name='admin-users-list'),
    path('admin/users/<int:user_id>/', admin_views.manage_user, name='admin-manage-user'),
]
