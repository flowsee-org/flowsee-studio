import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { studio } from "@/api/studioClient";
import { Plus, Trash2, FolderKanban, Pencil, Filter, X, Archive, RotateCcw, Table2, Columns3, GanttChart, ArrowDownUp } from "lucide-react";
import ProjectForm from "@/components/ProjectForm";
import ConfirmDialog from "@/components/ConfirmDialog";
import SelectControl from "@/components/ui/SelectControl";
import { loadTeamMembers } from "@/lib/teamMembers";
import { toast } from "@/components/ui/use-toast";
import { formatPersianNumber as faNum, formatPersianDigits } from "@/lib/number-format";

const statusLabels = { active: "فعال", completed: "تکمیل شده", paused: "متوقف شده" };
const statusColors = { active: "bg-green-100 text-green-700", completed: "bg-blue-100 text-blue-700", paused: "bg-amber-100 text-amber-700" };
const priorityLabels = { low: "کم", medium: "متوسط", high: "زیاد" };
const priorityColors = { low: "bg-slate-100 text-slate-600", medium: "bg-amber-100 text-amber-700", high: "bg-red-100 text-red-700" };
const statusOptions = Object.entries(statusLabels);
const priorityOptions = Object.entries(priorityLabels);
const viewOptions = [
  { id: "board", label: "برد", Icon: Columns3 },
  { id: "table", label: "جدول", Icon: Table2 },
  { id: "timeline", label: "تایم‌لاین", Icon: GanttChart },
];

