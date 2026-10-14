import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { TrendingUp, TrendingDown, Wallet, ListTodo, FileText, ArrowUpRight, ArrowDownRight, ArrowLeft, Minus, Filter, ChevronLeft, ChevronRight, Users, CalendarDays } from "lucide-react";
import TodayTasks from "@/components/TodayTasks";
import AnnouncementWidget from "@/components/AnnouncementWidget";
import MeetingReminders from "@/components/MeetingReminders";
import PersianDatePicker, { getPersianDate } from "@/components/PersianDatePicker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addDaysToKey, persianWeekday, isJalaliLeap } from "@/lib/jalali";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, LineChart, Line } from "recharts";

const faNum = (n) => Number(n || 0).toLocaleString("fa-IR");

export default function AdminDashboard() {
  const [showDateRange, setShowDateRange] = useState(false);
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);
  const [dateRange, setDateRange] = useState({ from: getPersianDate(-30), to: getPersianDate(0) });
  const [data, setData] = useState({ expenses: [], incomes: [], tasks: [], meetings: [], workReports: [], users: [], leaveRequests: [] });
  const [loading, setLoading] = useState(true);
  const [chartPeriod, setChartPeriod] = useState("month"); // week, month, quarter

  useEffect(() => { load(); }, [dateRange, chartPeriod]);

  const load = async () => {
    setLoading(true);
    try {
      const [expenses, incomes, tasks, meetings, workReports, users, leaveRequests] = await Promise.all([
        base44.entities.Expense.list("-created_date"),
        base44.entities.Income.list("-created_date"),
        base44.entities.Task.list("-created_date"),
        base44.entities.Meeting.list("-created_date"),
        base44.entities.WorkReport.list("-created_date"),
        base44.entities.User.list(),
        base44.entities.LeaveRequest.list("-created_date"),
      ]);
      setData({ expenses, incomes, tasks, meetings, workReports, users, leaveRequests });
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    }
    setLoading(false);
  };

  // Filter data by date range. Entity dates are Persian ("1405/06/12"); items
  // without one fall back to their ISO created_date, converted to the same key.
  const filtered = useMemo(() => {
    const fromKey = toCompareKey(dateRange.from);
    const toKey = toCompareKey(dateRange.to);
    const filterByDate = (arr) => arr.filter((item) => {
      const k = itemKey(item);
      return !!k && k >= fromKey && k <= toKey;
    });
    return {
      expenses: filterByDate(data.expenses),
      incomes: filterByDate(data.incomes),
      tasks: filterByDate(data.tasks),
      meetings: filterByDate(data.meetings),
      workReports: filterByDate(data.workReports),
    };
  }, [data, dateRange]);

  // Week-over-week comparison, bucketed by Persian compare keys (no `new Date()`
  // on Persian strings, no double counting).
  const trends = useMemo(() => {
    const weekAgoKey = Number(toCompareKey(getPersianDate(-7)));
    const twoWeeksAgoKey = Number(toCompareKey(getPersianDate(-14)));
    const bucketOf = (k) => {
      if (!k) return -1;
      const n = Number(k);
      return n >= weekAgoKey ? 0 : n >= twoWeeksAgoKey ? 1 : -1;
    };

    const thisWeek = { expenses: 0, incomes: 0, tasksDone: 0, meetingsDone: 0 };
    const lastWeek = { expenses: 0, incomes: 0, tasksDone: 0, meetingsDone: 0 };

    data.expenses.forEach((e) => {
      const b = bucketOf(itemKey(e));
      if (b === 0) thisWeek.expenses += e.amount || 0;
      else if (b === 1) lastWeek.expenses += e.amount || 0;
    });
    data.incomes.forEach((i) => {
      const b = bucketOf(itemKey(i));
      if (b === 0) thisWeek.incomes += i.amount || 0;
      else if (b === 1) lastWeek.incomes += i.amount || 0;
    });
    data.tasks.forEach((t) => {
      if (t.status !== "done") return;
      const b = bucketOf(itemKey(t));
      if (b === 0) thisWeek.tasksDone++;
      else if (b === 1) lastWeek.tasksDone++;
    });
    data.meetings.forEach((m) => {
      if (m.status !== "done") return;
      const b = bucketOf(itemKey(m));
      if (b === 0) thisWeek.meetingsDone++;
      else if (b === 1) lastWeek.meetingsDone++;
    });

    const pct = (curr, prev) => prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prev) / prev) * 100);

    return {
      expense: pct(thisWeek.expenses, lastWeek.expenses),
      income: pct(thisWeek.incomes, lastWeek.incomes),
      tasks: pct(thisWeek.tasksDone, lastWeek.tasksDone),
      meetings: pct(thisWeek.meetingsDone, lastWeek.meetingsDone),
    };
  }, [data]);

  // Time-series data for charts. The series runs `chartPeriod` days back from
  // the selected range end (`dateRange.to`), so charts follow the date picker.
  const chartData = useMemo(() => {
    const map = {};
    const periodDays = chartPeriod === "week" ? 7 : chartPeriod === "month" ? 30 : 90;
    const endKey = toCompareKey(dateRange.to);
    if (!endKey) return [];
    for (let i = periodDays - 1; i >= 0; i--) {
      const key = addDaysToKey(endKey, -i);
      if (!key) continue;
      map[key] = { date: key, shortDate: `${key.slice(4, 6)}/${key.slice(6, 8)}`, expenses: 0, incomes: 0, tasksDone: 0, meetingsDone: 0 };
    }
    data.expenses.forEach((e) => {
      const key = itemKey(e);
      if (map[key]) map[key].expenses += e.amount || 0;
    });
    data.incomes.forEach((i) => {
      const key = itemKey(i);
      if (map[key]) map[key].incomes += i.amount || 0;
    });
    data.tasks.forEach((t) => {
      if (t.status === "done") {
        const key = itemKey(t);
        if (map[key]) map[key].tasksDone++;
      }
    });
    data.meetings.forEach((m) => {
      if (m.status === "done") {
        const key = itemKey(m);
        if (map[key]) map[key].meetingsDone++;
      }
    });
    return Object.values(map);
  }, [data, chartPeriod, dateRange]);

  if (loading)
    return (
      <div className="flex justify-center p-20">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );

  const totalExpense = filtered.expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalIncome = filtered.incomes.reduce((s, i) => s + (i.amount || 0), 0);
  const balance = totalIncome - totalExpense;
  const currentMonthPrefix = toCompareKey(getPersianDate(0)).slice(0, 6);
  const currentMonthExpense = data.expenses.filter((item) => itemKey(item).startsWith(currentMonthPrefix)).reduce((sum, item) => sum + (item.amount || 0), 0);
  const currentMonthIncome = data.incomes.filter((item) => itemKey(item).startsWith(currentMonthPrefix)).reduce((sum, item) => sum + (item.amount || 0), 0);
  const currentMonthBalance = currentMonthIncome - currentMonthExpense;
  const [currentYear, currentMonth] = getPersianDate(0).split("/");
  const pendingTasks = data.tasks.filter((t) => t.status !== "done").length;

  const stats = [
    { label: "موجودی", value: faNum(balance), suffix: "تومان", icon: Wallet, color: "bg-primary/10 text-primary", trend: trends.income - trends.expense, trendLabel: "بازدهی" },
    { label: "درآمدها", value: faNum(totalIncome), icon: TrendingUp, color: "bg-green-100 text-green-600", trend: trends.income, trendLabel: "هفته گذشته" },
    { label: "هزینه‌ها", value: faNum(totalExpense), icon: TrendingDown, color: "bg-red-100 text-red-600", trend: trends.expense, trendLabel: "هفته گذشته" },
    { label: "تسک‌های باز", value: faNum(pendingTasks), icon: ListTodo, color: "bg-amber-100 text-amber-600", trend: trends.tasks, trendLabel: "انجام شده این هفته" },
  ];

  const quickLinks = [
    { to: "/accounting", label: "حسابداری", color: "bg-primary" },
    { to: "/tasks", label: "تسک‌ها", color: "bg-blue-500" },
    { to: "/meetings", label: "جلسات", color: "bg-emerald-500" },
    { to: "/projects", label: "پروژه‌ها", color: "bg-orange-500" },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto min-w-0">
      {/* Header with date range picker */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">داشبورد</h1>
          <p className="text-muted-foreground mt-1 text-sm">نمای کلی وضعیت کسب‌وکار</p>
        </div>
        <div className="flex items-center gap-2">
          <Popover open={showPeriodPicker} onOpenChange={setShowPeriodPicker}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`بازهٔ نمودار: ${chartPeriod === "week" ? "هفته" : chartPeriod === "month" ? "ماه" : "فصل"}`}
                title={`بازهٔ نمودار: ${chartPeriod === "week" ? "هفته" : chartPeriod === "month" ? "ماه" : "فصل"}`}
                aria-expanded={showPeriodPicker}
                className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${showPeriodPicker ? "border-primary/40 bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"}`}
              >
                <CalendarDays className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-2">
              <p className="px-2 pb-2 text-xs font-medium text-muted-foreground">بازهٔ نمودار</p>
              <div className="grid grid-cols-3 gap-1">
                {[ ["week", "هفته"], ["month", "ماه"], ["quarter", "فصل"] ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => { setChartPeriod(value); setShowPeriodPicker(false); }}
                    aria-pressed={chartPeriod === value}
                    className={`rounded-lg px-2 py-2 text-sm transition-colors ${chartPeriod === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Popover open={showDateRange} onOpenChange={setShowDateRange}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="تنظیم بازهٔ تاریخ داشبورد"
                title="بازهٔ تاریخ"
                aria-expanded={showDateRange}
                className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${showDateRange ? "border-primary/40 bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"}`}
              >
                <Filter className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[min(26rem,calc(100vw-1.5rem))] p-4">
              <p className="mb-3 text-sm font-semibold">بازهٔ تاریخ</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0"><PersianDatePicker label="از" value={dateRange.from} onChange={(v) => setDateRange({...dateRange, from: v})} placeholder="از تاریخ" /></div>
                <div className="min-w-0"><PersianDatePicker label="تا" value={dateRange.to} onChange={(v) => setDateRange({...dateRange, to: v})} placeholder="تا تاریخ" /></div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <MeetingReminders />

      {/* Stats with trend indicators */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        {stats.map((s) => (
          <div key={s.label} className="min-w-0 bg-card rounded-2xl p-3 sm:p-6 border border-border">
            <div className={`w-9 h-9 sm:w-12 sm:h-12 rounded-xl ${s.color} flex items-center justify-center mb-2 sm:mb-4`}>
              <s.icon className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">{s.label}</p>
            <div className="flex items-end justify-between mt-1">
              <p className="min-w-0 break-words text-sm min-[380px]:text-base sm:text-2xl font-bold leading-tight">{s.value} {s.suffix && <span className="text-[10px] sm:text-sm font-normal text-muted-foreground">{s.suffix}</span>}</p>
              {s.trend !== undefined && (
                <div className={`flex items-center gap-1 text-xs font-medium ${s.trend > 0 ? "text-green-600" : s.trend < 0 ? "text-red-600" : "text-muted-foreground"}`}>
                  {s.trend > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : s.trend < 0 ? <ArrowDownRight className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{Math.abs(s.trend)}٪</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5" aria-labelledby="current-month-finance-title">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 id="current-month-finance-title" className="font-bold">خلاصه مالی این ماه</h2>
          <span className="text-xs sm:text-sm text-muted-foreground">{persianMonthNames[Number(currentMonth) - 1]} {currentYear}</span>
        </div>
        <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-2 sm:gap-3">
          {[
            { label: "موجودی خالص", value: currentMonthBalance, icon: Wallet, color: currentMonthBalance >= 0 ? "text-primary bg-primary/10" : "text-red-600 bg-red-100" },
            { label: "درآمد ماه", value: currentMonthIncome, icon: TrendingUp, color: "text-green-600 bg-green-100" },
            { label: "هزینه ماه", value: currentMonthExpense, icon: TrendingDown, color: "text-red-600 bg-red-100" },
          ].map((item) => <div key={item.label} className="flex min-w-0 items-center gap-3 rounded-xl border border-border p-3 sm:p-4">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.color}`}><item.icon className="h-4 w-4" /></span>
            <div className="min-w-0"><p className="text-xs text-muted-foreground">{item.label}</p><p className="mt-1 truncate text-sm sm:text-base font-bold">{faNum(item.value)} <span className="text-[10px] font-normal text-muted-foreground">تومان</span></p></div>
          </div>)}
        </div>
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        {quickLinks.map((q) => (
          <Link key={q.to} to={q.to} className={`${q.color} min-w-0 text-white rounded-xl sm:rounded-2xl p-3 sm:p-5 flex items-center justify-between gap-2 hover:opacity-90 transition-opacity`}>
            <span className="font-medium text-xs sm:text-sm">{q.label}</span>
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Link>
        ))}
      </div>

      {/* Charts Row 1: Revenue vs Expense + Task Completion */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-card rounded-2xl border border-border p-4 sm:p-6">
          <h2 className="font-bold text-base sm:text-lg mb-4">روند درآمد و هزینه</h2>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(173 58% 39%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(173 58% 39%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(0 84% 60%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(0 84% 60%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="shortDate" tick={{ fontSize: 11, fontFamily: "Vazirmatn" }} />
              <YAxis tick={{ fontSize: 10, fontFamily: "Vazirmatn" }} tickFormatter={(v) => faNum(v / 1000000) + "م"} />
              <Tooltip formatter={(v) => faNum(v) + " تومان"} contentStyle={{ fontFamily: "Vazirmatn", borderRadius: 12, border: "1px solid hsl(var(--border))" }} />
              <Area type="monotone" dataKey="incomes" fill="url(#colorIncome)" stroke="hsl(173 58% 39%)" strokeWidth={2} />
              <Area type="monotone" dataKey="expenses" fill="url(#colorExpense)" stroke="hsl(0 84% 60%)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-2xl border border-border p-4 sm:p-6">
          <h2 className="font-bold text-base sm:text-lg mb-4">تسک‌های انجام شده</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="shortDate" tick={{ fontSize: 11, fontFamily: "Vazirmatn" }} />
              <YAxis tick={{ fontSize: 10, fontFamily: "Vazirmatn" }} />
              <Tooltip formatter={(v) => `${v} تسک`} contentStyle={{ fontFamily: "Vazirmatn", borderRadius: 12, border: "1px solid hsl(var(--border))" }} />
              <Bar dataKey="tasksDone" fill="hsl(252 63% 58%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2: Meetings + Workload */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-card rounded-2xl border border-border p-4 sm:p-6">
          <h2 className="font-bold text-base sm:text-lg mb-4">جلسات انجام شده</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="shortDate" tick={{ fontSize: 11, fontFamily: "Vazirmatn" }} />
              <YAxis tick={{ fontSize: 10, fontFamily: "Vazirmatn" }} />
              <Tooltip formatter={(v) => `${v} جلسه`} contentStyle={{ fontFamily: "Vazirmatn", borderRadius: 12, border: "1px solid hsl(var(--border))" }} />
              <Line type="monotone" dataKey="meetingsDone" stroke="hsl(197 70% 50%)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Team Workload Overview */}
        <div className="bg-card rounded-2xl border border-border p-4 sm:p-6">
          <h2 className="font-bold text-base sm:text-lg mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> بار کاری تیم
          </h2>
          <WorkloadChart users={data.users} tasks={data.tasks} workReports={data.workReports} />
        </div>
      </div>

      {/* Calendar View */}
      <div className="bg-card rounded-2xl border border-border p-4 sm:p-6">
        <h2 className="font-bold text-base sm:text-lg mb-4 flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-primary" /> تقویم ماهانه
        </h2>
        <CalendarView meetings={data.meetings} tasks={data.tasks} workReports={data.workReports} leaveRequests={data.leaveRequests} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <TodayTasks />
        <AnnouncementWidget />
      </div>

      {/* Recent transactions + meeting summaries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-card rounded-2xl border border-border p-4 sm:p-6">
          <h2 className="font-bold text-base sm:text-lg mb-4">آخرین تراکنش‌ها</h2>
          <div className="space-y-1">
            {[...filtered.expenses, ...filtered.incomes].sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 5).map((t, i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0 ${(data.incomes.includes(t) || t.type === "income") ? "bg-green-100" : "bg-red-100"}`}>
                    {(data.incomes.includes(t) || t.type === "income") ? <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" /> : <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground">{(data.incomes.includes(t) || t.type === "income") ? "درآمد" : "هزینه"}</p>
                  </div>
                </div>
                <p className={`font-bold text-sm shrink-0 ${(data.incomes.includes(t) || t.type === "income") ? "text-green-600" : "text-red-600"}`}>
                  {(data.incomes.includes(t) || t.type === "income") ? "+" : "−"}{faNum(t.amount)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-4 sm:p-6">
          <h2 className="font-bold text-base sm:text-lg mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" /> خلاصه جلسات انجام شده
          </h2>
          <div className="space-y-1">
            {data.meetings.filter((m) => m.status === "done" && (m.summary_creator || m.summary_colleague)).slice(0, 5).map((m) => (
              <div key={m.id} className="py-3 border-b border-border last:border-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-sm">{m.colleague}</p>
                  <span className="text-xs text-muted-foreground">{m.date}</span>
                </div>
                {m.summary_creator && m.summary_colleague && m.summary_creator === m.summary_colleague ? (
                  <p className="text-xs text-primary bg-primary/5 rounded-lg p-2 mt-1">{m.summary_creator}</p>
                ) : (
                  <div className="space-y-1 mt-1">
                    {m.summary_creator && <p className="text-xs bg-accent/40 rounded-lg p-2"><span className="text-muted-foreground">ایجاد‌کننده: </span>{m.summary_creator}</p>}
                    {m.summary_colleague && <p className="text-xs bg-accent/40 rounded-lg p-2"><span className="text-muted-foreground">همکار: </span>{m.summary_colleague}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Workload Chart Component
function WorkloadChart({ users, tasks, workReports }) {
  const myTasks = tasks.filter((t) => t.status !== "done");
  const userWorkload = users
    .filter((u) => u.role === "user" || u.role === "admin")
    .map((u) => {
      const assignees = u.full_name;
      const assignedTasks = myTasks.filter((t) => {
        const taskAssignees = t.assignees || (t.assignee ? [t.assignee] : []);
        return taskAssignees.includes(assignees);
      });
      const totalHours = workReports
        .filter((r) => r.created_by_id === u.id)
        .reduce((s, r) => s + (r.hours || 0), 0);
      return {
        name: u.full_name || u.email || "?".charAt(0),
        assigned: assignedTasks.length,
        hours: totalHours,
      };
    })
    .filter((u) => u.assigned > 0 || u.hours > 0)
    .sort((a, b) => b.assigned - a.assigned)
    .slice(0, 8);

  if (userWorkload.length === 0) {
    return <p className="text-center text-muted-foreground py-8 text-sm">داده‌ای برای نمایش بار کاری وجود ندارد</p>;
  }

  return (
    <div className="space-y-3">
      {userWorkload.map((u) => (
        <div key={u.name} className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
            {u.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{u.name}</p>
            <div className="h-2 bg-accent rounded-full overflow-hidden mt-1">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, (u.assigned / Math.max(1, Math.max(...userWorkload.map((x) => x.assigned)))) * 100)}%` }} />
            </div>
          </div>
          <div className="text-xs text-muted-foreground shrink-0 w-24 text-left">
            {u.assigned} تسک • {faNum(u.hours)} ساعت
          </div>
        </div>
      ))}
    </div>
  );
}

// Calendar View Component (monthly — tasks due, meetings, work reports, approved leave)
function CalendarView({ meetings, tasks, workReports, leaveRequests }) {
  const [viewDate, setViewDate] = useState(getPersianDate(0));

  const todayKey = toCompareKey(getPersianDate(0));
  const [year, month] = viewDate.split("/").map(Number);
  const daysInMonth = month <= 6 ? 31 : month <= 11 ? 30 : isJalaliLeap(year) ? 30 : 29;
  const firstDay = persianWeekday(String(year).padStart(4, "0") + String(month).padStart(2, "0") + "01") || 0;

  const leaveTypeLabel = (t) => (t === "vacation" ? "مرخصی" : t === "sick" ? "استعلاجی" : t === "personal" ? "شخصی" : "سایر");

  const eventsByDay = useMemo(() => {
    const map = {};
    meetings.forEach((m) => { const k = toCompareKey(m.date); if (k) (map[k] = map[k] || []).push({ type: "meeting", title: m.colleague, time: m.time, status: m.status }); });
    tasks.forEach((t) => { const k = toCompareKey(t.due_date); if (k) (map[k] = map[k] || []).push({ type: "task", title: t.title, priority: t.priority }); });
    workReports.forEach((r) => { const k = toCompareKey(r.date); if (k) (map[k] = map[k] || []).push({ type: "report", title: "گزارش کار", hours: r.hours }); });
    leaveRequests.forEach((l) => {
      if (l.status !== "approved") return;
      const fromKey = toCompareKey(l.start_date);
      const toKey = toCompareKey(l.end_date);
      if (!fromKey || !toKey) return;
      let k = fromKey;
      let guard = 0;
      while (k && k <= toKey && guard < 93) {
        (map[k] = map[k] || []).push({ type: "leave", title: `${leaveTypeLabel(l.leave_type)} – ${l.user_name || ""}` });
        k = addDaysToKey(k, 1);
        guard++;
      }
    });
    return map;
  }, [meetings, tasks, workReports, leaveRequests]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={() => setViewDate(prev => { const [y, m] = prev.split("/").map(Number); const nm = m === 1 ? 12 : m - 1; const ny = m === 1 ? y - 1 : y; return `${ny}/${String(nm).padStart(2, "0")}/01`; })} className="p-1 hover:bg-accent rounded-lg"><ChevronRight className="w-5 h-5" /></button>
        <span className="font-bold text-lg">{persianMonthNames[month - 1]} {year}</span>
        <button onClick={() => setViewDate(prev => { const [y, m] = prev.split("/").map(Number); const nm = m === 12 ? 1 : m + 1; const ny = m === 12 ? y + 1 : y; return `${ny}/${String(nm).padStart(2, "0")}/01`; })} className="p-1 hover:bg-accent rounded-lg"><ChevronLeft className="w-5 h-5" /></button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-xs text-muted-foreground py-2 border-b border-border">
        {["ش", "ی", "د", "س", "چ", "پ", "ج"].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {[...Array(firstDay)].map((_, i) => <div key={i} className="aspect-square" />)}
        {[...Array(daysInMonth)].map((_, i) => {
          const day = i + 1;
          const dayKey = String(year).padStart(4, "0") + String(month).padStart(2, "0") + String(day).padStart(2, "0");
          const events = eventsByDay[dayKey] || [];
          const isToday = dayKey === todayKey;
          return (
            <div key={day} className={`relative aspect-square p-1 rounded-lg ${isToday ? "bg-primary/10 ring-2 ring-primary" : "hover:bg-accent/30"}`}>
              <span className={`text-xs sm:text-sm font-medium ${isToday ? "text-primary" : ""}`}>{toPersianDigit(day)}</span>
              <div className="mt-1 flex gap-0.5 sm:hidden" aria-label={`${events.length} رویداد`}>
                {events.slice(0, 3).map((event, idx) => <span key={idx} className={`h-1.5 w-1.5 rounded-full ${event.type === "meeting" ? "bg-blue-500" : event.type === "task" ? "bg-amber-500" : event.type === "leave" ? "bg-purple-500" : "bg-green-500"}`} />)}
                {events.length > 3 && <span className="text-[8px] leading-none text-muted-foreground">+{events.length - 3}</span>}
              </div>
              <div className="hidden sm:block space-y-1 mt-1 max-h-20 overflow-y-auto">
                {events.slice(0, 3).map((e, idx) => (
                  <div key={idx} className={`text-[10px] px-1 py-0.5 rounded truncate ${e.type === "meeting" ? "bg-blue-100 text-blue-700" : e.type === "task" ? "bg-amber-100 text-amber-700" : e.type === "leave" ? "bg-purple-100 text-purple-700" : "bg-green-100 text-green-700"}`}>
                    {e.time && <span className="mr-1">{e.time}</span>}
                    {e.title}
                  </div>
                ))}
                {events.length > 3 && <div className="text-[10px] text-muted-foreground">+{events.length - 3}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const persianMonthNames = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];

function toCompareKey(d) {
  const parts = String(d || "").split("/");
  if (parts.length !== 3) return "";
  return `${parts[0].padStart(4, "0")}${parts[1].padStart(2, "0")}${parts[2].padStart(2, "0")}`;
}

// ISO timestamp ("created_date") -> compact Persian compare key (14050612).
function isoToPersianKey(iso) {
  if (!iso) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-u-ca-persian", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Tehran" }).formatToParts(new Date(iso));
    const p = {};
    parts.forEach((part) => { if (part.type !== "literal") p[part.type] = part.value; });
    return `${p.year}${p.month}${p.day}`;
  } catch {
    return "";
  }
}

// One compact compare key per entity: its Persian business date, or created_date.
function itemKey(item) {
  if (!item) return "";
  return toCompareKey(item.date) || isoToPersianKey(item.created_date);
}

function toPersianDigit(n) {
  const digits = "۰۱۲۳۴۵۶۷۸۹";
  return String(n).replace(/\d/g, (d) => digits[d]);
}
