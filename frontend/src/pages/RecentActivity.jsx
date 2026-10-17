import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Activity, AlertTriangle, ArrowLeft, Calendar, CheckCircle2, Clock3, Pill, Users } from "lucide-react";
import "../styles/RecentActivity.css";

const icons = { medication: Pill, appointment: Calendar, visit: Users, emergency: AlertTriangle, risk: AlertTriangle, administration: Activity, notification: Activity };
function formatTimestamp(value) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" });
}

export default function RecentActivity({ title = "Recent activity" }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("activity");
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/recent-activity/", { credentials: "include" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load recent activity.");
      setItems(data.activities || []); setError("");
    } catch (loadError) { setError(loadError.message || "Unable to load recent activity."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    let active = true;
    const initialLoad = window.setTimeout(() => { if (active) load(); }, 0);
    const timer = setInterval(() => { if (active) load(); }, 30000);
    const refreshWhenFocused = () => { if (active) load(); };
    window.addEventListener("focus", refreshWhenFocused);
    return () => { active = false; clearTimeout(initialLoad); clearInterval(timer); window.removeEventListener("focus", refreshWhenFocused); };
  }, [load]);
  const selected = items.find((item) => item.id === selectedId);
  const openItem = (id) => setSearchParams((current) => { const next = new URLSearchParams(current); next.set("activity", id); return next; });
  const closeItem = () => setSearchParams((current) => { const next = new URLSearchParams(current); next.delete("activity"); return next; });
  if (loading) return <section className="kc-recent-panel" aria-live="polite"><p className="kc-recent-message">Loading recent activity…</p></section>;
  if (error) return <section className="kc-recent-panel" role="alert"><p className="kc-recent-error">{error}</p><button type="button" onClick={load}>Try again</button></section>;
  if (selectedId) {
    if (!selected) return <section className="kc-recent-panel"><button className="kc-recent-back" type="button" onClick={closeItem}><ArrowLeft size={17} /> Back to Recents</button><p className="kc-recent-message">This activity is unavailable or no longer accessible.</p></section>;
    const Icon = icons[selected.type] || Clock3;
    return <section className="kc-recent-panel" aria-labelledby="kc-recent-detail-title"><button className="kc-recent-back" type="button" onClick={closeItem}><ArrowLeft size={17} /> Back to Recents</button><article className="kc-recent-detail"><div className={`kc-recent-icon kc-recent-icon-${selected.type}`}><Icon size={21} /></div><span className="kc-recent-kicker">ACTIVITY DETAILS</span><h2 id="kc-recent-detail-title">{selected.title}</h2><p>{selected.description}</p><dl><div><dt>Date and time</dt><dd>{formatTimestamp(selected.timestamp)}</dd></div>{selected.status && <div><dt>Status</dt><dd>{selected.status.replaceAll("_", " ")}</dd></div>}{Object.entries(selected.details || {}).filter(([, value]) => value !== "").map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{String(value)}</dd></div>)}</dl></article></section>;
  }
  return <section className="kc-recent-panel" aria-labelledby="kc-recent-heading"><div className="kc-recent-heading"><div><span className="kc-recent-kicker">ACTIVITY</span><h2 id="kc-recent-heading">{title}</h2><p>Saved activity available to your account.</p></div><button type="button" onClick={load} aria-label="Refresh recent activity"><Activity size={18} /> Refresh</button></div>{items.length ? <ol className="kc-recent-list">{items.map((item) => { const Icon = icons[item.type] || Clock3; return <li key={item.id}><button type="button" className="kc-recent-item" onClick={() => openItem(item.id)}><span className={`kc-recent-icon kc-recent-icon-${item.type}`}><Icon size={19} /></span><span className="kc-recent-copy"><strong>{item.title}</strong><span>{item.description}</span><time dateTime={item.timestamp}>{formatTimestamp(item.timestamp)}</time></span>{item.status && <span className="kc-recent-status"><CheckCircle2 size={14} />{item.status.replaceAll("_", " ")}</span>}</button></li>; })}</ol> : <div className="kc-recent-empty"><Clock3 size={24} /><h3>No recent activity</h3><p>Saved updates will appear here when available.</p></div>}</section>;
}
