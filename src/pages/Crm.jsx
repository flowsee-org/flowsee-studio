import { useEffect, useMemo, useState } from "react";
import { studio } from "@/api/studioClient";
import { useAuth } from "@/lib/AuthContext";
import { Plus, Trash2, Pencil, X, Tag, Phone } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import SelectControl from "@/components/ui/SelectControl";
import { toast } from "@/components/ui/use-toast";
import { formatPersianNumber as faNum } from "@/lib/number-format";

const statusLabels = { lead: "پیش‌oard", active: "فعال", paused: "متوقف شده", closed: "بسته شده" };
const statusColors = {
  lead: "bg-amber-100 text-amber-700",
  active: "bg-green-100 text-green-700",
  paused: "bg-slate-100 text-slate-600",
  closed: "bg-red-100 text-red-700",
};
const sourceLabels = { website: "وب‌سایت", referral: "مراجعه", social: "شبکه اجتماعی", ad: "تبلیغات", other: "سایر" };

const blankCustomer = () => ({
  name: "",
  company: "",
  email: "",
  phone: "",
  source: "website",
  status: "lead",
  contact_person: "",
  address: "",
  notes: "",
  tags: [],
});

export default function Crm() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [form, setForm] = useState(blankCustomer);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await studio.entities.Customer.list("-created_date");
      setCustomers(list);
    } catch (err) {
      console.error("Failed to load customers:", err);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.contact_person.toLowerCase().includes(q)
      );
    });
  }, [customers, statusFilter, searchQuery]);

  const handleSave = async () => {
    try {
      if (editCustomer?.id) {
        await studio.entities.Customer.update(editCustomer.id, form);
        toast({ title: "مشتری بروزرسانی شد" });
      } else {
        await studio.entities.Customer.create({ ...form, created_by_id: user?.id });
        toast({ title: "مشتری ثبت شد" });
      }
      setShowForm(false);
      setEditCustomer(null);
      setForm(blankCustomer());
      load();
    } catch (err) {
      console.error(err);
      toast({ title: "خطا در ذخیره مشتری", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await studio.entities.Customer.delete(deleteTarget.id);
      setDeleteTarget(null);
      load();
      toast({ title: "مشتری حذف شد" });
    } catch (err) {
      toast({ title: "حذف انجام نشد", description: err.message, variant: "destructive" });
    } finally {
      setDeleteTarget(null);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center p-20">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">CRM مشتریان</h1>
          <p className="mt-1 text-sm text-muted-foreground">مدیریت لیست مشتریان، مخاطبین و ارتباطات تجاری</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative">
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"><Tag className="w-4 h-4" /></div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی نام، شرکت، ایمیل، تلفن..."
              className="border border-input rounded-xl pr-9 pl-3 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 w-[240px]"
            />
          </div>
          <SelectControl
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-input rounded-xl px-3 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 sm:min-w-[150px]"
          >
            <option value="">تمام وضعیت‌ها</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </SelectControl>
          <button
            onClick={() => { setEditCustomer(null); setForm(blankCustomer()); setShowForm(true); }}
            className="rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium inline-flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" /> مشتری جدید
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4">
          <span className="text-xs text-muted-foreground">کل مشتریان</span>
          <p className="mt-1 text-2xl font-bold">{faNum(customers.length)}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <span className="text-xs text-muted-foreground">فعال</span>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{faNum(customers.filter((c) => c.status === "active").length)}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <span className="text-xs text-muted-foreground">پیش‌oard / لید</span>
          <p className="mt-1 text-2xl font-bold text-amber-600">{faNum(customers.filter((c) => c.status === "lead").length)}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-accent/40 text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">مشتری</th>
                <th className="p-3 font-medium">شرکت</th>
                <th className="p-3 font-medium">تماس</th>
                <th className="p-3 font-medium">ایمیل</th>
                <th className="p-3 font-medium">منبع</th>
                <th className="p-3 font-medium">وضعیت</th>
                <th className="p-3 font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">مشتری یافت نشد.</td>
                </tr>
              )}
              {filteredCustomers.map((c) => (
                <tr key={c.id} className="hover:bg-accent/20">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-foreground truncate">{c.name}</div>
                        {c.contact_person && <div className="text-xs text-muted-foreground">مخاطب: {c.contact_person}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="p-3">{c.company ? c.company : <span className="text-muted-foreground">—</span>}</td>
                  <td className="p-3"><span className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone ? c.phone : "—"}</span></td>
                  <td className="p-3">{c.email ? c.email : <span className="text-muted-foreground">—</span>}</td>
                  <td className="p-3"><span className="text-xs text-muted-foreground">{sourceLabels[c.source] || c.source}</span></td>
                  <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[c.status]}`}>{statusLabels[c.status]}</span></td>
                  <td className="p-3"><div className="flex gap-1 justify-center">
                    <button onClick={(e) => { e.stopPropagation(); setEditCustomer(c); setShowForm(true); }} className="rounded-lg p-1.5 hover:bg-primary/10 text-muted-foreground hover:text-primary" title="ویرایش"><Pencil className="w-4 h-4" /></button>
                    <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }} className="rounded-lg p-1.5 hover:bg-red-100 text-red-600" title="حذف"><Trash2 className="w-4 h-4" /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">{editCustomer ? "ویرایش مشتری" : "مشتری جدید"}</h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-accent rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1.5">نام کامل <span className="text-primary">*</span></label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">نام شرکت</label>
                <input
                  type="text"
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5">تلفن</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">ایمیل</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5">مخاطب شرکت</label>
                  <input
                    type="text"
                    value={form.contact_person}
                    onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                    className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="نام Person تماس در شرکت"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">منبع</label>
                  <select
                    value={form.source}
                    onChange={(e) => setForm({ ...form, source: e.target.value })}
                    className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {Object.entries(sourceLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">وضعیت</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">آدرس</label>
                <textarea
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  rows={2}
                  className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="آدرس تماس"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">یادداشت‌ها</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="یادداشت‌های مربوط به مشتری"
                />
              </div>
              <div className="pt-2 border-t border-border flex items-center justify-between">
                <button type="button" onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground px-3 py-2 text-sm rounded-lg">انصراف</button>
                <button type="submit" className="bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium rounded-lg hover:opacity-90 transition-opacity">ذخیره مشتری</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="حذف مشتری"
          description={`مشتری «${deleteTarget.name}» و تمام اطلاعات مرتبط حذف می‌شود. آیا مطمئن هستید؟`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          confirmText="بله، حذف شود"
        />
      )}
    </div>
  );
}
