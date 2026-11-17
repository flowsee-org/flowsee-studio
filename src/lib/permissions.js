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
  { id: "passwords", label: "رموز عبور", path: "/passwords", adminOnly: false },
  { id: "documents", label: "اسناد", path: "/documents", adminOnly: false },
];

// ماژول‌هایی که برای کاربران جدید (نقش user) به‌صورت پیش‌فرض فعال نیستند.
export const INACTIVE_MODULES_BY_DEFAULT = ["crm", "passwords", "documents"];

export const DEFAULT_MODULE_ACCESS = MODULES.map(({ id }) => id);

export function defaultModuleAccessForRole(role) {
  if (role === "superadmin" || role === "admin") return DEFAULT_MODULE_ACCESS;
  return MODULES.filter((m) => !m.adminOnly && !INACTIVE_MODULES_BY_DEFAULT.includes(m.id)).map((m) => m.id);
}

// بخش‌های زیرساختی (ساب‌ماژول) هر ماژول. مدیر می‌تواند به یک کاربر دسترسی
// به کل ماژول بدهد یا فقط به بخش‌های خاصی از آن (مثلاً نه کل حسابداری، بله
// فقط «فاکتور فروش»).
export const MODULE_SECTIONS = {
  accounting: [
    { key: "invoices_sales", label: "فاکتورهای فروش" },
    { key: "invoices_purchase", label: "فاکتورهای خرید" },
    { key: "expenses", label: "هزینه‌ها" },
    { key: "income", label: "درآمدها" },
    { key: "reports", label: "گزارش‌های مالی" },
    { key: "settings", label: "تنظیمات حسابداری" },
  ],
  reports: [
    { key: "task_reports", label: "گزارش تسک‌ها" },
    { key: "financial_reports", label: "گزارش‌های مالی" },
    { key: "work_reports", label: "گزارش کار" },
  ],
  crm: [
    { key: "clients", label: "مشتریان" },
    { key: "contacts", label: "مخاطبین" },
    { key: "deals", label: "معاملات" },
    { key: "meetings", label: "جلسات" },
  ],
};

export function defaultModuleSubAccess(role) {
  if (role === "superadmin" || role === "admin") return {};
  return {};
}


export function canAccessModule(user, moduleId) {
  if (!user || !moduleId) return false;
  if (moduleId === "dashboard") return true;
  if (user.role === "superadmin") return true;
  // مدیران سیستم (admin) به تمام ماژول‌ها دسترسی دارند. این بررسی قبل از
  // module_access انجام می‌شود تا کاربر ادمین با module_access خالی [],
  // از دسترسی به ماژول‌های adminOnly (مثل مقالات بلاگ) از دست ندهد.
  if (user.role === "admin") return true;
  // دسترسی کامل به ماژول
  if (Array.isArray(user.module_access) && user.module_access.includes(moduleId)) return true;
  // دسترسی جزئی به یکی از بخش‌های ماژول
  const subAccess = user.module_sub_access;
  if (subAccess && typeof subAccess === "object" && Array.isArray(subAccess[moduleId]) && subAccess[moduleId].length > 0) return true;
  const mod = MODULES.find((m) => m.id === moduleId);
  return !mod?.adminOnly;
}

export function canAccessModuleSection(user, moduleId, sectionKey) {
  if (!user || !moduleId || !sectionKey) return false;
  if (user.role === "superadmin") return true;
  if (user.role === "admin") return true;
  // دسترسی کامل به ماژول شامل تمامی بخش‌های آن است
  if (Array.isArray(user.module_access) && user.module_access.includes(moduleId)) return true;
  const subAccess = user.module_sub_access;
  if (subAccess && typeof subAccess === "object") {
    return Array.isArray(subAccess[moduleId]) && subAccess[moduleId].includes(sectionKey);
  }
  return false;
}

export function moduleSections(moduleId) {
  return MODULE_SECTIONS[moduleId] || [];
}

export function hasModuleSections(moduleId) {
  return Boolean(MODULE_SECTIONS[moduleId] && MODULE_SECTIONS[moduleId].length);
}
