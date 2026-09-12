import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Clock, User, Plus, CheckCircle, MessageSquare, FileText, Calendar, DollarSign, FolderKanban, Shield, ArrowUpRight } from 'lucide-react';

const actionIcons = {
  create: { icon: Plus, color: 'text-green-500', bg: 'bg-green-100', label: 'ایجاد' },
  update: { icon: ArrowUpRight, color: 'text-blue-500', bg: 'bg-blue-100', label: 'ویرایش' },
  delete: { icon: Shield, color: 'text-red-500', bg: 'bg-red-100', label: 'حذف' },
  status_change: { icon: CheckCircle, color: 'text-purple-500', bg: 'bg-purple-100', label: 'تغییر وضعیت' },
  assign: { icon: User, color: 'text-orange-500', bg: 'bg-orange-100', label: 'اختصاص' },
  comment: { icon: MessageSquare, color: 'text-cyan-500', bg: 'bg-cyan-100', label: 'نظر' },
  complete: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-100', label: 'تکمیل' },
};

const entityIcons = {
  Task: { icon: FolderKanban, color: 'text-blue-500' },
  Project: { icon: Shield, color: 'text-purple-500' },
  Meeting: { icon: Calendar, color: 'text-emerald-500' },
  Announcement: { icon: MessageSquare, color: 'text-pink-500' },
  Expense: { icon: DollarSign, color: 'text-amber-500' },
  Income: { icon: DollarSign, color: 'text-green-500' },
  WorkReport: { icon: FileText, color: 'text-orange-500' },
  Comment: { icon: MessageSquare, color: 'text-cyan-500' },
  User: { icon: User, color: 'text-indigo-500' },
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

export default function ActivityFeed({ limit = 20 }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivities();
    const unsub = base44.entities.ActivityLog.subscribe(() => loadActivities());
    return unsub;
  }, []);

  const loadActivities = async () => {
    try {
      const data = await base44.entities.ActivityLog.list("-created_date", limit);
      setActivities(data);
    } catch (err) {
      console.error('Failed to load activities:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-4">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-primary" />
          <h3 className="font-bold">فعالیت‌های اخیر</h3>
        </div>
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-lg bg-muted" />
              <div className="flex-1 space-y-1">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-4">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-primary" />
        <h3 className="font-bold">فعالیت‌های اخیر تیم</h3>
      </div>
      <div className="space-y-2">
        {activities.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">هیچ فعالیتی ثبت نشده</p>
        ) : (
          activities.map((a) => {
            const actionInfo = actionIcons[a.action] || { icon: Clock, color: 'text-slate-500', bg: 'bg-slate-100', label: a.action };
            const entityInfo = entityIcons[a.entity_type] || { icon: Clock, color: 'text-slate-500' };
            const EntityIcon = entityInfo.icon;
            const ActionIcon = actionInfo.icon;

            return (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl bg-accent/50 hover:bg-accent/100 transition-colors">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${actionInfo.bg}`}>
                  <ActionIcon className={`w-4 h-4 ${actionInfo.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${actionInfo.bg}`}>{actionInfo.label}</span>
                    {EntityIcon && <EntityIcon className={`w-3.5 h-3.5 ${entityInfo.color}`} />}
                    <span className="text-xs text-muted-foreground">{a.entity_type}</span>
                  </div>
                  <p className="font-medium text-sm mt-1 truncate">{a.entity_title || a.details || 'مورد نامشخص'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <span className="font-medium">{a.user_name}</span> • {getTimeAgo(a.created_date)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}