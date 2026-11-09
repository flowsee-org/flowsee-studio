import { useEffect, useMemo, useState } from "react";
import { studio } from "@/api/studioClient";
import { useAuth } from "@/lib/AuthContext";
import { Plus, Trash2, Key, FileText, X, Lock, Tag } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import SelectControl from "@/components/ui/SelectControl";
import { toast } from "@/components/ui/use-toast";
import { formatPersianNumber as faNum } from "@/lib/number-format";

const typeLabels = { password: "رمز عبور", document: "اسناد" };
const typeColors = {
  password: "bg-purple-100 text-purple-700",
  document: "bg-blue-100 text-blue-700",
};
const categoryLabels = { financial: "مالی", personal: "شخصی", business: "تجاری", technical: "فنی", other: "سایر" };

const blankItem = () => ({
  title: "",
  type: "password",
  category: "personal",
  username: "",
  value: "",
  url: "",
  notes: "",
  tags: [],
  is_favorite: false,
});

export default function PasswordsDocuments() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(blankItem);
  const [typeFilter, setTypeFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showValue, setShowValue] = useState(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const list = await studio.entities.Password.list("-created_date");
      const docs = await studio.entities.Document.list("-created_date");
      // Password and Document are stored separately; unify into one list with a `kind` field.
      const unified = [
        ...list.map((p) => ({ ...p, type: "password" })),
        ...docs.map((d) => ({ ...d, type: "document" })),
      ];
      setItems(unified);
    } catch (err) {
      console.error("Failed to load passwords/documents:", err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filteredItems = useMemo(() => {
    return items.filter((i) => {
      if (typeFilter && i.type !== typeFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      return (
        i.title.toLowerCase().includes(q) ||
        (i.username || "").toLowerCase().includes(q) ||
        (i.notes || "").toLowerCase().includes(q) ||
        (i.url || "").toLowerCase().includes(q)
      );
    });
  }, [items, typeFilter, searchQuery]);

  const entityName = (item) => (item.type === "password" ? "Password" : "Document");

  const handleSave = async () => {
    try {
      const payload = { ...form, type: form.type };
      const targetEntity = editItem ? entityName(editItem) : entityName(form);
      if (editItem?.id) {
        await studio.entities[targetEntity].update(editItem.id, payload);
        toast({ title: "مورد بروزرسانی شد" });
      } else {
        await studio.entities[targetEntity].create({ ...payload, created_by_id: user?.id });
        toast({ title: "مورد ثبت شد" });
      }
      setShowForm(false);
      setEditItem(null);
      setForm(blankItem());
      load();
    } catch (err) {
      console.error(err);
      toast({ title: "خطا در ذخیره مورد", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await studio.entities[entityName(deleteTarget)].delete(deleteTarget.id);
      setDeleteTarget(null);
      load();
      toast({ title: "مورد حذف شد" });
    } catch (err) {
      toast({ title: "حذف انجام نشد", description: err.message, variant: "destructive" });
    } finally {
      setDeleteTarget(null);
    }
  };

  const toggleValue = (id) => {
    const next = new Set(showValue);
    if (next.has(id)) next.delete(id); else next.add(id);
    setShowValue(next);
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
          <h1 className="text-2xl font-bold">رموز و اسناد</h1>
          <p className="mt-1 text-sm text-muted-foreground">مدیریت رمزهای عبور، اسناد و اطلاعات حساس فلوسی</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative">
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"><Tag className="w-4 h-4" /></div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی عنوان، نام کاربری، یادداشت..."
              className="border border-input rounded-xl pr-9 pl-3 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 w-[240px]"
            />
          </div>
          <SelectControl
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border border-input rounded-xl px-3 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 sm:min-w-[150px]"
          >
            <option value="">تمام انواع</option>
            {Object.entries(typeLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </SelectControl>
          <button
            onClick={() => { setEditItem(null); setForm(blankItem()); setShowForm(true); }}
            className="rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium inline-flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" /> مورد جدید
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4">
          <span className="text-xs text-muted-foreground">کل موارد</span>
          <p className="mt-1 text-2xl font-bold">{faNum(items.length)}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <span className="text-xs text-muted-foreground">رمز عبور</span>
          <p className="mt-1 text-2xl font-bold text-purple-600">{faNum(items.filter((i) => i.type === "password").length)}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <span className="text-xs text-muted-foreground">اسناد</span>
          <p className="mt-1 text-2xl font-bold text-blue-600">{faNum(items.filter((i) => i.type === "document").length)}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-accent/40 text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">عنوان</th>
                <th className="p-3 font-medium">نوع</th>
                <th className="p-3 font-medium">دسته‌بندی</th>
                <th className="p-3 font-medium">نام کاربری</th>
                <th className="p-3 font-medium">مقدار / رمز</th>
                <th className="p-3 font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">موردی یافت نشد.</td>
                </tr>
              )}
              {filteredItems.map((item) => {
                const revealed = showValue.has(item.id);
                return (
                  <tr key={item.id} className="hover:bg-accent/20">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${typeColors[item.kind] || typeColors.password}`}>
                          {item.type === "password" ? <Key className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-foreground truncate">{item.title}</div>
                          {item.url && <div className="text-xs text-muted-foreground truncate">{item.url}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeColors[item.type] || typeColors.password}`}>{typeLabels[item.type]}</span></td>
                    <td className="p-3"><span className="text-xs text-muted-foreground">{categoryLabels[item.category] || item.category}</span></td>
                    <td className="p-3">{item.username ? item.username : <span className="text-muted-foreground">—</span>}</td>
                    <td className="p-3">
                      {item.type === "password" ? (
                        <div className="flex items-center gap-1">
                          {revealed ? (
                            <span className="font-mono text-xs text-foreground">{item.value}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">••••••••</span>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleValue(item.id); }}
                            className="p-1 text-muted-foreground hover:text-primary"
                            title={revealed ? "پنهان کردن" : "نمایش"}
                          >
                            {revealed ? <Lock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">اسناد</span>
                      )}
                    </td>
                    <td className="p-3"><div className="flex gap-1 justify-center">
                      <button onClick={(e) => { e.stopPropagation(); setEditItem(item); setForm({ ...item }); setShowForm(true); }} className="rounded-lg p-1.5 hover:bg-primary/10 text-muted-foreground hover:text-primary" title="ویرایش"><Pencil className="w-4 h-4" /></button>
                      <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(item); }} className="rounded-lg p-1.5 hover:bg-red-100 text-red-600" title="حذف"><Trash2 className="w-4 h-4" /></button>
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">{editItem ? "ویرایش مورد" : "مورد جدید"}</h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-accent rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1.5">عنوان <span className="text-primary">*</span></label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5">نوع</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {Object.entries(typeLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">دسته‌بندی</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {Object.entries(categoryLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5">نام کاربری / نام کاربر</label>
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">لینک / آدرس</label>
                  <input
                    type="url"
                    value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                    className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="https://example.com"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">رمز / مقدار</label>
                <input
                  type="password"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="رمز عبور یا مقدار sensitive"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">یادداشت‌ها</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="یادداشت‌های مربوط به این مورد"
                />
              </div>
              <div className="pt-2 border-t border-border flex items-center justify-between">
                <button type="button" onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground px-3 py-2 text-sm rounded-lg">انصراف</button>
                <button type="submit" className="bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium rounded-lg hover:opacity-90 transition-opacity">ذخیره مورد</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="حذف مورد"
          description={`مورد «${deleteTarget.title}» حذف می‌شود. آیا مطمئن هستید؟`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          confirmText="بله، حذف شود"
        />
      )}
    </div>
  );
}
