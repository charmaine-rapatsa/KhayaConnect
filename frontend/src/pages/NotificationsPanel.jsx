import { Bell, Check, RefreshCw, ShieldAlert } from "lucide-react";
import { useRoleNotifications } from "./useRoleNotifications";
import "../styles/NotificationsPanel.css";

function formatDate(value) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" });
}

export default function NotificationsPanel({ roleLabel = "your account" }) {
  const { notifications, unreadCount, loading, error, refresh, markRead } = useRoleNotifications();

  return (
    <section className="kc-notifications-panel" aria-labelledby="kc-notifications-heading">
      <div className="kc-notifications-heading">
        <div>
          <span className="kc-notifications-kicker">UPDATES FOR {roleLabel.toUpperCase()}</span>
          <h2 id="kc-notifications-heading">Notifications</h2>
          <p>{unreadCount ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}` : "You’re all caught up."} Emergency requests are labeled separately from routine updates.</p>
        </div>
        <div className="kc-notifications-actions">
          <button type="button" onClick={() => refresh()}><RefreshCw size={16} /> Refresh</button>
          {unreadCount > 0 && <button type="button" onClick={() => markRead()}><Check size={16} /> Mark all read</button>}
        </div>
      </div>

      {error && <p className="kc-notifications-error" role="alert">{error}</p>}
      {loading ? <p className="kc-notifications-state">Loading your notifications…</p> : notifications.length === 0 ? (
        <div className="kc-notifications-empty"><Bell size={24} /><h3>No notifications yet</h3><p>Updates sent to your account will appear here.</p></div>
      ) : (
        <ul className="kc-notifications-list">
          {notifications.map((item) => {
            const emergency = String(item.notification_type || "").toLowerCase() === "emergency";
            const unread = Number(item.is_read) === 0;
            return (
              <li key={item.notification_id} className={`kc-notification-item ${unread ? "is-unread" : ""} ${emergency ? "is-emergency" : ""}`}>
                <span className="kc-notification-icon">{emergency ? <ShieldAlert size={19} /> : <Bell size={18} />}</span>
                <div className="kc-notification-copy">
                  <div className="kc-notification-title-row"><strong>{item.title || (emergency ? "Emergency update" : "Care update")}</strong>{emergency && <span className="kc-notification-type">Emergency</span>}{unread && <span className="kc-notification-unread">Unread</span>}</div>
                  <p>{item.message}</p>
                  <time dateTime={item.created_at || undefined}>{formatDate(item.created_at)}</time>
                </div>
                {unread && <button type="button" className="kc-notification-read" onClick={() => markRead(item.notification_id)} aria-label={`Mark ${item.title || "notification"} as read`}><Check size={16} /><span>Mark read</span></button>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
