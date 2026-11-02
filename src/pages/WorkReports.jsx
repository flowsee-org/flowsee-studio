import { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Plus, Trash2, Sparkles, Clock, User, Pencil, Filter, X, ChevronDown } from "lucide-react";
import ReportForm from "@/components/ReportForm";
import PersianDatePicker from "@/components/PersianDatePicker";
import { loadTeamMembers } from "@/lib/teamMembers";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useDeleteUndo } from "@/hooks/useDeleteUndo.jsx";
import { toast } from "@/components/ui/use-toast";

const faNum = (n) => Number(n || 0).toLocaleString("fa-IR");

export default function WorkReports() {
  const { user, isAdmin } = useAuth();
  const userName = user?.full_name || user?.email || "";
  const [reports, setReports] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editReport, setEditReport] = useState(null);
  const [analyzing, setAnalyzing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Filters
  const [memberFilter, setMemberFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    load();
    loadTeamMembers().then((m) => setMembers(m));
  }, []);

  const load = async () => {
    setLoading(true);
    const [r, t, p] = await Promise.all([
      base44.entities.WorkReport.list("-created_date"),
      base44.entities.Task.list(),
      base44.entities.Project.list(),
    ]);
    setReports(r);
    setTasks(t);
    setProjects(p);
    setLoading(false);
  };

  const { deleteWithUndo } = useDeleteUndo("WorkReport", (id) => base44.entities.WorkReport.delete(id), load);

  // Users only see their own reports; admin + superadmin see everyone's.
  const visibleReports = isAdmin ? reports : reports.filter((r) => r.created_by_id === user?.id);

  const memberOptions = useMemo(() => {
    const seen = new Set();
    const fromReports = visibleReports
      .map((r) => r.employee_name || "")
      .filter(Boolean);
    const fromMembers = members.map((m) => m.name).filter(Boolean);
    return [...new Set([...fromMembers, ...fromReports])].filter((n) => {
      const k = n.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [members, visibleReports]);

  const projectOptions = useMemo(() => {
    const seen = new Set();
    const fromProjects = projects.map((p) => p.name).filter(Boolean);
    const fromReports = visibleReports.map((r) => r.project_name || "").filter(Boolean);
    return [...new Set([...fromProjects, ...fromReports])].filter((n) => {
      const k = n.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [projects, visibleReports]);

  const filteredReports = useMemo(() => {
    return visibleReports.filter((r) => {
      if (memberFilter) {
        const name = r.employee_name || "";
        const key = memberFilter.toLowerCase();
        const matchUser = userName.toLowerCase() === key;
        const isSelf = r.created_by_id === user?.id;
        if (matchUser) {
          if (!isSelf) return false;
        } else if (!name.toLowerCase().includes(key)) {
          return false;
        }
      }
      if (projectFilter && r.project_name !== projectFilter) return false;
      if (dateFrom && r.date < dateFrom) return false;
      if (dateTo && r.date > dateTo) return false;
      return true;
    });
  }, [visibleReports, memberFilter, projectFilter, dateFrom, dateTo, userName, user?.id]);

  const hasFilters = Boolean(memberFilter || projectFilter || dateFrom || dateTo);
  const clearFilters = () => {
    setMemberFilter("");
    setProjectFilter("");
    setDateFrom("");
    setDateTo("");
  };

  const totalHours = filteredReports.reduce((s, r) => s + (r.hours || 0), 0);

  const handleDelete = async (id) => {
    const report = reports.find(r => r.id === id);
    if (report) setDeleteTarget(report);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteWithUndo(deleteTarget);
    setDeleteTarget(null);
  };

  const handleEdit = (report) => {
    setEditReport(report);
    setShowForm(true);
  };

  const analyzeReport = async (report) => {
    const taskTitles = report.task_titles || (report.task_title ? [report.task_title] : []);
    const matchingTasks = tasks.filter((task) => taskTitles.includes(task.title));
    const taskBreakdown = matchingTasks.map((task) => {
      const subtasks = (task.subtasks || []).map((subtask) => subtask.title || subtask.name).filter(Boolean).join("، ");
      return `${task.title}؛ وضعیت: ${task.status || "نامشخص"}؛ زیرتسک‌ها: ${subtasks || "ثبت نشده"}`;
    }).join("\n");
    const history = visibleReports
      .filter((item) => item.employee_name === report.employee_name && item.id !== report.id)
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
      .slice(0, 5);
    const historySummary = history.map((item) => `${item.date || "بدون تاریخ"}: ${item.hours || 0} ساعت؛ ${item.description || ""}`).join("\n");
    setAnalyzing(report.id);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `شما تحلیل‌گر عملکرد تیم هستید. گزارش زیر را به فارسی، مستند و منصفانه تحلیل کنید. خروجی را در بخش‌های «خروجی‌های تحویل‌شده»، «پیشرفت تسک‌ها و زیرتسک‌ها»، «روند عملکرد نسبت به گزارش‌های قبلی»، «ریسک‌ها و موانع» و «اقدام بعدی پیشنهادی» ارائه دهید. از حدس‌زدن خروجی تحویل‌شده یا قضاوت درباره فرد بدون شواهد خودداری کنید؛ اطلاعات ناموجود را صریحاً مشخص کنید.\n\nکارمند: ${report.employee_name}\nتاریخ: ${report.date || "نامشخص"}\nپروژه: ${report.project_name || "نامشخص"}\nتسک‌های گزارش‌شده: ${taskTitles.join("، ") || "ذکر نشده"}\nجزئیات تسک و زیرتسک: ${taskBreakdown || "اطلاعات تکمیلی تسک در دسترس نیست"}\nخروجی‌های تحویل‌شده (در صورت ثبت): ${report.deliverables || report.outputs || report.completed_outputs || "در گزارش جداگانه مشخص نشده"}\nساعت کار: ${report.hours || 0}\nشرح گزارش: ${report.description || "ندارد"}\nگزارش‌های اخیر همین کارمند برای مقایسه روند: ${historySummary || "سابقه دیگری موجود نیست"}`,
      });
      await base44.entities.WorkReport.update(report.id, { ai_analysis: res });
      await load();
    } catch (err) {
      console.error(err);
      toast({ title: "تحلیل گزارش ناموفق بود", description: err.message || "دوباره تلاش کنید.", variant: "destructive" });
    } finally {
      setAnalyzing(null);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center p-20">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">{isAdmin ? "گزارش‌های کار" : "گزارش کار من"}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{isAdmin ? "همه گزارش‌های کارکنان" : "آرشیو گزارش کارهای شما"}</p>
        </div>
        <button
          onClick={() => { setEditReport(null); setShowForm(true); }}
          className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:opacity-90 transition-opacity"
        >
          <Plus className="w-5 h-5" /> ثبت گزارش
        </button>
      </div>

      {/* Filters bar */}
      <div className="bg-card border border-border rounded-xl p-3 sm:p-4 space-y-3">
        <button type="button" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen} className="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-1 text-sm font-medium hover:text-primary"><span className="flex items-center gap-2"><Filter className="h-4 w-4" />فیلترهای پیشرفته گزارش‌ها{hasFilters && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">فعال</span>}</span><ChevronDown className={"h-4 w-4 transition-transform " + (filtersOpen ? "rotate-180" : "")} /></button>
        {filtersOpen && <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground font-medium">
            <Filter className="w-4 h-4" /> فیلترها:
          </span>
          {isAdmin && (
            <select
              value={memberFilter}
              onChange={(e) => setMemberFilter(e.target.value)}
              className="border border-input rounded-xl px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[170px]"
            >
              <option value="">همه اعضا</option>
              {memberOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          )}
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="border border-input rounded-xl px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[170px]"
          >
            <option value="">همه پروژه‌ها</option>
            {projectOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <PersianDatePicker label="از تاریخ" value={dateFrom} onChange={setDateFrom} placeholder="تاریخ شروع" />
          <PersianDatePicker label="تا تاریخ" value={dateTo} onChange={setDateTo} placeholder="تاریخ پایان" />
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-primary hover:underline flex items-center gap-1 mr-auto"
            >
              <X className="w-3.5 h-3.5" /> پاک کردن فیلترها
            </button>
          )}
        </div>}
        {filteredReports.length > 0 && (
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground border-t border-border pt-3">
            <span>{faNum(filteredReports.length)} گزارش</span>
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> مجموع {faNum(totalHours)} ساعت</span>
          </div>
        )}
      </div>

      {filteredReports.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-8 sm:p-12 text-center">
          <Clock className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">
            {hasFilters ? "گزارشی مطابق فیلترها پیدا نشد" : "هنوز گزارش کاری ثبت نشده است"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReports.map((r) => {
            const taskTitles = r.task_titles || (r.task_title ? [r.task_title] : []);
            return (
              <div key={r.id} className="bg-card rounded-2xl border border-border p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-orange-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{r.employee_name}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span>{r.date}</span>
                        {r.hours > 0 && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {faNum(r.hours)} ساعت</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => handleEdit(r)} className="p-1.5 text-muted-foreground hover:text-primary rounded-lg hover:bg-primary/5">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(r.id)} className="p-1.5 text-muted-foreground hover:text-red-500 rounded-lg hover:bg-destructive/10">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {taskTitles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {taskTitles.map((title, i) => (
                      <span key={i} className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full">{title}</span>
                    ))}
                  </div>
                )}
                {r.project_name && <span className="inline-block text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full mb-2">{r.project_name}</span>}

                <p className="text-sm text-foreground bg-accent/40 rounded-lg p-3 mb-3">{r.description}</p>

                {r.ai_analysis && (
                  <div className="bg-gradient-to-l from-primary/5 to-primary/5 border border-primary/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <p className="text-sm font-bold text-primary">تحلیل هوش مصنوعی</p>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{r.ai_analysis}</p>
                  </div>
                )}

                {!r.ai_analysis && (
                  <button
                    onClick={() => analyzeReport(r)}
                    disabled={analyzing === r.id}
                    className="text-sm text-primary font-medium flex items-center gap-2 hover:bg-primary/5 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4" />
                    {analyzing === r.id ? "در حال تحلیل..." : "تحلیل با هوش مصنوعی"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <ReportForm
          tasks={tasks}
          userName={userName}
          editReport={editReport}
          onClose={() => { setShowForm(false); setEditReport(null); }}
          onSaved={load}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="حذف گزارش کار"
          description={`گزارش کار "${deleteTarget.employee_name}" بلافاصله حذف می‌شود. آیا مطمئن هستید؟`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
          confirmText="بله، حذف شود"
        />
      )}
    </div>
  );
}
