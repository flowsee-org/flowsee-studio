import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Paperclip, Clock, Download, ArrowUpRight, MessageSquare, FileText } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import SubtaskList from './SubtaskList';
import TaskComments from './TaskComments';
import PersianDatePicker from '@/components/PersianDatePicker';
import { loadTeamMembers } from '@/lib/teamMembers';
import { toast } from '@/components/ui/use-toast';

const priorityLabels = { low: 'کم', medium: 'متوسط', high: 'زیاد' };
const priorityColors = { low: 'bg-slate-100 text-slate-600', medium: 'bg-amber-100 text-amber-700', high: 'bg-red-100 text-red-700' };
const statusLabels = { todo: 'در انتظار', in_progress: 'در حال انجام', done: 'انجم شده' };
const statusColors = { todo: 'bg-slate-100 text-slate-600', in_progress: 'bg-blue-100 text-blue-700', done: 'bg-green-100 text-green-700' };

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

export default function TaskDetail({ task, onClose, onSaved, projects }) {
  const { user } = useAuth();
  const userName = user?.full_name || user?.email || '';
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({ ...task });
  const [activities, setActivities] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('details'); // details, comments, activity

  useEffect(() => {
    loadTeamMembers().then(setEmployees);
    loadActivities();
  }, [task?.id]);

  const loadActivities = async () => {
    if (!task?.id) return;
    try {
      const data = await base44.entities.ActivityLog.list({ q: JSON.stringify({ entity_type: 'Task', entity_id: task.id }) });
      setActivities(data.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
    } catch (err) {
      console.error('Failed to load activities:', err);
    }
  };

  const handleSave = async () => {
    if (!form.title) return;
    setSaving(true);
    try {
      const proj = projects.find((p) => p.id === form.project_id);
      const data = { ...form, project_name: proj?.name || form.project_name || '' };
      await base44.entities.Task.update(task.id, data);
      toast({ title: 'تسک بروزرسانی شد' });
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      toast({ title: 'خطا', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const attachments = form.attachments || [];
      setForm({ ...form, attachments: [...attachments, { name: file.name, url: file_url, type: file.type }] });
    } catch (err) {
      console.error('Upload failed', err);
      toast({ title: 'خطا در آپلود', variant: 'destructive' });
    }
    setUploading(false);
  };

  const removeAttachment = (index) => {
    setForm({ ...form, attachments: (form.attachments || []).filter((_, i) => i !== index) });
  };

  const handleSubtaskChange = (newSubtasks) => {
    setForm({ ...form, subtasks: newSubtasks });
  };

  const addTime = async (hours) => {
    const newTime = (form.time_spent || 0) + hours;
    setForm({ ...form, time_spent: newTime });
    try {
      await base44.entities.Task.update(task.id, { time_spent: newTime });
      toast({ title: `${hours} ساعت اضافه شد` });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2 py-1 rounded-full ${statusColors[task?.status] || statusColors.todo}`}>
              {statusLabels[task?.status] || task?.status}
            </span>
            {task?.task_number && (
              <span className="text-xs text-muted-foreground bg-accent px-2 py-0.5 rounded-full font-mono">
                {task.task_number}
              </span>
            )}
            {task?.priority && (
              <span className={`text-xs px-2 py-1 rounded-full ${priorityColors[task.priority]}`}>
                {priorityLabels[task.priority]}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-border">
          <nav className="flex -mb-px" aria-label="Tabs">
            {[
              { id: 'details', label: 'جزئیات', icon: FileText },
              { id: 'comments', label: 'نظرات', icon: MessageSquare, count: task?.comments_count || 0 },
              { id: 'activity', label: 'فعالیت', icon: ArrowUpRight },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.count && <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{tab.count}</span>}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-160px)]">
          {activeTab === 'details' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1.5">
                  عنوان تسک <span className="text-primary">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5">پروژه</label>
                  <select
                    value={form.project_id}
                    onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                    className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">بدون پروژه</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">وضعیت</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="todo">در انتظار</option>
                    <option value="in_progress">در حال انجام</option>
                    <option value="done">انجام شده</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5">اولویت</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="low">کم</option>
                    <option value="medium">متوسط</option>
                    <option value="high">زیاد</option>
                  </select>
                </div>
                <div>
                  <PersianDatePicker
                    label="ددلاین"
                    value={form.due_date || ''}
                    onChange={(val) => setForm({ ...form, due_date: val })}
                    placeholder="تاریخ سررسید"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium block mb-1.5">مسئولین</label>
                <div className="border border-input rounded-xl p-2.5 max-h-36 overflow-y-auto scrollbar-thin space-y-1.5">
                  {employees.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">کارمندی ثبت نشده</p>}
                  {employees.map((emp) => (
                    <label key={emp.id} className="flex items-center gap-2 cursor-pointer hover:bg-accent/50 rounded-lg px-2 py-1.5">
                      <input
                        type="checkbox"
                        checked={(form.assignees || []).includes(emp.name)}
                        onChange={() => {
                          const current = form.assignees || [];
                          const newAssignees = current.includes(emp.name)
                            ? current.filter((a) => a !== emp.name)
                            : [...current, emp.name];
                          setForm({ ...form, assignees: newAssignees, assignee: newAssignees[0] || userName });
                        }}
                        className="w-4 h-4 accent-primary"
                      />
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                        {emp.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm">{emp.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium block mb-1.5">ساعت کار</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={form.time_spent || 0}
                    onChange={(e) => setForm({ ...form, time_spent: Number(e.target.value) })}
                    className="w-24 border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <span className="text-sm text-muted-foreground">ساعت</span>
                  <div className="flex gap-1 ml-auto">
                    {[0.5, 1, 2, 4].map(h => (
                      <button
                        key={h}
                        onClick={() => addTime(h)}
                        className="text-xs bg-accent hover:bg-primary/10 text-muted-foreground hover:text-primary px-2 py-1 rounded-lg"
                      >
                        +{h}h
                      </button>
                    ))}
                  </div>
                </div>
                {form.time_spent && (
                  <p className="text-xs text-muted-foreground mt-1">مجموع ساعت کار: {form.time_spent} ساعت</p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium block mb-1.5">زیرتسک‌ها</label>
                <SubtaskList subtasks={form.subtasks || []} onChange={handleSubtaskChange} />
              </div>

              <div>
                <label className="text-sm font-medium block mb-1.5">پیوست‌ها</label>
                <div className="flex items-center gap-2 mb-2">
                  <label className="flex-1 border border-dashed border-input rounded-xl px-4 py-2.5 text-sm text-muted-foreground cursor-pointer hover:bg-accent/30 flex items-center gap-2">
                    <Paperclip className="w-4 h-4" />
                    {uploading ? 'در حال آپلود...' : 'آپلود فایل'}
                    <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                  </label>
                </div>
                {(form.attachments || []).length > 0 && (
                  <div className="space-y-2">
                    {form.attachments.map((att, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-accent/40 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Paperclip className="w-5 h-5 text-muted-foreground" />
                          <span className="text-sm truncate max-w-[200px]">{att.name}</span>
                        </div>
                        <div className="flex gap-1">
                          <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                            <Download className="w-3.5 h-3.5" /> دانلود
                          </a>
                          <button onClick={() => removeAttachment(idx)} className="text-xs text-red-500 hover:underline">حذف</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium block mb-1.5">توضیحات</label>
                <textarea
                  value={form.description || ''}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={4}
                  className="w-full border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
            </div>
          )}

          {activeTab === 'comments' && (
            <TaskComments taskId={task.id} />
          )}

          {activeTab === 'activity' && (
            <div className="space-y-3">
              {activities.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">هیچ فعالیتی ثبت نشده</p>
              ) : (
                activities.map((a) => (
                  <div key={a.id} className="flex items-start gap-3 p-3 rounded-xl bg-accent/50">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{a.details}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {a.user_name} • {getTimeAgo(a.created_date)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between p-4 border-t border-border">
          <div className="flex gap-2">
            {task?.archived ? (
              <button onClick={() => setForm({ ...form, archived: false })} className="text-sm text-primary hover:underline">بازگرداندن از بایگانی</button>
            ) : (
              <button onClick={() => setForm({ ...form, archived: true })} className="text-sm text-muted-foreground hover:text-primary">بایگانی</button>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
          </button>
        </div>
      </div>
    </div>
  );
}