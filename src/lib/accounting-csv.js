const DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

const FIELD_ALIASES = {
  expense: {
    title: ["title", "name", "عنوان", "عنوان هزینه", "شرح", "شرح هزینه"],
    amount: ["amount", "مبلغ", "مبلغ تومان", "مبلغ (تومان)", "هزینه"],
    date: ["date", "تاریخ", "تاریخ هزینه", "تاریخ تراکنش"],
    category: ["category", "دسته بندی", "دسته‌بندی", "نوع هزینه"],
    status: ["status", "وضعیت"],
    project_name: ["project_name", "project", "پروژه", "نام پروژه"],
  },
  income: {
    title: ["title", "name", "عنوان", "عنوان درآمد", "شرح", "شرح درآمد"],
    amount: ["amount", "مبلغ", "مبلغ تومان", "مبلغ (تومان)", "درآمد"],
    date: ["date", "تاریخ", "تاریخ درآمد", "تاریخ تراکنش"],
    description: ["description", "توضیحات", "شرح تکمیلی"],
  },
  salary: {
    employee_name: ["employee_name", "employee", "name", "نام کارمند", "کارمند", "نام پرسنل"],
    amount: ["amount", "مبلغ", "مبلغ حقوق", "حقوق", "حقوق پرداختی"],
    month: ["month", "ماه", "ماه حقوق", "دوره"],
    date: ["date", "تاریخ", "تاریخ پرداخت"],
    status: ["status", "وضعیت"],
    base_pay: ["base_pay", "حقوق پایه", "پایه"],
    overtime: ["overtime", "اضافه کاری", "اضافه‌کاری"],
    deductions: ["deductions", "کسورات", "کسر"],
    benefits: ["benefits", "مزایا"],
    notes: ["notes", "note", "یادداشت", "توضیحات"],
  },
};

const CATEGORIES = ["عمومی", "آب/برق/گاز", "اینترنت", "پذیرایی", "تجهیزات", "تبلیغات", "حقوق", "سایر"];

export function toLatinDigits(value) {
  return String(value ?? "")
    .replace(/[۰-۹]/g, (digit) => DIGITS.indexOf(digit))
    .replace(/[٠-٩]/g, (digit) => ARABIC_DIGITS.indexOf(digit));
}

function normalizeHeader(value) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/[\u200c\u200f\u202a-\u202e]/g, "")
    .trim()
    .toLocaleLowerCase("fa-IR")
    .replace(/[()\[\]{}]/g, "")
    .replace(/[\s_-]+/g, "");
}

function detectDelimiter(line) {
  let bestDelimiter = ",";
  let bestCount = -1;
  for (const delimiter of [",", ";", "\t"]) {
    let count = 0;
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      if (line[index] === '"') {
        if (quoted && line[index + 1] === '"') index += 1;
        else quoted = !quoted;
      } else if (!quoted && line[index] === delimiter) {
        count += 1;
      }
    }
    if (count > bestCount) {
      bestDelimiter = delimiter;
      bestCount = count;
    }
  }
  return bestDelimiter;
}

