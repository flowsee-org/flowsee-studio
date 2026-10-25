import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { X, Send, AlertCircle } from "lucide-react";
import PersianDatePicker from "@/components/PersianDatePicker";
import { loadTeamMembers } from "@/lib/teamMembers";
import { toast } from "@/components/ui/use-toast";

export default function TaskRequestModal({ projects, onClose, onSaved }) {
  const { user } = useAuth();
  const userName = user?.full_name || user?.email || "";
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    project_id: "",
    project_name: "",
    priority: "medium",
    due_date: "",
    requestee: "",
    note: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadTeamMembers().then((all) => {
      // Only other members can receive a request.
      setMembers(all.filter((m) => m.name !== userName && m.email !== user?.email));
    });
  }, [user?.email, userName]);

  const handleSave = async () => {
    if (!form.title.trim() || !form.requestee) return;
    setSaving(true);
    setError("");
    try {
      await base44.entities.Task.create({
        title: form.title.trim(),
        description: form.description.trim(),
        project_id: form.project_id,
        project_name: form.project_name,
        priority: form.priority,
        due_date: form.due_date,
        // Request identity
        kind: "request",
        request_status: "pending",
        requestee: form.requestee,
        requestee_note: form.note.trim(),
        // The recipient sees it as assigned to them on approval.
        assignees: [form.requestee],
        assignee: form.requestee,
        status: "todo",
      });
      toast({
        title: "درخواست تسک ارسال شد",
        description: `درخواست برای ${form.requestee} ثبت شد.`,
      });
      setSaving(false);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || "ثبت درخواست ناموفق بود");
      setSaving(false);
    }
  };

  const handleProjectChange = (projectId) => {
    const proj = projects.find((p) => p.id === projectId);
    setForm({ ...form, project_id: projectId, project_name: proj?.name || "" });
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-xl max-h-[90vh] overflow-y-auto scrollbar-thin" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Send className="w-5 h-5 text-primary" /> درخواست تسک
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">
              برای چه کسی؟ <span className="text-primary">*</span>
            </label>
            <select
              value={form.requestee}
              onChange={(e) => setForm({ ...form, requestee: e.target.value })}
              className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">یک عضو را انتخاب کنید...</option>
              {members.map((m) => (
                <option key={m.id} value={m.name}>{m.name}</option>
              ))}
            </select>
            {members.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1.5">عضو دیگری یافت نشد.</p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">
              عنوان تسک <span className="text-primary">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="مثلاً طراحی صفحه ورود"
              className="w-full border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">پروژه</label>
            <select
              value={form.project_id}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">بدون پروژه</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
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
            <PersianDatePicker
              label="ددلاین"
              value={form.due_date}
              onChange={(val) => setForm({ ...form, due_date: val })}
              placeholder="تاریخ سررسید"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">توضیحات</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">
              پیام برای گیرنده <span className="text-xs text-muted-foreground">(اختیاری)</span>
            </label>
            <input
              type="text"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="چرا این تسک را به او پیشنهاد می‌دهید؟"
              className="w-full border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !form.title.trim() || !form.requestee}
          className="sticky bottom-0 z-10 w-full border-t border-border bg-primary text-primary-foreground py-3 rounded-xl font-medium mt-5 hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Send className="w-4 h-4" />
          {saving ? "در حال ارسال..." : "ارسال درخواست"}
        </button>
      </div>
    </div>
  );
}