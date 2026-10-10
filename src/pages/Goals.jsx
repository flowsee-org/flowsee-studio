import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { loadTeamMembers } from "@/lib/teamMembers";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useDeleteUndo } from "@/hooks/useDeleteUndo.jsx";
import { Plus, Target, Pencil, Trash2, TrendingUp, AlertTriangle, CheckCircle2, Minus } from "lucide-react";

const statusLabels = {
  on_track: "در مسیر",
  at_risk: "در خطر",
  behind: "عقب",
  completed: "تکمیل شده",
};

const statusStyles = {
  on_track: "bg-green-100 text-green-700",
  at_risk: "bg-amber-100 text-amber-700",
  behind: "bg-red-100 text-red-700",
  completed: "bg-gray-100 text-gray-600",
};

const statusIcons = {
  on_track: TrendingUp,
  at_risk: AlertTriangle,
  behind: Minus,
  completed: CheckCircle2,
};

const quarterLabels = [
  "بهار",
  "تابستان",
  "پاییز",
  "زمستان",
];

const CURRENT_YEAR = 1405; // Iranian calendar year (approx 2026-2027)

function calcProgress(keyResults) {
  if (!keyResults || keyResults.length === 0) return 0;
  const total = keyResults.reduce((sum, kr) => {
    const target = Number(kr.target) || 1;
    const current = Number(kr.current) || 0;
    return sum + Math.min(current / target, 1);
  }, 0);
  return Math.round((total / keyResults.length) * 100);
}

function emptyGoal() {
  return {
    title: "",
    description: "",
    owner: "",
    quarter: "پاییز",
    year: CURRENT_YEAR,
    status: "on_track",
    key_results: [{ title: "", target: 1, current: 0, unit: "" }],
  };
}

