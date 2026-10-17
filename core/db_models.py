# This is an auto-generated Django model module.
# You'll have to do the following manually to clean this up:
#   * Rearrange models' order
#   * Make sure each model has one field with primary_key=True
#   * Make sure each ForeignKey and OneToOneField has `on_delete` set to the desired behavior
#   * Remove `managed = False` lines if you wish to allow Django to create, modify, and delete the table
# Feel free to rename the models, but don't rename db_table values or field names.
from django.db import models


class AdminAuditLogs(models.Model):
    audit_id = models.AutoField(primary_key=True)
    admin_user = models.ForeignKey('Users', models.DO_NOTHING)
    action_type = models.CharField(max_length=50)
    description = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'admin_audit_logs'
        verbose_name = 'Audit event'
        verbose_name_plural = 'Audit events'


class AppointmentReminders(models.Model):
    reminder_id = models.AutoField(primary_key=True)
    appointment = models.ForeignKey('Appointments', models.DO_NOTHING)
    reminder_type = models.CharField(max_length=30)
    scheduled_at = models.DateTimeField()
    sent_at = models.DateTimeField(blank=True, null=True)
    status = models.CharField(max_length=20, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'appointment_reminders'


class Appointments(models.Model):
    
    appointment_id = models.AutoField(primary_key=True)
    elderly_user = models.ForeignKey('Users', models.DO_NOTHING)
    clinic_name = models.CharField(max_length=150)
    appointment_date = models.DateField()
    appointment_time = models.TimeField(blank=True, null=True)
    appointment_type = models.CharField(max_length=100, blank=True, null=True)
    status = models.CharField(max_length=20, blank=True, null=True)
    notes = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'appointments'


class ChwAssignments(models.Model):
    assignment_id = models.AutoField(primary_key=True)
    chw_user = models.ForeignKey('Users', models.DO_NOTHING)
    elderly_user = models.ForeignKey('Users', models.DO_NOTHING, related_name='chwassignments_elderly_user_set')
    assignment_date = models.DateField(blank=True, null=True)
    status = models.CharField(max_length=20, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'chw_assignments'
        unique_together = (('chw_user', 'elderly_user'),)


class ChwVisitNotes(models.Model):
    note_id = models.AutoField(primary_key=True)
    visit = models.ForeignKey('ChwVisits', models.DO_NOTHING)
    observation = models.CharField(max_length=255, blank=True, null=True)
    action_taken = models.CharField(max_length=255, blank=True, null=True)
    follow_up_date = models.DateField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'chw_visit_notes'


class ChwVisits(models.Model):
    visit_id = models.AutoField(primary_key=True)
    chw_user = models.ForeignKey('Users', models.DO_NOTHING)
    elderly_user = models.ForeignKey('Users', models.DO_NOTHING, related_name='chwvisits_elderly_user_set')
    visit_date = models.DateTimeField(blank=True, null=True)
    status = models.CharField(max_length=20, blank=True, null=True)
    notes = models.CharField(max_length=255, blank=True, null=True)
    follow_up_required = models.IntegerField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'chw_visits'


class ClinicStaff(models.Model):
    staff_id = models.AutoField(primary_key=True)
    staff_user = models.ForeignKey('Users', models.DO_NOTHING)
    clinic = models.ForeignKey('Clinics', models.DO_NOTHING)
    position = models.CharField(max_length=100, blank=True, null=True)
    status = models.CharField(max_length=20, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'clinic_staff'
        unique_together = (('staff_user', 'clinic'),)


class Clinics(models.Model):
    clinic_id = models.AutoField(primary_key=True)
    clinic_name = models.CharField(max_length=150)
    address = models.CharField(max_length=255, blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    status = models.CharField(max_length=20, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'clinics'


class ElderlyClinic(models.Model):
    elderly_clinic_id = models.AutoField(primary_key=True)
    elderly_user = models.ForeignKey('Users', models.DO_NOTHING)
    clinic = models.ForeignKey(Clinics, models.DO_NOTHING)
    assigned_date = models.DateField(blank=True, null=True)
    status = models.CharField(max_length=20, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'elderly_clinic'
        unique_together = (('elderly_user', 'clinic'),)


class ElderlyProfiles(models.Model):
    elderly_id = models.AutoField(primary_key=True)
    user = models.OneToOneField('Users', models.DO_NOTHING)
    date_of_birth = models.DateField(blank=True, null=True)
    address = models.CharField(max_length=255, blank=True, null=True)
    emergency_contact_name = models.CharField(max_length=100, blank=True, null=True)
    emergency_contact_phone = models.CharField(max_length=20, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'elderly_profiles'


class EmergencyResponses(models.Model):
    response_id = models.AutoField(primary_key=True)
    sos = models.ForeignKey('EmergencySosLogs', models.DO_NOTHING)
    responder_user = models.ForeignKey('Users', models.DO_NOTHING, blank=True, null=True)
    response_time = models.DateTimeField(blank=True, null=True)
    response_action = models.CharField(max_length=255, blank=True, null=True)
    outcome = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'emergency_responses'


class EmergencySosLogs(models.Model):
    sos_id = models.AutoField(primary_key=True)
    elderly_user = models.ForeignKey('Users', models.DO_NOTHING)
    activated_at = models.DateTimeField(blank=True, null=True)
    latitude = models.DecimalField(max_digits=10, decimal_places=7, blank=True, null=True)
    longitude = models.DecimalField(max_digits=10, decimal_places=7, blank=True, null=True)
    status = models.CharField(max_length=20, blank=True, null=True)
    resolved_at = models.DateTimeField(blank=True, null=True)
    response_notes = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'emergency_sos_logs'


class FamilyElderly(models.Model):
    pk = models.CompositePrimaryKey('family_user_id', 'elderly_user_id')
    family_user = models.ForeignKey('Users', models.DO_NOTHING)
    elderly_user = models.ForeignKey('Users', models.DO_NOTHING, related_name='familyelderly_elderly_user_set')
    relationship_type = models.CharField(max_length=50, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'family_elderly'
        unique_together = (('family_user', 'elderly_user'),)


class MedicationAdherence(models.Model):
    adherence_id = models.AutoField(primary_key=True)
    schedule = models.ForeignKey('PillSchedules', models.DO_NOTHING)
    elderly_user = models.ForeignKey('Users', models.DO_NOTHING)
    scheduled_time = models.DateTimeField()
    status = models.CharField(max_length=20, blank=True, null=True)
    confirmed_at = models.DateTimeField(blank=True, null=True)
    notes = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'medication_adherence'


class Notifications(models.Model):
    notification_id = models.AutoField(primary_key=True)
    user = models.ForeignKey('Users', models.DO_NOTHING)
    notification_type = models.CharField(max_length=50)
    title = models.CharField(max_length=150)
    message = models.CharField(max_length=255)
    is_read = models.IntegerField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'notifications'


class PillSchedules(models.Model):
    schedule_id = models.AutoField(primary_key=True)
    elderly_user = models.ForeignKey('Users', models.DO_NOTHING)
    medication_name = models.CharField(max_length=100)
    dosage = models.CharField(max_length=100, blank=True, null=True)
    dosage_time = models.TimeField()
    status = models.CharField(max_length=20, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'pill_schedules'


class RiskAlerts(models.Model):
    alert_id = models.AutoField(primary_key=True)
    elderly_user = models.ForeignKey('Users', models.DO_NOTHING)
    alert_type = models.CharField(max_length=50)
    severity = models.CharField(max_length=20, blank=True, null=True)
    description = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    status = models.CharField(max_length=20, blank=True, null=True)
    resolved_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'risk_alerts'


class SystemSettings(models.Model):
    setting_id = models.AutoField(primary_key=True)
    setting_name = models.CharField(unique=True, max_length=100)
    setting_value = models.CharField(max_length=255, blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'system_settings'


class Users(models.Model):
    user_id = models.AutoField(primary_key=True)
    full_name = models.CharField(max_length=100)
    phone = models.CharField(unique=True, max_length=20)
    password = models.CharField(max_length=255)
    role = models.CharField(max_length=30)

    class Meta:
        managed = False
        db_table = 'users'


class VitalsLogs(models.Model):
    vital_id = models.AutoField(primary_key=True)
    elderly_user = models.ForeignKey(Users, models.DO_NOTHING)
    recorded_by = models.ForeignKey(Users, models.DO_NOTHING, db_column='recorded_by', related_name='vitalslogs_recorded_by_set', blank=True, null=True)
    recorded_at = models.DateTimeField(blank=True, null=True)
    blood_pressure = models.CharField(max_length=20, blank=True, null=True)
    heart_rate = models.IntegerField(blank=True, null=True)
    temperature = models.DecimalField(max_digits=4, decimal_places=1, blank=True, null=True)
    weight = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)
    notes = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'vitals_logs'


class WellnessCheckins(models.Model):
    checkin_id = models.AutoField(primary_key=True)
    elderly_user = models.ForeignKey(Users, models.DO_NOTHING)
    recorded_by = models.ForeignKey(Users, models.DO_NOTHING, db_column='recorded_by', related_name='wellnesscheckins_recorded_by_set', blank=True, null=True)
    checkin_time = models.DateTimeField(blank=True, null=True)
    feeling = models.CharField(max_length=50, blank=True, null=True)
    notes = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'wellness_checkins'
