import { useState, useEffect } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { ChevronDown, LayoutDashboard, Wallet, BarChart3, Calendar, Users, FolderKanban, ClipboardList, ListTodo, Menu, Shield, LogOut, UserCircle, Sun, Moon, Megaphone, Flag, CalendarDays, Settings, AlertTriangle, X, RefreshCw, Send, Inbox, PanelRightClose, PanelRightOpen, BriefcaseBusiness, FileText } from "lucide-react";
import { roleLabel } from "@/lib/roles";
import NotificationCenter from "@/components/NotificationCenter";
import { toast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { canAccessModule } from "@/lib/permissions";

const allNavItems = [
  { to: "/", label: "داشبورد", icon: LayoutDashboard, end: true, adminOnly: false, module: "dashboard" },
  { to: "/announcements", label: "اعلانات", icon: Megaphone, adminOnly: false, module: "announcements" },
  { to: "/accounting", label: "حسابداری", icon: Wallet, adminOnly: true, module: "accounting" },
  { to: "/reports", label: "گزارش", icon: BarChart3, adminOnly: true, module: "reports" },
  { to: "/meetings", label: "جلسه", icon: Calendar, adminOnly: false, module: "meetings" },
  { to: "/tasks", label: "تسک", icon: ListTodo, adminOnly: false, module: "tasks" },
  { to: "/projects", label: "پروژه", icon: FolderKanban, adminOnly: false, module: "projects" },
  { to: "/work-reports", label: "گزارش کار", icon: ClipboardList, adminOnly: false, module: "work-reports" },
  { to: "/employees", label: "کارکنان", icon: Users, adminOnly: true, module: "employees" },
  { to: "/sprints", label: "اسپرینت", icon: Flag, adminOnly: false, module: "sprints" },
  { to: "/leave-requests", label: "مرخصی", icon: CalendarDays, adminOnly: false, module: "leave-requests" },
  { to: "/settings", label: "تنظیمات", icon: Settings, adminOnly: true, module: "settings" },
  { to: "/admin", label: "پنل ادمین", icon: Shield, adminOnly: true, module: "admin" },
  { to: "/website-messages", label: "پیام‌های سایت", icon: Inbox, adminOnly: true, module: "website-messages" },
  { to: "/site-content", label: "نمونه‌کارها", icon: BriefcaseBusiness, adminOnly: true, module: "site-content" },
  { to: "/blog-content", label: "مقالات بلاگ", icon: FileText, adminOnly: true, module: "blog-content" },
];

const navGroups = [
  { label: "محتوا و وب‌سایت", routes: ["/site-content", "/blog-content", "/website-messages", "/announcements"] },
  { label: "پروژه و برنامه‌ریزی", routes: ["/projects", "/tasks", "/sprints", "/meetings", "/work-reports"] },
  { label: "مالی و گزارش‌ها", routes: ["/accounting", "/reports"] },
  { label: "مدیریت و تیم", routes: ["/employees", "/leave-requests", "/admin", "/settings"] },
];
function NavigationGroup({ group, items, pathname, onNavigate }) {
  const active = items.some(item => pathname === item.to || pathname.startsWith(item.to + "/"));
  const [expanded, setExpanded] = useState(active);
  useEffect(() => { if (active) setExpanded(true); }, [active, pathname]);
  const id = group.routes[0].slice(1);
  return <div className="py-1"><button type="button" aria-expanded={expanded} aria-controls={`nav-${id}`} onClick={() => setExpanded(!expanded)} className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold hover:bg-accent ${active ? "text-primary" : "text-muted-foreground"}`}><span>{group.label}</span><ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} /></button><div id={`nav-${id}`} hidden={!expanded} className="mr-3 space-y-1 border-r border-border pr-2">{items.map(item => <NavigationItem key={item.to} item={item} onNavigate={onNavigate} />)}</div></div>;
}
function NavigationItem({ item, onNavigate }) {
  return <NavLink to={item.to} end={item.end} onClick={onNavigate} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${isActive ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent"}`}><item.icon className="h-5 w-5 shrink-0" />{item.label}</NavLink>;
}

