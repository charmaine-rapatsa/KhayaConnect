import { useCallback, useEffect, useState } from "react";

function getPreferenceKey(role) {
  let userId = "guest";
  try {
    const user = JSON.parse(localStorage.getItem("khayaConnectUser") || "null");
    if (user?.user_id) userId = String(user.user_id);
  } catch {
    // Keep preferences isolated to the guest scope if the session is malformed.
  }
  return `khayaConnectPreferences:${role}:${userId}`;
}

export default function useDashboardPreferences(role, defaults) {
  const key = getPreferenceKey(role);
  const [preferences, setPreferences] = useState(() => {
    try {
      return { ...defaults, ...JSON.parse(localStorage.getItem(key) || "{}") };
    } catch {
      return { ...defaults };
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(preferences));
      if (typeof preferences.voiceGuidance === "boolean") {
        localStorage.setItem(`khayaConnectLoginVoice:${role}`, String(preferences.voiceGuidance));
      }
    } catch (error) {
      console.warn("Unable to save dashboard preferences:", error);
    }
  }, [key, preferences, role]);

  const updatePreferences = useCallback((nameOrValues, value) => {
    setPreferences((current) => ({
      ...current,
      ...(typeof nameOrValues === "string" ? { [nameOrValues]: value } : nameOrValues),
    }));
  }, []);

  return [preferences, updatePreferences];
}
