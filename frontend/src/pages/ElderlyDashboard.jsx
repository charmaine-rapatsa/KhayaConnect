import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import useDashboardSection from "./useDashboardSection";
import RecentActivity from "./RecentActivity";
import useDashboardPreferences from "./useDashboardPreferences";
import KhayaAssistant from "./KhayaAssistant";
import NotificationsPanel from "./NotificationsPanel";
import { useRoleNotifications } from "./useRoleNotifications";
import {
  Home,
  ArrowLeft,
  Calendar as CalendarIcon,
  AlertTriangle,
  Pill,
  Users,
  Settings,
  Clock,
  Bell,
  ShieldAlert,
  Check,
  Plus,
  X,
  Volume2,
  Info,
  LogOut,
} from "lucide-react";

import "../styles/ElderlyDashboard.css";

const toLocalDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function ElderlyDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab, navigationGuard] = useDashboardSection("calendar");
  const [preferences, updatePreferences] = useDashboardPreferences("elderly", { theme: "blue", highContrast: false, textSize: "standard", voiceReminders: false });
  const theme = preferences.theme;
  const setTheme = (value) => updatePreferences("theme", value);



  const [currentTime, setCurrentTime] = useState(new Date());

  /* =========================
     REAL MONTH CALENDAR
     ========================= */

  const [calendarDate, setCalendarDate] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const highContrast = preferences.highContrast;
  const setHighContrast = (value) => updatePreferences("highContrast", value);
  const largeText = preferences.textSize === "large";
  const setLargeText = (value) => updatePreferences("textSize", value ? "large" : "standard");
  const voiceReminders = Boolean(preferences.voiceReminders);
  const { unreadCount } = useRoleNotifications();
  const [voiceReady, setVoiceReady] = useState(false);
  const [notification, setNotification] = useState(null);
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [connectedFamily, setConnectedFamily] = useState(null);
  const [relationshipLoading, setRelationshipLoading] = useState(true);
  const [careData, setCareData] = useState({ medications: [], appointments: [], visits: [], adherence: [], notifications: [] });
  const [isAddingReminder, setIsAddingReminder] = useState(false);
  const [isSavingReminder, setIsSavingReminder] = useState(false);
  const [savingScheduleId, setSavingScheduleId] = useState(null);
  const [scheduleDateEdits, setScheduleDateEdits] = useState({});
  const [savingModeId, setSavingModeId] = useState(null);
  const [isSendingSos, setIsSendingSos] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [reminderForm, setReminderForm] = useState({ medication_name: "", dosage: "", dosage_time: "08:00", schedule_date: new Date().toLocaleDateString("en-CA") });

  /* =========================
     LIVE CLOCK
     ========================= */

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const storedUser = localStorage.getItem("khayaConnectUser");

    if (!storedUser) {
      setRelationshipLoading(false);
      return;
    }

    try {
      const user = JSON.parse(storedUser);
      setLoggedInUser(user);

      fetch("/api/family-elderly/", { credentials: "include" })
        .then(async (response) => {
          const data = await response.json();

          if (!response.ok) {
            throw new Error(
              data.error || "Unable to load Family ↔ Elderly connection."
            );
          }

          const relationship = data.find(
            (item) => item.elderly_user_id === user.user_id
          );

          if (relationship) {
            setConnectedFamily(relationship);
          } else {
            setConnectedFamily(null);
          }
        })
        .catch((error) => {
          console.error("Error loading Family ↔ Elderly connection:", error);
          setConnectedFamily(null);
        })
        .finally(() => setRelationshipLoading(false));
    } catch (error) {
      console.error("Invalid logged-in user data:", error);
      setRelationshipLoading(false);
    }
  }, []);

  /* =========================
     NOTIFICATIONS
     ========================= */

  const showNotification = useCallback((message) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const speakReminder = useCallback((text) => {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      showNotification("Spoken reminders are not supported by this browser.");
      return false;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((item) => item.lang?.toLowerCase() === "en-za")
      || voices.find((item) => item.lang?.toLowerCase().startsWith("en-gb"))
      || voices.find((item) => item.lang?.toLowerCase().startsWith("en-"));
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang || "en-ZA";
    utterance.rate = 0.86;
    utterance.pitch = 1;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
    return true;
  }, [showNotification]);

  const buildCalendarSpeech = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = toLocalDateKey(today);
    const events = [];
    const addEvent = (dateKey, text) => {
      if (dateKey === todayKey) events.push(text);
    };
    const active = (item) => !["cancelled", "completed", "inactive"].includes(String(item.status || "").toLowerCase());

    for (const medication of careData.medications.filter(active)) {
      const name = medication.medication_name || "your medicine";
      const dosage = medication.dosage ? `, ${medication.dosage}` : "";
      const time = String(medication.dosage_time || "").slice(0, 5);
      const detail = `${name}${dosage}${time ? ` at ${time}` : ""}`;
      if (medication.frequency === "once" && medication.scheduled_date) {
        addEvent(String(medication.scheduled_date).slice(0, 10), `Take ${detail}.`);
      } else if (medication.frequency !== "once") {
        addEvent(todayKey, `Take ${detail}.`);
      }
    }
    for (const appointment of careData.appointments.filter(active)) {
      const dateKey = String(appointment.appointment_date || "").slice(0, 10);
      const kind = appointment.appointment_type || appointment.clinic_name || "clinic appointment";
      const time = String(appointment.appointment_time || "").slice(0, 5);
      addEvent(dateKey, `Appointment: ${kind}${time ? ` at ${time}` : ""}.`);
    }
    for (const visit of careData.visits.filter(active)) {
      const visitDate = visit.visit_date ? new Date(visit.visit_date) : null;
      if (!visitDate || Number.isNaN(visitDate.getTime())) continue;
      const dateKey = toLocalDateKey(visitDate);
      addEvent(dateKey, `Community health worker visit${visit.chw_user__full_name ? ` with ${visit.chw_user__full_name}` : ""}${visitDate.getHours() || visitDate.getMinutes() ? ` at ${visitDate.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}` : ""}.`);
    }

    const todayLabel = today.toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" });
    if (!events.length) return `There is no medication, appointment, or visit schedule for today, ${todayLabel}.`;
    const numberedEvents = events.map((item, index) => `${index + 1}. ${item}`).join(" ");
    return `Here is your KhayaConnect schedule for today, ${todayLabel}. ${numberedEvents}`;
  }, [careData]);

  const readTodaySchedule = () => speakReminder(buildCalendarSpeech());

  const enableVoiceReminders = (enabled) => {
    if (!enabled) {
      updatePreferences("voiceReminders", false);
      window.speechSynthesis?.cancel();
      return;
    }
    if (!("speechSynthesis" in window)) {
      showNotification("Spoken reminders are not supported by this browser.");
      return;
    }
    updatePreferences("voiceReminders", true);
    setVoiceReady(speakReminder(buildCalendarSpeech()));
  };

  useEffect(() => {
    if (!voiceReminders || !voiceReady || !("speechSynthesis" in window)) return undefined;
    const checkDueReminders = () => {
      if (document.visibilityState !== "visible") return;
      const now = new Date();
      const dateKey = toLocalDateKey(now);
      const timeKey = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) return;
      let spoken = {};
      try { spoken = JSON.parse(localStorage.getItem(`khayaVoiceReminders-${loggedInUser?.user_id || "user"}`) || "{}"); } catch { spoken = {}; }
      const due = careData.medications.filter((item) => {
        if (item.taken_today || String(item.dosage_time).slice(0, 5) !== timeKey) return false;
        if (item.frequency === "once" && item.scheduled_date !== dateKey) return false;
        const key = `${item.schedule_id}:${dateKey}`;
        return !spoken[key];
      });
      if (!due.length) return;
      due.forEach((item) => { spoken[`${item.schedule_id}:${dateKey}`] = true; });
      localStorage.setItem(`khayaVoiceReminders-${loggedInUser?.user_id || "user"}`, JSON.stringify(spoken));
      speakReminder(`Medication reminder. ${due.map((item) => `Take ${item.medication_name}${item.dosage ? `, ${item.dosage}` : ""}`).join(". Also, ")}.`);
    };
    checkDueReminders();
    const timer = window.setInterval(checkDueReminders, 20000);
    return () => window.clearInterval(timer);
  }, [careData.medications, loggedInUser?.user_id, speakReminder, voiceReady, voiceReminders]);

  const refreshCareData = async () => {
    const response = await fetch("/api/elderly-dashboard/", { credentials: "include" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load your care schedule.");
    setCareData({ medications: data.medications || [], adherence: data.adherence || [], appointments: data.appointments || [], visits: data.visits || [], notifications: data.notifications || [] });
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      try { await refreshCareData(); }
      catch (error) {
        console.error("Error loading elderly care schedule:", error);
        if (active) showNotification(error.message || "Unable to load your care schedule.");
      }
    };
    load();
    const refreshTimer = setInterval(load, 30000);
    window.addEventListener("focus", load);
    return () => {
      active = false;
      clearInterval(refreshTimer);
      window.removeEventListener("focus", load);
    };
  }, []);

  const handleMedicationTaken = async (medication) => {
    setSavingScheduleId(medication.schedule_id);
    try {
      const user = JSON.parse(localStorage.getItem("khayaConnectUser") || "null");
      const response = await fetch("/api/medication-adherence/", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRFToken": user?.csrf_token || "" },
        body: JSON.stringify({ schedule_id: medication.schedule_id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not confirm this dose.");
      await refreshCareData();
      showNotification(data.already_confirmed ? "This dose was already confirmed." : "Medication marked as taken.");
    } catch (error) {
      showNotification(error.message || "Could not confirm this dose.");
    } finally { setSavingScheduleId(null); }
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      const response = await fetch("/api/logout/", {
        method: "POST", credentials: "include",
        headers: { "X-CSRFToken": loggedInUser?.csrf_token || "" },
      });
      if (!response.ok && response.status !== 401) throw new Error("Unable to sign out. Please try again.");
      localStorage.removeItem("khayaConnectUser");
      navigate("/", { replace: true });
    } catch (error) {
      showNotification(error.message || "Unable to sign out. Please try again.");
      setIsLoggingOut(false);
    }
  };

  const updateMedicationMode = async (medication, frequency) => {
    const scheduleDate = scheduleDateEdits[medication.schedule_id] || medication.scheduled_date || "";
    if (frequency === "once" && !scheduleDate) { showNotification("Choose the day for this medicine first."); return; }
    setSavingModeId(medication.schedule_id);
    try {
      const user = JSON.parse(localStorage.getItem("khayaConnectUser") || "null");
      const response = await fetch("/api/pill-schedules/", { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRFToken": user?.csrf_token || "" }, body: JSON.stringify({ schedule_id: medication.schedule_id, frequency, schedule_date: frequency === "once" ? scheduleDate : "" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update the medicine schedule.");
      await refreshCareData();
      showNotification(`Scheduled for ${scheduleDate}.`);
    } catch (error) { showNotification(error.message || "Could not update the medicine schedule."); }
    finally { setSavingModeId(null); }
  };

  const handleReminderSubmit = async (event) => {
    event.preventDefault();
    setIsSavingReminder(true);
    try {
      const user = JSON.parse(localStorage.getItem("khayaConnectUser") || "null");
      const response = await fetch("/api/pill-schedules/", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRFToken": user?.csrf_token || "" },
        body: JSON.stringify(reminderForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not add the medication reminder.");
      await refreshCareData();
      setReminderForm({ medication_name: "", dosage: "", dosage_time: "08:00", schedule_date: new Date().toLocaleDateString("en-CA") });
      setIsAddingReminder(false);
      showNotification(data.message || "One-day medication reminder saved.");
    } catch (error) {
      showNotification(error.message || "Could not add the medication reminder.");
    } finally { setIsSavingReminder(false); }
  };

  const handleEmergencyRequest = async () => {
    if (isSendingSos) return;
    setIsSendingSos(true);
    try {
      const response = await fetch("/api/emergency-sos/", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRFToken": loggedInUser?.csrf_token || "" },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Emergency request could not be sent.");
      showNotification(data.already_active ? "An emergency request is already active. Your care team has been notified." : "Emergency request sent. Your linked care team has been notified.");
    } catch (error) {
      showNotification(error.message || "Emergency request could not be sent.");
    } finally { setIsSendingSos(false); }
  };





  /* =========================
     NAVIGATION
     ========================= */

  const navigationItems = [
    {
      id: "home",
      label: "Home",
      icon: Home,
    },

    {
      id: "calendar",
      label: "Calendar",
      icon: CalendarIcon,
    },

    {
      id: "emergency",
      label: "Emergency",
      icon: AlertTriangle,
      emergency: true,
    },

    {
      id: "pills",
      label: "Medication",
      icon: Pill,
    },

    {
      id: "meetings",
      label: "My Visits",
      icon: Users,
    },

    {
      id: "settings",
      label: "Settings",
      icon: Settings,
    },

    { id: "notifications", label: "Notifications", icon: Bell },

    {
      id: "recents",
      label: "Recents",
      icon: Clock,
    },
  ];


  /* =========================
     REAL MONTH CALENDAR
     ========================= */

  const previousMonth = () => {
    setCalendarDate(
      new Date(
        calendarDate.getFullYear(),
        calendarDate.getMonth() - 1,
        1
      )
    );
  };

  const nextMonth = () => {
    setCalendarDate(
      new Date(
        calendarDate.getFullYear(),
        calendarDate.getMonth() + 1,
        1
      )
    );
  };

  const calendarYear = calendarDate.getFullYear();
  const calendarMonth = calendarDate.getMonth();

  const daysInMonth = new Date(
    calendarYear,
    calendarMonth + 1,
    0
  ).getDate();

  const firstDayOfMonth = new Date(
    calendarYear,
    calendarMonth,
    1
  ).getDay();

  const calendarDays = [];
  const monthKey = `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}`;
  const eventsByDate = new Map();
  const addCalendarEvent = (date, event) => {
    const dateKey = String(date || "").slice(0, 10);
    if (!dateKey.startsWith(`${monthKey}-`)) return;
    const events = eventsByDate.get(dateKey) || [];
    events.push(event);
    eventsByDate.set(dateKey, events);
  };
  // Calendar events are date-specific; legacy daily schedules stay off the calendar until assigned a date.
  for (const medication of careData.medications.filter((item) => item.status === "active" || item.status === "ACTIVE" || item.status === "active_once" || !item.status)) {
    if (medication.frequency === "once" && medication.scheduled_date) {
      addCalendarEvent(medication.scheduled_date, { type: "medicine-once", oneTime: true, text: `${medication.medication_name} · ${String(medication.dosage_time || "").slice(0, 5)}` });
    }
  }
  for (const appointment of careData.appointments) addCalendarEvent(appointment.appointment_date, { type: "appointment", text: `Clinic · ${appointment.appointment_type || "Appointment"} · ${String(appointment.appointment_time || "").slice(0, 5)}` });
  for (const visit of careData.visits) addCalendarEvent(visit.visit_date, { type: "visit", text: `CHW visit${visit.chw_user__full_name ? ` · ${visit.chw_user__full_name}` : ""}` });
  for (let index = 0; index < firstDayOfMonth; index++) calendarDays.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${monthKey}-${String(day).padStart(2, "0")}`;
    calendarDays.push({ day, events: eventsByDate.get(dateKey) || [] });
  }

  const todayKey = toLocalDateKey(currentTime);
  const scheduledTodayCount = careData.medications.filter((item) => item.frequency === "once" && item.scheduled_date === todayKey).length;
  const upcomingVisit = careData.visits.filter((item) => item.visit_date && new Date(item.visit_date) >= currentTime && !["cancelled", "completed"].includes(String(item.status || "").toLowerCase())).sort((a, b) => new Date(a.visit_date) - new Date(b.visit_date))[0];
  const upcomingAppointment = careData.appointments.filter((item) => item.appointment_date && item.appointment_date >= todayKey && !["cancelled", "completed"].includes(String(item.status || "").toLowerCase())).sort((a, b) => `${a.appointment_date} ${a.appointment_time || ""}`.localeCompare(`${b.appointment_date} ${b.appointment_time || ""}`))[0];
  const nextMedication = [...careData.medications].filter((item) => item.frequency === "once" && item.scheduled_date && item.scheduled_date >= todayKey).sort((a, b) => String(a.scheduled_date).localeCompare(String(b.scheduled_date)) || String(a.dosage_time).localeCompare(String(b.dosage_time)))[0];
  const adherenceByDay = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate() - (6 - index));
    const key = toLocalDateKey(date);
    const count = careData.adherence.filter((item) => item.confirmed_at && toLocalDateKey(new Date(item.confirmed_at)) === key).length;
    return { key, label: date.toLocaleDateString("en-ZA", { weekday: "short" }), count };
  });
  const maxDailyConfirmations = Math.max(1, ...adherenceByDay.map((item) => item.count));
  const lastWeekConfirmedCount = adherenceByDay.reduce((sum, item) => sum + item.count, 0);


  return (
    <div
      className={`elderly-dashboard theme-${theme} ${
        highContrast ? "high-contrast" : ""
      } ${largeText ? "elderly-text-large" : ""}`}
    >

      {/* =========================
          SIDEBAR
          ========================= */}

      <aside className="elderly-sidebar">

        {/* BRAND */}

        <div className="sidebar-brand">

          <div className="sidebar-logo">
            KC
          </div>

          <div>
            <h1>
              KhayaConnect
            </h1>

            <p>
              Elderly Care
            </p>
          </div>

        </div>


        {/* NAVIGATION */}

        <nav className="sidebar-navigation">

          {navigationItems.map((item) => {
            const Icon = item.icon;

            const isActive =
              activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                className={`sidebar-nav-item ${
                  isActive ? "active" : ""
                } ${
                  item.emergency ? "emergency-nav" : ""
                }`}
                onClick={() => setActiveTab(item.id)}
              >

                <Icon
                  className="sidebar-nav-icon"
                  size={21}
                  strokeWidth={2}
                />

                <span>
                  {item.label}
                </span>

                {item.id === "notifications" && unreadCount > 0 && <span className="elderly-notification-count">{unreadCount}</span>}

              </button>
            );
          })}

        </nav>


        <div className="elderly-sidebar-footer">
        {activeTab !== "calendar" && <button type="button" className="elderly-back-dashboard" onClick={() => setActiveTab("calendar")} aria-label="Back to dashboard" title="Back to dashboard"><ArrowLeft size={16} /><span>Back to dashboard</span></button>}
        {/* PROFILE */}
        <div className="sidebar-profile">

          <div className="profile-avatar">
            {(loggedInUser?.full_name || "Elderly User").split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
          </div>

          <div className="profile-information">

            <p>
              {loggedInUser?.full_name || "Elderly User"}
            </p>

            <span>
              ● Active
            </span>

          </div>

        </div>
        <button type="button" className="elderly-signout-button" onClick={handleLogout} disabled={isLoggingOut} aria-label={isLoggingOut ? "Signing out" : "Log out"} title={isLoggingOut ? "Signing out" : "Log out"}>
          <LogOut size={17} /><span>{isLoggingOut ? "Signing out…" : "Log out"}</span>
        </button>
        </div>

      </aside>


      {/* =========================
          MAIN AREA
          ========================= */}

      <div className="elderly-dashboard-content">


        {/* =========================
            HEADER
            ========================= */}

        <header className="dashboard-header">

          <div className="dashboard-title">

            <h2>
              Hi, {loggedInUser?.full_name || "there"} 👋
            </h2>

            <div className="dashboard-date">

              <CalendarIcon size={16} />

              <span>
                {currentTime.toLocaleDateString(
                  "en-ZA",
                  {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  }
                )}
              </span>

              <span>
                |
              </span>

              <span>
                {currentTime.toLocaleTimeString(
                  "en-ZA"
                )}
              </span>
              {connectedFamily && (
                <span>
                  | Connected Family: {connectedFamily.family_name}
                </span>
              )}

            </div>

          </div>


          {/* HEADER CARDS */}

          <div className="header-cards">


            {/* REMINDERS */}

            <button
              type="button"
              className="header-card reminder-card"
              onClick={() => setActiveTab("pills")}
            >

              <div className="header-card-title">

                <span>
                  <Bell size={15} />
                  Reminders
                </span>

                <i />

              </div>

              <p>{nextMedication ? `Take ${nextMedication.medication_name} at ${String(nextMedication.dosage_time).slice(0, 5)}${nextMedication.frequency === "once" ? ` on ${nextMedication.scheduled_date}` : ""}` : "No medication reminders scheduled"}</p>

              <small>{upcomingVisit ? `CHW visit · ${new Date(upcomingVisit.visit_date).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })}` : upcomingAppointment ? `Appointment · ${upcomingAppointment.appointment_date}${upcomingAppointment.appointment_time ? ` at ${String(upcomingAppointment.appointment_time).slice(0, 5)}` : ""}` : "No upcoming visits or appointments"}</small>

            </button>


            {/* CALENDAR */}

            <button
              type="button"
              className="header-card active-card"
              onClick={() => setActiveTab("calendar")}
            >

              <div className="header-card-title">

                <span>
                  Calendar & Progress
                </span>

                <i />

              </div>

              <p>
                {calendarDate.toLocaleDateString("en-US", {
                  month: "long",
                })} Schedule
              </p>

              <small>
                View your care plan
              </small>

            </button>


            {/* EMERGENCY */}

            <button
              type="button"
              className="header-card emergency-card"
              onClick={() => setActiveTab("emergency")}
            >

              <div className="header-card-title">

                <span>
                  <ShieldAlert size={15} />
                  SOS
                </span>

                <i />

              </div>

              <p>
                Emergency Help
              </p>

              <small>
                Tap for assistance
              </small>

            </button>

          </div>

        </header>


        {/* =========================
            MAIN CONTENT
            ========================= */}

        <main className="dashboard-main">



          {/* NOTIFICATION */}

          {notification && (

            <div className="dashboard-notification">

              <div>
                <Info size={18} />

                <span>
                  {notification}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setNotification(null)}
              >
                <X size={17} />
              </button>

            </div>

          )}


          {/* =========================
              HOME
              ========================= */}

          {activeTab === "home" && (

            <section className="dashboard-view">

              <div className="welcome-panel">

                <div>

                  <span className="section-label">
                    MY KHAYACONNECT
                  </span>

                  <h3>
                    Good morning. 👋
                  </h3>

                  <p>
                    Welcome back. Let's take care
                    of your health today.
                  </p>

                </div>

                <button
                  type="button"
                  onClick={() =>
                    setActiveTab("calendar")
                  }
                >
                  Open my calendar
                </button>

              </div>


              <section className="home-voice-reminders" aria-label="Voice reminders">
                <div className="home-voice-reminders-icon" aria-hidden="true"><Volume2 size={22} /></div>
                <div className="home-voice-reminders-copy">
                  <strong>Voice reminders</strong>
                  <span>Read today’s schedule when switched on, and speak medication reminders while this dashboard is open.</span>
                </div>
                <label className="home-voice-reminders-control">
                  <span>{voiceReminders ? "On" : "Off"}</span>
                  <input
                    type="checkbox"
                    checked={voiceReminders}
                    onChange={(event) => enableVoiceReminders(event.target.checked)}
                    aria-label="Enable voice reminders"
                  />
                </label>
              </section>


              <div className="quick-overview">

                <div className="overview-card">

                  <Pill />

                  <div>
                    <span>
                      Medication
                    </span>

                    <strong>{scheduledTodayCount} scheduled today</strong>
                  </div>

                </div>


                <div className="overview-card">

                  <CalendarIcon />

                  <div>
                    <span>
                      Next visit
                    </span>

                    <strong>{upcomingVisit ? `CHW visit · ${new Date(upcomingVisit.visit_date).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}` : upcomingAppointment ? `Appointment · ${String(upcomingAppointment.appointment_time || "time not set").slice(0, 5)}` : "No upcoming visit or appointment"}</strong>
                  </div>

                </div>


                <div className="overview-card">

                  <Check />

                  <div>
                    <span>
                      Adherence
                    </span>

                    <strong>{careData.adherence.length} dose confirmation{careData.adherence.length === 1 ? "" : "s"} recorded</strong>
                  </div>

                </div>

              </div>

            </section>

          )}


          {/* =========================
              CALENDAR
              ========================= */}

          {activeTab === "calendar" && (

            <section className="dashboard-view">

              <div className="view-heading">

                <div>

                  <span className="section-label">
                    CARE PLANNER
                  </span>

                  <h3>
                    Calendar & Progress
                  </h3>

                  <p>
                    Keep track of your medication,
                    visits and appointments.
                  </p>

                </div>

                <span className="month-label">
                  {calendarDate.toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </span>

              </div>


              {/* CALENDAR */}

              <div className="calendar-panel">

                <div className="calendar-header">

                  <button
                    type="button"
                    className="calendar-nav-button"
                    onClick={previousMonth}
                    aria-label="Previous month"
                  >
                    ←
                  </button>

                  <div className="calendar-month-heading">
                    <strong>
                      {calendarDate.toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                      })}
                    </strong>

                    <span>
                      Your care schedule
                    </span>
                  </div>

                  <button
                    type="button"
                    className="calendar-nav-button"
                    onClick={nextMonth}
                    aria-label="Next month"
                  >
                    →
                  </button>

                  <button
                    type="button"
                    className="calendar-read-button"
                    onClick={readTodaySchedule}
                    aria-label="Read today's schedule aloud"
                  >
                    <Volume2 size={16} /> Read today
                  </button>

                </div>


                <div className="calendar-week">

                  {[
                    "Sun",
                    "Mon",
                    "Tue",
                    "Wed",
                    "Thu",
                    "Fri",
                    "Sat",
                  ].map((day) => (

                    <div key={day}>
                      {day}
                    </div>

                  ))}

                </div>


                <div className="calendar-grid">

                  {calendarDays.map((item, index) => {
                    if (!item) {
                      return (
                        <div
                          key={`empty-${index}`}
                          className="calendar-day empty-day"
                        />
                      );
                    }

                    return (
                      <button
                        type="button"
                        key={item.day}
                        className={`calendar-day ${item.events.length ? "has-event" : ""} ${item.events.some((event) => event.type.startsWith("medicine")) ? "has-medicine" : ""} ${item.events.some((event) => event.type === "visit") ? "has-visit" : ""} ${item.events.some((event) => event.type === "appointment") ? "has-appointment" : ""} ${item.events.some((event) => event.oneTime) ? "has-one-time-medication" : ""}`}
                        onClick={() =>
                          showNotification(
                            `${calendarDate.toLocaleDateString(
                              "en-US",
                              { month: "long" }
                            )} ${item.day}, ${calendarYear}`
                          )
                        }
                      >

                        <strong>
                          {item.day}
                        </strong>

                        {item.events.slice(0, 2).map((event, eventIndex) => (
                          <div className={`calendar-event ${event.type}`} key={`${event.type}-${eventIndex}`}>
                            {event.type.startsWith("medicine") && <Pill size={14} />}
                            {event.type === "visit" && <Users size={14} />}
                            {event.type === "appointment" && <CalendarIcon size={14} />}
                            <span>{event.text}</span>
                          </div>
                        ))}
                        {item.events.length > 2 && <small className="calendar-more-events">+{item.events.length - 2} more</small>}

                      </button>
                    );
                  })}


                </div>

              </div>


              {/* PROGRESS */}

              <div className="progress-panel">
                <div className="progress-heading">
                  <div><h4>Medication confirmations</h4><p>Recorded doses over the last seven days.</p></div>
                  <strong>{lastWeekConfirmedCount}</strong>
                </div>
                {lastWeekConfirmedCount ? <div className="progress-bars">{adherenceByDay.map((item) => <div className="progress-column" key={item.key}>
                  <div className="progress-value">{item.count}</div>
                  <div className="progress-track"><div className="progress-fill" style={{ height: `${(item.count / maxDailyConfirmations) * 100}%` }} /></div>
                  <span>{item.label}</span>
                </div>)}</div> : <p className="progress-empty">No medication confirmations have been recorded yet.</p>}
              </div>

            </section>

          )}


          {/* =========================
              EMERGENCY
              ========================= */}

          {activeTab === "emergency" && (

            <section className="dashboard-view emergency-view">

              <div className="emergency-panel">

                <div className="emergency-icon">
                  <AlertTriangle size={42} />
                </div>

                <span className="section-label">
                  EMERGENCY ASSISTANCE
                </span>

                <h3>
                  Do you need urgent help?
                </h3>

                <p>
                  Use the emergency button if you
                  need immediate assistance from
                  your support network.
                </p>

                <button type="button" className="dispatch-button" onClick={handleEmergencyRequest} disabled={isSendingSos}>
                  <ShieldAlert size={22} />
                  {isSendingSos ? "Sending request…" : "Get Emergency Help"}
                </button>

                <small>
                  Your linked family, CHW, clinic staff and administrators can be notified.
                </small>

              </div>

            </section>

          )}


          {/* =========================
              MEDICATION
              ========================= */}

          {activeTab === "pills" && (

            <section className="dashboard-view">

              <div className="view-heading">

                <div>

                  <span className="section-label">
                    MEDICATION
                  </span>

                  <h3>
                    My Medication
                  </h3>

                  <p>
                    Keep track of today's
                    medication schedule.
                  </p>

                </div>

                <button
                  type="button"
                  className="primary-small-button"
                  onClick={() => setIsAddingReminder((open) => !open)}
                >
                  <Plus size={17} />
                  Add reminder
                </button>

              </div>


              {isAddingReminder && <form className="elderly-reminder-form" onSubmit={handleReminderSubmit}>
                <label>Medication<input required maxLength={100} value={reminderForm.medication_name} onChange={(event) => setReminderForm((current) => ({ ...current, medication_name: event.target.value }))} /></label>
                <label>Dosage<input maxLength={100} value={reminderForm.dosage} onChange={(event) => setReminderForm((current) => ({ ...current, dosage: event.target.value }))} placeholder="Optional" /></label>
                <label>Time<input required type="time" value={reminderForm.dosage_time} onChange={(event) => setReminderForm((current) => ({ ...current, dosage_time: event.target.value }))} /></label>
                <label>Schedule date<input required type="date" min={new Date().toLocaleDateString("en-CA")} value={reminderForm.schedule_date} onChange={(event) => setReminderForm((current) => ({ ...current, schedule_date: event.target.value }))} /><small>Each medicine is scheduled for one date.</small></label>
                <button type="submit" disabled={isSavingReminder}>{isSavingReminder ? "Saving…" : "Save reminder"}</button>
              </form>}
              <div className="medication-list">
                {careData.medications.length ? careData.medications.map((medication) => (
                  <article className="medication-item" key={medication.schedule_id}>
                    <div className="medication-icon blue"><Pill size={25} /></div>
                    <div className="medication-information">
                      <h4>{medication.medication_name}</h4>
                      <p>{medication.dosage || "Dosage not specified"} · {medication.frequency === "once" ? `One day${medication.scheduled_date ? ` · ${medication.scheduled_date}` : ""}` : "Needs a date"}</p>
                      <span>{String(medication.dosage_time || "").slice(0, 5)}</span>
                    </div>
                    <div className="medication-schedule-controls">
                      <input aria-label={`One-day date for ${medication.medication_name}`} type="date" min={new Date().toLocaleDateString("en-CA")} value={scheduleDateEdits[medication.schedule_id] ?? medication.scheduled_date ?? ""} onChange={(event) => setScheduleDateEdits((current) => ({ ...current, [medication.schedule_id]: event.target.value }))} />
                      <button type="button" disabled={savingModeId === medication.schedule_id} onClick={() => updateMedicationMode(medication, "once")}>{savingModeId === medication.schedule_id ? "Saving…" : medication.frequency === "once" ? "Update date" : "Set one day"}</button>
                    </div>
                    {medication.frequency !== "once"
                      ? <span className="scheduled-status">Choose a date to add this medicine to the calendar.</span>
                      : medication.taken_today
                      ? <span className="taken-status"><Check size={15} /> Taken</span>
                      : medication.frequency === "once" && medication.scheduled_date > new Date().toLocaleDateString("en-CA")
                        ? <span className="scheduled-status">Scheduled for {medication.scheduled_date}</span>
                        : <button type="button" className="take-button" disabled={savingScheduleId === medication.schedule_id} onClick={() => handleMedicationTaken(medication)}>{savingScheduleId === medication.schedule_id ? "Saving…" : "Mark as Taken"}</button>}
                  </article>
                )) : <p>No medication schedules have been added to your account yet.</p>}
              </div>

            </section>

          )}


          {/* =========================
              VISITS
              ========================= */}

          {activeTab === "meetings" && (

            <section className="dashboard-view">

              <div className="view-heading">

                <div>

                  <span className="section-label">
                    CARE VISITS
                  </span>

                  <h3>
                    My Visits
                  </h3>

                  <p>
                    Your upcoming CHW and clinic
                    visits.
                  </p>

                </div>

              </div>


              <div className="visit-grid">
                {careData.visits.map((visit) => <article className="visit-card" key={`visit-${visit.visit_id}`}><div className="visit-icon purple"><Users size={25} /></div><span>CHW VISIT</span><h4>{visit.chw_user__full_name || "Community Health Worker"}</h4><p>{visit.notes || "Saved home-care visit"}</p><strong>{visit.visit_date ? new Date(visit.visit_date).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" }) : "Date unavailable"} · {visit.status || "scheduled"}</strong></article>)}
                {careData.appointments.map((appointment) => <article className="visit-card" key={`appointment-${appointment.appointment_id}`}><div className="visit-icon red"><CalendarIcon size={25} /></div><span>CLINIC APPOINTMENT</span><h4>{appointment.appointment_type || appointment.clinic_name}</h4><p>{appointment.clinic_name}{appointment.notes ? ` · ${appointment.notes}` : ""}</p><strong>{appointment.appointment_date}{appointment.appointment_time ? ` · ${String(appointment.appointment_time).slice(0, 5)}` : ""} · {appointment.status || "scheduled"}</strong></article>)}
                {!careData.visits.length && !careData.appointments.length && <p>No visits or appointments have been recorded yet.</p>}
              </div>

            </section>

          )}


          {/* =========================
              SETTINGS
              ========================= */}

          {activeTab === "settings" && (

            <section className="dashboard-view settings-view">

              <div className="view-heading">

                <div>

                  <span className="section-label">
                    PERSONALIZATION
                  </span>

                  <h3>
                    Settings
                  </h3>

                  <p>
                    Change how KhayaConnect
                    looks and works for you.
                  </p>

                </div>

              </div>


              {/* THEMES */}

              <div className="settings-panel">

                <h4>
                  Dashboard Colour
                </h4>

                <p>
                  Choose a colour that is
                  comfortable for you.
                </p>


                <div className="theme-options">

                  {[
                    {
                      id: "blue",
                      label: "KhayaConnect",
                    },

                    {
                      id: "dark",
                      label: "Dark",
                    },
                  ].map((item) => (

                    <button
                      key={item.id}
                      type="button"
                      className={`theme-option ${
                        theme === item.id
                          ? "selected"
                          : ""
                      } theme-option-${item.id}`}
                      onClick={() => {
                        setTheme(item.id);

                        showNotification(
                          `${item.label} theme selected.`
                        );
                      }}
                    >

                      <span />

                      {item.label}

                    </button>

                  ))}

                </div>

              </div>


              {/* ACCESSIBILITY */}

              <div className="settings-panel">

                <h4>
                  Accessibility
                </h4>

                <p>
                  Make KhayaConnect easier
                  to use.
                </p>


                <label className="setting-toggle">

                  <div>

                    <strong>
                      High contrast
                    </strong>

                    <span>
                      Increase text and interface
                      contrast.
                    </span>

                  </div>

                  <input
                    type="checkbox"
                    checked={highContrast}
                    onChange={(event) => setHighContrast(event.target.checked)}
                  />

                </label>

                <label className="setting-toggle">
                  <div>
                    <strong>Large text</strong>
                    <span>Increase text size across the elderly dashboard. You can turn it off at any time.</span>
                  </div>
                  <input type="checkbox" checked={largeText} onChange={(event) => setLargeText(event.target.checked)} />
                </label>


                <label className="setting-toggle">

                  <div>

                    <strong>
                      Voice reminders
                    </strong>

                    <span>
                      Read today’s schedule when enabled, then speak medication reminders while this dashboard is open.
                    </span>

                  </div>

                  <input
                    type="checkbox"
                    checked={voiceReminders}
                    onChange={(event) => enableVoiceReminders(event.target.checked)}
                  />

                </label>

              </div>

            </section>

          )}


          {/* =========================
              RECENTS
              ========================= */}

          {activeTab === "recents" && <RecentActivity title="Recent care activity" />}

          {activeTab === "notifications" && <section className="dashboard-view"><NotificationsPanel roleLabel="elderly care" /></section>}

        </main>

      </div>


      <KhayaAssistant role="elderly" highContrast={highContrast} largeText={largeText} />
      {navigationGuard}
    </div>
  );
}

export default ElderlyDashboard;