function parseRows(text) {
  const source = String(text ?? "").replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(source.split(/\r?\n/, 1)[0] || "");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && char === delimiter) {
      row.push(field);
      field = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((cell) => String(cell).trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (quoted) return { rows: [], error: "یک کوتیشن در فایل بسته نشده است." };
  row.push(field);
  if (row.some((cell) => String(cell).trim())) rows.push(row);
  return { rows, error: "" };
}

function parseAmount(value) {
  const normalized = toLatinDigits(value)
    .replace(/[\s,٬]/g, "")
    .replace(/[٫٬]/g, ".")
    .replace(/ریال|تومان|﷼/g, "")
    .trim();
  if (!normalized || !/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function normalizeDate(value) {
  const text = toLatinDigits(value).trim();
  if (!text) return "";
  const parts = text.replace(/[.-]/g, "/").split("/");
  if (parts.length !== 3 || parts.some((part) => !/^\d+$/.test(part))) return "";

  let year;
  let month;
  let day;
  if (parts[0].length === 4) {
    [year, month, day] = parts.map(Number);
  } else if (parts[2].length === 4) {
    [day, month, year] = parts.map(Number);
  } else {
    return "";
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return "";

  if (year >= 1700) {
    const date = new Date(Date.UTC(year, month - 1, day, 12));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
    const dateParts = new Intl.DateTimeFormat("en-u-ca-persian", {
      year: "numeric", month: "2-digit", day: "2-digit", timeZone: "UTC",
    }).formatToParts(date);
    const result = Object.fromEntries(dateParts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    return `${result.year}/${result.month}/${result.day}`;
  }

  return `${String(year).padStart(4, "0")}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
}

function normalizeStatus(type, value) {
  const status = normalizeHeader(value);
  if (!status) return type === "salary" ? "pending" : "approved";
  if (type === "salary") {
    if (["paid", "پرداختشده", "تسویهشده"].includes(status)) return "paid";
    if (["pending", "درانتظار", "پرداختنشده"].includes(status)) return "pending";
    return null;
  }
  if (["approved", "تایید", "تاییدشده", "تأیید", "تأییدشده"].includes(status)) return "approved";
  if (["pending", "درانتظار"].includes(status)) return "pending";
  if (["rejected", "رد", "ردشده"].includes(status)) return "rejected";
  return null;
}

function fieldIndexes(headers, type) {
  const normalizedHeaders = headers.map(normalizeHeader);
  return Object.fromEntries(Object.entries(FIELD_ALIASES[type]).map(([field, aliases]) => {
    const normalizedAliases = aliases.map(normalizeHeader);
    return [field, normalizedHeaders.findIndex((header) => normalizedAliases.includes(header))];
  }));
}

export function accountingRecordKey(type, record) {
  const values = type === "expense"
    ? [record.date, record.amount, record.title, record.category]
    : type === "income"
      ? [record.date, record.amount, record.title]
      : [record.month, record.employee_name, record.amount];
  return values.map((value) => String(value ?? "").trim().toLocaleLowerCase("fa-IR")).join("|");
}

export function parseAccountingCsv(text, type) {
  if (!FIELD_ALIASES[type]) return { records: [], errors: ["نوع اطلاعات انتخاب‌شده معتبر نیست."], totalRows: 0 };
  const parsed = parseRows(text);
  if (parsed.error) return { records: [], errors: [parsed.error], totalRows: 0 };
  if (parsed.rows.length < 2) return { records: [], errors: ["فایل باید یک ردیف عنوان و دست‌کم یک ردیف اطلاعات داشته باشد."], totalRows: 0 };

  const [headers, ...dataRows] = parsed.rows;
  if (dataRows.length > 500) {
    return { records: [], errors: ["هر فایل حداکثر می‌تواند ۵۰۰ ردیف اطلاعات داشته باشد."], totalRows: dataRows.length };
  }
  const indexes = fieldIndexes(headers, type);
  const required = type === "salary" ? ["employee_name", "amount", "month"] : ["title", "amount", "date"];
  const missingColumns = required.filter((field) => indexes[field] < 0);
  if (missingColumns.length) {
    const labels = { title: "عنوان", amount: "مبلغ", date: "تاریخ", employee_name: "نام کارمند", month: "ماه" };
    return {
      records: [],
      errors: [`ستون‌های الزامی در فایل پیدا نشد: ${missingColumns.map((field) => labels[field]).join("، ")}`],
      totalRows: dataRows.length,
    };
  }

  const records = [];
  const errors = [];
  dataRows.forEach((row, index) => {
    const rowNumber = index + 2;
    const rowLabel = rowNumber.toLocaleString("fa-IR");
    const value = (field) => indexes[field] < 0 ? "" : String(row[indexes[field]] ?? "").trim();
    const title = value("title");
    const employeeName = value("employee_name");
    const amount = parseAmount(value("amount"));
    const dateInput = value("date");
    const date = normalizeDate(dateInput);
    const monthInput = toLatinDigits(value("month")).trim();
    const month = monthInput || (date ? date.slice(0, 7) : "");

    const missing = type === "salary"
      ? (!employeeName ? "نام کارمند" : !month ? "ماه" : "")
      : (!title ? "عنوان" : !dateInput ? "تاریخ" : "");
    if (missing) {
      errors.push(`ردیف ${rowLabel}: فیلد «${missing}» خالی است.`);
      return;
    }
    if (amount === null) {
      errors.push(`ردیف ${rowLabel}: مبلغ معتبر نیست.`);
      return;
    }
    if (type !== "salary" && !date) {
      errors.push(`ردیف ${rowLabel}: تاریخ معتبر نیست.`);
      return;
    }
    if (type === "salary" && dateInput && !date) {
      errors.push(`ردیف ${rowLabel}: تاریخ معتبر نیست.`);
      return;
    }

    const record = type === "salary"
      ? { employee_name: employeeName, amount, month, status: normalizeStatus(type, value("status")) }
      : { title, amount, date, status: type === "expense" ? normalizeStatus(type, value("status")) : undefined };
    if (type === "expense") {
      const categoryInput = value("category");
      const category = categoryInput ? CATEGORIES.find((candidate) => normalizeHeader(candidate) === normalizeHeader(categoryInput)) : "عمومی";
      record.category = category || "";
      if (indexes.project_name >= 0 && value("project_name")) record.project_name = value("project_name");
    }
    if (type === "income" && value("description")) record.description = value("description");
    if (type === "salary") {
      let invalidOptionalAmount = false;
      for (const field of ["base_pay", "overtime", "deductions", "benefits"]) {
        const raw = value(field);
        if (!raw) continue;
        const number = parseAmount(raw);
        if (number === null) {
          const fieldLabels = { base_pay: "حقوق پایه", overtime: "اضافه‌کاری", deductions: "کسورات", benefits: "مزایا" };
          errors.push(`ردیف ${rowLabel}: مقدار «${fieldLabels[field]}» معتبر نیست.`);
          invalidOptionalAmount = true;
        }
        else record[field] = number;
      }
      if (invalidOptionalAmount) return;
      if (value("date")) record.date = date;
      if (value("notes")) record.notes = value("notes");
    }

    if ((type === "expense" || type === "salary") && !record.status) {
      errors.push(`ردیف ${rowLabel}: وضعیت معتبر نیست.`);
      return;
    }
    if (type === "expense" && !record.category) {
      errors.push(`ردیف ${rowLabel}: دسته‌بندی هزینه معتبر نیست.`);
      return;
    }
    records.push(record);
  });

  return { records, errors, totalRows: dataRows.length };
}
