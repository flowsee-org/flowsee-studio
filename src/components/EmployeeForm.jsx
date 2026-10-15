import { useState } from "react";
import { X, UserPlus, AlertCircle } from "lucide-react";
import { inviteUser } from "@/lib/invite";
import { toast } from "@/components/ui/use-toast";

const roleOptions = [
  { value: "user", label: "پرسنل" },
  { value: "admin", label: "مدیر" },
];

export default function EmployeeForm({ onClose, onSaved, isSuperadmin = false }) {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    role: "user",
    initial_password: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createdCredentials, setCreatedCredentials] = useState(null);

  const handleSave = async () => {
    if (!form.email.trim() || form.initial_password.length < 6) return;
    setSaving(true);
    setError("");
    try {
      const result = await inviteUser({
        userEmail: form.email.trim(),
        role: form.role,
        full_name: form.full_name.trim(),
        initial_password: form.initial_password,
      });
      setCreatedCredentials({ email: form.email.trim(), password: form.initial_password, reactivated: result?.reactivated === true });
      toast({
        title: result?.reactivated ? "حساب قبلی دوباره فعال شد" : "کاربر ساخته شد",
        description: "اطلاعات ورود را از همین پنجره بردارید.",
      });
      setSaving(false);
      onSaved();
    } catch (err) {
      setError(err.message || "ثبت عضو ناموفق بود");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div dir="rtl" className="bg-card rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-xl max-h-[90dvh] overflow-y-auto scrollbar-thin" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" /> افزودن عضو جدید
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {createdCredentials ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-green-900 dark:border-green-900 dark:bg-green-950/30 dark:text-green-200">
              <h3 className="font-semibold">{createdCredentials.reactivated ? "حساب قبلی با موفقیت دوباره فعال شد" : "کاربر با موفقیت ساخته شد"}</h3>
              <p className="mt-1 text-sm">نام کاربری همان ایمیل است. این اطلاعات را امن به کاربر تحویل دهید.</p>
            </div>
            <div className="space-y-3 rounded-xl border border-border p-4 text-sm">
              <p className="flex justify-between gap-4"><span className="text-muted-foreground">نام کاربری</span><b dir="ltr" className="break-all">{createdCredentials.email}</b></p>
              <p className="flex justify-between gap-4"><span className="text-muted-foreground">رمز عبور موقت</span><b dir="ltr">{createdCredentials.password}</b></p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={async () => {
                try {
                  await navigator.clipboard.writeText(`نام کاربری: ${createdCredentials.email}\nرمز عبور: ${createdCredentials.password}`);
                  toast({ title: "اطلاعات ورود کپی شد" });
                } catch {
                  toast({ title: "کپی خودکار در دسترس نیست", description: "اطلاعات را به‌صورت دستی کپی کنید.", variant: "destructive" });
                }
              }} className="flex-1 rounded-xl bg-primary px-4 py-3 font-medium text-primary-foreground">کپی اطلاعات ورود</button>
              <button type="button" onClick={onClose} className="rounded-xl border border-border px-5 py-3">بستن</button>
            </div>
          </div>
        ) : <>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">نام و نام خانوادگی</label>
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="مثلاً سارا احمدی"
              className="w-full border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">
              ایمیل <span className="text-primary">*</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="member@example.com"
              dir="ltr"
              className="w-full border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">نقش / سمت</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {roleOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
              {isSuperadmin && <option value="superadmin">مدیرعامل</option>}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">
              رمز عبور موقت <span className="text-primary">*</span>
            </label>
            <input
              type="password"
              value={form.initial_password}
              onChange={(e) => setForm({ ...form, initial_password: e.target.value })}
              placeholder="حداقل ۶ نویسه"
              minLength={6}
              autoComplete="new-password"
              className="w-full border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              برای ساخت حساب، رمز موقت حداقل ۶ نویسه‌ای وارد کنید.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !form.email.trim() || form.initial_password.length < 6}
          className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-medium mt-5 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? "در حال ساخت..." : "ساخت کاربر"}
        </button>
        </>}
      </div>
    </div>
  );
}
