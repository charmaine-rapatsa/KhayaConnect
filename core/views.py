import json
import hashlib
import secrets
from functools import wraps
from datetime import date as datetime_date, datetime as datetime_datetime, time as datetime_time
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.sessions.models import Session
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.contrib.auth.password_validation import validate_password
from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import Count, Q
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.utils import timezone

from .models import (
    AdminAuditLogs,
    AppointmentReminders,
    ChwAssignments,
    ChwVisitNotes,
    ChwVisits,
    ClinicStaff,
    Clinics,
    Appointments,
    EmergencySosLogs,
    EmergencyResponses,
    ElderlyClinic,
    ElderlyProfiles,
    FamilyElderly,
    MedicationAdherence,
    Notifications,
    PillSchedules,
    RiskAlerts,
    Users,
    VitalsLogs,
    WellnessCheckins,
)


ALLOWED_ROLES = {"admin", "family", "elderly", "chw", "clinic"}
ACTIVE_MEDICATION_STATUSES = ["active", "ACTIVE", "", "active_once"]


def _method_not_allowed(allowed):
    return JsonResponse(
        {"error": f"Method not allowed. Use {', '.join(allowed)}."},
        status=405,
    )


def _read_json(request):
    try:
        payload = json.loads(request.body or b"{}")
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None, JsonResponse({"error": "Invalid JSON"}, status=400)
    if not isinstance(payload, dict):
        return None, JsonResponse({"error": "JSON body must be an object"}, status=400)
    return payload, None


def _id_from(payload, key):
    value = payload.get(key)
    if value in (None, ""):
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed > 0 else None


def _get_role_user(user_id, role):
    if user_id is None:
        return None
    return Users.objects.filter(user_id=user_id, role=role).first()


def _user_data(user):
    return {
        "user_id": user.user_id,
        "full_name": user.full_name,
        "phone": user.phone,
        "role": user.role,
    }


def _record_admin_action(admin_user, action_type, description):
    """Record a minimal audit event without copying passwords or care data."""
    AdminAuditLogs.objects.create(
        admin_user=admin_user,
        action_type=action_type[:50],
        description=description[:255],
        created_at=timezone.now(),
    )


def _session_user(request, role=None):
    user_id = request.session.get("user_id")
    if not user_id:
        return None
    query = Users.objects.filter(user_id=user_id)
    if role:
        query = query.filter(role=role)
    return query.first()


def _session_required(role=None):
    def decorate(view):
        @wraps(view)
        def wrapped(request, *args, **kwargs):
            user = _session_user(request, role)
            if not user:
                return JsonResponse({"error": "Please sign in to continue"}, status=401)
            request.api_user = user
            return view(request, *args, **kwargs)
        return wrapped
    return decorate


def _age_from_date_of_birth(dob):
    if not dob:
        return None
    today = timezone.localdate()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


@_session_required("admin")
def users_api(request):
    if request.method != "GET":
        return _method_not_allowed(["GET"])

    users = Users.objects.all().order_by("full_name", "user_id")
    return JsonResponse([_user_data(user) for user in users], safe=False)


def _user_deletion_summary(user):
    """Count app data that will be removed with an account, without returning care details."""
    user_id = user.user_id
    appointment_ids = list(Appointments.objects.filter(elderly_user_id=user_id).values_list("appointment_id", flat=True))
    visit_ids = list(ChwVisits.objects.filter(Q(chw_user_id=user_id) | Q(elderly_user_id=user_id)).values_list("visit_id", flat=True))
    sos_ids = list(EmergencySosLogs.objects.filter(elderly_user_id=user_id).values_list("sos_id", flat=True))
    schedule_ids = list(PillSchedules.objects.filter(elderly_user_id=user_id).values_list("schedule_id", flat=True))
    summary = {
        "appointments": len(appointment_ids),
        "appointment_reminders": AppointmentReminders.objects.filter(appointment_id__in=appointment_ids).count(),
        "care_team_assignments": ChwAssignments.objects.filter(Q(chw_user_id=user_id) | Q(elderly_user_id=user_id)).count(),
        "care_visits": len(visit_ids),
        "visit_notes": ChwVisitNotes.objects.filter(visit_id__in=visit_ids).count(),
        "clinic_staff_links": ClinicStaff.objects.filter(staff_user_id=user_id).count(),
        "elderly_clinic_links": ElderlyClinic.objects.filter(elderly_user_id=user_id).count(),
        "family_links": FamilyElderly.objects.filter(Q(family_user_id=user_id) | Q(elderly_user_id=user_id)).count(),
        "elderly_profile": ElderlyProfiles.objects.filter(user_id=user_id).count(),
        "emergency_records": len(sos_ids),
        "emergency_responses": EmergencyResponses.objects.filter(Q(sos_id__in=sos_ids) | Q(responder_user_id=user_id)).count(),
        "medication_schedules": len(schedule_ids),
        "medication_adherence_records": MedicationAdherence.objects.filter(Q(elderly_user_id=user_id) | Q(schedule_id__in=schedule_ids)).count(),
        "notifications": Notifications.objects.filter(user_id=user_id).count(),
        "risk_alerts": RiskAlerts.objects.filter(elderly_user_id=user_id).count(),
        "vitals_records": VitalsLogs.objects.filter(Q(elderly_user_id=user_id) | Q(recorded_by_id=user_id)).count(),
        "wellness_checkins": WellnessCheckins.objects.filter(Q(elderly_user_id=user_id) | Q(recorded_by_id=user_id)).count(),
        "audit_events_by_account": AdminAuditLogs.objects.filter(admin_user_id=user_id).count(),
    }
    summary["total_linked_records"] = sum(summary.values())
    return summary


@_session_required("admin")
def user_detail_api(request, user_id):
    if request.method not in {"GET", "PATCH", "DELETE"}:
        return _method_not_allowed(["GET", "PATCH", "DELETE"])
    target = Users.objects.filter(user_id=user_id).first()
    if not target:
        return JsonResponse({"error": "Account not found"}, status=404)
    if target.user_id == request.api_user.user_id:
        return JsonResponse({"error": "You cannot remove the account you are signed in with"}, status=400)
    if target.role == "admin" and Users.objects.filter(role="admin").count() <= 1:
        return JsonResponse({"error": "The last administrator account cannot be removed"}, status=400)

    if request.method == "GET":
        return JsonResponse({"user": _user_data(target), "linked_records": _user_deletion_summary(target)})

    if request.method == "PATCH":
        body, error = _read_json(request)
        if error:
            return error
        full_name = str(body.get("full_name") or "").strip()
        phone = str(body.get("phone") or "").strip()
        if not full_name or len(full_name) > 100 or not phone or len(phone) > 20:
            return JsonResponse({"error": "Enter a name (up to 100 characters) and phone number (up to 20 characters)."}, status=400)
        if Users.objects.filter(phone=phone).exclude(user_id=user_id).exists():
            return JsonResponse({"error": "That phone number is already registered."}, status=400)
        target.full_name, target.phone = full_name, phone
        try:
            target.save(update_fields=["full_name", "phone"])
        except IntegrityError:
            return JsonResponse({"error": "That phone number is already registered."}, status=400)
        _record_admin_action(request.api_user, "user_updated", f"Updated account ID {target.user_id}.")
        return JsonResponse({"message": "Account details updated.", "user": _user_data(target)})

    body, error = _read_json(request)
    if error:
        return error
    if str(body.get("confirm_name") or "").strip() != target.full_name:
        return JsonResponse({"error": "The account name did not match. Nothing was deleted."}, status=400)
    if _id_from(body, "confirm_user_id") != target.user_id:
        return JsonResponse({"error": "The account ID did not match. Nothing was deleted."}, status=400)

    actor = request.api_user
    target_name = target.full_name
    summary = _user_deletion_summary(target)
    with transaction.atomic():
        # Delete children before their referenced rows; all these tables are existing,
        # unmanaged MySQL tables, so the code explicitly handles their relationships.
        appointment_ids = list(Appointments.objects.filter(elderly_user_id=user_id).values_list("appointment_id", flat=True))
        visit_ids = list(ChwVisits.objects.filter(Q(chw_user_id=user_id) | Q(elderly_user_id=user_id)).values_list("visit_id", flat=True))
        sos_ids = list(EmergencySosLogs.objects.filter(elderly_user_id=user_id).values_list("sos_id", flat=True))
        schedule_ids = list(PillSchedules.objects.filter(elderly_user_id=user_id).values_list("schedule_id", flat=True))

        AppointmentReminders.objects.filter(appointment_id__in=appointment_ids).delete()
        ChwVisitNotes.objects.filter(visit_id__in=visit_ids).delete()
        EmergencyResponses.objects.filter(Q(sos_id__in=sos_ids) | Q(responder_user_id=user_id)).delete()
        MedicationAdherence.objects.filter(Q(elderly_user_id=user_id) | Q(schedule_id__in=schedule_ids)).delete()
        Appointments.objects.filter(appointment_id__in=appointment_ids).delete()
        ChwVisits.objects.filter(visit_id__in=visit_ids).delete()
        EmergencySosLogs.objects.filter(sos_id__in=sos_ids).delete()
        PillSchedules.objects.filter(schedule_id__in=schedule_ids).delete()
        ChwAssignments.objects.filter(Q(chw_user_id=user_id) | Q(elderly_user_id=user_id)).delete()
        ClinicStaff.objects.filter(staff_user_id=user_id).delete()
        ElderlyClinic.objects.filter(elderly_user_id=user_id).delete()
        FamilyElderly.objects.filter(Q(family_user_id=user_id) | Q(elderly_user_id=user_id)).delete()
        ElderlyProfiles.objects.filter(user_id=user_id).delete()
        Notifications.objects.filter(user_id=user_id).delete()
        RiskAlerts.objects.filter(elderly_user_id=user_id).delete()
        VitalsLogs.objects.filter(Q(elderly_user_id=user_id) | Q(recorded_by_id=user_id)).delete()
        WellnessCheckins.objects.filter(Q(elderly_user_id=user_id) | Q(recorded_by_id=user_id)).delete()
        AdminAuditLogs.objects.filter(admin_user_id=user_id).delete()

        # Expire any app sessions belonging to the removed account.
        for session in Session.objects.all().iterator():
            if str(session.get_decoded().get("user_id")) == str(user_id):
                session.delete()

        target.delete()
        _record_admin_action(
            actor,
            "user_deleted",
            f"Permanently removed one account and {summary['total_linked_records']} linked records.",
        )

    return JsonResponse({
        "message": f"{target_name}'s account and linked records were permanently removed.",
        "linked_records_removed": summary,
    })


