import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { ListTodo, CheckCircle, Clock, Calendar, ArrowLeft, Video } from "lucide-react";
import TodayTasks from "@/components/TodayTasks";
import AnnouncementWidget from "@/components/AnnouncementWidget";
import MeetingReminders from "@/components/MeetingReminders";
import OnboardingChecklist from "@/components/OnboardingChecklist";

const faNum = (n) => Number(n || 0).toLocaleString("fa-IR");

export default function StaffDashboard() {
  const { user } = useAuth();
  const userName = user?.full_name || user?.email || "";
  const [data, setData] = useState({ tasks: [], meetings: [], workReports: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [tasks, meetings, workReports] = await Promise.all([
        base44.entities.Task.list("-created_date"),
        base44.entities.Meeting.list("-created_date"),
        base44.entities.WorkReport.list("-created_date"),
      ]);
      setData({ tasks, meetings, workReports });
      setLoading(false);
    })();
  }, []);

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
  const myReports = data.workReports.filter((r) => r.created_by_id === user?.id);
  const myMeetings = data.meetings.filter((m) => m.created_by_id === user?.id || m.colleague === userName);

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
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">داشبورد من</h1>
        <p className="text-muted-foreground mt-1 text-sm">{userName}</p>
      </div>

      <MeetingReminders />

      {/* Stats - 2x2 grid on mobile, 4 cols on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-card rounded-xl sm:rounded-2xl p-3 sm:p-5 border border-border">
            <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl ${s.color} flex items-center justify-center mb-2 sm:mb-3`}>
              <s.icon className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">{s.label}</p>
            <p className="text-base sm:text-2xl font-bold mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Quick links - 2x2 grid on mobile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        {quickLinks.map((q) => (
          <Link key={q.to} to={q.to} className={`${q.color} text-white rounded-xl sm:rounded-2xl p-3 sm:p-4 flex items-center justify-between hover:opacity-90 transition-opacity`}>
            <span className="font-medium text-xs sm:text-sm">{q.label}</span>
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Link>
        ))}
      </div>

      {/* Today Tasks + Announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <TodayTasks />
        <AnnouncementWidget />
      </div>

      {/* Tasks + Meetings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-card rounded-2xl border border-border p-4 sm:p-5">
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
        </div>

        <div className="bg-card rounded-2xl border border-border p-4 sm:p-5">
          <h2 className="font-bold text-sm sm:text-base mb-3">جلسات پیش رو</h2>
          <div className="space-y-1">
            {myMeetings.filter((m) => m.status !== "done" && m.status !== "cancelled").length === 0 && (
              <p className="text-center text-muted-foreground py-6 text-sm">جلسه‌ای در پیش رو نیست</p>
            )}
            {myMeetings.filter((m) => m.status !== "done" && m.status !== "cancelled").slice(0, 5).map((m) => (
              <div key={m.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{m.colleague}</p>
                    <p className="text-xs text-muted-foreground">{m.date} {m.time}</p>
                  </div>
                </div>
                {m.status === "confirmed" ? (
                  <a href={`https://meet.jit.si/modiryar-${m.id}`} target="_blank" rel="noopener noreferrer" className="text-xs bg-primary text-primary-foreground px-2.5 py-1 rounded-lg flex items-center gap-1 shrink-0">
                    <Video className="w-3 h-3" /> ورود
                  </a>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">در انتظار</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Onboarding Checklist for new staff */}
      <OnboardingChecklist user={user} />
    </div>
  );
}