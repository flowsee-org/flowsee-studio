import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { studio } from "@/api/studioClient";
import { useAuth } from "@/lib/AuthContext";
import { ListTodo, CheckCircle, Clock, Calendar, ArrowLeft, Settings2, UserRound } from "lucide-react";
import TodayTasks from "@/components/TodayTasks";
import AnnouncementWidget from "@/components/AnnouncementWidget";
import MeetingReminders from "@/components/MeetingReminders";
import { roleLabel } from "@/lib/roles";

const faNum = (n) => Number(n || 0).toLocaleString("fa-IR");
const dashboardWidgets = [
  { id: "stats", label: "خلاصه آمار" },
  { id: "quickLinks", label: "دسترسی‌های سریع" },
  { id: "today", label: "کارهای امروز و اعلان‌ها" },
  { id: "reminders", label: "یادآوری جلسه‌ها" },
  { id: "recentTasks", label: "تسک‌های اخیر" },
];
const defaultWidgets = Object.fromEntries(dashboardWidgets.map(({ id }) => [id, true]));

export default function StaffDashboard() {
  const { user } = useAuth();
  const userName = user?.full_name || user?.email || "";
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [visibleWidgets, setVisibleWidgets] = useState(() => {
    try {
      const saved = localStorage.getItem(`staff-dashboard:${user?.id || "guest"}`);
      return saved ? { ...defaultWidgets, ...JSON.parse(saved) } : defaultWidgets;
    } catch { return defaultWidgets; }
  });
  const [data, setData] = useState({ tasks: [], meetings: [], workReports: [] });
  const [loading, setLoading] = useState(true);
  const [clockNow, setClockNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    (async () => {
      const [tasks, meetings, workReports] = await Promise.all([
        studio.entities.Task.list("-created_date"),
        studio.entities.Meeting.list("-created_date"),
        studio.entities.WorkReport.list("-created_date"),
      ]);
      setData({ tasks, meetings, workReports });
      setLoading(false);
    })();
  }, []);

  useEffect(() => { setAvatarBroken(false); }, [user?.profile_image]);

  const toggleWidget = (id) => {
    setVisibleWidgets((current) => {
      const next = { ...current, [id]: !current[id] };
      try { localStorage.setItem(`staff-dashboard:${user?.id || "guest"}`, JSON.stringify(next)); } catch { /* Preferences remain available for this session. */ }
      return next;
    });
  };

  if (loading)
    return (
      <div className="flex justify-center p-20">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );

  const myTasks = data.tasks.filter((t) => {
    const assignees = t.assignees || (t.assignee ? [t.assignee] : []);
    return assignees.includes(userName) || t.created_by_id === user?.id;
  });
  const myMeetings = data.meetings.filter((m) =>
    m.created_by_id === user?.id || m.colleague === userName || m.colleague_email === user?.email
  );
  const myReports = data.workReports.filter((r) => r.created_by_id === user?.id);

  const pendingCount = myTasks.filter((t) => t.status !== "done").length;
  const doneCount = myTasks.filter((t) => t.status === "done").length;
  const totalHours = myReports.reduce((s, r) => s + (r.hours || 0), 0);
  const upcomingMeetings = myMeetings.filter((m) => m.status !== "done" && m.status !== "cancelled").length;

  const stats = [
    { label: "در انتظار", value: faNum(pendingCount), icon: ListTodo, color: "bg-amber-100 text-amber-600" },
    { label: "انجام شده", value: faNum(doneCount), icon: CheckCircle, color: "bg-green-100 text-green-600" },
    { label: "ساعت کار", value: faNum(totalHours), icon: Clock, color: "bg-blue-100 text-blue-600" },
    { label: "جلسات", value: faNum(upcomingMeetings), icon: Calendar, color: "bg-purple-100 text-purple-600" },
  ];

  const quickLinks = [
    { to: "/tasks", label: "تسک‌ها", color: "bg-blue-500" },
    { to: "/meetings", label: "جلسات", color: "bg-emerald-500" },
    { to: "/work-reports", label: "گزارش کار", color: "bg-orange-500" },
    { to: "/projects", label: "پروژه‌ها", color: "bg-primary" },
  ];

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden shrink-0 bg-primary/10 text-primary flex items-center justify-center text-xl font-bold">
            {user?.profile_image && !avatarBroken ? <img src={user.profile_image} alt={userName} className="w-full h-full object-cover" onError={() => setAvatarBroken(true)} /> : <span>{userName.charAt(0) || <UserRound className="w-6 h-6" />}</span>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="text-xl sm:text-2xl font-bold truncate">{user?.full_name || "همکار عزیز"}</h1>
              <span className="text-xs text-muted-foreground tabular-nums">
                {new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "medium", timeZone: "Asia/Tehran" }).format(clockNow)}
                <span className="mx-1.5">·</span>
                {new Intl.DateTimeFormat("fa-IR-u-ca-gregory", { dateStyle: "medium", timeZone: "Asia/Tehran" }).format(clockNow)}
                <span className="mx-1.5">·</span>
                {new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Tehran" }).format(clockNow)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{roleLabel(user?.role)}{user?.department ? ` · ${user.department}` : ""}</p>
          </div>
          <Link to="/profile" className="hidden sm:inline-flex rounded-xl border border-border px-3 py-2 text-sm hover:bg-accent">پروفایل من</Link>
          <button type="button" onClick={() => setCustomizeOpen((open) => !open)} aria-expanded={customizeOpen} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm hover:bg-accent">
            <Settings2 className="w-4 h-4" /><span className="hidden sm:inline">شخصی‌سازی</span>
          </button>
        </div>
        {customizeOpen && <div className="mt-4 border-t border-border pt-4">
          <p className="text-sm font-medium mb-3">بخش‌هایی که در داشبورد نمایش داده شوند</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {dashboardWidgets.map((widget) => <label key={widget.id} className="flex items-center gap-2 rounded-lg bg-accent/30 px-3 py-2 text-sm cursor-pointer">
              <input type="checkbox" checked={visibleWidgets[widget.id] !== false} onChange={() => toggleWidget(widget.id)} className="accent-primary" />{widget.label}
            </label>)}
          </div>
        </div>}

      {visibleWidgets.stats && <div className="mt-4 grid min-w-0 grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-4 gap-2 border-t border-border pt-4">
        {stats.map((s) => (
          <div key={s.label} className="flex min-w-0 items-center gap-3 rounded-xl border border-border/70 bg-accent/20 p-3 sm:p-3.5">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${s.color}`}><s.icon className="h-4 w-4" /></div>
            <div className="min-w-0 flex-1"><p className="truncate text-xs text-muted-foreground">{s.label}</p><p className="mt-0.5 text-lg font-bold tabular-nums">{s.value}</p></div>
          </div>
        ))}
      </div>}
      </div>

      {visibleWidgets.quickLinks && <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        {quickLinks.map((q) => (
          <Link key={q.to} to={q.to} className={`${q.color} text-white rounded-xl sm:rounded-2xl p-3 sm:p-4 flex items-center justify-between hover:opacity-90 transition-opacity`}>
            <span className="font-medium text-xs sm:text-sm">{q.label}</span>
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Link>
        ))}
      </div>}

      {visibleWidgets.today && <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <TodayTasks />
        <AnnouncementWidget />
      </div>}

      {visibleWidgets.reminders && <MeetingReminders />}

      {visibleWidgets.recentTasks && <div className="bg-card rounded-2xl border border-border p-4 sm:p-5">
          <h2 className="font-bold text-sm sm:text-base mb-3">تسک‌های اخیر</h2>
          <div className="space-y-1">
            {myTasks.length === 0 && <p className="text-center text-muted-foreground py-6 text-sm">تسکی برای شما ثبت نشده</p>}
            {myTasks.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{t.title}</p>
                  {t.project_name && <p className="text-xs text-primary mt-0.5">{t.project_name}</p>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${t.status === "done" ? "bg-green-100 text-green-700" : t.status === "in_progress" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                  {t.status === "done" ? "انجام شده" : t.status === "in_progress" ? "در حال انجام" : "در انتظار"}
                </span>
              </div>
            ))}
          </div>
        </div>}
    </div>
  );
}
