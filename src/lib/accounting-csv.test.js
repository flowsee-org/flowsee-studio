import test from "node:test";
import assert from "node:assert/strict";
import { accountingRecordKey, parseAccountingCsv } from "./accounting-csv.js";

test("parses Persian expense headers, digits, quoted fields, and categories", () => {
  const parsed = parseAccountingCsv(
    '\uFEFFعنوان,مبلغ,تاریخ,دسته‌بندی,وضعیت\r\n"پذیرایی, جلسه",۱٬۲۰۰٬۰۰۰,۱۴۰۵/۰۷/۱۹,پذیرایی,تایید',
    "expense"
  );

  assert.equal(parsed.totalRows, 1);
  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(parsed.records[0], {
    title: "پذیرایی, جلسه",
    amount: 1200000,
    date: "1405/07/19",
    status: "approved",
    category: "پذیرایی",
  });
});

test("accepts semicolon CSV, converts Gregorian dates, and imports income fields", () => {
  const parsed = parseAccountingCsv(
    "title;amount;date;description\nContract;2500000;2026-10-11;October invoice",
    "income"
  );

  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.records[0].title, "Contract");
  assert.equal(parsed.records[0].amount, 2500000);
  assert.match(parsed.records[0].date, /^14\d{2}\/\d{2}\/\d{2}$/);
  assert.equal(parsed.records[0].description, "October invoice");
});

test("rejects invalid rows and salary amounts instead of partially importing them", () => {
  const parsed = parseAccountingCsv(
    "employee_name,amount,month,base_pay\nSara,50000000,مهر ۱۴۰۵,نامعتبر\nAli,70000000,مهر ۱۴۰۵,60000000",
    "salary"
  );

  assert.equal(parsed.records.length, 1);
  assert.equal(parsed.records[0].employee_name, "Ali");
  assert.equal(parsed.records[0].base_pay, 60000000);
  assert.equal(parsed.errors.length, 1);
  assert.match(parsed.errors[0], /ردیف ۲/);
});

test("builds stable duplicate keys for each accounting record", () => {
  const record = { date: "1405/07/19", amount: 1200, title: "اینترنت", category: "عمومی" };
  assert.equal(accountingRecordKey("expense", record), accountingRecordKey("expense", { ...record }));
  assert.notEqual(accountingRecordKey("expense", record), accountingRecordKey("expense", { ...record, amount: 1500 }));
});
