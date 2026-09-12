import { useState } from "react";
import { X, User, Calendar, Briefcase, BookOpen, CircleDot } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PersianDatePicker from "@/components/PersianDatePicker";

const availabilityOptions = [
  { value: "available", label: "حاضر", color: "bg-green-100 text-green-700" },
  { value: "in_meeting", label: "در جلسه", color: "bg-blue-100 text-blue-700" },
  { value: "on_leave", label: "در مرخصی", color: "bg-amber-100 text-amber-700" },
  { value: "remote", label: "دورکاری", color: "bg-purple-100 text-purple-700" },
];
export const availabilityLabel = (v) => availabilityOptions.find((o) => o.value === v)?.label || "حاضر";
export const availabilityColor = (v) => availabilityOptions.find((o) => o.value === v)?.color || "bg-green-100 text-green-700";

export default function EmployeeProfile({ employee, canEdit, onClose, onSaved }) {
  const [form, setForm] = useState({
    department: employee.department || "",
    position: employee.position || "",
    hire_date: employee.hire_date || "",
    availability_status: employee.availability_status || "available",
    skills: (employee.skills || []).join(", "),
    bio: employee.bio || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await base44.entities.User.update(employee.id, {
        department: form.department.trim(),
        position: form.position.trim(),
        hire_date: form.hire_date,
        availability_status: form.availability_status,
        skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
        bio: form.bio.trim(),
      });
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message || "ذخیره ناموفق بود");
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-xl max-h-[90vh] overflow-y-auto scrollbar-thin" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <User className="w-5 h-5 text-primary" /> پروفایل
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-4 mb-5">
          <div className="relative w-16 h-16 rounded-full shrink-0">
            {employee.profile_image ? (
              <img src={employee.profile_image} alt={employee.name} className="w-16 h-16 rounded-full object-cover" onError={(ev) => { ev.target.style.display = "none"; }} />
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl">
                {(employee.name || "؟").charAt(0)}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-lg truncate">{employee.name}</p>
            <p className="text-sm text-muted-foreground truncate" dir="ltr">{employee.email}</p>
            <span className={`inline-block text-xs px-2.5 py-0.5 rounded-full mt-1.5 ${availabilityColor(form.availability_status)}`}>
              <CircleDot className="w-3 h-3 inline -mt-0.5 ml-0.5" /> {availabilityLabel(form.availability_status)}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1.5 flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-muted-foreground" /> دپارتمان
              </label>
              <input
                type="text"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                placeholder="مثلاً فنی"
                disabled={!canEdit}
                className="w-full border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5 flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-muted-foreground" /> سمت شغلی
              </label>
              <input
                type="text"
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
                placeholder="مثلاً توسعه‌دهنده"
                disabled={!canEdit}
                className="w-full border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-muted-foreground" /> تاریخ استخدام
              </label>
              {canEdit ? (
                <PersianDatePicker
                  label=""
                  value={form.hire_date}
                  onChange={(v) => setForm({ ...form, hire_date: v })}
                  placeholder="تاریخ استخدام"
                />
              ) : (
                <p className="border border-input rounded-xl px-4 py-2.5 text-sm">{form.hire_date || "—"}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5 flex items-center gap-1.5">
                <CircleDot className="w-4 h-4 text-muted-foreground" /> وضعیت حضور
              </label>
              <select
                value={form.availability_status}
                onChange={(e) => setForm({ ...form, availability_status: e.target.value })}
                disabled={!canEdit}
                className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
              >
                {availabilityOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-muted-foreground" /> مهارت‌ها
            </label>
            <input
              type="text"
              value={form.skills}
              onChange={(e) => setForm({ ...form, skills: e.target.value })}
              placeholder="با کاما جدا کنید: React, Node, طراحی"
              disabled={!canEdit}
              className="w-full border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
            />
            <p className="text-xs text-muted-foreground mt-1.5">مهارت‌ها را با « , » از هم جدا کنید.</p>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">درباره من</label>
            <textarea
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              rows={3}
              disabled={!canEdit}
              placeholder="خلاصه‌ای از سوابق و مسئولیت‌ها..."
              className="w-full border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none disabled:opacity-60"
            />
          </div>

          {!canEdit && (
            <p className="text-xs text-muted-foreground bg-accent/40 rounded-lg px-3 py-2">
              ویرایش پروفایل توسط مدیر انجام می‌شود.
            </p>
          )}
          {error && <p className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</p>}
        </div>

        {canEdit && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-medium mt-5 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? "در حال ذخیره..." : "ذخیره پروفایل"}
          </button>
        )}
      </div>
    </div>
  );
}