@_session_required("admin")
def register_api(request):
    if request.method != "POST":
        return _method_not_allowed(["POST"])

    body, error = _read_json(request)
    if error:
        return error

    first_name = str(body.get("first_name") or "").strip()
    surname = str(body.get("surname") or body.get("last_name") or "").strip()
    full_name = str(body.get("full_name") or "").strip()
    if not full_name and first_name and surname:
        full_name = f"{first_name} {surname}".strip()
    phone = str(body.get("phone") or "").strip()
    password = str(body.get("password") or "")
    role = str(body.get("role") or "").strip().lower()

    if not full_name or not phone or not password or not role:
        return JsonResponse({"error": "All fields are required"}, status=400)
    if role not in ALLOWED_ROLES:
        return JsonResponse({"error": "Invalid user role"}, status=400)
    if Users.objects.filter(phone=phone).exists():
        return JsonResponse({"error": "Phone number already registered"}, status=400)

    try:
        with transaction.atomic():
            user = Users.objects.create(
                full_name=full_name,
                phone=phone,
                password=make_password(password),
                role=role,
            )
            _record_admin_action(
                request.api_user,
                "user_created",
                f"Created {role} account ID {user.user_id}.",
            )
    except IntegrityError:
        return JsonResponse({"error": "Phone number already registered"}, status=400)

    return JsonResponse(
        {"message": "User registered successfully", **_user_data(user)},
        status=201,
    )


def login_api(request):
    if request.method != "POST":
        return _method_not_allowed(["POST"])

    body, error = _read_json(request)
    if error:
        return error

    phone = str(body.get("phone") or "").strip()
    password = str(body.get("password") or "")
    expected_role = str(body.get("role") or "").strip().lower()
    if not phone or not password:
        return JsonResponse(
            {"error": "Phone number and password are required"}, status=400
        )
    if expected_role and expected_role not in ALLOWED_ROLES:
        return JsonResponse({"error": "Invalid account type"}, status=400)

    user = Users.objects.filter(phone=phone).first()
    if (
        not user
        or not check_password(password, user.password)
        or (expected_role and user.role != expected_role)
    ):
        return JsonResponse(
            {"error": "Invalid phone number, password, or account type"}, status=401
        )

    # Rotate the anonymous session key on authentication to prevent session
    # fixation, then establish the authenticated session.
    request.session.cycle_key()
    request.session["user_id"] = user.user_id
    request.session["role"] = user.role
    request.session.set_expiry(60 * 60 * 8)
    return JsonResponse({
        "message": "Login successful",
        **_user_data(user),
        "csrf_token": get_token(request),
    })


def csrf_token_api(request):
    """Issue a CSRF cookie/token pair for the browser before login."""
    if request.method != "GET":
        return _method_not_allowed(["GET"])
    return JsonResponse({"csrf_token": get_token(request)})


def _password_reset_key(prefix, value):
    digest = hashlib.sha256(str(value).encode("utf-8")).hexdigest()
    return f"khaya-password-reset:{prefix}:{digest}"


def password_reset_request_api(request):
    """Demo-only recovery: code is printed to the Django terminal, never returned."""
    if request.method != "POST":
        return _method_not_allowed(["POST"])
    if not settings.DEBUG:
        return JsonResponse({"error": "Account recovery is not configured. Please contact an administrator."}, status=503)
    body, error = _read_json(request)
    if error:
        return error
    phone = str(body.get("phone") or "").strip()
    if not phone or len(phone) > 20:
        return JsonResponse({"error": "Enter the phone number used for the account."}, status=400)
    ip = request.META.get("REMOTE_ADDR", "unknown")
    phone_key = _password_reset_key("request-phone", phone)
    ip_key = _password_reset_key("request-ip", ip)
    generic = "If an account matches, a verification code has been sent. In local demo mode, check the Django server terminal."
    if cache.get(phone_key) or cache.get(ip_key):
        return JsonResponse({"message": generic})
    cache.set(phone_key, True, timeout=60)
    cache.set(ip_key, True, timeout=15)
    account = Users.objects.filter(phone=phone).first()
    if account:
        code = f"{secrets.randbelow(1_000_000):06d}"
        cache.set(_password_reset_key("code", phone), {"code": code, "attempts": 0, "user_id": account.user_id}, timeout=600)
        print(f"[KhayaConnect demo password reset] Verification code: {code} (expires in 10 minutes)")
    return JsonResponse({"message": generic})


def password_reset_confirm_api(request):
    if request.method != "POST":
        return _method_not_allowed(["POST"])
    if not settings.DEBUG:
        return JsonResponse({"error": "Account recovery is not configured. Please contact an administrator."}, status=503)
    body, error = _read_json(request)
    if error:
        return error
    phone = str(body.get("phone") or "").strip()
    code = str(body.get("code") or "").strip()
    new_password = str(body.get("new_password") or "")
    if not phone or len(phone) > 20 or not code or not new_password:
        return JsonResponse({"error": "Enter your phone number, verification code and new password."}, status=400)
    key = _password_reset_key("code", phone)
    record = cache.get(key)
    if not record or record.get("attempts", 0) >= 5 or not secrets.compare_digest(str(record.get("code", "")), code):
        if record:
            record["attempts"] = record.get("attempts", 0) + 1
            cache.set(key, record, timeout=600)
        return JsonResponse({"error": "That code is invalid or expired. Request a new code and try again."}, status=400)
    account = Users.objects.filter(user_id=record.get("user_id"), phone=phone).first()
    if not account:
        cache.delete(key)
        return JsonResponse({"error": "That code is invalid or expired. Request a new code and try again."}, status=400)
    try:
        validate_password(new_password, user=account)
    except ValidationError as validation_error:
        return JsonResponse({"error": " ".join(validation_error.messages)}, status=400)
    with transaction.atomic():
        account.password = make_password(new_password)
        account.save(update_fields=["password"])
        for session in Session.objects.all().iterator():
            if str(session.get_decoded().get("user_id")) == str(account.user_id):
                session.delete()
    cache.delete(key)
    return JsonResponse({"message": "Password updated. You can now sign in with your new password."})


@_session_required()
def logout_api(request):
    if request.method != "POST":
        return _method_not_allowed(["POST"])
    request.session.flush()
    return JsonResponse({"message": "Signed out"})


@_session_required("elderly")
def elderly_dashboard_api(request):
    if request.method != "GET":
        return _method_not_allowed(["GET"])

    user = request.api_user
    today = timezone.localdate()
    taken_schedule_ids = set(MedicationAdherence.objects.filter(
        elderly_user=user,
        scheduled_time__date=today,
        status="taken",
    ).values_list("schedule_id", flat=True))

    schedules = PillSchedules.objects.filter(
        elderly_user=user, status__in=ACTIVE_MEDICATION_STATUSES
    ).order_by("dosage_time", "schedule_id")
    one_time_ids = [item.schedule_id for item in schedules if item.status == "active_once"]
    one_time_records = _one_time_schedule_records(one_time_ids, [user.user_id])
    adherence = list(MedicationAdherence.objects.filter(
        elderly_user=user, status="taken"
    ).select_related("schedule").order_by("-confirmed_at", "-scheduled_time").values(
        "adherence_id", "schedule_id", "schedule__medication_name", "schedule__dosage",
        "scheduled_time", "confirmed_at", "status",
    )[:100])

    medications = []
    for item in schedules:
        one_time_record = one_time_records.get(item.schedule_id)
        medications.append({
            "schedule_id": item.schedule_id,
            "medication_name": item.medication_name,
            "dosage": item.dosage,
            "dosage_time": item.dosage_time.isoformat(),
            "status": item.status or "active",
            "frequency": "once" if item.status == "active_once" else "daily",
            "scheduled_date": timezone.localtime(one_time_record.scheduled_time).date().isoformat() if one_time_record else None,
            "taken_today": item.schedule_id in taken_schedule_ids if item.status != "active_once" else bool(one_time_record and one_time_record.status == "taken"),
        })

    appointments = list(Appointments.objects.filter(
        elderly_user=user
    ).order_by("appointment_date", "appointment_time").values(
        "appointment_id", "clinic_name", "appointment_date", "appointment_time",
        "appointment_type", "status", "notes",
    ))
    visits = list(ChwVisits.objects.filter(
        elderly_user=user
    ).select_related("chw_user").order_by("visit_date").values(
        "visit_id", "visit_date", "status", "notes", "chw_user__full_name",
    ))
    notifications = list(Notifications.objects.filter(
        user=user
    ).order_by("-created_at").values(
        "notification_id", "notification_type", "title", "message", "is_read", "created_at",
    )[:20])

    return JsonResponse({
        "user": _user_data(user),
        "medications": medications,
        "adherence": adherence,
        "appointments": appointments,
        "visits": visits,
        "notifications": notifications,
    })


def _one_time_schedule_records(schedule_ids, elderly_ids=None):
    if not schedule_ids:
        return {}
    records = MedicationAdherence.objects.filter(
        schedule_id__in=schedule_ids,
        status__in=["scheduled", "taken"],
    )
    if elderly_ids is not None:
        records = records.filter(elderly_user_id__in=elderly_ids)
    mapped = {}
    for record in records.filter(status="taken").order_by("scheduled_time", "adherence_id"):
        mapped[record.schedule_id] = record
    for record in records.filter(status="scheduled").order_by("scheduled_time", "adherence_id"):
        mapped[record.schedule_id] = record
    return mapped


def _set_medication_schedule_mode(schedule, elderly_user, frequency, raw_date):
    frequency = str(frequency or "").strip().lower()
    if frequency != "once":
        return "Medication schedules must be assigned to one date"
    pending = MedicationAdherence.objects.select_for_update().filter(
        schedule=schedule, elderly_user=elderly_user, status="scheduled"
    ).order_by("scheduled_time", "adherence_id")
    try:
        schedule_date = datetime_date.fromisoformat(str(raw_date or ""))
    except ValueError:
        return "Choose a date for a one-day medication"
    if schedule_date < timezone.localdate():
        return "A one-day medication must be assigned for today or a future date"
    scheduled_at = timezone.make_aware(
        datetime_datetime.combine(schedule_date, schedule.dosage_time),
        timezone.get_current_timezone(),
    )
    schedule.status = "active_once"
    schedule.save(update_fields=["status"])
    record = pending.first()
    if record:
        record.scheduled_time = scheduled_at
        record.notes = "One-day schedule"
        record.save(update_fields=["scheduled_time", "notes"])
        pending.exclude(adherence_id=record.adherence_id).update(status="cancelled")
    else:
        MedicationAdherence.objects.create(
            schedule=schedule, elderly_user=elderly_user,
            scheduled_time=scheduled_at, status="scheduled",
            notes="One-day schedule",
        )
    return None


