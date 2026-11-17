import { useEffect, useState } from 'react';
import { studio } from '@/api/studioClient';
import { useAuth } from '@/lib/AuthContext';
import { useParams } from 'react-router-dom';
import { X, Clock, FileText } from 'lucide-react';

const statusLabels = { todo: 'در انتظار', in_progress: 'در حال انجام', done: 'انجام شده' };
const statusColors = { todo: 'bg-slate-100 text-slate-600', in_progress: 'bg-blue-100 text-blue-700', done: 'bg-green-100 text-green-700' };
const priorityLabels = { low: 'کم', medium: 'متوسط', high: 'زیاد' };
const priorityColors = { low: 'bg-slate-100 text-slate-600', medium: 'bg-amber-100 text-amber-700', high: 'bg-red-100 text-red-700' };

export default function SharedTaskView({ token: tokenProp, onClose }) {
  const { user } = useAuth();
  const { token: routeToken } = useParams();
  const token = tokenProp || routeToken;
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const results = await studio.entities.Task.filter({ share_token: token });
        const rec = Array.isArray(results) ? results.find((t) => String(t.share_token) === String(token)) : null;
        if (!rec) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        setTask(rec);
      } catch (err) {
        console.error('Failed to load shared task:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/40 p-3 z-50" onClick={onClose}>
        <div className="bg-card rounded-2xl p-6 sm:p-8 shadow-xl max-w-md text-center" onClick={(e) => e.stopPropagation()}>
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">در حال بارگذاری...</p>
        </div>
      </div>
    );
  }

  if (notFound || !task) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/40 p-3 z-50" onClick={onClose}>
        <div className="bg-card rounded-2xl p-6 sm:p-8 shadow-xl max-w-md text-center" onClick={(e) => e.stopPropagation()}>
          <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="font-bold text-lg mb-1">تسک یافت نشد</h3>
          <p className="text-sm text-muted-foreground mb-4">لینک به اشتراک گذاشته شده معتبر نیست یا تسک حذف شده است.</p>
          <button onClick={onClose} className="bg-primary text-primary-foreground px-4 py-2 rounded-xl font-medium hover:opacity-90">بستن</button>
        </div>
      </div>
    );
  }

  const assignees = Array.isArray(task.assignees) ? task.assignees : (task.assignee ? [task.assignee] : []);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 p-3 z-50" onClick={onClose}>
      <div className="flex h-[min(calc(100dvh-1.5rem),52rem)] max-h-[min(calc(100dvh-1.5rem),52rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-overlay text-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 p-4 border-b border-border">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded-full ${statusColors[task.status] || statusColors.todo}`}>
              {statusLabels[task.status] || task.status}
            </span>
            {task.task_number && (
              <span className="text-xs text-muted-foreground bg-accent px-2 py-0.5 rounded-full font-mono">{task.task_number}</span>
            )}
            {(task.priority || task.status) && (
              <span className={`text-xs px-2 py-1 rounded-full ${priorityColors[task.priority]}`}>{priorityLabels[task.priority]}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} aria-label="بستن" className="p-2 hover:bg-accent rounded-lg"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1.5">عنوان تسک</label>
              <input type="text" dir="rtl" value={task.title || ""} readOnly className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-muted text-right font-medium" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium block mb-1.5">پروژه</label>
                <p className="border border-input rounded-xl px-4 py-2.5 text-sm bg-card text-right">{task.project_name || "بدون پروژه"}</p>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">وضعیت</label>
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[task.status] || statusColors.todo}`}>{statusLabels[task.status] || task.status}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium block mb-1.5">اولویت</label>
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${priorityColors[task.priority] || priorityColors.medium}`}>{priorityLabels[task.priority] || "متوسط"}</span>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">حداقلی سررسید</label>
                <p className="border border-input rounded-xl px-4 py-2.5 text-sm bg-card text-right">{task.due_date || "تعیین نشده"}</p>
              </div>
            </div>

            {task.description && (
              <div>
                <label className="text-sm font-medium block mb-1.5">توضیحات</label>
                <p className="border border-input rounded-xl px-4 py-3 text-sm bg-muted text-right leading-relaxed whitespace-pre-wrap">{task.description}</p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium block mb-1.5">مسئولین</label>
              <div className="flex flex-wrap gap-2">
                {assignees.length === 0 && <p className="text-xs text-muted-foreground">بدون مسئول</p>}
                {assignees.map((name, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-lg bg-primary/10 border border-primary/20 px-2.5 py-1 text-xs text-primary font-medium">{name}</span>
                ))}
              </div>
            </div>

            {task.tags && Array.isArray(task.tags) && task.tags.length > 0 && (
              <div>
                <label className="text-sm font-medium block mb-1.5">برچسب‌ها</label>
                <div className="flex flex-wrap gap-1.5">
                  {task.tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">{tag}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-border text-xs text-muted-foreground">
              <p className="flex items-center gap-1"><Link className="w-3 h-3" /> ایجاد شده توسط: {task.created_by || "—"}</p>
              {task.created_date && <p className="flex items-center gap-1"><Clock className="w-3 h-3" /> تاریخ ایجاد: {new Date(task.created_date).toLocaleDateString("fa-IR")}</p>}
            </div>
          </div>
        </div>

        <div className="border-t border-border bg-card p-4 flex justify-end">
          <button onClick={onClose} className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-medium hover:opacity-90 transition-opacity">بستن</button>
        </div>
      </div>
    </div>
  );
}
