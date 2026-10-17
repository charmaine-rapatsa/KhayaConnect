import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  ArrowLeft,
  Calendar,
  Bell,
  Users,
  Clock,
  AlertTriangle,
  Settings,
  CheckCircle2,
  Phone,
  Activity,
  Pill,
  HeartPulse,
  X,
  Sparkles,
  Info,
} from "lucide-react";
import useDashboardSection from "./useDashboardSection";
import RecentActivity from "./RecentActivity";
import EmergencyResponsePanel from "./EmergencyResponsePanel";
import useDashboardPreferences from "./useDashboardPreferences";
import NotificationsPanel from "./NotificationsPanel";
import { useRoleNotifications } from "./useRoleNotifications";
import "../styles/FamilyDashboard.css";
import KhayaAssistant from "./KhayaAssistant";

function FamilyDashboard() {
  const navigate = useNavigate();
  const [loggedInUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("khayaConnectUser") || "null");
    } catch (error) {
      console.error("Invalid logged-in family member data:", error);
      return null;
    }
  });
  const [activeTab, setActiveTab, navigationGuard] = useDashboardSection("overview");
  const assistantRef = useRef(null);
  const [familyPreferences, updateFamilyPreferences] = useDashboardPreferences("family", { textSize: "standard", highContrast: false });
  const { unreadCount } = useRoleNotifications();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [notification, setNotification] = useState(null);  const [careData, setCareData] = useState(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      const user = JSON.parse(localStorage.getItem("khayaConnectUser") || "null");
      const response = await fetch("/api/logout/", { method: "POST", credentials: "include", headers: { "X-CSRFToken": user?.csrf_token || "" } });
      if (!response.ok && response.status !== 401) throw new Error("Unable to sign out. Please try again.");
      localStorage.removeItem("khayaConnectUser");
      navigate("/", { replace: true });
    } catch (error) {
      setNotification(error.message || "Unable to sign out. Please try again.");
      setIsLoggingOut(false);
    }
  };
  useEffect(() => {
    let active = true;
    const load = async () => { try { const response = await fetch('/api/family-dashboard/', { credentials: 'include' }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Unable to load family care data'); if (active) setCareData(data); } catch (error) { if (active) setNotification(error.message); } };
    load(); const timer = setInterval(load, 30000); return () => { active = false; clearInterval(timer); };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const familyDateKey = (value) => {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };
  const formatFamilyTimestamp = (value) => value ? new Date(value).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" }) : "Date unavailable";
  const nowKey = familyDateKey(new Date());
  const familyAppointments = careData?.appointments || [];
  const familyVisits = careData?.visits || [];
  const familyAdherence = (careData?.adherence || []).filter((item) => ["taken", "scheduled"].includes(String(item.status || "").toLowerCase()));
  const familyConfirmations = familyAdherence.filter((item) => item.status === "taken");
  const familySchedules = careData?.medications || [];
  const familyRisks = careData?.risks || [];
  const upcomingFamilyAppointments = familyAppointments.filter((item) => item.appointment_date >= nowKey && !["cancelled", "completed"].includes(String(item.status || "").toLowerCase())).sort((a, b) => `${a.appointment_date} ${a.appointment_time || ""}`.localeCompare(`${b.appointment_date} ${b.appointment_time || ""}`));
  const upcomingFamilyVisits = familyVisits.filter((item) => item.visit_date && new Date(item.visit_date) >= new Date() && !["cancelled", "completed"].includes(String(item.status || "").toLowerCase())).sort((a, b) => new Date(a.visit_date) - new Date(b.visit_date));
  const nextFamilyEvent = [
    ...upcomingFamilyAppointments.map((item) => ({ kind: "Appointment", title: item.appointment_type || "Clinic appointment", when: `${item.appointment_date}${item.appointment_time ? ` · ${String(item.appointment_time).slice(0, 5)}` : ""}`, timestamp: `${item.appointment_date}T${item.appointment_time || "00:00"}` })),
    ...upcomingFamilyVisits.map((item) => ({ kind: "CHW visit", title: item.chw_user__full_name || "Community Health Worker", when: new Date(item.visit_date).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" }), timestamp: item.visit_date })),
  ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))[0];
  const familyTimeline = [
    ...familyAdherence.map((item) => ({ kind: item.status === "taken" ? "Medication confirmed" : "Medication schedule", detail: `${item.schedule__medication_name || "Medication"} · ${careData?.elders?.find((elder) => elder.elderly_user_id === item.elderly_user_id)?.elderly_user__full_name || "Linked elder"}`, timestamp: item.confirmed_at || item.scheduled_time, status: item.status })),
    ...familyVisits.map((item) => ({ kind: "CHW visit", detail: `${item.chw_user__full_name || "Community Health Worker"} · ${item.elderly_name || careData?.elders?.find((elder) => elder.elderly_user_id === item.elderly_user_id)?.elderly_user__full_name || "Linked elder"}`, timestamp: item.visit_date, status: item.status })),
    ...familyAppointments.map((item) => ({ kind: item.appointment_type || "Clinic appointment", detail: `${item.clinic_name} · ${careData?.elders?.find((elder) => elder.elderly_user_id === item.elderly_user_id)?.elderly_user__full_name || "Linked elder"}`, timestamp: `${item.appointment_date}T${item.appointment_time || "00:00"}`, status: item.status })),
  ].filter((item) => item.timestamp).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 5);
  const familyWeek = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (6 - index));
    const key = familyDateKey(date);
    return { key, label: date.toLocaleDateString("en-ZA", { weekday: "short" }), count: familyConfirmations.filter((item) => item.confirmed_at && familyDateKey(item.confirmed_at) === key).length };
  });
  const familyWeekMax = Math.max(1, ...familyWeek.map((item) => item.count));
  const familyAlerts = familyRisks.map((item) => ({ type: item.alert_type || "Care alert", detail: item.description || "Risk alert", timestamp: item.created_at, status: item.status || item.severity })).sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  const familyScheduleItems = [
    ...familyAppointments.map((item) => ({ kind: item.appointment_type || "Clinic appointment", detail: `${careData?.elders?.find((elder) => elder.elderly_user_id === item.elderly_user_id)?.elderly_user__full_name || "Linked elder"} · ${item.clinic_name}`, timestamp: `${item.appointment_date}T${item.appointment_time || "00:00"}`, status: item.status, date: item.appointment_date, time: item.appointment_time })),
    ...familyVisits.map((item) => ({ kind: "CHW visit", detail: `${item.chw_user__full_name || "Community Health Worker"} · ${careData?.elders?.find((elder) => elder.elderly_user_id === item.elderly_user_id)?.elderly_user__full_name || "Linked elder"}`, timestamp: item.visit_date, status: item.status, date: familyDateKey(item.visit_date), time: item.visit_date ? new Date(item.visit_date).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" }) : "" })),
  ].filter((item) => item.timestamp).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));



  const navigationItems = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "schedule", label: "Elder's Schedule", icon: Calendar },
    { id: "meds", label: "Medication Logs", icon: Pill },
    { id: "team", label: "Care Team & Contacts", icon: Users },
    { id: "alerts", label: "Alert History", icon: AlertTriangle },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "settings", label: "Settings", icon: Settings },
    { id: "recents", label: "Recents", icon: Clock },
  ];

  return (
    <div className={`family-dashboard-page ${familyPreferences.textSize === "large" ? "family-text-large" : ""} ${familyPreferences.highContrast ? "family-high-contrast" : ""}`}>
      {/* SIDEBAR */}
      <aside className="family-dashboard-sidebar">
        <div>
          <div className="family-dashboard-brand">
            <div className="family-dashboard-logo">KC</div>

            <div>
              <h1>KhayaConnect</h1>
              <p>Family Portal</p>
            </div>
          </div>

          <nav className="family-dashboard-nav">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`family-dashboard-nav-item ${
                    isActive ? "active" : ""
                  }`}
                >
                  <Icon size={19} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="family-sidebar-footer">
          {activeTab !== "overview" && <button type="button" className="family-back-overview" onClick={() => setActiveTab("overview")}><ArrowLeft size={16} /> Back to dashboard</button>}
          <div className="family-dashboard-profile">
          <div className="family-profile-identity">
            <div className="family-profile-avatar">
              {(loggedInUser?.full_name || loggedInUser?.name || "Family Member")
                .split(" ")
                .filter(Boolean)
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div className="family-profile-copy">
              <p>{loggedInUser?.full_name || loggedInUser?.name || "Family Member"}</p>
              <span><i aria-hidden="true" /> Family Member · Active</span>
            </div>
          </div>
          <button type="button" className="family-role-selection-button" onClick={handleLogout} disabled={isLoggingOut}>
            <ArrowLeft size={16} />
            {isLoggingOut ? "Returning…" : "Back to role selection"}
          </button>
          </div>
        </div>
      </aside>

      {/* MAIN AREA */}
      <div className="family-dashboard-main">
        {/* HEADER */}
        <header className="family-dashboard-header">
          <div>
            <div className="family-header-title-row">
              <h2>Monitoring: {careData?.elders?.map((elder) => elder.elderly_user__full_name).join(", ") || "Linked Elders"}</h2>

              <span className="family-all-clear">
                <span className="family-status-dot" />
                {(careData?.emergencies || []).filter((item) => !item.resolved_at).length} Active Alerts
              </span>
            </div>

            <p>
              Care records · {careData?.elders?.length || 0} linked elder(s) ·{" "}
              {currentTime.toLocaleDateString("en-ZA", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>

          <button
            type="button"
            className="family-header-notification"
            onClick={() => setActiveTab("notifications")}
            aria-label={unreadCount ? `Open notifications, ${unreadCount} unread` : "Open notifications"}
          >
            <Bell size={19} />
            {unreadCount > 0 && <span className="family-notification-count">{unreadCount}</span>}
          </button>
        </header>

        <main className="family-dashboard-content">
          {/* NOTIFICATION */}
          {notification && (
            <div className="family-dashboard-notification">
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

          {/* QUICK SUMMARY CARDS */}
          <div className="family-summary-grid">
            <button
              type="button"
              onClick={() => setActiveTab("meds")}
              className="family-summary-card"
            >
              <span className="summary-label">
                <ShieldCheck size={15} />
                Medication Confirmations
              </span>

              <div>
                <strong>{familyConfirmations.length}</strong>
                <span className="summary-good">confirmed doses</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("schedule")}
              className="family-summary-card"
            >
              <span className="summary-label">
                <Calendar size={15} />
                Next Event
              </span>

              <strong>{nextFamilyEvent ? `${nextFamilyEvent.kind}: ${nextFamilyEvent.title}` : "No upcoming care events"}</strong>
              <small>{nextFamilyEvent?.when || "Appointments and visits will appear here when scheduled."}</small>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("alerts")}
              className="family-summary-card"
            >
              <span className="summary-label">
                <Bell size={15} />
                Emergency Log
              </span>

              <strong>{familyAlerts.filter((item) => !["resolved", "closed", "completed"].includes(String(item.status || "").toLowerCase())).length} active alerts</strong>
              <small>{familyAlerts.length} saved emergency and risk record(s)</small>
            </button>
          </div>

          {/* OVERVIEW */}
          {activeTab === "overview" && (
            <div className="family-dashboard-view">
              <section className="family-status-banner">
                <div>
                    <span className="family-routine-badge">
                      <span />
                    Linked care records
                  </span>

                  <h3>{careData?.elders?.length ? `Monitoring ${careData.elders.map((elder) => elder.elderly_user__full_name).join(", ")}` : "No elders are linked to this account yet."}</h3>

                  <p>
                    {familyTimeline[0] ? `${familyTimeline[0].kind}: ${familyTimeline[0].detail} · ${new Date(familyTimeline[0].timestamp).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })}.` : "Recent medication confirmations, visits and appointments will appear here when saved."}
                    {nextFamilyEvent ? ` Next: ${nextFamilyEvent.kind.toLowerCase()} on ${nextFamilyEvent.when}.` : " No upcoming appointment or visit is recorded."}
                  </p>
                </div>

                <div className="family-banner-actions">
                  <button
                    type="button"
                    onClick={() => assistantRef.current?.open()}
                  >
                    <Sparkles size={17} />
                    Ask Care Assistant
                  </button>

                </div>
              </section>

              <div className="family-overview-grid">
                {/* ACTIVITY */}
                <section className="family-panel activity-panel">
                  <div className="family-panel-heading">
                    <h4>
                      <Clock size={18} />
                      Recent and scheduled activity
                    </h4>

                    <span>
                      {(careData?.elders || []).length} linked elder(s)
                    </span>
                  </div>

                  <div className="family-timeline">{familyTimeline.length ? familyTimeline.map((item, index) => <div className="family-timeline-item" key={`${item.kind}-${item.timestamp}-${index}`}><div className="timeline-marker info">•</div><div><div className="timeline-title"><strong>{item.kind}</strong><span>{new Date(item.timestamp).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })}</span></div><p>{item.detail} · {item.status || "recorded"}</p></div></div>) : <p>No medication confirmations, visits or appointments have been recorded yet.</p>}</div>
                </section>

                {/* ADHERENCE */}
                <section className="family-panel adherence-panel">
                  <div className="family-panel-heading">
                    <h4>
                      <HeartPulse size={18} />
                      Weekly Adherence
                    </h4>
                  </div>

                  <p className="family-panel-description">Recorded medication confirmations over the past seven days.</p>

                  {familyConfirmations.length ? <div className="family-bars">{familyWeek.map((item) => <div className="family-bar-column" key={item.key}><div className="family-bar-value">{item.count}</div><div className="family-bar-track"><div className="family-bar-fill" style={{ height: `${(item.count / familyWeekMax) * 100}%` }} /></div><span>{item.label}</span></div>)}</div> : <p>No medication confirmations are recorded yet.</p>}

                  <div className="family-adherence-message">
                    <strong>{familyConfirmations.length} confirmation(s) recorded</strong>
                    <p>This view reports saved confirmations; it does not estimate adherence when dose history is unavailable.</p>
                  </div>
                </section>
              </div>
            </div>
          )}

          {/* SCHEDULE */}
          {activeTab === "schedule" && (
            <div className="family-dashboard-view">
              <div className="family-page-heading">
                <h3>Elder's Schedule</h3>
                <p>
                  Saved appointments and CHW visits for linked elders.
                </p>
              </div>

              <section className="family-large-panel">
                <div className="family-dark-panel-heading">
                  <strong>Saved care events</strong>
                  <span>{familyScheduleItems.length} event(s)</span>
                </div>

                <div className="family-schedule-list">{familyScheduleItems.length ? familyScheduleItems.map((item, index) => <div className="family-schedule-item" key={`${item.kind}-${item.timestamp}-${index}`}><div className={`schedule-date ${item.kind === "Appointment" ? "red" : "blue"}`}>{item.date ? item.date.slice(-2) : "—"}</div><div><strong>{item.kind}</strong><p>{item.detail} · {item.date}{item.time ? ` · ${item.time}` : ""}</p></div><span className="schedule-badge">{item.status || "scheduled"}</span></div>) : <p>No appointments or CHW visits have been saved for linked elders.</p>}</div>
              </section>
            </div>
          )}

          {/* MEDICATION */}
          {activeTab === "meds" && (
            <div className="family-dashboard-view">
              <div className="family-page-heading">
                <h3>Medication Compliance Logs</h3>
                <p>
                  View recent medication confirmations and upcoming doses.
                </p>
              </div>

              <section className="family-large-panel">
                <div className="family-medication-header">
                  <strong>Saved medication records</strong>
                  <span>{familyConfirmations.length} confirmation(s)</span>
                </div>
                {familySchedules.map((item) => <div className="family-medication-item" key={`schedule-${item.schedule_id}`}><div className="medication-icon pending"><Clock size={19} /></div><div><strong>{item.medication_name} · {item.elderly_name}</strong><p>{item.frequency === "once" ? `One-day dose · ${item.scheduled_date || "assigned date unavailable"}` : "Needs a date"} · {String(item.dosage_time || "").slice(0, 5)}</p></div><span className="medication-status pending">Scheduled</span></div>)}
                {familyAdherence.slice(0, 20).map((item) => <div className="family-medication-item" key={`adherence-${item.adherence_id}`}><div className={`medication-icon ${item.status === "taken" ? "confirmed" : "pending"}`}>{item.status === "taken" ? <CheckCircle2 size={19} /> : <Clock size={19} />}</div><div><strong>{item.schedule__medication_name || "Medication"} · {careData?.elders?.find((elder) => elder.elderly_user_id === item.elderly_user_id)?.elderly_user__full_name || "Linked elder"}</strong><p>{formatFamilyTimestamp(item.confirmed_at || item.scheduled_time)}</p></div><span className={`medication-status ${item.status === "taken" ? "confirmed" : "pending"}`}>{item.status || "recorded"}</span></div>)}
                {!familySchedules.length && !familyAdherence.length && <p>No medication schedules or confirmations are available for linked elders.</p>}
              </section>
            </div>
          )}

          {/* CARE TEAM */}
          {activeTab === "team" && (
            <div className="family-dashboard-view">
              <div className="family-page-heading">
                <h3>Care Team & Emergency Contacts</h3>
                <p>
                  Important healthcare and support contacts.
                </p>
              </div>

              <div className="family-team-grid">{(careData?.care_team || []).length ? careData.care_team.map((member) => <section className="family-team-card" key={member.user_id}><div className="team-avatar purple">CHW</div><div><h4>{member.full_name}</h4><span>Community Health Worker</span></div><p>Linked through the saved elder assignment.</p>{member.phone ? <a href={`tel:${member.phone}`}><Phone size={16} /> Call {member.full_name}</a> : <span>Phone number is not available.</span>}</section>) : <section className="family-team-card"><h4>No care worker is linked</h4><p>Care team members will appear here when an administrator assigns them to a linked elder.</p></section>}</div>
            </div>
          )}

          {/* ALERT HISTORY */}
          {activeTab === "alerts" && (
            <div className="family-dashboard-view">
              <div className="family-page-heading">
                <h3>Alert History & SOS Logs</h3>
                <p>
                  Emergency alerts and important care events are shown here.
                </p>
              </div>

              {familyAlerts.length ? <div className="family-team-grid">{familyAlerts.map((item, index) => <section className="family-team-card" key={`${item.type}-${item.timestamp}-${index}`}><div className="team-avatar blue"><AlertTriangle size={18} /></div><h4>{item.type}</h4><p>{item.detail}</p><span>{formatFamilyTimestamp(item.timestamp)} · {item.status || "recorded"}</span></section>)}</div> : <section className="family-empty-alert"><div><ShieldCheck size={34} /></div><h4>No risk alerts</h4><p>No health risk alerts have been saved for linked elders.</p></section>}
              <EmergencyResponsePanel title="Emergency requests for linked elders" />
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="family-dashboard-view"><NotificationsPanel roleLabel="family portal" /></div>
          )}

          {/* SETTINGS */}
          {activeTab === "settings" && (
            <div className="family-dashboard-view settings-view">
              <div className="family-page-heading">
                <h3>Caregiver Notification Settings</h3>
                <p>
                  Choose which updates you want to receive.
                </p>
              </div>

              <section className="family-settings-panel">
                <label className="family-setting-row">
                  <div><strong>Large text</strong><span>Increase text size across the family dashboard for easier reading.</span></div>
                  <input type="checkbox" checked={familyPreferences.textSize === "large"} onChange={(event) => updateFamilyPreferences("textSize", event.target.checked ? "large" : "standard")} />
                </label>
                <label className="family-setting-row">
                  <div><strong>High contrast</strong><span>Strengthen text and border contrast while keeping emergency colors clear.</span></div>
                  <input type="checkbox" checked={familyPreferences.highContrast} onChange={(event) => updateFamilyPreferences("highContrast", event.target.checked)} />
                </label>
                <p className="family-settings-note">These display preferences are saved for this family account on this device. Emergency alerts remain visible.</p>
              </section>
            </div>
          )}

          {activeTab === "recents" && <RecentActivity title="Recent care activity" />}
        </main>

        <KhayaAssistant ref={assistantRef} role="family" highContrast={familyPreferences.highContrast} largeText={familyPreferences.textSize === "large"} />
      </div>
      {navigationGuard}
    </div>
  );
}

export default FamilyDashboard;
