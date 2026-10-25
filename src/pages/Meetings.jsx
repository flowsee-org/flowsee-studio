import { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Plus, Calendar, Clock, User, CheckCircle, X, Video, Clock3, RefreshCw, FileText, AlertCircle, History, ArrowDownCircle, Filter, ChevronDown, Users, Star, ChevronLeft, ChevronRight } from "lucide-react";
import MeetingModal from "@/components/MeetingModal";
import PersianDatePicker, { getPersianDate } from "@/components/PersianDatePicker";
import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import { loadTeamMembers } from "@/lib/teamMembers";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useDeleteUndo } from "@/hooks/useDeleteUndo.jsx";

const persianMonthNames = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
const formatCalendarDate = (year, month, day) => String(year) + "/" + String(month).padStart(2, "0") + "/" + String(day).padStart(2, "0");

const statusLabels = { pending: "در انتظار تایید", confirmed: "تایید شده", rescheduled: "زمان پیشنهادی", done: "انجام شده", cancelled: "لغو شده" };
const statusColors = { pending: "bg-amber-100 text-amber-700", confirmed: "bg-blue-100 text-blue-700", rescheduled: "bg-purple-100 text-purple-700", done: "bg-green-100 text-green-700", cancelled: "bg-red-100 text-red-700" };

