import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { X, Paperclip, Sparkles } from "lucide-react";
import PersianDatePicker from "@/components/PersianDatePicker";
import { loadTeamMembers } from "@/lib/teamMembers";
import SubtaskList from "./SubtaskList";
import { toast } from "@/components/ui/use-toast";
import SelectControl from "@/components/ui/SelectControl";

export default function TaskForm({ projects, userName, editTask, onClose, onSaved }) {
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState(
    editTask || {
      title: "",
      project_id: "",
      project_name: "",
      status: "todo",
      priority: "medium",
      assignees: [userName],
      assignee: userName,
      description: "",
      due_date: "",
      subtasks: [],
      time_spent: 0,
      attachments: [],
      recurring_config: null,
    }
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const showRecurring = !!form.recurring_config;

  useEffect(() => {
    loadTeamMembers().then(setEmployees);
  }, []);

  const toggleAssignee = (name) => {
    const current = form.assignees || [];
    const newAssignees = current.includes(name)
      ? current.filter((a) => a !== name)
      : [...current, name];
    setForm({ ...form, assignees: newAssignees, assignee: newAssignees[0] || userName });
  };

  const handleSubtaskChange = (newSubtasks) => {
    setForm({ ...form, subtasks: newSubtasks });
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
      console.error("Upload failed", err);
      toast({ title: "خطا در آپلود", variant: "destructive" });
    }
    setUploading(false);
  };

  const removeAttachment = (index) => {
    setForm({ ...form, attachments: (form.attachments || []).filter((_, i) => i !== index) });
  };

  const handleRecurringChange = (config) => {
    setForm({ ...form, recurring_config: config });
  };

  const toggleRecurring = (enabled) => {
    setForm((current) => ({
      ...current,
      recurring_config: enabled
        ? (current.recurring_config || { frequency: "weekly", day_of_week: 0 })
        : null,
    }));
  };

  const generateTaskDescription = async () => {
    if (!String(form.title || "").trim()) {
      toast({ title: "ابتدا عنوان تسک را وارد کنید", variant: "destructive" });
      return;
    }
    setGeneratingDescription(true);
    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: "برای تسک زیر یک شرح ساختاریافته و قابل اجرا به فارسی بنویس. بخش‌ها: هدف، مراحل اجرا، چک‌لیست تحویل، معیار پذیرش و وابستگی‌ها. از ساختن جزئیات نامعلوم خودداری کن و موارد نامعلوم را به شکل سؤال مشخص کن.\nعنوان: " + form.title + "\nپروژه: " + (form.project_name || projects.find((p) => p.id === form.project_id)?.name || "مشخص نشده") + "\nشرح فعلی: " + (form.description || "ندارد"),
      });
      const generated = typeof response === "string" ? response : response?.text || response?.result || "";
      if (!String(generated).trim()) throw new Error("پاسخ قابل استفاده‌ای از هوش مصنوعی دریافت نشد.");
      setForm((current) => ({ ...current, description: String(generated).trim() }));
      toast({ title: "شرح ساختاریافته تولید شد", description: "پیش از ثبت، متن را بازبینی کنید." });
    } catch (error) {
      toast({ title: "تولید متن ناموفق بود", description: error.message || "دوباره تلاش کنید.", variant: "destructive" });
    } finally {
      setGeneratingDescription(false);
    }
  };

  const handleSave = async () => {
    if (!form.title) return;
    setSaving(true);
    try {
      const proj = projects.find((p) => p.id === form.project_id);
      const data = { ...form, project_name: proj?.name || form.project_name || "" };
      if (editTask?.id) {
        await base44.entities.Task.update(editTask.id, data);
      } else {
        await base44.entities.Task.create(data);
      }
      toast({ title: editTask?.id ? "تسک بروزرسانی شد" : "تسک ثبت شد" });
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      toast({ title: "خطا", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const selectedAssignees = form.assignees || [];

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-xl max-h-[90vh] overflow-y-auto scrollbar-thin" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg">{editTask?.id ? "ویرایش تسک" : "تسک جدید"}</h2>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
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
          <div>
            <label className="text-sm font-medium block mb-1.5">پروژه</label>
            <SelectControl
              value={form.project_id}
              onChange={(e) => setForm({ ...form, project_id: e.target.value })}
              className="w-full"
            >
              <option value="">بدون پروژه</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </SelectControl>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1.5">اولویت</label>
              <SelectControl
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full"
              >
                <option value="low">کم</option>
                <option value="medium">متوسط</option>
                <option value="high">زیاد</option>
              </SelectControl>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">وضعیت</label>
              <SelectControl
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full"
              >
                <option value="todo">در انتظار</option>
                <option value="in_progress">در حال انجام</option>
                <option value="done">انجام شده</option>
              </SelectControl>
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
                    checked={selectedAssignees.includes(emp.name)}
                    onChange={() => toggleAssignee(emp.name)}
                    className="w-4 h-4 accent-primary"
                  />
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                    {emp.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm">{emp.name}</span>
                </label>
              ))}
            </div>
            {selectedAssignees.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {selectedAssignees.map((name) => (
                  <span key={name} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full flex items-center gap-1">
                    {name}
                    <button onClick={() => toggleAssignee(name)} className="hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <PersianDatePicker
            label="ددلاین"
            value={form.due_date || ""}
            onChange={(val) => setForm({ ...form, due_date: val })}
            placeholder="تاریخ سررسید"
          />

          <div>
            <label className="text-sm font-medium block mb-1.5">ساعت کار (اختیاری)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.5"
                min="0"
                value={form.time_spent || 0}
                onChange={(e) => setForm({ ...form, time_spent: Number(e.target.value) || 0 })}
                className="w-24 border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <span className="text-sm text-muted-foreground">ساعت</span>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">زیرتسک‌ها</label>
            <SubtaskList subtasks={form.subtasks || []} onChange={handleSubtaskChange} />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">پیوست‌ها</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 border border-dashed border-input rounded-xl p-2.5 text-sm text-muted-foreground cursor-pointer hover:bg-accent/30">
                <Paperclip className="w-4 h-4" />
                <span>{uploading ? "در حال آپلود..." : "آپلود فایل"}</span>
                <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
              </label>
              {(form.attachments || []).length > 0 && (
                <div className="space-y-1">
                  {form.attachments.map((att, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-accent/40 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Paperclip className="w-5 h-5 text-muted-foreground" />
                        <span className="text-sm truncate max-w-[180px]">{att.name}</span>
                      </div>
                      <button onClick={() => removeAttachment(idx)} className="text-xs text-red-500 hover:underline">حذف</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!form.recurring_config}
                onChange={(e) => toggleRecurring(e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-sm">تسک تکراری</span>
            </label>
            {showRecurring && (
              <div className="mt-2 p-3 bg-primary/5 rounded-xl border border-primary/20 space-y-2">
                <div>
                  <label className="text-sm font-medium block mb-1.5">تکرار</label>
                  <SelectControl
                    value={form.recurring_config?.frequency || "weekly"}
                    onChange={(e) => handleRecurringChange({ ...form.recurring_config, frequency: e.target.value })}
                    className="w-full"
                  >
                    <option value="daily">روزانه</option>
                    <option value="weekly">هفتگی</option>
                    <option value="monthly">ماهانه</option>
                  </SelectControl>
                </div>
                {form.recurring_config?.frequency === "weekly" && (
                  <div>
                    <label className="text-sm font-medium block mb-1.5">روز هفته</label>
                    <SelectControl
                      value={form.recurring_config?.day_of_week || 0}
                      onChange={(e) => handleRecurringChange({ ...form.recurring_config, day_of_week: Number(e.target.value) })}
                      className="w-full"
                    >
                      <option value={0}>یکشنبه</option>
                      <option value={1}>دوشنبه</option>
                      <option value={2}>سه‌شنبه</option>
                      <option value={3}>چهارشنبه</option>
                      <option value={4}>پنج‌شنبه</option>
                      <option value={5}>جمعه</option>
                      <option value={6}>شنبه</option>
                    </SelectControl>
                  </div>
                )}
                {form.recurring_config?.frequency === "monthly" && (
                  <div>
                    <label className="text-sm font-medium block mb-1.5">روز ماه</label>
                    <SelectControl
                      value={form.recurring_config?.day_of_month || 1}
                      onChange={(e) => handleRecurringChange({ ...form.recurring_config, day_of_month: Number(e.target.value) })}
                      className="w-full"
                    >
                      {[...Array(31)].map((_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}
                    </SelectControl>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2"><label className="text-sm font-medium">توضیحات</label><button type="button" onClick={generateTaskDescription} disabled={generatingDescription || !String(form.title || "").trim()} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/25 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"><Sparkles className="h-3.5 w-3.5" />{generatingDescription ? "در حال تولید..." : "ساخت متن با هوش مصنوعی"}</button></div>
            <textarea
              value={form.description || ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !form.title}
          className="sticky bottom-0 z-10 w-full border-t border-border bg-primary py-3 font-medium text-primary-foreground mt-5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? "در حال ثبت..." : editTask?.id ? "ذخیره تغییرات" : "ثبت تسک"}
        </button>
      </div>
    </div>
  );
}
