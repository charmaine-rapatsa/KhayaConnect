import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import "../styles/EmergencyResponsePanel.css";

export default function EmergencyResponsePanel({ title = "Emergency alerts" }) {
  const [emergencies, setEmergencies] = useState([]);
  const [risks, setRisks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actions, setActions] = useState({});
  const [savingId, setSavingId] = useState(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/emergency-responses/", { credentials: "include" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load emergency alerts.");
      setEmergencies(data.emergencies || []);
      setRisks(data.risks || []);
      setError("");
    } catch (loadError) {
      setError(loadError.message || "Unable to load emergency alerts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(load, 0);
    const timer = window.setInterval(load, 30000);
    const refreshWhenFocused = () => load();
    const refreshWhenAlertsUpdated = () => load();
    window.addEventListener("focus", refreshWhenFocused);
    window.addEventListener("khaya:alerts-updated", refreshWhenAlertsUpdated);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(initialLoad);
      window.removeEventListener("focus", refreshWhenFocused);
      window.removeEventListener("khaya:alerts-updated", refreshWhenAlertsUpdated);
    };
  }, [load]);

  const respond = async (emergency, status) => {
    const responseAction = String(actions[emergency.sos_id] || "").trim();
    if (!responseAction) {
      setError("Add a note describing the response before saving it.");
      return;
    }
    setSavingId(emergency.sos_id);
    setError("");
    try {
      const storedUser = JSON.parse(localStorage.getItem("khayaConnectUser") || "null");
      const response = await fetch("/api/emergency-responses/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRFToken": storedUser?.csrf_token || "" },
        body: JSON.stringify({ sos_id: emergency.sos_id, status, response_action: responseAction }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save emergency response.");
      setActions((current) => ({ ...current, [emergency.sos_id]: "" }));
      await load();
    } catch (responseError) {
      setError(responseError.message || "Unable to save emergency response.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="kc-emergency-panel" aria-label={title}>
      <header className="kc-emergency-panel-heading">
        <div><AlertTriangle size={19} /><h3>{title}</h3></div>
        <button type="button" onClick={load} aria-label="Refresh emergency alerts"><RefreshCw size={16} /> Refresh</button>
      </header>
      {error && <p className="kc-emergency-error" role="alert">{error}</p>}
      {loading ? <p className="kc-emergency-message" aria-live="polite">Loading emergency alerts…</p>
        : emergencies.length === 0 ? <p className="kc-emergency-message">No emergency records are available to your account.</p>
          : <div className="kc-emergency-list">{emergencies.length ? emergencies.map((emergency) => {
            const status = String(emergency.status || "active").toLowerCase();
            const closed = ["resolved", "cancelled"].includes(status);
            const responseOptions = status === "responding"
              ? [["responding", "Update response"], ["resolved", "Resolve"]]
              : [["acknowledged", "Acknowledge"], ["responding", "Mark responding"], ["resolved", "Resolve"]];
            return <article className="kc-emergency-card" key={emergency.sos_id}>
              <div className="kc-emergency-card-heading"><div><strong>{emergency.elderly_name || "Linked elder"}</strong><time dateTime={emergency.activated_at || ""}>{emergency.activated_at ? new Date(emergency.activated_at).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" }) : "Time unavailable"}</time></div><span className={`kc-emergency-status ${closed ? "closed" : "open"}`}>{emergency.status || "active"}</span></div>
              {emergency.response_notes && <p className="kc-emergency-notes">{emergency.response_notes}</p>}
              {!!emergency.responses?.length && <ol className="kc-emergency-responses">{emergency.responses.map((item) => <li key={item.response_id}><strong>{item.responder_user__full_name || "Care team"}</strong>: {item.response_action}{item.outcome ? ` · ${item.outcome}` : ""}</li>)}</ol>}
              {!closed && <div className="kc-emergency-action-form"><label htmlFor={`kc-response-${emergency.sos_id}`}>Response note</label><textarea id={`kc-response-${emergency.sos_id}`} maxLength={255} value={actions[emergency.sos_id] || ""} onChange={(event) => setActions((current) => ({ ...current, [emergency.sos_id]: event.target.value }))} /><div>{responseOptions.map(([nextStatus, label]) => <button type="button" key={nextStatus} disabled={savingId === emergency.sos_id} onClick={() => respond(emergency, nextStatus)}>{savingId === emergency.sos_id ? "Saving…" : label}</button>)}</div></div>}
            </article>;
          }) : <p className="kc-emergency-message">No emergency SOS requests are recorded for this view.</p>}</div>}
      <section className="kc-risk-alerts" aria-label="Risk alerts">
        <header><AlertTriangle size={18} /><h3>Risk alerts</h3><span>{risks.length}</span></header>
        {risks.length ? (
          <div className="kc-emergency-list">
            {risks.map((risk) => {
              const status = String(risk.status || "open").toLowerCase();
              const closed = ["resolved", "closed", "cancelled"].includes(status);
              return (
                <article className="kc-emergency-card kc-risk-card" key={risk.alert_id}>
                  <div className="kc-emergency-card-heading">
                    <div>
                      <strong>{risk.elderly_user__full_name || "Linked elder"} · {String(risk.alert_type || "Risk alert").replaceAll("_", " ")}</strong>
                      <time dateTime={risk.created_at || ""}>{risk.created_at ? new Date(risk.created_at).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" }) : "Time unavailable"}</time>
                    </div>
                    <span className={`kc-emergency-status ${closed ? "closed" : "open"}`}>{risk.severity || status}</span>
                  </div>
                  {risk.description && <p className="kc-emergency-notes">{risk.description}</p>}
                  {risk.status && <small>Status: {risk.status}</small>}
                </article>
              );
            })}
          </div>
        ) : <p className="kc-emergency-message">No risk alerts are currently recorded for this view.</p>}
      </section>
    </section>
  );
}
