import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import {
  buildUsersWorkbook,
  buildTasksWorkbook,
  buildExpensesWorkbook,
} from "./excelExport.js";

test("buildUsersWorkbook creates valid RTL sheet with Persian headers and mapped roles", () => {
  const users = [
    {
      id: "u-1",
      full_name: "مدیر تستی",
      email: "admin@flowsee.ir",
      role: "admin",
      phone: "09120000000",
      department: "فنی",
      position: "راهبر ارشد",
      is_active: true,
      created_date: "2026-11-01T10:00:00.000Z",
    },
    {
      id: "u-2",
      name: "کاربر ۲",
      email: "staff@flowsee.ir",
      role: "user",
      is_active: false,
    },
  ];

  const wb = buildUsersWorkbook(users);
  assert.ok(wb.Sheets["کاربران"]);
  assert.equal(wb.Sheets["کاربران"]["!views"][0].rightToLeft, true);

  const json = XLSX.utils.sheet_to_json(wb.Sheets["کاربران"]);
  assert.equal(json.length, 2);
  assert.equal(json[0]["نام و نام خانوادگی"], "مدیر تستی");
  assert.equal(json[0]["نقش سازمانی"], "مدیر سیستم");
  assert.equal(json[0]["وضعیت حساب"], "فعال");
  assert.equal(json[1]["وضعیت حساب"], "غیرفعال");
  assert.equal(json[1]["نقش سازمانی"], "پرسنل");
});

test("buildTasksWorkbook maps projects, subtasks, priorities and statuses into RTL sheet", () => {
  const projects = [
    { id: "proj-1", name: "پروژه ریدیزاین" },
  ];
  const tasks = [
    {
      id: "t-1",
      task_number: "T-42",
      title: "اصلاح فیلترها",
      project_id: "proj-1",
      status: "in_progress",
      priority: "high",
      assignees: ["امیر", "سارا"],
      due_date: "1403/08/20",
      subtasks: [
        { title: "تست اول", done: true },
        { title: "تست دوم", done: false },
      ],
      time_spent: 4.5,
    },
  ];

  const wb = buildTasksWorkbook(tasks, projects);
  assert.ok(wb.Sheets["تسک‌ها"]);
  assert.equal(wb.Sheets["تسک‌ها"]["!views"][0].rightToLeft, true);

  const json = XLSX.utils.sheet_to_json(wb.Sheets["تسک‌ها"]);
  assert.equal(json.length, 1);
  assert.equal(json[0]["شماره تسک"], "T-42");
  assert.equal(json[0]["پروژه"], "پروژه ریدیزاین");
  assert.equal(json[0]["وضعیت"], "در حال انجام");
  assert.equal(json[0]["اولویت"], "زیاد");
  assert.equal(json[0]["مسئولین"], "امیر، سارا");
  assert.equal(json[0]["زیرتسک‌ها"], "۱ از ۲ انجام شده (۵۰٪)");
  assert.equal(json[0]["زمان ثبت‌شده (ساعت)"], 4.5);
});

test("buildExpensesWorkbook maps categories, statuses and amounts correctly", () => {
  const expenses = [
    {
      id: "exp-1",
      title: "خرید سرور ابری",
      amount: 15000000,
      category: "اینترنت",
      status: "approved",
      date: "1403/08/15",
    },
  ];

  const wb = buildExpensesWorkbook(expenses, []);
  assert.ok(wb.Sheets["هزینه‌ها"]);
  assert.equal(wb.Sheets["هزینه‌ها"]["!views"][0].rightToLeft, true);

  const json = XLSX.utils.sheet_to_json(wb.Sheets["هزینه‌ها"]);
  assert.equal(json.length, 1);
  assert.equal(json[0]["عنوان هزینه"], "خرید سرور ابری");
  assert.equal(json[0]["مبلغ (تومان)"], 15000000);
  assert.equal(json[0]["دسته‌بندی"], "اینترنت و سرور");
  assert.equal(json[0]["وضعیت"], "تأیید شده");
});
