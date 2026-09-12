import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { CheckCircle2, Circle, AlertTriangle, UserPlus, BookOpen, Shield, Calendar, MessageSquare, FileText, Settings } from "lucide-react";

const defaultOnboardingItems = [
  { id: "profile", label: "تکمیل پروفایل شخصی", icon: UserPlus, description: "نام، عکس، دپارتمان، مهارت‌ها" },
  { id: "read_rules", label: "مطالعه راهنمای شرکت", icon: BookOpen, description: "قوانین، سیاست‌ها و دستورالعمل‌ها" },
  { id: "meet_manager", label: "جلسه آشنایی با مدیر", icon: UserPlus, description: "معرفی تیم و وظایف" },
  { id: "setup_tools", label: "راه‌اندازی ابزارهای کاری", icon: Settings, description: "ایمیل، تقویم، دسترسی‌های پروژه" },
  { id: "first_task", label: "انجام اولین تسک", icon: FileText, description: "تسک اول را در حالت انجام شده بگذارید" },
  { id: "first_report", label: "ارائه اولین گزارش کار", icon: MessageSquare, description: "گزارش فعالیت روزانه/هفتگی" },
  { id: "security", label: "تنظیمات امنیتی", icon: Shield, description: "تغییر رمز، احراز هویت دو مرحله‌ای" },
  { id: "calendar", label: "بررسی تقویم جلسات", icon: Calendar, description: "جلسات منظم تیم وCompany" },
];

export default function OnboardingChecklist({ user, isAdmin = false, onComplete }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [user?.id]);

  const load = async () => {
    if (!user?.id) { setLoading(false); return; }
    try {
      const u = await base44.entities.User.get(user.id);
      const progress = u?.onboarding_progress || [];
      const merged = defaultOnboardingItems.map((item) => ({
        ...item,
        done: progress.includes(item.id),
      }));
      setItems(merged);
    } catch {
      setItems(defaultOnboardingItems.map((item) => ({ ...item, done: false })));
    }
    setLoading(false);
  };

  const toggle = async (id) => {
    if (!user?.id) return;
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const newDone = !item.done;
    const current = items.filter((i) => i.done).map((i) => i.id);
    const next = newDone ? [...current, id] : current.filter((i) => i !== id);
    try {
      await base44.entities.User.update(user.id, { onboarding_progress: next });
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, done: newDone } : i)));
      if (newDone && next.length === defaultOnboardingItems.length) {
        onComplete?.();
      }
    } catch (err) {
      console.error("Failed to update onboarding:", err);
    }
  };

  const doneCount = items.filter((i) => i.done).length;
  const totalCount = items.length;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  if (loading) return <div className="flex justify-center p-8"><div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" /> چک‌لیست آنبوردینگ
        </h2>
        <div className="text-sm font-medium text-primary">{progressPct}٪</div>
      </div>
      <div className="h-2 bg-accent rounded-full overflow-hidden mb-4">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progressPct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground mb-4">{doneCount} از {totalCount} مرحله کامل شده</p>
      <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => toggle(item.id)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
              item.done ? "bg-green-50 border border-green-200" : "bg-accent/30 hover:bg-accent/50 border border-transparent"
            }`}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${
              item.done ? "bg-green-500" : "border-2 border-primary/30"
            }`}>
              {item.done ? (
                <CheckCircle2 className="w-4 h-4 text-white" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-primary" />
              )}
            </div>
            <div className="flex-1 text-right">
              <div className="flex items-center gap-2">
                <item.icon className={`w-4 h-4 ${item.done ? "text-green-500" : "text-muted-foreground"}`} />
                <span className={`font-medium text-sm ${item.done ? "text-green-700 line-through" : "text-foreground"}`}>
                  {item.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 mr-6">{item.description}</p>
            </div>
            {!isAdmin && !item.done && (
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" title="مرحله در انتظار انجام" />
            )}
          </button>
        ))}
      </div>
      {progressPct === 100 && (
        <div className="mt-4 p-3 rounded-lg bg-green-50 border border-green-200 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
          <span className="text-sm text-green-700">آفرین! تمام مراحل آنبوردینگ کامل شد.</span>
        </div>
      )}
    </div>
  );
}