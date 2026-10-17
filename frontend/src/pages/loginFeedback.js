export const LOGIN_MESSAGES = {
  missingBoth: "Please enter your phone number and password.",
  missingPhone: "Please enter your phone number.",
  missingPassword: "Please enter your password.",
  invalidCredentials: "Incorrect phone number or password. Please try again.",
  connection: "We couldn't connect. Please try again.",
  other: "We couldn't sign you in. Please try again.",
  success: "Successfully logged in.",
};

export function getMissingLoginMessage(phone, password) {
  const hasPhone = Boolean(phone.trim());
  const hasPassword = Boolean(password);
  if (!hasPhone && !hasPassword) return LOGIN_MESSAGES.missingBoth;
  if (!hasPhone) return LOGIN_MESSAGES.missingPhone;
  if (!hasPassword) return LOGIN_MESSAGES.missingPassword;
  return "";
}

export function getLoginErrorMessage(error) {
  if (error?.status === 401) return LOGIN_MESSAGES.invalidCredentials;
  if (error?.status >= 500 || error?.name === "TypeError") return LOGIN_MESSAGES.connection;
  return LOGIN_MESSAGES.other;
}

function isLoginVoiceEnabled(role) {
  try {
    const savedVoiceSetting = localStorage.getItem(`khayaConnectLoginVoice:${role}`);
    if (savedVoiceSetting === "true") return true;
    if (savedVoiceSetting === "false") return false;

    let userId = "guest";
    const user = JSON.parse(localStorage.getItem("khayaConnectUser") || "null");
    if (user?.user_id) userId = String(user.user_id);
    const preferences = JSON.parse(
      localStorage.getItem(`khayaConnectPreferences:${role}:${userId}`) || "{}",
    );
    if (typeof preferences.voiceGuidance === "boolean") return preferences.voiceGuidance;
    return true;
  } catch {
    return true;
  }
}

export function speakLoginFeedback(message, role) {
  if (
    !isLoginVoiceEnabled(role)
    || typeof window === "undefined"
    || !("speechSynthesis" in window)
    || !("SpeechSynthesisUtterance" in window)
  ) return Promise.resolve();

  return new Promise((resolve) => {
    let completed = false;
    const finish = () => {
      if (completed) return;
      completed = true;
      window.clearTimeout(fallbackTimer);
      resolve();
    };
    const fallbackTimer = window.setTimeout(finish, 2500);
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(message);
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find((item) => item.lang?.toLowerCase() === "en-za")
        || voices.find((item) => item.lang?.toLowerCase().startsWith("en-gb"))
        || voices.find((item) => item.lang?.toLowerCase().startsWith("en-"));
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang || "en-ZA";
      utterance.rate = 0.86;
      utterance.pitch = 1;
      utterance.volume = 1;
      utterance.onend = finish;
      utterance.onerror = finish;
      window.speechSynthesis.speak(utterance);
    } catch {
      finish();
    }
  });
}
