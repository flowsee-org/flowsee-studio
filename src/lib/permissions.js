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
  { id: "crm", label: "CRM مشتریان", path: "/crm", adminOnly: false },
  { id: "clients", label: "مشتریان", path: "/clients", adminOnly: false },
  { id: "contacts", label: "مخاطبین", path: "/contacts", adminOnly: false },
  { id: "deals", label: "معاملات", path: "/deals", adminOnly: false },
  { id: "passwords-documents", label: "رموز و اسناد", path: "/passwords-documents", adminOnly: false },
];

export const DEFAULT_MODULE_ACCESS = MODULES.map(({ id }) => id);

export function canAccessModule(user, moduleId) {
  if (!user || !moduleId) return false;
  if (moduleId === "dashboard") return true;
  if (user.role === "superadmin") return true;
  // مدیران سیستم (admin) به تمام ماژول‌ها دسترسی دارند. این بررسی قبل از
  // module_access انجام می‌شود تا کاربر ادمین با module_access خالی [],
  // از دسترسی به ماژول‌های adminOnly (مثل مقالات بلاگ) از دست ندهد.
  if (user.role === "admin") return true;
  if (Array.isArray(user.module_access)) {
    return user.module_access.includes(moduleId);
  }
  const mod = MODULES.find((m) => m.id === moduleId);
  return !mod?.adminOnly;
}
