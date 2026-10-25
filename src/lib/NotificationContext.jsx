import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const NotificationContext = createContext();

const notificationFingerprint = (notification) =>
  [notification.type || "general", notification.title || "", notification.message || ""]
    .map((value) => String(value).trim().toLocaleLowerCase())
    .join("|");

function dedupeRecentNotifications(items) {
  const now = Date.now();
  const seen = new Map();
  return [...(items || [])]
    .sort((a, b) => new Date(b.created_date || 0).getTime() - new Date(a.created_date || 0).getTime())
    .filter((item) => {
      const fingerprint = notificationFingerprint(item);
      const createdAt = new Date(item.created_date || now).getTime();
      const previous = seen.get(fingerprint);
      if (previous !== undefined && Math.abs(previous - createdAt) <= 10 * 60 * 1000) return false;
      seen.set(fingerprint, createdAt);
      return true;
    });
}

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    try {
      const data = await base44.entities.Notification.list("-created_date", 100);
      const unread = dedupeRecentNotifications(data).filter((notification) => !notification.read);
      setNotifications(unread);
      setUnreadCount(unread.length);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
    // Subscribe to real-time updates
    const unsub = base44.entities.Notification.subscribe(() => loadNotifications());
    return unsub;
  }, []);

  const markAsRead = async (notificationId) => {
    const notification = notifications.find(n => n.id === notificationId);
    if (!notification || notification.read) return;

    try {
      await base44.entities.Notification.update(notificationId, { read: true });
      // Acknowledged notifications leave the active inbox; read history remains in the backend.
      setNotifications((prev) => prev.filter((item) => item.id !== notificationId));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const endpoint = "/api/apps/" + base44.appId + "/notification/mark-all-read";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + (localStorage.getItem("base44_access_token") || ""),
        },
      });
      if (!response.ok) throw new Error("درخواست علامت‌گذاری اعلان‌ها ناموفق بود (" + response.status + ").");
      setNotifications([]);
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const addNotification = (notification) => {
    if (notification.read) return;
    const fingerprint = notificationFingerprint(notification);
    const createdAt = new Date(notification.created_date || Date.now()).getTime();
    const duplicate = notifications.some((item) => notificationFingerprint(item) === fingerprint && Math.abs(new Date(item.created_date || Date.now()).getTime() - createdAt) <= 10 * 60 * 1000);
    if (duplicate) return;
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