@_session_required("family")
def family_dashboard_api(request):
    """Return care records only for elders linked to the signed-in family account."""
    if request.method != "GET":
        return _method_not_allowed(["GET"])
    elders = list(FamilyElderly.objects.filter(
        family_user=request.api_user
    ).select_related("elderly_user").values(
        "elderly_user_id", "elderly_user__full_name", "relationship_type"
    ))
    elder_ids = [row["elderly_user_id"] for row in elders]
    schedule_rows = list(PillSchedules.objects.filter(
        elderly_user_id__in=elder_ids, status__in=ACTIVE_MEDICATION_STATUSES
    ).select_related("elderly_user").order_by("dosage_time"))
    one_time_ids = [item.schedule_id for item in schedule_rows if item.status == "active_once"]
    one_time_records = _one_time_schedule_records(one_time_ids, elder_ids)
    schedules = [{
        "schedule_id": item.schedule_id, "elderly_user_id": item.elderly_user_id,
        "elderly_name": item.elderly_user.full_name,
        "medication_name": item.medication_name, "dosage": item.dosage,
        "dosage_time": item.dosage_time.isoformat(), "status": item.status,
        "frequency": "once" if item.status == "active_once" else "daily",
        "scheduled_date": timezone.localtime(one_time_records[item.schedule_id].scheduled_time).date().isoformat()
            if item.schedule_id in one_time_records else None,
    } for item in schedule_rows]
    adherence = list(MedicationAdherence.objects.filter(
        elderly_user_id__in=elder_ids
    ).select_related("schedule").order_by("-scheduled_time").values(
        "adherence_id", "schedule_id", "elderly_user_id", "schedule__medication_name",
        "scheduled_time", "status", "confirmed_at", "notes"
    )[:100])
    appointments = list(Appointments.objects.filter(
        elderly_user_id__in=elder_ids
    ).order_by("appointment_date", "appointment_time").values(
        "appointment_id", "elderly_user_id", "clinic_name", "appointment_date",
        "appointment_time", "appointment_type", "status", "notes"
    )[:100])
    visits = list(ChwVisits.objects.filter(
        elderly_user_id__in=elder_ids
    ).select_related("chw_user").order_by("visit_date").values(
        "visit_id", "elderly_user_id", "visit_date", "status", "notes", "chw_user__full_name"
    )[:100])
    sos = list(EmergencySosLogs.objects.filter(
        elderly_user_id__in=elder_ids
    ).order_by("-activated_at").values(
        "sos_id", "elderly_user_id", "activated_at", "status", "resolved_at", "response_notes"
    )[:100])
    risks = list(RiskAlerts.objects.filter(
        elderly_user_id__in=elder_ids
    ).order_by("-created_at").values(
        "alert_id", "elderly_user_id", "alert_type", "severity", "description", "created_at", "status"
    )[:100])
    notifications = list(Notifications.objects.filter(
        user=request.api_user
    ).order_by("-created_at").values(
        "notification_id", "notification_type", "title", "message", "is_read", "created_at"
    )[:50])
    chw_ids = ChwAssignments.objects.filter(
        elderly_user_id__in=elder_ids, status__in=["active", "ACTIVE", ""]
    ).values_list("chw_user_id", flat=True)
    care_team = list(Users.objects.filter(user_id__in=chw_ids).values("user_id", "full_name", "phone"))
    return JsonResponse({
        "user": _user_data(request.api_user), "elders": elders, "medications": schedules,
        "adherence": adherence, "appointments": appointments, "visits": visits,
        "emergencies": sos, "risks": risks, "care_team": care_team,
        "notifications": notifications,
    })


@_session_required("clinic")
def clinic_dashboard_api(request):
    if request.method != "GET":
        return _method_not_allowed(["GET"])
    clinics = Clinics.objects.filter(clinic_id__in=ClinicStaff.objects.filter(
        staff_user=request.api_user, status__in=["active", "ACTIVE", ""]
    ).values_list("clinic_id", flat=True))
    elderly_ids = ElderlyClinic.objects.filter(
        clinic__in=clinics, status__in=["active", "ACTIVE", ""]
    ).values_list("elderly_user_id", flat=True)
    elders = list(Users.objects.filter(user_id__in=elderly_ids, role="elderly").values("user_id", "full_name", "phone"))
    appointments = list(Appointments.objects.filter(clinic_name__in=clinics.values_list("clinic_name", flat=True)).select_related("elderly_user").order_by("appointment_date", "appointment_time").values(
        "appointment_id", "elderly_user_id", "elderly_user__full_name", "clinic_name", "appointment_date", "appointment_time", "appointment_type", "status", "notes"
    ))
    medications = list(PillSchedules.objects.filter(elderly_user_id__in=elderly_ids).select_related("elderly_user").order_by("dosage_time").values(
        "schedule_id", "elderly_user_id", "elderly_user__full_name", "medication_name", "dosage", "dosage_time", "status"
    ))
    emergencies = list(EmergencySosLogs.objects.filter(elderly_user_id__in=elderly_ids).select_related("elderly_user").order_by("-activated_at").values(
        "sos_id", "elderly_user_id", "elderly_user__full_name", "activated_at", "status", "resolved_at", "response_notes"
    ))
    return JsonResponse({"patients": elders, "appointments": appointments, "medications": medications, "emergencies": emergencies})


@_session_required()
def recent_activity_api(request):
    """Build a role-scoped recent activity list from existing saved records."""
    if request.method != "GET":
        return _method_not_allowed(["GET"])

    user = request.api_user
    role = user.role
    active_statuses = ["active", "ACTIVE", ""]
    elderly_ids = []
    activities = []

    if role == "elderly":
        elderly_ids = [user.user_id]
    elif role == "family":
        elderly_ids = list(FamilyElderly.objects.filter(
            family_user=user
        ).values_list("elderly_user_id", flat=True))
    elif role == "chw":
        elderly_ids = list(ChwAssignments.objects.filter(
            chw_user=user, status__in=active_statuses
        ).values_list("elderly_user_id", flat=True))
    elif role == "clinic":
        clinic_ids = ClinicStaff.objects.filter(
            staff_user=user, status__in=active_statuses
        ).values_list("clinic_id", flat=True)
        clinics = Clinics.objects.filter(clinic_id__in=clinic_ids)
        elderly_ids = list(ElderlyClinic.objects.filter(
            clinic__in=clinics, status__in=active_statuses
        ).values_list("elderly_user_id", flat=True))
        clinic_names = list(clinics.values_list("clinic_name", flat=True))
    elif role == "admin":
        elderly_ids = []
    else:
        return JsonResponse({"error": "This role cannot view recent activity"}, status=403)

    def add(kind, record_id, title, description, status, happened_at, section, details=None):
        if not happened_at:
            return
        activities.append({
            "id": f"{kind}-{record_id}", "type": kind, "record_id": record_id,
            "title": title, "description": description, "status": status or "",
            "timestamp": happened_at.isoformat() if hasattr(happened_at, "isoformat") else str(happened_at),
            "section": section, "details": details or {},
        })

    if role == "admin":
        for record in AdminAuditLogs.objects.select_related("admin_user").order_by("-created_at", "-audit_id")[:50]:
            add("administration", record.audit_id, record.action_type.replace("_", " ").title(),
                record.description or "Administrative action", "saved", record.created_at,
                "overview", {"Administrator": record.admin_user.full_name})
        for record in EmergencySosLogs.objects.select_related("elderly_user").order_by("-activated_at", "-sos_id")[:25]:
            add("emergency", record.sos_id, "Emergency activity", record.elderly_user.full_name,
                record.status, record.activated_at, "overview",
                {"Status": record.status or "active", "Response notes": record.response_notes or ""})
    else:
        for record in MedicationAdherence.objects.filter(
            elderly_user_id__in=elderly_ids, status="taken"
        ).select_related("schedule", "elderly_user").order_by("-confirmed_at", "-scheduled_time", "-adherence_id")[:50]:
            add("medication", record.adherence_id, "Medication confirmed",
                f"{record.schedule.medication_name} · {record.elderly_user.full_name}", "taken",
                record.confirmed_at or record.scheduled_time, "meds",
                {"Medication": record.schedule.medication_name, "Dosage": record.schedule.dosage or "Not specified",
                 "Scheduled": timezone.localtime(record.scheduled_time).isoformat(),
                 "Confirmed": timezone.localtime(record.confirmed_at).isoformat() if record.confirmed_at else ""})

        if elderly_ids:
            for record in Appointments.objects.filter(elderly_user_id__in=elderly_ids).order_by(
                "-appointment_date", "-appointment_time", "-appointment_id"
            )[:50]:
                when = datetime_datetime.combine(record.appointment_date, record.appointment_time or datetime_time.min)
                when = timezone.make_aware(when, timezone.get_current_timezone())
                appointment_label = str(record.appointment_type or "Clinic").replace("_", " ").strip().title()
                add("appointment", record.appointment_id, f"{appointment_label} appointment",
                    f"{record.elderly_user.full_name} · {record.clinic_name}", record.status, when,
                    "schedule", {"Clinic": record.clinic_name, "Appointment type": record.appointment_type or "",
                                 "Notes": record.notes or ""})

            visit_query = ChwVisits.objects.filter(elderly_user_id__in=elderly_ids)
            if role == "chw":
                visit_query = visit_query.filter(chw_user=user)
            for record in visit_query.select_related("elderly_user", "chw_user").order_by(
                "-visit_date", "-visit_id"
            )[:50]:
                add("visit", record.visit_id, "CHW visit", record.elderly_user.full_name,
                    record.status, record.visit_date, "schedule",
                    {"Notes": record.notes or "", "Follow-up required": "Yes" if record.follow_up_required else "No"})

            for record in EmergencySosLogs.objects.filter(
                elderly_user_id__in=elderly_ids
            ).select_related("elderly_user").order_by("-activated_at", "-sos_id")[:50]:
                add("emergency", record.sos_id, "Emergency help requested",
                    record.elderly_user.full_name, record.status, record.activated_at, "alerts",
                    {"Status": record.status or "active", "Response notes": record.response_notes or ""})

            for record in RiskAlerts.objects.filter(
                elderly_user_id__in=elderly_ids
            ).select_related("elderly_user").order_by("-created_at", "-alert_id")[:50]:
                add("risk", record.alert_id, record.alert_type.replace("_", " ").title(),
                    f"{record.elderly_user.full_name} · {record.description or ''}".strip(),
                    record.status or record.severity, record.created_at, "alerts",
                    {"Severity": record.severity or "", "Description": record.description or ""})

            if role == "clinic":
                # Appointment and emergency records above are confined to elders linked to this staff member's clinic.
                # Clinic-scoped appointments use clinic names as the existing relationship key.
                # Remove appointments outside the signed-in staff member's clinics.
                activities[:] = [item for item in activities if item["type"] != "appointment" or
                                 item["details"].get("Clinic") in clinic_names]

        # Include non-clinical notifications only; event-backed notifications are represented by their saved records above.
        notification_user = user
        for record in Notifications.objects.filter(user=notification_user).exclude(
            notification_type__in=["medication", "appointment", "visit", "emergency"]
        ).order_by("-created_at", "-notification_id")[:25]:
            add("notification", record.notification_id, record.title,
                record.message, "read" if record.is_read else "new", record.created_at,
                "alerts", {"Type": record.notification_type})

    activities.sort(key=lambda item: item["timestamp"], reverse=True)
    return JsonResponse({"activities": activities[:75]})


