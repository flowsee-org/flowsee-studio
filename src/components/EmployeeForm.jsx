import { useState } from "react";
import { X, UserPlus, AlertCircle } from "lucide-react";
import { inviteUser } from "@/lib/invite";
import { toast } from "@/components/ui/use-toast";

const roleOptions = [
  { value: "user", label: "پرسنل" },
  { value: "admin", label: "مدیر" },
  { value: "superadmin", label: "مدیرعامل" },
];

export default function EmployeeForm({ onClose, onSaved }) {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    role: "user",
    initial_password: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!form.email.trim()) return;
    setSaving(true);
    setError("");
    try {
      await inviteUser({
        userEmail: form.email.trim(),
        role: form.role,
        full_name: form.full_name.trim(),
        initial_password: form.initial_password,
      });
      toast({
        title: "عضو اضافه شد",
        description: form.initial_password
          ? `رمز موقت: ${form.initial_password}`
          : "عضو با موفقیت دعوت شد.",
      });
      setSaving(false);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || "ثبت عضو ناموفق بود");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-xl max-h-[90vh] overflow-y-auto scrollbar-thin" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" /> افزودن عضو جدید
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

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
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">
              رمز عبور موقت <span className="text-xs text-muted-foreground">(اختیاری)</span>
            </label>
            <input
              type="text"
              value={form.initial_password}
              onChange={(e) => setForm({ ...form, initial_password: e.target.value })}
              placeholder="مثلاً 12345678"
              className="w-full border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              اگر خالی بماند، عضو بعداً می‌تواند با «فراموشی رمز» وارد شود.
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
          disabled={saving || !form.email.trim()}
          className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-medium mt-5 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? "در حال ثبت..." : "افزودن عضو"}
        </button>
      </div>
    </div>
  );
}