import { useState } from "react";
import { MODULES } from "@/lib/permissions";
import { X, User, Calendar, Briefcase, BookOpen, CircleDot, Camera } from "lucide-react";
import { studio } from "@/api/studioClient";
import PersianDatePicker from "@/components/PersianDatePicker";
import { toast } from "@/components/ui/use-toast";
import { imageFileToDataUrl } from "@/lib/image-file";
import { useAuth } from "@/lib/AuthContext";

const availabilityOptions = [
  { value: "available", label: "حاضر", color: "bg-green-100 text-green-700" },
  { value: "in_meeting", label: "در جلسه", color: "bg-blue-100 text-blue-700" },
  { value: "on_leave", label: "در مرخصی", color: "bg-amber-100 text-amber-700" },
  { value: "remote", label: "دورکاری", color: "bg-purple-100 text-purple-700" },
];
export const availabilityLabel = (v) => availabilityOptions.find((o) => o.value === v)?.label || "حاضر";
export const availabilityColor = (v) => availabilityOptions.find((o) => o.value === v)?.color || "bg-green-100 text-green-700";

export default function EmployeeProfile({ employee, canEdit, onClose, onSaved }) {
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState({
    full_name: employee.name || "",
    role: employee.role || "user",
    module_access: Array.isArray(employee.module_access)
      ? employee.module_access
      : (employee.role === "admin" || employee.role === "superadmin"
          ? MODULES.map((m) => m.id)
          : MODULES.filter((m) => !m.adminOnly).map((m) => m.id)),
    phone: employee.phone || "",
    profile_image: employee.profile_image || "",
    department: employee.department || "",
    position: employee.position || "",
    hire_date: employee.hire_date || "",
    availability_status: employee.availability_status || "available",
    skills: (employee.skills || []).join(", "),
    bio: employee.bio || "",
  });
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await studio.entities.User.update(employee.id, {
        full_name: form.full_name.trim(),
        role: form.role,
        module_access: form.module_access,
        phone: form.phone.trim(),
        profile_image: form.profile_image,
        department: form.department.trim(),
        position: form.position.trim(),
        hire_date: form.hire_date,
        availability_status: form.availability_status,
        skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
        bio: form.bio.trim(),
      });
      if (employee.id === user?.id && typeof refreshUser === "function") {
        await refreshUser();
      }
      toast({ title: "پروفایل با موفقیت ذخیره شد" });
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message || "ذخیره ناموفق بود");
    }
    setSaving(false);
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setUploadingImage(true);
      const imageData = await imageFileToDataUrl(file, { maxDimension: 800 });
      setForm((current) => ({ ...current, profile_image: imageData }));
      toast({ title: "تصویر بارگذاری شد", description: "برای ثبت نهایی، پروفایل را ذخیره کنید." });
    } catch (err) {
      toast({ title: "آپلود تصویر ناموفق بود", description: err.message || "دوباره تلاش کنید.", variant: "destructive" });
    } finally {
      setUploadingImage(false);
      event.target.value = "";
    }
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
            {form.profile_image ? (
              <img src={form.profile_image} alt={employee.name} className="w-16 h-16 rounded-full object-cover" onError={(ev) => { ev.target.style.display = "none"; }} />
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl">
                {(employee.name || "؟").charAt(0)}
              </div>
            )}
          </div>
          {canEdit && <label className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs cursor-pointer hover:bg-accent">
            <Camera className="h-4 w-4" />{uploadingImage ? "در حال آپلود..." : "تغییر تصویر"}
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
          </label>}
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
              <label className="text-sm font-medium block mb-1.5">نام و نام خانوادگی</label>
              <input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} disabled={!canEdit} className="w-full border border-input rounded-xl px-4 py-2.5 text-sm disabled:opacity-60" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">شماره تماس</label>
              <input type="tel" dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} disabled={!canEdit} className="w-full border border-input rounded-xl px-4 py-2.5 text-sm disabled:opacity-60" />
            </div>
          </div>
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

          {canEdit && (
            <div className="space-y-3 pt-3 border-t border-border">
              <div>
                <label className="text-sm font-medium block mb-1.5">نقش کاربری</label>
                <select
                  value={form.role}
                  onChange={(e) => {
                    const newRole = e.target.value;
                    const defaultMods = newRole === "superadmin" || newRole === "admin"
                      ? MODULES.map((m) => m.id)
                      : MODULES.filter((m) => !m.adminOnly).map((m) => m.id);
                    setForm({ ...form, role: newRole, module_access: defaultMods });
                  }}
                  className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="user">پرسنل (User)</option>
                  <option value="admin">مدیر (Admin)</option>
                  <option value="superadmin">مدیر ارشد (Superadmin)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">دسترسی به بخش‌ها و ساب‌ماژول‌ها</label>
                  <div className="flex gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, module_access: MODULES.map((m) => m.id) })}
                      className="text-primary hover:underline"
                    >
                      انتخاب همه
                    </button>
                    <span className="text-muted-foreground">·</span>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, module_access: ["dashboard"] })}
                      className="text-destructive hover:underline"
                    >
                      حذف همه
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 rounded-xl border border-border bg-accent/20">
                  {MODULES.map((mod) => {
                    const isChecked = (form.module_access || []).includes(mod.id);
                    return (
                      <label
                        key={mod.id}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer select-none transition ${
                          isChecked
                            ? "bg-primary/10 border-primary/40 text-primary font-medium"
                            : "bg-card border-border/70 text-muted-foreground hover:bg-accent/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            const current = form.module_access || [];
                            const updated = current.includes(mod.id)
                              ? current.filter((id) => id !== mod.id)
                              : [...current, mod.id];
                            setForm({ ...form, module_access: updated });
                          }}
                          className="w-3.5 h-3.5 accent-primary cursor-pointer"
                        />
                        <span className="truncate">{mod.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

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
