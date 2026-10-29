import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { getPersianDate } from "@/components/PersianDatePicker";
import { CheckCircle, Clock, Calendar, ArrowLeft, ArrowDownUp } from "lucide-react";
import { Link } from "react-router-dom";
import { formatPersianNumber as faNum } from "@/lib/number-format";

const priorityLabels = { low: "کم", medium: "متوسط", high: "زیاد" };
const priorityColors = { low: "bg-slate-100 text-slate-600", medium: "bg-amber-100 text-amber-700", high: "bg-red-100 text-red-700" };
const statusLabels = { todo: "در انتظار", in_progress: "در حال انجام", done: "انجام شده" };
const sortOptions = [
  { id: "priority", label: "اولویت" },
  { id: "status", label: "وضعیت" },
  { id: "project", label: "پروژه" },
];

export default function TodayTasks() {
  const { user, isAdmin } = useAuth();
  const userName = user?.full_name || user?.email || "";
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("priority");
  const today = getPersianDate(0);
  const tomorrow = getPersianDate(1);

  useEffect(() => {
    load();
    const unsub = base44.entities.Task.subscribe(() => load());
    return unsub;
  }, []);

  const load = async () => {
    const data = await base44.entities.Task.list("-created_date");
    setTasks(data);
    setLoading(false);
  };

  const visibleTasks = (isAdmin ? tasks : tasks.filter((t) => {
    const assignees = t.assignees || (t.assignee ? [t.assignee] : []);
    return assignees.includes(userName) || t.created_by_id === user?.id;
  })).filter((t) => t.due_date === today && t.status !== "done");

  const sorted = [...visibleTasks].sort((a, b) => {
    if (sortBy === "priority") {
      const order = { high: 3, medium: 2, low: 1 };
      return (order[b.priority] || 0) - (order[a.priority] || 0);
    }
    if (sortBy === "status") return (a.status || "").localeCompare(b.status || "");
    if (sortBy === "project") return (a.project_name || "").localeCompare(b.project_name || "");
    return 0;
  });

  const markDone = async (id) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: "done" } : t)));
    await base44.entities.Task.update(id, { status: "done" });
  };

  const defer = async (id) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, due_date: tomorrow } : t)));
    await base44.entities.Task.update(id, { due_date: tomorrow });
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-sm sm:text-base flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          کارهای امروز
          {sorted.length > 0 && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{faNum(sorted.length)}</span>}
        </h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <ArrowDownUp className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border border-input rounded-lg pr-8 pl-2 py-1.5 text-xs bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none"
            >
              {sortOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
          <Link to="/tasks" className="text-xs text-primary hover:underline flex items-center gap-1">
            همه <ArrowLeft className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
      {loading ? (
        <div className="flex justify-center py-6">
          <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircle className="w-10 h-10 text-green-500/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">کاری برای امروز نیست! 🎉</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((t) => (
            <div key={t.id} className="flex items-center gap-3 bg-accent/30 rounded-xl p-2.5 hover:bg-accent/50 transition-colors">
              <button
                onClick={() => markDone(t.id)}
                className="w-6 h-6 rounded-full border-2 border-primary/30 hover:border-primary hover:bg-primary/10 flex items-center justify-center shrink-0 transition-colors"
                title="انجام شد"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{t.title}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {t.project_name && <span className="text-xs text-primary truncate max-w-[80px]">{t.project_name}</span>}
                  {t.priority && <span className={`text-xs px-1.5 py-0.5 rounded-full ${priorityColors[t.priority]}`}>{priorityLabels[t.priority]}</span>}
                  <span className="text-xs text-muted-foreground">{statusLabels[t.status] || t.status}</span>
                </div>
              </div>
              <button
                onClick={() => defer(t.id)}
                className="text-xs text-muted-foreground hover:text-primary px-2 py-1 rounded-lg hover:bg-primary/10 flex items-center gap-1 shrink-0 whitespace-nowrap"
                title="تعویق به فردا"
              >
                <Clock className="w-3.5 h-3.5" /> فردا
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
