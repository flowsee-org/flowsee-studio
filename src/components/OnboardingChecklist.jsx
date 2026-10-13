import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { CheckCircle2, Circle, AlertTriangle, UserPlus, BookOpen, Shield, Calendar, MessageSquare, FileText, Settings } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { getOnboardingCompletedItems } from "@/lib/onboarding-progress";

const manualItems = new Set(["read_rules", "setup_tools", "security", "calendar"]);
const defaultOnboardingItems = [
  { id: "profile", label: "تکمیل پروفایل شخصی", icon: UserPlus, description: "نام، عکس، دپارتمان و مهارت‌ها", kind: "profile" },
  { id: "read_rules", label: "مطالعه راهنمای شرکت", icon: BookOpen, description: "پس از مطالعه راهنما، انجام مرحله را تأیید کنید.", kind: "manual" },
  { id: "meet_manager", label: "جلسه آشنایی با مدیر", icon: UserPlus, description: "پس از ثبت جلسه در پنل و نهایی‌شدن آن، خودکار تکمیل می‌شود.", kind: "meeting" },
  { id: "setup_tools", label: "راه‌اندازی ابزارهای کاری", icon: Settings, description: "ایمیل، تقویم و دسترسی‌های پروژه", kind: "manual" },
  { id: "first_task", label: "انجام اولین تسک", icon: FileText, description: "با تکمیل اولین تسک محول‌شده، خودکار تیک می‌خورد.", kind: "task" },
  { id: "first_report", label: "ارائه اولین گزارش کار", icon: MessageSquare, description: "با ثبت اولین گزارش کار، خودکار تیک می‌خورد.", kind: "report" },
  { id: "security", label: "تنظیمات امنیتی", icon: Shield, description: "پس از بررسی تنظیمات امنیتی، انجام مرحله را تأیید کنید.", kind: "manual" },
  { id: "calendar", label: "بررسی تقویم جلسات", icon: Calendar, description: "پس از بررسی تقویم، انجام مرحله را تأیید کنید.", kind: "manual" },
];

export default function OnboardingChecklist({ user, isAdmin = false, onComplete }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!user?.id) { setItems([]); setLoading(false); return; }
      setLoading(true);
      try {
        const [profile, tasks, reports, meetings] = await Promise.all([
          base44.entities.User.get(user.id),
          base44.entities.Task.list("-created_date"),
          base44.entities.WorkReport.list("-created_date"),
          base44.entities.Meeting.list("-created_date"),
        ]);
        const completed = getOnboardingCompletedItems({ profile, tasks, reports, meetings, user });
        const storedManualProgress = new Set((profile?.onboarding_confirmations || []).filter((id) => manualItems.has(id)));
        const nextItems = defaultOnboardingItems.map((item) => ({
          ...item,
          done: item.kind === "manual" ? storedManualProgress.has(item.id) : completed.has(item.id),
        }));
        if (active) setItems(nextItems);
      } catch (error) {
        console.error("Failed to load onboarding evidence:", error);
        if (active) {
          setItems(defaultOnboardingItems.map((item) => ({ ...item, done: false })));
          toast({ title: "وضعیت آنبوردینگ بارگیری نشد", description: "برای جلوگیری از نمایش تیک نادرست، مراحل تا دریافت اطلاعات تکمیل‌شده نشان داده نمی‌شوند.", variant: "destructive" });
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [user?.id]);

  const confirmManualStep = async (item) => {
    if (!user?.id || item.kind !== "manual") return;
    const nextDone = !item.done;
    const nextProgress = items
      .filter((current) => current.kind === "manual" && (current.id === item.id ? nextDone : current.done))
      .map((current) => current.id);
    try {
      await base44.entities.User.update(user.id, { onboarding_confirmations: nextProgress });
      setItems((previous) => previous.map((current) => current.id === item.id ? { ...current, done: nextDone } : current));
      if (nextDone && items.every((current) => current.done || current.id === item.id)) onComplete?.();
    } catch (error) {
      toast({ title: "تأیید مرحله ذخیره نشد", description: error.message || "دوباره تلاش کنید.", variant: "destructive" });
    }
  };

  const doneCount = items.filter((item) => item.done).length;
  const totalCount = items.length;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  if (loading) return <div className="flex justify-center p-8"><div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-lg flex items-center gap-2"><BookOpen className="w-5 h-5 text-primary" /> چک‌لیست آنبوردینگ</h2>
        <div className="text-sm font-medium text-primary">{progressPct}٪</div>
      </div>
      <div className="h-2 bg-accent rounded-full overflow-hidden mb-4"><div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progressPct}%` }} /></div>
      <p className="text-xs text-muted-foreground mb-4">{doneCount} از {totalCount} مرحله کامل شده؛ تسک، گزارش، جلسه و پروفایل از اطلاعات ثبت‌شده در پنل بررسی می‌شوند.</p>
      <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
        {items.map((item) => {
          const content = (
            <>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${item.done ? "bg-green-500" : "border-2 border-primary/30"}`}>
                {item.done ? <CheckCircle2 className="w-4 h-4 text-white" /> : <Circle className="w-3.5 h-3.5 text-primary" />}
              </div>
              <div className="flex-1 text-right">
                <div className="flex items-center gap-2">
                  <item.icon className={`w-4 h-4 ${item.done ? "text-green-500" : "text-muted-foreground"}`} />
                  <span className={`font-medium text-sm ${item.done ? "text-green-700" : "text-foreground"}`}>{item.label}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 mr-6">{item.description}</p>
              </div>
              {item.kind === "manual" && <span className="text-xs text-primary shrink-0">{item.done ? "لغو تأیید" : "تأیید انجام"}</span>}
              {!isAdmin && !item.done && item.kind !== "manual" && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" title="در انتظار تکمیل واقعی" />}
            </>
          );
          const className = `w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${item.done ? "bg-green-50 border border-green-200" : "bg-accent/30 border border-transparent"} ${item.kind === "manual" ? "hover:bg-accent/50" : "cursor-default"}`;
          return item.kind === "manual" ? <button key={item.id} type="button" onClick={() => confirmManualStep(item)} className={className}>{content}</button> : <div key={item.id} className={className}>{content}</div>;
        })}
      </div>
      {progressPct === 100 && <div className="mt-4 p-3 rounded-lg bg-green-50 border border-green-200 flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" /><span className="text-sm text-green-700">آفرین! تمام مراحل آنبوردینگ کامل شد.</span></div>}
    </div>
  );
}