@_session_required()
def notifications_api(request):
    """List and update only notifications owned by the signed-in user."""
    user = request.api_user
    if request.method == "GET":
        records = Notifications.objects.filter(user=user).order_by("-created_at", "-notification_id")[:100]
        notifications = list(records.values(
            "notification_id", "notification_type", "title", "message", "is_read", "created_at",
        ))
        unread_count = Notifications.objects.filter(user=user, is_read=0).count()
        return JsonResponse({"notifications": notifications, "unread_count": unread_count})

    if request.method != "PATCH":
        return _method_not_allowed(["GET", "PATCH"])

    body, error = _read_json(request)
    if error:
        return error
    unread_records = Notifications.objects.filter(user=user, is_read=0)
    if body.get("mark_all_read") is True:
        updated = unread_records.update(is_read=1)
        return JsonResponse({"message": "Notifications marked as read", "updated": updated})

    notification_id = _id_from(body, "notification_id")
    if notification_id is None:
        return JsonResponse({"error": "A notification ID or mark_all_read is required"}, status=400)
    updated = unread_records.filter(notification_id=notification_id).update(is_read=1)
    if not updated:
        exists = Notifications.objects.filter(user=user, notification_id=notification_id).exists()
        return JsonResponse({
            "error": "Notification was not found or is already read" if exists else "Notification not found"
        }, status=404)
    return JsonResponse({"message": "Notification marked as read", "notification_id": notification_id})


@_session_required("clinic")
def appointments_api(request):
    """List and manage appointments for clinics assigned to signed-in staff."""
    staff_clinics = Clinics.objects.filter(
        clinic_id__in=ClinicStaff.objects.filter(
            staff_user=request.api_user,
            status__in=["active", "ACTIVE", ""],
        ).values_list("clinic_id", flat=True)
    )
    clinic_names = list(staff_clinics.values_list("clinic_name", flat=True))

    def appointment_data(item):
        return {
            "appointment_id": item.appointment_id,
            "elderly_user_id": item.elderly_user_id,
            "elderly_name": item.elderly_user.full_name,
            "clinic_name": item.clinic_name,
            "appointment_date": item.appointment_date.isoformat(),
            "appointment_time": item.appointment_time.isoformat() if item.appointment_time else "",
            "appointment_type": item.appointment_type or "",
            "status": item.status or "scheduled",
            "notes": item.notes or "",
        }

    if request.method == "GET":
        appointments = Appointments.objects.filter(
            clinic_name__in=clinic_names
        ).select_related("elderly_user").order_by("appointment_date", "appointment_time")
        elderly = Users.objects.filter(
            role="elderly",
            user_id__in=ElderlyClinic.objects.filter(
                clinic__in=staff_clinics,
                status__in=["active", "ACTIVE", ""],
            ).values_list("elderly_user_id", flat=True),
        ).order_by("full_name")
        return JsonResponse({
            "appointments": [appointment_data(item) for item in appointments],
            "elderly_users": [{"user_id": user.user_id, "full_name": user.full_name} for user in elderly],
            "clinics": [{"clinic_id": clinic.clinic_id, "clinic_name": clinic.clinic_name} for clinic in staff_clinics.order_by("clinic_name")],
        })

    body, error = _read_json(request)
    if error:
        return error

    if request.method == "POST":
        elderly_id = _id_from(body, "elderly_user_id")
        elderly = _get_role_user(elderly_id, "elderly")
        clinic_id = _id_from(body, "clinic_id")
        clinic = staff_clinics.filter(clinic_id=clinic_id).first() if clinic_id else None
        date_value = str(body.get("appointment_date") or "").strip()
        time_value = str(body.get("appointment_time") or "").strip()
        appointment_type = str(body.get("appointment_type") or "").strip()
        if not elderly or not clinic or not ElderlyClinic.objects.filter(
            elderly_user=elderly,
            clinic=clinic,
            status__in=["active", "ACTIVE", ""],
        ).exists():
            return JsonResponse({"error": "Select an elderly user and clinic assigned to your account"}, status=400)
        if not date_value or not appointment_type:
            return JsonResponse({"error": "Appointment date and type are required"}, status=400)
        appointment_status = str(body.get("status") or "scheduled").strip().lower()
        if appointment_status not in {"scheduled", "confirmed", "completed", "cancelled", "missed"}:
            return JsonResponse({"error": "Appointment status is invalid"}, status=400)
        try:
            from datetime import date as datetime_date
            appointment_date = datetime_date.fromisoformat(date_value)
            appointment_time = datetime_time.fromisoformat(time_value) if time_value else None
        except ValueError:
            return JsonResponse({"error": "Enter a valid appointment date and time"}, status=400)
        with transaction.atomic():
            appointment = Appointments.objects.create(
                elderly_user=elderly,
                clinic_name=clinic.clinic_name,
                appointment_date=appointment_date,
                appointment_time=appointment_time,
                appointment_type=appointment_type[:100],
                status=appointment_status,
                notes=str(body.get("notes") or "").strip()[:255] or None,
            )
            recipient_ids = set(FamilyElderly.objects.filter(elderly_user=elderly).values_list("family_user_id", flat=True)) | {elderly.user_id}
            recipient_ids.update(ClinicStaff.objects.filter(
                clinic=clinic, status__in=["active", "ACTIVE", ""]
            ).values_list("staff_user_id", flat=True))
            Notifications.objects.bulk_create([Notifications(user_id=recipient_id, notification_type="appointment", title="Clinic appointment scheduled", message=f"{appointment_type[:100]} at {clinic.clinic_name} on {appointment_date.isoformat()}.", is_read=0, created_at=timezone.now()) for recipient_id in recipient_ids])
            _record_admin_action(
                request.api_user,
                "appointment_created",
                f"User ID {request.api_user.user_id} created appointment ID {appointment.appointment_id} for elder user ID {elderly.user_id}.",
            )
        return JsonResponse({"message": "Appointment created", "appointment": appointment_data(appointment)}, status=201)

    if request.method == "PATCH":
        appointment_id = _id_from(body, "appointment_id")
        appointment = Appointments.objects.filter(
            appointment_id=appointment_id,
            clinic_name__in=clinic_names,
        ).select_related("elderly_user").first() if appointment_id else None
        if not appointment:
            return JsonResponse({"error": "Appointment not found for your clinic"}, status=404)
        changed_fields = []
        for field, limit in (("appointment_type", 100), ("status", 20), ("notes", 255)):
            if field in body:
                value = str(body[field] or "").strip()
                if field == "status" and value.lower() not in {"scheduled", "confirmed", "completed", "cancelled", "missed"}:
                    return JsonResponse({"error": "Appointment status is invalid"}, status=400)
                setattr(appointment, field, value[:limit] or None)
                changed_fields.append(field)
        if "appointment_date" in body:
            try:
                from datetime import date as datetime_date
                appointment.appointment_date = datetime_date.fromisoformat(str(body["appointment_date"]))
            except (TypeError, ValueError):
                return JsonResponse({"error": "Enter a valid appointment date"}, status=400)
            changed_fields.append("appointment_date")
        if "appointment_time" in body:
            try:
                appointment.appointment_time = datetime_time.fromisoformat(str(body["appointment_time"])) if body["appointment_time"] else None
            except (TypeError, ValueError):
                return JsonResponse({"error": "Enter a valid appointment time"}, status=400)
            changed_fields.append("appointment_time")
        if not changed_fields:
            return JsonResponse({"error": "Provide at least one appointment field to update"}, status=400)
        with transaction.atomic():
            appointment.save(update_fields=changed_fields)
            recipient_ids = set(FamilyElderly.objects.filter(elderly_user=appointment.elderly_user).values_list("family_user_id", flat=True)) | {appointment.elderly_user_id}
            clinic_ids = staff_clinics.filter(clinic_name=appointment.clinic_name).values_list("clinic_id", flat=True)
            recipient_ids.update(ClinicStaff.objects.filter(
                clinic_id__in=clinic_ids, status__in=["active", "ACTIVE", ""]
            ).values_list("staff_user_id", flat=True))
            Notifications.objects.bulk_create([Notifications(user_id=recipient_id, notification_type="appointment", title="Clinic appointment updated", message=f"Appointment {appointment.appointment_id} is now {appointment.status or 'scheduled'} for {appointment.appointment_date.isoformat()}.", is_read=0, created_at=timezone.now()) for recipient_id in recipient_ids])
            _record_admin_action(
                request.api_user,
                "appointment_updated",
                f"User ID {request.api_user.user_id} updated appointment ID {appointment.appointment_id}; changed fields: {', '.join(changed_fields)}.",
            )
        return JsonResponse({"message": "Appointment updated", "appointment": appointment_data(appointment)})

    return _method_not_allowed(["GET", "POST", "PATCH"])


@_session_required("elderly")
def medication_adherence_api(request):
    if request.method != "POST":
        return _method_not_allowed(["POST"])
    body, error = _read_json(request)
    if error:
        return error
    schedule_id = _id_from(body, "schedule_id")
    if not schedule_id:
        return JsonResponse({"error": "A medication schedule is required"}, status=400)

    with transaction.atomic():
        # Locking the schedule serializes same-dose confirmations even though the
        # existing table has no unique constraint for schedule and scheduled_time.
        schedule = PillSchedules.objects.select_for_update().filter(
            schedule_id=schedule_id,
            elderly_user=request.api_user,
            status__in=ACTIVE_MEDICATION_STATUSES,
        ).first()
        if not schedule:
            return JsonResponse({"error": "Medication schedule not found"}, status=404)

        dose_date = timezone.localdate()
        if schedule.status == "active_once":
            dose_records = MedicationAdherence.objects.select_for_update().filter(
                schedule=schedule, elderly_user=request.api_user,
                status__in=["scheduled", "taken"],
            )
            planned_record = dose_records.filter(status="scheduled").order_by("scheduled_time", "adherence_id").first() or dose_records.filter(status="taken").order_by("-scheduled_time", "-adherence_id").first()
            if not planned_record:
                return JsonResponse({"error": "This one-day medication has no assigned date"}, status=409)
            scheduled_at = planned_record.scheduled_time
            if timezone.localtime(scheduled_at).date() > dose_date:
                return JsonResponse({"error": "This medication is scheduled for a future date and cannot be confirmed yet"}, status=400)
        else:
            scheduled_at = timezone.make_aware(
                datetime_datetime.combine(dose_date, schedule.dosage_time),
                timezone.get_current_timezone(),
            )
        record = MedicationAdherence.objects.select_for_update().filter(
            schedule=schedule,
            elderly_user=request.api_user,
            scheduled_time=scheduled_at,
        ).first()
        already_confirmed = bool(
            record and record.status == "taken" and record.confirmed_at
        )
        now = record.confirmed_at if already_confirmed else timezone.now()
        if record:
            if not already_confirmed:
                record.status = "taken"
                record.confirmed_at = now
                record.save(update_fields=["status", "confirmed_at"])
        else:
            record = MedicationAdherence.objects.create(
                schedule=schedule,
                elderly_user=request.api_user,
                scheduled_time=scheduled_at,
                status="taken",
                confirmed_at=now,
            )

        if not already_confirmed:
            family_ids = FamilyElderly.objects.filter(
                elderly_user=request.api_user,
            ).values_list("family_user_id", flat=True)
            confirmed_time = timezone.localtime(now).strftime("%Y-%m-%d %H:%M")
            scheduled_time = timezone.localtime(record.scheduled_time).strftime("%Y-%m-%d %H:%M")
            Notifications.objects.bulk_create([
                Notifications(
                    user_id=family_id,
                    notification_type="medication",
                    title="Medication update",
                    message=(
                        f"{request.api_user.full_name} confirmed taking "
                        f"{schedule.medication_name} scheduled for {scheduled_time} "
                        f"at {confirmed_time}."
                    ),
                    is_read=0,
                    created_at=now,
                ) for family_id in family_ids
            ])
            _record_admin_action(
                request.api_user,
                "medication_dose_confirmed",
                f"User ID {request.api_user.user_id} confirmed adherence record ID {record.adherence_id} for schedule ID {schedule.schedule_id}.",
            )

    return JsonResponse({
        "message": "Medication marked as taken",
        "schedule_id": schedule.schedule_id,
        "adherence_id": record.adherence_id,
        "status": record.status,
        "scheduled_time": record.scheduled_time.isoformat(),
        "confirmed_at": record.confirmed_at.isoformat(),
        "already_confirmed": already_confirmed,
    }, status=200 if already_confirmed else 201)


