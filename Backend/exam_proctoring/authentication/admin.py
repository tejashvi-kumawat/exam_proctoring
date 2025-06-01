from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils.html import format_html
from django.utils import timezone
from django.contrib import messages
from .models import CustomUser

@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'first_name', 'last_name', 'is_student', 'is_instructor', 'approval_status_display')
    list_filter = ('is_staff', 'is_active', 'is_student', 'is_instructor', 'instructor_approved', 'approval_requested')
    search_fields = ('username', 'email', 'first_name', 'last_name')
    ordering = ('-date_joined',)
    actions = ['approve_instructor_requests', 'reject_instructor_requests']
    
    fieldsets = UserAdmin.fieldsets + (
        ('Profile Information', {
            'fields': ('phone_number', 'date_of_birth', 'profile_picture')
        }),
        ('User Type', {
            'fields': ('is_student', 'is_instructor')
        }),
        ('Instructor Approval', {
            'fields': ('approval_requested', 'instructor_approved', 'approval_requested_at', 'approved_by', 'approved_at', 'rejection_reason')
        }),
    )
    
    readonly_fields = ('approval_requested_at', 'approved_at', 'approved_by')
    
    def approval_status_display(self, obj):
        if obj.is_instructor and getattr(obj, 'instructor_approved', False):
            return format_html('<span style="color: green; font-weight: bold;">✅ Approved</span>')
        elif getattr(obj, 'approval_requested', False) and not getattr(obj, 'instructor_approved', False):
            return format_html('<span style="color: orange; font-weight: bold;">⏳ Pending</span>')
        elif getattr(obj, 'rejection_reason', None):
            return format_html('<span style="color: red; font-weight: bold;">❌ Rejected</span>')
        return format_html('<span style="color: gray;">-</span>')
    approval_status_display.short_description = 'Approval Status'
    
    def approve_instructor_requests(self, request, queryset):
        """Approve selected instructor requests"""
        count = 0
        for user in queryset.filter(approval_requested=True, instructor_approved=False):
            user.is_instructor = True
            user.instructor_approved = True
            user.approved_by = request.user
            user.approved_at = timezone.now()
            user.approval_requested = False
            user.save()
            count += 1
        
        if count:
            messages.success(request, f'Successfully approved {count} instructor request(s).')
        else:
            messages.warning(request, 'No pending instructor requests found in selection.')
    
    approve_instructor_requests.short_description = "✅ Approve selected instructor requests"
    
    def reject_instructor_requests(self, request, queryset):
        """Reject selected instructor requests"""
        count = 0
        for user in queryset.filter(approval_requested=True, instructor_approved=False):
            user.rejection_reason = f"Rejected by {request.user.username} on {timezone.now().strftime('%Y-%m-%d')}"
            user.approval_requested = False
            user.is_instructor = False
            user.instructor_approved = False
            user.save()
            count += 1
        
        if count:
            messages.success(request, f'Successfully rejected {count} instructor request(s).')
        else:
            messages.warning(request, 'No pending instructor requests found in selection.')
    
    reject_instructor_requests.short_description = "❌ Reject selected instructor requests"
    
    def save_model(self, request, obj, form, change):
        if change:  # If updating existing user
            # Check if admin is manually approving instructor
            if (getattr(obj, 'approval_requested', False) and 
                form.cleaned_data.get('instructor_approved') and 
                not getattr(obj, 'instructor_approved', False)):
                obj.is_instructor = True
                obj.instructor_approved = True
                obj.approved_by = request.user
                obj.approved_at = timezone.now()
                obj.approval_requested = False
        
        super().save_model(request, obj, form, change)

# Add custom admin actions
def approve_selected_instructors(modeladmin, request, queryset):
    for user in queryset.filter(approval_requested=True, instructor_approved=False):
        user.is_instructor = True
        user.instructor_approved = True
        user.approved_by = request.user
        user.approved_at = timezone.now()
        user.approval_requested = False
        user.save()
approve_selected_instructors.short_description = "Approve selected instructor requests"

def reject_selected_instructors(modeladmin, request, queryset):
    for user in queryset.filter(approval_requested=True, instructor_approved=False):
        user.rejection_reason = "Bulk rejection by admin"
        user.approval_requested = False
        user.save()
reject_selected_instructors.short_description = "Reject selected instructor requests"

CustomUserAdmin.actions = [approve_selected_instructors, reject_selected_instructors]
