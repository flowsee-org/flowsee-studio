import { useEffect, useState } from "react";
import { studio } from "@/api/studioClient";
import { useAuth } from "@/lib/AuthContext";
import { useNavigate } from "react-router-dom";
import { Users, User, FolderKanban, Calendar, Plus } from "lucide-react";
import { formatPersianNumber as faNum } from "@/lib/number-format";
import { canAccessModule } from "@/lib/permissions";

const statCards = [
  { label: "مشتریان", icon: Users, value: 0, color: "bg-blue-100 text-blue-600" },
  { label: "مخاطبین", icon: User, value: 0, color: "bg-purple-100 text-purple-600" },
  { label: "معاملات", icon: FolderKanban, value: 0, color: "bg-indigo-100 text-indigo-600" },
  { label: "جلسات", icon: Calendar, value: 0, color: "bg-orange-100 text-orange-600" },
];

export default function Crm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(statCards);
  const [loading, setLoading] = useState(true);

  const loadCounts = async () => {
    try {
      const [clients, contacts, deals, meetings] = await Promise.all([
        studio.entities.Client.list().catch(() => []),
        studio.entities.Contact.list().catch(() => []),
        studio.entities.Deal.list().catch(() => []),
        studio.entities.Meeting.list().catch(() => []),
      ]);
      setStats([
        { label: "مشتریان", icon: Users, value: clients.length, color: "bg-blue-100 text-blue-600" },
        { label: "مخاطبین", icon: User, value: contacts.length, color: "bg-purple-100 text-purple-600" },
        { label: "معاملات", icon: FolderKanban, value: deals.length, color: "bg-indigo-100 text-indigo-600" },
        { label: "جلسات", icon: Calendar, value: meetings.length, color: "bg-orange-100 text-orange-600" },
      ]);
    } catch (err) {
      console.error("Failed to load CRM stats:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCounts(); }, []);

  if (loading)
    return (
      <div className="flex justify-center p-20">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">CRM استودیو فلوسی</h1>
          <p className="mt-1 text-sm text-muted-foreground">مدیریت مشتریان، مخاطبین، معاملات و جلسات فروش</p>
        </div>
        <div className="flex gap-2">
          {canAccessModule(user, "clients") && (
            <button
              onClick={() => navigate("/clients")}
              className="rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium inline-flex items-center gap-2 hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" /> مشتری جدید
            </button>
          )}
          {canAccessModule(user, "deals") && (
            <button
              onClick={() => navigate("/deals")}
              className="rounded-xl bg-indigo-600 text-white px-4 py-2.5 text-sm font-medium inline-flex items-center gap-2 hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" /> معامله جدید
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {stats.map((card) => (
          <div key={card.label} className="rounded-2xl border bg-card p-5 flex items-center justify-between">
            <div>
              <span className="text-xs text-muted-foreground">{card.label}</span>
              <p className="mt-1 text-3xl font-bold">{faNum(card.value)}</p>
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${card.color}`}>
              <card.icon className="w-6 h-6" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-indigo-600" /> معاملات و پایپ‌لاین
          </h2>
          <p className="text-sm text-muted-foreground mb-4">مشاهده و مدیریت معاملات در نمای کانبان قیف فروش.</p>
          <div className="flex gap-2">
            <button
              onClick={() => navigate("/deals")}
              className="flex-1 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
            >
              ورود به پایپ‌لاین
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" /> مشتریان و مخاطبین
          </h2>
          <p className="text-sm text-muted-foreground mb-4">مدیریت شرکت‌های مشتری و افراد تماس وابسته به آن‌ها.</p>
          <div className="flex gap-2">
            <button
              onClick={() => navigate("/clients")}
              className="flex-1 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
            >
              مدیریت مشتریان
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-bold text-lg mb-4">درباره ماژول CRM</h2>
        <p className="text-sm text-muted-foreground">
          ماژول CRM استودیو فلوسی شامل چهار بخش اصلی است: مشتریان (شرکت‌ها/برندها)، مخاطبین (اشخاص تماس)،
          معاملات (قول‌rocław و پیگیری لیدها) و جلسات (لاگ جلسات ارزیابی و پرزنت پروپوزال).
        </p>
      </div>
    </div>
  );
}
