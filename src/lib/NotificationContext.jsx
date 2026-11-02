import React, { createContext, useContext, useState, useEffect } from 'react';
import { studio } from '@/api/studioClient';

const NotificationContext = createContext();

const notificationFingerprint = (notification) =>
  [notification.type || "general", notification.title || "", notification.message || ""]
    .map((value) => String(value).trim().toLocaleLowerCase())
    .join("|");

function dedupeNotifications(items) {
  const seen = new Set();
  return [...(items || [])]
    .sort((a, b) => new Date(b.created_date || 0).getTime() - new Date(a.created_date || 0).getTime())
    .filter((item) => {
      // Only collapse duplicate records. Similar notifications with distinct IDs may
      // represent separate actions and must not be silently discarded as "spam".
      const key = item.id || `${notificationFingerprint(item)}|${item.created_date || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    try {
      const data = await studio.entities.Notification.list("-created_date", 100);
      const items = dedupeNotifications(data);
      setNotifications(items);
      setUnreadCount(items.filter((notification) => !notification.read).length);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
    // Subscribe to real-time updates
    const unsub = studio.entities.Notification.subscribe(() => loadNotifications());
    return unsub;
  }, []);

  const markAsRead = async (notificationId) => {
    const notification = notifications.find(n => n.id === notificationId);
    if (!notification || notification.read) return;

    try {
      await studio.entities.Notification.update(notificationId, { read: true });
      // Keep the record available in the archived tab after it has been shown.
      setNotifications((prev) => prev.map((item) => item.id === notificationId ? { ...item, read: true } : item));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const endpoint = "/api/apps/" + studio.appId + "/notification/mark-all-read";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + (localStorage.getItem("studio_access_token") || ""),
        },
      });
      if (!response.ok) throw new Error("درخواست علامت‌گذاری اعلان‌ها ناموفق بود (" + response.status + ").");
      setNotifications((previous) => previous.map((item) => ({ ...item, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const addNotification = (notification) => {
    if (notification.read) return;
    if (notifications.some((item) => item.id && item.id === notification.id)) return;
    setNotifications((previous) => [notification, ...previous]);
    setUnreadCount((previous) => previous + 1);
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      loading,
      markAsRead,
      markAllAsRead,
      addNotification,
      loadNotifications
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
