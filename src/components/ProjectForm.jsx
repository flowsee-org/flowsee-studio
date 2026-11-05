import { useState, useEffect } from "react";
import { studio } from "@/api/studioClient";
import { X, UserMinus } from "lucide-react";
import { loadTeamMembers } from "@/lib/teamMembers";
import PersianDatePicker from "@/components/PersianDatePicker";
import SelectControl from "@/components/ui/SelectControl";
import { toast } from "@/components/ui/use-toast";

function createEmptyProjectForm() {
  return { name: "", description: "", color: "#FE5400", status: "active", priority: "medium", archived: false, manager: "", start_date: "", end_date: "", members: [] };
}

export default function ProjectForm({ editProject, isOpen = true, onClose, onSaved }) {
  const [form, setForm] = useState(
    editProject || createEmptyProjectForm()
  );
  const [members, setMembers] = useState([]);
  const [saving, setSaving] = useState(false);
  const colors = ["#FE5400", "#2563eb", "#16a34a", "#ea580c", "#dc2626", "#0891b2", "#7c3aed"];

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    loadTeamMembers()
      .then((loadedMembers) => { if (active) setMembers(loadedMembers); })
      .catch((error) => { console.error("Could not load project members", error); if (active) setMembers([]); });
    return () => { active = false; };
  }, [isOpen]);

  const toggleMember = (name) => {
    const current = form.members || [];
    const newMembers = current.includes(name)
      ? current.filter((a) => a !== name)
      : [...current, name];
    setForm({ ...form, members: newMembers });
  };

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      if (editProject) {
        await studio.entities.Project.update(editProject.id, form);
      } else {
        await studio.entities.Project.create(form);
      }
      await onSaved();
      onClose();
      if (!editProject) setForm(createEmptyProjectForm());
    } catch (error) {
      toast({ title: "ذخیره پروژه انجام نشد", description: error?.message || "دوباره تلاش کنید.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const selectedMembers = form.members || [];

  return (
    <div aria-hidden={!isOpen} className={`fixed inset-0 bg-black/40 z-50 items-center justify-center p-4 ${isOpen ? "flex" : "hidden"}`} onClick={onClose}>
      <div className="bg-card rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-xl max-h-[90vh] overflow-y-auto scrollbar-thin" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg">{editProject ? "ویرایش پروژه" : "پروژه جدید"}</h2>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">
              نام پروژه <span className="text-primary">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">مدیر پروژه</label>
            <SelectControl
              value={form.manager || ""}
              onChange={(e) => setForm({ ...form, manager: e.target.value })}
              className="w-full"
            >
              <option value="">انتخاب مدیر پروژه</option>
              {members.map((m) => (
                <option key={m.id} value={m.name}>{m.name}</option>
              ))}
            </SelectControl>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">اعضای پروژه</label>
            <div className="border border-input rounded-xl p-2.5 max-h-40 overflow-y-auto scrollbar-thin space-y-1.5">
              {members.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">کارمندی ثبت نشده</p>}
              {members.map((m) => (
                <label key={m.id} className="flex items-center gap-2 cursor-pointer hover:bg-accent/50 rounded-lg px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={selectedMembers.includes(m.name)}
                    onChange={() => toggleMember(m.name)}
                    className="w-4 h-4 accent-primary"
                  />
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm">{m.name}</span>
                </label>
              ))}
            </div>
            {selectedMembers.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {selectedMembers.map((name) => (
                  <span key={name} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full flex items-center gap-1">
                    {name}
                    <button onClick={() => toggleMember(name)} className="hover:text-red-500">
                      <UserMinus className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">توضیحات</label>
            <textarea
              value={form.description || ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <PersianDatePicker
              label="تاریخ شروع"
              value={form.start_date || ""}
              onChange={(val) => setForm({ ...form, start_date: val })}
              placeholder="تاریخ شروع"
            />
            <PersianDatePicker
              label="تاریخ پایان"
              value={form.end_date || ""}
              onChange={(val) => setForm({ ...form, end_date: val })}
              placeholder="تاریخ پایان"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">رنگ</label>
            <div className="flex gap-2 flex-wrap">
              {colors.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm({ ...form, color: c })}
                  className={`w-9 h-9 rounded-full transition-transform ${form.color === c ? "ring-2 ring-offset-2 ring-primary scale-110" : ""}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">وضعیت</label>
            <SelectControl
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full"
            >
              <option value="active">فعال</option>
              <option value="completed">تکمیل شده</option>
              <option value="paused">متوقف شده</option>
            </SelectControl>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">اولویت پروژه</label>
            <SelectControl
              value={form.priority || "medium"}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              className="w-full"
            >
              <option value="low">کم</option>
              <option value="medium">متوسط</option>
              <option value="high">زیاد</option>
            </SelectControl>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !form.name}
          className="sticky bottom-0 z-10 w-full border-t border-border bg-primary text-primary-foreground py-3 rounded-xl font-medium mt-5 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? "در حال ثبت..." : editProject ? "ذخیره تغییرات" : "ثبت پروژه"}
        </button>
      </div>
    </div>
  );
}
