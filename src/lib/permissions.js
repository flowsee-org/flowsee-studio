export const MODULES = [
  { id: "dashboard", label: "داشبورد", path: "/" },
  { id: "announcements", label: "اعلانات", path: "/announcements" },
  { id: "accounting", label: "حسابداری", path: "/accounting", adminOnly: true },
  { id: "reports", label: "گزارش", path: "/reports", adminOnly: true },
  { id: "meetings", label: "جلسه", path: "/meetings" },
  { id: "tasks", label: "تسک", path: "/tasks" },
  { id: "projects", label: "پروژه", path: "/projects" },
  { id: "work-reports", label: "گزارش کار", path: "/work-reports" },
  { id: "employees", label: "کارکنان", path: "/employees", adminOnly: true },
  { id: "sprints", label: "اسپرینت", path: "/sprints" },
  { id: "leave-requests", label: "مرخصی", path: "/leave-requests" },
  { id: "settings", label: "تنظیمات", path: "/settings", adminOnly: true },
  { id: "admin", label: "پنل ادمین", path: "/admin", adminOnly: true },
  { id: "website-messages", label: "پیام‌های سایت", path: "/website-messages", adminOnly: true },
  { id: "site-content", label: "محتوای سایت", path: "/site-content", adminOnly: true },
  { id: "blog-content", label: "مقالات بلاگ", path: "/blog-content", adminOnly: true },
];

export const DEFAULT_MODULE_ACCESS = MODULES.map(({ id }) => id);

export function canAccessModule(user, moduleId) {
  if (!user || !moduleId) return false;
  if (moduleId === "dashboard") return true;
  if (user.role === "admin" || user.role === "superadmin") return true;
  if (!Array.isArray(user.module_access)) return true;
  return user.module_access.includes(moduleId);
}
