const ROLE_CONTENT = {
  elderly: {
    title: "KhayaConnect Assistant",
    greeting: "Hello. I can help you find your calendar, medication reminders, visits, emergency help and settings. I can explain where to find these features, but I cannot give medical advice.",
    topics: ["calendar", "medication", "visits", "emergency", "settings", "notifications"],
    suggestions: ["What is on my calendar?", "Where can I see medication reminders?", "How do I ask for emergency help?"],
  },
  family: {
    title: "KhayaCare Assistant",
    greeting: "Hello. I can help you find saved information for elders linked to your account, including their schedule, medication logs, care team and alert history.",
    topics: ["schedule", "medication", "care team", "alerts", "notifications", "settings"],
    suggestions: ["Where can I see an elder’s schedule?", "How do I review medication logs?", "Where is alert history?"],
  },
  chw: {
    title: "KhayaConnect CHW Assistant",
    greeting: "Hello. I can help you find your assigned patients, visit route, medication follow-ups, SOS alerts and settings.",
    topics: ["patients", "visits", "medication", "alerts", "settings", "notifications"],
    suggestions: ["Where are my assigned patients?", "How do I record a visit?", "Where can I review SOS alerts?"],
  },
  clinic: {
    title: "KhayaConnect Clinic Assistant",
    greeting: "Hello. I can help you find clinic patients, appointments, medication records, emergency alerts, health records and settings.",
    topics: ["patients", "appointments", "medication", "alerts", "health records", "settings"],
    suggestions: ["How do I schedule an appointment?", "Where are medication records?", "How do I respond to an emergency alert?"],
  },
  admin: {
    title: "KhayaConnect Admin Assistant",
    greeting: "Hello. I can help you navigate user accounts, relationships, clinics, appointments, medication, emergency alerts, reports and settings.",
    topics: ["users", "relationships", "clinics", "appointments", "medication", "alerts", "reports", "settings"],
    suggestions: ["Where can I manage user accounts?", "How do I review audit events?", "Where can I see emergency alerts?"],
  },
};

