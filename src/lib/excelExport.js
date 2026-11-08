import * as XLSX from "xlsx";
import { normalizeSubtasks } from "./subtasks.js";
import { formatPersianNumber as faNum } from "./number-format.js";

const MODULE_LABELS = {
  tasks: "تسک‌ها",
  projects: "پروژه‌ها",
  accounting: "مالی و هزینه‌ها",
  work_reports: "گزارش کار",
  leave_requests: "مرخصی‌ها",
  announcements: "اعلامیه‌ها",
  employees: "پرسنل",
  website_messages: "پیام‌های سایت",
  blog_content: "محتوای بلاگ",
  site_content: "مدیریت سایت",
  goals: "اهداف و OKR",
  sprints: "اسپرینت‌ها",
  meetings: "جلسات",
};

const STATUS_LABELS = {
  todo: "در انتظار",
  in_progress: "در حال انجام",
  done: "انجام شد",
  archived: "آرشیو شده",
  review: "در انتظار بررسی",
};

const PRIORITY_LABELS = {
  urgent: "فوری",
  high: "زیاد",
  medium: "متوسط",
  low: "کم",
};

const CATEGORY_LABELS = {
  عمومی: "هزینه جاری",
  "آب/برق/گاز": "آب، برق و گاز",
  اینترنت: "اینترنت و سرور",
  پذیرایی: "پذیرایی",
  تجهیزات: "تجهیزات",
  تبلیغات: "تبلیغات",
  حقوق: "حقوق و دستمزد",
  سایر: "سایر",
};

/**
 * Creates an RTL-enabled XLSX Workbook with auto-fitted column widths
 */
export function createRtlWorkbook(sheetName, rows, columnConfig) {
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!views"] = [{ rightToLeft: true }];

  // Compute column widths
  const colWidths = columnConfig.map((col) => {
    let maxLen = col.header.length;
    rows.forEach((row) => {
      const val = row[col.header];
      if (val != null) {
        const len = String(val).length;
        if (len > maxLen) maxLen = len;
      }
    });
    return { wch: Math.min(Math.max(maxLen + 4, col.minWidth || 12), 60) };
  });
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return wb;
}

/**
 * Triggers a browser download of the workbook
 */