@_session_required("elderly")
def pill_schedules_api(request):
    if request.method not in {"POST", "PATCH"}:
        return _method_not_allowed(["POST", "PATCH"])
    body, error = _read_json(request)
    if error:
        return error
    if request.method == "PATCH":
        schedule_id = _id_from(body, "schedule_id")
        schedule = PillSchedules.objects.filter(
            schedule_id=schedule_id, elderly_user=request.api_user,
            status__in=ACTIVE_MEDICATION_STATUSES,
        ).first() if schedule_id else None
        if not schedule:
            return JsonResponse({"error": "Medication schedule not found"}, status=404)
        with transaction.atomic():
            error_message = _set_medication_schedule_mode(
                schedule, request.api_user, body.get("frequency"), body.get("schedule_date")
            )
            if not error_message:
                _record_admin_action(
                    request.api_user,
                    "medication_schedule_updated",
                    f"User ID {request.api_user.user_id} updated medication schedule ID {schedule.schedule_id}.",
                )
        if error_message:
            return JsonResponse({"error": error_message}, status=400)
        return JsonResponse({"message": "Medication schedule updated", "schedule_id": schedule.schedule_id, "frequency": "once" if schedule.status == "active_once" else "daily", "scheduled_date": body.get("schedule_date") if schedule.status == "active_once" else None})
    name = str(body.get("medication_name") or "").strip()
    dosage = str(body.get("dosage") or "").strip()
    raw_time = str(body.get("dosage_time") or "").strip()
    raw_date = str(body.get("schedule_date") or "").strip()
    if not name or not raw_time:
        return JsonResponse({"error": "Medication name and time are required"}, status=400)
    if not raw_date:
        return JsonResponse({"error": "Choose a date for this medication"}, status=400)
    try:
        dosage_time = datetime_time.fromisoformat(raw_time)
    except ValueError:
        return JsonResponse({"error": "Time must use HH:MM format"}, status=400)
    schedule_date = None
    if raw_date:
        try:
            schedule_date = datetime_date.fromisoformat(raw_date)
        except ValueError:
            return JsonResponse({"error": "Enter a valid schedule date"}, status=400)
        if schedule_date < timezone.localdate():
            return JsonResponse({"error": "A one-day medication must be assigned for today or a future date"}, status=400)
    with transaction.atomic():
        schedule = PillSchedules.objects.create(
            elderly_user=request.api_user,
            medication_name=name[:100],
            dosage=dosage[:100] or None,
            dosage_time=dosage_time,
            status="active_once" if schedule_date else "active",
        )
        if schedule_date:
            scheduled_at = timezone.make_aware(
                datetime_datetime.combine(schedule_date, dosage_time),
                timezone.get_current_timezone(),
            )
            MedicationAdherence.objects.create(
                schedule=schedule, elderly_user=request.api_user,
                scheduled_time=scheduled_at, status="scheduled",
            )
        _record_admin_action(
            request.api_user,
            "medication_schedule_created",
            f"User ID {request.api_user.user_id} created medication schedule ID {schedule.schedule_id}.",
        )
    return JsonResponse({
        "message": "One-day medication reminder added",
        "schedule_id": schedule.schedule_id,
        "medication_name": schedule.medication_name,
        "dosage": schedule.dosage,
        "dosage_time": schedule.dosage_time.isoformat(),
        "frequency": "once",
        "scheduled_date": schedule_date.isoformat(),
        "taken_today": False,
    }, status=201)


@_session_required("chw")
def chw_medications_api(request):
    """List schedules for a CHW's assigned elders or add one for an assigned elder."""
    assigned_ids = ChwAssignments.objects.filter(
        chw_user=request.api_user,
        status__in=["active", "ACTIVE", ""],
    ).values_list("elderly_user_id", flat=True)

    if request.method == "GET":
        assignments = ChwAssignments.objects.filter(
            chw_user=request.api_user,
            status__in=["active", "ACTIVE", ""],
        ).select_related("elderly_user").order_by("elderly_user__full_name")
        profiles = {
            profile.user_id: profile
            for profile in ElderlyProfiles.objects.filter(user_id__in=assigned_ids)
        }
        adherence_summaries = {
            row["elderly_user_id"]: row
            for row in MedicationAdherence.objects.filter(elderly_user_id__in=assigned_ids)
            .exclude(status="cancelled")
            .values("elderly_user_id")
            .annotate(
                recorded_doses=Count("adherence_id"),
                confirmed_doses=Count("adherence_id", filter=Q(status="taken")),
                scheduled_doses=Count("adherence_id", filter=Q(status="scheduled")),
            )
        }
        patients = []
        for assignment in assignments:
            profile = profiles.get(assignment.elderly_user_id)
            adherence = adherence_summaries.get(assignment.elderly_user_id, {})
            patients.append({
                "elderly_user_id": assignment.elderly_user_id,
                "elderly_name": assignment.elderly_user.full_name,
                "phone": assignment.elderly_user.phone,
                "status": assignment.status or "active",
                "address": profile.address if profile else "",
                "age": _age_from_date_of_birth(profile.date_of_birth) if profile else None,
                "adherence": {
                    "recorded_doses": adherence.get("recorded_doses", 0),
                    "confirmed_doses": adherence.get("confirmed_doses", 0),
                    "scheduled_doses": adherence.get("scheduled_doses", 0),
                },
            })
        schedules = PillSchedules.objects.filter(
            elderly_user_id__in=assigned_ids,
            status__in=ACTIVE_MEDICATION_STATUSES,
        ).select_related("elderly_user").order_by(
            "elderly_user__full_name", "dosage_time", "schedule_id",
        )
        one_time_ids = [item.schedule_id for item in schedules if item.status == "active_once"]
        one_time_records = _one_time_schedule_records(one_time_ids, assigned_ids)
        medications = [{
            "schedule_id": item.schedule_id,
            "elderly_user_id": item.elderly_user_id,
            "elderly_name": item.elderly_user.full_name,
            "medication_name": item.medication_name,
            "dosage": item.dosage or "",
            "dosage_time": item.dosage_time.isoformat(),
            "status": item.status or "active",
            "frequency": "once" if item.status == "active_once" else "daily",
            "scheduled_date": timezone.localtime(one_time_records[item.schedule_id].scheduled_time).date().isoformat()
                if item.schedule_id in one_time_records else None,
        } for item in schedules]
        adherence_records = list(MedicationAdherence.objects.filter(
            elderly_user_id__in=assigned_ids,
        ).exclude(status="cancelled").select_related(
            "schedule", "elderly_user",
        ).order_by("-scheduled_time", "-adherence_id").values(
            "adherence_id", "elderly_user_id", "elderly_user__full_name",
            "schedule_id", "schedule__medication_name", "scheduled_time",
            "status", "confirmed_at",
        )[:100])
        return JsonResponse({"patients": patients, "medications": medications, "adherence": adherence_records})

    if request.method not in {"POST", "PATCH"}:
        return _method_not_allowed(["GET", "POST", "PATCH"])

    body, error = _read_json(request)
    if error:
        return error
    if request.method == "PATCH":
        schedule_id = _id_from(body, "schedule_id")
        with transaction.atomic():
            schedule = PillSchedules.objects.select_for_update().filter(
                schedule_id=schedule_id, elderly_user_id__in=assigned_ids,
                status__in=ACTIVE_MEDICATION_STATUSES,
            ).first() if schedule_id else None
            if not schedule:
                return JsonResponse({"error": "Medication schedule not found for your assigned elders"}, status=404)
            error_message = _set_medication_schedule_mode(
                schedule, schedule.elderly_user, body.get("frequency"), body.get("schedule_date")
            )
            if not error_message:
                _record_admin_action(
                    request.api_user,
                    "medication_schedule_updated",
                    f"CHW user ID {request.api_user.user_id} updated medication schedule ID {schedule.schedule_id} for elder user ID {schedule.elderly_user_id}.",
                )
        if error_message:
            return JsonResponse({"error": error_message}, status=400)
        return JsonResponse({"message": "Medication schedule updated", "schedule_id": schedule.schedule_id, "frequency": "once" if schedule.status == "active_once" else "daily", "scheduled_date": body.get("schedule_date") if schedule.status == "active_once" else None})
    elderly_id = _id_from(body, "elderly_user_id")
    elderly = Users.objects.filter(
        user_id=elderly_id,
        role="elderly",
        user_id__in=assigned_ids,
    ).first() if elderly_id else None
    if not elderly:
        return JsonResponse({"error": "Select an elder assigned to your CHW account"}, status=403)

    medication_name = str(body.get("medication_name") or "").strip()
    dosage = str(body.get("dosage") or "").strip()
    raw_time = str(body.get("dosage_time") or "").strip()
    raw_date = str(body.get("schedule_date") or "").strip()
    if not medication_name or not raw_time:
        return JsonResponse({"error": "Medication name and time are required"}, status=400)
    if not raw_date:
        return JsonResponse({"error": "Choose a date for this medication"}, status=400)
    try:
        dosage_time = datetime_time.fromisoformat(raw_time)
    except ValueError:
        return JsonResponse({"error": "Time must use HH:MM format"}, status=400)
    schedule_date = None
    if raw_date:
        try:
            schedule_date = datetime_date.fromisoformat(raw_date)
        except ValueError:
            return JsonResponse({"error": "Enter a valid schedule date"}, status=400)
        if schedule_date < timezone.localdate():
            return JsonResponse({"error": "A one-day medication must be assigned for today or a future date"}, status=400)
    with transaction.atomic():
        schedule = PillSchedules.objects.create(
            elderly_user=elderly,
            medication_name=medication_name[:100],
            dosage=dosage[:100] or None,
            dosage_time=dosage_time,
            status="active_once" if schedule_date else "active",
        )
        if schedule_date:
            scheduled_at = timezone.make_aware(
                datetime_datetime.combine(schedule_date, dosage_time),
                timezone.get_current_timezone(),
            )
            MedicationAdherence.objects.create(
                schedule=schedule, elderly_user=elderly,
                scheduled_time=scheduled_at, status="scheduled",
            )
        _record_admin_action(
            request.api_user,
            "medication_schedule_created",
            f"CHW user ID {request.api_user.user_id} created medication schedule ID {schedule.schedule_id} for elder user ID {elderly.user_id}.",
        )
    Notifications.objects.create(
        user=elderly,
        notification_type="medication",
        title="Medication schedule added",
        message=f"{schedule.medication_name} is scheduled for {schedule_date.isoformat()} at {dosage_time.strftime('%H:%M')}.",
        is_read=0,
        created_at=timezone.now(),
    )
    return JsonResponse({
        "message": f"One-day medication schedule added for {elderly.full_name}",
        "schedule": {
            "schedule_id": schedule.schedule_id,
            "elderly_user_id": elderly.user_id,
            "elderly_name": elderly.full_name,
            "medication_name": schedule.medication_name,
            "dosage": schedule.dosage or "",
            "dosage_time": schedule.dosage_time.isoformat(),
            "status": schedule.status,
            "frequency": "once",
            "scheduled_date": schedule_date.isoformat(),
        },
    }, status=201)


