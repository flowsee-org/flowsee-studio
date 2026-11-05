import { useEffect, useRef, useState } from "react";
import { studio } from "@/api/studioClient";
import { CalendarDays, Check, CheckCircle2, Circle, CircleDot, Clock3, Flag, FolderKanban, ListChecks, MoreHorizontal, Plus, Repeat2, Tag, UserRound, X } from "lucide-react";
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
const DRAFT_KEY = "studio_task_form_draft";
const CUSTOM_TAGS_KEY = "studio_custom_tags";

function getStoredTags() {
  try {
    const raw = localStorage.getItem(CUSTOM_TAGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustomTag(tag) {
  try {
    const existing = getStoredTags();
    if (!existing.includes(tag)) {
      localStorage.setItem(CUSTOM_TAGS_KEY, JSON.stringify([...existing, tag]));
    }
  } catch {}
}

function PropertyChip({ icon: Icon, label, value, children, contentClassName = "", open, onOpenChange }) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
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

export default function TaskForm({ projects, editTask, onClose, onSaved }) {
  const [employees, setEmployees] = useState([]);
  const [createdProjects, setCreatedProjects] = useState([]);
  const [allSuggestedTags, setAllSuggestedTags] = useState(() => [
    ...new Set([...suggestedTags, ...getStoredTags()]),
  ]);
  const [form, setForm] = useState(() => {
    if (editTask) {
      return { ...editTask, tags: Array.isArray(editTask.tags) ? editTask.tags : [] };
    }
    try {
      const savedDraft = localStorage.getItem(DRAFT_KEY);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed && typeof parsed === "object") {
          return {
            title: "",
            project_id: "",
            project_name: "",
            status: "todo",
            priority: "medium",
            assignees: [],
            assignee: "",
            description: "",
            due_date: "",
            subtasks: [],
            time_spent: 0,
            recurring_config: null,
            tags: [],
            ...parsed,
          };
        }
      }
    } catch {}
    return {
      title: "",
      project_id: "",
      project_name: "",
      status: "todo",
      priority: "medium",
      assignees: [],
      assignee: "",
      description: "",
      due_date: "",
      subtasks: [],
      time_spent: 0,
      recurring_config: null,
      tags: [],
    };
  });

  useEffect(() => {
    if (!editTask) {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
      } catch {}
    }
  }, [form, editTask]);
  const [saving, setSaving] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [projectInput, setProjectInput] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [openProperty, setOpenProperty] = useState(null);
  const [membersLoading, setMembersLoading] = useState(true);
  const backdropPointerDown = useRef(false);
  const showRecurring = !!form.recurring_config;

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (openProperty) {
        setOpenProperty(null);
        return;
      }
      onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [openProperty, onClose]);

  useEffect(() => {
    let active = true;
    loadTeamMembers()
      .then((members) => { if (active) setEmployees(members); })
      .catch((error) => { console.error("Could not load task assignees", error); if (active) setEmployees([]); })
      .finally(() => { if (active) setMembersLoading(false); });
    return () => { active = false; };
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

  const createProjectFromPicker = async () => {
    const name = projectInput.trim();
    if (!name || creatingProject) return;
    setCreatingProject(true);
    try {
      const project = await studio.entities.Project.create({
        name,
        description: "",
        color: "#FE5400",
        status: "active",
        priority: "medium",
        archived: false,
        manager: "",
        start_date: "",
        end_date: "",
        members: [],
      });
      const created = { ...project, name: project?.name || name };
      if (!created.id) throw new Error("شناسه پروژه از سرویس دریافت نشد.");
      setCreatedProjects((current) => [...current, created]);
      setForm((current) => ({ ...current, project_id: created.id, project_name: created.name }));
      setProjectInput("");
      setPropertyOpen("project", false);
      toast({ title: "پروژه ساخته شد" });
    } catch (error) {
      toast({ title: "ساخت پروژه انجام نشد", description: error?.message || "دوباره تلاش کنید.", variant: "destructive" });
    } finally {
      setCreatingProject(false);
    }
  };

  const handleSave = async () => {
    if (!form.title) return;
    setSaving(true);
    try {
      const proj = [...projects, ...createdProjects].find((p) => String(p.id) === String(form.project_id));
      const taskFields = { ...form };
      const data = { ...taskFields, project_name: proj?.name || form.project_name || "" };
      if (editTask?.id) {
        await studio.entities.Task.update(editTask.id, data);
      } else {
        await studio.entities.Task.create(data);
      }
      toast({ title: editTask?.id ? "تسک بروزرسانی شد" : "تسک ثبت شد" });
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
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
  const availableProjects = [...projects, ...createdProjects];
  const selectedProject = availableProjects.find((project) => String(project.id) === String(form.project_id));
  const selectedStatus = statusOptions.find((option) => option.value === form.status) || statusOptions[0];
  const selectedPriority = priorityOptions.find((option) => option.value === form.priority) || priorityOptions[1];
  const normalizedEmployees = [...new Map(
    [...employees]
      .filter((employee) => employee.name)
      .filter((employee) => !/امین\s+غلامی\s*\(ادمین\)/i.test(employee.name) && !/\(ادمین\)/i.test(employee.name))
      .map((employee) => [employee.name.normalize("NFKC").replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/\s+/g, " ").trim().toLocaleLowerCase("fa-IR"), employee])
  ).values()];
  const setPropertyOpen = (key, open) => setOpenProperty((current) => open ? key : current === key ? null : current);
  const selectedTags = Array.isArray(form.tags) ? form.tags : [];

  const setTags = (tags) => setForm((current) => ({ ...current, tags: [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))] }));
  const toggleTag = (tag) => setTags(selectedTags.includes(tag) ? selectedTags.filter((item) => item !== tag) : [...selectedTags, tag]);
  const addTag = () => {
    const value = tagInput.trim();
    if (!value) return;
    saveCustomTag(value);
    setAllSuggestedTags((prev) => [...new Set([...prev, value])]);
    setTags([...selectedTags, value]);
    setTagInput("");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3"
      onPointerDown={(event) => { backdropPointerDown.current = event.target === event.currentTarget; }}
      onPointerUp={(event) => {
        const shouldClose = backdropPointerDown.current && event.target === event.currentTarget;
        backdropPointerDown.current = false;
        if (shouldClose) onClose();
      }}
      onPointerCancel={() => { backdropPointerDown.current = false; }}
    >
      <section dir="rtl" role="dialog" aria-modal="true" aria-labelledby="task-form-title" className="flex h-[min(calc(100dvh-1.5rem),52rem)] max-h-[min(calc(100dvh-1.5rem),52rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-overlay">
        <header className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
            <FolderKanban className="h-4 w-4 shrink-0" />
            <span id="task-form-title" className="truncate font-medium text-foreground">{editTask?.id ? "ویرایش تسک" : "تسک جدید"}</span>
            {selectedProject && <><span aria-hidden="true">›</span><span className="max-w-40 truncate">{selectedProject.name}</span></>}
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="بستن پنجره"><X className="h-4 w-4" /></Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
          <Input autoFocus dir="rtl" aria-label="عنوان تسک" placeholder="عنوان تسک" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="h-12 rounded-xl border border-border bg-background px-4 py-3 text-right text-xl font-semibold shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-primary/30 sm:text-2xl" />
          <div className="mt-5">
            <div className="mb-2"><span className="text-xs text-muted-foreground">توضیحات</span></div>
            <textarea aria-label="توضیحات تسک" value={form.description || ""} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={8} placeholder="توضیحات را بنویسید…" className="min-h-52 w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-sm leading-7 text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          {selectedTags.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{selectedTags.map((tag) => <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-primary-subtle px-2 py-1 text-xs text-primary-subtle-foreground">{tag}<button type="button" onClick={() => toggleTag(tag)} aria-label={`حذف برچسب ${tag}`} className="rounded-sm hover:text-destructive"><X className="h-3 w-3" /></button></span>)}</div>}
          <div className="mt-6 border-t border-border pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <PropertyChip open={openProperty === "status"} onOpenChange={(open) => setPropertyOpen("status", open)} icon={selectedStatus.Icon} label="وضعیت" value={selectedStatus.label}>
                <Command dir="rtl"><CommandInput placeholder="جست‌وجوی وضعیت…" /><CommandList><CommandEmpty>وضعیتی پیدا نشد</CommandEmpty><CommandGroup>{statusOptions.map(({ value, label, Icon }) => <CommandItem key={value} value={label} onSelect={() => setForm((current) => ({ ...current, status: value }))}><Icon className="h-4 w-4 text-muted-foreground" /><span>{label}</span>{form.status === value && <Check className="ms-auto h-4 w-4 text-primary" />}</CommandItem>)}</CommandGroup></CommandList></Command>
              </PropertyChip>
              <PropertyChip open={openProperty === "priority"} onOpenChange={(open) => setPropertyOpen("priority", open)} icon={Flag} label="اولویت" value={selectedPriority.label}>
                <Command dir="rtl"><CommandInput placeholder="جست‌وجوی اولویت…" /><CommandList><CommandEmpty>اولویتی پیدا نشد</CommandEmpty><CommandGroup>{priorityOptions.map((option) => <CommandItem key={option.value} value={option.label} onSelect={() => setForm((current) => ({ ...current, priority: option.value }))}><Flag className="h-4 w-4 text-muted-foreground" /><span>{option.label}</span>{form.priority === option.value && <Check className="ms-auto h-4 w-4 text-primary" />}</CommandItem>)}</CommandGroup></CommandList></Command>
              </PropertyChip>
              <PropertyChip open={openProperty === "assignee"} onOpenChange={(open) => setPropertyOpen("assignee", open)} icon={UserRound} label="مسئول" value={selectedAssignees.length ? (selectedAssignees.length === 1 ? selectedAssignees[0] : `${selectedAssignees[0]} و ${selectedAssignees.length - 1} نفر`) : "بدون مسئول"}>
                <Command dir="rtl" filter={(value, search) => value.toLocaleLowerCase("fa-IR").includes(search.toLocaleLowerCase("fa-IR")) ? 1 : 0}><CommandInput placeholder="جست‌وجوی اعضا…" /><CommandList className="max-h-none overflow-visible">{membersLoading ? <div className="py-6 text-center text-sm text-muted-foreground">در حال بارگذاری اعضا…</div> : normalizedEmployees.length === 0 ? <div className="py-6 text-center text-sm text-muted-foreground">عضوی برای انتخاب در دسترس نیست</div> : <><CommandEmpty>عضوی با این عبارت پیدا نشد</CommandEmpty><CommandGroup>{normalizedEmployees.map((employee) => <CommandItem key={employee.id || employee.name} value={`${employee.name} ${employee.email || ""}`} onSelect={() => toggleAssignee(employee.name)}><span className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-medium">{employee.name.slice(0, 1)}{employee.profile_image && <img src={employee.profile_image} alt="" className="absolute inset-0 h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} />}</span><span className="min-w-0 flex-1 truncate">{employee.name}</span>{selectedAssignees.includes(employee.name) && <Check className="h-4 w-4 text-primary" />}</CommandItem>)}</CommandGroup></>}</CommandList></Command>
              </PropertyChip>
              <PropertyChip open={openProperty === "project"} onOpenChange={(open) => setPropertyOpen("project", open)} icon={FolderKanban} label="پروژه" value={selectedProject?.name || "بدون پروژه"}>
                <Command dir="rtl"><CommandInput placeholder="جست‌وجوی پروژه…" /><CommandList><CommandEmpty>پروژه‌ای پیدا نشد</CommandEmpty><CommandGroup><CommandItem value="بدون پروژه" onSelect={() => setForm((current) => ({ ...current, project_id: "", project_name: "" }))}><FolderKanban className="h-4 w-4 text-muted-foreground" /><span className="flex-1">بدون پروژه</span>{!form.project_id && <Check className="h-4 w-4 text-primary" />}</CommandItem>{availableProjects.map((project) => <CommandItem key={project.id} value={project.name} onSelect={() => { setForm((current) => ({ ...current, project_id: project.id, project_name: project.name })); setPropertyOpen("project", false); }}><FolderKanban className="h-4 w-4 text-muted-foreground" /><span className="min-w-0 flex-1 truncate">{project.name}</span>{String(form.project_id) === String(project.id) && <Check className="h-4 w-4 text-primary" />}</CommandItem>)}</CommandGroup><div className="border-t border-border p-2"><form onSubmit={(event) => { event.preventDefault(); createProjectFromPicker(); }} className="flex gap-2"><Input value={projectInput} onChange={(event) => setProjectInput(event.target.value)} placeholder="نام پروژه جدید" className="h-9 min-w-0" /><Button type="submit" size="sm" disabled={!projectInput.trim() || creatingProject}>{creatingProject ? "در حال ساخت…" : "ساخت پروژه"}</Button></form></div></CommandList></Command>
              </PropertyChip>
              <PropertyChip open={openProperty === "tags"} onOpenChange={(open) => setPropertyOpen("tags", open)} icon={Tag} label="برچسب" value={selectedTags.length ? `${selectedTags.length} برچسب` : "برچسب‌ها"}>
                <div className="space-y-2 p-2">
                  <form onSubmit={(event) => { event.preventDefault(); addTag(); }} className="flex items-center gap-2"><Input autoFocus value={tagInput} onChange={(event) => setTagInput(event.target.value)} placeholder="افزودن برچسب…" className="h-9" /><Button type="submit" size="icon" aria-label="افزودن برچسب" disabled={!tagInput.trim()}><Plus className="h-4 w-4" /></Button></form>
                  <p className="px-1 text-xs text-muted-foreground">پیشنهادها</p>
                  <div className="flex flex-wrap gap-1.5">{[...new Set([...allSuggestedTags, ...selectedTags])].map((tag) => <Button type="button" key={tag} variant={selectedTags.includes(tag) ? "secondary" : "outline"} size="sm" onClick={() => toggleTag(tag)} className="h-7 px-2 text-xs">{selectedTags.includes(tag) && <Check className="h-3 w-3" />}{tag}</Button>)}</div>
                </div>
              </PropertyChip>
              <PropertyChip open={openProperty === "dueDate"} onOpenChange={(open) => setPropertyOpen("dueDate", open)} icon={CalendarDays} label="موعد" value={form.due_date || "موعد سررسید"} contentClassName="w-80 overflow-visible p-3">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <span className="text-xs font-semibold text-foreground">انتخاب تاریخ موعد سررسید</span>
                    {form.due_date && (
                      <button type="button" onClick={() => { setForm((current) => ({ ...current, due_date: "" })); setPropertyOpen("dueDate", false); }} className="text-xs text-destructive hover:underline">
                        پاک کردن
                      </button>
                    )}
                  </div>
                  <PersianDatePicker
                    value={form.due_date || ""}
                    onChange={(value) => {
                      if (value) {
                        setForm((current) => ({ ...current, due_date: value }));
                        setPropertyOpen("dueDate", false);
                      }
                    }}
                    placeholder="انتخاب تاریخ از تقویم"
                  />
                </div>
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
          <span />
          <Button type="button" onClick={handleSave} disabled={saving || !String(form.title || "").trim()} className="min-w-32">{saving ? "در حال ثبت…" : editTask?.id ? "ذخیره تغییرات" : "ثبت تسک"}</Button>
        </footer>
      </section>
    </div>
  );
}