export function downloadWorkbook(wb, fileName) {
  const fullFileName = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fullFileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Generates an Excel workbook for Users
 */
export function buildUsersWorkbook(userList = []) {
  const columns = [
    { header: "ردیف", minWidth: 8 },
    { header: "نام و نام خانوادگی", minWidth: 20 },
    { header: "ایمیل", minWidth: 26 },
    { header: "نقش سازمانی", minWidth: 16 },
    { header: "شماره تماس", minWidth: 16 },
    { header: "بخش / دپارتمان", minWidth: 18 },
    { header: "سمت", minWidth: 18 },
    { header: "وضعیت حساب", minWidth: 14 },
    { header: "دسترسی ماژول‌ها", minWidth: 30 },
    { header: "تاریخ عضویت", minWidth: 16 },
    { header: "شناسه کاربر", minWidth: 14 },
  ];

  const rows = userList.map((u, index) => {
    let roleText = "پرسنل";
    if (u.role === "superadmin") roleText = "مدیر ارشد (مدیرعامل)";
    else if (u.role === "admin") roleText = "مدیر سیستم";

    let modulesText = "پیش‌فرض";
    if (u.role === "superadmin" || u.role === "admin") {
      modulesText = "دسترسی کامل به تمام ماژول‌ها";
    } else if (Array.isArray(u.module_access)) {
      modulesText = u.module_access.map((m) => MODULE_LABELS[m] || m).join("، ") || "بدون ماژول";
    }

    const createdDate = u.created_at || u.created_date || u.createdDate || "";
    const cleanDate = createdDate ? String(createdDate).slice(0, 10).replace(/-/g, "/") : "—";

    return {
      "ردیف": index + 1,
      "نام و نام خانوادگی": u.full_name || u.name || "—",
      "ایمیل": u.email || "—",
      "نقش سازمانی": roleText,
      "شماره تماس": u.phone || "—",
      "بخش / دپارتمان": u.department || "—",
      "سمت": u.position || "—",
      "وضعیت حساب": u.is_active === false ? "غیرفعال" : "فعال",
      "دسترسی ماژول‌ها": modulesText,
      "تاریخ عضویت": cleanDate,
      "شناسه کاربر": String(u.id ?? ""),
    };
  });

  return createRtlWorkbook("کاربران", rows, columns);
}

/**
 * Generates an Excel workbook for Tasks
 */
export function buildTasksWorkbook(taskList = [], projectList = []) {
  const projMap = new Map();
  projectList.forEach((p) => {
    if (p?.id) projMap.set(String(p.id), p.name);
  });

  const columns = [
    { header: "ردیف", minWidth: 8 },
    { header: "شماره تسک", minWidth: 12 },
    { header: "عنوان تسک", minWidth: 32 },
    { header: "پروژه", minWidth: 20 },
    { header: "وضعیت", minWidth: 14 },
    { header: "اولویت", minWidth: 12 },
    { header: "مسئولین", minWidth: 22 },
    { header: "مهلت انجام (ددلاین)", minWidth: 18 },
    { header: "زیرتسک‌ها", minWidth: 22 },
    { header: "برچسب‌ها", minWidth: 20 },
    { header: "زمان ثبت‌شده (ساعت)", minWidth: 16 },
    { header: "وضعیت تأیید", minWidth: 14 },
    { header: "تاریخ ایجاد", minWidth: 16 },
    { header: "توضیحات", minWidth: 40 },
    { header: "شناسه تسک", minWidth: 14 },
  ];

  const rows = taskList.map((t, index) => {
    const projName = projMap.get(String(t.project_id)) || t.project_name || t.project?.name || "بدون پروژه";
    const statusText = STATUS_LABELS[t.status] || (t.archived ? "آرشیو شده" : t.status || "در انتظار");
    const priorityText = PRIORITY_LABELS[t.priority] || t.priority || "متوسط";

    const assignees = (Array.isArray(t.assignees) && t.assignees.length > 0 ? t.assignees : [t.assignee])
      .filter(Boolean)
      .join("، ");

    const subtasks = normalizeSubtasks(t.subtasks);
    const subtasksCount = subtasks.length;
    const subtasksDone = subtasks.filter((s) => s.done).length;
    const subtasksText = subtasksCount > 0
      ? `${faNum(subtasksDone)} از ${faNum(subtasksCount)} انجام شده (${faNum(Math.round((subtasksDone / subtasksCount) * 100))}٪)`
      : "بدون زیرتسک";

    let tagsText = "—";
    if (Array.isArray(t.tags) && t.tags.length > 0) {
      tagsText = t.tags.join("، ");
    } else if (typeof t.tags === "string" && t.tags.trim()) {
      tagsText = t.tags;
    }

    const created = t.created_date || t.created_at || "";
    const cleanCreated = created ? String(created).slice(0, 10).replace(/-/g, "/") : "—";
    const desc = t.description ? String(t.description).trim().slice(0, 300) : "—";

    return {
      "ردیف": index + 1,
      "شماره تسک": t.task_number || `T-${index + 1}`,
      "عنوان تسک": t.title || "بدون عنوان",
      "پروژه": projName,
      "وضعیت": statusText,
      "اولویت": priorityText,
      "مسئولین": assignees || "تعیین نشده",
      "مهلت انجام (ددلاین)": t.due_date || "تعیین نشده",
      "زیرتسک‌ها": subtasksText,
      "برچسب‌ها": tagsText,
      "زمان ثبت‌شده (ساعت)": Number(t.time_spent || 0),
      "وضعیت تأیید": t.completion_approved ? "تأیید شده" : "—",
      "تاریخ ایجاد": cleanCreated,
      "توضیحات": desc,
      "شناسه تسک": String(t.id ?? ""),
    };
  });

  return createRtlWorkbook("تسک‌ها", rows, columns);
}

/**
 * Generates an Excel workbook for Expenses
 */
export function buildExpensesWorkbook(expenseList = [], projectList = []) {
  const projMap = new Map();
  projectList.forEach((p) => {
    if (p?.id) projMap.set(String(p.id), p.name);
  });

  const columns = [
    { header: "ردیف", minWidth: 8 },
    { header: "عنوان هزینه", minWidth: 26 },
    { header: "مبلغ (تومان)", minWidth: 16 },
    { header: "دسته‌بندی", minWidth: 18 },
    { header: "پروژه مربوطه", minWidth: 20 },
    { header: "تاریخ", minWidth: 16 },
    { header: "وضعیت", minWidth: 14 },
    { header: "کد پیگیری / سند", minWidth: 18 },
    { header: "ثبت‌کننده / پرداخت‌کننده", minWidth: 22 },
    { header: "توضیحات و یادداشت", minWidth: 35 },
    { header: "شناسه هزینه", minWidth: 14 },
  ];

  const rows = expenseList.map((e, index) => {
    const projName = projMap.get(String(e.project_id)) || e.project_name || "—";
    const catName = CATEGORY_LABELS[e.category] || e.category || "سایر";

    let statusText = "تأیید شده";
    if (e.status === "rejected") statusText = "رد شده";
    else if (e.status === "pending") statusText = "در انتظار تأیید";

    return {
      "ردیف": index + 1,
      "عنوان هزینه": e.title || "بدون عنوان",
      "مبلغ (تومان)": Number(e.amount || 0),
      "دسته‌بندی": catName,
      "پروژه مربوطه": projName,
      "تاریخ": e.date || "—",
      "وضعیت": statusText,
      "کد پیگیری / سند": e.tracking_code || e.invoice_number || e.receipt_id || "—",
      "ثبت‌کننده / پرداخت‌کننده": e.payer || e.user_name || e.created_by_name || "—",
      "توضیحات و یادداشت": e.notes || e.description || "—",
      "شناسه هزینه": String(e.id ?? ""),
    };
  });

  return createRtlWorkbook("هزینه‌ها", rows, columns);
}
