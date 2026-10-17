import { useState, useEffect } from "react";



import { useNavigate } from "react-router-dom";



import { motion } from "framer-motion";







import {



  Users,
  ArrowLeft,



  UserPlus,



  Link2,



  Building2,



  Shield,



  AlertTriangle,



  CalendarDays,



  Pill,



  FileText,



  Settings,



  Search,



  RefreshCw,



  CheckCircle2,



  Menu,



  X,



  Database,



  HeartPulse,



  UserCheck,



  Activity,



  Bell,



  LogOut,



  SlidersHorizontal,



  RotateCcw,



} from "lucide-react";







import "../styles/AdminDashboard.css";
import useDashboardSection from "./useDashboardSection";
import RecentActivity from "./RecentActivity";
import EmergencyResponsePanel from "./EmergencyResponsePanel";
import useDashboardPreferences from "./useDashboardPreferences";
import KhayaAssistant from "./KhayaAssistant";
import NotificationsPanel from "./NotificationsPanel";
import { useRoleNotifications } from "./useRoleNotifications";







function apiRequest(url, options = {}) {
  let user = null;
  try { user = JSON.parse(localStorage.getItem("khayaConnectUser") || "null"); } catch { /* no saved session */ }
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers || {});
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && user?.csrf_token) headers.set("X-CSRFToken", user.csrf_token);
  return fetch(url, { ...options, headers, credentials: "include" }).then(async (response) => {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      throw new Error(`The backend returned a non-JSON response (${response.status}) for ${url}. Check the Django server, Vite proxy, and CSRF origin settings.`);
    }
    return response;
  });
}

