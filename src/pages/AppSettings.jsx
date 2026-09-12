import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import { Settings, Upload, Image, Clock, Globe, Building, Coins, Lock } from "lucide-react";

const DEFAULTS = {
  company_name: "",
  company_logo: "",
  timezone: "Asia/Tehran",
  working_hours_start: "09:00",
  working_hours_end: "17:00",
  fiscal_year_start: 1,
  currency: "تومان",
};

const months = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];

export default function AppSettings() {
  const { isSuperadmin } = useAuth();
  const [settings, setSettings] = useState({ ...DEFAULTS });
  const [existingId, setExistingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const all = await base44.entities.AppSettings.list();
      if (all && all.length > 0) {
        const doc = all[0];
        setExistingId(doc.id);
        setSettings({
          company_name: doc.company_name || "",
          company_logo: doc.company_logo || "",
          timezone: doc.timezone || "Asia/Tehran",
          working_hours_start: doc.working_hours_start || "09:00",
          working_hours_end: doc.working_hours_end || "17:00",
          fiscal_year_start: doc.fiscal_year_start || 1,
          currency: doc.currency || "تومان",
        });
      } else {
        setExistingId(null);
        setSettings({ ...DEFAULTS });
      }
    } catch (err) {
      console.error(err);
      setSettings({ ...DEFAULTS });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setSettings((s) => ({ ...s, company_logo: file_url }));
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const data = { ...settings };
      if (existingId) {
        await base44.entities.AppSettings.update(existingId, data);
      } else {
        await base44.entities.AppSettings.create(data);
      }
      toast({ title: "ذخیره شد", description: "تنظیمات شرکت با موفقیت بروزرسانی گردید" });
      await loadSettings();
    } catch (err) {
      toast({
        title: "خطا",
        description: err.message || "ذخیره تنظیمات ناموفق بود",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field, value) => setSettings((s) => ({ ...s, [field]: value }));

  if (loading) {
    return (
      <div className="flex justify-center p-20">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!isSuperadmin) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">تنظیمات شرکت</h1>
          <p className="text-muted-foreground mt-1 text-sm">مدیریت تنظیمات عمومی سازمان</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-8 sm:p-12 text-center">
          <Lock className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-lg font-medium mb-2">فقط مدیرعامل</p>
          <p className="text-muted-foreground text-sm">دسترسی به تنظیمات شرکت فقط برای مدیرعامل (سوپرادمین) فعال است.</p>
        </div>
      </div>
    );
  }

  const FieldRow = ({ label, icon: Icon, children }) => (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {Icon && <Icon className="w-4 h-4" />} {label}
      </label>
      {children}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">تنظیمات شرکت</h1>
        <p className="text-muted-foreground mt-1 text-sm">مدیریت تنظیمات عمومی سازمان</p>
      </div>

      <div className="bg-card rounded-2xl border border-border p-5 sm:p-6 space-y-5">
        {/* Company Name */}
        <FieldRow label="نام شرکت" icon={Building}>
          <input
            type="text"
            value={settings.company_name}
            onChange={(e) => updateField("company_name", e.target.value)}
            placeholder="نام شرکت را وارد کنید"
            className="w-full border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </FieldRow>

        {/* Company Logo */}
        <FieldRow label="لوگوی شرکت" icon={Image}>
          <div className="space-y-3">
            <input
              type="text"
              value={settings.company_logo}
              onChange={(e) => updateField("company_logo", e.target.value)}
              placeholder="آدرس تصویر لوگو"
              className="w-full border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-xl text-sm font-medium cursor-pointer hover:bg-primary/20 transition-colors">
                <Upload className="w-4 h-4" />
                {uploading ? "در حال بارگذاری..." : "بارگذاری تصویر"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
              {settings.company_logo && (
                <div className="flex items-center gap-2">
                  <img
                    src={settings.company_logo}
                    alt="پیش‌نمایش لوگو"
                    className="w-10 h-10 rounded-lg object-cover border border-border"
                    onError={(e) => { e.target.style.display = "none"; }}
                  />
                  <button
                    onClick={() => updateField("company_logo", "")}
                    className="text-xs text-muted-foreground hover:text-red-500"
                  >
                    حذف
                  </button>
                </div>
              )}
            </div>
          </div>
        </FieldRow>

        {/* Timezone */}
        <FieldRow label="منطقه زمانی" icon={Globe}>
          <input
            type="text"
            value={settings.timezone}
            onChange={(e) => updateField("timezone", e.target.value)}
            placeholder="Asia/Tehran"
            dir="ltr"
            className="w-full border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-left"
          />
        </FieldRow>

        {/* Working Hours */}
        <FieldRow label="ساعات کاری" icon={Clock}>
          <div className="flex items-center gap-3">
            <div className="flex-1 space-y-1">
              <span className="text-xs text-muted-foreground">شروع</span>
              <input
                type="time"
                value={settings.working_hours_start}
                onChange={(e) => updateField("working_hours_start", e.target.value)}
                dir="ltr"
                className="w-full border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <span className="text-muted-foreground mt-5">تا</span>
            <div className="flex-1 space-y-1">
              <span className="text-xs text-muted-foreground">پایان</span>
              <input
                type="time"
                value={settings.working_hours_end}
                onChange={(e) => updateField("working_hours_end", e.target.value)}
                dir="ltr"
                className="w-full border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
        </FieldRow>

        {/* Fiscal Year Start */}
        <FieldRow label="ماه شروع سال مالی" icon={Coins}>
          <select
            value={settings.fiscal_year_start}
            onChange={(e) => updateField("fiscal_year_start", Number(e.target.value))}
            className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {months.map((m, i) => (
              <option key={i + 1} value={i + 1}>
                {m} ({i + 1})
              </option>
            ))}
          </select>
        </FieldRow>

        {/* Currency */}
        <FieldRow label="واحد پول" icon={Coins}>
          <input
            type="text"
            value={settings.currency}
            onChange={(e) => updateField("currency", e.target.value)}
            placeholder="تومان"
            className="w-full border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </FieldRow>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Settings className="w-4 h-4" />
          {saving ? "در حال ذخیره..." : "ذخیره تنظیمات"}
        </button>
      </div>
    </div>
  );
}