function ProjectCard({ project, tasks, onOpen, onEdit, onDelete, onArchive, onStatus, onPriority }) {
  const projectTasks = tasks.filter((task) => task.project_id === project.id);
  const doneCount = projectTasks.filter((task) => task.status === "done").length;
  const progress = projectTasks.length ? Math.round((doneCount / projectTasks.length) * 100) : 0;
  const stop = (event) => event.stopPropagation();
  return (
    <article onClick={() => onOpen(project)} onKeyDown={(event) => { if (event.key === "Enter") onOpen(project); }} role="link" tabIndex={0}
      className="cursor-pointer rounded-2xl border border-border bg-card p-4 transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/30">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${project.color || "#FE5400"}20` }}>
            <FolderKanban className="h-5 w-5" style={{ color: project.color || "#FE5400" }} />
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-bold hover:text-primary">{project.name}</h3>
            <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs ${statusColors[project.status] || statusColors.active}`}>{statusLabels[project.status] || statusLabels.active}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1" onClick={stop}>
          <button type="button" title="ویرایش پروژه" aria-label="ویرایش پروژه" onClick={() => onEdit(project)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary"><Pencil className="h-4 w-4" /></button>
          <button type="button" title={project.archived ? "خروج از بایگانی" : "بایگانی پروژه"} aria-label={project.archived ? "خروج از بایگانی" : "بایگانی پروژه"} onClick={() => onArchive(project)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-amber-100 hover:text-amber-700">{project.archived ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}</button>
          <button type="button" title="حذف پروژه" aria-label="حذف پروژه" onClick={() => onDelete(project)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-100 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>
      {project.description && <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{project.description}</p>}
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <span className="text-muted-foreground">مدیر: <b className="font-medium text-foreground">{project.manager || "تعیین نشده"}</b></span>
        <span className="text-muted-foreground">اولویت: <b className={`rounded-full px-2 py-0.5 font-medium ${priorityColors[project.priority || "medium"]}`}>{priorityLabels[project.priority || "medium"]}</b></span>
        <span className="text-muted-foreground">شروع: <b className="font-medium text-foreground">{project.start_date || "—"}</b></span>
        <span className="text-muted-foreground">پایان: <b className="font-medium text-foreground">{project.end_date || "—"}</b></span>
      </div>
      <div className="mt-4 space-y-2" onClick={stop}>
        <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">پیشرفت تسک‌ها</span><span className="font-medium">{faNum(progress)}٪ ({faNum(doneCount)}/{faNum(projectTasks.length)})</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-accent"><div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: project.color || "#FE5400" }} /></div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3" onClick={stop}>
        <SelectControl aria-label={`تغییر وضعیت پروژه ${project.name}`} value={project.status || "active"} onChange={(event) => onStatus(project, event.target.value)} className="h-9">
          {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </SelectControl>
        <SelectControl aria-label={`تغییر اولویت پروژه ${project.name}`} value={project.priority || "medium"} onChange={(event) => onPriority(project, event.target.value)} className="h-9">
          {priorityOptions.map(([value, label]) => <option key={value} value={value}>اولویت {label}</option>)}
        </SelectControl>
      </div>
    </article>
  );
}

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editProject, setEditProject] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [managerFilter, setManagerFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [layoutMode, setLayoutMode] = useState("board");
  const [tableSort, setTableSort] = useState({ field: "created_date", direction: "desc" });
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    load();
    loadTeamMembers().then(setMembers).catch(() => setMembers([]));
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [projectData, taskData] = await Promise.all([
        studio.entities.Project.list("-created_date"),
        studio.entities.Task.list(),
      ]);
      setProjects(projectData || []);
      setTasks(taskData || []);
    } catch (error) {
      toast({ title: "بارگذاری پروژه‌ها ناموفق بود", description: error?.message || "اتصال را بررسی کنید.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const managerOptions = useMemo(() => [...new Set([...members.map((member) => member.name), ...projects.map((project) => project.manager)].filter(Boolean))], [members, projects]);
  const visibleProjects = useMemo(() => projects.filter((project) => {
    if (!!project.archived !== showArchived) return false;
    if (statusFilter && project.status !== statusFilter) return false;
    if (managerFilter && project.manager !== managerFilter) return false;
    return true;
  }), [projects, showArchived, statusFilter, managerFilter]);
  const hasFilters = Boolean(statusFilter || managerFilter);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await studio.entities.Project.delete(deleteTarget.id);
      setProjects((current) => current.filter((project) => project.id !== deleteTarget.id));
      toast({ title: `پروژه «${deleteTarget.name}» حذف شد` });
    } catch (error) {
      toast({ title: "حذف پروژه انجام نشد", description: error?.message || "دسترسی حذف یا اتصال را بررسی کنید.", variant: "destructive" });
    } finally {
      setDeleteTarget(null);
    }
  };

  const updateProject = async (project, changes, successTitle) => {
    try {
      await studio.entities.Project.update(project.id, changes);
      setProjects((current) => current.map((item) => item.id === project.id ? { ...item, ...changes } : item));
      toast({ title: successTitle });
    } catch (error) {
      toast({ title: "به‌روزرسانی پروژه انجام نشد", description: error?.message || "دوباره تلاش کنید.", variant: "destructive" });
    }
  };

  const openEdit = (project) => { setEditProject(project); setShowForm(true); };
  const openNew = () => { setEditProject(null); setShowForm(true); };
  const clearFilters = () => { setStatusFilter(""); setManagerFilter(""); };

  const sortedProjects = useMemo(() => [...visibleProjects].sort((a, b) => {
    const left = a[tableSort.field] || "";
    const right = b[tableSort.field] || "";
    const comparison = String(left).localeCompare(String(right), "fa");
    return tableSort.direction === "asc" ? comparison : -comparison;
  }), [visibleProjects, tableSort]);
  const toggleTableSort = (field) => setTableSort((current) => ({ field, direction: current.field === field && current.direction === "asc" ? "desc" : "asc" }));

  if (loading) return <div className="flex justify-center p-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" /></div>;

  const renderProject = (project) => <ProjectCard key={project.id} project={project} tasks={tasks} onOpen={(item) => navigate(`/projects/${item.id}`)} onEdit={openEdit} onDelete={setDeleteTarget}
    onArchive={(item) => updateProject(item, { archived: !item.archived }, item.archived ? "پروژه از بایگانی خارج شد" : "پروژه بایگانی شد")}
    onStatus={(item, status) => updateProject(item, { status }, "وضعیت پروژه تغییر کرد")}
    onPriority={(item, priority) => updateProject(item, { priority }, "اولویت پروژه تغییر کرد")} />;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">پروژه‌ها</h1><p className="mt-1 text-sm text-muted-foreground">مدیریت پروژه‌های کسب‌وکار</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-border bg-card p-1" role="group" aria-label="نمایش پروژه‌ها">
            {viewOptions.map(({ id, label, Icon }) => <button key={id} onClick={() => setLayoutMode(id)} aria-pressed={layoutMode === id} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm ${layoutMode === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}><Icon className="h-4 w-4" />{label}</button>)}
          </div>
          <button onClick={() => setShowFilters((value) => !value)} aria-expanded={showFilters} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${showFilters || hasFilters ? "border-primary/40 bg-primary/5 text-primary" : "border-border text-muted-foreground"}`}><Filter className="h-4 w-4" />فیلترها{hasFilters ? " (فعال)" : ""}</button>
          <button onClick={() => setShowArchived((value) => !value)} aria-pressed={showArchived} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${showArchived ? "border-amber-400 bg-amber-50 text-amber-700" : "border-border text-muted-foreground"}`}>{showArchived ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}{showArchived ? "پروژه‌های بایگانی" : "بایگانی"}</button>
          <button onClick={openNew} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-medium text-primary-foreground hover:opacity-90"><Plus className="h-5 w-5" />پروژه جدید</button>
        </div>
      </div>

      {showFilters && <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 animate-in fade-in slide-in-from-top-1">
        <SelectControl aria-label="فیلتر وضعیت" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">همه وضعیت‌ها</option>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectControl>
        <SelectControl aria-label="فیلتر مدیر پروژه" value={managerFilter} onChange={(event) => setManagerFilter(event.target.value)}><option value="">همه مدیران</option>{managerOptions.map((name) => <option key={name} value={name}>{name}</option>)}</SelectControl>
        {hasFilters && <button onClick={clearFilters} className="mr-auto flex items-center gap-1 text-xs text-primary hover:underline"><X className="h-3.5 w-3.5" />پاک کردن فیلترها</button>}
      </div>}

      {visibleProjects.length === 0 ? <div className="rounded-2xl border border-border bg-card p-12 text-center"><FolderKanban className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" /><p className="text-muted-foreground">{hasFilters ? "پروژه‌ای مطابق فیلترها پیدا نشد" : showArchived ? "پروژه بایگانی‌شده‌ای وجود ندارد" : "هنوز پروژه‌ای ثبت نشده است"}</p></div>
        : layoutMode === "board" ? <div className="flex gap-4 overflow-x-auto pb-3">{statusOptions.map(([status, label]) => {
          const items = visibleProjects.filter((project) => (project.status || "active") === status);
          return <section key={status} className="min-h-64 w-80 shrink-0 rounded-2xl border border-border bg-accent/20 p-3"><header className="mb-3 flex items-center justify-between px-1"><h2 className="font-bold text-sm">{label}</h2><span className={`rounded-full px-2 py-0.5 text-xs ${statusColors[status]}`}>{faNum(items.length)}</span></header><div className="space-y-3">{items.map(renderProject)}</div></section>;
        })}</div>
          : layoutMode === "table" ? <div className="overflow-x-auto rounded-2xl border border-border bg-card"><table className="w-full text-right text-sm"><thead className="bg-accent/40 text-muted-foreground"><tr>
            {[["name", "نام پروژه"], ["status", "وضعیت"], ["manager", "مدیر پروژه"], ["start_date", "تاریخ شروع"], ["end_date", "تاریخ پایان"], ["priority", "اولویت"], ["created_date", "تاریخ ایجاد"]].map(([field, label]) => <th key={field} className="p-3 font-medium"><button onClick={() => toggleTableSort(field)} className="inline-flex items-center gap-1">{label}<ArrowDownUp className="h-3.5 w-3.5" /></button></th>)}<th className="p-3 font-medium">پیشرفت</th><th className="p-3 font-medium">عملیات</th>
          </tr></thead><tbody className="divide-y divide-border">{sortedProjects.map((project) => {
            const related = tasks.filter((task) => task.project_id === project.id); const done = related.filter((task) => task.status === "done").length; const progress = related.length ? Math.round(done / related.length * 100) : 0;
            return <tr key={project.id} className="hover:bg-accent/20"><td className="p-3"><button onClick={() => navigate(`/projects/${project.id}`)} className="text-right font-semibold hover:text-primary">{project.name}</button></td><td className="p-3"><SelectControl aria-label={`وضعیت ${project.name}`} value={project.status || "active"} onChange={(event) => updateProject(project, { status: event.target.value }, "وضعیت پروژه تغییر کرد")} className="h-8">{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectControl></td><td className="p-3">{project.manager || "—"}</td><td className="p-3">{formatPersianDigits(project.start_date || "—")}</td><td className="p-3">{formatPersianDigits(project.end_date || "—")}</td><td className="p-3"><span className={`rounded-full px-2 py-1 text-xs ${priorityColors[project.priority || "medium"]}`}>{priorityLabels[project.priority || "medium"]}</span></td><td className="p-3">{project.created_date ? new Date(project.created_date).toLocaleDateString("fa-IR") : "—"}</td><td className="min-w-36 p-3"><div className="flex items-center gap-2"><div className="h-2 flex-1 overflow-hidden rounded-full bg-accent"><div className="h-full bg-primary" style={{ width: `${progress}%` }} /></div><span>{faNum(progress)}٪</span></div></td><td className="p-3"><div className="flex gap-1"><button onClick={() => openEdit(project)} aria-label="ویرایش پروژه" className="rounded-lg p-1.5 hover:bg-primary/10"><Pencil className="h-4 w-4" /></button><button onClick={() => updateProject(project, { archived: !project.archived }, project.archived ? "پروژه از بایگانی خارج شد" : "پروژه بایگانی شد")} aria-label="بایگانی پروژه" className="rounded-lg p-1.5 hover:bg-amber-100"><Archive className="h-4 w-4" /></button><button onClick={() => setDeleteTarget(project)} aria-label="حذف پروژه" className="rounded-lg p-1.5 text-red-600 hover:bg-red-100"><Trash2 className="h-4 w-4" /></button></div></td></tr>;
          })}</tbody></table></div>
          : <div className="space-y-3">{[...sortedProjects].sort((a, b) => (a.start_date || "9999").localeCompare(b.start_date || "9999")).map((project) => {
            const start = project.start_date || "بدون تاریخ شروع"; const end = project.end_date || "بدون تاریخ پایان";
            const dated = visibleProjects.map((item) => item.start_date && item.end_date ? [item.start_date, item.end_date] : null).filter(Boolean).flat();
            const low = dated.length ? Math.min(...dated.map((date) => Number(date.replaceAll("/", "")))) : 0;
            const high = dated.length ? Math.max(...dated.map((date) => Number(date.replaceAll("/", "")))) : low + 1;
            const pStart = project.start_date ? Number(project.start_date.replaceAll("/", "")) : low;
            const pEnd = project.end_date ? Number(project.end_date.replaceAll("/", "")) : pStart;
            const left = high > low ? Math.max(0, Math.min(100, (pStart - low) / (high - low) * 100)) : 0;
            const width = high > low ? Math.max(4, Math.min(100 - left, (pEnd - pStart) / (high - low) * 100)) : 6;
            const related = tasks.filter((task) => task.project_id === project.id); const done = related.filter((task) => task.status === "done").length; const progress = related.length ? Math.round(done / related.length * 100) : 0;
            return <div key={project.id} onClick={() => navigate(`/projects/${project.id}`)} className="cursor-pointer rounded-2xl border border-border bg-card p-4 hover:shadow-sm"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">{project.name}</span><span className="text-xs text-muted-foreground">{formatPersianDigits(start)} ← {formatPersianDigits(end)}</span></div><div className="relative mt-4 h-3 rounded-full bg-accent"><div className="absolute top-0 h-3 rounded-full" style={{ right: `${left}%`, width: `${width}%`, backgroundColor: project.color || "#FE5400" }} /><div className="absolute top-0 h-3 rounded-full bg-green-600/70" style={{ right: `${left}%`, width: `${width * progress / 100}%` }} /></div><div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>{project.manager || "بدون مدیر"} · {priorityLabels[project.priority || "medium"]}</span><span>{faNum(progress)}٪ تکمیل تسک‌ها</span></div></div>;
          })}</div>}

      <ProjectForm key={editProject?.id ?? "new"} editProject={editProject} isOpen={showForm} onClose={() => setShowForm(false)} onSaved={load} />
      {deleteTarget && <ConfirmDialog title="حذف پروژه" description={`پروژه «${deleteTarget.name}» حذف خواهد شد. تسک‌های مرتبط باقی می‌مانند. ادامه می‌دهید؟`} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} confirmText="بله، حذف شود" />}
    </div>
  );
}