function AdminDashboard() {



  const navigate = useNavigate();
  const [adminUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("khayaConnectUser") || "null"); }
    catch { return null; }
  });







  const [activeSection, setActiveSection, navigationGuard] = useDashboardSection("overview");
  const { unreadCount } = useRoleNotifications();



  const [sidebarOpen, setSidebarOpen] = useState(false);







  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [savingUserEdit, setSavingUserEdit] = useState(false);
  const [deletionPreview, setDeletionPreview] = useState(null);
  const [deletionName, setDeletionName] = useState("");
  const [loadingDeletionPreview, setLoadingDeletionPreview] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);







  const [preferences, updatePreferences] = useDashboardPreferences("admin", { theme: "blue", darkMode: false, highContrast: false, textSize: "medium", soundAlerts: true, notifications: true, autoSync: true, voiceGuidance: true });
  const theme = preferences.theme;
  const darkMode = preferences.darkMode;
  const highContrast = preferences.highContrast;
  const textSize = preferences.textSize;
  const soundAlerts = preferences.soundAlerts;
  const notifications = preferences.notifications;
  const autoSync = preferences.autoSync;
  const voiceGuidance = preferences.voiceGuidance;
  const setTheme = (value) => updatePreferences("theme", value);
  const setDarkMode = (value) => updatePreferences("darkMode", value);
  const setHighContrast = (value) => updatePreferences("highContrast", value);
  const setTextSize = (value) => updatePreferences("textSize", value);
  const setSoundAlerts = (value) => updatePreferences("soundAlerts", value);
  const setNotifications = (value) => updatePreferences("notifications", value);
  const setAutoSync = (value) => updatePreferences("autoSync", value);
  const setVoiceGuidance = (value) => updatePreferences("voiceGuidance", value);














  const [searchQuery, setSearchQuery] = useState("");



  const [roleFilter, setRoleFilter] = useState("All Roles");







  const [notification, setNotification] = useState("");
  const [reportSummary, setReportSummary] = useState(null);
  const [reportLoading, setReportLoading] = useState("");







  const [newUser, setNewUser] = useState({



    firstName: "",

    surname: "",



    phone: "",



    role: "",



    password: "",



  });







  /*



    EMPTY ARRAYS FOR NOW.







    These will later come from Django + SQL.



    We are deliberately not putting fake users



    or fake healthcare information here.



  */







  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [relationships, setRelationships] = useState([]);
  const [loadingRelationships, setLoadingRelationships] = useState(true);

  const [clinics, setClinics] = useState([]);
  const [loadingClinics, setLoadingClinics] = useState(true);

  const [chwAssignments, setChwAssignments] = useState([]);
  const [loadingChwAssignments, setLoadingChwAssignments] = useState(true);

  const [elderlyClinics, setElderlyClinics] = useState([]);
  const [loadingElderlyClinics, setLoadingElderlyClinics] = useState(true);

  const [clinicStaffAssignments, setClinicStaffAssignments] = useState([]);
  const [elderStaffLinks, setElderStaffLinks] = useState([]);
  const [selectedElderStaff, setSelectedElderStaff] = useState("");
  const [selectedStaffElder, setSelectedStaffElder] = useState("");
  const [selectedClinicElderStaff, setSelectedClinicElderStaff] = useState("");
  const [loadingClinicStaff, setLoadingClinicStaff] = useState(true);

  const [selectedFamily, setSelectedFamily] = useState("");
  const [selectedElderly, setSelectedElderly] = useState("");
  const [selectedCHW, setSelectedCHW] = useState("");
  const [selectedElderlyCHW, setSelectedElderlyCHW] = useState("");
  const [selectedClinicElderly, setSelectedClinicElderly] = useState("");
  const [selectedElderlyClinic, setSelectedElderlyClinic] = useState("");
  const [selectedStaff, setSelectedStaff] = useState("");
  const [selectedClinicStaff, setSelectedClinicStaff] = useState("");
  const [clinicModalOpen, setClinicModalOpen] = useState(false);
  const [newClinic, setNewClinic] = useState({
    clinicName: "",
    address: "",
    phone: "",
  });

  const elderlyUsers = users.filter((user) => user.role === "elderly");
  const familyMembers = users.filter((user) => user.role === "family");
  const chws = users.filter((user) => user.role === "chw");
  const clinicStaffUsers = users.filter((user) => user.role === "clinic");

  const appointments = [];
  const medications = [];
  const themeColors = {



    blue: {



      primary: "#164e63",



      primaryDark: "#123047",



      soft: "#e8f4f7",



    },







    emerald: {



      primary: "#047857",



      primaryDark: "#064e3b",



      soft: "#ecfdf5",



    },







    amber: {



      primary: "#b45309",



      primaryDark: "#78350f",



      soft: "#fffbeb",



    },



  };







  const currentTheme = themeColors[theme];







  const navigationItems = [



    {



      id: "overview",



      label: "Overview",



      icon: Activity,



    },



    {



      id: "users",



      label: "User Registry",



      icon: Users,



    },



    {



      id: "relationships",



      label: "Relationships",



      icon: Link2,



    },



    {



      id: "clinics",



      label: "Clinics",



      icon: Building2,



    },



    {



      id: "emergency",



      label: "Emergency Alerts",



      icon: AlertTriangle,



    },



    {



      id: "appointments",



      label: "Appointments",



      icon: CalendarDays,



    },



    {



      id: "medication",



      label: "Medication",



      icon: Pill,



    },



    {



      id: "reports",



      label: "Reports",



      icon: FileText,



    },



    {



      id: "settings",



      label: "Settings",



      icon: Settings,



    },



  ];

  navigationItems.push({ id: "recents", label: "Recents", icon: Activity });
  navigationItems.push({ id: "notifications", label: "Notifications", icon: Bell });







  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const response = await apiRequest("/api/users/");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load users.");
      setUsers(data.map((user) => ({
        id: user.user_id,
        fullName: user.full_name,
        phone: user.phone,
        role: user.role,
      })));
    } catch (error) {
      console.error("Error loading users:", error);
      showNotification("Unable to load users from the Django database.");
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchRelationships = async () => {
    try {
      setLoadingRelationships(true);
      const response = await apiRequest("/api/family-elderly/");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load Family ↔ Elderly connections.");
      setRelationships(data);
    } catch (error) {
      console.error("Error loading Family ↔ Elderly connections:", error);
      showNotification("Unable to load Family ↔ Elderly connections.");
    } finally {
      setLoadingRelationships(false);
    }
  };

  const fetchClinics = async () => {
    try {
      setLoadingClinics(true);
      const response = await apiRequest("/api/clinics/");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load clinics.");
      setClinics(data);
    } catch (error) {
      console.error("Error loading clinics:", error);
      showNotification("Unable to load clinics from the Django database.");
    } finally {
      setLoadingClinics(false);
    }
  };

  const fetchChwAssignments = async () => {
    try {
      setLoadingChwAssignments(true);
      const response = await apiRequest("/api/chw-assignments/");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load CHW assignments.");
      setChwAssignments(data);
    } catch (error) {
      console.error("Error loading CHW assignments:", error);
      showNotification("Unable to load CHW ↔ Elderly connections.");
    } finally {
      setLoadingChwAssignments(false);
    }
  };

  const fetchElderlyClinics = async () => {
    try {
      setLoadingElderlyClinics(true);
      const response = await apiRequest("/api/elderly-clinics/");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load elderly clinic assignments.");
      setElderlyClinics(data);
    } catch (error) {
      console.error("Error loading elderly clinic assignments:", error);
      showNotification("Unable to load Elderly ↔ Clinic connections.");
    } finally {
      setLoadingElderlyClinics(false);
    }
  };

  const fetchClinicStaffAssignments = async () => {
    try {
      setLoadingClinicStaff(true);
      const response = await apiRequest("/api/clinic-staff/");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load clinic staff assignments.");
      setClinicStaffAssignments(data);
    } catch (error) {
      console.error("Error loading clinic staff assignments:", error);
      showNotification("Unable to load Staff ↔ Clinic connections.");
    } finally {
      setLoadingClinicStaff(false);
    }
  };

  const fetchElderStaffLinks = async () => {
    try { const response = await apiRequest("/api/elderly-clinic-staff/"); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to load elder and clinic staff links"); setElderStaffLinks(data); }
    catch (error) { console.error("Elder ↔ clinic staff links:", error); showNotification(error.message); }
  };

  const handleElderClinicStaffConnection = async () => {
    if (!selectedElderStaff || !selectedStaffElder || !selectedClinicElderStaff) { showNotification("Select an elder, clinic staff member, and clinic."); return; }
    try {
      const response = await apiRequest("/api/elderly-clinic-staff/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ elderly_user_id: Number(selectedElderStaff), staff_user_id: Number(selectedStaffElder), clinic_id: Number(selectedClinicElderStaff) }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to link clinic staff and elder.");
      showNotification(data.message || "Clinic staff linked to elder through the selected clinic.");
      setSelectedElderStaff(""); setSelectedStaffElder(""); setSelectedClinicElderStaff("");
      await Promise.all([fetchElderStaffLinks(), fetchElderlyClinics(), fetchClinicStaffAssignments()]);
    } catch (error) { showNotification(error.message || "Unable to create the link."); }
  };
  const handleFamilyElderlyConnection = async () => {
    if (!selectedFamily || !selectedElderly) {
      showNotification("Please select a family member and an elderly user.");
      return;
    }
    try {
      const response = await apiRequest("/api/family-elderly/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ family_user_id: Number(selectedFamily), elderly_user_id: Number(selectedElderly) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create the connection.");
      showNotification("Family member connected to elderly user successfully.");
      setSelectedFamily("");
      setSelectedElderly("");
      await fetchRelationships();
    } catch (error) {
      console.error("Family ↔ Elderly connection error:", error);
      showNotification(error.message || "Unable to create Family ↔ Elderly connection.");
    }
  };

  const handleCHWElderlyConnection = async () => {
    if (!selectedCHW || !selectedElderlyCHW) {
      showNotification("Please select a CHW and an elderly user.");
      return;
    }
    try {
      const response = await apiRequest("/api/chw-assignments/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chw_user_id: Number(selectedCHW), elderly_user_id: Number(selectedElderlyCHW) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create CHW assignment.");
      showNotification("CHW connected to elderly user successfully.");
      setSelectedCHW("");
      setSelectedElderlyCHW("");
      await fetchChwAssignments();
    } catch (error) {
      console.error("CHW ↔ Elderly connection error:", error);
      showNotification(error.message || "Unable to create CHW ↔ Elderly connection.");
    }
  };

  const handleElderlyClinicConnection = async () => {
    if (!selectedElderlyClinic || !selectedClinicElderly) {
      showNotification("Please select an elderly user and a clinic.");
      return;
    }
    try {
      const response = await apiRequest("/api/elderly-clinics/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ elderly_user_id: Number(selectedElderlyClinic), clinic_id: Number(selectedClinicElderly) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create elderly clinic assignment.");
      showNotification("Elderly user connected to clinic successfully.");
      setSelectedElderlyClinic("");
      setSelectedClinicElderly("");
      await fetchElderlyClinics();
    } catch (error) {
      console.error("Elderly ↔ Clinic connection error:", error);
      showNotification(error.message || "Unable to create Elderly ↔ Clinic connection.");
    }
  };

  const handleClinicStaffConnection = async () => {
    if (!selectedStaff || !selectedClinicStaff) {
      showNotification("Please select clinic staff and a clinic.");
      return;
    }
    try {
      const response = await apiRequest("/api/clinic-staff/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staff_user_id: Number(selectedStaff), clinic_id: Number(selectedClinicStaff) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create clinic staff assignment.");
      showNotification("Clinic staff connected to clinic successfully.");
      setSelectedStaff("");
      setSelectedClinicStaff("");
      await fetchClinicStaffAssignments();
    } catch (error) {
      console.error("Staff ↔ Clinic connection error:", error);
      showNotification(error.message || "Unable to create Staff ↔ Clinic connection.");
    }
  };

  const handleRegisterClinic = async (event) => {
    event.preventDefault();
    if (!newClinic.clinicName || !newClinic.address || !newClinic.phone) {
      showNotification("Please complete all clinic fields.");
      return;
    }
    try {
      const response = await apiRequest("/api/clinics/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinic_name: newClinic.clinicName, address: newClinic.address, phone: newClinic.phone }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Clinic registration failed.");
      showNotification(`${data.clinic_name} was registered successfully.`);
      setNewClinic({ clinicName: "", address: "", phone: "" });
      setClinicModalOpen(false);
      await fetchClinics();
    } catch (error) {
      console.error("Clinic registration error:", error);
      showNotification(error.message || "Unable to register clinic.");
    }
  };

  useEffect(() => {
    if (adminUser?.role !== "admin") {
      navigate("/login/admin", { replace: true });
      return;
    }
    fetchUsers();
    fetchRelationships();
    fetchClinics();
    fetchChwAssignments();
    fetchElderlyClinics();
    fetchClinicStaffAssignments();
    fetchElderStaffLinks();
  }, [adminUser, navigate]);




  const changeSection = (section) => {



    setActiveSection(section);



    setSidebarOpen(false);



  };







  const showNotification = (message) => {



    setNotification(message);







    setTimeout(() => {



      setNotification("");



    }, 3000);



  };

  const openUserRemoval = async (user) => {
    setLoadingDeletionPreview(true);
    setDeletionPreview({ user, linkedRecords: null });
    setDeletionName("");
    try {
      const response = await apiRequest(`/api/users/${user.id}/`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to inspect this account.");
      setDeletionPreview({ user: data.user, linkedRecords: data.linked_records });
    } catch (error) {
      setDeletionPreview(null);
      showNotification(error.message || "Unable to inspect this account.");
    } finally {
      setLoadingDeletionPreview(false);
    }
  };

  const closeUserRemoval = () => {
    if (deletingUser) return;
    setDeletionPreview(null);
    setDeletionName("");
  };

  const saveUserEdit = async (event) => {
    event.preventDefault();
    if (!editingUser || savingUserEdit) return;
    setSavingUserEdit(true);
    try {
      const response = await apiRequest(`/api/users/${editingUser.id}/`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: editingUser.fullName.trim(), phone: editingUser.phone.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update account.");
      setEditingUser(null);
      showNotification(data.message || "Account details updated.");
      await fetchUsers();
    } catch (error) { showNotification(error.message || "Unable to update account."); }
    finally { setSavingUserEdit(false); }
  };

  const handleUserRemoval = async (event) => {
    event.preventDefault();
    if (!deletionPreview?.user || deletionName.trim() !== deletionPreview.user.full_name) return;
    setDeletingUser(true);
    try {
      const response = await apiRequest(`/api/users/${deletionPreview.user.user_id}/`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm_name: deletionName.trim(), confirm_user_id: deletionPreview.user.user_id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to remove this account.");
      setDeletionPreview(null);
      setDeletionName("");
      showNotification(data.message || "Account and linked records were removed.");
      await Promise.all([
        fetchUsers(), fetchRelationships(), fetchChwAssignments(),
        fetchElderlyClinics(), fetchClinicStaffAssignments(), fetchElderStaffLinks(),
      ]);
    } catch (error) {
      showNotification(error.message || "Unable to remove this account.");
    } finally {
      setDeletingUser(false);
    }
  };

  const openAdminReport = async (kind) => {
    setReportLoading(kind);
    setReportSummary(null);
    try {
      if (kind === "users" || kind === "security") {
        const response = await apiRequest("/api/users/");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load report data.");
        const roleCounts = data.reduce((counts, user) => {
          const role = String(user.role || "unknown");
          counts[role] = (counts[role] || 0) + 1;
          return counts;
        }, {});
        setReportSummary({
          title: kind === "users" ? "User account summary" : "Role access summary",
          note: "Live totals from saved accounts. This summary does not display phone numbers or passwords.",
          rows: [{ label: "Total accounts", value: data.length }, ...Object.entries(roleCounts).sort(([left], [right]) => left.localeCompare(right)).map(([role, count]) => ({ label: `${role} accounts`, value: count }))],
        });
      } else {
        const response = await apiRequest("/api/recent-activity/");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load activity report data.");
        const activityCounts = (data.activities || []).reduce((counts, item) => {
          const type = String(item.type || "other").replaceAll("_", " ");
          counts[type] = (counts[type] || 0) + 1;
          return counts;
        }, {});
        setReportSummary({
          title: "Saved system activity summary",
          note: "Counts are from activity records available to this administrator account; record details are not shown here.",
          rows: [{ label: "Saved activity records", value: data.activities?.length || 0 }, ...Object.entries(activityCounts).sort(([left], [right]) => left.localeCompare(right)).map(([type, count]) => ({ label: `${type} events`, value: count }))],
        });
      }
    } catch (error) {
      showNotification(error.message || "Unable to load report data.");
    } finally {
      setReportLoading("");
    }
  };







  const handleRegisterUser = async (event) => {

    event.preventDefault();



    if (

      !newUser.firstName ||
      !newUser.surname ||

      !newUser.phone ||

      !newUser.role ||

      !newUser.password

    ) {

      showNotification("Please complete all required fields.");

      return;

    }



    try {

      const response = await apiRequest(

        "/api/register/",

        {

          method: "POST",

          headers: {

            "Content-Type": "application/json",

          },

          body: JSON.stringify({

            first_name: newUser.firstName,
            surname: newUser.surname,

            phone: newUser.phone,

            role: newUser.role,

            password: newUser.password,

          }),

        }

      );



      const data = await response.json();



      if (!response.ok) {

        throw new Error(

          data.error || "User registration failed."

        );

      }



      showNotification(

        `${data.full_name} was registered successfully.`

      );



      setNewUser({

        firstName: "",
        surname: "",

        phone: "",

        role: "",

        password: "",

      });



      setRegisterModalOpen(false);



      await fetchUsers();

    } catch (error) {

      console.error("Registration error:", error);

      showNotification(

        error.message || "Unable to register the user."

      );

    }

  };



  const filteredUsers = users.filter((user) => {



    const matchesSearch =



      user.fullName



        ?.toLowerCase()



        .includes(searchQuery.toLowerCase()) ||



      user.phone



        ?.toLowerCase()



        .includes(searchQuery.toLowerCase());







    const matchesRole =



      roleFilter === "All Roles" ||



      user.role === roleFilter;







    return matchesSearch && matchesRole;



  });







  const resetSettings = () => {



    setTheme("blue");



    setDarkMode(false);



    setHighContrast(false);



    setTextSize("medium");



    setSoundAlerts(true);



    setNotifications(true);



    setAutoSync(true);



    setVoiceGuidance(true);







    showNotification("Settings have been reset.");



  };







  const EmptyState = ({



    icon: Icon,



    title,



    message,



  }) => {



    return (



      <div className="admin-empty-state">







        <div className="admin-empty-icon">



          <Icon size={32} />



        </div>







        <h3>{title}</h3>







        <p>{message}</p>







      </div>



    );



  };







  return (



    <div



      className={`



        admin-dashboard



        ${darkMode ? "dark-mode" : ""}



        ${highContrast ? "high-contrast" : ""}



        text-${textSize}



      `}



      style={{



        "--admin-primary": currentTheme.primary,



        "--admin-primary-dark": currentTheme.primaryDark,



        "--admin-soft": currentTheme.soft,



      }}



    >







      {/* MOBILE HEADER */}







      <div className="admin-mobile-header">







        <button



          type="button"



          className="admin-mobile-menu"



          onClick={() => setSidebarOpen(!sidebarOpen)}



        >



          {sidebarOpen ? (



            <X size={23} />



          ) : (



            <Menu size={23} />



          )}



        </button>







        <div>



          <strong>KhayaConnect</strong>



          <span>Administrator</span>



        </div>







      </div>











      {/* SIDEBAR */}







      <aside



        className={`



          admin-sidebar



          ${sidebarOpen ? "sidebar-open" : ""}



        `}



      >







        <div>







          <div className="admin-sidebar-brand">







            <div className="admin-brand-mark">



              KC



            </div>







            <div>



              <h2>KhayaConnect</h2>



              <span>Administration</span>



            </div>







          </div>











          <nav className="admin-navigation">







            <p className="admin-navigation-label">



              SYSTEM



            </p>







            {navigationItems.map((item) => {







              const Icon = item.icon;







              return (



                <button



                  key={item.id}



                  type="button"



                  className={`



                    admin-nav-item



                    ${



                      activeSection === item.id



                        ? "active"



                        : ""



                    }



                  `}



                  onClick={() =>



                    changeSection(item.id)



                  }



                >



                  <Icon size={19} />



                  <span>{item.label}</span>



                </button>



              );



            })}







          </nav>







        </div>











        {/* SIDEBAR FOOTER */}







        <div className="admin-sidebar-footer">

          {activeSection !== "overview" && <button type="button" className="admin-sidebar-back" onClick={() => setActiveSection("overview")}><ArrowLeft size={16} /> Back to dashboard</button>}







          <div className="admin-profile">







            <div className="admin-profile-avatar">



              A



            </div>







            <div className="admin-profile-info">



              <strong>{adminUser?.full_name || "Administrator"}</strong>



              <span>System Admin</span>



            </div>







          </div>







          <button



            type="button"



            className="admin-logout-button"



            onClick={async () => {
              await apiRequest("/api/logout/", { method: "POST" }).catch(() => {});
              localStorage.removeItem("khayaConnectUser");
              navigate("/", { replace: true });
            }}



          >



            <LogOut size={17} />



            Log Out



          </button>







        </div>







      </aside>











      {/* MAIN */}







      <main className="admin-main">








        {/* TOP BAR */}







        <header className="admin-topbar">







          <div>







            <p className="admin-page-label">



              ADMINISTRATION



            </p>







            <h1>



              {



                navigationItems.find(



                  (item) =>



                    item.id === activeSection



                )?.label



              }



            </h1>







          </div>











          <div className="admin-topbar-actions">







            <div className="admin-sync-status">



              <span></span>







              {autoSync



                ? "System ready"



                : "Sync paused"}



            </div>







            <button



              type="button"



              className="admin-icon-button"



              onClick={() => changeSection("notifications")}
              aria-label={unreadCount ? `Open notifications, ${unreadCount} unread` : "Open notifications"}



            >



              <Bell size={19} />
              {unreadCount > 0 && <span className="admin-notification-count">{unreadCount}</span>}



            </button>







          </div>







        </header>











        {/* NOTIFICATION */}







        {notification && (



          <motion.div



            className="admin-notification"



            initial={{



              opacity: 0,



              y: -10,



            }}



            animate={{



              opacity: 1,



              y: 0,



            }}



          >



            <CheckCircle2 size={18} />



            <span>{notification}</span>



          </motion.div>



        )}











        {/* =====================================



            OVERVIEW



        ===================================== */}







        {activeSection === "overview" && (







          <section className="admin-content">







            <motion.div



              className="admin-welcome-panel"



              initial={{



                opacity: 0,



                y: 15,



              }}



              animate={{



                opacity: 1,



                y: 0,



              }}



            >







              <div>







                <span>



                  SYSTEM CONTROL



                </span>







                <h2>



                  Welcome to KhayaConnect



                  Administration.



                </h2>







                <p>



                  Manage users, clinics,



                  relationships and system



                  configuration from one place.



                </p>







              </div>







              <div className="admin-welcome-icon">



                <Shield size={48} />



              </div>







            </motion.div>











            {/* STATS */}







            <div className="admin-stats-grid">







              <div className="admin-stat-card">



                <div className="admin-stat-icon">



                  <Users size={22} />



                </div>







                <span>Total Users</span>



                <strong>{users.length}</strong>



              </div>











              <div className="admin-stat-card">



                <div className="admin-stat-icon">



                  <HeartPulse size={22} />



                </div>







                <span>Elderly Users</span>



                <strong>



                  {elderlyUsers.length}



                </strong>



              </div>











              <div className="admin-stat-card">



                <div className="admin-stat-icon">



                  <UserCheck size={22} />



                </div>







                <span>CHWs</span>



                <strong>{chws.length}</strong>



              </div>











              <div className="admin-stat-card">



                <div className="admin-stat-icon">



                  <Building2 size={22} />



                </div>







                <span>Clinics</span>



                <strong>{clinics.length}</strong>



              </div>







            </div>











            {/* PANELS */}







            <div className="admin-two-column">







              <div className="admin-panel">







                <div className="admin-panel-header">







                  <div>



                    <span>USER REGISTRY</span>



                    <h3>System Users</h3>



                  </div>







                  <Users size={21} />







                </div>







                <EmptyState



                  icon={Database}



                  title="No users registered"



                  message="Registered users will appear here once the Django database is connected."



                />







                <button



                  type="button"



                  className="admin-primary-button"



                  onClick={() =>



                    setRegisterModalOpen(true)



                  }



                >



                  <UserPlus size={18} />



                  Register User



                </button>







              </div>











              <div className="admin-panel">







                <div className="admin-panel-header">







                  <div>



                    <span>RELATIONSHIPS</span>



                    <h3>Connected People</h3>



                  </div>







                  <Link2 size={21} />







                </div>







                <EmptyState



                  icon={Link2}



                  title="No relationships configured"



                  message="Family, CHW, clinic and staff relationships will appear here."



                />







                <button



                  type="button"



                  className="admin-primary-button"



                  onClick={() =>



                    changeSection(



                      "relationships"



                    )



                  }



                >



                  Manage Relationships



                </button>







              </div>







            </div>







          </section>



        )}











        {/* =====================================



            USERS



        ===================================== */}







        {activeSection === "users" && (







          <section className="admin-content">







            <div className="admin-section-heading">







              <div>



                <p>USER MANAGEMENT</p>







                <h2>User Registry</h2>







                <span>



                  Register and manage the people



                  who use KhayaConnect.



                </span>

                <small className="admin-registry-data-note">The current database tracks names, phone numbers and roles; registration dates and active status are not recorded.</small>



              </div>







              <button



                type="button"



                className="admin-primary-button"



                onClick={() =>



                  setRegisterModalOpen(true)



                }



              >



                <UserPlus size={18} />



                Register User



              </button>







            </div>











            <div className="admin-filter-bar">







              <div className="admin-search-box">







                <Search size={18} />







                <input



                  type="text"



                  placeholder="Search users..."



                  value={searchQuery}



                  onChange={(event) =>



                    setSearchQuery(



                      event.target.value



                    )



                  }



                />







              </div>











              <select



                value={roleFilter}



                onChange={(event) =>



                  setRoleFilter(



                    event.target.value



                  )



                }



              >



                <option>All Roles</option>



                <option value="elderly">Elderly User</option>



                <option value="family">Family Member</option>



                <option value="chw">Community Health Worker</option>



                <option value="clinic">Clinic Staff</option>



                <option value="admin">Administrator</option>



              </select>











              <button
  type="button"
  className="admin-secondary-button"
  onClick={async () => {
    await fetchUsers();
    await fetchClinics();
    await fetchRelationships();
    await fetchChwAssignments();
    await fetchElderlyClinics();
    await fetchClinicStaffAssignments();
    showNotification("Admin dashboard synchronised successfully.");
  }}
>
  <RefreshCw size={17} />
  Sync
</button>







            </div>











            <div className="admin-panel">







              {filteredUsers.length === 0 ? (







                <EmptyState



                  icon={Users}



                  title="No users found"



                  message="There are currently no registered users in the system."



                />







              ) : (







                <div className="admin-table-wrapper">







                  <table>







                    <thead>



                      <tr>



                        <th>Name</th>



                        <th>Phone</th>



                        <th>Role</th>
                        <th>Actions</th>



                      </tr>



                    </thead>







                    <tbody>







                      {filteredUsers.map(



                        (user) => (



                          <tr key={user.id}>



                            <td>{user.fullName}</td>



                            <td>{user.phone}</td>



                            <td>

                              {user.role === "elderly"

                                ? "Elderly User"

                                : user.role === "family"

                                ? "Family Member"

                                : user.role === "chw"

                                ? "Community Health Worker"

                                : user.role === "clinic"

                                ? "Clinic Staff"

                                : user.role === "admin"

                                ? "Administrator"

                                : user.role}

                            </td>
                            <td>
                              <button
                                type="button"
                                className="admin-edit-user-button"
                                onClick={() => setEditingUser({ ...user })}
                                aria-label={`Edit ${user.fullName}`}
                              >Edit</button>
                              <button
                                type="button"
                                className="admin-remove-user-button"
                                onClick={() => openUserRemoval(user)}
                                disabled={loadingDeletionPreview || deletingUser}
                                aria-label={`Remove ${user.fullName}`}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>



                        )



                      )}







                    </tbody>







                  </table>







                </div>







              )}







            </div>







          </section>



        )}











        {/* =====================================



            RELATIONSHIPS



        ===================================== */}







        {activeSection === "relationships" && (







          <section className="admin-content">







            <div className="admin-section-heading">







              <div>



                <p>SYSTEM CONNECTIONS</p>







                <h2>Relationships</h2>







                <span>



                  Establish who is connected to



                  whom within KhayaConnect.



                </span>



              </div>







              <Link2 size={36} />







            </div>











            <div className="admin-relationship-grid">







              <div className="admin-relationship-card">



                <Users size={25} />



                <h3>Family ↔ Elderly</h3>



                <p>



                  Connect family members with



                  elderly people they support.



                </p>



                <strong>



                  {relationships.length}



                </strong>



              </div>











              <div className="admin-relationship-card">



                <UserCheck size={25} />



                <h3>CHW ↔ Elderly</h3>



                <p>



                  Assign community health



                  workers to elderly users.



                </p>



                <strong>



                  {chwAssignments.length}



                </strong>



              </div>











              <div className="admin-relationship-card">



                <Building2 size={25} />



                <h3>Elderly ↔ Clinic</h3>



                <p>



                  Connect elderly users with



                  registered clinics.



                </p>



                <strong>



                  {elderlyClinics.length}



                </strong>



              </div>











              <div className="admin-relationship-card">



                <Shield size={25} />



                <h3>Staff ↔ Clinic</h3>



                <p>



                  Assign clinic staff to their



                  healthcare facility.



                </p>



                <strong>



                  {clinicStaffAssignments.length}



                </strong>



              </div>







            </div>











            <div className="admin-panel">

  <div className="admin-panel-header">
    <div>
      <span>RELATIONSHIP REGISTRY</span>
      <h3>Current Connections</h3>
    </div>

    <SlidersHorizontal size={21} />
  </div>


  {/* FAMILY ↔ ELDERLY */}

  <div style={{ padding: "24px" }}>

    <h3 style={{ marginBottom: "18px" }}>
      Family ↔ Elderly
    </h3>

    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "1fr 1fr auto",
        gap: "16px",
        alignItems: "end",
        marginBottom: "28px",
      }}
    >

      <div>
        <label
          style={{
            display: "block",
            marginBottom: "8px",
            fontWeight: "600",
          }}
        >
          Family Member
        </label>

        <select
          value={selectedFamily}
          onChange={(event) =>
            setSelectedFamily(event.target.value)
          }
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "8px",
            border:
              "1px solid #d5dce3",
          }}
        >
          <option value="">
            Select family member
          </option>

          {familyMembers.map((user) => (
            <option
              key={user.id}
              value={user.id}
            >
              {user.fullName}
            </option>
          ))}
        </select>
      </div>


      <div>
        <label
          style={{
            display: "block",
            marginBottom: "8px",
            fontWeight: "600",
          }}
        >
          Elderly User
        </label>

        <select
          value={selectedElderly}
          onChange={(event) =>
            setSelectedElderly(event.target.value)
          }
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "8px",
            border:
              "1px solid #d5dce3",
          }}
        >
          <option value="">
            Select elderly user
          </option>

          {elderlyUsers.map((user) => (
            <option
              key={user.id}
              value={user.id}
            >
              {user.fullName}
            </option>
          ))}
        </select>
      </div>


      <button
        type="button"
        className="admin-primary-button"
        onClick={
          handleFamilyElderlyConnection
        }
      >
        <Link2 size={17} />
        Connect
      </button>

    </div>


    {loadingRelationships ? (
      <p>Loading connections...</p>
    ) : relationships.length === 0 ? (
      <EmptyState
        icon={Link2}
        title="No Family ↔ Elderly connections"
        message="Create a connection above and it will appear here."
      />
    ) : (
      <div className="admin-table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Family Member</th>
              <th>Elderly User</th>
            </tr>
          </thead>

          <tbody>
            {relationships.map(
              (relationship) => (
                <tr
                  key={`${relationship.family_user_id}-${relationship.elderly_user_id}`}
                >
                  <td>
                    {relationship.family_name}
                  </td>

                  <td>
                    {relationship.elderly_name}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    )}

  </div>


  {/* CHW ↔ ELDERLY */}

  <div style={{ padding: "24px" }}>

    <h3 style={{ marginBottom: "18px" }}>
      CHW ↔ Elderly
    </h3>

    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "1fr 1fr auto",
        gap: "16px",
        alignItems: "end",
        marginBottom: "28px",
      }}
    >

      <div>
        <label
          style={{
            display: "block",
            marginBottom: "8px",
            fontWeight: "600",
          }}
        >
          Community Health Worker
        </label>

        <select
          value={selectedCHW}
          onChange={(event) =>
            setSelectedCHW(event.target.value)
          }
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "8px",
            border:
              "1px solid #d5dce3",
          }}
        >
          <option value="">
            Select CHW
          </option>

          {chws.map((user) => (
            <option
              key={user.id}
              value={user.id}
            >
              {user.fullName}
            </option>
          ))}
        </select>
      </div>


      <div>
        <label
          style={{
            display: "block",
            marginBottom: "8px",
            fontWeight: "600",
          }}
        >
          Elderly User
        </label>

        <select
          value={selectedElderlyCHW}
          onChange={(event) =>
            setSelectedElderlyCHW(
              event.target.value
            )
          }
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "8px",
            border:
              "1px solid #d5dce3",
          }}
        >
          <option value="">
            Select elderly user
          </option>

          {elderlyUsers.map((user) => (
            <option
              key={user.id}
              value={user.id}
            >
              {user.fullName}
            </option>
          ))}
        </select>
      </div>


      <button
        type="button"
        className="admin-primary-button"
        onClick={
          handleCHWElderlyConnection
        }
      >
        <UserCheck size={17} />
        Assign
      </button>

    </div>


    {loadingChwAssignments ? (
      <p>Loading CHW assignments...</p>
    ) : chwAssignments.length === 0 ? (
      <EmptyState
        icon={UserCheck}
        title="No CHW ↔ Elderly connections"
        message="Assign a community health worker to an elderly user above."
      />
    ) : (
      <div className="admin-table-wrapper">
        <table>
          <thead>
            <tr>
              <th>CHW</th>
              <th>Elderly User</th>
              <th>Assignment Date</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {chwAssignments.map(
              (assignment) => (
                <tr
                  key={assignment.assignment_id}
                >
                  <td>
                    {assignment.chw_name}
                  </td>

                  <td>
                    {assignment.elderly_name}
                  </td>

                  <td>
                    {assignment.assignment_date || "-"}
                  </td>

                  <td>
                    {assignment.status || "-"}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    )}

  </div>


  {/* ELDERLY ↔ CLINIC */}

  <div style={{ padding: "24px" }}>

    <h3 style={{ marginBottom: "18px" }}>
      Elderly ↔ Clinic
    </h3>

    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "1fr 1fr auto",
        gap: "16px",
        alignItems: "end",
        marginBottom: "28px",
      }}
    >

      <div>
        <label
          style={{
            display: "block",
            marginBottom: "8px",
            fontWeight: "600",
          }}
        >
          Elderly User
        </label>

        <select
          value={selectedElderlyClinic}
          onChange={(event) =>
            setSelectedElderlyClinic(
              event.target.value
            )
          }
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "8px",
            border:
              "1px solid #d5dce3",
          }}
        >
          <option value="">
            Select elderly user
          </option>

          {elderlyUsers.map((user) => (
            <option
              key={user.id}
              value={user.id}
            >
              {user.fullName}
            </option>
          ))}
        </select>
      </div>


      <div>
        <label
          style={{
            display: "block",
            marginBottom: "8px",
            fontWeight: "600",
          }}
        >
          Clinic
        </label>

        <select
          value={selectedClinicElderly}
          onChange={(event) =>
            setSelectedClinicElderly(
              event.target.value
            )
          }
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "8px",
            border:
              "1px solid #d5dce3",
          }}
        >
          <option value="">
            Select clinic
          </option>

          {clinics.map((clinic) => (
            <option
              key={clinic.clinic_id}
              value={clinic.clinic_id}
            >
              {clinic.clinic_name}
            </option>
          ))}
        </select>
      </div>


      <button
        type="button"
        className="admin-primary-button"
        onClick={
          handleElderlyClinicConnection
        }
      >
        <Building2 size={17} />
        Connect
      </button>

    </div>


    {loadingElderlyClinics ? (
      <p>Loading clinic assignments...</p>
    ) : elderlyClinics.length === 0 ? (
      <EmptyState
        icon={Building2}
        title="No Elderly ↔ Clinic connections"
        message="Connect an elderly user to a registered clinic above."
      />
    ) : (
      <div className="admin-table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Elderly User</th>
              <th>Clinic</th>
              <th>Assigned Date</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {elderlyClinics.map(
              (assignment) => (
                <tr
                  key={
                    assignment.elderly_clinic_id
                  }
                >
                  <td>
                    {assignment.elderly_name}
                  </td>

                  <td>
                    {assignment.clinic_name}
                  </td>

                  <td>
                    {assignment.assigned_date || "-"}
                  </td>

                  <td>
                    {assignment.status || "-"}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    )}

  </div>


  {/* ELDER ↔ CLINIC STAFF (through the existing clinic relationships) */}
  <div className="admin-elder-staff-section">
    <div className="admin-elder-staff-heading">
      <h3>Elder ↔ Clinic Staff</h3>
      <p>Connect a specific elder with a clinic staff member who supports them.</p>
    </div>
    <div className="admin-elder-staff-help">
      <strong>How this connection works</strong>
      <span>The elder must already be assigned to a clinic under Elderly ↔ Clinic, and the staff member must be assigned to that same clinic under Staff ↔ Clinic. Choose the elder, staff member and shared clinic below, then select Link.</span>
    </div>
    <div className="admin-elder-staff-form">
      <label>Elderly user<select value={selectedElderStaff} onChange={(event) => setSelectedElderStaff(event.target.value)}><option value="">Select elder</option>{elderlyUsers.map((user) => <option key={user.id} value={user.id}>{user.fullName}</option>)}</select></label>
      <label>Clinic staff<select value={selectedStaffElder} onChange={(event) => setSelectedStaffElder(event.target.value)}><option value="">Select staff member</option>{clinicStaffUsers.map((user) => <option key={user.id} value={user.id}>{user.fullName}</option>)}</select></label>
      <label>Shared clinic<select value={selectedClinicElderStaff} onChange={(event) => setSelectedClinicElderStaff(event.target.value)}><option value="">Select shared clinic</option>{clinics.map((clinic) => <option key={clinic.clinic_id} value={clinic.clinic_id}>{clinic.clinic_name}</option>)}</select></label>
      <button type="button" className="admin-primary-button" onClick={handleElderClinicStaffConnection} disabled={!selectedElderStaff || !selectedStaffElder || !selectedClinicElderStaff}><Link2 size={17} /> Link</button>
    </div>
    {elderStaffLinks.length > 0 ? <div className="admin-table-wrapper"><table><thead><tr><th>Elder</th><th>Clinic Staff</th><th>Clinic</th></tr></thead><tbody>{elderStaffLinks.map((link) => <tr key={`${link.elderly_user_id}-${link.staff_user_id}-${link.clinic_id}`}><td>{link.elderly_name}</td><td>{link.staff_name}</td><td>{link.clinic_name}</td></tr>)}</tbody></table></div> : <div className="admin-elder-staff-empty">No elder-to-clinic-staff links yet. Create one above after both people are connected to the same clinic.</div>}
  </div>
  {/* STAFF ↔ CLINIC */}

  <div style={{ padding: "24px" }}>

    <h3 style={{ marginBottom: "18px" }}>
      Staff ↔ Clinic
    </h3>

    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "1fr 1fr auto",
        gap: "16px",
        alignItems: "end",
        marginBottom: "28px",
      }}
    >

      <div>
        <label
          style={{
            display: "block",
            marginBottom: "8px",
            fontWeight: "600",
          }}
        >
          Clinic Staff
        </label>

        <select
          value={selectedStaff}
          onChange={(event) =>
            setSelectedStaff(
              event.target.value
            )
          }
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "8px",
            border:
              "1px solid #d5dce3",
          }}
        >
          <option value="">
            Select clinic staff
          </option>

          {clinicStaffUsers.map((user) => (
            <option
              key={user.id}
              value={user.id}
            >
              {user.fullName}
            </option>
          ))}
        </select>
      </div>


      <div>
        <label
          style={{
            display: "block",
            marginBottom: "8px",
            fontWeight: "600",
          }}
        >
          Clinic
        </label>

        <select
          value={selectedClinicStaff}
          onChange={(event) =>
            setSelectedClinicStaff(
              event.target.value
            )
          }
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "8px",
            border:
              "1px solid #d5dce3",
          }}
        >
          <option value="">
            Select clinic
          </option>

          {clinics.map((clinic) => (
            <option
              key={clinic.clinic_id}
              value={clinic.clinic_id}
            >
              {clinic.clinic_name}
            </option>
          ))}
        </select>
      </div>


      <button
        type="button"
        className="admin-primary-button"
        onClick={
          handleClinicStaffConnection
        }
      >
        <Shield size={17} />
        Assign
      </button>

    </div>


    {loadingClinicStaff ? (
      <p>Loading staff assignments...</p>
    ) : clinicStaffAssignments.length === 0 ? (
      <EmptyState
        icon={Shield}
        title="No Staff ↔ Clinic connections"
        message="Assign clinic staff to a healthcare facility above."
      />
    ) : (
      <div className="admin-table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Staff Member</th>
              <th>Clinic</th>
              <th>Position</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {clinicStaffAssignments.map(
              (assignment) => (
                <tr
                  key={assignment.staff_id}
                >
                  <td>
                    {assignment.staff_name}
                  </td>

                  <td>
                    {assignment.clinic_name}
                  </td>

                  <td>
                    {assignment.position || "-"}
                  </td>

                  <td>
                    {assignment.status || "-"}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    )}

  </div>


  <div style={{ marginTop: "24px" }}>
    <button
      type="button"
      className="admin-secondary-button"
      onClick={() =>
        changeSection("overview")
      }
    >
      ← Back
    </button>
  </div>

</div>







          </section>



        )}











        {/* =====================================



            CLINICS



        ===================================== */}







{activeSection === "clinics" && (
  <section className="admin-content">

    <div className="admin-section-heading">

      <div>
        <p>HEALTHCARE NETWORK</p>

        <h2>Clinics</h2>

        <span>
          Manage registered healthcare
          facilities and their staff.
        </span>
      </div>

      <Building2 size={36} />

    </div>


    <div className="admin-panel">

      <div className="admin-panel-header">

        <div>
          <span>CLINIC REGISTRY</span>
          <h3>Registered Clinics</h3>
        </div>

        <Building2 size={21} />

      </div>


      <div
        style={{
          padding: "24px",
          display: "flex",
          justifyContent: "flex-end",
        }}
      >

        <button
          type="button"
          className="admin-primary-button"
          onClick={() =>
            setClinicModalOpen(true)
          }
        >
          <Building2 size={18} />
          Add Clinic
        </button>

      </div>


      {loadingClinics ? (
        <div style={{ padding: "24px" }}>
          <p>Loading clinics...</p>
        </div>
      ) : clinics.length === 0 ? (
        <div style={{ padding: "24px" }}>
          <EmptyState
            icon={Building2}
            title="No clinics registered"
            message="Register the first clinic using the Add Clinic button."
          />
        </div>
      ) : (
        <div
          className="admin-table-wrapper"
          style={{ margin: "0 24px 24px" }}
        >
          <table>

            <thead>
              <tr>
                <th>Clinic Name</th>
                <th>Address</th>
                <th>Phone</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {clinics.map((clinic) => (
                <tr
                  key={clinic.clinic_id}
                >
                  <td>
                    {clinic.clinic_name}
                  </td>

                  <td>
                    {clinic.address || "-"}
                  </td>

                  <td>
                    {clinic.phone || "-"}
                  </td>

                  <td>
                    {clinic.status || "active"}
                  </td>
                </tr>
              ))}
            </tbody>

          </table>
        </div>
      )}

    </div>


    <div style={{ marginTop: "24px" }}>
      <button
        type="button"
        className="admin-secondary-button"
        onClick={() =>
          changeSection("overview")
        }
      >
        ← Back
      </button>
    </div>

  </section>
)}

        {/* =====================================
            EMERGENCY
        ===================================== */}
        {activeSection === "emergency" && (







          <section className="admin-content">







            <div className="admin-section-heading">







              <div>



                <p>SAFETY</p>







                <h2>Emergency Alerts</h2>







                <span>



                  Monitor emergency activity



                  across KhayaConnect.



                </span>



              </div>







              <AlertTriangle size={36} />







            </div>











            <div className="admin-panel">
              <EmergencyResponsePanel title="Emergency activity across KhayaConnect" />
            </div>







          </section>



        )}











        {/* =====================================



            APPOINTMENTS



        ===================================== */}







        {activeSection === "appointments" && (







          <section className="admin-content">







            <div className="admin-section-heading">







              <div>



                <p>HEALTHCARE</p>







                <h2>Appointments</h2>







                <span>



                  Monitor appointments across



                  registered users and clinics.



                </span>



              </div>







              <CalendarDays size={36} />







            </div>











            <div className="admin-panel">







              <EmptyState



                icon={CalendarDays}



                title="No appointments available"



                message="Appointment information will appear after the backend is connected."



              />







            </div>







          </section>



        )}











        {/* =====================================



            MEDICATION



        ===================================== */}







        {activeSection === "medication" && (







          <section className="admin-content">







            <div className="admin-section-heading">







              <div>



                <p>MEDICATION</p>







                <h2>Medication Records</h2>







                <span>



                  Monitor medication schedules



                  and adherence records.



                </span>



              </div>







              <Pill size={36} />







            </div>











            <div className="admin-panel">







              <EmptyState



                icon={Pill}



                title="No medication records"



                message="Medication schedules will appear once connected to the database."



              />







            </div>







          </section>



        )}











        {/* =====================================



            REPORTS



        ===================================== */}







        {activeSection === "reports" && (







          <section className="admin-content">







            <div className="admin-section-heading">







              <div>



                <p>SYSTEM INFORMATION</p>







                <h2>Reports</h2>







                <span>



                  Review system-level information



                  and saved records from the database.



                </span>



              </div>







              <FileText size={36} />







            </div>











            <div className="admin-report-actions">
              <button type="button" className="admin-secondary-button" onClick={() => openAdminReport("users")} disabled={Boolean(reportLoading)}><Users size={16} /> {reportLoading === "users" ? "Loading…" : "Open user summary"}</button>
              <button type="button" className="admin-secondary-button" onClick={() => openAdminReport("activity")} disabled={Boolean(reportLoading)}><Activity size={16} /> {reportLoading === "activity" ? "Loading…" : "Open activity summary"}</button>
              <button type="button" className="admin-secondary-button" onClick={() => openAdminReport("security")} disabled={Boolean(reportLoading)}><Shield size={16} /> {reportLoading === "security" ? "Loading…" : "Open access summary"}</button>
            </div>
            {reportSummary && <section className="admin-report-summary" aria-live="polite"><div><h3>{reportSummary.title}</h3><p>{reportSummary.note}</p></div><dl>{reportSummary.rows.map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl></section>}

            <div className="admin-report-grid">







              <div className="admin-report-card">



                <Users size={24} />



                <h3>User Report</h3>



                <p>



                  User registration and role



                  information.



                </p>



              </div>











              <div className="admin-report-card">



                <Activity size={24} />



                <h3>System Activity</h3>



                <p>



                  Review saved activity with
                  a live summary.



                </p>



              </div>











              <div className="admin-report-card">



                <Shield size={24} />



                <h3>Security Report</h3>



                <p>



                  Review account role totals.
                  Credentials are never displayed.



                </p>



              </div>







            </div>







          </section>



        )}











        {/* =====================================



            SETTINGS



        ===================================== */}







        {activeSection === "settings" && (







          <section className="admin-content">







            <div className="admin-section-heading">







              <div>



                <p>SYSTEM PREFERENCES</p>







                <h2>Settings</h2>







                <span>



                  Personalise the administrator



                  experience.



                </span>



              </div>







              <Settings size={36} />







            </div>











            <div className="admin-settings-card">







              <div className="admin-settings-heading">







                <Settings size={21} />







                <div>



                  <h3>Appearance</h3>



                  <p>



                    Choose how the dashboard looks.



                  </p>



                </div>







              </div>











              <div className="admin-setting-row">







                <div>



                  <strong>Theme</strong>



                  <span>



                    Select the system accent colour.



                  </span>



                </div>











                <div className="admin-theme-options">







                  <button



                    type="button"



                    className={



                      theme === "blue"



                        ? "active"



                        : ""



                    }



                    onClick={() =>



                      setTheme("blue")



                    }



                  >



                    Blue



                  </button>







                  <button



                    type="button"



                    className={



                      theme === "emerald"



                        ? "active"



                        : ""



                    }



                    onClick={() =>



                      setTheme("emerald")



                    }



                  >



                    Emerald



                  </button>







                  <button



                    type="button"



                    className={



                      theme === "amber"



                        ? "active"



                        : ""



                    }



                    onClick={() =>



                      setTheme("amber")



                    }



                  >



                    Amber



                  </button>







                </div>







              </div>











              <div className="admin-setting-row">







                <div>



                  <strong>Dark Mode</strong>



                  <span>



                    Use a darker interface.



                  </span>



                </div>







                <button



                  type="button"



                  className={`admin-toggle ${



                    darkMode ? "on" : ""



                  }`}



                  onClick={() =>



                    setDarkMode(!darkMode)



                  }



                >



                  <span></span>



                </button>







              </div>











              <div className="admin-setting-row">







                <div>



                  <strong>High Contrast</strong>



                  <span>



                    Increase visual contrast.



                  </span>



                </div>







                <button



                  type="button"



                  className={`admin-toggle ${



                    highContrast ? "on" : ""



                  }`}



                  onClick={() =>



                    setHighContrast(!highContrast)



                  }



                >



                  <span></span>



                </button>







              </div>











              <div className="admin-setting-row">







                <div>



                  <strong>Text Size</strong>



                  <span>



                    Adjust dashboard text.



                  </span>



                </div>







                <select



                  value={textSize}



                  onChange={(event) =>



                    setTextSize(



                      event.target.value



                    )



                  }



                >



                  <option value="small">



                    Small



                  </option>







                  <option value="medium">



                    Medium



                  </option>







                  <option value="large">



                    Large



                  </option>



                </select>







              </div>







            </div>











            <div className="admin-settings-card">







              <div className="admin-settings-heading">







                <SlidersHorizontal size={21} />







                <div>



                  <h3>System Controls</h3>



                  <p>



                    Configure notifications and



                    system behaviour.



                  </p>



                </div>







              </div>











              <div className="admin-setting-row">







                <div>



                  <strong>



                    Emergency Sound Alerts



                  </strong>



                  <span>



                    Play sound for emergency



                    notifications.



                  </span>



                </div>







                <button



                  type="button"



                  className={`admin-toggle ${



                    soundAlerts ? "on" : ""



                  }`}



                  onClick={() =>



                    setSoundAlerts(



                      !soundAlerts



                    )



                  }



                >



                  <span></span>



                </button>







              </div>











              <div className="admin-setting-row">







                <div>



                  <strong>Notifications</strong>



                  <span>



                    Receive administrator



                    notifications.



                  </span>



                </div>







                <button



                  type="button"



                  className={`admin-toggle ${



                    notifications ? "on" : ""



                  }`}



                  onClick={() =>



                    setNotifications(



                      !notifications



                    )



                  }



                >



                  <span></span>



                </button>







              </div>











              <div className="admin-setting-row">







                <div>



                  <strong>



                    Automatic Synchronisation



                  </strong>



                  <span>



                    Keep system information



                    synchronised.



                  </span>



                </div>







                <button



                  type="button"



                  className={`admin-toggle ${



                    autoSync ? "on" : ""



                  }`}



                  onClick={() =>



                    setAutoSync(!autoSync)



                  }



                >



                  <span></span>



                </button>







              </div>











              <div className="admin-setting-row">







                <div>



                  <strong>Voice Guidance</strong>



                  <span>



                    Enable voice assistance.



                  </span>



                </div>







                <button



                  type="button"



                  className={`admin-toggle ${



                    voiceGuidance ? "on" : ""



                  }`}



                  onClick={() =>



                    setVoiceGuidance(



                      !voiceGuidance



                    )



                  }



                >



                  <span></span>



                </button>







              </div>











              <button



                type="button"



                className="admin-reset-button"



                onClick={resetSettings}



              >



                <RotateCcw size={17} />



                Reset Settings



              </button>







            </div>







          </section>



        )}







        {activeSection === "recents" && <section className="admin-content"><RecentActivity title="Recent administration activity" /></section>}
        {activeSection === "notifications" && <section className="admin-content"><NotificationsPanel roleLabel="administrator" /></section>}
      </main>











      {/* =====================================



          REGISTER MODAL



      ===================================== */}







      {registerModalOpen && (







        <div className="admin-modal-overlay">







          <motion.div



            className="admin-modal"



            initial={{



              opacity: 0,



              scale: 0.96,



            }}



            animate={{



              opacity: 1,



              scale: 1,



            }}



          >







            <div className="admin-modal-header">







              <div>



                <p>USER REGISTRATION</p>



                <h2>Register a User</h2>



              </div>







              <button



                type="button"



                onClick={() =>



                  setRegisterModalOpen(false)



                }



              >



                <X size={21} />



              </button>







            </div>











            <form



              className="admin-register-form"



              onSubmit={handleRegisterUser}



            >







              <label>



                First name







                <input



                  type="text"



                  value={newUser.firstName}



                  onChange={(event) =>



                    setNewUser({



                      ...newUser,



                      firstName:



                        event.target.value,



                    })



                  }



                  placeholder="Enter first name"



                />



              </label>

              <label>
                Surname
                <input
                  type="text"
                  value={newUser.surname}
                  onChange={(event) => setNewUser({ ...newUser, surname: event.target.value })}
                  placeholder="Enter surname"
                />
              </label>











              <label>



                Phone Number







                <input



                  type="tel"



                  value={newUser.phone}



                  onChange={(event) =>



                    setNewUser({



                      ...newUser,



                      phone:



                        event.target.value,



                    })



                  }



                  placeholder="Enter phone number"



                />



              </label>











              <label>



                Role







                <select



                  value={newUser.role}



                  onChange={(event) =>



                    setNewUser({



                      ...newUser,



                      role:



                        event.target.value,



                    })



                  }



                >



                  <option value="">



                    Select a role



                  </option>







                  <option value="elderly">



                    Elderly User



                  </option>







                  <option value="family">



                    Family Member



                  </option>







                  <option value="chw">



                    Community Health Worker



                  </option>







                  <option value="clinic">



                    Clinic Staff



                  </option>







                  <option value="admin">



                    Administrator



                  </option>



                </select>



              </label>











              <label>



                Temporary Password







                <input



                  type="password"



                  value={newUser.password}



                  onChange={(event) =>



                    setNewUser({



                      ...newUser,



                      password:



                        event.target.value,



                    })



                  }



                  placeholder="Create temporary password"



                />



              </label>











              <div className="admin-modal-actions">







                <button



                  type="button"



                  className="admin-secondary-button"



                  onClick={() =>



                    setRegisterModalOpen(false)



                  }



                >



                  ← Back



                </button>







                <button



                  type="submit"



                  className="admin-primary-button"



                >



                  <UserPlus size={17} />



                  Register User



                </button>







              </div>







            </form>







          </motion.div>







        </div>







      )}







      {deletionPreview && (
        <div className="admin-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeUserRemoval(); }}>
          <motion.div className="admin-modal admin-delete-user-modal" role="dialog" aria-modal="true" aria-labelledby="remove-user-title" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="admin-modal-header">
              <div>
                <p>PERMANENT ACCOUNT REMOVAL</p>
                <h2 id="remove-user-title">Remove {deletionPreview.user.full_name}?</h2>
              </div>
              <button type="button" onClick={closeUserRemoval} aria-label="Close removal confirmation"><X size={21} /></button>
            </div>
            {loadingDeletionPreview || !deletionPreview.linkedRecords ? (
              <p className="admin-delete-user-message">Checking the account and its linked data…</p>
            ) : (
              <form className="admin-register-form" onSubmit={handleUserRemoval}>
                <div className="admin-delete-user-warning">
                  <AlertTriangle size={20} />
                  <div>
                    <strong>This permanently removes this account and its linked data from the database.</strong>
                    <p>Account ID: {deletionPreview.user.user_id} · Role: {deletionPreview.user.role}</p>
                  </div>
                </div>
                <p className="admin-delete-user-message">Records found for this account:</p>
                <ul className="admin-delete-user-records">
                  {Object.entries(deletionPreview.linkedRecords)
                    .filter(([key, count]) => key !== "total_linked_records" && count > 0)
                    .map(([key, count]) => <li key={key}><span>{key.replaceAll("_", " ")}</span><strong>{count}</strong></li>)}
                  {deletionPreview.linkedRecords.total_linked_records === 0 && <li>No linked records were found.</li>}
                  <li className="admin-delete-user-total"><span>Total linked records</span><strong>{deletionPreview.linkedRecords.total_linked_records}</strong></li>
                </ul>
                <label>
                  Type the account’s full name to confirm
                  <input autoComplete="off" value={deletionName} onChange={(event) => setDeletionName(event.target.value)} placeholder={deletionPreview.user.full_name} />
                </label>
                <div className="admin-modal-actions">
                  <button type="button" className="admin-secondary-button" onClick={closeUserRemoval} disabled={deletingUser}>Cancel</button>
                  <button type="submit" className="admin-remove-user-confirm" disabled={deletingUser || deletionName.trim() !== deletionPreview.user.full_name}>
                    {deletingUser ? "Removing…" : "Permanently remove"}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}

      {editingUser && (
        <div className="admin-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !savingUserEdit) setEditingUser(null); }}>
          <motion.div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="edit-user-title" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="admin-modal-header"><div><p>USER REGISTRY</p><h2 id="edit-user-title">Edit account details</h2></div><button type="button" onClick={() => !savingUserEdit && setEditingUser(null)} aria-label="Close edit account"><X size={21} /></button></div>
            <form className="admin-register-form" onSubmit={saveUserEdit}>
              <label>Full name<input required maxLength={100} value={editingUser.fullName} onChange={(event) => setEditingUser({ ...editingUser, fullName: event.target.value })} /></label>
              <label>Phone number<input required maxLength={20} type="tel" value={editingUser.phone} onChange={(event) => setEditingUser({ ...editingUser, phone: event.target.value })} /></label>
              <p>Role cannot be changed here. Account status and registration date are not stored in the current database table.</p>
              <div className="admin-modal-actions"><button type="button" className="admin-secondary-button" disabled={savingUserEdit} onClick={() => setEditingUser(null)}>Cancel</button><button type="submit" className="admin-primary-button" disabled={savingUserEdit}>{savingUserEdit ? "Saving…" : "Save changes"}</button></div>
            </form>
          </motion.div>
        </div>
      )}

      {clinicModalOpen && (
  <div className="admin-modal-overlay">

    <motion.div
      className="admin-modal"
      initial={{
        opacity: 0,
        scale: 0.96,
      }}
      animate={{
        opacity: 1,
        scale: 1,
      }}
    >

      <div className="admin-modal-header">

        <div>
          <p>CLINIC REGISTRATION</p>
          <h2>Register a Clinic</h2>
        </div>

        <button
          type="button"
          onClick={() =>
            setClinicModalOpen(false)
          }
        >
          <X size={21} />
        </button>

      </div>


      <form
        className="admin-register-form"
        onSubmit={handleRegisterClinic}
      >

        <label>
          Clinic Name

          <input
            type="text"
            value={newClinic.clinicName}
            onChange={(event) =>
              setNewClinic({
                ...newClinic,
                clinicName:
                  event.target.value,
              })
            }
            placeholder="Enter clinic name"
          />
        </label>


        <label>
          Address

          <input
            type="text"
            value={newClinic.address}
            onChange={(event) =>
              setNewClinic({
                ...newClinic,
                address:
                  event.target.value,
              })
            }
            placeholder="Enter clinic address"
          />
        </label>


        <label>
          Phone Number

          <input
            type="text"
            value={newClinic.phone}
            onChange={(event) =>
              setNewClinic({
                ...newClinic,
                phone:
                  event.target.value,
              })
            }
            placeholder="Enter clinic phone number"
          />
        </label>


        <div className="admin-modal-actions">

          <button
            type="button"
            className="admin-secondary-button"
            onClick={() =>
              setClinicModalOpen(false)
            }
          >
            ← Back
          </button>


          <button
            type="submit"
            className="admin-primary-button"
          >
            <Building2 size={17} />
            Register Clinic
          </button>

        </div>

      </form>

    </motion.div>

  </div>
)}

      <KhayaAssistant role="admin" highContrast={highContrast} largeText={textSize === "large"} />
      {navigationGuard}
    </div>



  );



}







export default AdminDashboard;







