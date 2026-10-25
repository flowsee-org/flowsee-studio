import React, { useState } from 'react';
import { Bell, Check, MessageSquare, Calendar, ClipboardList, DollarSign, User, FileText } from 'lucide-react';
import { useNotifications } from '@/lib/NotificationContext';

const typeIcons = {
  task_assigned: { icon: ClipboardList, color: 'text-blue-500', bg: 'bg-blue-100' },
  meeting_request: { icon: Calendar, color: 'text-emerald-500', bg: 'bg-emerald-100' },
  announcement: { icon: MessageSquare, color: 'text-purple-500', bg: 'bg-purple-100' },
  expense_submitted: { icon: DollarSign, color: 'text-amber-500', bg: 'bg-amber-100' },
  leave_request: { icon: User, color: 'text-indigo-500', bg: 'bg-indigo-100' },
  comment: { icon: MessageSquare, color: 'text-cyan-500', bg: 'bg-cyan-100' },
  work_report: { icon: FileText, color: 'text-orange-500', bg: 'bg-orange-100' },
  general: { icon: Bell, color: 'text-slate-500', bg: 'bg-slate-100' },
};

const typeLabels = {
  task_assigned: 'تسک جدید',
  meeting_request: 'درخواست جلسه',
  announcement: 'اعلان جدید',
  expense_submitted: 'هزینه جدید',
  leave_request: 'درخواست مرخصی',
  comment: 'نظر جدید',
  work_report: 'گزارش کار',
  general: 'اطلاع‌رسانی',
};

export default function NotificationCenter() {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);

  if (loading) return <div className="w-10 h-10" />;

  const handleNotificationClick = (notification) => {
    markAsRead(notification.id);
    if (notification.link) {
      window.location.href = notification.link;
    }
    setOpen(false);
  };

  const getTimeAgo = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'همین الان';
    if (diffMins < 60) return `${diffMins} دقیقه پیش`;
    if (diffHours < 24) return `${diffHours} ساعت پیش`;
    if (diffDays < 7) return `${diffDays} روز پیش`;
    return date.toLocaleDateString('fa-IR');
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-accent transition-colors"
        aria-label="اعلانات"
      >
        <Bell className="w-5 h-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -left-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      )}

      {open && (
        <div className="fixed left-4 top-14 z-50 w-80 max-w-[calc(100vw-32px)] bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              <h3 className="font-bold">اعلانات</h3>
              {unreadCount > 0 && (
                <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">{unreadCount} خوانده نشده</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" /> همه خوانده شده
                </button>
              )}
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Bell className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>اعلان خوانده‌نشده‌ای وجود ندارد</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`p-4 hover:bg-accent/50 transition-colors cursor-pointer ${!n.read ? 'bg-primary/5' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${typeIcons[n.type]?.bg || 'bg-slate-100'}`}>
                        {(typeIcons[n.type]?.icon || Bell) && React.createElement(typeIcons[n.type]?.icon || Bell, { className: `w-4 h-4 ${typeIcons[n.type]?.color || 'text-slate-500'}` })}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`font-medium text-sm ${!n.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {typeLabels[n.type] || n.title}
                          </p>
                          {!n.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1" />}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.message}</p>
                        <p className="text-xs text-muted-foreground mt-2">{getTimeAgo(n.created_date)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}