export default function Layout() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(() => localStorage.getItem("studio-sidebar-hidden") === "true");
  const { user, logout, isAdmin, isSuperadmin } = useAuth();
  const navItems = allNavItems.filter((item) => (!item.adminOnly || isAdmin) && canAccessModule(user, item.module));
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("theme");
    if (stored) return stored === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  // The SDK's logout() does a full-page server round-trip that lands the user
  // back on the login page (see AuthContext.logout), so no router call here.
  const handleLogout = () => {
    logout(false);
  };

  const handleResendVerification = async () => {
    setResendingVerification(true);
    try {
      await base44.auth.resendOtp(user.email);
      toast({
        title: "ایمیل تایید ارسال شد",
        description: "کد تایید به ایمیل شما ارسال شد. ایمیل خود را بررسی کنید.",
      });
    } catch (err) {
      toast({
        title: "خطا",
        description: err.message || "ارسال ایمیل تایید ناموفق بود",
        variant: "destructive",
      });
    } finally {
      setResendingVerification(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex" dir="rtl">
      <aside
        className={`fixed lg:static inset-y-0 right-0 z-50 w-72 shrink-0 overflow-hidden bg-card border-l border-border flex flex-col transition-all duration-300 shadow-xl lg:shadow-none ${
          open ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        } ${sidebarHidden ? "lg:w-0 lg:opacity-0 lg:border-0" : "lg:w-72"}`}
      >
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl overflow-hidden flex items-center justify-center shadow-lg shadow-primary/20 bg-black">
              <img src="https://media.base44.com/images/public/6a97d5f57663dc264577980c/a953bd16d_Property1TransparentColorOrange22x.png" alt="فلوسی" className="w-7 h-7 object-contain" />
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight">استودیو فلوسی</h1>
              <p className="text-xs text-muted-foreground">
                {isSuperadmin ? "مدیرعامل" : isAdmin ? "پنل مدیریت" : "پورتال پرسنل"} • {roleLabel(user?.role)}
              </p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-thin">
          {navItems.filter(item => item.to === "/").map(item => <NavigationItem key={item.to} item={item} onNavigate={() => setOpen(false)} />)}
          {navGroups.map(group => {
            const items = navItems.filter(item => group.routes.includes(item.to));
            return items.length ? <NavigationGroup key={group.label} group={group} items={items} pathname={pathname} onNavigate={() => setOpen(false)} /> : null;
          })}
        </nav>
        <div className="shrink-0 border-t border-border p-4 space-y-2">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full px-4 py-2 rounded-lg hover:bg-accent transition-colors"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {darkMode ? "حالت روشن" : "حالت تاریک"}
          </button>
          <div className="flex items-center gap-3 px-2 py-1.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {(user?.full_name || user?.email || "؟").charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user?.full_name || "کاربر"}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NavLink
              to="/profile"
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"
                }`
              }
            >
              <UserCircle className="h-4 w-4" /> پروفایل
            </NavLink>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-red-500"
            >
              <LogOut className="h-4 w-4" /> خروج
            </button>
          </div>
        </div>
      </aside>

      {open && <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden flex items-center justify-between p-4 bg-card border-b border-border sticky top-0 z-30">
          <span className="font-bold">استودیو فلوسی</span>
          <div className="flex items-center gap-1">
            <NotificationCenter />
            <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-lg hover:bg-accent">
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button onClick={() => setOpen(true)} className="p-2 rounded-lg hover:bg-accent">
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </header>
        <header className="hidden lg:flex lg:items-center lg:justify-between lg:p-4 lg:bg-card lg:border-b lg:border-border lg:sticky lg:top-0 lg:z-30">
          <span className="font-bold">استودیو فلوسی</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarHidden((hidden) => {
                const next = !hidden;
                localStorage.setItem("studio-sidebar-hidden", String(next));
                return next;
              })}
              className="p-2 rounded-lg hover:bg-accent"
              aria-label={sidebarHidden ? "نمایش نوار کناری" : "پنهان کردن نوار کناری"}
              title={sidebarHidden ? "نمایش نوار کناری" : "پنهان کردن نوار کناری"}
            >
              {sidebarHidden ? <PanelRightOpen className="w-5 h-5" /> : <PanelRightClose className="w-5 h-5" />}
            </button>
            <NotificationCenter />
            <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-lg hover:bg-accent">
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </header>
        {user && !user.is_verified && !bannerDismissed && (
          <div className="bg-orange-50 dark:bg-orange-950/40 border-b border-orange-200 dark:border-orange-900 px-4 py-2.5 flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
            <p className="text-sm text-orange-800 dark:text-orange-300 flex-1">
              ایمیل شما تایید نشده است. برای دسترسی کامل، لطفاً ایمیل خود را تایید کنید.
            </p>
            <button
              onClick={handleResendVerification}
              disabled={resendingVerification}
              className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 dark:text-orange-300 hover:underline disabled:opacity-50 shrink-0"
            >
              {resendingVerification ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Send className="w-3 h-3" />
              )}
              ارسال مجدد
            </button>
            <button
              onClick={() => setBannerDismissed(true)}
              className="text-orange-500 hover:text-orange-700 dark:hover:text-orange-200 shrink-0"
              aria-label="بستن"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