const TOPICS = {
  calendar: { terms: /\b(calendar|schedule|today|upcoming|appointment|appointments)\b/, labels: { elderly: "Calendar", family: "Elder’s Schedule", chw: "Visit Route", clinic: "Appointments", admin: "Appointments" }, answer: { elderly: "Open Calendar to review your medication reminders, appointments and community health worker visits. Use Read today to hear today’s schedule aloud.", family: "Open Elder’s Schedule to review appointments and care visits recorded for elders linked to your account.", chw: "Open Visit Route to review visits assigned to your CHW account.", clinic: "Open Appointments to review or schedule patient clinic visits.", admin: "Open Appointments to review the appointment records available to administrators." } },
  medication: { terms: /\b(medication|medicine|medicines|meds|pill|pills|dose|dosage|adherence|adherance|medcation|medicin)\b/, labels: { elderly: "Medication", family: "Medication Logs", chw: "Medication", clinic: "Medication", admin: "Medication" }, answer: { elderly: "Open Medication to review your saved schedule and medication confirmations. For medical decisions or changes to a dose, contact your healthcare professional.", family: "Open Medication Logs to review medication schedules and confirmations for linked elders.", chw: "Open Medication to review assigned medication follow-ups and available adherence information.", clinic: "Open Medication to review medication schedules and adherence records available to your clinic.", admin: "Open Medication to review medication records available to the administrator dashboard." } },
  visits: { terms: /\b(visit|visits|route|chw|community health worker|home visit)\b/, labels: { elderly: "My Visits", family: "Elder’s Schedule", chw: "Visit Route", clinic: "Appointments", admin: "Relationships" }, answer: { elderly: "Open My Visits or Calendar to review community health worker visits saved to your care schedule.", family: "Open Elder’s Schedule to review visits for elders linked to your account.", chw: "Open Visit Route to view assigned visits. Use the visit form there to record a visit when that feature is available to your account.", clinic: "Clinic staff can review clinic appointments in Appointments. CHW home-visit routes are managed in the CHW dashboard.", admin: "Open Relationships to review care links between users; visit details are available in the relevant care dashboards." } },
  emergency: { terms: /\b(emergency|emergancy|sos|alert|alerts|alrt|risk|danger)\b/, labels: { elderly: "Emergency", family: "Alert History", chw: "SOS & Alerts", clinic: "Emergency Alerts", admin: "Emergency Alerts" }, answer: { elderly: "Open Emergency to request help. If you are in immediate danger, contact local emergency services as well.", family: "Open Alert History to review emergency requests and saved risk alerts for linked elders.", chw: "Open SOS & Alerts to review emergency requests and assigned patient alerts.", clinic: "Open Emergency Alerts to review and respond to alerts available to your clinic.", admin: "Open Emergency Alerts to review saved emergency response records." } },
  patients: { terms: /\b(patient|patients|pateint|elder|elders|user|users|account|accounts|registry)\b/, labels: { elderly: "Home", family: "Care Team & Contacts", chw: "My Patients", clinic: "Patients", admin: "User Registry" }, answer: { elderly: "Your care information is shown on Home and in Calendar, Medication and My Visits.", family: "Open Care Team & Contacts to review people linked to your account. Only linked care information is shown here.", chw: "Open My Patients to see patients assigned to your CHW account.", clinic: "Open Patients to review patient information available to your clinic account.", admin: "Open User Registry to search and manage registered KhayaConnect accounts." } },
  careteam: { terms: /\b(care team|contact|contacts|family member|relationship|relationships|linked)\b/, labels: { elderly: "Home", family: "Care Team & Contacts", chw: "My Patients", clinic: "Patients", admin: "Relationships" }, answer: { elderly: "Your linked family contact is shown on Home when a connection is available.", family: "Open Care Team & Contacts to review the care team and contacts recorded for linked elders.", chw: "Open My Patients to review patients assigned to your account.", clinic: "Open Patients to review patients linked to your clinic.", admin: "Open Relationships to review or manage family, CHW and clinic links." } },
  health: { terms: /\b(health record|health records|medical record|medical history)\b/, labels: { elderly: "Home", family: "Medication Logs", chw: "My Patients", clinic: "Health Records", admin: "Reports" }, answer: { elderly: "Your available care information is shown in the relevant dashboard sections. I cannot interpret medical records.", family: "Review the linked elder’s available care information in Medication Logs and Elder’s Schedule. I cannot interpret medical records.", chw: "Review patient care information in My Patients and the related care sections. I cannot interpret medical records.", clinic: "Open Health Records to review records available to clinic staff. I cannot interpret medical records.", admin: "Open Reports for system-level information. Clinical records are available in the relevant care dashboards." } },
  settings: { terms: /\b(setting|settings|preference|preferences|theme|dark mode|contrast|large text|accessibility)\b/, labels: { elderly: "Settings", family: "Settings", chw: "Settings", clinic: "Settings", admin: "Settings" }, answer: { elderly: "Open Settings to adjust dashboard colour, high contrast, large text and voice reminders.", family: "Open Settings to adjust large text and high contrast for the family dashboard.", chw: "Open Settings to review CHW dashboard preferences, including theme, high contrast and sync options.", clinic: "Open Settings to adjust appearance, accessibility and notification preferences.", admin: "Open Settings to adjust administrator dashboard appearance, accessibility and notification preferences." } },
  notifications: { terms: /\b(notification|notifications|bell|unread)\b/, labels: { elderly: "Notifications", family: "Notifications", chw: "Notifications", clinic: "Notifications", admin: "Notifications" }, answer: { elderly: "Open Notifications to review updates. Medication reminders are available in Medication and Calendar.", family: "Open Notifications to review updates for your family account. Alert History shows emergency records.", chw: "Open Notifications to review updates. SOS & Alerts contains emergency requests.", clinic: "Open Notifications to review updates. Emergency Alerts contains active response records.", admin: "Open Notifications to review administrator updates." } },
  reports: { terms: /\b(report|reports|audit|audit log|audit trail)\b/, labels: { admin: "Reports" }, answer: { admin: "Open Reports for system reports. In Django Admin, Audit events lists recorded account actions; normal browsing does not automatically create every kind of audit event." } },
  clinics: { terms: /\b(clinic|clinics)\b/, labels: { admin: "Clinics", clinic: "Appointments" }, answer: { admin: "Open Clinics to review and manage clinic records and staff links.", clinic: "Open Appointments to select a clinic while scheduling a patient visit." } },
};