@_session_required("chw")
def chw_visits_api(request):
    chw = request.api_user
    assigned_ids = ChwAssignments.objects.filter(
        chw_user=chw, status__in=["active", "ACTIVE", ""]
    ).values_list("elderly_user_id", flat=True)
    if request.method == "GET":
        visits = ChwVisits.objects.filter(
            chw_user=chw, elderly_user_id__in=assigned_ids
        ).select_related("elderly_user").order_by("visit_date", "visit_id")
        return JsonResponse({"visits": [{
            "visit_id": item.visit_id, "elderly_user_id": item.elderly_user_id,
            "elderly_name": item.elderly_user.full_name,
            "visit_date": item.visit_date, "status": item.status or "scheduled",
            "notes": item.notes or "", "follow_up_required": bool(item.follow_up_required),
        } for item in visits]})
    if request.method not in {"POST", "PATCH"}:
        return _method_not_allowed(["GET", "POST", "PATCH"])
    body, error = _read_json(request)
    if error:
        return error
    if request.method == "POST":
        elderly_id = _id_from(body, "elderly_user_id")
        elder = Users.objects.filter(user_id=elderly_id, role="elderly", user_id__in=assigned_ids).first() if elderly_id else None
        if not elder:
            return JsonResponse({"error": "Select an elder assigned to your CHW account"}, status=403)
        raw_date = str(body.get("visit_date") or "").strip()
        try:
            visit_date = datetime_datetime.fromisoformat(raw_date)
            if timezone.is_naive(visit_date):
                visit_date = timezone.make_aware(visit_date, timezone.get_current_timezone())
        except (TypeError, ValueError):
            return JsonResponse({"error": "Enter a valid visit date and time"}, status=400)
        with transaction.atomic():
            visit = ChwVisits.objects.create(chw_user=chw, elderly_user=elder, visit_date=visit_date,
                status="scheduled", notes=str(body.get("notes") or "").strip()[:255] or None,
                follow_up_required=1 if body.get("follow_up_required") else 0)
            _record_admin_action(
                chw,
                "chw_visit_created",
                f"CHW user ID {chw.user_id} created visit ID {visit.visit_id} for elder user ID {elder.user_id}.",
            )
        message = f"A Community Health Worker visit is scheduled for {timezone.localtime(visit_date).strftime('%Y-%m-%d %H:%M')}"
        recipient_ids = set(FamilyElderly.objects.filter(elderly_user=elder).values_list("family_user_id", flat=True)) | {elder.user_id}
        Notifications.objects.bulk_create([Notifications(user_id=recipient_id, notification_type="visit", title="CHW visit scheduled", message=message, is_read=0, created_at=timezone.now()) for recipient_id in recipient_ids])
        return JsonResponse({"message": "Visit scheduled", "visit_id": visit.visit_id}, status=201)
    visit_id = _id_from(body, "visit_id")
    visit = ChwVisits.objects.filter(visit_id=visit_id, chw_user=chw, elderly_user_id__in=assigned_ids).first() if visit_id else None
    if not visit:
        return JsonResponse({"error": "Visit not found for your assigned elders"}, status=404)
    status = str(body.get("status") or "").strip().lower()
    if status and status not in {"scheduled", "completed", "cancelled", "missed"}:
        return JsonResponse({"error": "Visit status must be scheduled, completed, cancelled, or missed"}, status=400)
    changed = []
    if status:
        visit.status = status
        changed.append("status")
    if "visit_date" in body:
        try:
            new_date = datetime_datetime.fromisoformat(str(body["visit_date"]))
            visit.visit_date = timezone.make_aware(new_date, timezone.get_current_timezone()) if timezone.is_naive(new_date) else new_date
        except (TypeError, ValueError):
            return JsonResponse({"error": "Enter a valid visit date and time"}, status=400)
        changed.append("visit_date")
    if "notes" in body:
        visit.notes = str(body.get("notes") or "").strip()[:255] or None
        changed.append("notes")
    if "follow_up_required" in body:
        visit.follow_up_required = 1 if body.get("follow_up_required") else 0
        changed.append("follow_up_required")
    if not changed:
        return JsonResponse({"error": "Provide a visit field to update"}, status=400)
    with transaction.atomic():
        visit.save(update_fields=changed)
        _record_admin_action(
            chw,
            "chw_visit_updated",
            f"CHW user ID {chw.user_id} updated visit ID {visit.visit_id}; changed fields: {', '.join(changed)}.",
        )
    recipient_ids = set(FamilyElderly.objects.filter(elderly_user_id=visit.elderly_user_id).values_list("family_user_id", flat=True)) | {visit.elderly_user_id}
    Notifications.objects.bulk_create([Notifications(
        user_id=recipient_id, notification_type="visit", title="CHW visit updated",
        message=f"A Community Health Worker visit is now {visit.status or 'scheduled'} for {timezone.localtime(visit.visit_date).strftime('%Y-%m-%d %H:%M')}.",
        is_read=0, created_at=timezone.now(),
    ) for recipient_id in recipient_ids])
    return JsonResponse({"message": "Visit updated", "visit_id": visit.visit_id, "status": visit.status, "visit_date": visit.visit_date})


@_session_required("elderly")
def emergency_sos_api(request):
    if request.method != "POST":
        return _method_not_allowed(["POST"])
    body, error = _read_json(request)
    if error:
        return error

    user = request.api_user
    with transaction.atomic():
        # Lock the elderly account so simultaneous repeat submissions cannot create
        # multiple active SOS records for the same person.
        Users.objects.select_for_update().get(user_id=user.user_id)
        existing = EmergencySosLogs.objects.select_for_update().filter(
            elderly_user=user,
            status__in=["active", "acknowledged", "responding", "ACTIVE", "ACKNOWLEDGED", "RESPONDING"],
        ).order_by("-activated_at", "-sos_id").first()
        if existing:
            return JsonResponse({
                "message": "An active emergency request is already recorded.",
                "sos_id": existing.sos_id,
                "already_active": True,
            }, status=200)
        sos = EmergencySosLogs.objects.create(
            elderly_user=user,
            activated_at=timezone.now(),
            latitude=body.get("latitude") or None,
            longitude=body.get("longitude") or None,
            status="active",
            response_notes="Emergency request created from the KhayaConnect website",
        )
        recipient_ids = set(FamilyElderly.objects.filter(
            elderly_user=user
        ).values_list("family_user_id", flat=True))
        recipient_ids.update(ChwAssignments.objects.filter(
            elderly_user=user,
            status__in=["active", "ACTIVE", ""],
        ).values_list("chw_user_id", flat=True))
        clinic_ids = ElderlyClinic.objects.filter(
            elderly_user=user, status__in=["active", "ACTIVE", ""]
        ).values_list("clinic_id", flat=True)
        recipient_ids.update(ClinicStaff.objects.filter(
            clinic_id__in=clinic_ids, status__in=["active", "ACTIVE", ""]
        ).values_list("staff_user_id", flat=True))
        recipient_ids.update(Users.objects.filter(role="admin").values_list("user_id", flat=True))
        now = timezone.now()
        Notifications.objects.bulk_create([
            Notifications(
                user_id=recipient_id,
                notification_type="emergency",
                title="Emergency assistance requested",
                message=f"{user.full_name} has requested urgent assistance.",
                is_read=0,
                created_at=now,
            ) for recipient_id in recipient_ids
        ])
        _record_admin_action(
            user,
            "emergency_sos_created",
            f"Elderly user ID {user.user_id} created SOS record ID {sos.sos_id}.",
        )
    return JsonResponse({
        "message": "Emergency request recorded and in-app notifications created for the linked care team and administrators",
        "sos_id": sos.sos_id,
    }, status=201)


def family_elderly_api(request):
    user = _session_user(request)
    if not user:
        return JsonResponse({"error": "Please sign in to continue"}, status=401)

    if request.method == "GET":
        if user.role not in {"admin", "family", "elderly"}:
            return JsonResponse({"error": "You are not allowed to view family relationships"}, status=403)
        records = FamilyElderly.objects.select_related(
            "family_user", "elderly_user"
        ).order_by("family_user__full_name", "elderly_user__full_name")
        if user.role == "family":
            records = records.filter(family_user=user)
        elif user.role == "elderly":
            records = records.filter(elderly_user=user)
        family_user_id = request.GET.get("family_user_id")
        elderly_user_id = request.GET.get("elderly_user_id")
        if family_user_id:
            records = records.filter(family_user_id=family_user_id)
        if elderly_user_id:
            records = records.filter(elderly_user_id=elderly_user_id)

        data = [{
            "family_user_id": item.family_user_id,
            "family_name": item.family_user.full_name,
            "elderly_user_id": item.elderly_user_id,
            "elderly_name": item.elderly_user.full_name,
            "relationship_type": item.relationship_type,
        } for item in records]
        return JsonResponse(data, safe=False)

    if request.method != "POST":
        return _method_not_allowed(["GET", "POST"])
    if user.role != "admin":
        return JsonResponse({"error": "Only administrators can change family relationships"}, status=403)

    body, error = _read_json(request)
    if error:
        return error
    family_id = _id_from(body, "family_user_id")
    elderly_id = _id_from(body, "elderly_user_id")
    if not family_id or not elderly_id:
        return JsonResponse(
            {"error": "Family member and elderly user are required"}, status=400
        )
    family = _get_role_user(family_id, "family")
    elderly = _get_role_user(elderly_id, "elderly")
    if not family or not elderly:
        return JsonResponse(
            {"error": "Selected users must exist and have family and elderly roles"},
            status=400,
        )

    try:
        with transaction.atomic():
            FamilyElderly.objects.create(
                family_user=family,
                elderly_user=elderly,
                relationship_type=str(body.get("relationship_type") or "").strip() or None,
            )
            _record_admin_action(
                user,
                "family_elderly_linked",
                f"Linked family user ID {family.user_id} to elderly user ID {elderly.user_id}.",
            )
    except IntegrityError:
        return JsonResponse(
            {"error": "This family member and elderly user are already connected"},
            status=400,
        )
    return JsonResponse({
        "message": "Family member connected to elderly user successfully",
        "family_user_id": family.user_id,
        "elderly_user_id": elderly.user_id,
    }, status=201)


