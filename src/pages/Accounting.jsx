import { useEffect, useState, useMemo } from "react";
import { studio } from "@/api/studioClient";
import { Plus, Trash2, X, BarChart3, PieChart as PieChartIcon, Upload, Lock, FileText, Filter, Pencil, ChevronDown } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import PersianDatePicker from "@/components/PersianDatePicker";
import SalarySlip from "@/components/SalarySlip";
import { useDeleteUndo } from "@/hooks/useDeleteUndo.jsx";
import { getPersianDate } from "@/components/PersianDatePicker";
import { toast } from "@/components/ui/use-toast";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { accountingRecordKey, parseAccountingCsv } from "@/lib/accounting-csv";

function ExpenseRow({ expense, isLocked, onDelete, onEdit }) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 hover:bg-accent/30 transition-colors ${isLocked ? "opacity-60 bg-muted/30" : ""}`}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm truncate">{expense.title}</p>
            {isLocked && <span className="text-xs bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-full flex items-center gap-1"><Lock className="w-3 h-3" /> قفل</span>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{expense.date}{expense.category ? ` • ${expense.category}` : ""}{expense.project_name ? ` • ${expense.project_name}` : ""}</p>
        </div>
      </div>
      <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
        <p className="font-bold text-sm text-red-600">−{faNum(expense.amount)}</p>
        {!isLocked && (
          <>
            <button onClick={onEdit} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-primary border border-primary/20 rounded-lg hover:bg-primary/5" title="ویرایش هزینه"><Pencil className="w-4 h-4" /><span>ویرایش</span></button>
            <button onClick={onDelete} className="p-2 text-muted-foreground hover:text-red-500 hover:bg-destructive/10 rounded-lg transition-colors" title="حذف">
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}
        {isLocked && <Lock className="w-5 h-5 text-slate-400" title="دوره محاسبی قفل شده" />}
      </div>
    </div>
  );
}

function SalaryRow({ salary, isLocked, onDelete, onEdit, onViewSlip }) {
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ status: salary.status });

  const handleSave = () => {
    onEdit(editForm);
    setEditing(false);
  };

  return (
    <div className={`flex items-center justify-between p-4 hover:bg-accent/30 transition-colors ${isLocked ? "opacity-50 bg-muted/30" : ""}`}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${salary.status === "paid" ? "bg-green-100" : "bg-amber-100"}`}>
          <span className={`text-lg font-bold ${salary.status === "paid" ? "text-green-600" : "text-amber-600"}`}>
            {salary.status === "paid" ? "✓" : "⟳"}
          </span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm truncate">{salary.employee_name}</p>
            {salary.status === "paid" && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">پرداخت شده</span>}
            {salary.status === "pending" && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">در انتظار</span>}
            {isLocked && <span className="text-xs bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-full flex items-center gap-1"><Lock className="w-3 h-3" /> قفل</span>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{salary.month} {salary.base_pay ? `• پایه: ${faNum(salary.base_pay)}` : ""} {salary.overtime ? `• اضافه: ${faNum(salary.overtime)}` : ""} {salary.deductions ? `• کسورات: ${faNum(salary.deductions)}` : ""} {salary.benefits ? `• مزایا: ${faNum(salary.benefits)}` : ""}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <p className="font-bold text-sm text-red-600">−{faNum(salary.amount)}</p>
        {!isLocked && (
          <>
            {editing ? (
              <div className="flex items-center gap-1">
                <select value={editForm.status} onChange={(e) => setEditForm({...editForm, status: e.target.value})} className="text-xs border border-input rounded px-2 py-1 bg-card">
                  <option value="pending">در انتظار</option>
                  <option value="paid">پرداخت</option>
                </select>
                <button onClick={handleSave} className="text-xs bg-primary text-white px-2 py-1 rounded">ذخیره</button>
                <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground hover:text-foreground">انصراف</button>
              </div>
            ) : (
              <button onClick={() => setEditing(true)} className="p-1.5 text-muted-foreground hover:text-primary rounded-lg hover:bg-accent" title="ویرایش وضعیت">
                <FileText className="w-3.5 h-3.5" />
              </button>
            )}
            <button onClick={() => onViewSlip?.(salary)} className="p-1.5 text-muted-foreground hover:text-primary rounded-lg hover:bg-accent" title="مشاهده فیش حقوق">
              <FileText className="w-3.5 h-3.5" />
            </button>
            <button onClick={onDelete} className="p-2 text-muted-foreground hover:text-red-500 hover:bg-destructive/10 rounded-lg transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}
        {isLocked && <Lock className="w-5 h-5 text-slate-400" title="دوره محاسبی قفل شده" />}
      </div>
    </div>
  );
}

const faNum = (n) => Number(n || 0).toLocaleString("fa-IR");
const sortAccountingRecords = (records, sortOrder) => [...records].sort((a, b) => {
  if (sortOrder.startsWith("amount")) {
    const difference = Number(a.amount || 0) - Number(b.amount || 0);
    return sortOrder === "amount-asc" ? difference : -difference;
  }
  if (sortOrder === "title-asc") return String(a.title || a.employee_name || "").localeCompare(String(b.title || b.employee_name || ""), "fa");
  const dateA = String(a.date || a.month || a.created_date || "");
  const dateB = String(b.date || b.month || b.created_date || "");
  const difference = dateA.localeCompare(dateB);
  return sortOrder === "date-asc" ? difference : -difference;
});
const categories = ["عمومی", "آب/برق/گاز", "اینترنت", "پذیرایی", "تجهیزات", "تبلیغات", "حقوق", "سایر"];
const categoryLabels = { عمومی: "هزینه جاری", "آب/برق/گاز": "آب، برق و گاز", اینترنت: "اینترنت و سرور", پذیرایی: "پذیرایی", تجهیزات: "تجهیزات", تبلیغات: "تبلیغات", حقوق: "حقوق و دستمزد", سایر: "سایر" };
function currentPersianMonthRange() {
  const [year, month, day] = getPersianDate(0).split("/");
  return { from: `${year}/${month}/01`, to: `${year}/${month}/${day}` };
}
const months = [
  { value: "01", label: "فروردین" },
  { value: "02", label: "اردیبهشت" },
  { value: "03", label: "خرداد" },
  { value: "04", label: "تیر" },
  { value: "05", label: "مرداد" },
  { value: "06", label: "شهریور" },
  { value: "07", label: "مهر" },
  { value: "08", label: "آبان" },
  { value: "09", label: "آذر" },
  { value: "10", label: "دی" },
  { value: "11", label: "بهمن" },
  { value: "12", label: "اسفند" },
];

export default function Accounting() {
  const [tab, setTab] = useState("expense");
  const [expenses, setExpenses] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showCharts, setShowCharts] = useState(false);
  const [showDateFilters, setShowDateFilters] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  // Start with the current month while keeping every historical record intact.
  const [dateRange, setDateRange] = useState(currentPersianMonthRange);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sortOrder, setSortOrder] = useState("date-desc");
  const [lockedPeriods, setLockedPeriods] = useState([]);
  const [showLockModal, setShowLockModal] = useState(false);
  const [lockMonth, setLockMonth] = useState("");
  const [salarySlip, setSalarySlip] = useState(null);
  const [expandedMonths, setExpandedMonths] = useState({});

  const loadAll = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    const [e, i, s, periodLocks] = await Promise.all([
      studio.entities.Expense.list("-created_date"),
      studio.entities.Income.list("-created_date"),
      studio.entities.Salary.list("-created_date"),
      studio.entities.AccountingPeriodLock.list(),
    ]);
    setExpenses(e);
    setIncomes(i);
    setSalaries(s);
    setLockedPeriods((periodLocks || []).map((period) => period.period_key));
    if (!silent) setLoading(false);
  };


  // Delete-with-undo hooks — declared at top level before any usage to prevent minifier TDZ errors
  const { deleteWithUndo: deleteExpense } = useDeleteUndo("Expense", (id) => studio.entities.Expense.delete(id), loadAll);
  const { deleteWithUndo: deleteIncome } = useDeleteUndo("Income", (id) => studio.entities.Income.delete(id), loadAll);
  const { deleteWithUndo: deleteSalary } = useDeleteUndo("Salary", (id) => studio.entities.Salary.delete(id), loadAll);

  useEffect(() => {
    loadAll();
  }, []);


  const tabs = useMemo(() => [
    { id: "expense", label: "هزینه‌ها", count: expenses.length, total: expenses.reduce((s, e) => s + (e.amount || 0), 0) },
    { id: "income", label: "درآمدها", count: incomes.length, total: incomes.reduce((s, i) => s + (i.amount || 0), 0) },
    { id: "salary", label: "حقوق", count: salaries.length, total: salaries.reduce((s, r) => s + (r.amount || 0), 0) },
  ], [expenses, incomes, salaries]);

  const handleDelete = async (type, id) => {
    const entityList = type === "expense" ? expenses : type === "income" ? incomes : salaries;
    const item = entityList.find(e => e.id === id);
    if (item) setDeleteTarget({ type, id, item });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const entityName = deleteTarget.type === "expense" ? "Expense" : deleteTarget.type === "income" ? "Income" : "Salary";
    if (entityName === "Expense") await deleteExpense(deleteTarget.item);
    else if (entityName === "Income") await deleteIncome(deleteTarget.item);
    else await deleteSalary(deleteTarget.item);
    setDeleteTarget(null);
  };

  const handleLockPeriod = async () => {
    if (!lockMonth) return;
    const period = `${getPersianDate(0).split("/")[0]}/${lockMonth}`;
    if (!lockedPeriods.includes(period)) await studio.entities.AccountingPeriodLock.create({ period_key: period, locked_at: new Date().toISOString() });
    setLockedPeriods((current) => [...new Set([...current, period])]);
    setShowLockModal(false);
    setLockMonth("");
  };

  const isLocked = (date) => {
    if (!date) return false;
    const [year, month] = String(date).split("/");
    return lockedPeriods.includes(`${year}/${month}`);
  };

  const filteredExpenses = useMemo(() => {
    const filtered = expenses.filter((e) => {
      if (dateRange.from && e.date && e.date < dateRange.from) return false;
      if (dateRange.to && e.date && e.date > dateRange.to) return false;
      if (categoryFilter && e.category !== categoryFilter) return false;
      return true;
    });
    return sortAccountingRecords(filtered, sortOrder);
  }, [expenses, dateRange, categoryFilter, sortOrder]);

  const filteredIncomes = useMemo(() => {
    const filtered = incomes.filter((i) => {
      if (dateRange.from && i.date && i.date < dateRange.from) return false;
      if (dateRange.to && i.date && i.date > dateRange.to) return false;
      if (categoryFilter && i.category !== categoryFilter) return false;
      return true;
    });
    return sortAccountingRecords(filtered, sortOrder);
  }, [incomes, dateRange, categoryFilter, sortOrder]);

  const filteredSalaries = useMemo(() => sortAccountingRecords(salaries.filter((salary) => {
    if (dateRange.from && salary.date && salary.date < dateRange.from) return false;
    if (dateRange.to && salary.date && salary.date > dateRange.to) return false;
    return true;
  }), sortOrder), [salaries, dateRange, sortOrder]);

  const availableCategories = useMemo(() => [...new Set([...categories, ...expenses, ...incomes].map((item) => item.category).filter(Boolean))], [expenses, incomes]);

  // Monthly data for charts
  const monthlyData = useMemo(() => {
    const map = {};
    [...filteredExpenses, ...filteredIncomes].forEach((item) => {
      const [year, month] = String(item.date || "").split("/");
      const m = item.month || (year && month ? `${year}/${month}` : "نامشخص");
      if (!map[m]) map[m] = { name: m, هزینه: 0, درآمد: 0 };
      if (filteredExpenses.includes(item)) map[m].هزینه += item.amount || 0;
      else map[m].درآمد += item.amount || 0;
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredExpenses, filteredIncomes]);

  // Category data for pie chart
  const categoryData = useMemo(() => {
    const map = {};
    filteredExpenses.forEach((e) => {
      const c = e.category || "عمومی";
      map[c] = (map[c] || 0) + (e.amount || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filteredExpenses]);

  const expenseCategories = useMemo(() => {
    const totals = categoryData.map((item) => ({ ...item, percent: filteredExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0) ? Math.round(item.value * 100 / filteredExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0)) : 0 }));
    return totals.sort((a, b) => b.value - a.value);
  }, [categoryData, filteredExpenses]);

  const openEdit = (type, item) => setEditingRecord({ type, item });
  const saveRecord = async (type, id, data) => {
    const entityName = type === "expense" ? "Expense" : type === "income" ? "Income" : "Salary";
    await studio.entities[entityName].update(id, data);
    setEditingRecord(null);
    await loadAll();
    toast({ title: "تغییرات ذخیره شد" });
  };

  const groupedRecords = (records) => {
    const groups = records.reduce((acc, item) => {
      const [year, month] = String(item.date || "").split("/");
      const key = year && month ? `${year}/${month}` : "بدون تاریخ";
      (acc[key] ||= []).push(item);
      return acc;
    }, {});
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a)).map(([key, items]) => ({
      key, items, total: items.reduce((sum, item) => sum + (item.amount || 0), 0),
      label: key === "بدون تاریخ" ? key : `${months.find((month) => month.value === key.split("/")[1])?.label || key} ${key.split("/")[0]}`,
    }));
  };

  const colors = ["hsl(252 63% 58%)", "hsl(173 58% 39%)", "hsl(197 70% 50%)", "hsl(43 74% 66%)", "hsl(27 87% 67%)", "hsl(0 84% 60%)"];

  if (loading)
    return (
      <div className="flex justify-center p-20">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">حسابداری</h1>
          <p className="text-muted-foreground mt-1">ثبت و مدیریت درآمدها، هزینه‌ها و حقوق؛ تحلیل‌ها در بخش گزارش‌ها</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCsvImport(true)}
            className="border border-input rounded-xl px-4 py-2.5 text-sm bg-card hover:border-primary/40 hover:text-primary flex items-center gap-2"
          >
            <Upload className="w-4 h-4" /> ورود CSV
          </button>
          <button
            onClick={() => setShowCharts(!showCharts)}
            aria-label={showCharts ? "مخفی کردن نمودار" : "نمایش نمودار"}
            title={showCharts ? "مخفی کردن نمودار" : "نمایش نمودار"}
            className={`inline-flex items-center justify-center gap-2 border border-input rounded-xl p-2.5 sm:px-4 text-sm bg-card hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary/30 ${showCharts ? "border-primary bg-primary/5" : ""}`}
          >
            <BarChart3 className="w-5 h-5" /><span className="hidden sm:inline">{showCharts ? "مخفی نمودار" : "نمایش نمودار"}</span>
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <Plus className="w-5 h-5" /> ثبت جدید
          </button>
        </div>
      </div>

      {/* Date Range & Lock Period */}
      <div className="bg-card border border-border rounded-xl p-3 sm:p-4 space-y-3">
        <button type="button" onClick={() => setShowDateFilters((shown) => !shown)} aria-expanded={showDateFilters} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm hover:bg-accent">
          <Filter className="w-4 h-4" /> بازه زمانی <ChevronDown className={`w-4 h-4 transition-transform ${showDateFilters ? "rotate-180" : ""}`} />
        </button>
        {showDateFilters && <>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground font-medium">
            <Filter className="w-4 h-4" /> بازه زمانی:
          </span>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {dateRange.from || dateRange.to ? "نمایش ماه انتخاب‌شده" : "نمایش همه ماه‌ها"}
          </span>
          <PersianDatePicker label="از تاریخ" value={dateRange.from} onChange={(v) => setDateRange({...dateRange, from: v})} placeholder="از تاریخ" />
          <PersianDatePicker label="تا تاریخ" value={dateRange.to} onChange={(v) => setDateRange({...dateRange, to: v})} placeholder="تا تاریخ" />
          <button
            onClick={() => setDateRange((range) => range.from || range.to ? { from: "", to: "" } : currentPersianMonthRange())}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" /> {dateRange.from || dateRange.to ? "نمایش همه درآمدها و هزینه‌ها" : "بازگشت به ماه جاری"}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border">
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground font-medium">
            <Lock className="w-4 h-4" /> قفل دورهٔ حسابداری:
          </span>
          {lockedPeriods.length > 0 && (
            <span className="flex flex-wrap gap-1">
              {lockedPeriods.map((m) => (
                <span key={m} className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-full flex items-center gap-1">
                  <Lock className="w-3 h-3" /> {periodLabel(m)}
                </span>
              ))}
            </span>
          )}
          <button onClick={() => setShowLockModal(true)} className="text-sm text-primary hover:underline flex items-center gap-1">
            <Lock className="w-4 h-4" /> قفل ماه
          </button>
        </div>
        </>}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`text-right p-5 rounded-2xl border transition-all ${tab === t.id ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"}`}
          >
            <p className="text-sm text-muted-foreground">{t.label}</p>
            <p className="text-2xl font-bold mt-1">{faNum(t.id === "expense" ? filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0) : t.id === "income" ? filteredIncomes.reduce((s, i) => s + (i.amount || 0), 0) : t.total)}</p>
            <p className="text-xs text-muted-foreground mt-1">{faNum(t.id === "expense" ? filteredExpenses.length : t.id === "income" ? filteredIncomes.length : t.count)} مورد</p>
          </button>
        ))}
      </div>

      {/* Charts Section */}
      {showCharts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Income vs Expense Chart */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <h2 className="font-bold text-lg mb-6">مقایسه درآمد و هزینه (ماهانه)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12, fontFamily: "Vazirmatn" }} />
                <YAxis tick={{ fontSize: 11, fontFamily: "Vazirmatn" }} tickFormatter={(v) => faNum(v / 1000000) + "م"} />
                <Tooltip formatter={(v) => faNum(v) + " تومان"} contentStyle={{ fontFamily: "Vazirmatn", borderRadius: 12, border: "1px solid hsl(var(--border))" }} />
                <Legend wrapperStyle={{ fontFamily: "Vazirmatn" }} />
                <Bar dataKey="درآمد" fill="hsl(173 58% 39%)" radius={[8, 8, 0, 0]} />
                <Bar dataKey="هزینه" fill="hsl(0 84% 60%)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Category Pie Chart */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <h2 className="font-bold text-lg mb-6">هزینه‌ها بر اساس دسته‌بندی</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={(e) => e.name}>
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={colors[i % colors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => faNum(v) + " تومان"} contentStyle={{ fontFamily: "Vazirmatn", borderRadius: 12 }} />
                <Legend wrapperStyle={{ fontFamily: "Vazirmatn" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Expense category totals */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <PieChartIcon className="w-5 h-5 text-primary" /> دسته‌بندی کلی هزینه‌ها
          </h2>
          <span className="text-xs sm:text-sm text-muted-foreground">مجموع: {faNum(filteredExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0))} تومان</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {expenseCategories.length ? expenseCategories.map((category) => (
            <div key={category.name} className="p-4 rounded-xl border border-border bg-card min-w-0">
              <div className="flex items-center justify-between gap-2 mb-2"><span className="text-sm font-medium truncate">{categoryLabels[category.name] || category.name}</span><span className="text-xs text-muted-foreground">{faNum(category.percent)}٪</span></div>
              <div className="h-2 bg-accent rounded-full overflow-hidden mb-2"><div className="h-full rounded-full bg-primary" style={{ width: `${category.percent}%` }} /></div>
              <p className="text-sm font-bold">{faNum(category.value)} تومان</p>
              <p className="text-xs text-muted-foreground mt-1">{faNum(filteredExpenses.filter((expense) => (expense.category || "عمومی") === category.name).length)} رکورد</p>
            </div>
          )) : <p className="text-sm text-muted-foreground col-span-full">در این بازه هزینه‌ای ثبت نشده است.</p>}
        </div>
      </div>

      {/* Main List */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/20 p-3 sm:p-4">
          <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground"><Filter className="w-4 h-4" /> دسته‌بندی و مرتب‌سازی</span>
          {(tab === "expense" || tab === "income") && <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="فیلتر دسته‌بندی" className="min-w-36 rounded-xl border border-input bg-card px-3 py-2 text-sm">
            <option value="">همه دسته‌بندی‌ها</option>
            {availableCategories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>}
          <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} aria-label="مرتب‌سازی فهرست" className="min-w-44 rounded-xl border border-input bg-card px-3 py-2 text-sm">
            <option value="date-desc">تاریخ: جدید به قدیم</option>
            <option value="date-asc">تاریخ: قدیم به جدید</option>
            <option value="amount-desc">مبلغ: بیشترین</option>
            <option value="amount-asc">مبلغ: کمترین</option>
            <option value="title-asc">عنوان: الفبایی</option>
          </select>
          {categoryFilter && <button type="button" onClick={() => setCategoryFilter("")} className="text-xs text-primary hover:underline">پاک‌کردن دسته‌بندی</button>}
        </div>
        {loading ? (
          <div className="flex justify-center p-12">
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {tab === "expense" && groupedRecords(filteredExpenses).map((group) => (
              <MonthAccordion key={group.key} group={group} expanded={expandedMonths[group.key] ?? (group.key === getPersianDate(0).slice(0, 7))} onToggle={() => setExpandedMonths((state) => ({ ...state, [group.key]: !(state[group.key] ?? (group.key === getPersianDate(0).slice(0, 7))) }))}>
                {group.items.map((expense) => <ExpenseRow key={expense.id} expense={expense} isLocked={isLocked(expense.date)} onDelete={() => handleDelete("expense", expense.id)} onEdit={() => openEdit("expense", expense)} />)}
              </MonthAccordion>
            ))}
            {tab === "income" && groupedRecords(filteredIncomes).map((group) => (
              <MonthAccordion key={group.key} group={group} expanded={expandedMonths[group.key] ?? (group.key === getPersianDate(0).slice(0, 7))} onToggle={() => setExpandedMonths((state) => ({ ...state, [group.key]: !(state[group.key] ?? (group.key === getPersianDate(0).slice(0, 7))) }))}>
                {group.items.map((income) => <Row key={income.id} title={income.title} sub={income.date || income.description} amount={income.amount} positive isLocked={isLocked(income.date)} onDelete={() => handleDelete("income", income.id)} onEdit={() => openEdit("income", income)} />)}
              </MonthAccordion>
            ))}
            {tab === "salary" && filteredSalaries.map((s) => (
              <SalaryRow key={s.id} salary={s} isLocked={isLocked(s.date)} onDelete={() => handleDelete("salary", s.id)} onEdit={(data) => studio.entities.Salary.update(s.id, data).then(loadAll)} onViewSlip={(slip) => setSalarySlip(slip)} />
            ))}
            {((tab === "expense" && filteredExpenses.length === 0) || (tab === "income" && filteredIncomes.length === 0) || (tab === "salary" && filteredSalaries.length === 0)) && (
              <p className="text-center text-muted-foreground py-12">موردی ثبت نشده است</p>
            )}
          </div>
        )}
      </div>

      {showForm && <FormModal tab={tab} isDateLocked={isLocked} onClose={() => setShowForm(false)} onSaved={loadAll} />}
      {editingRecord && <FormModal tab={editingRecord.type} isDateLocked={isLocked} initial={editingRecord.item} onClose={() => setEditingRecord(null)} onSaved={(data) => saveRecord(editingRecord.type, editingRecord.item.id, data)} />}

      {showCsvImport && (
        <ImportCsvModal
          initialType={tab}
          existingRecords={{ expense: expenses, income: incomes, salary: salaries }}
          onClose={() => setShowCsvImport(false)}
          onSaved={() => loadAll({ silent: true })}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={`حذف ${deleteTarget.type === "expense" ? "هزینه" : deleteTarget.type === "income" ? "درآمد" : "حقوق"}`}
          description={`مورد «${deleteTarget.item.title || deleteTarget.item.employee_name || ""}» بلافاصله حذف می‌شود. آیا مطمئن هستید؟`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
          confirmText="بله، حذف شود"
        />
      )}

      {showLockModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowLockModal(false)}>
          <div className="bg-card rounded-2xl w-full max-w-sm p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">قفل دوره محاسبی</h3>
              <button onClick={() => setShowLockModal(false)} className="p-2 hover:bg-accent rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">قفل دوره برای بستن حساب‌های یک ماه است؛ پس از قفل، رکوردهای هزینه و حقوق آن ماه فقط خواندنی می‌شوند تا تغییر ناخواسته‌ای در گزارش نهایی ایجاد نشود.</p>
            <label className="text-sm font-medium block mb-1.5">ماه در سال {getPersianDate(0).split("/")[0]}</label>
            <select
              value={lockMonth}
              onChange={(e) => setLockMonth(e.target.value)}
              className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">انتخاب کنید</option>
              {months.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <div className="flex gap-2 mt-5">
              <button onClick={handleLockPeriod} disabled={!lockMonth} className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-xl font-medium disabled:opacity-50 hover:opacity-90 transition-opacity">
                قفل شود
              </button>
              <button onClick={() => setShowLockModal(false)} className="px-4 py-2.5 text-sm text-muted-foreground border border-border rounded-xl hover:bg-accent">
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {salarySlip && (
        <SalarySlip salary={salarySlip} onClose={() => setSalarySlip(null)} />
      )}
    </div>
  );
}


function ImportCsvModal({ initialType, existingRecords, onClose, onSaved }) {
  const [type, setType] = useState(initialType);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState(null);
  const [summary, setSummary] = useState(null);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const typeLabels = { expense: "هزینه‌ها", income: "درآمدها", salary: "حقوق" };
  const entityNames = { expense: "Expense", income: "Income", salary: "Salary" };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setSummary(null);
    setPreview(null);
    setFileName(file.name);
    if (file.size > 5 * 1024 * 1024) {
      setPreview({ records: [], errors: ["حجم فایل باید کمتر از ۵ مگابایت باشد."], totalRows: 0, duplicates: 0 });
      return;
    }

    setReading(true);
    try {
      const parsed = parseAccountingCsv(await readCsvFile(file), type);
      const knownRecords = new Set((existingRecords[type] || []).map((record) => accountingRecordKey(type, record)));
      const records = [];
      let duplicates = 0;
      parsed.records.forEach((record) => {
        const key = accountingRecordKey(type, record);
        if (knownRecords.has(key)) duplicates += 1;
        else {
          knownRecords.add(key);
          records.push(record);
        }
      });
      setPreview({ ...parsed, records, duplicates });
    } catch {
      setPreview({ records: [], errors: ["خواندن فایل ناموفق بود. لطفاً فایل CSV سالم انتخاب کنید."], totalRows: 0, duplicates: 0 });
    } finally {
      setReading(false);
    }
  };

  const handleImport = async () => {
    if (!preview?.records?.length || importing) return;
    setImporting(true);
    setProgress(0);
    let created = 0;
    const failures = [];
    const batchSize = 8;

    for (let start = 0; start < preview.records.length; start += batchSize) {
      const batch = preview.records.slice(start, start + batchSize);
      const results = await Promise.allSettled(
        batch.map((record) => studio.entities[entityNames[type]].create(record))
      );
      results.forEach((result, index) => {
        if (result.status === "fulfilled") created += 1;
        else failures.push(`ردیف ${start + index + 2}: ${result.reason?.message || "ثبت ناموفق بود."}`);
      });
      setProgress(Math.min(start + batch.length, preview.records.length));
    }

    try {
      await onSaved();
    } catch {
      // Imported rows stay saved; the next page load will refresh the list.
    }
    setSummary({ created, failures, duplicates: preview.duplicates, invalid: preview.errors.length, total: preview.totalRows });
    setImporting(false);
  };

  const rows = [
    { value: "expense", label: "هزینه", headers: "عنوان، مبلغ، تاریخ، دسته‌بندی، وضعیت، پروژه" },
    { value: "income", label: "درآمد", headers: "عنوان، مبلغ، تاریخ، توضیحات" },
    { value: "salary", label: "حقوق", headers: "نام کارمند، مبلغ، ماه، تاریخ، وضعیت، حقوق پایه، اضافه‌کاری، کسورات، مزایا، یادداشت" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={importing ? undefined : onClose}>
      <div dir="rtl" className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-2xl bg-card p-5 shadow-xl sm:p-6" onClick={(event) => event.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold"><Upload className="h-5 w-5 text-primary" /> ورود فایل حسابداری</h2>
            <p className="mt-1 text-xs text-muted-foreground">CSV با ستون‌های فارسی یا انگلیسی؛ حداکثر ۵۰۰ ردیف</p>
          </div>
          <button onClick={onClose} disabled={importing} className="rounded-lg p-2 hover:bg-accent disabled:opacity-50" aria-label="بستن">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!summary && (
          <>
            <label className="mb-1.5 block text-sm font-medium">نوع اطلاعات فایل</label>
            <select
              value={type}
              disabled={reading || importing}
              onChange={(event) => { setType(event.target.value); setPreview(null); setFileName(""); }}
              className="mb-4 w-full rounded-xl border border-input bg-card px-4 py-2.5 text-sm"
            >
              {rows.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>

            <div className="mb-4 rounded-xl bg-accent/40 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">ستون‌های پیشنهادی برای {rows.find((row) => row.value === type)?.label}:</p>
              <p className="mt-1 leading-6">{rows.find((row) => row.value === type)?.headers}</p>
              <p className="mt-1">مبلغ‌ها به تومان و تاریخ‌ها به شمسی وارد شوند؛ تاریخ میلادی هم به شمسی تبدیل می‌شود.</p>
            </div>

            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-input px-4 py-5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent/30">
              <Upload className="h-4 w-4" />
              {reading ? "در حال خواندن فایل..." : fileName || "انتخاب فایل CSV"}
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} disabled={reading || importing} />
            </label>

            {preview && (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-green-50 p-2 text-green-700">قابل ورود: {faNum(preview.records.length)}</div>
                  <div className="rounded-lg bg-amber-50 p-2 text-amber-700">تکراری: {faNum(preview.duplicates)}</div>
                  <div className="rounded-lg bg-red-50 p-2 text-red-700">خطا: {faNum(preview.errors.length)}</div>
                </div>
                {preview.records.length > 0 && (
                  <div className="max-h-36 overflow-y-auto rounded-xl border border-border text-xs">
                    {preview.records.slice(0, 5).map((record, index) => (
                      <div key={`${accountingRecordKey(type, record)}-${index}`} className="flex items-center justify-between gap-3 border-b border-border p-2 last:border-0">
                        <span className="truncate">{record.title || record.employee_name}</span>
                        <span className="shrink-0">{faNum(record.amount)} تومان</span>
                      </div>
                    ))}
                    {preview.records.length > 5 && <p className="p-2 text-center text-muted-foreground">و {faNum(preview.records.length - 5)} ردیف دیگر</p>}
                  </div>
                )}
                {preview.errors.length > 0 && (
                  <div className="max-h-28 overflow-y-auto rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700" role="alert">
                    {preview.errors.slice(0, 6).map((error, index) => <p key={index}>{error}</p>)}
                    {preview.errors.length > 6 && <p className="mt-1">و {faNum(preview.errors.length - 6)} خطای دیگر</p>}
                  </div>
                )}
              </div>
            )}

            {importing && (
              <p className="mt-3 text-center text-xs text-muted-foreground">در حال ورود {faNum(progress)} از {faNum(preview?.records.length || 0)} ردیف…</p>
            )}
            <div className="mt-5 flex gap-2">
              <button onClick={handleImport} disabled={!preview?.records?.length || reading || importing} className="flex-1 rounded-xl bg-primary px-4 py-3 font-medium text-primary-foreground disabled:opacity-50">
                {importing ? "در حال ورود..." : `ورود ${faNum(preview?.records?.length || 0)} ردیف`}
              </button>
              <button onClick={onClose} disabled={importing} className="rounded-xl border border-border px-4 py-3 text-sm text-muted-foreground disabled:opacity-50">انصراف</button>
            </div>
          </>
        )}

        {summary && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border p-4">
              <h3 className="font-semibold">ورود {typeLabels[type]} تمام شد</h3>
              <p className="mt-2 text-sm text-green-700">ثبت‌شده: {faNum(summary.created)} ردیف</p>
              {summary.duplicates > 0 && <p className="mt-1 text-sm text-amber-700">تکراری و ردشده: {faNum(summary.duplicates)} ردیف</p>}
              {summary.invalid > 0 && <p className="mt-1 text-sm text-amber-700">نامعتبر و ردشده: {faNum(summary.invalid)} ردیف</p>}
              {summary.failures.length > 0 && (
                <div className="mt-3 max-h-32 overflow-y-auto rounded-lg bg-red-50 p-3 text-xs text-red-700" role="alert">
                  {summary.failures.slice(0, 10).map((failure) => <p key={failure}>{failure}</p>)}
                  {summary.failures.length > 10 && <p>و {faNum(summary.failures.length - 10)} خطای دیگر</p>}
                </div>
              )}
            </div>
            <button onClick={onClose} className="w-full rounded-xl bg-primary px-4 py-3 font-medium text-primary-foreground">بستن</button>
          </div>
        )}
      </div>
    </div>
  );
}

async function readCsvFile(file) {
  const bytes = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    try {
      return new TextDecoder("windows-1256").decode(bytes);
    } catch {
      return new TextDecoder().decode(bytes);
    }
  }
}


