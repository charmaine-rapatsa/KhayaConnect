from django.contrib import admin
from .db_models import (
    AdminAuditLogs,
    Appointments,
    EmergencyResponses,
    EmergencySosLogs,
    MedicationAdherence,
    PillSchedules,
    RiskAlerts,
    Users,
)


class ReadOnlyExistingTableAdmin(admin.ModelAdmin):
    """Expose existing unmanaged tables in Django Admin without edit actions."""

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def has_view_permission(self, request, obj=None):
        return request.user.is_active and request.user.is_staff


@admin.register(Users)
class UsersAdmin(ReadOnlyExistingTableAdmin):
    list_display = ("user_id", "full_name", "phone", "role_label")
    list_filter = ("role",)
    search_fields = ("full_name", "phone", "role")
    ordering = ("-user_id",)
    exclude = ("password",)
    readonly_fields = ("user_id", "role")

    def has_change_permission(self, request, obj=None):
        return (
            request.user.is_active
            and request.user.is_staff
            and (
                request.user.is_superuser
                or request.user.has_perm("core.change_users")
            )
        )

    @admin.display(description="Role", ordering="role")
    def role_label(self, user):
        return {
            "admin": "Administrator",
            "family": "Family Member",
            "elderly": "Elderly User",
            "chw": "Community Health Worker",
            "clinic": "Clinic Staff",
        }.get((user.role or "").lower(), user.role or "Unknown")


@admin.register(Appointments)
class AppointmentsAdmin(ReadOnlyExistingTableAdmin):
    list_display = (
        "appointment_id",
        "elder_name",
        "clinic_name",
        "appointment_date",
        "appointment_time",
        "appointment_type",
        "status",
    )
    list_filter = ("status", "clinic_name", "appointment_date")
    search_fields = ("elderly_user__full_name", "clinic_name", "appointment_type")
    ordering = ("-appointment_date", "-appointment_time")
    date_hierarchy = "appointment_date"
    readonly_fields = (
        "appointment_id",
        "elderly_user",
        "clinic_name",
        "appointment_date",
        "appointment_time",
        "appointment_type",
        "status",
        "notes",
    )

    @admin.display(description="Elder")
    def elder_name(self, appointment):
        return appointment.elderly_user.full_name


@admin.register(PillSchedules)
class PillSchedulesAdmin(ReadOnlyExistingTableAdmin):
    list_display = ("schedule_id", "elder_name", "medication_name", "dosage", "dosage_time", "status")
    list_filter = ("status", "medication_name")
    search_fields = ("elderly_user__full_name", "medication_name")
    ordering = ("elderly_user__full_name", "dosage_time")
    list_select_related = ("elderly_user",)

    @admin.display(description="Elder", ordering="elderly_user__full_name")
    def elder_name(self, schedule):
        return schedule.elderly_user.full_name


@admin.register(MedicationAdherence)
class MedicationAdherenceAdmin(ReadOnlyExistingTableAdmin):
    list_display = ("adherence_id", "elder_name", "medication_name", "scheduled_time", "status", "confirmed_at")
    list_filter = ("status", "scheduled_time")
    search_fields = ("elderly_user__full_name", "schedule__medication_name")
    ordering = ("-scheduled_time",)
    list_select_related = ("elderly_user", "schedule")

    @admin.display(description="Elder", ordering="elderly_user__full_name")
    def elder_name(self, adherence):
        return adherence.elderly_user.full_name

    @admin.display(description="Medication", ordering="schedule__medication_name")
    def medication_name(self, adherence):
        return adherence.schedule.medication_name


@admin.register(EmergencySosLogs)
class EmergencySosLogsAdmin(ReadOnlyExistingTableAdmin):
    list_display = ("sos_id", "elder_name", "activated_at", "status", "resolved_at")
    list_filter = ("status", "activated_at")
    search_fields = ("elderly_user__full_name", "response_notes")
    ordering = ("-activated_at",)
    list_select_related = ("elderly_user",)

    @admin.display(description="Elder", ordering="elderly_user__full_name")
    def elder_name(self, sos):
        return sos.elderly_user.full_name


@admin.register(EmergencyResponses)
class EmergencyResponsesAdmin(ReadOnlyExistingTableAdmin):
    list_display = ("response_id", "sos", "responder_user", "response_time", "response_action", "outcome")
    list_filter = ("response_time",)
    search_fields = ("sos__elderly_user__full_name", "responder_user__full_name", "response_action", "outcome")
    ordering = ("-response_time",)
    list_select_related = ("sos", "sos__elderly_user", "responder_user")


@admin.register(RiskAlerts)
class RiskAlertsAdmin(ReadOnlyExistingTableAdmin):
    list_display = ("alert_id", "elder_name", "alert_type", "severity", "status", "created_at", "resolved_at")
    list_filter = ("severity", "status", "alert_type", "created_at")
    search_fields = ("elderly_user__full_name", "alert_type", "description")
    ordering = ("-created_at",)
    list_select_related = ("elderly_user",)

    @admin.display(description="Elder", ordering="elderly_user__full_name")
    def elder_name(self, alert):
        return alert.elderly_user.full_name


@admin.register(AdminAuditLogs)
class AdminAuditLogsAdmin(ReadOnlyExistingTableAdmin):
    list_display = ("audit_id", "actor", "action_type", "description", "created_at")
    list_filter = ("action_type", "created_at")
    search_fields = ("admin_user__full_name", "description", "action_type")
    ordering = ("-created_at",)
    list_select_related = ("admin_user",)

    @admin.display(description="Actor", ordering="admin_user__full_name")
    def actor(self, audit_event):
        return audit_event.admin_user.full_name