@_session_required("admin")
def clinics_api(request):
    if request.method == "GET":
        clinics = Clinics.objects.all().order_by("clinic_name", "clinic_id")
        return JsonResponse([{
            "clinic_id": clinic.clinic_id,
            "clinic_name": clinic.clinic_name,
            "address": clinic.address,
            "phone": clinic.phone,
            "status": clinic.status or "active",
        } for clinic in clinics], safe=False)

    if request.method != "POST":
        return _method_not_allowed(["GET", "POST"])

    body, error = _read_json(request)
    if error:
        return error
    clinic_name = str(body.get("clinic_name") or "").strip()
    address = str(body.get("address") or "").strip()
    phone = str(body.get("phone") or "").strip()
    if not clinic_name or not address or not phone:
        return JsonResponse(
            {"error": "Clinic name, address, and phone are required"}, status=400
        )

    with transaction.atomic():
        clinic = Clinics.objects.create(
            clinic_name=clinic_name,
            address=address,
            phone=phone,
            status="active",
        )
        _record_admin_action(
            request.api_user,
            "clinic_created",
            f"Created clinic ID {clinic.clinic_id}.",
        )
    return JsonResponse({
        "message": "Clinic registered successfully",
        "clinic_id": clinic.clinic_id,
        "clinic_name": clinic.clinic_name,
        "address": clinic.address,
        "phone": clinic.phone,
        "status": clinic.status,
    }, status=201)


@_session_required("admin")
def chw_assignments_api(request):
    if request.method == "GET":
        assignments = ChwAssignments.objects.select_related(
            "chw_user", "elderly_user"
        ).order_by("elderly_user__full_name")
        chw_user_id = request.GET.get("chw_user_id")
        if chw_user_id:
            assignments = assignments.filter(chw_user_id=chw_user_id)

        profiles = {
            profile.user_id: profile
            for profile in ElderlyProfiles.objects.filter(
                user_id__in=[item.elderly_user_id for item in assignments]
            )
        }
        data = []
        for item in assignments:
            profile = profiles.get(item.elderly_user_id)
            data.append({
                "assignment_id": item.assignment_id,
                "chw_user_id": item.chw_user_id,
                "chw_name": item.chw_user.full_name,
                "elderly_user_id": item.elderly_user_id,
                "elderly_name": item.elderly_user.full_name,
                "assignment_date": item.assignment_date.isoformat() if item.assignment_date else None,
                "status": item.status or "active",
                "address": profile.address if profile else "",
                "age": _age_from_date_of_birth(profile.date_of_birth) if profile else None,
            })
        return JsonResponse(data, safe=False)

    if request.method != "POST":
        return _method_not_allowed(["GET", "POST"])

    body, error = _read_json(request)
    if error:
        return error
    chw_id = _id_from(body, "chw_user_id")
    elderly_id = _id_from(body, "elderly_user_id")
    chw = _get_role_user(chw_id, "chw")
    elderly = _get_role_user(elderly_id, "elderly")
    if not chw or not elderly:
        return JsonResponse(
            {"error": "Selected users must exist and have CHW and elderly roles"},
            status=400,
        )
    try:
        with transaction.atomic():
            assignment = ChwAssignments.objects.create(
                chw_user=chw,
                elderly_user=elderly,
                assignment_date=timezone.localdate(),
                status="active",
            )
            _record_admin_action(
                request.api_user,
                "chw_elderly_linked",
                f"Linked CHW user ID {chw.user_id} to elderly user ID {elderly.user_id}.",
            )
    except IntegrityError:
        return JsonResponse(
            {"error": "This CHW and elderly user are already connected"}, status=400
        )
    return JsonResponse({
        "message": "CHW connected to elderly user successfully",
        "assignment_id": assignment.assignment_id,
        "chw_user_id": chw.user_id,
        "elderly_user_id": elderly.user_id,
    }, status=201)


@_session_required("admin")
def elderly_clinics_api(request):
    if request.method == "GET":
        assignments = ElderlyClinic.objects.select_related(
            "elderly_user", "clinic"
        ).order_by("elderly_user__full_name", "clinic__clinic_name")
        data = [{
            "elderly_clinic_id": item.elderly_clinic_id,
            "elderly_user_id": item.elderly_user_id,
            "elderly_name": item.elderly_user.full_name,
            "clinic_id": item.clinic_id,
            "clinic_name": item.clinic.clinic_name,
            "assigned_date": item.assigned_date.isoformat() if item.assigned_date else None,
            "status": item.status or "active",
        } for item in assignments]
        return JsonResponse(data, safe=False)

    if request.method != "POST":
        return _method_not_allowed(["GET", "POST"])

    body, error = _read_json(request)
    if error:
        return error
    elderly_id = _id_from(body, "elderly_user_id")
    clinic_id = _id_from(body, "clinic_id")
    elderly = _get_role_user(elderly_id, "elderly")
    clinic = Clinics.objects.filter(clinic_id=clinic_id).first() if clinic_id else None
    if not elderly or not clinic:
        return JsonResponse(
            {"error": "Select an existing elderly user and clinic"}, status=400
        )
    try:
        with transaction.atomic():
            assignment = ElderlyClinic.objects.create(
                elderly_user=elderly,
                clinic=clinic,
                assigned_date=timezone.localdate(),
                status="active",
            )
            _record_admin_action(
                request.api_user,
                "elderly_clinic_linked",
                f"Linked elderly user ID {elderly.user_id} to clinic ID {clinic.clinic_id}.",
            )
    except IntegrityError:
        return JsonResponse(
            {"error": "This elderly user is already connected to that clinic"},
            status=400,
        )
    return JsonResponse({
        "message": "Elderly user connected to clinic successfully",
        "elderly_clinic_id": assignment.elderly_clinic_id,
        "elderly_user_id": elderly.user_id,
        "clinic_id": clinic.clinic_id,
    }, status=201)


@_session_required("admin")
def clinic_staff_api(request):
    if request.method == "GET":
        assignments = ClinicStaff.objects.select_related(
            "staff_user", "clinic"
        ).order_by("staff_user__full_name", "clinic__clinic_name")
        data = [{
            "staff_id": item.staff_id,
            "staff_user_id": item.staff_user_id,
            "staff_name": item.staff_user.full_name,
            "clinic_id": item.clinic_id,
            "clinic_name": item.clinic.clinic_name,
            "position": item.position,
            "status": item.status or "active",
        } for item in assignments]
        return JsonResponse(data, safe=False)

    if request.method != "POST":
        return _method_not_allowed(["GET", "POST"])

    body, error = _read_json(request)
    if error:
        return error
    staff_id = _id_from(body, "staff_user_id")
    clinic_id = _id_from(body, "clinic_id")
    staff = _get_role_user(staff_id, "clinic")
    clinic = Clinics.objects.filter(clinic_id=clinic_id).first() if clinic_id else None
    if not staff or not clinic:
        return JsonResponse(
            {"error": "Select an existing clinic staff user and clinic"}, status=400
        )
    try:
        with transaction.atomic():
            assignment = ClinicStaff.objects.create(
                staff_user=staff,
                clinic=clinic,
                position=str(body.get("position") or "").strip() or None,
                status="active",
            )
            _record_admin_action(
                request.api_user,
                "clinic_staff_linked",
                f"Linked clinic staff user ID {staff.user_id} to clinic ID {clinic.clinic_id}.",
            )
    except IntegrityError:
        return JsonResponse(
            {"error": "This staff member is already connected to that clinic"},
            status=400,
        )
    return JsonResponse({
        "message": "Clinic staff connected to clinic successfully",
        "staff_id": assignment.staff_id,
        "staff_user_id": staff.user_id,
        "clinic_id": clinic.clinic_id,
    }, status=201)


@_session_required("admin")
def elderly_clinic_staff_api(request):
    """Link staff to elders through their shared clinic using existing join tables."""
    active = ["active", "ACTIVE", ""]
    if request.method == "GET":
        links = []
        elderly_clinic_links = ElderlyClinic.objects.filter(status__in=active).select_related("elderly_user", "clinic")
        for elder_link in elderly_clinic_links:
            staff_links = ClinicStaff.objects.filter(clinic=elder_link.clinic, status__in=active).select_related("staff_user")
            for staff_link in staff_links:
                links.append({
                    "elderly_user_id": elder_link.elderly_user_id,
                    "elderly_name": elder_link.elderly_user.full_name,
                    "staff_user_id": staff_link.staff_user_id,
                    "staff_name": staff_link.staff_user.full_name,
                    "clinic_id": elder_link.clinic_id,
                    "clinic_name": elder_link.clinic.clinic_name,
                })
        return JsonResponse(links, safe=False)
    if request.method != "POST":
        return _method_not_allowed(["GET", "POST"])
    body, error = _read_json(request)
    if error:
        return error
    elder = _get_role_user(_id_from(body, "elderly_user_id"), "elderly")
    staff = _get_role_user(_id_from(body, "staff_user_id"), "clinic")
    clinic = Clinics.objects.filter(clinic_id=_id_from(body, "clinic_id")).first()
    if not elder or not staff or not clinic:
        return JsonResponse({"error": "Select an existing elder, clinic staff member, and clinic"}, status=400)
    with transaction.atomic():
        elder_link = ElderlyClinic.objects.filter(elderly_user=elder, clinic=clinic).first()
        if elder_link:
            if elder_link.status not in active:
                elder_link.status = "active"
                elder_link.save(update_fields=["status"])
        else:
            elder_link = ElderlyClinic.objects.create(elderly_user=elder, clinic=clinic, assigned_date=timezone.localdate(), status="active")
        staff_link = ClinicStaff.objects.filter(staff_user=staff, clinic=clinic).first()
        if staff_link:
            if staff_link.status not in active:
                staff_link.status = "active"
                staff_link.save(update_fields=["status"])
        else:
            ClinicStaff.objects.create(staff_user=staff, clinic=clinic, status="active")
        _record_admin_action(
            request.api_user,
            "elderly_clinic_staff_linked",
            f"Linked elderly user ID {elder.user_id} and clinic staff user ID {staff.user_id} through clinic ID {clinic.clinic_id}.",
        )
    return JsonResponse({
        "message": "Clinic staff linked to the elder through their clinic",
        "elderly_user_id": elder.user_id, "staff_user_id": staff.user_id,
        "clinic_id": clinic.clinic_id, "elderly_clinic_id": elder_link.elderly_clinic_id,
    }, status=201)