export default function Goals() {
  const { isAdmin } = useAuth();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editGoal, setEditGoal] = useState(null);
  const [form, setForm] = useState(emptyGoal());
  const [teamMembers, setTeamMembers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    load();
    loadMembers();
    const unsubscribe = base44.entities.Goal.subscribe(() => load());
    return unsubscribe;
  }, []);

  const load = async () => {
    try {
      const data = await base44.entities.Goal.list("-created_date");
      setGoals(data);
    } catch (err) {
      console.error("Failed to load goals:", err);
    }
    setLoading(false);
  };

  const { deleteWithUndo } = useDeleteUndo("Goal", (id) => base44.entities.Goal.delete(id), load);

  const loadMembers = async () => {
    const members = await loadTeamMembers();
    setTeamMembers(members);
  };

  // ---- CRUD ----

  const openCreate = () => {
    setEditGoal(null);
    setForm(emptyGoal());
    setShowModal(true);
  };

  const openEdit = (g) => {
    setEditGoal(g);
    setForm({
      title: g.title || "",
      description: g.description || "",
      owner: g.owner || "",
      quarter: g.quarter || "پاییز",
      year: g.year || CURRENT_YEAR,
      status: g.status || "on_track",
      key_results: (g.key_results && g.key_results.length > 0
        ? g.key_results
        : [{ title: "", target: 1, current: 0, unit: "" }]
      ).map((kr) => ({ ...kr })),
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const data = {
      ...form,
      key_results: (form.key_results || []).filter(
        (kr) => kr.title.trim() !== "" || Number(kr.target) > 0
      ),
    };
    if (editGoal) {
      await base44.entities.Goal.update(editGoal.id, data);
    } else {
      await base44.entities.Goal.create(data);
    }
    setSaving(false);
    setShowModal(false);
    setEditGoal(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteWithUndo(deleteTarget);
    load();
    setDeleteTarget(null);
  };

  const updateKRField = (index, field, value) => {
    const next = { ...form, key_results: [...(form.key_results || [])] };
    next.key_results[index] = { ...next.key_results[index], [field]: value };
    setForm(next);
  };

  const addKR = () => {
    setForm({
      ...form,
      key_results: [
        ...(form.key_results || []),
        { title: "", target: 1, current: 0, unit: "" },
      ],
    });
  };

  const removeKR = (index) => {
    const next = { ...form, key_results: [...(form.key_results || [])] };
    next.key_results.splice(index, 1);
    if (next.key_results.length === 0) {
      next.key_results.push({ title: "", target: 1, current: 0, unit: "" });
    }
    setForm(next);
  };

  const updateInlineKR = async (goal, krIndex, newCurrent) => {
    const krs = (goal.key_results || []).map((kr, i) =>
      i === krIndex ? { ...kr, current: Number(newCurrent) || 0 } : kr
    );
    await base44.entities.Goal.update(goal.id, { key_results: krs });
  };

  // ---- Derived data ----

  const total = goals.length;
  const onTrack = goals.filter((g) => g.status === "on_track").length;
  const atRisk = goals.filter((g) => g.status === "at_risk").length;
  const completed = goals.filter((g) => g.status === "completed").length;

  // ---- Render ----

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
          <h1 className="text-2xl font-bold">اهداف و OKR</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            پیگیری اهداف و نتایج کلیدی تیم
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={openCreate}
            className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <Plus className="w-5 h-5" /> هدف جدید
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-card rounded-2xl p-4 sm:p-6 border border-border">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3 sm:mb-4">
            <Target className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">کل اهداف</p>
          <p className="text-base sm:text-2xl font-bold mt-1">{total}</p>
        </div>
        <div className="bg-card rounded-2xl p-4 sm:p-6 border border-border">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-green-100 text-green-600 flex items-center justify-center mb-3 sm:mb-4">
            <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">در مسیر</p>
          <p className="text-base sm:text-2xl font-bold mt-1">{onTrack}</p>
        </div>
        <div className="bg-card rounded-2xl p-4 sm:p-6 border border-border">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center mb-3 sm:mb-4">
            <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">در خطر</p>
          <p className="text-base sm:text-2xl font-bold mt-1">{atRisk}</p>
        </div>
        <div className="bg-card rounded-2xl p-4 sm:p-6 border border-border">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center mb-3 sm:mb-4">
            <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">تکمیل شده</p>
          <p className="text-base sm:text-2xl font-bold mt-1">{completed}</p>
        </div>
      </div>

      {/* Empty state */}
      {goals.length === 0 && (
        <div className="bg-card rounded-2xl border border-border p-12 text-center">
          <Target className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">هنوز هدفی ثبت نشده است</p>
        </div>
      )}

      {/* Goals grid */}
      {goals.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {goals.map((g) => {
            const progress = calcProgress(g.key_results);
            const StatusIcon = statusIcons[g.status] || TrendingUp;
            return (
              <div
                key={g.id}
                className="bg-card rounded-2xl border border-border p-5 hover:shadow-md transition-shadow"
              >
                {/* Top row: title + badge */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-base truncate">{g.title}</h3>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                        {g.quarter} {g.year}
                      </span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1 ${statusStyles[g.status]}`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {statusLabels[g.status]}
                      </span>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => openEdit(g)}
                        className="p-1.5 text-muted-foreground hover:text-primary rounded-lg hover:bg-primary/5"
                        title="ویرایش"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(g)}
                        className="p-1.5 text-muted-foreground hover:text-red-500 rounded-lg hover:bg-red-50"
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Owner */}
                {g.owner && (
                  <p className="text-xs text-muted-foreground mb-3">
                    مسئول: <span className="font-medium text-foreground">{g.owner}</span>
                  </p>
                )}

                {/* Description */}
                {g.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {g.description}
                  </p>
                )}

                {/* Overall progress */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">پیشرفت کلی</span>
                    <span className="font-bold text-primary">{progress}%</span>
                  </div>
                  <div className="h-2.5 bg-accent rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 bg-primary"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Key results */}
                {g.key_results && g.key_results.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      نتایج کلیدی:
                    </p>
                    {g.key_results.map((kr, idx) => {
                      const krProgress =
                        Number(kr.target) > 0
                          ? Math.round((Math.min(Number(kr.current) || 0, Number(kr.target)) / Number(kr.target)) * 100)
                          : 0;
                      return (
                        <div
                          key={idx}
                          className="bg-accent/50 rounded-xl px-3 py-2.5"
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="text-sm font-medium truncate flex-1">
                              {kr.title || `نتیجه ${idx + 1}`}
                            </span>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {krProgress}%
                            </span>
                          </div>
                          <div className="h-1.5 bg-accent rounded-full overflow-hidden mb-2">
                            <div
                              className="h-full rounded-full bg-primary/70 transition-all"
                              style={{ width: `${krProgress}%` }}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            {isAdmin ? (
                              <input
                                type="number"
                                value={kr.current ?? 0}
                                onChange={(e) => {
                                  // optimistic UI update in state
                                  const next = [...(g.key_results || [])];
                                  next[idx] = { ...next[idx], current: Number(e.target.value) || 0 };
                                  setGoals((prev) =>
                                    prev.map((goal) =>
                                      goal.id === g.id ? { ...goal, key_results: next } : goal
                                    )
                                  );
                                }}
                                onBlur={() => updateInlineKR(g, idx, g.key_results?.[idx]?.current)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.target.blur();
                                  }
                                }}
                                className="w-20 border border-input rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-primary/30 bg-card"
                              />
                            ) : (
                              <span className="text-xs font-medium bg-card px-2 py-1 rounded-lg border border-border">
                                {kr.current ?? 0}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              از {kr.target} {kr.unit}
                            </span>
                          </div>
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

      {/* Create/Edit Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-card rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-xl max-h-[90vh] overflow-y-auto scrollbar-thin"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-bold text-lg mb-5">
              {editGoal ? "ویرایش هدف" : "هدف جدید"}
            </h2>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="text-sm font-medium block mb-1.5">
                  عنوان هدف <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="مثلاً: افزایش رضایت مشتری"
                  className="w-full border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-medium block mb-1.5">
                  توضیحات
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="توضیحات مختصر درباره هدف..."
                  rows={3}
                  className="w-full border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>

              {/* Owner (datalist) */}
              <div>
                <label className="text-sm font-medium block mb-1.5">
                  مسئول
                </label>
                <input
                  type="text"
                  value={form.owner}
                  onChange={(e) => setForm({ ...form, owner: e.target.value })}
                  placeholder="نام مسئول هدف"
                  list="goal-owners"
                  className="w-full border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <datalist id="goal-owners">
                  {teamMembers.map((m) => (
                    <option key={m.id || m.name} value={m.name} />
                  ))}
                </datalist>
              </div>

              {/* Quarter + Year */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5">
                    فصل
                  </label>
                  <select
                    value={form.quarter}
                    onChange={(e) =>
                      setForm({ ...form, quarter: e.target.value })
                    }
                    className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {quarterLabels.map((q) => (
                      <option key={q} value={q}>
                        {q}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">
                    سال
                  </label>
                  <input
                    type="number"
                    value={form.year}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        year: parseInt(e.target.value) || CURRENT_YEAR,
                      })
                    }
                    className="w-full border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="text-sm font-medium block mb-1.5">
                  وضعیت
                </label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value })
                  }
                  className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {Object.entries(statusLabels).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Key Results */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">
                    نتایج کلیدی
                  </label>
                  <button
                    type="button"
                    onClick={addKR}
                    className="text-xs text-primary font-medium flex items-center gap-1 hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" /> افزودن نتیجه
                  </button>
                </div>
                <div className="space-y-3">
                  {(form.key_results || []).map((kr, idx) => (
                    <div
                      key={idx}
                      className="bg-accent/50 rounded-xl p-3 space-y-2 relative"
                    >
                      {(form.key_results || []).length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeKR(idx)}
                          className="absolute top-2 left-2 text-muted-foreground hover:text-red-500 p-1 rounded"
                          title="حذف این نتیجه"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <div>
                        <input
                          type="text"
                          value={kr.title}
                          onChange={(e) =>
                            updateKRField(idx, "title", e.target.value)
                          }
                          placeholder="عنوان نتیجه کلیدی"
                          className="w-full border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-card"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="number"
                          value={kr.target}
                          onChange={(e) =>
                            updateKRField(
                              idx,
                              "target",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          placeholder="هدف"
                          className="border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-card"
                        />
                        <input
                          type="number"
                          value={kr.current}
                          onChange={(e) =>
                            updateKRField(
                              idx,
                              "current",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          placeholder="فعلی"
                          className="border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-card"
                        />
                        <input
                          type="text"
                          value={kr.unit}
                          onChange={(e) =>
                            updateKRField(idx, "unit", e.target.value)
                          }
                          placeholder="واحد (مورد)"
                          className="border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-card"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={handleSave}
                disabled={saving || !form.title.trim()}
                className="flex-1 bg-primary text-primary-foreground py-3 rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving
                  ? "در حال ذخیره..."
                  : editGoal
                  ? "ذخیره تغییرات"
                  : "ثبت هدف"}
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="px-5 py-3 text-sm text-muted-foreground border border-border rounded-xl hover:bg-accent transition-colors"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <ConfirmDialog
          title="حذف هدف"
          description={`هدف "${deleteTarget.title}" بلافاصله حذف می‌شود. آیا مطمئن هستید؟`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          confirmText="بله، حذف شود"
        />
      )}
    </div>
  );
}
