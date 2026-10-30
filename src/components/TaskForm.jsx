import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { CalendarDays, Check, CheckCircle2, Circle, CircleDot, Clock3, Flag, FolderKanban, ListChecks, MoreHorizontal, Paperclip, Plus, Repeat2, Sparkles, Tag, UserRound, X } from "lucide-react";
import PersianDatePicker from "@/components/PersianDatePicker";
import { loadTeamMembers } from "@/lib/teamMembers";
import SubtaskList from "./SubtaskList";
import { toast } from "@/components/ui/use-toast";
import SelectControl from "@/components/ui/SelectControl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

const statusOptions = [
  { value: "todo", label: "در انتظار", Icon: Circle },
  { value: "in_progress", label: "در حال انجام", Icon: CircleDot },
  { value: "done", label: "انجام شده", Icon: CheckCircle2 },
];
const priorityOptions = [
  { value: "high", label: "زیاد" },
  { value: "medium", label: "متوسط" },
  { value: "low", label: "کم" },
];
const suggestedTags = ["طراحی", "توسعه", "محتوا", "بازاریابی", "پشتیبانی", "فوری"];

function PropertyChip({ icon: Icon, label, value, children, contentClassName = "" }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8 max-w-full justify-start gap-2 rounded-lg border-border bg-background px-2.5 font-normal text-muted-foreground hover:text-foreground">
          {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
          <span className="truncate text-foreground">{value || label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className={`w-64 overflow-hidden rounded-xl p-1 shadow-panel ${contentClassName}`}>
        {children}
      </PopoverContent>
    </Popover>
  );
}

export default function TaskForm({ projects, userName, editTask, onClose, onSaved }) {
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState(() => (
    editTask ? { ...editTask, tags: Array.isArray(editTask.tags) ? editTask.tags : [] } : {
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
      tags: [],
    }
  ));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const showRecurring = !!form.recurring_config;

  useEffect(() => {
    loadTeamMembers().then(setEmployees);
  }, []);

  const toggleAssignee = (name) => {
    const current = form.assignees || [];
    const newAssignees = current.includes(name)
      ? current.filter((a) => a !== name)
      : [...current, name];
    setForm({ ...form, assignees: newAssignees, assignee: newAssignees[0] || "" });
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
      const candidate = typeof response === "string"
        ? response
        : response?.text || response?.result || response?.output || response?.response || response?.content || "";
      const generated = typeof candidate === "string" ? candidate : JSON.stringify(candidate, null, 2);
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
  const selectedProject = projects.find((project) => String(project.id) === String(form.project_id));
  const selectedStatus = statusOptions.find((option) => option.value === form.status) || statusOptions[0];
  const selectedPriority = priorityOptions.find((option) => option.value === form.priority) || priorityOptions[1];
  const normalizedEmployees = [...new Map(employees.filter((employee) => employee.name).map((employee) => [employee.name.trim(), employee])).values()];
  const selectedTags = Array.isArray(form.tags) ? form.tags : [];

  const setTags = (tags) => setForm((current) => ({ ...current, tags: [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))] }));
  const toggleTag = (tag) => setTags(selectedTags.includes(tag) ? selectedTags.filter((item) => item !== tag) : [...selectedTags, tag]);
  const addTag = () => {
    const value = tagInput.trim();
    if (!value) return;
    setTags([...selectedTags, value]);
    setTagInput("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6" onClick={onClose}>
      <section dir="rtl" role="dialog" aria-modal="true" aria-labelledby="task-form-title" className="flex max-h-[min(90vh,52rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-overlay" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
            <FolderKanban className="h-4 w-4 shrink-0" />
            <span id="task-form-title" className="truncate font-medium text-foreground">{editTask?.id ? "ویرایش تسک" : "تسک جدید"}</span>
            {selectedProject && <><span aria-hidden="true">›</span><span className="max-w-40 truncate">{selectedProject.name}</span></>}
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="بستن پنجره"><X className="h-4 w-4" /></Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
          <Input autoFocus aria-label="عنوان تسک" placeholder="عنوان تسک" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="h-auto border-0 bg-transparent px-0 py-1 text-xl font-semibold shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-0 sm:text-2xl" />
          <div className="mt-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">توضیحات</span>
              <Button type="button" variant="ghost" size="sm" onClick={generateTaskDescription} disabled={generatingDescription || !String(form.title || "").trim()} className="h-7 px-2 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />{generatingDescription ? "در حال تولید…" : "پیشنهاد با هوش مصنوعی"}
              </Button>
            </div>
            <textarea aria-label="توضیحات تسک" value={form.description || ""} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={4} placeholder="توضیحات را بنویسید…" className="w-full resize-y rounded-lg border-0 bg-transparent p-0 text-sm leading-7 text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-0" />
          </div>

          {selectedTags.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{selectedTags.map((tag) => <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-primary-subtle px-2 py-1 text-xs text-primary-subtle-foreground">{tag}<button type="button" onClick={() => toggleTag(tag)} aria-label={`حذف برچسب ${tag}`} className="rounded-sm hover:text-destructive"><X className="h-3 w-3" /></button></span>)}</div>}
          {(form.attachments || []).length > 0 && <div className="mt-3 space-y-1.5">{form.attachments.map((attachment, index) => <div key={`${attachment.url || attachment.name}-${index}`} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm"><span className="flex min-w-0 items-center gap-2 truncate"><Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />{attachment.name}</span><Button type="button" variant="ghost" size="sm" onClick={() => removeAttachment(index)} className="text-muted-foreground">حذف</Button></div>)}</div>}

          <div className="mt-6 border-t border-border pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <PropertyChip icon={selectedStatus.Icon} label="وضعیت" value={selectedStatus.label}>
                <Command dir="rtl"><CommandInput placeholder="جست‌وجوی وضعیت…" /><CommandList><CommandEmpty>وضعیتی پیدا نشد</CommandEmpty><CommandGroup>{statusOptions.map(({ value, label, Icon }) => <CommandItem key={value} value={label} onSelect={() => setForm((current) => ({ ...current, status: value }))}><Icon className="h-4 w-4 text-muted-foreground" /><span>{label}</span>{form.status === value && <Check className="ms-auto h-4 w-4 text-primary" />}</CommandItem>)}</CommandGroup></CommandList></Command>
              </PropertyChip>
              <PropertyChip icon={Flag} label="اولویت" value={selectedPriority.label}>
                <Command dir="rtl"><CommandInput placeholder="جست‌وجوی اولویت…" /><CommandList><CommandEmpty>اولویتی پیدا نشد</CommandEmpty><CommandGroup>{priorityOptions.map((option) => <CommandItem key={option.value} value={option.label} onSelect={() => setForm((current) => ({ ...current, priority: option.value }))}><Flag className="h-4 w-4 text-muted-foreground" /><span>{option.label}</span>{form.priority === option.value && <Check className="ms-auto h-4 w-4 text-primary" />}</CommandItem>)}</CommandGroup></CommandList></Command>
              </PropertyChip>
              <PropertyChip icon={UserRound} label="مسئول" value={selectedAssignees.length ? (selectedAssignees.length === 1 ? selectedAssignees[0] : `${selectedAssignees[0]} و ${selectedAssignees.length - 1} نفر`) : "بدون مسئول"}>
                <Command dir="rtl"><CommandInput placeholder="جست‌وجوی اعضا…" /><CommandList><CommandEmpty>عضوی پیدا نشد</CommandEmpty><CommandGroup>{normalizedEmployees.map((employee) => <CommandItem key={employee.id || employee.name} value={`${employee.name} ${employee.email || ""}`} onSelect={() => toggleAssignee(employee.name)}><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">{employee.name.slice(0, 1)}</span><span className="min-w-0 flex-1 truncate">{employee.name}</span>{selectedAssignees.includes(employee.name) && <Check className="h-4 w-4 text-primary" />}</CommandItem>)}</CommandGroup></CommandList></Command>
              </PropertyChip>
              <PropertyChip icon={FolderKanban} label="پروژه" value={selectedProject?.name || "بدون پروژه"}>
                <Command dir="rtl"><CommandInput placeholder="جست‌وجوی پروژه…" /><CommandList><CommandEmpty>پروژه‌ای پیدا نشد</CommandEmpty><CommandGroup><CommandItem value="بدون پروژه" onSelect={() => setForm((current) => ({ ...current, project_id: "", project_name: "" }))}><FolderKanban className="h-4 w-4 text-muted-foreground" /><span className="flex-1">بدون پروژه</span>{!form.project_id && <Check className="h-4 w-4 text-primary" />}</CommandItem>{projects.map((project) => <CommandItem key={project.id} value={project.name} onSelect={() => setForm((current) => ({ ...current, project_id: project.id, project_name: project.name }))}><FolderKanban className="h-4 w-4 text-muted-foreground" /><span className="min-w-0 flex-1 truncate">{project.name}</span>{String(form.project_id) === String(project.id) && <Check className="h-4 w-4 text-primary" />}</CommandItem>)}</CommandGroup></CommandList></Command>
              </PropertyChip>
              <PropertyChip icon={Tag} label="برچسب" value={selectedTags.length ? `${selectedTags.length} برچسب` : "برچسب‌ها"}>
                <div className="space-y-2 p-2">
                  <form onSubmit={(event) => { event.preventDefault(); addTag(); }} className="flex items-center gap-2"><Input autoFocus value={tagInput} onChange={(event) => setTagInput(event.target.value)} placeholder="افزودن برچسب…" className="h-9" /><Button type="submit" size="icon" aria-label="افزودن برچسب" disabled={!tagInput.trim()}><Plus className="h-4 w-4" /></Button></form>
                  <p className="px-1 text-xs text-muted-foreground">پیشنهادها</p>
                  <div className="flex flex-wrap gap-1.5">{[...new Set([...suggestedTags, ...selectedTags])].map((tag) => <Button type="button" key={tag} variant={selectedTags.includes(tag) ? "secondary" : "outline"} size="sm" onClick={() => toggleTag(tag)} className="h-7 px-2 text-xs">{selectedTags.includes(tag) && <Check className="h-3 w-3" />}{tag}</Button>)}</div>
                </div>
              </PropertyChip>
              <PropertyChip icon={CalendarDays} label="موعد" value={form.due_date || "موعد سررسید"} contentClassName="w-72">
                <div className="space-y-2 p-2"><span className="block text-xs font-medium">موعد سررسید</span><PersianDatePicker value={form.due_date || ""} onChange={(value) => setForm((current) => ({ ...current, due_date: value }))} placeholder="انتخاب تاریخ" /><Button type="button" variant="ghost" size="sm" onClick={() => setForm((current) => ({ ...current, due_date: "" }))}>پاک کردن تاریخ</Button></div>
              </PropertyChip>
              <Button type="button" variant="ghost" size="sm" onClick={() => setAdvancedOpen((open) => !open)} className="h-8 px-2 text-muted-foreground"><MoreHorizontal className="h-4 w-4" />{advancedOpen ? "بستن تنظیمات" : "بیشتر"}</Button>
            </div>
          </div>

          {advancedOpen && <div className="mt-4 space-y-5 rounded-xl bg-muted/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.recurring_config} onChange={(event) => toggleRecurring(event.target.checked)} className="h-4 w-4 accent-primary" /><Repeat2 className="h-4 w-4 text-muted-foreground" />تسک تکراری</label>
              <label className="flex items-center gap-2 text-sm"><Clock3 className="h-4 w-4 text-muted-foreground" /><span>زمان صرف‌شده</span><Input type="number" step="0.5" min="0" value={form.time_spent || 0} onChange={(event) => setForm({ ...form, time_spent: Number(event.target.value) || 0 })} className="h-8 w-24" /><span className="text-muted-foreground">ساعت</span></label>
            </div>
            {showRecurring && <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5 text-xs text-muted-foreground">تکرار<SelectControl value={form.recurring_config?.frequency || "weekly"} onChange={(event) => handleRecurringChange({ ...form.recurring_config, frequency: event.target.value })} className="w-full"><option value="daily">روزانه</option><option value="weekly">هفتگی</option><option value="monthly">ماهانه</option></SelectControl></label>
              {form.recurring_config?.frequency === "weekly" && <label className="space-y-1.5 text-xs text-muted-foreground">روز هفته<SelectControl value={form.recurring_config?.day_of_week ?? 0} onChange={(event) => handleRecurringChange({ ...form.recurring_config, day_of_week: Number(event.target.value) })} className="w-full"><option value={0}>یکشنبه</option><option value={1}>دوشنبه</option><option value={2}>سه‌شنبه</option><option value={3}>چهارشنبه</option><option value={4}>پنج‌شنبه</option><option value={5}>جمعه</option><option value={6}>شنبه</option></SelectControl></label>}
              {form.recurring_config?.frequency === "monthly" && <label className="space-y-1.5 text-xs text-muted-foreground">روز ماه<SelectControl value={form.recurring_config?.day_of_month || 1} onChange={(event) => handleRecurringChange({ ...form.recurring_config, day_of_month: Number(event.target.value) })} className="w-full">{[...Array(31)].map((_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</SelectControl></label>}
            </div>}
            <div><h3 className="mb-2 flex items-center gap-2 text-sm font-medium"><ListChecks className="h-4 w-4 text-muted-foreground" />زیرتسک‌ها</h3><SubtaskList subtasks={form.subtasks || []} onChange={handleSubtaskChange} /></div>
          </div>}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-4 py-3 sm:px-6">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-muted"><Paperclip className="h-4 w-4" /><span>{uploading ? "در حال آپلود…" : "پیوست"}</span><input type="file" className="sr-only" onChange={handleFileUpload} disabled={uploading} /></label>
            {(form.attachments || []).length > 0 && <span className="text-xs text-muted-foreground">{form.attachments.length} فایل</span>}
          </div>
          <Button type="button" onClick={handleSave} disabled={saving || !String(form.title || "").trim()} className="min-w-32">{saving ? "در حال ثبت…" : editTask?.id ? "ذخیره تغییرات" : "ثبت تسک"}</Button>
        </footer>
      </section>
    </div>
  );
}
