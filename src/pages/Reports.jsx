import { useEffect, useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { BarChart3, Calendar, FileText, TrendingUp, TrendingDown, Trash2 } from "lucide-react";
import PersianDatePicker from "@/components/PersianDatePicker";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const faNum = (n) => Number(n || 0).toLocaleString("fa-IR");

export default function Reports() {
  const [expenses, setExpenses] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [projects, setProjects] = useState([]);
  const [period] = useState("monthly");
  const [compareMode, setCompareMode] = useState(false);
  const [comparePeriod, setComparePeriod] = useState("previous");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("financial"); // financial, project, team

  useEffect(() => {
    (async () => {
      const [e, i, p] = await Promise.all([
        base44.entities.Expense.list(),
        base44.entities.Income.list(),
        base44.entities.Project.list(),
      ]);
      setExpenses(e);
      setIncomes(i);
      setProjects(p);
      setLoading(false);
    })();
  }, []);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (dateRange.from && e.date && e.date < dateRange.from) return false;
      if (dateRange.to && e.date && e.date > dateRange.to) return false;
      return true;
    });
  }, [expenses, dateRange]);

  const filteredIncomes = useMemo(() => {
    return incomes.filter((i) => {
      if (dateRange.from && i.date && i.date < dateRange.from) return false;
      if (dateRange.to && i.date && i.date > dateRange.to) return false;
      return true;
    });
  }, [incomes, dateRange]);

  // Get previous period data for comparison
  const getPreviousPeriodData = (data) => {
    if (!dateRange.from || !dateRange.to) return [];
    const from = new Date(dateRange.from.replace(/\//g, '-'));
    const to = new Date(dateRange.to.replace(/\//g, '-'));
    const diffDays = Math.ceil((to - from) / (1000 * 60 * 60 * 24));

    const prevFrom = new Date(from);
    prevFrom.setDate(prevFrom.getDate() - diffDays);
    const prevTo = new Date(from);
    prevTo.setDate(prevTo.getDate() - 1);

    return data.filter((item) => {
      const itemDate = new Date(item.date.replace(/\//g, '-'));
      return itemDate >= prevFrom && itemDate <= prevTo;
    });
  };

  const prevExpenses = compareMode ? getPreviousPeriodData(expenses, period) : [];
  const prevIncomes = compareMode ? getPreviousPeriodData(incomes, period) : [];

  const monthlyData = useMemo(() => {
    const map = {};
    const data = filteredExpenses.concat(filteredIncomes);
    const prevData = prevExpenses.concat(prevIncomes);

    data.forEach((item) => {
      const m = item.month || (item.date ? String(item.date).split("/")[1] : "") || "نامشخص";
      if (!map[m]) map[m] = { name: m, هزینه: 0, درآمد: 0 };
      if (filteredExpenses.includes(item)) map[m].هزینه += item.amount || 0;
      else map[m].درآمد += item.amount || 0;
    });

    // Add comparison data
    if (compareMode) {
      prevData.forEach((item) => {
        const m = item.month || (item.date ? String(item.date).split("/")[1] : "") || "نامشخص";
        if (!map[m]) map[m] = { name: m, هزینه: 0, درآمد: 0 };
        map[m].هزینه_قبلی = (map[m].هزینه_قبلی || 0) + (filteredExpenses.includes(item) ? item.amount || 0 : 0);
        map[m].درآمد_قبلی = (map[m].درآمد_قبلی || 0) + (filteredIncomes.includes(item) ? item.amount || 0 : 0);
      });
    }

    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredExpenses, filteredIncomes, compareMode, prevExpenses, prevIncomes]);

  const weeklyData = useMemo(() => {
    const weeks = [{ name: "هفته ۱", هزینه: 0, درآمد: 0 }, { name: "هفته ۲", هزینه: 0, درآمد: 0 }, { name: "هفته ۳", هزینه: 0, درآمد: 0 }, { name: "هفته ۴", هزینه: 0, درآمد: 0 }];
    filteredExpenses.forEach((e) => {
      const d = parseInt(String(e.date || "").split("/")[2] || "0");
      const w = Math.min(3, Math.floor((d - 1) / 7));
      weeks[w].هزینه += e.amount || 0;
    });
    filteredIncomes.forEach((i) => {
      const d = parseInt(String(i.date || "").split("/")[2] || "0");
      const w = Math.min(3, Math.floor((d - 1) / 7));
      weeks[w].درآمد += i.amount || 0;
    });
    return weeks;
  }, [filteredExpenses, filteredIncomes]);

  const categoryData = useMemo(() => {
    const map = {};
    filteredExpenses.forEach((e) => {
      const c = e.category || "عمومی";
      map[c] = (map[c] || 0) + (e.amount || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filteredExpenses]);

  // Project profitability data
  const projectProfitability = useMemo(() => {
    const map = {};
    filteredExpenses.forEach((e) => {
      if (e.project_id) {
        if (!map[e.project_id]) map[e.project_id] = { id: e.project_id, name: e.project_name || "بدون نام", expenses: 0, incomes: 0 };
        map[e.project_id].expenses += e.amount || 0;
      }
    });
    filteredIncomes.forEach((i) => {
      if (i.project_id) {
        if (!map[i.project_id]) map[i.project_id] = { id: i.project_id, name: i.project_name || "بدون نام", expenses: 0, incomes: 0 };
        map[i.project_id].incomes += i.amount || 0;
      }
    });
    return Object.values(map).map(p => ({
      ...p,
      profit: p.incomes - p.expenses,
      profitMargin: p.incomes > 0 ? Math.round(((p.incomes - p.expenses) / p.incomes) * 100) : 0
    })).sort((a, b) => b.profit - a.profit);
  }, [filteredExpenses, filteredIncomes]);

  const chartData = period === "monthly" ? monthlyData : weeklyData;
  const totalExpense = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalIncome = filteredIncomes.reduce((s, i) => s + (i.amount || 0), 0);
  const prevTotalExpense = compareMode ? prevExpenses.reduce((s, e) => s + (e.amount || 0), 0) : 0;
  const prevTotalIncome = compareMode ? prevIncomes.reduce((s, i) => s + (i.amount || 0), 0) : 0;
  const expenseChange = prevTotalExpense > 0 ? Math.round(((totalExpense - prevTotalExpense) / prevTotalExpense) * 100) : 0;
  const incomeChange = prevTotalIncome > 0 ? Math.round(((totalIncome - prevTotalIncome) / prevTotalIncome) * 100) : 0;
  const colors = ["hsl(252 63% 58%)", "hsl(173 58% 39%)", "hsl(197 70% 50%)", "hsl(43 74% 66%)", "hsl(27 87% 67%)", "hsl(0 84% 60%)"];

  const exportToCSV = (entityName) => {
    window.open(`/api/apps/${base44.appId}/export/${entityName}`, '_blank');
  };

  const exportToPDF = async () => {
    const doc = new jsPDF({ orientation: 'landscape' });

    // Add Persian font support (using built-in font)
    doc.setFont("helvetica");

    // Title
    doc.setFontSize(20);
    doc.text("گزارش مالی", 14, 22);

    // Date range
    doc.setFontSize(10);
    doc.text(`بازه زمانی: ${dateRange.from || 'شروع'} تا ${dateRange.to || 'پایان'}`, 14, 30);
    doc.text(`تاریخ گزارش: ${new Date().toLocaleDateString('fa-IR')}`, 14, 36);

    // Summary table
    doc.setFontSize(12);
    doc.text("خلاصه مالی", 14, 46);

    autoTable(doc, {
      startY: 50,
      head: [['شاخص', 'مبلغ (تومان)', 'تغییر نسبت به دوره قبل']],
      body: [
        ['کل درآمد', faNum(totalIncome), compareMode ? `${incomeChange >= 0 ? '+' : ''}${incomeChange}%` : '—'],
        ['کل هزینه', faNum(totalExpense), compareMode ? `${expenseChange >= 0 ? '+' : ''}${expenseChange}%` : '—'],
        ['سود/زیان خالص', faNum(totalIncome - totalExpense), '—'],
      ],
      theme: 'striped',
      styles: { font: 'helvetica', halign: 'right' },
      headStyles: { fillColor: [31, 160, 80] }
    });

    // Category breakdown
    if (categoryData.length > 0) {
      doc.text("هزینه‌ها بر اساس دسته‌بندی", 14, doc.lastAutoTable.finalY + 10);
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 14,
        head: [['دسته‌بندی', 'مبلغ (تومان)', 'درصد از کل']],
        body: categoryData.map(c => [c.name, faNum(c.value), `${totalExpense > 0 ? Math.round((c.value / totalExpense) * 100) : 0}%`]),
        theme: 'striped',
        styles: { font: 'helvetica', halign: 'right' },
        headStyles: { fillColor: [249, 115, 22] }
      });
    }

    // Project profitability
    if (projectProfitability.length > 0) {
      doc.text("سودآوری پروژه‌ها", 14, doc.lastAutoTable.finalY + 10);
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 14,
        head: [['پروژه', 'درآمد', 'هزینه', 'سود', 'حاشیه سود']],
        body: projectProfitability.map(p => [
          p.name,
          faNum(p.incomes),
          faNum(p.expenses),
          faNum(p.profit),
          `${p.profitMargin}%`
        ]),
        theme: 'striped',
        styles: { font: 'helvetica', halign: 'right' },
        headStyles: { fillColor: [16, 185, 129] }
      });
    }

    doc.save(`گزارش-مالی-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  if (loading)
    return (
      <div className="flex justify-center p-20">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">گزارش‌ها</h1>
          <p className="text-muted-foreground mt-1">تحلیل مالی، پروژه‌ها و عملکرد تیم</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportToPDF} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:opacity-90 flex items-center gap-2">
            <FileText className="w-4 h-4" /> خروجی PDF
          </button>
          <div className="flex gap-1">
            <button onClick={() => exportToCSV("Expense")} className="border border-input rounded-lg px-3 py-2 text-sm hover:bg-primary/5">هزینه‌ها (CSV)</button>
            <button onClick={() => exportToCSV("Income")} className="border border-input rounded-lg px-3 py-2 text-sm hover:bg-primary/5">درآمدها (CSV)</button>
            <button onClick={() => exportToCSV("Project")} className="border border-input rounded-lg px-3 py-2 text-sm hover:bg-primary/5">پروژه‌ها (CSV)</button>
          </div>
        </div>
      </div>

      {/* Date Range & Controls */}
      <div className="bg-card border border-border rounded-xl p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground font-medium">
            <Calendar className="w-4 h-4" /> بازه زمانی:
          </span>
          <PersianDatePicker label="از تاریخ" value={dateRange.from} onChange={(v) => setDateRange({...dateRange, from: v})} placeholder="از تاریخ" />
          <PersianDatePicker label="تا تاریخ" value={dateRange.to} onChange={(v) => setDateRange({...dateRange, to: v})} placeholder="تا تاریخ" />
          <button onClick={() => setDateRange({ from: "", to: "" })} className="text-xs text-primary hover:underline flex items-center gap-1">
            <Trash2 className="w-3.5 h-3.5" /> پاک کردن
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={compareMode} onChange={(e) => setCompareMode(e.target.checked)} className="w-4 h-4 accent-primary" />
            <span className="text-sm">مقایسه با دوره قبلی</span>
          </label>
          {compareMode && (
            <select value={comparePeriod} onChange={(e) => setComparePeriod(e.target.value)} className="border border-input rounded-xl px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="previous">دوره hemen قبلی</option>
              <option value="same_last_year">همان دوره سال گذشته</option>
            </select>
          )}
          <div className="flex gap-1 ml-auto">
            <button onClick={() => setActiveTab("financial")} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${activeTab === "financial" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>مالی</button>
            <button onClick={() => setActiveTab("project")} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${activeTab === "project" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>پروژه‌ها</button>
            <button onClick={() => setActiveTab("team")} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${activeTab === "team" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>تیم</button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-2xl p-6 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">کل درآمد</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{faNum(totalIncome)}</p>
              {compareMode && (
                <p className={`text-xs mt-1 flex items-center gap-1 ${incomeChange >= 0 ? "text-green-600" : "text-red-600"}`}>
                  <TrendingUp className="w-3 h-3" /> {incomeChange >= 0 ? '+' : ''}{incomeChange}% نسبت به دوره قبل
                </p>
              )}
            </div>
            <BarChart3 className="w-8 h-8 text-green-600/30" />
          </div>
        </div>
        <div className="bg-card rounded-2xl p-6 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">کل هزینه</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{faNum(totalExpense)}</p>
              {compareMode && (
                <p className={`text-xs mt-1 flex items-center gap-1 ${expenseChange >= 0 ? "text-red-600" : "text-green-600"}`}>
                  <TrendingDown className="w-3 h-3" /> {expenseChange >= 0 ? '+' : ''}{expenseChange}% نسبت به دوره قبل
                </p>
              )}
            </div>
            <BarChart3 className="w-8 h-8 text-red-600/30" />
          </div>
        </div>
        <div className="bg-card rounded-2xl p-6 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">سود/زیان</p>
              <p className={`text-2xl font-bold mt-1 ${totalIncome - totalExpense >= 0 ? "text-green-600" : "text-red-600"}`}>{faNum(totalIncome - totalExpense)}</p>
            </div>
            <BarChart3 className={`w-8 h-8 ${totalIncome - totalExpense >= 0 ? "text-green-600/30" : "text-red-600/30"}`} />
          </div>
        </div>
        <div className="bg-card rounded-2xl p-6 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">مرز سود</p>
              <p className="text-2xl font-bold mt-1">{totalIncome > 0 ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100) : 0}%</p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-600/30" />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Income vs Expense Chart */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <h2 className="font-bold text-lg mb-6 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" /> مقایسه درآمد و هزینه ({period === "monthly" ? "ماهانه" : "هفتگی"})
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 12, fontFamily: "Vazirmatn" }} />
              <YAxis tick={{ fontSize: 11, fontFamily: "Vazirmatn" }} tickFormatter={(v) => faNum(v / 1000000) + "م"} />
              <Tooltip formatter={(v, name) => [faNum(v) + " تومان", name === "درآمد" ? "درآمد" : name === "هزینه" ? "هزینه" : name === "درآمد_قبلی" ? "درآمد (قبلی)" : "هزینه (قبلی)"]} contentStyle={{ fontFamily: "Vazirmatn", borderRadius: 12, border: "1px solid hsl(var(--border))" }} />
              <Legend wrapperStyle={{ fontFamily: "Vazirmatn" }} />
              <Bar dataKey="درآمد" fill="hsl(173 58% 39%)" radius={[8, 8, 0, 0]} />
              <Bar dataKey="هزینه" fill="hsl(0 84% 60%)" radius={[8, 8, 0, 0]} />
              {compareMode && (
                <>
                  <Bar dataKey="درآمد_قبلی" fill="hsl(173 58% 39% / 0.3)" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="هزینه_قبلی" fill="hsl(0 84% 60% / 0.3)" radius={[8, 8, 0, 0]} />
                </>
              )}
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

      {/* Project Profitability Tab */}
      {activeTab === "project" && (
        <div className="bg-card rounded-2xl border border-border p-6">
          <h2 className="font-bold text-lg mb-6">سودآوری پروژه‌ها</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-2">پروژه</th>
                  <th className="pb-2">درآمد</th>
                  <th className="pb-2">هزینه</th>
                  <th className="pb-2">سود خالص</th>
                  <th className="pb-2">حاشیه سود</th>
                </tr>
              </thead>
              <tbody>
                {projectProfitability.map((p) => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-accent/30">
                    <td className="py-3 font-medium">{p.name}</td>
                    <td className="py-3 text-green-600">{faNum(p.incomes)}</td>
                    <td className="py-3 text-red-600">{faNum(p.expenses)}</td>
                    <td className={`py-3 font-medium ${p.profit >= 0 ? "text-green-600" : "text-red-600"}`}>{faNum(p.profit)}</td>
                    <td className={`py-3 ${p.profitMargin >= 20 ? "text-green-600" : p.profitMargin >= 0 ? "text-amber-600" : "text-red-600"}`}>{p.profitMargin}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Team Performance Tab */}
      {activeTab === "team" && (
        <div className="bg-card rounded-2xl border border-border p-6">
          <h2 className="font-bold text-lg mb-6">عملکرد تیم</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((proj) => {
              const projExpenses = filteredExpenses.filter(e => e.project_id === proj.id);
              const projIncomes = filteredIncomes.filter(i => i.project_id === proj.id);
              const projExpense = projExpenses.reduce((s, e) => s + (e.amount || 0), 0);
              const projIncome = projIncomes.reduce((s, i) => s + (i.amount || 0), 0);
              const members = [...new Set(projExpenses.flatMap(e => e.assignees || []).concat(projIncomes.flatMap(i => i.assignees || [])))];
              return (
                <div key={proj.id} className="bg-card border border-border rounded-xl p-4">
                  <h3 className="font-bold text-sm mb-2">{proj.name}</h3>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span>درآمد:</span> <span className="text-green-600">{faNum(projIncome)}</span></div>
                    <div className="flex justify-between"><span>هزینه:</span> <span className="text-red-600">{faNum(projExpense)}</span></div>
                    <div className="flex justify-between"><span>سود:</span> <span className={projIncome - projExpense >= 0 ? "text-green-600" : "text-red-600"}>{faNum(projIncome - projExpense)}</span></div>
                    <div className="flex justify-between"><span>اعضا:</span> <span>{members.length}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Expense Category Table */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <h2 className="font-bold text-lg mb-6">جزئیات دسته‌بندی هزینه‌ها</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="pb-2">دسته‌بندی</th>
                <th className="pb-2">مبلغ</th>
                <th className="pb-2">درصد از کل</th>
                <th className="pb-2">تعداد تراکنش</th>
              </tr>
            </thead>
            <tbody>
              {categoryData.map((c) => (
                <tr key={c.name} className="border-b border-border/50 hover:bg-accent/30">
                  <td className="py-2 font-medium">{c.name}</td>
                  <td className="py-2 text-red-600">{faNum(c.value)}</td>
                  <td className="py-2">{totalExpense > 0 ? Math.round((c.value / totalExpense) * 100) : 0}%</td>
                  <td className="py-2 text-muted-foreground">{filteredExpenses.filter(e => e.category === c.name).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}