export default function Meetings() {
  const { user, isAdmin } = useAuth();
  const userName = user?.full_name || user?.email || "";
  const userEmail = user?.email || "";
  const [meetings, setMeetings] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const initialCalendarDate = getPersianDate(0);
  const [calendarYear, setCalendarYear] = useState(() => initialCalendarDate ? parseInt(initialCalendarDate.split("/")[0], 10) : 1405);
  const [calendarMonth, setCalendarMonth] = useState(() => initialCalendarDate ? parseInt(initialCalendarDate.split("/")[1], 10) : 1);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => initialCalendarDate || "1405/01/01");
  const [showModal, setShowModal] = useState(false);
  const [proposingFor, setProposingFor] = useState(null);
  const [proposedDate, setProposedDate] = useState("");
  const [proposedTime, setProposedTime] = useState("10:00");
  const [summaryFor, setSummaryFor] = useState(null);
  const [summaryText, setSummaryText] = useState("");
  const [feedbackFor, setFeedbackFor] = useState(null);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [creatorNames, setCreatorNames] = useState({});
  const [memberMap, setMemberMap] = useState({});

  // Filters for history section
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    load();
    loadCreators();
    const unsubscribeMeeting = base44.entities.Meeting.subscribe(() => load());
    const unsubscribeLeave = base44.entities.LeaveRequest.subscribe(() => load());
    return () => {
      if (typeof unsubscribeMeeting === "function") unsubscribeMeeting();
      if (typeof unsubscribeLeave === "function") unsubscribeLeave();
    };
  }, []);

  const load = async () => {
    try {
      const [data, leaves] = await Promise.all([
        base44.entities.Meeting.list("-created_date").catch(() => []),
        base44.entities.LeaveRequest.list("-created_date").catch(() => []),
      ]);
      setMeetings(Array.isArray(data) ? data : []);
      setLeaveRequests(Array.isArray(leaves) ? leaves : []);
    } finally {
      setLoading(false);
    }
  };

  const { deleteWithUndo } = useDeleteUndo("Meeting", (id) => base44.entities.Meeting.delete(id), load);

  const loadCreators = async () => {
    const members = await loadTeamMembers();
    const map = {};
    const memberMapLocal = {};
    members.forEach((m) => {
      if (m.id) map[m.id] = m.name;
      if (m.email) memberMapLocal[m.email.toLowerCase()] = m.name;
      if (m.name) memberMapLocal[m.name.toLowerCase()] = m.name;
    });
    setCreatorNames(map);
    setMemberMap(memberMapLocal);
  };

  const visibleMeetings = isAdmin
    ? meetings
    : meetings.filter((m) => m.created_by_id === user?.id || m.colleague === userName || m.colleague_email === userEmail);

  const activeMeetings = visibleMeetings.filter((m) => m.status !== "done" && m.status !== "cancelled");

  const visibleApprovedLeaves = leaveRequests.filter((leave) => leave.status === "approved" && (isAdmin || leave.created_by_id === user?.id || leave.user_email === userEmail));
  const monthStart = new DateObject({ year: calendarYear, month: calendarMonth, day: 1, calendar: persian, locale: persian_fa });
  const calendarDayCount = monthStart.month.length;
  const calendarWeekdayOffset = monthStart.weekDay.index;
  const calendarCellCount = Math.ceil((calendarDayCount + calendarWeekdayOffset) / 7) * 7;
  const calendarCells = Array.from({ length: calendarCellCount }, (_, index) => { const day = index - calendarWeekdayOffset + 1; return day < 1 || day > calendarDayCount ? null : day; });
  const selectedDayMeetings = visibleMeetings.filter((meeting) => meeting.date === selectedCalendarDate && meeting.status !== "cancelled").sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")));
  const selectedDayLeaves = visibleApprovedLeaves.filter((leave) => leave.start_date <= selectedCalendarDate && leave.end_date >= selectedCalendarDate);
  const moveCalendarMonth = (offset) => {
    const monthIndex = calendarYear * 12 + calendarMonth - 1 + offset;
    const nextYear = Math.floor(monthIndex / 12);
    const nextMonth = (monthIndex % 12) + 1;
    setCalendarYear(nextYear);
    setCalendarMonth(nextMonth);
    setSelectedCalendarDate(formatCalendarDate(nextYear, nextMonth, 1));
  };

  // Apply filters to history meetings
  const filteredHistoryMeetings = visibleMeetings
    .filter((m) => m.status === "done" || m.status === "cancelled")
    .filter((m) => {
      if (dateFrom && m.date < dateFrom) return false;
      if (dateTo && m.date > dateTo) return false;
      if (employeeFilter) {
        const match = employeeFilter.toLowerCase();
        const colleagueMatch = m.colleague?.toLowerCase().includes(match);
        const creatorMatch = m.created_by_id && creatorNames[m.created_by_id]?.toLowerCase().includes(match);
        if (!colleagueMatch && !creatorMatch) return false;
      }
      return true;
    });

  const creatorName = useCallback((m) => {
    // First try to get from created_by_id lookup
    if (m.created_by_id && creatorNames[m.created_by_id]) return creatorNames[m.created_by_id];
    // If it's the current user
    if (m.created_by_id === user?.id) return userName;
    // Try to match by email in memberMap
    if (m.created_by_email && memberMap[m.created_by_email.toLowerCase()]) return memberMap[m.created_by_email.toLowerCase()];
    // Fallback to colleague if that's the creator
    return "نامشخص";
  }, [creatorNames, user?.id, userName, memberMap]);

  const confirmMeeting = async (id) => {
    await base44.entities.Meeting.update(id, { status: "confirmed" });
    load();
  };

  const proposeTime = async (id) => {
    if (!proposedDate) return;
    await base44.entities.Meeting.update(id, { proposed_date: proposedDate, proposed_time: proposedTime, status: "rescheduled" });
    setProposingFor(null);
    setProposedDate("");
    setProposedTime("10:00");
    load();
  };

  const acceptProposed = async (m) => {
    await base44.entities.Meeting.update(m.id, {
      date: m.proposed_date,
      time: m.proposed_time,
      proposed_date: "",
      proposed_time: "",
      status: "confirmed",
    });
    load();
  };

  const markDone = async (id) => {
    await base44.entities.Meeting.update(id, { status: "done" });
    load();
  };

  const submitSummary = async (m) => {
    if (!summaryText.trim()) return;
    const isCreator = m.created_by_id === user?.id;
    const field = isCreator ? "summary_creator" : "summary_colleague";
    await base44.entities.Meeting.update(m.id, { [field]: summaryText });
    setSummaryFor(null);
    setSummaryText("");
    load();
  };

  const getDuration = (m) => {
    if (!m.time || !m.end_time) return "";
    const [sH, sM] = m.time.split(":").map(Number);
    const [eH, eM] = m.end_time.split(":").map(Number);
    const diff = (eH * 60 + eM) - (sH * 60 + sM);
    if (!isFinite(diff) || diff <= 0) return "";
    const h = Math.floor(diff / 60);
    const min = diff % 60;
    return `${h > 0 ? h + " ساعت" : ""} ${min > 0 ? min + " دقیقه" : ""}`.trim();
  };

  const submitFeedback = async (m) => {
    if (!feedbackRating) return;
    await base44.entities.Meeting.update(m.id, {
      feedback: {
        rating: feedbackRating,
        comment: feedbackComment.trim(),
        by: userName,
        date: new Date().toISOString(),
      },
    });
    setFeedbackFor(null);
    setFeedbackRating(0);
    setFeedbackComment("");
    load();
  };

  const handleDelete = async (id) => {
    const meeting = meetings.find(m => m.id === id);
    if (meeting) setDeleteTarget(meeting);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteWithUndo(deleteTarget);
    load();
    setDeleteTarget(null);
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
          <h1 className="text-2xl font-bold">جلسات</h1>
          <p className="text-muted-foreground mt-1 text-sm">درخواست و مدیریت جلسات یک‌به‌یک</p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:opacity-90 transition-opacity">
          <Plus className="w-5 h-5" /> ثبت جلسه
        </button>
      </div>

      {/* Combined meeting and approved-leave calendar */}
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <div><h2 className="font-bold">تقویم جلسات و مرخصی‌ها</h2><p className="text-xs text-muted-foreground mt-0.5">جلسات ثبت‌شده و مرخصی‌های تأییدشده در یک نما</p></div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => moveCalendarMonth(-1)} className="rounded-lg p-2 hover:bg-accent" aria-label="ماه قبل"><ChevronRight className="h-4 w-4" /></button>
            <select aria-label="ماه تقویم" value={calendarMonth} onChange={(event) => { const month = Number(event.target.value); setCalendarMonth(month); setSelectedCalendarDate(formatCalendarDate(calendarYear, month, 1)); }} className="min-w-28 rounded-xl border border-input bg-card px-3 py-2 text-sm">
              {persianMonthNames.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
            </select>
            <select aria-label="سال تقویم" value={calendarYear} onChange={(event) => { const year = Number(event.target.value); setCalendarYear(year); setSelectedCalendarDate(formatCalendarDate(year, calendarMonth, 1)); }} className="min-w-20 rounded-xl border border-input bg-card px-3 py-2 text-sm">
              {Array.from({ length: 9 }, (_, index) => calendarYear - 4 + index).map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
            <button type="button" onClick={() => moveCalendarMonth(1)} className="rounded-lg p-2 hover:bg-accent" aria-label="ماه بعد"><ChevronLeft className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {["ش", "ی", "د", "س", "چ", "پ", "ج"].map((dayName) => <div key={dayName} className="py-2 text-[11px] font-medium text-muted-foreground">{dayName}</div>)}
          {calendarCells.map((day, index) => {
            if (!day) return <div key={"empty-" + index} className="min-h-[68px] rounded-lg border border-transparent" />;
            const dateValue = formatCalendarDate(calendarYear, calendarMonth, day);
            const dayMeetings = visibleMeetings.filter((meeting) => meeting.date === dateValue && meeting.status !== "cancelled");
            const dayLeaves = visibleApprovedLeaves.filter((leave) => leave.start_date <= dateValue && leave.end_date >= dateValue);
            const isSelected = selectedCalendarDate === dateValue;
            const isToday = getPersianDate(0) === dateValue;
            return <button type="button" key={dateValue} onClick={() => setSelectedCalendarDate(dateValue)} aria-pressed={isSelected} className={"min-h-[68px] min-w-0 rounded-lg border p-1.5 text-right transition-colors " + (isSelected ? "border-primary bg-primary/10" : isToday ? "border-primary/30 bg-primary/5" : "border-border/60 hover:bg-accent/50")}>
              <span className={"text-xs font-semibold " + (isSelected || isToday ? "text-primary" : "text-foreground")}>{day.toLocaleString("fa-IR")}</span>
              {dayMeetings.length > 0 && <span className="mt-1 block truncate rounded bg-blue-100 px-1 py-0.5 text-[9px] text-blue-800">{dayMeetings.length.toLocaleString("fa-IR")} جلسه</span>}
              {dayLeaves.length > 0 && <span className="mt-0.5 block truncate rounded bg-emerald-100 px-1 py-0.5 text-[9px] text-emerald-800">{dayLeaves.length.toLocaleString("fa-IR")} مرخصی</span>}
            </button>;
          })}
        </div>
        <div className="border-t border-border pt-4 space-y-3">
          <h3 className="text-sm font-bold">برنامهٔ {selectedCalendarDate}</h3>
          {selectedDayMeetings.length === 0 && selectedDayLeaves.length === 0 && <p className="text-sm text-muted-foreground">برای این روز جلسه یا مرخصی تأییدشده‌ای ثبت نشده است.</p>}
          {selectedDayMeetings.map((meeting) => <div key={meeting.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-sm text-blue-900"><span className="flex min-w-0 items-center gap-2"><Clock className="h-4 w-4 shrink-0" /><span className="truncate">{meeting.time || "بدون ساعت"} · {meeting.colleague || "جلسه"}</span></span><span className="text-xs">{statusLabels[meeting.status] || statusLabels.pending}</span></div>)}
          {selectedDayLeaves.map((leave) => <div key={leave.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900"><span className="flex min-w-0 items-center gap-2"><User className="h-4 w-4 shrink-0" /><span className="truncate">{leave.user_name} · {leave.leave_type === "sick" ? "استعلاجی" : leave.leave_type === "personal" ? "شخصی" : leave.leave_type === "other" ? "سایر" : "استحقاقی"}</span></span><span className="text-xs">مرخصی تأییدشده</span></div>)}
        </div>
      </section>
      {visibleMeetings.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-8 sm:p-12 text-center">
          <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">هنوز جلسه‌ای ثبت نشده است</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeMeetings.map((m) => {
              const isCreator = m.created_by_id === user?.id;
              const isColleague = m.colleague === userName || m.colleague_email === userEmail;
              const canConfirm = isColleague && !isCreator && m.status === "pending";
              const canPropose = isColleague && !isCreator && m.status === "pending";
              const canAccept = isCreator && m.status === "rescheduled";
              const canMarkDone = (isCreator || isColleague) && m.status === "confirmed";
              const canSummarize = (isCreator || isColleague) && m.status === "done";
              const mySummaryDone = isCreator ? !!m.summary_creator : isColleague ? !!m.summary_colleague : false;

              return (
                <div key={m.id} className="bg-card rounded-2xl border border-border p-4 sm:p-5">
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                        <User className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold truncate">{m.colleague}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                          <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {m.date}</span>
                          {m.time && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {m.time}</span>}
                          {getDuration(m) && <span className="flex items-center gap-1"><Clock3 className="w-3.5 h-3.5" /> {getDuration(m)}</span>}
                        </div>
                        {m.is_group && (m.participants || []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            <Users className="w-3.5 h-3.5 text-emerald-500 ml-1" />
                            {(m.participants || []).slice(0, 4).map((p) => (
                              <span key={p} className="text-[10px] bg-accent rounded-full px-2 py-0.5">{p}</span>
                            ))}
                            {(m.participants || []).length > 4 && (
                              <span className="text-[10px] text-muted-foreground">+{(m.participants || []).length - 4} نفر</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {m.urgent && (
                        <span className="text-xs bg-red-500 text-white px-2 py-1 rounded-full flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> فوری
                        </span>
                      )}
                      <span className={`text-xs px-3 py-1 rounded-full ${statusColors[m.status] || statusColors.pending}`}>
                        {statusLabels[m.status] || statusLabels.pending}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-accent/50 rounded-lg px-3 py-1.5 mb-3">
                    <ArrowDownCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>از طرف: <span className="font-medium text-foreground">{creatorName(m)}</span></span>
                  </div>

                  {m.status === "rescheduled" && m.proposed_date && (
                    <div className="flex items-center gap-2 text-xs text-purple-600 bg-purple-50 rounded-lg px-3 py-2 mb-3">
                      <RefreshCw className="w-4 h-4" /> زمان پیشنهادی: {m.proposed_date} {m.proposed_time}
                    </div>
                  )}

                  {m.status === "pending" && isCreator && !canConfirm && (
                    <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-3">
                      <Clock3 className="w-4 h-4" /> در انتظار تایید همکار
                    </div>
                  )}

                  {m.topics && m.topics.length > 0 && (
                    <div className="space-y-1.5 mb-3">
                      <p className="text-xs font-medium text-muted-foreground">موضوعات:</p>
                      {m.topics.map((t, i) => (
                        <div key={i} className="text-sm bg-accent/50 rounded-lg px-3 py-1.5">{t}</div>
                      ))}
                    </div>
                  )}

                  {/* Summary display */}
                  {m.status === "done" && (m.summary_creator || m.summary_colleague) && (
                    <div className="mt-3 pt-3 border-t border-border space-y-2">
                      {m.summary_creator && m.summary_colleague && m.summary_creator === m.summary_colleague ? (
                        <div>
                          <p className="text-xs font-medium text-primary mb-1 flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> خلاصه مشترک</p>
                          <p className="text-sm bg-primary/5 rounded-lg p-2.5">{m.summary_creator}</p>
                        </div>
                      ) : (
                        <>
                          {m.summary_creator && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">خلاصه شما</p>
                              <p className="text-sm bg-accent/40 rounded-lg p-2.5">{m.summary_creator}</p>
                            </div>
                          )}
                          {m.summary_colleague && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">خلاصه همکار</p>
                              <p className="text-sm bg-accent/40 rounded-lg p-2.5">{m.summary_colleague}</p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Summary form */}
                  {summaryFor === m.id && (
                    <div className="mt-3 pt-3 border-t border-border space-y-2">
                      <textarea
                        value={summaryText}
                        onChange={(e) => setSummaryText(e.target.value)}
                        placeholder="خلاصه اقدامات و موضوعات مطرح شده..."
                        rows={3}
                        className="w-full border border-input rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => submitSummary(m)} disabled={!summaryText.trim()} className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                          ثبت خلاصه
                        </button>
                        <button onClick={() => { setSummaryFor(null); setSummaryText(""); }} className="px-3 py-2 text-sm text-muted-foreground border border-border rounded-lg">
                          انصراف
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Propose time form */}
                  {proposingFor === m.id && (
                    <div className="mt-3 pt-3 border-t border-border space-y-2">
                      <PersianDatePicker label="تاریخ پیشنهادی" value={proposedDate} onChange={setProposedDate} placeholder="تاریخ جدید" />
                      <div>
                        <label className="text-sm font-medium block mb-1.5">ساعت پیشنهادی</label>
                        <input type="time" value={proposedTime} onChange={(e) => setProposedTime(e.target.value)} dir="ltr" className="w-full border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => proposeTime(m.id)} disabled={!proposedDate} className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                          ارسال پیشنهاد
                        </button>
                        <button onClick={() => setProposingFor(null)} className="px-3 py-2 text-sm text-muted-foreground border border-border rounded-lg">
                          انصراف
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Feedback display */}
                  {m.feedback && (
                    <div className="mt-3 pt-3 border-t border-border flex items-start gap-2">
                      <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} className={`w-4 h-4 ${n <= m.feedback.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                        ))}
                      </div>
                      <div className="min-w-0">
                        {m.feedback.comment && (
                          <p className="text-sm text-foreground bg-accent/40 rounded-lg p-2.5 whitespace-pre-wrap">{m.feedback.comment}</p>
                        )}
                        {m.feedback.by && (
                          <p className="text-[11px] text-muted-foreground mt-1">بازخورد {m.feedback.by}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Feedback form */}
                  {feedbackFor === m.id && (
                    <div className="mt-3 pt-3 border-t border-border space-y-3">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button key={n} onClick={() => setFeedbackRating(n)} aria-label={`${n} ستاره`}>
                            <Star className={`w-6 h-6 transition-colors ${n <= feedbackRating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40 hover:text-amber-300"}`} />
                          </button>
                        ))}
                        <span className="text-xs text-muted-foreground mr-2">
                          {feedbackRating ? `${feedbackRating} از ۵` : "امتیاز دهید"}
                        </span>
                      </div>
                      <textarea
                        value={feedbackComment}
                        onChange={(e) => setFeedbackComment(e.target.value)}
                        placeholder="نظر یا ارزیابی شما درباره این جلسه..."
                        rows={2}
                        className="w-full border border-input rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => submitFeedback(m)} disabled={!feedbackRating} className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                          ثبت بازخورد
                        </button>
                        <button onClick={() => { setFeedbackFor(null); setFeedbackRating(0); setFeedbackComment(""); }} className="px-3 py-2 text-sm text-muted-foreground border border-border rounded-lg">
                          انصراف
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pt-3 border-t border-border flex-wrap">
                    {canConfirm && (
                      <button onClick={() => confirmMeeting(m.id)} className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-medium hover:bg-blue-100">
                        تایید جلسه
                      </button>
                    )}
                    {canPropose && (
                      <button onClick={() => setProposingFor(m.id)} className="text-xs bg-purple-50 text-purple-600 px-3 py-1.5 rounded-lg font-medium hover:bg-purple-100">
                        پیشنهاد زمان دیگر
                      </button>
                    )}
                    {canAccept && (
                      <button onClick={() => acceptProposed(m)} className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-medium hover:bg-blue-100">
                        تایید زمان پیشنهادی
                      </button>
                    )}
                    {m.status === "confirmed" && (
                      <a href={`https://meet.jit.si/modiryar-${m.id}`} target="_blank" rel="noopener noreferrer" className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg font-medium hover:opacity-90 flex items-center gap-1.5">
                        <Video className="w-3.5 h-3.5" /> ورود به جلسه
                      </a>
                    )}
                    {canMarkDone && (
                      <button onClick={() => markDone(m.id)} className="text-xs bg-green-50 text-green-600 px-3 py-1.5 rounded-lg font-medium hover:bg-green-100 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> پایان جلسه
                      </button>
                    )}
                    {canSummarize && !mySummaryDone && summaryFor !== m.id && (
                      <button onClick={() => setSummaryFor(m.id)} className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg font-medium hover:bg-primary/20 flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" /> ثبت خلاصه
                      </button>
                    )}
                    {m.status === "done" && (
                      m.feedback ? (
                        <span className="text-xs bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> {m.feedback.rating}/۵
                        </span>
                      ) : (
                        <button onClick={() => { setFeedbackFor(m.id); setFeedbackRating(0); setFeedbackComment(""); }} className="text-xs bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg font-medium hover:bg-amber-100 flex items-center gap-1">
                          <Star className="w-3.5 h-3.5" /> ثبت بازخورد
                        </button>
                      )
                    )}
                    <button onClick={() => handleDelete(m.id)} className="text-xs text-muted-foreground hover:text-red-500 px-3 py-1.5 rounded-lg flex items-center gap-1 mr-auto">
                      <X className="w-3.5 h-3.5" /> حذف
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredHistoryMeetings.length > 0 && (
            <div className="pt-2">
              <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-muted-foreground" />
                  <h2 className="text-lg font-bold">تاریخچه جلسات</h2>
                  <span className="text-xs bg-accent text-muted-foreground px-2 py-0.5 rounded-full">{filteredHistoryMeetings.length}</span>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="flex items-center gap-2 text-sm">
                      <Filter className="w-4 h-4" />
                      <span>فیلترها:</span>
                    </label>
                    <PersianDatePicker
                      label="از تاریخ"
                      value={dateFrom}
                      onChange={setDateFrom}
                      placeholder="تاریخ شروع"
                    />
                    <PersianDatePicker
                      label="تا تاریخ"
                      value={dateTo}
                      onChange={setDateTo}
                      placeholder="تاریخ پایان"
                    />
                    <select
                      value={employeeFilter}
                      onChange={(e) => setEmployeeFilter(e.target.value)}
                      className="border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[200px]"
                    >
                      <option value="">همه کارمندان</option>
                      {Object.values(memberMap).sort().map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                    {(dateFrom || dateTo || employeeFilter) && (
                      <button
                        onClick={() => { setDateFrom(""); setDateTo(""); setEmployeeFilter(""); }}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        <ChevronDown className="w-3.5 h-3.5" /> پاک کردن فیلترها
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredHistoryMeetings.map((m) => {
                  const isCreator = m.created_by_id === user?.id;
                  return (
                    <div key={m.id} className="bg-card rounded-2xl border border-border p-4 sm:p-5 opacity-75">
                      <div className="flex items-start justify-between mb-3 gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-xl bg-accent flex items-center justify-center shrink-0">
                            <User className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold truncate">{m.colleague}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {m.date}</span>
                              {m.time && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {m.time}</span>}
                              {getDuration(m) && <span className="flex items-center gap-1"><Clock3 className="w-3.5 h-3.5" /> {getDuration(m)}</span>}
                            </div>
                          </div>
                          {m.feedback && (
                            <div className="flex items-center gap-0.5 mt-1">
                              {[1, 2, 3, 4, 5].map((n) => (
                                <Star key={n} className={`w-3.5 h-3.5 ${n <= m.feedback.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {m.urgent && (
                            <span className="text-xs bg-red-500 text-white px-2 py-1 rounded-full flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> فوری
                            </span>
                          )}
                          <span className={`text-xs px-3 py-1 rounded-full ${statusColors[m.status] || statusColors.pending}`}>
                            {statusLabels[m.status] || statusLabels.pending}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-accent/50 rounded-lg px-3 py-1.5 mb-3">
                        <ArrowDownCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>از طرف: <span className="font-medium text-foreground">{creatorName(m)}</span></span>
                      </div>
                      {m.topics && m.topics.length > 0 && (
                        <div className="space-y-1.5 mb-3">
                          {m.topics.map((t, i) => (
                            <div key={i} className="text-sm bg-accent/50 rounded-lg px-3 py-1.5">{t}</div>
                          ))}
                        </div>
                      )}
                      {m.status === "done" && (m.summary_creator || m.summary_colleague) && (
                        <div className="mt-3 pt-3 border-t border-border space-y-2">
                          {m.summary_creator && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">{isCreator ? "خلاصه شما" : `خلاصه ${creatorName(m)}`}</p>
                              <p className="text-sm bg-accent/40 rounded-lg p-2.5">{m.summary_creator}</p>
                            </div>
                          )}
                          {m.summary_colleague && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">{isCreator ? `خلاصه ${m.colleague}` : "خلاصه شما"}</p>
                              <p className="text-sm bg-accent/40 rounded-lg p-2.5">{m.summary_colleague}</p>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-2 pt-3 border-t border-border">
                        <button onClick={() => handleDelete(m.id)} className="text-xs text-muted-foreground hover:text-red-500 px-3 py-1.5 rounded-lg flex items-center gap-1 mr-auto">
                          <X className="w-3.5 h-3.5" /> حذف
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {showModal && <MeetingModal onClose={() => setShowModal(false)} onSaved={load} />}

      {deleteTarget && (
        <ConfirmDialog
          title="حذف جلسه"
          description={`جلسه با "${deleteTarget.colleague}" در تاریخ ${deleteTarget.date} بلافاصله حذف می‌شود. آیا مطمئن هستید؟`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
          confirmText="بله، حذف شود"
        />
      )}
    </div>
  );
}