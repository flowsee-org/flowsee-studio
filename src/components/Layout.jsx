import { useState, useEffect } from "react";
import { Outlet, NavLink } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { LayoutDashboard, Wallet, BarChart3, Calendar, Users, FolderKanban, ClipboardList, ListTodo, Menu, Shield, LogOut, UserCircle, Sun, Moon, Megaphone, Flag, Target, CalendarDays, Settings } from "lucide-react";
import { roleLabel } from "@/lib/roles";
import NotificationCenter from "@/components/NotificationCenter";

const allNavItems = [
  { to: "/", label: "داشبورد", icon: LayoutDashboard, end: true, adminOnly: false },
  { to: "/announcements", label: "اعلانات", icon: Megaphone, adminOnly: false },
  { to: "/accounting", label: "حسابداری", icon: Wallet, adminOnly: true },
  { to: "/reports", label: "گزارش‌ها", icon: BarChart3, adminOnly: true },
  { to: "/meetings", label: "جلسات", icon: Calendar, adminOnly: false },
  { to: "/tasks", label: "تسک‌ها", icon: ListTodo, adminOnly: false },
  { to: "/projects", label: "پروژه‌ها", icon: FolderKanban, adminOnly: false },
  { to: "/work-reports", label: "گزارش کار", icon: ClipboardList, adminOnly: false },
  { to: "/employees", label: "کارکنان", icon: Users, adminOnly: true },
  { to: "/sprints", label: "اسپرینتها", icon: Flag, adminOnly: false },
  { to: "/goals", label: "اهداف", icon: Target, adminOnly: true },
  { to: "/leave-requests", label: "مرخصیها", icon: CalendarDays, adminOnly: false },
  { to: "/settings", label: "تنظیمات", icon: Settings, adminOnly: true },
  { to: "/admin", label: "پنل ادمین", icon: Shield, adminOnly: true },
];

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { user, logout, isAdmin, isSuperadmin } = useAuth();
  const navItems = allNavItems.filter((item) => !item.adminOnly || isAdmin);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("theme");
    if (stored) return stored === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
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

  return (
    <div className="min-h-screen bg-background flex" dir="rtl">
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-card border-l border-border flex flex-col transition-transform duration-300 shadow-xl lg:shadow-none ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
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
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "text-foreground hover:bg-accent"
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-border space-y-3">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full px-4 py-2 rounded-lg hover:bg-accent transition-colors"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {darkMode ? "حالت روشن" : "حالت تاریک"}
          </button>
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
              {(user?.full_name || user?.email || "؟").charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.full_name || "کاربر"}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <NavLink
            to="/profile"
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-2 text-sm w-full px-4 py-2 rounded-lg transition-colors ${
                isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"
              }`
            }
          >
            <UserCircle className="w-4 h-4" /> پروفایل من
          </NavLink>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-red-500 w-full px-4 py-2 rounded-lg hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="w-4 h-4" /> خروج از حساب
          </button>
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
            <NotificationCenter />
            <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-lg hover:bg-accent">
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}