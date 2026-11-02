import { useEffect, useMemo, useState } from "react";
import { studio } from "@/api/studioClient";
import { useAuth } from "@/lib/AuthContext";
import { Plus, Flag, Play, CheckCircle2, Calendar, ListTodo, Users, Pencil, X, AlertCircle } from "lucide-react";
import PersianDatePicker, { getPersianDate } from "@/components/PersianDatePicker";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useDeleteUndo } from "@/hooks/useDeleteUndo.jsx";
import { toast } from "@/components/ui/use-toast";

const statusLabels = { planning: "برنامه‌ریزی", active: "فعال", completed: "تکمیل شده" };
const statusColors = { planning: "bg-amber-100 text-amber-700", active: "bg-blue-100 text-blue-700", completed: "bg-green-100 text-green-700" };

const taskStatusLabels = { todo: "در انتظار", in_progress: "در حال انجام", done: "انجام شده" };
const taskStatusColors = { todo: "bg-slate-100 text-slate-600", in_progress: "bg-blue-100 text-blue-600", done: "bg-green-100 text-green-600" };

const columns = [
  { id: "planning", title: "برنامه‌ریزی", icon: Flag, iconBg: "bg-amber-100 text-amber-700" },
  { id: "active", title: "در حال اجرا", icon: Play, iconBg: "bg-blue-100 text-blue-700" },
  { id: "completed", title: "تکمیل شده", icon: CheckCircle2, iconBg: "bg-green-100 text-green-700" },
];

const faNum = (n) => Number(n || 0).toLocaleString("fa-IR");

const getAssigneeNames = (t) => {
  const list = t.assignees || (t.assignee ? [t.assignee] : []);
  return list.filter(Boolean).join("، ");
};

