import { useEffect, useMemo, useState } from "react";
import { studio } from "@/api/studioClient";
import { useAuth } from "@/lib/AuthContext";
import { Plus, Trash2, Pencil, X, Phone, Tag } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import SelectControl from "@/components/ui/SelectControl";
import { toast } from "@/components/ui/use-toast";
import { formatPersianNumber as faNum } from "@/lib/number-format";

const blankContact = () => ({
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  client_id: "",
  client_name: "",
  position: "",
  notes: "",
});

export default function Contacts() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editContact, setEditContact] = useState(null);
  const [form, setForm] = useState(blankContact);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [c, cl] = await Promise.all([
        studio.entities.Contact.list("-created_date"),
        studio.entities.Client.list("-created_date"),
      ]);
      setContacts(c);
      setClients(cl);
    } catch (err) {
      console.error("Failed to load contacts:", err);
      setContacts([]);
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filteredContacts = useMemo(() => {
    return contacts.filter((ct) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      return (
        ct.first_name.toLowerCase().includes(q) ||
        ct.last_name.toLowerCase().includes(q) ||
        ct.email.toLowerCase().includes(q) ||
        ct.phone.toLowerCase().includes(q) ||
        ct.position.toLowerCase().includes(q)
      );
    });
  }, [contacts, searchQuery]);

  const handleSave = async () => {
    if (!form.first_name.trim() && !form.last_name.trim()) return;
    try {
      if (editContact?.id) {
        await studio.entities.Contact.update(editContact.id, form);
        toast({ title: "مخاطب بروزرسانی شد" });
      } else {
        await studio.entities.Contact.create({ ...form, created_by_id: user?.id });
        toast({ title: "مخاطب ثبت شد" });
      }
      setShowForm(false);
      setEditContact(null);
      setForm(blankContact());
      load();
    } catch (err) {
      console.error(err);
      toast({ title: "خطا در ذخیره مخاطب", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await studio.entities.Contact.delete(deleteTarget.id);
      setDeleteTarget(null);
      load();
      toast({ title: "مخاطب حذف شد" });
    } catch (err) {
      toast({ title: "حذف انجام نشد", description: err.message, variant: "destructive" });
    } finally {
      setDeleteTarget(null);
    }
  };

  const clientName = (id) => clients.find((c) => c.id === id)?.name || "";

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
          <h1 className="text-2xl font-bold">مخاطبین</h1>
          <p className="mt-1 text-sm text-muted-foreground">اشخاص حقیقی وابسته به شرکت‌های مشتری</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative">
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"><Tag className="w-4 h-4" /></div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی نام، ایمیل، تلفن، شگ..."
              className="border border-input rounded-xl pr-9 pl-3 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 w-[240px]"
            />
          </div>
          <button
            onClick={() => { setEditContact(null); setForm(blankContact()); setShowForm(true); }}
            className="rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium inline-flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" /> مخاطب جدید
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border bg-card p-4">
          <span className="text-xs text-muted-foreground">کل مخاطبان</span>
          <p className="mt-1 text-2xl font-bold">{faNum(contacts.length)}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <span className="text-xs text-muted-foreground">شرکت‌های مرتبط</span>
          <p className="mt-1 text-2xl font-bold">{faNum(clients.length)}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-accent/40 text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">مخاطب</th>
                <th className="p-3 font-medium">شرکت</th>
                <th className="p-3 font-medium">شغ</th>
                <th className="p-3 font-medium">ایمیل</th>
                <th className="p-3 font-medium">تلفن</th>
                <th className="p-3 font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredContacts.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">مخاطبی یافت نشد.</td>
                </tr>
              )}
              {filteredContacts.map((ct) => (
                <tr key={ct.id} className="hover:bg-accent/20">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                        {(ct.first_name || ct.last_name).charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-foreground truncate">{ct.first_name} {ct.last_name}</div>
                        {ct.position && <div className="text-xs text-muted-foreground">{ct.position}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="p-3">{clientName(ct.client_id) || <span className="text-muted-foreground">—</span>}</td>
                  <td className="p-3">{ct.position || <span className="text-muted-foreground">—</span>}</td>
                  <td className="p-3">{ct.email || <span className="text-muted-foreground">—</span>}</td>
                  <td className="p-3"><span className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" /> {ct.phone || "—"}</span></td>
                  <td className="p-3"><div className="flex gap-1 justify-center">
                    <button onClick={(e) => { e.stopPropagation(); setEditContact(ct); setShowForm(true); }} className="rounded-lg p-1.5 hover:bg-primary/10 text-muted-foreground hover:text-primary" title="ویرایش"><Pencil className="w-4 h-4" /></button>
                    <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(ct); }} className="rounded-lg p-1.5 hover:bg-red-100 text-red-600" title="حذف"><Trash2 className="w-4 h-4" /></button>
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
              <h2 className="font-bold text-lg">{editContact ? "ویرایش مخاطب" : "مخاطب جدید"}</h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-accent rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5">نام <span className="text-primary">*</span></label>
                  <input
                    type="text"
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">نام خانوادگی</label>
                  <input
                    type="text"
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5">شرکت</label>
                  <SelectControl
                    value={form.client_id}
                    onChange={(e) => setForm({ ...form, client_id: e.target.value, client_name: clients.find((c) => c.id === e.target.value)?.name || "" })}
                    className="w-full border border-input rounded-xl px-3 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">بدون شرکت</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </SelectControl>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">شغ</label>
                  <input
                    type="text"
                    value={form.position}
                    onChange={(e) => setForm({ ...form, position: e.target.value })}
                    className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5">ایمیل</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">تلفن</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">یادداشت‌ها</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="pt-2 border-t border-border flex items-center justify-between">
                <button type="button" onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground px-3 py-2 text-sm rounded-lg">انصراف</button>
                <button type="submit" className="bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium rounded-lg hover:opacity-90 transition-opacity">ذخیره مخاطب</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="حذف مخاطب"
          description={`مخاطب «${deleteTarget.first_name} ${deleteTarget.last_name}» حذف می‌شود. آیا مطمئن هستید؟`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          confirmText="بله، حذف شود"
        />
      )}
    </div>
  );
}