const TYPO_FIXES = [[/\bmedcation\b/g, "medication"], [/\bmedicin\b/g, "medicine"], [/\bappoinment\b/g, "appointment"], [/\bappointmnt\b/g, "appointment"], [/\bschdule\b/g, "schedule"], [/\bemergancy\b/g, "emergency"], [/\balrts\b/g, "alerts"], [/\balrt\b/g, "alert"], [/\bnotifcations\b/g, "notifications"], [/\bnotifcation\b/g, "notification"], [/\bsettng(s)?\b/g, "setting$1"], [/\bpateint(s)?\b/g, "patient$1"], [/\badherance\b/g, "adherence"]];

export const assistantRoleContent = (role) => ROLE_CONTENT[role] || ROLE_CONTENT.elderly;

export function answerKhayaQuestion(role, question) {
  const content = assistantRoleContent(role);
  const original = String(question || "").trim();
  if (!original) return { text: "Type a KhayaConnect question, or choose a suggested question below.", topics: content.topics.slice(0, 3) };
  let normalized = original.toLowerCase().replace(/[’']/g, "'");
  for (const [pattern, replacement] of TYPO_FIXES) normalized = normalized.replace(pattern, replacement);
  normalized = normalized.replace(/[^a-z0-9\s']/g, " ").replace(/\s+/g, " ").trim();

  if (/^(hi|hello|hey|good morning|good afternoon|good evening|howzit)\b/.test(normalized)) return { text: content.greeting, topics: content.topics.slice(0, 3) };
  if (/^(k|ok|okay|yes|no|hmm|.?\?)$/.test(normalized) || normalized.length < 3) return { text: "I’m not sure what you mean yet. Please ask a little more, such as “Where can I see my appointments?”", topics: content.topics.slice(0, 3) };
  if (/\b(what can you do|how can you help|help me|help)\b/.test(normalized)) return { text: `I can answer questions about ${content.topics.join(", ")}. I can explain where dashboard features are and summarize only the records made available to your role.`, topics: content.topics.slice(0, 4) };

  const asksMedication = TOPICS.medication.terms.test(normalized);
  const asksAppointmentOrVisit = /\b(appointments?|calendar|visits?|route)\b/.test(normalized);
  const matches = Object.entries(TOPICS).filter(([key, item]) => {
    if (key === "calendar" && asksMedication && !asksAppointmentOrVisit) return false;
    return item.terms.test(normalized) && item.answer[role];
  });
  if (matches.length > 1) {
    const topics = matches.map(([key]) => key).slice(0, 3);
    return { text: "I can help with both. Which one do you mean? Choose a topic below, or ask one question at a time.", topics };
  }
  if (matches.length) {
    const [key, item] = matches[0];
    return { text: item.answer[role], topics: [key, ...content.topics.filter((topic) => topic !== key)].slice(0, 3) };
  }
  if (/\b(weather|football|soccer|recipe|music|movie|politics|bitcoin|stock|homework)\b/.test(normalized)) return { text: "I’m here to help with KhayaConnect. Ask me about a feature on your dashboard, such as medication, appointments, alerts or settings.", topics: content.topics.slice(0, 3) };
  if (normalized.split(" ").length <= 2) return { text: "Could you tell me a little more? Are you asking about a dashboard feature, a saved record, or how to use KhayaConnect?", topics: content.topics.slice(0, 3) };
  return { text: "I can’t answer that from the KhayaConnect features available to your role. Try one of the suggested questions, or name the dashboard section you mean.", topics: content.topics.slice(0, 3) };
}

export const topicQuestion = (role, key) => {
  const examples = {
    calendar: "Where can I see my calendar and schedule?", schedule: "Where can I see the schedule?", medication: "Where can I review medication information?", visits: "Where can I find visits?", emergency: "Where can I review emergency alerts?", patients: "Where can I find patients or users?", careteam: "Where can I review care team links?", health: "Where can I see health records?", settings: "Where are dashboard settings?", notifications: "Where are my notifications?", reports: "Where can I review reports and audit events?", clinics: "Where can I manage clinics?",
  };
  return examples[key] || `How do I use ${key}?`;
};