function SprintModal({ sprint, onClose, onSaved }) {
  const [name, setName] = useState(sprint?.name || "");
  const [description, setDescription] = useState(sprint?.description || "");
  const [startDate, setStartDate] = useState(sprint?.start_date || (sprint ? "" : getPersianDate(0)));
  const [endDate, setEndDate] = useState(sprint?.end_date || "");
  const [goal, setGoal] = useState(sprint?.goal || "");
  const [status, setStatus] = useState(sprint?.status || "planning");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const data = {
        name: name.trim(),
        description: description.trim(),
        start_date: startDate,
        end_date: endDate,
        goal: goal.trim(),
        status,
      };
      if (sprint?.id) {
        await studio.entities.Sprint.update(sprint.id, data);
      } else {
        await studio.entities.Sprint.create(data);
      }
      toast({ title: sprint?.id ? "اسپرینت ویرایش شد" : "اسپرینت جدید ثبت شد" });
      setSaving(false);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || "خطا در ذخیره اسپرینت");
      toast({ title: "خطا", description: err.message || "ذخیره اسپرینت ناموفق بود", variant: "destructive" });
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-xl max-h-[90vh] overflow-y-auto scrollbar-thin" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg">{sprint?.id ? "ویرایش اسپرینت" : "اسپرینت جدید"}</h2>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">
              نام اسپرینت <span className="text-primary">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثلاً اسپرینت شهریور"
              className="w-full border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">هدف اسپرینت</label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={2}
              placeholder="هدف این اسپرینت چیست؟"
              className="w-full border border-input rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">توضیحات</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="توضیح کوتاه درباره این اسپرینت..."
              className="w-full border border-input rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <PersianDatePicker label="تاریخ شروع" value={startDate} onChange={setStartDate} placeholder="انتخاب تاریخ" />
            <PersianDatePicker label="تاریخ پایان" value={endDate} onChange={setEndDate} placeholder="انتخاب تاریخ" />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">وضعیت</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="planning">برنامه‌ریزی</option>
              <option value="active">فعال</option>
              <option value="completed">تکمیل شده</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <div className="sticky bottom-0 -mx-5 sm:-mx-6 mt-5 flex items-center justify-between gap-3 border-t border-border bg-card px-5 py-4 sm:px-6">
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground px-4 py-2.5">
            بستن
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="bg-primary text-primary-foreground px-8 py-2.5 rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex-1 max-w-[60%]"
          >
            {saving ? "در حال ذخیره..." : sprint?.id ? "ذخیره تغییرات" : "ثبت اسپرینت"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Sprints() {
  const { isAdmin } = useAuth();
  const [sprints, setSprints] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editSprint, setEditSprint] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async () => {
    try {
      const [s, t] = await Promise.all([
        studio.entities.Sprint.list("-created_date").catch(() => []),
        studio.entities.Task.list().catch(() => []),
      ]);
      setSprints(Array.isArray(s) ? s : []);
      setTasks(Array.isArray(t) ? t : []);
    } catch (error) {
      toast({ title: "بارگذاری اسپرینت‌ها ناموفق بود", description: error.message || "اتصال را بررسی کنید.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const { deleteWithUndo } = useDeleteUndo("Sprint", (id) => studio.entities.Sprint.delete(id), load);

  useEffect(() => {
    load();
    const unsubSprint = studio.entities.Sprint.subscribe(() => load());
    const unsubTask = studio.entities.Task.subscribe(() => load());
    return () => {
      if (unsubSprint) unsubSprint();
      if (unsubTask) unsubTask();
    };
  }, []);

  const tasksBySprintId = useMemo(() => {
    const map = {};
    tasks.forEach((t) => {
      const key = t.sprint_id || "";
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    return map;
  }, [tasks]);

  const changeStatus = async (id, status) => {
    try {
      await studio.entities.Sprint.update(id, { status });
      toast({ title: "وضعیت اسپرینت به‌روزرسانی شد" });
      await load();
    } catch (error) {
      toast({ title: "تغییر وضعیت اسپرینت انجام نشد", description: error.message || "دوباره تلاش کنید.", variant: "destructive" });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteWithUndo(deleteTarget);
    setDeleteTarget(null);
  };

  if (loading)
    return (
      <div className="flex justify-center p-20">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );

  const stats = [
    { label: "اسپرینت‌های فعال", value: sprints.filter((s) => s.status === "active").length, icon: Play, color: "bg-blue-100 text-blue-700" },
    { label: "اسپرینت‌های تکمیل شده", value: sprints.filter((s) => s.status === "completed").length, icon: CheckCircle2, color: "bg-green-100 text-green-700" },
    { label: "اسپرینت‌های برنامه‌ریزی", value: sprints.filter((s) => s.status === "planning").length, icon: Flag, color: "bg-amber-100 text-amber-700" },
  ];

  const getDateRange = (s) => {
    if (!s.start_date && !s.end_date) return "";
    if (s.start_date && s.end_date) return `${s.start_date} تا ${s.end_date}`;
    return s.start_date || s.end_date;
  };

  const getProgress = (s) => {
    const sprintTasks = tasksBySprintId[s.id] || [];
    const total = sprintTasks.length;
    if (!total) return 0;
    return Math.round((sprintTasks.filter((t) => t.status === "done").length / total) * 100);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">اسپرینت‌ها</h1>
          <p className="text-muted-foreground mt-1 text-sm">برنامه‌ریزی و مدیریت اسپرینت‌ها</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setEditSprint(null); setShowModal(true); }}
            className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <Plus className="w-5 h-5" /> اسپرینت جدید
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-card rounded-2xl p-4 sm:p-5 border border-border">
            <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl ${s.color} flex items-center justify-center mb-3`}>
              <s.icon className="w-5 h-5" />
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">{s.label}</p>
            <p className="text-base sm:text-2xl font-bold mt-1">{faNum(s.value)}</p>
          </div>
        ))}
      </div>

      {sprints.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-8 sm:p-12 text-center">
          <Flag className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">هنوز اسپرینتی تعریف نشده است</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          {columns.map((col) => {
            const colSprints = sprints.filter((s) => s.status === col.id);
            return (
              <div key={col.id} className="bg-accent/40 rounded-2xl border border-border p-3 sm:p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg ${col.iconBg} flex items-center justify-center`}>
                      <col.icon className="w-4 h-4" />
                    </div>
                    <h2 className="font-bold text-sm">{col.title}</h2>
                  </div>
                  <span className="text-xs bg-card text-muted-foreground border border-border px-2 py-0.5 rounded-full">{faNum(colSprints.length)}</span>
                </div>

                {colSprints.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-6">اسپرینتی در این مرحله نیست</p>
                ) : (
                  <div className="space-y-3">
                    {colSprints.map((s) => {
                      const sprintTasks = tasksBySprintId[s.id] || [];
                      const progress = getProgress(s);
                      const dateRange = getDateRange(s);
                      const doneCount = sprintTasks.filter((t) => t.status === "done").length;

                      return (
                        <div key={s.id} className="bg-card rounded-2xl border border-border p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h3 className="font-bold leading-snug">{s.name}</h3>
                            <span className={`text-xs px-3 py-1 rounded-full shrink-0 ${statusColors[s.status] || statusColors.planning}`}>
                              {statusLabels[s.status] || statusLabels.planning}
                            </span>
                          </div>

                          {dateRange && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                              <Calendar className="w-3.5 h-3.5 shrink-0" /> {dateRange}
                            </div>
                          )}

                          {s.goal && (
                            <p className="text-sm bg-accent/40 rounded-lg p-2 mb-2">
                              <span className="text-xs text-muted-foreground">هدف: </span>
                              {s.goal}
                            </p>
                          )}

                          {s.description && (
                            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{s.description}</p>
                          )}

                          <div className="mb-3">
                            <div className="flex items-center justify-between text-xs mb-1.5">
                              <span className="text-muted-foreground flex items-center gap-1">
                                <ListTodo className="w-3.5 h-3.5" /> پیشرفت
                              </span>
                              <span className="font-medium">{faNum(progress)}٪</span>
                            </div>
                            <div className="h-2 rounded-full bg-accent overflow-hidden">
                              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1">
                              {faNum(sprintTasks.length)} تسک · {faNum(doneCount)} انجام شده
                            </p>
                          </div>

                          {sprintTasks.length > 0 ? (
                            <div className="space-y-1.5 mb-3">
                              {sprintTasks.slice(0, 5).map((t) => {
                                const assignees = getAssigneeNames(t);
                                return (
                                  <div key={t.id} className="flex items-center justify-between gap-2 bg-accent/50 rounded-lg px-2.5 py-1.5">
                                    <span className="text-sm truncate">{t.title}</span>
                                    <div className="flex items-center gap-1.5 shrink-0 min-w-0">
                                      <span className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${taskStatusColors[t.status] || taskStatusColors.todo}`}>
                                        {taskStatusLabels[t.status] || taskStatusLabels.todo}
                                      </span>
                                      {assignees && (
                                        <span className="hidden lg:flex items-center gap-1 text-[10px] text-muted-foreground whitespace-nowrap">
                                          <Users className="w-3 h-3 shrink-0" /> {assignees}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                              {sprintTasks.length > 5 && (
                                <p className="text-[11px] text-muted-foreground text-center pt-0.5">+{faNum(sprintTasks.length - 5)} تسک دیگر</p>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground text-center py-2 mb-3 bg-accent/40 rounded-lg">تسکی در این اسپرینت ثبت نشده</p>
                          )}

                          {isAdmin && (
                            <div className="flex items-center gap-2 pt-3 border-t border-border flex-wrap">
                              {s.status === "planning" && (
                                <button
                                  onClick={() => changeStatus(s.id, "active")}
                                  className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-medium hover:bg-blue-100 flex items-center gap-1"
                                >
                                  <Play className="w-3.5 h-3.5" /> شروع
                                </button>
                              )}
                              {s.status === "active" && (
                                <button
                                  onClick={() => changeStatus(s.id, "completed")}
                                  className="text-xs bg-green-50 text-green-600 px-3 py-1.5 rounded-lg font-medium hover:bg-green-100 flex items-center gap-1"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" /> تکمیل
                                </button>
                              )}
                              <button
                                onClick={() => { setEditSprint(s); setShowModal(true); }}
                                className="text-xs text-muted-foreground hover:text-primary px-3 py-1.5 rounded-lg flex items-center gap-1"
                              >
                                <Pencil className="w-3.5 h-3.5" /> ویرایش
                              </button>
                              <button
                                onClick={() => setDeleteTarget(s)}
                                className="text-xs text-muted-foreground hover:text-red-500 px-3 py-1.5 rounded-lg flex items-center gap-1 mr-auto"
                              >
                                <X className="w-3.5 h-3.5" /> حذف
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <SprintModal sprint={editSprint} onClose={() => { setShowModal(false); setEditSprint(null); }} onSaved={load} />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="حذف اسپرینت"
          description={`اسپرینت «${deleteTarget.name}» بلافاصله حذف می‌شود. آیا مطمئن هستید؟`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
          confirmText="بله، حذف شود"
        />
      )}
    </div>
  );
}
