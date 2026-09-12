import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { X, Plus, Trash2 } from "lucide-react";

export default function TaskTemplateModal({ editTemplate, onClose, onSaved }) {
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState(
    editTemplate || {
      title: "",
      description: "",
      checklist: [],
      priority: "medium",
      project_id: "",
      project_name: "",
      default_assignees: [],
    }
  );
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      base44.entities.Employee.list(),
      base44.entities.Project.list(),
    ]).then(([emps, projs]) => {
      setEmployees(emps);
      setProjects(projs);
    });
  }, []);

  const toggleAssignee = (name) => {
    const current = form.default_assignees || [];
    const newAssignees = current.includes(name)
      ? current.filter((a) => a !== name)
      : [...current, name];
    setForm({ ...form, default_assignees: newAssignees });
  };

  const addChecklistItem = () => {
    if (!newChecklistItem.trim()) return;
    setForm({ ...form, checklist: [...(form.checklist || []), newChecklistItem.trim()] });
    setNewChecklistItem("");
  };

  const removeChecklistItem = (idx) => {
    setForm({ ...form, checklist: (form.checklist || []).filter((_, i) => i !== idx) });
  };

  const handleSave = async () => {
    if (!form.title) return;
    setSaving(true);
    const proj = projects.find((p) => p.id === form.project_id);
    const data = { ...form, project_name: proj?.name || "" };
    if (editTemplate?.id) {
      await base44.entities.TaskTemplate.update(editTemplate.id, data);
    } else {
      await base44.entities.TaskTemplate.create(data);
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-xl max-h-[90vh] overflow-y-auto scrollbar-thin" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg">{editTemplate?.id ? "ویرایش قالب" : "قالب تسک جدید"}</h2>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">
              عنوان قالب <span className="text-[#D35400]">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="مثلاً: راه‌اندازی سرور جدید"
              className="w-full border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">توضیحات</label>
            <textarea
              value={form.description || ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              placeholder="توضیحات قالب..."
              className="w-full border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1.5">پروژه</label>
              <select
                value={form.project_id || ""}
                onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">بدون پروژه</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">اولویت</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="low">کم</option>
                <option value="medium">متوسط</option>
                <option value="high">زیاد</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">مسئولین پیش‌فرض</label>
            <div className="border border-input rounded-xl p-2.5 max-h-32 overflow-y-auto scrollbar-thin space-y-1">
              {employees.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">کارمندی ثبت نشده</p>}
              {employees.map((emp) => (
                <label key={emp.id} className="flex items-center gap-2 cursor-pointer hover:bg-accent/50 rounded-lg px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={(form.default_assignees || []).includes(emp.name)}
                    onChange={() => toggleAssignee(emp.name)}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm">{emp.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">چک‌لیست</label>
            <div className="space-y-1.5">
              {(form.checklist || []).map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-accent/40 rounded-lg px-3 py-2">
                  <span className="text-xs text-muted-foreground">{idx + 1}.</span>
                  <span className="text-sm flex-1">{item}</span>
                  <button onClick={() => removeChecklistItem(idx)} className="text-muted-foreground hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newChecklistItem}
                  onChange={(e) => setNewChecklistItem(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addChecklistItem(); } }}
                  placeholder="آیتم جدید..."
                  className="flex-1 border border-input rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  onClick={addChecklistItem}
                  disabled={!newChecklistItem.trim()}
                  className="bg-primary text-primary-foreground px-3 rounded-xl flex items-center disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !form.title}
          className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-medium mt-5 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? "در حال ثبت..." : editTemplate?.id ? "ذخیره تغییرات" : "ثبت قالب"}
        </button>
      </div>
    </div>
  );
}