@_session_required()
def emergency_responses_api(request):
    user = request.api_user
    if request.method == "GET":
        sos_records = EmergencySosLogs.objects.all()
        if user.role == "family":
            elderly_ids = FamilyElderly.objects.filter(family_user=user).values_list("elderly_user_id", flat=True)
            sos_records = sos_records.filter(elderly_user_id__in=elderly_ids)
        elif user.role == "chw":
            elderly_ids = ChwAssignments.objects.filter(chw_user=user, status__in=["active", "ACTIVE", ""]).values_list("elderly_user_id", flat=True)
            sos_records = sos_records.filter(elderly_user_id__in=elderly_ids)
        elif user.role == "clinic":
            clinic_ids = ClinicStaff.objects.filter(staff_user=user, status__in=["active", "ACTIVE", ""]).values_list("clinic_id", flat=True)
            elderly_ids = ElderlyClinic.objects.filter(clinic_id__in=clinic_ids, status__in=["active", "ACTIVE", ""]).values_list("elderly_user_id", flat=True)
            sos_records = sos_records.filter(elderly_user_id__in=elderly_ids)
        elif user.role == "elderly":
            elderly_ids = [user.user_id]
            sos_records = sos_records.filter(elderly_user=user)
        elif user.role == "admin":
            elderly_ids = Users.objects.filter(role="elderly").values_list("user_id", flat=True)
        else:
            return JsonResponse({"error": "Not allowed to view emergency responses"}, status=403)
        output = []
        for item in sos_records.select_related("elderly_user").order_by("-activated_at")[:100]:
            output.append({
                "sos_id": item.sos_id, "elderly_user_id": item.elderly_user_id,
                "elderly_name": item.elderly_user.full_name, "activated_at": item.activated_at,
                "status": item.status, "resolved_at": item.resolved_at,
                "response_notes": item.response_notes,
                "responses": list(EmergencyResponses.objects.filter(sos=item).select_related("responder_user").order_by("response_time").values("response_id", "responder_user__full_name", "response_time", "response_action", "outcome")),
            })
        risks = list(RiskAlerts.objects.filter(
            elderly_user_id__in=elderly_ids,
        ).select_related("elderly_user").order_by(
            "-created_at", "-alert_id",
        ).values(
            "alert_id", "elderly_user_id", "elderly_user__full_name",
            "alert_type", "severity", "description", "created_at",
            "status", "resolved_at",
        )[:100])
        return JsonResponse({"emergencies": output, "risks": risks})
    if request.method != "POST":
        return _method_not_allowed(["GET", "POST"])
    if user.role not in {"admin", "family", "chw", "clinic"}:
        return JsonResponse({"error": "Only an authorised care responder may respond"}, status=403)
    body, error = _read_json(request)
    if error:
        return error
    sos_id = _id_from(body, "sos_id")
    action = str(body.get("response_action") or "").strip()
    outcome = str(body.get("outcome") or "").strip()
    new_status = str(body.get("status") or "").strip().lower()
    if not action or new_status not in {"acknowledged", "responding", "resolved"}:
        return JsonResponse({"error": "Provide a response action and status: acknowledged, responding, or resolved"}, status=400)
    with transaction.atomic():
        sos = EmergencySosLogs.objects.select_for_update().filter(sos_id=sos_id).first() if sos_id else None
        if not sos:
            return JsonResponse({"error": "Emergency record not found"}, status=404)
        allowed = user.role == "admin"
        if user.role == "family":
            allowed = FamilyElderly.objects.filter(family_user=user, elderly_user_id=sos.elderly_user_id).exists()
        elif user.role == "chw":
            allowed = ChwAssignments.objects.filter(chw_user=user, elderly_user_id=sos.elderly_user_id, status__in=["active", "ACTIVE", ""]).exists()
        elif user.role == "clinic":
            clinic_ids = ClinicStaff.objects.filter(staff_user=user, status__in=["active", "ACTIVE", ""]).values_list("clinic_id", flat=True)
            allowed = ElderlyClinic.objects.filter(clinic_id__in=clinic_ids, elderly_user_id=sos.elderly_user_id, status__in=["active", "ACTIVE", ""]).exists()
        if not allowed:
            return JsonResponse({"error": "This emergency is not linked to your account"}, status=403)
        current_status = str(sos.status or "active").lower()
        if current_status in {"resolved", "cancelled"}:
            return JsonResponse({"error": "This emergency is already closed"}, status=409)
        allowed_transitions = {
            "active": {"acknowledged", "responding", "resolved"},
            "acknowledged": {"acknowledged", "responding", "resolved"},
            "responding": {"responding", "resolved"},
        }
        if new_status not in allowed_transitions.get(current_status, {"acknowledged", "responding", "resolved"}):
            return JsonResponse({"error": f"An emergency cannot move from {current_status} to {new_status}"}, status=409)
        response = EmergencyResponses.objects.create(sos=sos, responder_user=user, response_time=timezone.now(), response_action=action[:255], outcome=outcome[:255] or None)
        sos.status = new_status
        if new_status == "resolved":
            sos.resolved_at = timezone.now()
        sos.response_notes = outcome[:255] or action[:255]
        sos.save(update_fields=["status", "resolved_at", "response_notes"])
        recipient_ids = set(FamilyElderly.objects.filter(elderly_user_id=sos.elderly_user_id).values_list("family_user_id", flat=True))
        recipient_ids.update(ChwAssignments.objects.filter(elderly_user_id=sos.elderly_user_id, status__in=["active", "ACTIVE", ""]).values_list("chw_user_id", flat=True))
        clinic_ids = ElderlyClinic.objects.filter(elderly_user_id=sos.elderly_user_id, status__in=["active", "ACTIVE", ""]).values_list("clinic_id", flat=True)
        recipient_ids.update(ClinicStaff.objects.filter(clinic_id__in=clinic_ids, status__in=["active", "ACTIVE", ""]).values_list("staff_user_id", flat=True))
        recipient_ids.add(sos.elderly_user_id)
        recipient_ids.update(Users.objects.filter(role="admin").values_list("user_id", flat=True))
        Notifications.objects.bulk_create([Notifications(user_id=recipient, notification_type="emergency", title="Emergency response updated", message=f"{user.full_name} updated emergency {sos.sos_id}: {new_status}.", is_read=0, created_at=timezone.now()) for recipient in recipient_ids if recipient != user.user_id])
        _record_admin_action(
            user,
            "emergency_response_recorded",
            f"User ID {user.user_id} recorded response ID {response.response_id} for SOS record ID {sos.sos_id}; status: {new_status}.",
        )
    return JsonResponse({"message": "Emergency response recorded", "response_id": response.response_id, "status": sos.status, "resolved_at": sos.resolved_at}, status=201)


@_session_required()
def risk_alerts_api(request):
    """Let an authorised care team member report a risk for an elder they support."""
    if request.method != "POST":
        return _method_not_allowed(["POST"])
    user = request.api_user
    if user.role not in {"admin", "family", "chw", "clinic"}:
        return JsonResponse({"error": "Only an authorised care team member can report a risk"}, status=403)

    body, error = _read_json(request)
    if error:
        return error
    elderly_id = _id_from(body, "elderly_user_id")
    elder = Users.objects.filter(user_id=elderly_id, role="elderly").first() if elderly_id else None
    if not elder:
        return JsonResponse({"error": "Select a valid elderly account"}, status=400)

    if user.role == "family":
        allowed = FamilyElderly.objects.filter(family_user=user, elderly_user=elder).exists()
    elif user.role == "chw":
        allowed = ChwAssignments.objects.filter(
            chw_user=user, elderly_user=elder, status__in=["active", "ACTIVE", ""],
        ).exists()
    elif user.role == "clinic":
        clinic_ids = ClinicStaff.objects.filter(
            staff_user=user, status__in=["active", "ACTIVE", ""],
        ).values_list("clinic_id", flat=True)
        allowed = ElderlyClinic.objects.filter(
            clinic_id__in=clinic_ids, elderly_user=elder,
            status__in=["active", "ACTIVE", ""],
        ).exists()
    else:
        allowed = True
    if not allowed:
        return JsonResponse({"error": "This elder is not linked to your account"}, status=403)

    alert_type = str(body.get("alert_type") or "").strip().lower()
    severity = str(body.get("severity") or "").strip().lower()
    description = str(body.get("description") or "").strip()
    allowed_types = {"fall_risk", "medication_concern", "health_concern", "safety_concern", "other"}
    if alert_type not in allowed_types:
        return JsonResponse({"error": "Choose a valid risk type"}, status=400)
    if severity not in {"low", "medium", "high"}:
        return JsonResponse({"error": "Choose low, medium, or high severity"}, status=400)
    if not description:
        return JsonResponse({"error": "Describe the risk before submitting it"}, status=400)

    risk = RiskAlerts.objects.create(
        elderly_user=elder,
        alert_type=alert_type,
        severity=severity,
        description=description[:255],
        created_at=timezone.now(),
        status="active",
    )
    recipient_ids = set(Users.objects.filter(role="admin").values_list("user_id", flat=True))
    recipient_ids.update(FamilyElderly.objects.filter(elderly_user=elder).values_list("family_user_id", flat=True))
    recipient_ids.update(ChwAssignments.objects.filter(
        elderly_user=elder, status__in=["active", "ACTIVE", ""],
    ).values_list("chw_user_id", flat=True))
    clinic_ids = ElderlyClinic.objects.filter(
        elderly_user=elder, status__in=["active", "ACTIVE", ""],
    ).values_list("clinic_id", flat=True)
    recipient_ids.update(ClinicStaff.objects.filter(
        clinic_id__in=clinic_ids, status__in=["active", "ACTIVE", ""],
    ).values_list("staff_user_id", flat=True))
    recipient_ids.add(elder.user_id)
    now = timezone.now()
    Notifications.objects.bulk_create([
        Notifications(
            user_id=recipient_id,
            notification_type="risk",
            title="Care risk reported",
            message=f"{severity.title()} {alert_type.replace('_', ' ')} reported for {elder.full_name}.",
            is_read=0,
            created_at=now,
        ) for recipient_id in recipient_ids if recipient_id != user.user_id
    ])
    _record_admin_action(
        user,
        "risk_alert_created",
        f"User ID {user.user_id} reported risk alert ID {risk.alert_id} for elder user ID {elder.user_id}; severity: {severity}.",
    )
    return JsonResponse({
        "message": "Risk alert recorded and the linked care team was notified",
        "alert_id": risk.alert_id,
    }, status=201)
