import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  AlertTriangle,
  Bell,
  Calendar,
  Check,
  Clock,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  HeartPulse,
  Home,
  LogOut,
  Menu,
  Pill,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  Volume2,
  X,
  Sun,
  Moon,
  RotateCcw,
  Type
} from "lucide-react";

import "../styles/ClinicDashboard.css";
import KhayaAssistant from "./KhayaAssistant";
import useDashboardSection from "./useDashboardSection";
import RecentActivity from "./RecentActivity";
import EmergencyResponsePanel from "./EmergencyResponsePanel";
import useDashboardPreferences from "./useDashboardPreferences";
import NotificationsPanel from "./NotificationsPanel";
import { useRoleNotifications } from "./useRoleNotifications";

function ClinicDashboard() {
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(null);
  const [clinicData, setClinicData] = useState({ patients: [], appointments: [], medications: [], emergencies: [] });
  const [isClinicDataLoading, setIsClinicDataLoading] = useState(true);
  const [clinicDataError, setClinicDataError] = useState("");
  const { unreadCount } = useRoleNotifications();

  useEffect(() => {
    const storedUser = localStorage.getItem("khayaConnectUser");

    if (!storedUser) return;

    try {
      setCurrentUser(JSON.parse(storedUser));
    } catch (error) {
      console.error("Invalid saved clinic staff data:", error);
    }
  }, []);

  const [appointmentOptions, setAppointmentOptions] = useState({ elderly_users: [], clinics: [] });
  const [appointmentForm, setAppointmentForm] = useState({ elderly_user_id: "", clinic_id: "", appointment_date: "", appointment_time: "", appointment_type: "", notes: "" });
  const [appointmentError, setAppointmentError] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [appointmentEdits, setAppointmentEdits] = useState({});
  const refreshAppointments = useCallback(async () => {
    const dashboardResponse = await fetch("/api/clinic-dashboard/", { credentials: "include" });
    const dashboard = await dashboardResponse.json();
    if (!dashboardResponse.ok) throw new Error(dashboard.error || "Unable to load clinic data");
    setClinicData((current) => ({ ...current, ...dashboard, patients: dashboard.patients || [], medications: dashboard.medications || [], emergencies: dashboard.emergencies || [] }));
    setClinicDataError("");
    try {
      const appointmentResponse = await fetch("/api/appointments/", { credentials: "include" });
      const scheduling = await appointmentResponse.json();
      if (!appointmentResponse.ok) throw new Error(scheduling.error || "Unable to load appointments");
      setAppointmentOptions({ elderly_users: scheduling.elderly_users || [], clinics: scheduling.clinics || [] });
      setClinicData((current) => ({ ...current, appointments: scheduling.appointments || [] }));
      setAppointmentError("");
    } catch (error) {
      setAppointmentError(error.message || "Unable to load appointments.");
    }
  }, []);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try { await refreshAppointments(); }
      catch (error) { if (active) { console.error("Error loading clinic dashboard data:", error); setClinicDataError(error.message || "Unable to load clinic records."); } }
      finally { if (active) setIsClinicDataLoading(false); }
    };
    load();
    const timer = window.setInterval(load, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [refreshAppointments]);
  const handleAppointmentSubmit = async (event) => {
    event.preventDefault(); setAppointmentError("");
    try {
      const response = await fetch("/api/appointments/", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRFToken": currentUser?.csrf_token || "" }, body: JSON.stringify(appointmentForm) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not save appointment");
      setAppointmentForm({ elderly_user_id: "", clinic_id: "", appointment_date: "", appointment_time: "", appointment_type: "", notes: "" });
      await refreshAppointments();
    } catch (error) { setAppointmentError(error.message); }
  };
  const updateAppointment = async (appointment, status) => {
    try {
      const response = await fetch("/api/appointments/", { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRFToken": currentUser?.csrf_token || "" }, body: JSON.stringify({ appointment_id: appointment.appointment_id, ...(typeof status === "string" ? { status } : status) }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not update appointment"); await refreshAppointments();
    } catch (error) { setAppointmentError(error.message); }
  };
  const [activeSection, setActiveSection, navigationGuard] = useDashboardSection("Overview", ["Overview", "Patients", "Appointments", "Medication", "Emergency Alerts", "Health Records", "Settings", "Recents", "Notifications"]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  /* =====================================================
     SETTINGS
     ===================================================== */

  const [preferences, updatePreferences] = useDashboardPreferences("clinic", { theme: "blue", darkMode: false, highContrast: false, textSize: "normal", appointmentNotifications: true, medicationNotifications: true, autoSync: true, voiceGuidance: true });
  const theme = preferences.theme;
  const darkMode = preferences.darkMode;
  const highContrast = preferences.highContrast;
  const textSize = preferences.textSize;
  const appointmentNotifications = preferences.appointmentNotifications;
  const medicationNotifications = preferences.medicationNotifications;
  const autoSync = preferences.autoSync;
  const voiceGuidance = preferences.voiceGuidance;
  const setTheme = (value) => updatePreferences("theme", value);
  const setDarkMode = (value) => updatePreferences("darkMode", value);
  const setHighContrast = (value) => updatePreferences("highContrast", value);
  const setTextSize = (value) => updatePreferences("textSize", value);
  const setAppointmentNotifications = (value) => updatePreferences("appointmentNotifications", value);
  const setMedicationNotifications = (value) => updatePreferences("medicationNotifications", value);
  const setAutoSync = (value) => updatePreferences("autoSync", value);
  const setVoiceGuidance = (value) => updatePreferences("voiceGuidance", value);

  /* =====================================================
     EMPTY DATA
     These will later come from Django + SQL.
     ===================================================== */

  const patients = clinicData.patients;
  const appointments = clinicData.appointments;
  const medications = clinicData.medications;
  const alerts = clinicData.emergencies.filter((item) => !item.resolved_at);



  /* =====================================================
     NAVIGATION
     ===================================================== */

  const menuItems = [
    {
      name: "Overview",
      icon: Home
    },
    {
      name: "Patients",
      icon: Users
    },
    {
      name: "Appointments",
      icon: Calendar
    },
    {
      name: "Medication",
      icon: Pill
    },
    {
      name: "Emergency Alerts",
      icon: AlertTriangle
    },
    {
      name: "Health Records",
      icon: ClipboardList
    },
    { name: "Recents", icon: Clock },
    { name: "Notifications", icon: Bell }
  ];

  const selectSection = (section) => {
    setActiveSection(section);
    setSidebarOpen(false);
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      const response = await fetch("/api/logout/", {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRFToken": currentUser?.csrf_token || "" },
      });
      if (!response.ok && response.status !== 401) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Unable to sign out. Please try again.");
      }
      localStorage.removeItem("khayaConnectUser");
      navigate("/", { replace: true });
    } catch (error) {
      setAppointmentError(error.message || "Unable to sign out. Please try again.");
      setIsLoggingOut(false);
    }
  };

  /* =====================================================
     THEME
     ===================================================== */

  const themeColors = {
    blue: {
      primary: "#164e63",
      primaryDark: "#123047",
      soft: "#edf5f7"
    },

    emerald: {
      primary: "#28745c",
      primaryDark: "#1f4f42",
      soft: "#edf7f2"
    },

    amber: {
      primary: "#a56a19",
      primaryDark: "#694719",
      soft: "#faf3e5"
    }
  };

  const currentTheme = themeColors[theme];

  /* =====================================================
     RESET SETTINGS
     ===================================================== */

  const resetSettings = () => {
    setTheme("blue");
    setDarkMode(false);
    setHighContrast(false);
    setTextSize("normal");

    setAppointmentNotifications(true);
    setMedicationNotifications(true);
    setAutoSync(true);
    setVoiceGuidance(true);
  };

  /* =====================================================
     ROOT CLASSES
     ===================================================== */

  const dashboardClasses = [
    "clinic-dashboard",

    darkMode ? "clinic-dark-mode" : "",

    highContrast ? "clinic-high-contrast" : "",

    `clinic-theme-${theme}`,

    `clinic-text-${textSize}`
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={dashboardClasses}
      style={{
        "--clinic-primary": currentTheme.primary,
        "--clinic-primary-dark": currentTheme.primaryDark,
        "--clinic-soft": currentTheme.soft
      }}
    >
      {/* =====================================================
          MOBILE HEADER
          ===================================================== */}

      <header className="clinic-mobile-header">

        <button
          className="clinic-menu-button"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={24} />
        </button>

        <span className="clinic-mobile-brand">
          KHAYACONNECT
        </span>

        <button
          className="clinic-mobile-notification"
          type="button"
          onClick={() => selectSection("Notifications")}
          aria-label="Notifications"
        >
          <Bell size={21} />
        </button>

      </header>


      {/* =====================================================
          SIDEBAR
          ===================================================== */}

      <aside
        className={`clinic-sidebar ${
          sidebarOpen ? "clinic-sidebar-open" : ""
        }`}
      >

        <div>

          <div className="clinic-sidebar-header">

            <div>
              <p className="clinic-sidebar-brand">
                KHAYACONNECT
              </p>

              <p className="clinic-sidebar-role">
                Clinic Staff
              </p>
            </div>

            <button
              className="clinic-close-sidebar"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
            >
              <X size={21} />
            </button>

          </div>


          <nav className="clinic-sidebar-nav">

            {menuItems.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.name}
                  className={`clinic-nav-item ${
                    activeSection === item.name
                      ? "clinic-nav-active"
                      : ""
                  }`}
                  onClick={() => selectSection(item.name)}
                >
                  <Icon size={20} />

                  <span>{item.name}</span>
                </button>
              );
            })}


            <button
              className={`clinic-nav-item ${
                activeSection === "Settings"
                  ? "clinic-nav-active"
                  : ""
              }`}
              onClick={() => selectSection("Settings")}
            >
              <Settings size={20} />

              <span>Settings</span>
            </button>

          </nav>

        </div>


        <div className="clinic-sidebar-bottom">

          {activeSection !== "Overview" && <button type="button" className="clinic-sidebar-back" onClick={() => selectSection("Overview")}><ArrowLeft size={17} /><span>Back to dashboard</span></button>}

          <div className="clinic-sidebar-profile">
            <div className="clinic-sidebar-avatar">{(currentUser?.full_name || "Clinic Staff").split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div>
            <div><strong>{currentUser?.full_name || "Clinic Staff"}</strong><span>Clinic Staff · Active</span></div>
          </div>

          <div className="clinic-sidebar-system">

            <ShieldCheck size={17} />

            <span>
              KhayaConnect System
            </span>

          </div>


          <button
            className="clinic-nav-item clinic-logout"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            <LogOut size={20} />

            <span>{isLoggingOut ? "Signing out…" : "Log Out"}</span>
          </button>

        </div>

      </aside>


      {/* =====================================================
          MOBILE OVERLAY
          ===================================================== */}

      {sidebarOpen && (
        <div
          className="clinic-sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}


      {/* =====================================================
          MAIN CONTENT
          ===================================================== */}

      <main className="clinic-main">

        {/* Desktop header */}

        <header className="clinic-topbar">

          <div>

            <p className="clinic-page-label">
              CLINIC STAFF
            </p>

            <h1>
              {activeSection}
            </h1>

          </div>


          <div className="clinic-topbar-actions">

            <button
              type="button"
              className="clinic-notification-button"
              onClick={() => selectSection("Notifications")}
              aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
            >
              <Bell size={21} />

              {unreadCount > 0 && <span className="clinic-notification-count">{unreadCount}</span>}
            </button>


            <div className="clinic-profile">

              <div className="clinic-profile-icon">
                <Activity size={19} />
              </div>

              <div>
                <strong>
  {currentUser?.full_name || "Clinic Staff"}
</strong>

<span>
  Clinic Staff
</span>
              </div>

            </div>

          </div>

        </header>



        {/* =====================================================
            OVERVIEW
            ===================================================== */}

        {activeSection === "Overview" && (

          <div className="clinic-content">

            <section className="clinic-welcome-card">

              <div>

                <p className="clinic-small-label">
                  KHAYACONNECT CLINIC
                </p>

                <h2>
                  Welcome back{currentUser?.full_name ? `, ${currentUser.full_name}` : ""}.
                </h2>

                <p>
                  Manage patient care, appointments,
                  medication and important alerts
                  from one place.
                </p>

              </div>


              <div className="clinic-welcome-icon">
                <HeartPulse size={43} />
              </div>

            </section>


            {/* Summary */}

            <section className="clinic-summary-grid">

              <div className="clinic-summary-card">

                <div className="clinic-summary-icon">
                  <Users size={21} />
                </div>

                <div>
                  <span>Patients</span>

                  <strong>
                    {patients.length}
                  </strong>

                  <small>
                    {isClinicDataLoading ? "Loading clinic patients…" : clinicDataError || `${patients.length} linked patient record${patients.length === 1 ? "" : "s"}`}
                  </small>
                </div>

              </div>


              <div className="clinic-summary-card">

                <div className="clinic-summary-icon">
                  <Calendar size={21} />
                </div>

                <div>
                  <span>Appointments</span>

                  <strong>
                    {appointments.length}
                  </strong>

                  <small>
                    {appointments.length ? `${appointments.length} saved appointment${appointments.length === 1 ? "" : "s"}` : "No appointments scheduled"}
                  </small>
                </div>

              </div>


              <div className="clinic-summary-card">

                <div className="clinic-summary-icon">
                  <Pill size={21} />
                </div>

                <div>
                  <span>Medication</span>

                  <strong>
                    {medications.length}
                  </strong>

                  <small>
                    {medications.length ? `${medications.length} saved schedule${medications.length === 1 ? "" : "s"}` : "No medication records"}
                  </small>
                </div>

              </div>


              <div className="clinic-summary-card">

                <div className="clinic-summary-icon">
                  <AlertTriangle size={21} />
                </div>

                <div>
                  <span>Emergency Alerts</span>

                  <strong>
                    {alerts.length}
                  </strong>

                  <small>
                    {alerts.length ? `${alerts.length} active alert${alerts.length === 1 ? "" : "s"}` : "No active alerts"}
                  </small>
                </div>

              </div>

            </section>


            {/* Main panels */}

            <section className="clinic-dashboard-grid">

              <div className="clinic-panel">

                <div className="clinic-panel-header">

                  <div>
                    <h3>Patient Directory</h3>

                    <p>
                      View and manage elderly
                      patient information.
                    </p>
                  </div>

                  <Users size={22} />

                </div>


                {isClinicDataLoading ? <div className="clinic-empty-state"><div className="clinic-empty-icon"><Users size={28} /></div><h4>Loading clinic patients…</h4><p>Retrieving patients assigned to your clinic.</p></div>
                  : clinicDataError ? <div className="clinic-empty-state clinic-data-error"><div className="clinic-empty-icon"><AlertTriangle size={28} /></div><h4>Patient records could not load</h4><p>{clinicDataError}</p><button type="button" className="clinic-data-retry" onClick={() => { setIsClinicDataLoading(true); refreshAppointments().catch((error) => setClinicDataError(error.message)).finally(() => setIsClinicDataLoading(false)); }}>Try again</button></div>
                  : patients.length ? <div className="clinic-record-list">{patients.map((patient) => <article className="clinic-record-row" key={patient.user_id}><div className="clinic-record-avatar"><Users size={17} /></div><div><strong>{patient.full_name}</strong><span>{patient.phone || "Phone not provided"}</span></div><span className="clinic-record-status">Linked</span></article>)}</div>
                    : <div className="clinic-empty-state"><div className="clinic-empty-icon"><Users size={28} /></div><h4>No patients linked to this clinic</h4><p>Ask an administrator to connect patients to the clinic assigned to your account.</p></div>}

              </div>


              <div className="clinic-panel">

                <div className="clinic-panel-header">

                  <div>
                    <h3>Appointments</h3>

                    <p>
                      Keep track of upcoming
                      patient appointments.
                    </p>
                  </div>

                  <Calendar size={22} />

                </div>


                {appointments.length ? <div className="clinic-record-list">{appointments.slice(0, 4).map((appointment) => <article className="clinic-record-row" key={appointment.appointment_id}><div className="clinic-record-avatar"><Calendar size={17} /></div><div><strong>{appointment.elderly_user__full_name || "Linked patient"} · {appointment.appointment_type || "Clinic appointment"}</strong><span>{appointment.appointment_date}{appointment.appointment_time ? ` · ${String(appointment.appointment_time).slice(0, 5)}` : ""} · {appointment.status || "scheduled"}</span></div></article>)}</div>
                  : <div className="clinic-empty-state"><div className="clinic-empty-icon"><Calendar size={28} /></div><h4>No appointments scheduled</h4><p>Upcoming appointments will appear here when available.</p></div>}

              </div>


              <div className="clinic-panel">

                <div className="clinic-panel-header">

                  <div>
                    <h3>Emergency Alerts</h3>

                    <p>
                      Important alerts requiring
                      clinic attention.
                    </p>
                  </div>

                  <AlertTriangle size={22} />

                </div>


                {alerts.length ? <div className="clinic-record-list">{alerts.slice(0, 4).map((alert) => <article className="clinic-record-row clinic-emergency-row" key={alert.sos_id}><div className="clinic-record-avatar"><AlertTriangle size={17} /></div><div><strong>{alert.elderly_user__full_name || "Linked patient"}</strong><span>{alert.status || "Active emergency"}{alert.activated_at ? ` · ${new Date(alert.activated_at).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })}` : ""}</span></div></article>)}</div>
                  : <div className="clinic-empty-state"><div className="clinic-empty-icon clinic-safe-icon"><CheckCircle2 size={28} /></div><h4>No active alerts</h4><p>Emergency alerts will appear here when the system receives one.</p></div>}

              </div>


              <div className="clinic-panel">

                <div className="clinic-panel-header">

                  <div>
                    <h3>Quick Actions</h3>

                    <p>
                      Access frequently used
                      clinic functions.
                    </p>
                  </div>

                  <Activity size={22} />

                </div>


                <div className="clinic-quick-actions">

                  <button
                    onClick={() =>
                      selectSection("Patients")
                    }
                  >
                    <Users size={21} />

                    <span>
                      View Patients
                    </span>

                    <ChevronRight size={18} />
                  </button>


                  <button
                    onClick={() =>
                      selectSection("Appointments")
                    }
                  >
                    <Calendar size={21} />

                    <span>
                      View Appointments
                    </span>

                    <ChevronRight size={18} />
                  </button>


                  <button
                    onClick={() =>
                      selectSection("Medication")
                    }
                  >
                    <Pill size={21} />

                    <span>
                      Medication
                    </span>

                    <ChevronRight size={18} />
                  </button>


                  <button
                    onClick={() =>
                      selectSection("Emergency Alerts")
                    }
                  >
                    <AlertTriangle size={21} />

                    <span>
                      Emergency Alerts
                    </span>

                    <ChevronRight size={18} />
                  </button>

                </div>

              </div>

            </section>

          </div>

        )}


        {/* =====================================================
            PATIENTS
            ===================================================== */}

        {activeSection === "Patients" && (

          <section className="clinic-section-page">

            <div className="clinic-section-header">

              <div>

                <p className="clinic-small-label">
                  CLINIC MANAGEMENT
                </p>

                <h2>
                  Patient Directory
                </h2>

                <p>
                  Access elderly patient profiles
                  and care information.
                </p>

              </div>

              <Users size={32} />

            </div>


            {isClinicDataLoading ? <div className="clinic-large-empty-state"><Users size={42} /><h3>Loading clinic patients…</h3><p>Retrieving the patient directory from Django.</p></div>
              : clinicDataError ? <div className="clinic-large-empty-state clinic-data-error"><AlertTriangle size={42} /><h3>Patient records could not load</h3><p>{clinicDataError}</p><button type="button" className="clinic-data-retry" onClick={() => { setIsClinicDataLoading(true); refreshAppointments().catch((error) => setClinicDataError(error.message)).finally(() => setIsClinicDataLoading(false)); }}>Try again</button></div>
                : patients.length ? <div className="clinic-record-list clinic-patient-directory">{patients.map((patient) => <article className="clinic-record-row" key={patient.user_id}><div className="clinic-record-avatar"><Users size={19} /></div><div><strong>{patient.full_name}</strong><span>{patient.phone || "Phone not provided"}</span></div><span className="clinic-record-status">Linked to clinic</span></article>)}</div>
                  : <div className="clinic-large-empty-state"><Users size={42} /><h3>No patients linked to this clinic</h3><p>Ask an administrator to connect patients to the clinic assigned to your account.</p></div>}

          </section>

        )}


        {/* =====================================================
            APPOINTMENTS
            ===================================================== */}

        {activeSection === "Appointments" && (

          <section className="clinic-section-page">

            <div className="clinic-section-header">

              <div>

                <p className="clinic-small-label">
                  CLINIC MANAGEMENT
                </p>

                <h2>
                  Appointments
                </h2>

                <p>
                  Manage patient clinic visits
                  and scheduled care.
                </p>

              </div>

              <Calendar size={32} />

            </div>


            <form onSubmit={handleAppointmentSubmit} className="clinic-large-empty-state clinic-appointment-form"><h3>Schedule an appointment</h3>{appointmentError && <p role="alert">{appointmentError}</p>}<select required value={appointmentForm.elderly_user_id} onChange={(e) => setAppointmentForm({ ...appointmentForm, elderly_user_id: e.target.value })}><option value="">Select patient</option>{appointmentOptions.elderly_users.map((patient) => <option key={patient.user_id} value={patient.user_id}>{patient.full_name}</option>)}</select><select required value={appointmentForm.clinic_id} onChange={(e) => setAppointmentForm({ ...appointmentForm, clinic_id: e.target.value })}><option value="">Select clinic</option>{appointmentOptions.clinics.map((clinic) => <option key={clinic.clinic_id} value={clinic.clinic_id}>{clinic.clinic_name}</option>)}</select><input required type="date" value={appointmentForm.appointment_date} onChange={(e) => setAppointmentForm({ ...appointmentForm, appointment_date: e.target.value })} /><input type="time" value={appointmentForm.appointment_time} onChange={(e) => setAppointmentForm({ ...appointmentForm, appointment_time: e.target.value })} /><input required placeholder="Appointment type" value={appointmentForm.appointment_type} onChange={(e) => setAppointmentForm({ ...appointmentForm, appointment_type: e.target.value })} /><textarea placeholder="Notes (optional)" value={appointmentForm.notes} onChange={(e) => setAppointmentForm({ ...appointmentForm, notes: e.target.value })} /><button type="submit">Save appointment</button>{appointmentError && <p role="alert">Appointments could not be loaded or saved. Use Refresh by changing section or check the Django error.</p>}{appointments.length === 0 ? !appointmentError && <p>No saved appointments are linked to this clinic yet.</p> : appointments.map((appointment) => <div key={appointment.appointment_id}><strong>{appointment.elderly_name} · {appointment.appointment_type}</strong><p>{appointment.appointment_date} {appointment.appointment_time} · {appointment.clinic_name} · {appointment.status}</p>{appointment.status !== "cancelled" && appointment.status !== "completed" && <><input aria-label="Reschedule date" type="date" value={appointmentEdits[appointment.appointment_id]?.appointment_date ?? appointment.appointment_date} onChange={(e) => setAppointmentEdits({ ...appointmentEdits, [appointment.appointment_id]: { ...appointmentEdits[appointment.appointment_id], appointment_date: e.target.value } })} /><input aria-label="Reschedule time" type="time" value={appointmentEdits[appointment.appointment_id]?.appointment_time ?? (appointment.appointment_time?.slice(0, 5) || "")} onChange={(e) => setAppointmentEdits({ ...appointmentEdits, [appointment.appointment_id]: { ...appointmentEdits[appointment.appointment_id], appointment_time: e.target.value } })} /><button type="button" onClick={() => updateAppointment(appointment, appointmentEdits[appointment.appointment_id] || {})}>Save new time</button></>}{appointment.status !== "cancelled" && appointment.status !== "completed" && <button type="button" onClick={() => updateAppointment(appointment, "cancelled")}>Cancel</button>}</div>)}</form>

          </section>

        )}


        {/* =====================================================
            MEDICATION
            ===================================================== */}

        {activeSection === "Medication" && (

          <section className="clinic-section-page">

            <div className="clinic-section-header">

              <div>

                <p className="clinic-small-label">
                  CLINICAL CARE
                </p>

                <h2>
                  Medication
                </h2>

                <p>
                  View medication schedules and
                  adherence information.
                </p>

              </div>

              <Pill size={32} />

            </div>


            {isClinicDataLoading ? <div className="clinic-large-empty-state"><Pill size={42} /><h3>Loading clinic medication schedules…</h3><p>Retrieving schedules for patients linked to your clinic.</p></div>
            : clinicDataError ? <div className="clinic-large-empty-state clinic-data-error"><AlertTriangle size={42} /><h3>Medication records could not load</h3><p>{clinicDataError}</p><button type="button" className="clinic-data-retry" onClick={() => { setIsClinicDataLoading(true); refreshAppointments().catch((error) => setClinicDataError(error.message)).finally(() => setIsClinicDataLoading(false)); }}>Try again</button></div>
            : medications.length ? (
              <div className="clinic-medication-list" aria-label="Medication schedules">
                {medications.map((item) => (
                  <article className="clinic-medication-card" key={item.schedule_id}>
                    <div className="clinic-medication-icon"><Pill size={21} /></div>
                    <div className="clinic-medication-details">
                      <h3>{item.medication_name || "Medication"}</h3>
                      <p>{item.elderly_user__full_name || "Linked patient"} · {item.dosage || "Dosage not specified"}</p>
                    </div>
                    <div className="clinic-medication-time">
                      <strong>{item.dosage_time ? String(item.dosage_time).slice(0, 5) : "Time not set"}</strong>
                      <span>{item.status || "active"}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="clinic-large-empty-state">
                <Pill size={42} />
                <h3>No medication records yet</h3>
                <p>Medication schedules for patients linked to this clinic will appear here when a CHW or care provider adds them.</p>
              </div>
            )}

          </section>

        )}


        {/* =====================================================
            EMERGENCY ALERTS
            ===================================================== */}

        {activeSection === "Emergency Alerts" && (

          <section className="clinic-section-page">

            <div className="clinic-section-header">

              <div>

                <p className="clinic-small-label">
                  SAFETY
                </p>

                <h2>
                  Emergency Alerts
                </h2>

                <p>
                  Monitor emergency alerts
                  received from the system.
                </p>

              </div>

              <AlertTriangle size={32} />

            </div>


            <EmergencyResponsePanel title="Emergency alerts for linked clinic patients" />

          </section>

        )}


        {/* =====================================================
            HEALTH RECORDS
            ===================================================== */}

        {activeSection === "Health Records" && (

          <section className="clinic-section-page">

            <div className="clinic-section-header">

              <div>

                <p className="clinic-small-label">
                  CLINICAL INFORMATION
                </p>

                <h2>
                  Health Records
                </h2>

                <p>
                  Review patient health information
                  when records are available.
                </p>

              </div>

              <ClipboardList size={32} />

            </div>


            <div className="clinic-large-empty-state">

              <ClipboardList size={42} />

              <h3>
                No health records yet
              </h3>

              <p>
                Health records will appear here
                once patient information is available.
              </p>

            </div>

          </section>

        )}


        {/* =====================================================
            SETTINGS
            ===================================================== */}

        {activeSection === "Settings" && (

          <section className="clinic-settings-page">

            <div className="clinic-section-header">

              <div>

                <p className="clinic-small-label">
                  PERSONALISATION
                </p>

                <h2>
                  Settings
                </h2>

                <p>
                  Adjust the appearance,
                  accessibility and notification
                  preferences of KhayaConnect.
                </p>

              </div>

              <Settings size={32} />

            </div>


            {/* Appearance */}

            <div className="clinic-settings-card">

              <div className="clinic-settings-card-header">

                <div className="clinic-settings-heading-icon">
                  <SlidersHorizontal size={21} />
                </div>

                <div>
                  <h3>
                    Appearance
                  </h3>

                  <p>
                    Personalise how KhayaConnect
                    looks on your screen.
                  </p>
                </div>

              </div>


              <div className="clinic-setting-content">

                <h4>
                  Colour theme
                </h4>

                <p className="clinic-setting-description">
                  Choose an accent colour for
                  the dashboard.
                </p>


                <div className="clinic-theme-options">

                  <button
                    type="button"
                    aria-pressed={theme === "blue"}
                    className={`clinic-theme-option ${
                      theme === "blue"
                        ? "clinic-theme-selected"
                        : ""
                    }`}
                    onClick={() => setTheme("blue")}
                  >
                    <span className="theme-circle theme-blue" />

                    <span>
                      Clinical Blue
                    </span>

                    {theme === "blue" && (
                      <Check size={17} />
                    )}
                  </button>


                  <button
                    type="button"
                    aria-pressed={theme === "emerald"}
                    className={`clinic-theme-option ${
                      theme === "emerald"
                        ? "clinic-theme-selected"
                        : ""
                    }`}
                    onClick={() => setTheme("emerald")}
                  >
                    <span className="theme-circle theme-emerald" />

                    <span>
                      Emerald Green
                    </span>

                    {theme === "emerald" && (
                      <Check size={17} />
                    )}
                  </button>


                  <button
                    type="button"
                    aria-pressed={theme === "amber"}
                    className={`clinic-theme-option ${
                      theme === "amber"
                        ? "clinic-theme-selected"
                        : ""
                    }`}
                    onClick={() => setTheme("amber")}
                  >
                    <span className="theme-circle theme-amber" />

                    <span>
                      Warm Amber
                    </span>

                    {theme === "amber" && (
                      <Check size={17} />
                    )}
                  </button>

                </div>


                {/* Dark mode */}

                <div className="clinic-setting-row">

                  <div className="clinic-setting-row-icon">
                    {darkMode ? (
                      <Moon size={20} />
                    ) : (
                      <Sun size={20} />
                    )}
                  </div>

                  <div className="clinic-setting-row-text">

                    <h4>
                      Dark mode
                    </h4>

                    <p>
                      Use a darker interface for
                      lower-light environments.
                    </p>

                  </div>

                  <button
                    className={`clinic-toggle ${
                      darkMode
                        ? "clinic-toggle-on"
                        : ""
                    }`}
                    onClick={() =>
                      setDarkMode(!darkMode)
                    }
                    aria-label="Toggle dark mode"
                  >
                    <span />
                  </button>

                </div>

              </div>

            </div>


            {/* Accessibility */}

            <div className="clinic-settings-card">

              <div className="clinic-settings-card-header">

                <div className="clinic-settings-heading-icon">
                  <Type size={21} />
                </div>

                <div>
                  <h3>
                    Accessibility
                  </h3>

                  <p>
                    Make information easier to
                    read and interact with.
                  </p>
                </div>

              </div>


              <div className="clinic-setting-content">

                <h4>
                  Text size
                </h4>

                <div className="clinic-text-options">

                  <button
                    type="button"
                    aria-pressed={textSize === "small"}
                    className={
                      textSize === "small"
                        ? "clinic-text-selected"
                        : ""
                    }
                    onClick={() =>
                      setTextSize("small")
                    }
                  >
                    Small
                  </button>


                  <button
                    type="button"
                    aria-pressed={textSize === "normal"}
                    className={
                      textSize === "normal"
                        ? "clinic-text-selected"
                        : ""
                    }
                    onClick={() =>
                      setTextSize("normal")
                    }
                  >
                    Normal
                  </button>


                  <button
                    type="button"
                    aria-pressed={textSize === "large"}
                    className={
                      textSize === "large"
                        ? "clinic-text-selected"
                        : ""
                    }
                    onClick={() =>
                      setTextSize("large")
                    }
                  >
                    Large
                  </button>

                </div>


                <div className="clinic-setting-row">

                  <div className="clinic-setting-row-icon">
                    <ShieldCheck size={20} />
                  </div>

                  <div className="clinic-setting-row-text">

                    <h4>
                      High contrast
                    </h4>

                    <p>
                      Increase visual contrast
                      between interface elements.
                    </p>

                  </div>

                  <button
                    className={`clinic-toggle ${
                      highContrast
                        ? "clinic-toggle-on"
                        : ""
                    }`}
                    onClick={() =>
                      setHighContrast(!highContrast)
                    }
                    aria-label="Toggle high contrast"
                  >
                    <span />
                  </button>

                </div>

              </div>

            </div>


            {/* Notifications */}

            <div className="clinic-settings-card">

              <div className="clinic-settings-card-header">

                <div className="clinic-settings-heading-icon">
                  <Bell size={21} />
                </div>

                <div>
                  <h3>
                    Notifications
                  </h3>

                  <p>
                    Choose which system notifications
                    you would like to receive.
                  </p>
                </div>

              </div>


              <div className="clinic-setting-content">

                <div className="clinic-setting-row">

                  <div className="clinic-setting-row-icon">
                    <Calendar size={20} />
                  </div>

                  <div className="clinic-setting-row-text">

                    <h4>
                      Appointment notifications
                    </h4>

                    <p>
                      Receive notifications about
                      scheduled appointments.
                    </p>

                  </div>

                  <button
                    className={`clinic-toggle ${
                      appointmentNotifications
                        ? "clinic-toggle-on"
                        : ""
                    }`}
                    onClick={() =>
                      setAppointmentNotifications(
                        !appointmentNotifications
                      )
                    }
                    aria-label="Toggle appointment notifications"
                  >
                    <span />
                  </button>

                </div>


                <div className="clinic-setting-row">

                  <div className="clinic-setting-row-icon">
                    <Pill size={20} />
                  </div>

                  <div className="clinic-setting-row-text">

                    <h4>
                      Medication notifications
                    </h4>

                    <p>
                      Receive important medication
                      related notifications.
                    </p>

                  </div>

                  <button
                    className={`clinic-toggle ${
                      medicationNotifications
                        ? "clinic-toggle-on"
                        : ""
                    }`}
                    onClick={() =>
                      setMedicationNotifications(
                        !medicationNotifications
                      )
                    }
                    aria-label="Toggle medication notifications"
                  >
                    <span />
                  </button>

                </div>

              </div>

            </div>


            {/* System */}

            <div className="clinic-settings-card">

              <div className="clinic-settings-card-header">

                <div className="clinic-settings-heading-icon">
                  <Activity size={21} />
                </div>

                <div>
                  <h3>
                    System
                  </h3>

                  <p>
                    Configure KhayaConnect system
                    behaviour.
                  </p>
                </div>

              </div>


              <div className="clinic-setting-content">

                <div className="clinic-setting-row">

                  <div className="clinic-setting-row-icon">
                    <Activity size={20} />
                  </div>

                  <div className="clinic-setting-row-text">

                    <h4>
                      Automatic synchronisation
                    </h4>

                    <p>
                      Keep clinic information
                      synchronised with the system.
                    </p>

                  </div>

                  <button
                    className={`clinic-toggle ${
                      autoSync
                        ? "clinic-toggle-on"
                        : ""
                    }`}
                    onClick={() =>
                      setAutoSync(!autoSync)
                    }
                    aria-label="Toggle automatic synchronisation"
                  >
                    <span />
                  </button>

                </div>


                <div className="clinic-setting-row">

                  <div className="clinic-setting-row-icon">
                    <Volume2 size={20} />
                  </div>

                  <div className="clinic-setting-row-text">

                    <h4>
                      Voice guidance
                    </h4>

                    <p>
                      Enable spoken guidance where
                      voice assistance is available.
                    </p>

                  </div>

                  <button
                    className={`clinic-toggle ${
                      voiceGuidance
                        ? "clinic-toggle-on"
                        : ""
                    }`}
                    onClick={() =>
                      setVoiceGuidance(!voiceGuidance)
                    }
                    aria-label="Toggle voice guidance"
                  >
                    <span />
                  </button>

                </div>

              </div>

            </div>


            {/* Reset */}

            <button
              className="clinic-reset-settings"
              onClick={resetSettings}
            >
              <RotateCcw size={18} />

              Reset settings
            </button>

          </section>

        )}

        {activeSection === "Recents" && <div className="clinic-content"><RecentActivity title="Recent clinic activity" /></div>}
        {activeSection === "Notifications" && <section className="clinic-section-page"><NotificationsPanel roleLabel="clinic staff" /></section>}


        <KhayaAssistant role="clinic" highContrast={highContrast} largeText={textSize === "large"} />

        </main>
      {navigationGuard}
    </div>
  );
}

export default ClinicDashboard;