function Row({ title, sub, amount, category, positive, isLocked, onDelete, onEdit }) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 hover:bg-accent/30 transition-colors ${isLocked ? "opacity-60 bg-muted/30" : ""}`}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{title}</p>
          <p className="text-xs text-muted-foreground">{sub}{category ? ` • ${category}` : ""}</p>
        </div>
      </div>
      <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
        <p className={`font-bold text-sm ${positive ? "text-green-600" : "text-red-600"}`}>{positive ? "+" : "−"}{faNum(amount)}</p>
        {!isLocked && <>
          <button onClick={onEdit} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-primary border border-primary/20 rounded-lg hover:bg-primary/5" title="ویرایش درآمد"><Pencil className="w-4 h-4" /><span>ویرایش</span></button>
          <button onClick={onDelete} className="p-2 text-muted-foreground hover:text-red-500 hover:bg-destructive/10 rounded-lg transition-colors" title="حذف"><Trash2 className="w-4 h-4" /></button>
        </>}
        {isLocked && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Lock className="w-4 h-4" /> قفل</span>}
      </div>
    </div>
  );
}

function MonthAccordion({ group, expanded, onToggle, children }) {
  return <section>
    <button type="button" onClick={onToggle} aria-expanded={expanded} className="w-full flex items-center justify-between gap-3 p-4 text-right bg-muted/30 hover:bg-muted/60">
      <span className="flex items-center gap-2 font-semibold"><ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />{group.label}<span className="text-xs font-normal text-muted-foreground">{faNum(group.items.length)} رکورد</span></span>
      <span className="text-sm font-bold whitespace-nowrap">{faNum(group.total)} تومان</span>
    </button>
    {expanded && <div className="divide-y divide-border">{children}</div>}
  </section>;
}

function periodLabel(period) {
  const [year, month] = period.split("/");
  return `${months.find((item) => item.value === month)?.label || faNum(month)} ${faNum(year)}`;
}

const digitWords = ["صفر", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
const teenWords = ["ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"];
const tensWords = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
const hundredsWords = ["", "صد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];
function threeDigitWords(value) {
  const n = Number(value) || 0;
  const parts = [];
  if (Math.floor(n / 100)) parts.push(hundredsWords[Math.floor(n / 100)]);
  const rest = n % 100;
  if (rest >= 10 && rest < 20) parts.push(teenWords[rest - 10]);
  else {
    if (Math.floor(rest / 10)) parts.push(tensWords[Math.floor(rest / 10)]);
    if (rest % 10) parts.push(digitWords[rest % 10]);
  }
  return parts.join(" و ");
}
function amountInWords(amount) {
  const number = Math.floor(Number(amount) || 0);
  if (number === 0) return "صفر تومان";
  if (number < 0 || number > 999_999_999_999) return "";
  const scales = ["", "هزار", "میلیون", "میلیارد"];
  const groups = [];
  let rest = number;
  while (rest > 0) {
    groups.push(rest % 1000);
    rest = Math.floor(rest / 1000);
  }
  const parts = groups.map((group, index) => group ? `${threeDigitWords(group)}${scales[index] ? ` ${scales[index]}` : ""}` : "").filter(Boolean).reverse();
  return `${parts.join(" و ")} تومان`;
}

function normalizeDigits(value) {
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  const arabic = "٠١٢٣٤٥٦٧٨٩";
  return String(value).replace(/[۰-۹٠-٩]/g, (digit) => {
    const index = persian.indexOf(digit);
    return String(index >= 0 ? index : arabic.indexOf(digit));
  });
}

function FormModal({ tab, initial, isDateLocked, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    ...(tab === "expense" || tab === "income" ? { date: getPersianDate(0) } : {}),
    ...(tab === "expense" ? { category: "عمومی", status: "approved" } : {}),
    ...(initial || {}),
    amount: initial?.amount ?? "",
  }));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saveError, setSaveError] = useState("");

  const expenseTitleLabel = form.category === "حقوق" ? "شرح حقوق" : form.category === "اینترنت" ? "سرویس یا بازهٔ پرداخت" : form.category === "تجهیزات" ? "نام کالا یا خدمت" : form.category === "پذیرایی" ? "شرح خرید" : "شرح هزینه";
  const contextualFields = form.category === "اینترنت" || form.category === "آب/برق/گاز" ? [
    { name: "provider", label: form.category === "اینترنت" ? "نام سرویس یا شرکت" : "نام شرکت خدماتی", type: "text", required: !initial, placeholder: form.category === "اینترنت" ? "مثلاً سرویس اینترنت یا سرور" : "مثلاً آبفا یا اداره برق" },
    { name: "billing_period", label: "بازهٔ صورتحساب (اختیاری)", type: "text", placeholder: "مثلاً مهر ۱۴۰۵" },
  ] : form.category === "تبلیغات" ? [
    { name: "channel", label: "کانال تبلیغاتی", type: "text", required: !initial, placeholder: "مثلاً اینستاگرام" },
    { name: "campaign", label: "نام یا موضوع کمپین (اختیاری)", type: "text" },
  ] : [];
  const usesStructuredTitle = form.category === "حقوق" || contextualFields.length > 0;
  const fields = tab === "expense" ? [
    { name: "category", label: "دسته‌بندی هزینه", type: "select", options: categories, labels: categories.map((category) => categoryLabels[category]), required: true },
    ...(form.category === "حقوق" ? [
      { name: "payee", label: "نام دریافت‌کننده", type: "text", required: !initial, placeholder: "مثلاً حدیث" },
      { name: "purpose", label: "بابت", type: "text", required: !initial, placeholder: "مثلاً تدوین ویدیو" },
    ] : []),
    ...contextualFields,
    ...((initial || !usesStructuredTitle) ? [{ name: "title", label: expenseTitleLabel, type: "text", required: !initial && !usesStructuredTitle, placeholder: "شرح کوتاه برای گزارش‌های مالی" }] : []),
    { name: "amount", label: "مبلغ (تومان)", type: "amount", required: true },
    { name: "date", label: "تاریخ پرداخت", type: "date", required: true },
    { name: "project_id", label: "پروژه (اختیاری)", type: "text", placeholder: "شناسه پروژه" },
  ] : tab === "income" ? [
    { name: "title", label: "عنوان درآمد", type: "text", required: true },
    { name: "amount", label: "مبلغ (تومان)", type: "amount", required: true },
    { name: "description", label: "توضیحات", type: "text" },
    { name: "date", label: "تاریخ دریافت", type: "date", required: true },
  ] : [
    { name: "employee_name", label: "نام کارمند", type: "text", required: true },
    { name: "amount", label: "مبلغ حقوق", type: "amount", required: true },
    { name: "base_pay", label: "حقوق پایه", type: "amount" },
    { name: "overtime", label: "اضافه‌کاری", type: "amount" },
    { name: "deductions", label: "کسورات", type: "amount" },
    { name: "benefits", label: "مزایا", type: "amount" },
    { name: "month", label: "ماه", type: "text", required: true, placeholder: "مرداد ۱۴۰۵" },
    { name: "status", label: "وضعیت", type: "select", options: ["pending", "paid"], labels: ["در انتظار", "پرداخت شده"] },
  ];

  const entityName = tab === "expense" ? "Expense" : tab === "income" ? "Income" : "Salary";
  const titles = { expense: initial ? "ویرایش هزینه" : "ثبت هزینه", income: initial ? "ویرایش درآمد" : "ثبت درآمد", salary: initial ? "ویرایش حقوق" : "ثبت حقوق" };

  const handleSave = async () => {
    const missingRequiredField = fields.find(
      (field) => field.required && !String(form[field.name] ?? "").trim()
    );
    if (missingRequiredField) {
      setSaveError(`لطفاً فیلد «${missingRequiredField.label}» را تکمیل کنید.`);
      return;
    }
    if (tab !== "salary" && isDateLocked?.(form.date)) {
      setSaveError("این دورهٔ حسابداری قفل است و ثبت یا ویرایش رکورد در آن امکان‌پذیر نیست.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const payload = { ...form };
      ["amount", "base_pay", "overtime", "deductions", "benefits"].forEach((key) => {
        if (payload[key] === "" || payload[key] == null) delete payload[key];
        else payload[key] = Number(String(payload[key]).replace(/[^0-9]/g, ""));
      });
      if (tab === "expense" && form.category === "حقوق" && (form.payee || form.purpose)) {
        payload.title = `حقوق ${form.payee || ""} بابت ${form.purpose || ""}`.trim();
      }
      if (tab === "expense" && ["اینترنت", "آب/برق/گاز"].includes(form.category) && form.provider) {
        payload.title = `${form.provider}${form.billing_period ? ` - ${form.billing_period}` : ""}`;
      }
      if (tab === "expense" && form.category === "تبلیغات" && form.channel) {
        payload.title = `تبلیغات ${form.channel}${form.campaign ? ` - ${form.campaign}` : ""}`;
      }
      ["payee", "purpose", "provider", "billing_period", "channel", "campaign"].forEach((key) => delete payload[key]);
      if (initial) await onSaved(payload);
      else {
        await studio.entities[entityName].create(payload);
        await onSaved();
      }
      toast({ title: initial ? "تغییرات ذخیره شد" : "اطلاعات ثبت شد" });
      onClose();
    } catch (err) {
      console.error(`Failed to create ${entityName}:`, err);
      setSaveError(err?.message || "ثبت اطلاعات ناموفق بود. دوباره تلاش کنید.");
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await studio.integrations.Core.UploadFile({ file });
      setForm({ ...form, receipt_url: file_url });
    } catch (err) {
      console.error("Upload failed", err);
    }
    setUploading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold text-lg">{titles[tab]}</h2>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          {fields.map((f) => (
            <div key={f.name}>
              <label className="text-sm font-medium block mb-1.5">
                {f.label} {f.required && <span className="text-[#D35400]">*</span>}
              </label>
              {f.type === "date" ? (
                <PersianDatePicker label={null} value={form[f.name] || ""} onChange={(value) => setForm({ ...form, [f.name]: value })} placeholder="انتخاب تاریخ" required={f.required} />
              ) : f.type === "amount" ? (
                <>
                  <input type="text" inputMode="numeric" required={f.required} value={form[f.name] === "" ? "" : faNum(String(form[f.name]).replace(/[^۰-۹0-9]/g, ""))} onChange={(e) => setForm({ ...form, [f.name]: normalizeDigits(e.target.value).replace(/[^0-9]/g, "") })} placeholder="مثلاً ۱٬۴۰۰٬۰۰۰" className="w-full border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  {f.name === "amount" && <p className="text-xs text-muted-foreground mt-1.5">{form.amount ? amountInWords(String(form.amount).replace(/[^0-9]/g, "")) : "مبلغ را وارد کنید تا معادل حروفی نمایش داده شود."}</p>}
                </>
              ) : f.type === "select" ? (
                <select
                  value={form[f.name] || ""}
                  onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                  className="w-full border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-card"
                >
                  <option value="">انتخاب کنید</option>
                  {f.options.map((o, i) => (
                    <option key={o} value={o}>{f.labels ? f.labels[i] : o}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type}
                  required={f.required}
                  value={form[f.name] || ""}
                  onChange={(e) => setForm({ ...form, [f.name]: f.type === "number" ? Number(e.target.value) : e.target.value })}
                  placeholder={f.placeholder}
                  className="w-full border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              )}
            </div>
          ))}
          {saveError && (
            <p role="alert" className="text-sm text-destructive">{saveError}</p>
          )}
          {tab === "expense" && (
            <div>
              <label className="text-sm font-medium block mb-1.5">رسید (اختیاری)</label>
              <div className="flex items-center gap-2">
                <label className="flex-1 border border-dashed border-input rounded-xl px-4 py-2.5 text-sm text-muted-foreground cursor-pointer hover:bg-accent/30 flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  {uploading ? "در حال آپلود..." : form.receipt_url ? "فایل آپلود شده ✓" : "آپلود رسید"}
                  <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                </label>
                {form.receipt_url && (
                  <button onClick={() => setForm({ ...form, receipt_url: "" })} className="text-xs text-red-500 hover:underline">حذف</button>
                )}
              </div>
            </div>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-medium mt-6 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? "در حال ذخیره..." : initial ? "ذخیره تغییرات" : "ثبت"}
        </button>
      </div>
    </div>
  );
}
