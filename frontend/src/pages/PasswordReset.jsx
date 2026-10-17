import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getLoginErrorMessage, speakLoginFeedback } from "./loginFeedback";
import "../styles/password-reset.css";

async function postJson(url, payload) {
  const csrfResponse = await fetch("/api/csrf/", { credentials: "include" });
  const csrfData = await csrfResponse.json();
  if (!csrfResponse.ok) throw new Error("We couldn't connect. Please try again.");
  const response = await fetch(url, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRFToken": csrfData.csrf_token || "" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "We couldn't connect. Please try again.");
    error.status = response.status;
    throw error;
  }
  return data;
}

export default function PasswordReset() {
  const [searchParams] = useSearchParams();
  const requestedRole = searchParams.get("role") || "";
  const role = ["elderly", "family", "chw", "clinic", "admin"].includes(requestedRole) ? requestedRole : "elderly";
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [requested, setRequested] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const announce = (text, isError = false) => {
    setMessage(text);
    setError(isError);
    speakLoginFeedback(text, role);
  };
  const requestCode = async (event) => {
    event.preventDefault();
    if (!phone.trim()) return announce("Please enter your phone number.", true);
    setBusy(true);
    try {
      const data = await postJson("/api/password-reset/request/", { phone: phone.trim() });
      setRequested(true);
      announce(data.message);
    } catch (requestError) {
      announce(requestError.message || getLoginErrorMessage(requestError), true);
    } finally { setBusy(false); }
  };
  const resetPassword = async (event) => {
    event.preventDefault();
    if (!code.trim() || !password || !confirmPassword) return announce("Enter the verification code and both password fields.", true);
    if (password !== confirmPassword) return announce("The passwords do not match. Please try again.", true);
    setBusy(true);
    try {
      const data = await postJson("/api/password-reset/confirm/", { phone: phone.trim(), code: code.trim(), new_password: password });
      announce(data.message);
      setCode(""); setPassword(""); setConfirmPassword("");
    } catch (requestError) {
      announce(requestError.message || getLoginErrorMessage(requestError), true);
    } finally { setBusy(false); }
  };

  return <main className="kc-password-reset">
    <section className="kc-password-reset-card" aria-labelledby="kc-reset-title">
      <span className="kc-password-reset-brand">KHAYACONNECT</span>
      <h1 id="kc-reset-title">Reset your password</h1>
      <p>Use the phone number registered to your account.</p>
      {!requested ? <form onSubmit={requestCode}>
        <label htmlFor="kc-reset-phone">Phone number</label>
        <input id="kc-reset-phone" type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required />
        <button type="submit" disabled={busy}>{busy ? "Please wait…" : "Request code"}</button>
      </form> : <form onSubmit={resetPassword}>
        <label htmlFor="kc-reset-code">Verification code</label>
        <input id="kc-reset-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} required />
        <label htmlFor="kc-reset-password">New password</label>
        <input id="kc-reset-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        <label htmlFor="kc-reset-confirm">Confirm new password</label>
        <input id="kc-reset-confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
        <button type="submit" disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
        <button className="kc-reset-secondary" type="button" disabled={busy} onClick={() => { setRequested(false); setCode(""); setMessage(""); }}>Request another code</button>
      </form>}
      {message && <p className={`kc-reset-feedback ${error ? "is-error" : "is-success"}`} role={error ? "alert" : "status"} aria-live={error ? "assertive" : "polite"}>{message}</p>}
      <Link to={requestedRole && role === requestedRole ? `/login/${role}` : "/"}>Return to sign in</Link>
    </section>
  </main>;
}
