import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { X } from "lucide-react";
import PersianDatePicker from "@/components/PersianDatePicker";

export default function ReportForm({ tasks, userName, editReport, onClose, onSaved }) {
  const [form, setForm] = useState(
    editReport
      ? {
          task_ids: editReport.task_ids || (editReport.task_id ? [editReport.task_id] : []),
          hours: editReport.hours || 0,
          description: editReport.description || "",
          date: editReport.date || "",
        }
      : { task_ids: [], hours: 0, description: "", date: "" }
  );
  const [saving, setSaving] = useState(false);

  const toggleTask = (taskId) => {
    const current = form.task_ids || [];
    const newIds = current.includes(taskId)
      ? current.filter((id) => id !== taskId)
      : [...current, taskId];
    setForm({ ...form, task_ids: newIds });
  };

  const handleSave = async () => {
    if (!form.description || !form.date) return;
    setSaving(true);
    const selectedTasks = tasks.filter((t) => form.task_ids.includes(t.id));
    const taskTitles = selectedTasks.map((t) => t.title);
    const projectNames = [...new Set(selectedTasks.map((t) => t.project_name).filter(Boolean))];
    const data = {
      ...form,
      employee_name: editReport?.employee_name || userName,
      task_id: form.task_ids[0] || "",
      task_title: taskTitles[0] || "",
      task_ids: form.task_ids,
      task_titles: taskTitles,
      project_name: projectNames.join("، ") || "",
    };
    if (editReport) {
      await base44.entities.WorkReport.update(editReport.id, data);
    } else {
      await base44.entities.WorkReport.create(data);
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-xl max-h-[90vh] overflow-y-auto scrollbar-thin" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg">{editReport ? "ویرایش گزارش" : "ثبت گزارش کار"}</h2>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div className="bg-accent/50 rounded-xl p-3 text-sm text-muted-foreground">
            ثبت گزارش برای: <span className="font-bold text-foreground">{editReport?.employee_name || userName}</span>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">تسک‌های مرتبط (می‌توانید چند تسک انتخاب کنید)</label>
            <div className="border border-input rounded-xl p-2.5 max-h-36 overflow-y-auto scrollbar-thin space-y-1">
              {tasks.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">تسکی ثبت نشده</p>}
              {tasks.map((t) => (
                <label key={t.id} className="flex items-center gap-2 cursor-pointer hover:bg-accent/50 rounded-lg px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={(form.task_ids || []).includes(t.id)}
                    onChange={() => toggleTask(t.id)}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm flex-1">{t.title}</span>
                  {t.project_name && <span className="text-xs text-primary">{t.project_name}</span>}
                </label>
              ))}
            </div>
            {(form.task_ids || []).length > 0 && (
              <p className="text-xs text-muted-foreground mt-1.5">{(form.task_ids || []).length} تسک انتخاب شده</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1.5">ساعت کار</label>
              <input
                type="number"
                value={form.hours}
                onChange={(e) => setForm({ ...form, hours: Number(e.target.value) })}
                className="w-full border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <PersianDatePicker
              label="تاریخ"
              required
              value={form.date}
              onChange={(val) => setForm({ ...form, date: val })}
              placeholder="1405/06/12"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">
              کار انجام شده <span className="text-[#D35400]">*</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={4}
              className="w-full border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-medium mt-5 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? "در حال ثبت..." : editReport ? "ذخیره تغییرات" : "ثبت گزارش"}
        </button>
      </div>
    </div>
  );
}