import { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Plus, Calendar, User, Check, X, AlertCircle, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import PersianDatePicker, { getPersianDate } from "@/components/PersianDatePicker";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useDeleteUndo } from "@/hooks/useDeleteUndo.jsx";

const leaveTypeLabels = {
  vacation: "مرخصی استحقاقی",
  sick: "استعلاجی",
  personal: "شخصی",
  other: "سایر",
};

const leaveTypeColors = {
  vacation: "bg-blue-100 text-blue-700",
  sick: "bg-red-100 text-red-700",
  personal: "bg-purple-100 text-purple-700",
  other: "bg-gray-100 text-gray-700",
};

const statusLabels = {
  pending: "در انتظار",
  approved: "تایید",
  rejected: "رد",
};

const statusColors = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

const persianMonthNames = [
  "فروردین", "اردیبهشت", "خرداد",
  "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر",
  "دی", "بهمن", "اسفند",
];

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function daysInPersianMonth(_year, month) {
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  return 30;
}

export default function LeaveRequests() {
  const { user, isAdmin } = useAuth();
  const userName = user?.full_name || user?.email || "";
  const userEmail = user?.email || "";
  const userId = user?.id;

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Modal form state
  const [leaveType, setLeaveType] = useState("vacation");
  const [startDate, setStartDate] = useState(getPersianDate(0));
  const [endDate, setEndDate] = useState(getPersianDate(0));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Admin calendar state
  const [calendarYear, setCalendarYear] = useState(() => {
    const today = getPersianDate(0);
    return today ? parseInt(today.split("/")[0], 10) : 1403;
  });
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = getPersianDate(0);
    return today ? parseInt(today.split("/")[1], 10) : 1;
  });

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    load();
    const unsubscribe = base44.entities.LeaveRequest.subscribe(() => load());
    return unsubscribe;
  }, []);

  const load = async () => {
    try {
      const data = await base44.entities.LeaveRequest.list("-created_date");
      setRequests(data);
    } catch (err) {
      console.error("Failed to load leave requests:", err);
    } finally {
      setLoading(false);
    }
  };

  const { deleteWithUndo } = useDeleteUndo("LeaveRequest", (id) => base44.entities.LeaveRequest.delete(id), load);

  const visibleRequests = isAdmin
    ? requests
    : requests.filter((r) => r.created_by_id === userId || r.user_email === userEmail);

  const handleSubmit = async () => {
    if (!startDate || !endDate) {
      setError("تاریخ شروع و پایان الزامی است");
      return;
    }
    const [sY, sM, sD] = startDate.split("/").map(Number);
    const [eY, eM, eD] = endDate.split("/").map(Number);
    if (eY * 10000 + eM * 100 + eD < sY * 10000 + sM * 100 + sD) {
      setError("تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await base44.entities.LeaveRequest.create({
        user_name: userName,
        user_email: userEmail,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim(),
        status: "pending",
        reviewer_notes: "",
      });
      setShowModal(false);
      resetForm();
      load();
    } catch (err) {
      setError(err.message || "خطا در ثبت درخواست");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setLeaveType("vacation");
    setStartDate(getPersianDate(0));
    setEndDate(getPersianDate(0));
    setReason("");
    setError("");
  };

  const handleApprove = async (id) => {
    await base44.entities.LeaveRequest.update(id, { status: "approved" });
    load();
  };

  const handleReject = async (id) => {
    const notes = window.prompt("دلیل رد درخواست (اختیاری):");
    if (notes === null) return;
    await base44.entities.LeaveRequest.update(id, { status: "rejected", reviewer_notes: notes || "" });
    load();
  };

  const handleDelete = (request) => setDeleteTarget(request);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteWithUndo(deleteTarget);
    load();
    setDeleteTarget(null);
  };

  // Calendar helpers
  const approvedList = requests.filter((r) => r.status === "approved");

  const getLeavesForDay = useCallback(
    (day) => {
      const dateStr = `${calendarYear}/${String(calendarMonth).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
      return approvedList.filter((r) => r.start_date <= dateStr && r.end_date >= dateStr);
    },
    [calendarYear, calendarMonth, approvedList],
  );

  const todayStr = getPersianDate(0);
  const [todayYear, todayMonth, todayDay] = todayStr ? todayStr.split("/").map(Number) : [0, 0, 0];
  const isCurrentMonth = todayYear === calendarYear && todayMonth === calendarMonth;

  const totalDays = daysInPersianMonth(calendarYear, calendarMonth);

  if (loading) {
    return (
      <div className="flex justify-center p-20">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">مرخصی‌ها</h1>
          <p className="text-muted-foreground mt-1 text-sm">درخواست و مدیریت مرخصی‌های کارکنان</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:opacity-90 transition-opacity"
        >
          <Plus className="w-5 h-5" /> درخواست مرخصی
        </button>
      </div>

      {/* Requests List */}
      {visibleRequests.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-8 sm:p-12 text-center">
          <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">هنوز درخواست مرخصی‌ای ثبت نشده است</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleRequests.map((r) => {
            const isOwner = r.created_by_id === userId || r.user_email === userEmail;
            const isPending = r.status === "pending";
            return (
              <div key={r.id} className="bg-card rounded-2xl border border-border p-4 sm:p-5">
                <div className="flex items-start justify-between mb-3 gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold truncate">{r.user_name}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        <span className={`text-xs px-2 py-1 rounded-full ${leaveTypeColors[r.leave_type] || leaveTypeColors.vacation}`}>
                          {leaveTypeLabels[r.leave_type] || leaveTypeLabels.vacation}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {r.start_date} تا {r.end_date}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full shrink-0 ${statusColors[r.status] || statusColors.pending}`}>
                    {statusLabels[r.status] || statusLabels.pending}
                  </span>
                </div>

                {r.reason && (
                  <div className="mb-3 p-3 bg-accent/50 rounded-lg">
                    <p className="text-xs font-medium text-muted-foreground mb-1">دلیل:</p>
                    <p className="text-sm whitespace-pre-wrap">{r.reason}</p>
                  </div>
                )}

                {r.reviewer_notes && r.status === "rejected" && (
                  <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-xs font-medium text-red-700 mb-1 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> دلیل رد:
                    </p>
                    <p className="text-sm text-red-600 whitespace-pre-wrap">{r.reviewer_notes}</p>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-2 pt-3 border-t border-border flex-wrap">
                  {isAdmin && isPending && (
                    <>
                      <button
                        onClick={() => handleApprove(r.id)}
                        className="text-xs bg-green-50 text-green-600 px-3 py-1.5 rounded-lg font-medium hover:bg-green-100 flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" /> تایید
                      </button>
                      <button
                        onClick={() => handleReject(r.id)}
                        className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-lg font-medium hover:bg-red-100 flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" /> رد
                      </button>
                    </>
                  )}
                  {isAdmin ? (
                    <button
                      onClick={() => handleDelete(r)}
                      className="text-xs text-muted-foreground hover:text-red-500 px-3 py-1.5 rounded-lg flex items-center gap-1 mr-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> حذف
                    </button>
                  ) : (
                    isOwner && isPending && (
                      <button
                        onClick={() => handleDelete(r)}
                        className="text-xs text-muted-foreground hover:text-red-500 px-3 py-1.5 rounded-lg flex items-center gap-1 mr-auto"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> حذف
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Admin Calendar Section */}
      {isAdmin && (
        <div className="bg-card rounded-2xl border border-border p-4 sm:p-5 mt-6">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-lg font-bold">تقویم مرخصی‌های تایید شده</h2>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setCalendarMonth((m) => {
                    if (m === 1) { setCalendarYear((y) => y - 1); return 12; }
                    return m - 1;
                  });
                }}
                className="p-2 hover:bg-accent rounded-lg transition-colors"
                aria-label="ماه قبل"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <select
                value={calendarMonth}
                onChange={(e) => setCalendarMonth(parseInt(e.target.value, 10))}
                className="border border-input rounded-xl px-4 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[140px]"
              >
                {persianMonthNames.map((name, idx) => (
                  <option key={idx + 1} value={idx + 1}>{name}</option>
                ))}
              </select>
              <select
                value={calendarYear}
                onChange={(e) => setCalendarYear(parseInt(e.target.value, 10))}
                className="border border-input rounded-xl px-4 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[100px]"
              >
                {Array.from({ length: 5 }, (_, i) => 1401 + i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button
                onClick={() => {
                  setCalendarMonth((m) => {
                    if (m === 12) { setCalendarYear((y) => y + 1); return 1; }
                    return m + 1;
                  });
                }}
                className="p-2 hover:bg-accent rounded-lg transition-colors"
                aria-label="ماه بعد"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="overflow-x-auto">
            <table className="w-full text-center text-sm border-collapse">
              <thead>
                <tr className="border-b border-border">
                  {["ش", "ی", "د", "س", "چ", "پ", "ج"].map((d) => (
                    <th key={d} className="py-2 px-1 font-medium text-muted-foreground text-[11px]">
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: Math.ceil(totalDays / 7) }, (_, weekIdx) => (
                  <tr key={weekIdx}>
                    {Array.from({ length: 7 }, (_, dayIdx) => {
                      const day = weekIdx * 7 + dayIdx + 1;
                      if (day > totalDays) return <td key={`e${dayIdx}`} className="py-3 px-1" />;
                      const leaves = getLeavesForDay(day);
                      const isToday = isCurrentMonth && day === todayDay;
                      return (
                        <td
                          key={day}
                          className={`py-3 px-1 border border-border/50 ${isToday ? "bg-primary/10" : ""}`}
                        >
                          <span className={`font-medium ${isToday ? "text-primary" : "text-foreground"}`}>
                            {day}
                          </span>
                          {leaves.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-0.5 justify-center">
                              {leaves.slice(0, 2).map((l, idx) => (
                                <span
                                  key={idx}
                                  className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full truncate max-w-[32px]"
                                  title={l.user_name}
                                >
                                  {getInitials(l.user_name)}
                                </span>
                              ))}
                              {leaves.length > 2 && (
                                <span className="text-[10px] text-muted-foreground px-1">
                                  +{leaves.length - 2}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-primary/10 border border-primary/30" />
              <span>امروز</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">A</span>
              <span>حاضر در مرخصی</span>
            </div>
          </div>
        </div>
      )}

      {/* Create Request Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-card rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">درخواست مرخصی جدید</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-accent rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1.5">
                  نوع مرخصی <span className="text-primary">*</span>
                </label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="vacation">مرخصی استحقاقی</option>
                  <option value="sick">استعلاجی</option>
                  <option value="personal">شخصی</option>
                  <option value="other">سایر</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <PersianDatePicker
                    label="تاریخ شروع"
                    required
                    value={startDate}
                    onChange={setStartDate}
                    placeholder="انتخاب تاریخ"
                  />
                </div>
                <div>
                  <PersianDatePicker
                    label="تاریخ پایان"
                    required
                    value={endDate}
                    onChange={setEndDate}
                    placeholder="انتخاب تاریخ"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium block mb-1.5">دلیل</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="دلیل درخواست مرخصی..."
                  rows={3}
                  className="w-full border border-input rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              <div className="sticky bottom-0 z-10 -mx-3 sm:-mx-6 mt-5 flex items-center justify-between gap-3 border-t border-border bg-card px-3 py-4 sm:px-6">
                <button onClick={() => setShowModal(false)} className="text-sm text-muted-foreground hover:text-foreground px-4 py-2.5">
                  انصراف
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={saving || !startDate || !endDate}
                  className="bg-primary text-primary-foreground px-8 py-2.5 rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex-1"
                >
                  {saving ? "در حال ثبت..." : "ثبت درخواست"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <ConfirmDialog
          title="حذف درخواست مرخصی"
          description={`درخواست مرخصی "${deleteTarget.user_name}" از ${deleteTarget.start_date} تا ${deleteTarget.end_date} بلافاصله حذف می‌شود. آیا مطمئن هستید؟`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
          confirmText="بله، حذف شود"
        />
      )}
    </div>
  );
}