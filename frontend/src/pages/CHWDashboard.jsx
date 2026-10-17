import { useEffect, useState, useRef } from "react";

import {
  Activity,
  ArrowLeft,
  AlertTriangle,
  Bell,
  Calendar,
  Clock,
  CheckCircle2,
  HeartPulse,
  Info,
  LogOut,
  MapPin,
  Navigation,
  Pill,
  RefreshCw,
  
  Settings,
  ShieldCheck,
  Sliders,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import useDashboardSection from "./useDashboardSection";
import RecentActivity from "./RecentActivity";
import EmergencyResponsePanel from "./EmergencyResponsePanel";
import useDashboardPreferences from "./useDashboardPreferences";
import NotificationsPanel from "./NotificationsPanel";
import { useRoleNotifications } from "./useRoleNotifications";

import "../styles/CHWDashboard.css";
import KhayaAssistant from "./KhayaAssistant";

function CHWDashboard() {
  const navigate = useNavigate();
  const [loggedInUser] = useState(() => {
    try {
      const storedUser = localStorage.getItem("khayaConnectUser");
      return storedUser ? JSON.parse(storedUser) : null;
    } catch (error) {
      console.error("Invalid logged-in CHW data:", error);
      return null;
    }
  });

  const [activeTab, setActiveTab, navigationGuard] = useDashboardSection("overview", ["overview", "patients", "schedule", "medication", "alerts", "settings", "recents", "notifications"]);
  const assistantRef = useRef(null);
  const { unreadCount } = useRoleNotifications();

  const [preferences, updatePreferences] = useDashboardPreferences("chw", { theme: "khaya", highContrast: false, sosAudio: true, autoSync: true, pushNotifs: true });
  const theme = preferences.theme;
  const highContrast = preferences.highContrast;
  const sosAudio = preferences.sosAudio;
  const autoSync = preferences.autoSync;
  const pushNotifs = preferences.pushNotifs;
  const setTheme = (value) => updatePreferences("theme", value);
  const setHighContrast = (value) => updatePreferences("highContrast", value);
  const setSosAudio = (value) => updatePreferences("sosAudio", value);
  const setAutoSync = (value) => updatePreferences("autoSync", value);
  const setPushNotifs = (value) => updatePreferences("pushNotifs", value);



  const [notification, setNotification] = useState(null);
  const [patients, setPatients] = useState([]);
  const [medications, setMedications] = useState([]);
  const [adherenceRecords, setAdherenceRecords] = useState([]);
  const [visits, setVisits] = useState([]);
  const [emergencyRecords, setEmergencyRecords] = useState([]);
  const alerts = emergencyRecords.filter((item) => !item.resolved_at && !["resolved", "cancelled"].includes(String(item.status || "active").toLowerCase()));
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [visitForm, setVisitForm] = useState({ elderly_user_id: "", visit_date: "", notes: "", follow_up_required: false });
  const [riskForm, setRiskForm] = useState({ elderly_user_id: "", alert_type: "health_concern", severity: "medium", description: "" });
  const [isSavingRisk, setIsSavingRisk] = useState(false);
  const [savingVisitId, setSavingVisitId] = useState(null);
  const [isSchedulingVisit, setIsSchedulingVisit] = useState(false);
  const [visitEdits, setVisitEdits] = useState({});
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [isSavingMedication, setIsSavingMedication] = useState(false);
  const [scheduleDateEdits, setScheduleDateEdits] = useState({});
  const [savingModeId, setSavingModeId] = useState(null);
  const [medicationForm, setMedicationForm] = useState({ elderly_user_id: "", medication_name: "", dosage: "", dosage_time: "08:00", schedule_date: new Date().toLocaleDateString("en-CA") });
  const [currentTime, setCurrentTime] = useState(new Date());

  /*
   * ==========================================================
   * ASSIGNED PATIENT DATA IS LOADED BELOW
   * ==========================================================
   *
   * Assigned patients and care activity are loaded from Django and the connected database.
   *
   *
   * Admin
   *   ↓
   * Database
   *   ↓
   * CHW assignments
   *   ↓
   * These values are loaded from Django/API
   *
   * DO NOT add sample/fake patients here.
   */

  /*
   * ==========================================================
   * CURRENT TIME
   * ==========================================================
   */

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  /*
   * ==========================================================
   * NOTIFICATIONS
   * ==========================================================
   */

  const showNotification = (message) => {
    setNotification(message);

    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  useEffect(() => {
    if (!loggedInUser) {
      navigate("/login/chw");
      return;
    }

    if (loggedInUser.role !== "chw") {
      navigate("/");
    }
  }, [loggedInUser, navigate]);

  const fetchAssignedPatients = async () => {
    if (!loggedInUser?.user_id) {
      setLoadingPatients(false);
      return false;
    }

    try {
      setLoadingPatients(true);
      const [response, visitResponse] = await Promise.all([
        fetch("/api/chw-medications/", { credentials: "include" }),
        fetch("/api/chw-visits/", { credentials: "include" }),
      ]);
      const data = await response.json(); const visitData = await visitResponse.json();
      if (!response.ok) throw new Error(data.error || "Unable to load assigned patients.");
      if (!visitResponse.ok) throw new Error(visitData.error || "Unable to load assigned visits.");
      setVisits(visitData.visits || []);
      const formattedPatients = (data.patients || []).map((patient) => ({
        id: patient.elderly_user_id,
        name: patient.elderly_name,
        phone: patient.phone || "",
        age: patient.age,
        address: patient.address,
        status: patient.status || "active",
        adherence: patient.adherence || { recorded_doses: 0, confirmed_doses: 0, scheduled_doses: 0 },
        lastSeen: (visitData.visits || [])
          .filter((visit) => visit.elderly_user_id === patient.elderly_user_id && String(visit.status || "").toLowerCase() === "completed" && visit.visit_date)
          .sort((left, right) => new Date(right.visit_date) - new Date(left.visit_date))[0]?.visit_date || "",
        condition: "",
      }));
      setPatients(formattedPatients);
      setMedications(data.medications || []);
      setAdherenceRecords(data.adherence || []);
      return true;
    } catch (error) {
      console.error("Error loading assigned patients:", error);
      showNotification(
        error.message || "Unable to load your assigned patients."
      );
      return false;
    } finally {
      setLoadingPatients(false);
    }
  };

  useEffect(() => {
    if (loggedInUser?.role === "chw" && loggedInUser?.user_id) fetchAssignedPatients();
  }, [loggedInUser?.user_id]);

  useEffect(() => {
    if (loggedInUser?.role !== "chw") return undefined;
    let active = true;
    const loadEmergencyRecords = async () => {
      try {
        const response = await fetch("/api/emergency-responses/", { credentials: "include" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load emergency alerts.");
        if (active) setEmergencyRecords(data.emergencies || []);
      } catch (error) {
        console.error("Unable to load CHW emergency count:", error);
      }
    };
    loadEmergencyRecords();
    const timer = window.setInterval(loadEmergencyRecords, 30000);
    window.addEventListener("focus", loadEmergencyRecords);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", loadEmergencyRecords);
    };
  }, [loggedInUser?.role]);

  const handleVisitSubmit = async (event) => {
    event.preventDefault();
    if (isSchedulingVisit) return;
    const submittedForm = event.currentTarget;
    setIsSchedulingVisit(true);
    try {
      const response = await fetch("/api/chw-visits/", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRFToken": loggedInUser?.csrf_token || "" }, body: JSON.stringify(visitForm) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to schedule visit");
      setVisitForm({ elderly_user_id: "", visit_date: "", notes: "", follow_up_required: false });
      window.dispatchEvent(new CustomEvent("khaya:form-saved", { detail: { form: submittedForm } }));
      await fetchAssignedPatients(); showNotification("Visit scheduled and shared with the elder and linked family.");
    } catch (error) { showNotification(error.message); }
    finally { setIsSchedulingVisit(false); }
  };
  const handleRiskSubmit = async (event) => {
    event.preventDefault();
    const submittedForm = event.currentTarget;
    setIsSavingRisk(true);
    try {
      const response = await fetch("/api/risk-alerts/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRFToken": loggedInUser?.csrf_token || "" },
        body: JSON.stringify(riskForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to report this care risk.");
      setRiskForm({ elderly_user_id: "", alert_type: "health_concern", severity: "medium", description: "" });
      window.dispatchEvent(new CustomEvent("khaya:form-saved", { detail: { form: submittedForm } }));
      window.dispatchEvent(new Event("khaya:alerts-updated"));
      showNotification(data.message || "Care risk reported to the linked care team.");
    } catch (error) {
      showNotification(error.message || "Unable to report this care risk.");
    } finally {
      setIsSavingRisk(false);
    }
  };
  const updateVisit = async (visit, status) => {
    if (savingVisitId === visit.visit_id) return;
    if (status === "cancelled" && !window.confirm(`Cancel the scheduled visit for ${visit.elderly_name}?`)) return;
    setSavingVisitId(visit.visit_id);
    try {
      const response = await fetch("/api/chw-visits/", { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRFToken": loggedInUser?.csrf_token || "" }, body: JSON.stringify({ visit_id: visit.visit_id, ...(typeof status === "string" ? { status } : status) }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to update visit");
      await fetchAssignedPatients();
      showNotification(typeof status === "string" ? `Visit ${status === "completed" ? "marked complete" : "cancelled"}.` : "Visit rescheduled.");
    } catch (error) { showNotification(error.message); }
    finally { setSavingVisitId(null); }
  };
  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      const response = await fetch("/api/logout/", {
        method: "POST", credentials: "include",
        headers: { "X-CSRFToken": loggedInUser?.csrf_token || "" },
      });
      if (!response.ok && response.status !== 401) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Unable to sign out. Please try again.");
      }
      localStorage.removeItem("khayaConnectUser");
      navigate("/", { replace: true });
    } catch (error) {
      showNotification(error.message || "Unable to sign out. Please try again.");
      setIsLoggingOut(false);
    }
  };
  const handleMedicationSubmit = async (event) => {
    event.preventDefault();
    const submittedForm = event.currentTarget;
    setIsSavingMedication(true);
    try {
      const response = await fetch("/api/chw-medications/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRFToken": loggedInUser?.csrf_token || "" },
        body: JSON.stringify(medicationForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save medication schedule.");
      setMedicationForm({ elderly_user_id: "", medication_name: "", dosage: "", dosage_time: "08:00", schedule_date: new Date().toLocaleDateString("en-CA") });
      window.dispatchEvent(new CustomEvent("khaya:form-saved", { detail: { form: submittedForm } }));
      await fetchAssignedPatients();
      showNotification(data.message);
    } catch (error) {
      showNotification(error.message || "Could not save medication schedule.");
    } finally {
      setIsSavingMedication(false);
    }
  };
  const updateMedicationMode = async (item, frequency) => {
    const scheduleDate = scheduleDateEdits[item.schedule_id] || item.scheduled_date || "";
    if (frequency === "once" && !scheduleDate) { showNotification("Choose the day for this medicine first."); return; }
    setSavingModeId(item.schedule_id);
    try {
      const response = await fetch("/api/chw-medications/", { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRFToken": loggedInUser?.csrf_token || "" }, body: JSON.stringify({ schedule_id: item.schedule_id, frequency, schedule_date: frequency === "once" ? scheduleDate : "" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update medicine schedule.");
      await fetchAssignedPatients();
      showNotification(`Scheduled for ${scheduleDate}.`);
    } catch (error) { showNotification(error.message || "Could not update medicine schedule."); }
    finally { setSavingModeId(null); }
  };
  /*
   * ==========================================================
   * NAVIGATION
   * ==========================================================
   */

  const navigationItems = [
    {
      id: "overview",
      label: "Overview",
      icon: Activity,
    },
    {
      id: "patients",
      label: "My Patients",
      icon: Users,
    },
    {
      id: "schedule",
      label: "Visit Route",
      icon: Calendar,
    },
    {
      id: "medication",
      label: "Medication",
      icon: Pill,
    },
    {
      id: "alerts",
      label: "SOS & Alerts",
      icon: AlertTriangle,
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
    },
    { id: "recents", label: "Recents", icon: Clock },
    { id: "notifications", label: "Notifications", icon: Bell },
  ];

  const pageClass = `
    ${theme === "dark" ? "chw-dark-mode" : ""}
    ${highContrast ? "chw-high-contrast" : ""}
  `;

  /*
   * ==========================================================
   * EMPTY STATE COMPONENT
   * ==========================================================
   */

  const EmptyState = ({
    icon: Icon,
    title,
    message,
  }) => {
    return (
      <div className="chw-empty-state">
        <div className="chw-empty-icon">
          <Icon size={28} />
        </div>

        <h4>{title}</h4>

        <p>{message}</p>
      </div>
    );
  };

  const renderPatientList = () => {
    if (loadingPatients) {
      return (
        <div className="chw-empty-state">
          <div className="chw-empty-icon"><RefreshCw size={25} /></div>
          <h4>Loading assigned patients...</h4>
          <p>KhayaConnect is retrieving the patients assigned to your account.</p>
        </div>
      );
    }

    if (patients.length === 0) {
      return (
        <div className="chw-empty-state">
          <div className="chw-empty-icon"><Users size={25} /></div>
          <h4>No patients assigned</h4>
          <p>Patients assigned to this Community Health Worker by the administrator will appear here.</p>
        </div>
      );
    }

    return (
      <div className="chw-assigned-patient-list">
        {patients.map((patient) => (
          <article className="chw-assigned-patient-card" key={patient.id}>
            <div className="chw-assigned-patient-heading">
              <div>
                <h4>{patient.name}</h4>
                {patient.condition && <p>{patient.condition}</p>}
              </div>
              <span className="chw-patient-status">{patient.status}</span>
            </div>
            <div className="chw-assigned-patient-details">
              {patient.phone && <span>Phone: {patient.phone}</span>}
              {patient.address && <span>{patient.address}</span>}
              {patient.lastSeen && <span>Last completed visit: {new Date(patient.lastSeen).toLocaleDateString()}</span>}
              {patient.adherence?.recorded_doses > 0 && <span>Doses: {patient.adherence.confirmed_doses} confirmed · {patient.adherence.scheduled_doses} scheduled</span>}
            </div>
          </article>
        ))}
      </div>
    );
  };
  /*
   * ==========================================================
   * DASHBOARD
   * ==========================================================
   */

  return (
    <div className={`chw-dashboard-page ${pageClass}`}>

      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <aside className="chw-dashboard-sidebar">

        <div>

          <div className="chw-dashboard-brand">

            <div className="chw-dashboard-logo">
              <ShieldCheck size={21} />
            </div>

            <div>
              <h1>KhayaConnect</h1>
              <p>Community Health Worker</p>
            </div>

          </div>

          <nav className="chw-dashboard-nav">

            {navigationItems.map((item) => {

              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`chw-nav-item ${
                    activeTab === item.id ? "active" : ""
                  }`}
                  onClick={() => setActiveTab(item.id)}
                >

                  <Icon size={18} />

                  <span>
                    {item.label}
                  </span>

                </button>
              );

            })}

          </nav>

        </div>

        <div className="chw-sidebar-footer">
          {activeTab !== "overview" && <button type="button" className="chw-sidebar-back" onClick={() => setActiveTab("overview")}><ArrowLeft size={16} /> Back to dashboard</button>}
          <div className="chw-profile">

          <div className="chw-profile-avatar">
            {loggedInUser?.full_name
              ?.split(" ")
              .filter(Boolean)
              .map((name) => name[0])
              .join("")
              .slice(0, 2)
              .toUpperCase() || "CHW"}
          </div>

          <div>

            <strong>{loggedInUser?.full_name || "CHW"}</strong>

            <span>
              Community Health Worker · On Duty
            </span>

          </div>

          </div>
          <button type="button" className="chw-sidebar-logout" onClick={handleLogout} disabled={isLoggingOut}><LogOut size={16} />{isLoggingOut ? "Signing out…" : "Log out"}</button>
        </div>

      </aside>


      {/* =====================================================
          MAIN
      ===================================================== */}

      <div className="chw-dashboard-main">

        {/* HEADER */}

        <header className="chw-dashboard-header">

          <div>

            <div className="chw-header-title">

               <p className="chw-welcome-message">
                Hi, {loggedInUser?.full_name?.split(" ")[0] || "CHW"} 👋
              </p>

              <h2>
                CHW Care Centre
              </h2>

              <span className="chw-online-status">

                <span />

                Active · {patients.length}{" "}{patients.length === 1 ? "Patient" : "Patients"}

              </span>

            </div>

            <p>

              KhayaConnect ·{" "}

              {currentTime.toLocaleDateString(
                "en-ZA",
                {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }
              )}

              {" · "}

              {currentTime.toLocaleTimeString(
                "en-ZA",
                {
                  hour: "2-digit",
                  minute: "2-digit",
                }
              )}

            </p>

          </div>


          <div className="chw-header-actions">

            <button
              type="button"
              className="chw-sync-button"
              onClick={async () => {
                const synced = await fetchAssignedPatients();
                if (synced) {
                  showNotification("Assigned patients synchronized successfully.");
                }
              }}
            >

              <RefreshCw size={16} />

              Sync

            </button>


            <button
              type="button"
              className="chw-notification-button"
              onClick={() => setActiveTab("notifications")}
              aria-label={unreadCount ? `Open notifications, ${unreadCount} unread` : "Open notifications"}
            >

              <Bell size={19} />
              {unreadCount > 0 && <span className="chw-notification-count">{unreadCount}</span>}

              {alerts.length > 0 && (
                <span>
                  {alerts.length}
                </span>
              )}

            </button>

          </div>

        </header>


        {/* ===================================================
            CONTENT
        =================================================== */}

        <main className="chw-dashboard-content">

          {notification && (

            <div className="chw-notification">

              <span>

                <Info size={17} />

                {notification}

              </span>

              <button
                type="button"
                onClick={() => setNotification(null)}
                aria-label="Close notification"
              >

                <X size={17} />

              </button>

            </div>

          )}


          {/* =================================================
              SUMMARY CARDS
          ================================================= */}

          <section className="chw-summary-grid">

            <button
              type="button"
              className="chw-summary-card"
              onClick={() => setActiveTab("schedule")}
            >

              <span>

                <Calendar size={15} />

                Today's Visits

              </span>

              <strong>—</strong>

              <small>Visit schedule will appear here.</small>

            </button>


            <button
              type="button"
              className="chw-summary-card"
              onClick={() => setActiveTab("alerts")}
            >

              <span>

                <AlertTriangle size={15} />

                Patient Alerts

              </span>

              <strong>
                {alerts.length}
              </strong>

              <small>
                No active alerts
              </small>

            </button>


            <button
              type="button"
              className="chw-summary-card"
              onClick={() =>
                showNotification(
                  "Patient data will become available after CHW assignments are created."
                )
              }
            >

              <span>

                <RefreshCw size={15} />

                Data Status

              </span>

              <strong>{patients.length} {patients.length === 1 ? "Elder" : "Elders"}</strong>
              <small>Linked to your CHW account</small>

            </button>


            <button
              type="button"
              className="chw-summary-card"
              onClick={() => setActiveTab("patients")}
            >

              <span>

                <HeartPulse size={15} />

                Care Adherence

              </span>

              <strong>
                {patients.reduce((total, patient) => total + (patient.adherence?.confirmed_doses || 0), 0)} confirmed
              </strong>

              <small>
                {adherenceRecords.length} dose record{adherenceRecords.length === 1 ? "" : "s"} from assigned elders
              </small>

            </button>

          </section>


          {/* =================================================
              OVERVIEW
          ================================================= */}

          {activeTab === "overview" && (

            <div className="chw-dashboard-view">

              <section className="chw-duty-banner">

                <div>

                  <span className="chw-duty-badge">

                    <span />

                    SYSTEM READY

                  </span>

                  <h3>
                    Your CHW workspace is ready.
                  </h3>

                  <p>
                    Patients, visits, medication information and
                    alerts assigned to your account will appear here
                    once they are configured by the administrator.
                  </p>

                </div>


                <div className="chw-banner-actions">

                  <button
                    type="button"
                    onClick={() =>
                      setActiveTab("patients")
                    }
                  >

                    <Users size={17} />

                    My Patients

                  </button>


                  <button
                    type="button"
                    onClick={() =>
                      assistantRef.current?.open()
                    }
                  >

                    <Sparkles size={17} />

                    Ask Assistant

                  </button>

                </div>

              </section>


              <section className="chw-section-heading">

                <div>

                  <span>
                    CARE MONITORING
                  </span>

                  <h3>
                    Assigned Patients
                  </h3>

                </div>

                <button
                  type="button"
                  className="chw-primary-button"
                  onClick={() =>
                    setActiveTab("patients")
                  }
                >
                  Open patient section →
                </button>

              </section>


              {/* EMPTY PATIENT AREA */}

              <section className="chw-empty-panel">
                {renderPatientList()}
              </section>


              <div className="chw-overview-columns">

                {/* VISITS */}

                <section className="chw-panel">

                  <div className="chw-panel-heading">

                    <h4>

                      <Calendar size={18} />

                      Today's Care Route

                    </h4>

                    <button
                      type="button"
                      onClick={() =>
                        setActiveTab("schedule")
                      }
                    >
                      Full schedule
                    </button>

                  </div>


                  <EmptyState
                    icon={Navigation}
                    title="No visits scheduled"
                    message="Assigned home visits will appear here."
                  />

                </section>


                {/* MEDICATION */}

                <section className="chw-panel">

                  <div className="chw-panel-heading">

                    <h4>

                      <Pill size={18} />

                      Medication Follow-up

                    </h4>

                    <button
                      type="button"
                      onClick={() =>
                        setActiveTab("medication")
                      }
                    >
                      View logs
                    </button>

                  </div>


                  {medications.length ? (
                    <div className="chw-assigned-patient-list">
                      {medications.slice(0, 3).map((item) => (
                        <article className="chw-assigned-patient-card" key={item.schedule_id}>
                          <div className="chw-assigned-patient-heading">
                            <h4>{item.medication_name}</h4>
                            <span className="chw-patient-status">{item.frequency === "once" ? item.scheduled_date : "Daily"}</span>
                          </div>
                          <div className="chw-assigned-patient-details">
                            <strong>{item.elderly_name}</strong>
                            {item.dosage && <span>{item.dosage}</span>}
                            <span>{item.dosage_time.slice(0, 5)}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={Pill}
                      title="No medication schedules"
                      message={loadingPatients ? "Loading medication schedules…" : "Schedules for your assigned elders will appear here."}
                    />
                  )}

                </section>

              </div>

            </div>

          )}


          {/* =================================================
              PATIENTS
          ================================================= */}

          {activeTab === "patients" && (

            <div className="chw-dashboard-view">

              <div className="chw-page-heading">

                <div>

                  <span>
                    CARE MANAGEMENT
                  </span>

                  <h3>
                    My Patients
                  </h3>

                  <p>
                    Patients assigned to your CHW account
                    will appear here.
                  </p>

                </div>

              </div>


              <section className="chw-empty-panel">
                {renderPatientList()}
              </section>

            </div>

          )}


          {/* =================================================
              VISIT ROUTE
          ================================================= */}

          {activeTab === "schedule" && (

            <div className="chw-dashboard-view">

              <div className="chw-page-heading">

                <div>

                  <span>
                    FIELD NAVIGATION
                  </span>

                  <h3>
                    Visit Route
                  </h3>

                  <p>
                    Your assigned home visits will appear
                    here once they are scheduled.
                  </p>

                </div>

              </div>


              <section className="chw-route-map">
<form className="chw-medication-form chw-visit-form" onSubmit={handleVisitSubmit}>
<label>Assigned elder<select required value={visitForm.elderly_user_id} onChange={(event) => setVisitForm({ ...visitForm, elderly_user_id: event.target.value })}><option value="">Choose elder</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.name}</option>)}</select></label>
<label>Visit date and time<input required type="datetime-local" value={visitForm.visit_date} onChange={(event) => setVisitForm({ ...visitForm, visit_date: event.target.value })} /></label>
<label>Notes<input value={visitForm.notes} maxLength={255} onChange={(event) => setVisitForm({ ...visitForm, notes: event.target.value })} /></label>
<button type="submit" className="chw-visit-schedule-button" disabled={isSchedulingVisit || !patients.length}>{isSchedulingVisit ? "Saving…" : "Schedule visit"}</button>
</form>
{visits.length === 0 ? <EmptyState icon={Navigation} title="No visits scheduled" message="Schedule a visit for one of your assigned elders." /> : visits.map((visit) => <article className="chw-assigned-patient-card chw-visit-card" key={visit.visit_id}><strong>{visit.elderly_name}</strong><p>{new Date(visit.visit_date).toLocaleString()} · {visit.status}</p>{visit.notes && <p>{visit.notes}</p>}{!['completed','cancelled'].includes(visit.status) && <div className="chw-visit-controls"><label>Visit date<input aria-label="Reschedule visit date" type="date" value={visitEdits[visit.visit_id]?.visit_date ?? new Date(visit.visit_date).toLocaleDateString("en-CA")} onChange={(event) => setVisitEdits({ ...visitEdits, [visit.visit_id]: { ...visitEdits[visit.visit_id], visit_date: event.target.value } })} /></label><label>Visit time<input aria-label="Reschedule visit time" type="time" value={visitEdits[visit.visit_id]?.visit_time ?? new Date(visit.visit_date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} onChange={(event) => setVisitEdits({ ...visitEdits, [visit.visit_id]: { ...visitEdits[visit.visit_id], visit_time: event.target.value } })} /></label><div className="chw-visit-actions"><button type="button" className="chw-visit-reschedule-button" disabled={savingVisitId === visit.visit_id} onClick={() => updateVisit(visit, { visit_date: `${visitEdits[visit.visit_id]?.visit_date || new Date(visit.visit_date).toLocaleDateString("en-CA")}T${visitEdits[visit.visit_id]?.visit_time || new Date(visit.visit_date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` })}>{savingVisitId === visit.visit_id ? "Saving…" : "Reschedule"}</button><button type="button" className="chw-visit-complete-button" disabled={savingVisitId === visit.visit_id} onClick={() => updateVisit(visit, "completed")}>Mark completed</button><button type="button" className="chw-visit-cancel-button" disabled={savingVisitId === visit.visit_id} onClick={() => updateVisit(visit, "cancelled")}>Cancel visit</button></div></div>}</article>)}
<div className="chw-map-footer"><div><Navigation size={17} /><strong>{visits.length} assigned visit(s)</strong></div></div>
</section>

            </div>

          )}


          {/* =================================================
              MEDICATION
          ================================================= */}

          {activeTab === "medication" && (

            <div className="chw-dashboard-view">

              <div className="chw-page-heading">

                <div>

                  <span>
                    CARE MONITORING
                  </span>

                  <h3>
                    Medication Follow-ups
                  </h3>

                  <p>Medication schedules and recorded dose confirmations for assigned patients.</p>

                </div>

              </div>


              <section className="chw-settings-panel chw-medication-panel">
                <h4>Schedule medication</h4>
                <p>Choose an elder assigned to your account and set a date for each medicine. It will appear on that day in their care calendar.</p>
                <form className="chw-medication-form" onSubmit={handleMedicationSubmit}>
                  <label>Elder<select required value={medicationForm.elderly_user_id} onChange={(event) => setMedicationForm((current) => ({ ...current, elderly_user_id: event.target.value }))}><option value="">Select assigned elder</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.name}</option>)}</select></label>
                  <label>Medication<input required maxLength={100} value={medicationForm.medication_name} onChange={(event) => setMedicationForm((current) => ({ ...current, medication_name: event.target.value }))} placeholder="Medication name" /></label>
                  <label>Dosage<input maxLength={100} value={medicationForm.dosage} onChange={(event) => setMedicationForm((current) => ({ ...current, dosage: event.target.value }))} placeholder="e.g. 1 tablet" /></label>
                  <label>Time<input required type="time" value={medicationForm.dosage_time} onChange={(event) => setMedicationForm((current) => ({ ...current, dosage_time: event.target.value }))} /></label>
                  <label>Schedule date<input required type="date" min={new Date().toLocaleDateString("en-CA")} value={medicationForm.schedule_date} onChange={(event) => setMedicationForm((current) => ({ ...current, schedule_date: event.target.value }))} /></label>
                  <button type="submit" disabled={isSavingMedication || !patients.length}>{isSavingMedication ? "Saving…" : "Add schedule"}</button>
                </form>
                {!patients.length && !loadingPatients && <p>Ask an administrator to assign elders to your CHW account first.</p>}
              </section>
              <section className="chw-settings-panel">
                <h4>Assigned elders’ medication schedules</h4>
                {medications.length ? <div className="chw-assigned-patient-list">{medications.map((item) => <article className="chw-assigned-patient-card" key={item.schedule_id}><div className="chw-assigned-patient-heading"><h3>{item.medication_name}</h3><span className="chw-patient-status">{item.frequency === "once" ? `One day · ${item.scheduled_date || "date unavailable"}` : "Needs a date"}</span></div><div className="chw-assigned-patient-details"><strong>{item.elderly_name}</strong><span>{item.dosage || "Dosage not specified"}</span><span>{item.dosage_time.slice(0, 5)}</span></div><div className="chw-medication-mode-controls"><input aria-label={`One-day date for ${item.medication_name}`} type="date" min={new Date().toLocaleDateString("en-CA")} value={scheduleDateEdits[item.schedule_id] ?? item.scheduled_date ?? ""} onChange={(event) => setScheduleDateEdits((current) => ({ ...current, [item.schedule_id]: event.target.value }))} /><button type="button" disabled={savingModeId === item.schedule_id} onClick={() => updateMedicationMode(item, "once")}>{savingModeId === item.schedule_id ? "Saving…" : item.frequency === "once" ? "Update date" : "Set one day"}</button></div></article>)}</div> : <EmptyState icon={Pill} title="No medication schedules yet" message="Schedules added for your assigned elders will appear here." />}
              </section>
              <section className="chw-settings-panel">
                <h4>Recorded dose activity</h4>
                {adherenceRecords.length ? (
                  <div className="chw-assigned-patient-list">
                    {adherenceRecords.map((record) => (
                      <article className="chw-assigned-patient-card" key={record.adherence_id}>
                        <div className="chw-assigned-patient-heading">
                          <h3>{record.schedule__medication_name}</h3>
                          <span className="chw-patient-status">{record.status}</span>
                        </div>
                        <div className="chw-assigned-patient-details">
                          <strong>{record.elderly_user__full_name}</strong>
                          <span>{new Date(record.scheduled_time).toLocaleString()}</span>
                          {record.confirmed_at && <span>Confirmed {new Date(record.confirmed_at).toLocaleString()}</span>}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : <EmptyState icon={Pill} title="No dose records yet" message="Dose schedules and confirmations will appear here when recorded for your assigned elders." />}
              </section>

            </div>

          )}


          {/* =================================================
              ALERTS
          ================================================= */}

          {activeTab === "alerts" && (

            <div className="chw-dashboard-view">

              <div className="chw-page-heading">

                <div>

                  <span>
                    SAFETY & ESCALATION
                  </span>

                  <h3>
                    SOS & Alert Log
                  </h3>

                  <p>
                    Emergency and care alerts assigned to
                    this CHW will appear here.
                  </p>

                </div>

              </div>


              <section className="chw-settings-panel chw-risk-report-panel">
                <h4>Report a care risk</h4>
                <p>Report an observed concern for an elder assigned to you. The linked care team and administrators will be notified.</p>
                <form className="chw-medication-form" onSubmit={handleRiskSubmit}>
                  <label>Elder<select required value={riskForm.elderly_user_id} onChange={(event) => setRiskForm((current) => ({ ...current, elderly_user_id: event.target.value }))}><option value="">Select assigned elder</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.name}</option>)}</select></label>
                  <label>Risk type<select value={riskForm.alert_type} onChange={(event) => setRiskForm((current) => ({ ...current, alert_type: event.target.value }))}><option value="health_concern">Health concern</option><option value="fall_risk">Fall risk</option><option value="medication_concern">Medication concern</option><option value="safety_concern">Safety concern</option><option value="other">Other</option></select></label>
                  <label>Severity<select value={riskForm.severity} onChange={(event) => setRiskForm((current) => ({ ...current, severity: event.target.value }))}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
                  <label>What did you observe?<textarea required maxLength={255} value={riskForm.description} onChange={(event) => setRiskForm((current) => ({ ...current, description: event.target.value }))} /></label>
                  <button type="submit" disabled={isSavingRisk || !patients.length}>{isSavingRisk ? "Sending…" : "Report risk"}</button>
                </form>
                {!patients.length && !loadingPatients && <p>Assign an elder to your CHW account before reporting a risk.</p>}
              </section>

              <EmergencyResponsePanel title="Emergency alerts for assigned elders" />


            </div>

          )}


          {/* =================================================
              SETTINGS
          ================================================= */}

          {activeTab === "settings" && (

            <div className="chw-dashboard-view chw-settings-view">

              <div className="chw-page-heading">

                <div>

                  <span>
                    PERSONALIZATION
                  </span>

                  <h3>
                    Settings & Customization
                  </h3>

                  <p>
                    Adjust how KhayaConnect supports your
                    field-care workflow.
                  </p>

                </div>

              </div>


              <section className="chw-settings-panel">

                <div className="chw-settings-heading">

                  <SlidersHorizontal size={19} />

                  <div>

                    <h4>
                      Dashboard Colour
                    </h4>

                    <p>
                      Keep the KhayaConnect theme
                      consistent or switch to Dark Mode.
                    </p>

                  </div>

                </div>


                <div className="chw-theme-options">

                  <button
                    type="button"
                    className={`chw-theme-option ${
                      theme === "khaya"
                        ? "selected"
                        : ""
                    }`}
                    onClick={() => {
                      setTheme("khaya");

                      showNotification(
                        "KhayaConnect theme selected."
                      );
                    }}
                  >

                    <span className="theme-dot khaya" />

                    <strong>
                      KhayaConnect
                    </strong>

                    <small>
                      Warm beige & teal
                    </small>

                  </button>


                  <button
                    type="button"
                    className={`chw-theme-option ${
                      theme === "dark"
                        ? "selected"
                        : ""
                    }`}
                    onClick={() => {
                      setTheme("dark");

                      showNotification(
                        "Dark Mode selected."
                      );
                    }}
                  >

                    <span className="theme-dot dark" />

                    <strong>
                      Dark
                    </strong>

                    <small>
                      Low-light field mode
                    </small>

                  </button>

                </div>

              </section>


              <section className="chw-settings-panel">

                <div className="chw-settings-heading">

                  <Sliders size={19} />

                  <div>

                    <h4>
                      Operational Preferences
                    </h4>

                    <p>
                      Control notifications,
                      synchronization and
                      accessibility.
                    </p>

                  </div>

                </div>


                <label className="chw-setting-row">

                  <div>

                    <strong>
                      SOS Emergency Audio Alarm
                    </strong>

                    <span>
                      Play a distinct alert when an
                      assigned patient activates
                      emergency assistance.
                    </span>

                  </div>

                  <input
                    type="checkbox"
                    checked={sosAudio}
                    onChange={() =>
                      setSosAudio(!sosAudio)
                    }
                  />

                </label>


                <label className="chw-setting-row">

                  <div>

                    <strong>
                      Offline Auto-Sync
                    </strong>

                    <span>
                      Prepare patient records for
                      synchronization when the network
                      reconnects.
                    </span>

                  </div>

                  <input
                    type="checkbox"
                    checked={autoSync}
                    onChange={() =>
                      setAutoSync(!autoSync)
                    }
                  />

                </label>


                <label className="chw-setting-row">

                  <div>

                    <strong>
                      High-Contrast Sunlight Mode
                    </strong>

                    <span>
                      Increase visual contrast for
                      outdoor field visits.
                    </span>

                  </div>

                  <input
                    type="checkbox"
                    checked={highContrast}
                    onChange={() =>
                      setHighContrast(!highContrast)
                    }
                  />

                </label>


                <label className="chw-setting-row">

                  <div>

                    <strong>
                      Adherence Notifications
                    </strong>

                    <span>
                      Receive alerts when assigned-patient
                      adherence falls below the configured
                      threshold.
                    </span>

                  </div>

                  <input
                    type="checkbox"
                    checked={pushNotifs}
                    onChange={() =>
                      setPushNotifs(!pushNotifs)
                    }
                  />

                </label>

              </section>


            </div>

          )}

          {activeTab === "recents" && <RecentActivity title="Recent assigned-patient activity" />}
          {activeTab === "notifications" && <div className="chw-dashboard-view"><NotificationsPanel roleLabel="community health worker" /></div>}

        </main>


        <KhayaAssistant ref={assistantRef} role="chw" highContrast={highContrast} />
      </div>
      {navigationGuard}
    </div>
  );
}

export default CHWDashboard;



