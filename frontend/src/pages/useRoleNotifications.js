import { useCallback, useEffect, useRef, useState } from "react";

function csrfHeaders() {
  try {
    const user = JSON.parse(localStorage.getItem("khayaConnectUser") || "null");
    return user?.csrf_token ? { "X-CSRFToken": user.csrf_token } : {};
  } catch {
    return {};
  }
}

async function parseResponse(response) {
  const type = response.headers.get("content-type") || "";
  if (!type.includes("application/json")) {
    throw new Error("The notification service did not return JSON. Check that Django is running.");
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to load notifications.");
  return data;
}

export function useRoleNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const latestRequest = useRef(0);

  const refresh = useCallback(async () => {
    if (!localStorage.getItem("khayaConnectUser")) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }
    const requestId = ++latestRequest.current;
    try {
      const data = await parseResponse(await fetch("/api/notifications/", { credentials: "include" }));
      if (requestId !== latestRequest.current) return;
      setNotifications(data.notifications || []);
      setUnreadCount(Number(data.unread_count) || 0);
      setError("");
    } catch (loadError) {
      if (requestId !== latestRequest.current) return;
      setError(loadError.message || "Unable to load notifications.");
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!active) return;
      await refresh();
    };
    load();
    const sync = () => refresh();
    window.addEventListener("khaya-notifications-updated", sync);
    const timer = window.setInterval(load, 30000);
    const onStorage = (event) => { if (event.key === "khayaNotificationsUpdated") sync(); };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", sync);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("khaya-notifications-updated", sync); window.removeEventListener("storage", onStorage); window.removeEventListener("focus", sync); };
  }, [refresh]);

  const markRead = useCallback(async (notificationId = null) => {
    setError("");
    setNotifications((current) => current.map((item) => (
      notificationId == null || String(item.notification_id) === String(notificationId)
        ? { ...item, is_read: 1 }
        : item
    )));
    setUnreadCount((count) => notificationId == null
      ? 0
      : Math.max(0, count - (notifications.some((item) => String(item.notification_id) === String(notificationId) && Number(item.is_read) === 0) ? 1 : 0)));
    try {
      const response = await fetch("/api/notifications/", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify(notificationId == null ? { mark_all_read: true } : { notification_id: notificationId }),
      });
      await parseResponse(response);
      localStorage.setItem("khayaNotificationsUpdated", String(Date.now()));
      window.dispatchEvent(new Event("khaya-notifications-updated"));
      return true;
    } catch (saveError) {
      setError(saveError.message || "Could not update this notification.");
      await refresh();
      return false;
    }
  }, [notifications, refresh]);

  return { notifications, unreadCount, loading, error, refresh, markRead };
}
