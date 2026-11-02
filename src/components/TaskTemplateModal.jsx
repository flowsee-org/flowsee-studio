import { useEffect, useState } from "react";
import { studio } from "@/api/studioClient";
import { X, Plus, Trash2 } from "lucide-react";
import { loadTeamMembers } from "@/lib/teamMembers";

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
      loadTeamMembers(),
      studio.entities.Project.list(),
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
      await studio.entities.TaskTemplate.update(editTemplate.id, data);
    } else {
      await studio.entities.TaskTemplate.create(data);
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4" onClick={onClose}>
      <div className="flex h-[min(calc(100dvh-1.5rem),52rem)] max-h-[min(calc(100dvh-1.5rem),52rem)] w-full max-w-3xl flex-col overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-overlay sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between mb-5">
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
            <label className="text-sm font-medium block mb-2">مسئولین پیش‌فرض</label>
            <div className="flex flex-wrap gap-2">
              {employees.length === 0 && <p className="text-xs text-muted-foreground text-center py-3 w-full border border-dashed rounded-xl">کارمندی ثبت نشده</p>}
              {employees.map((emp) => {
                const isSelected = (form.default_assignees || []).includes(emp.name);
                return (
                  <label
                    key={emp.id}
                    className={`inline-flex items-center gap-2 cursor-pointer rounded-xl border px-3 py-2 text-sm transition select-none ${
                      isSelected
                        ? "border-primary bg-primary/10 text-primary font-medium shadow-sm"
                        : "border-border bg-card hover:bg-accent/60 text-foreground"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleAssignee(emp.name)}
                      className="w-4 h-4 accent-primary rounded cursor-pointer"
                    />
                    <div className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-xs font-bold text-primary">
                      {emp.name.charAt(0).toUpperCase()}
                      {emp.profile_image && (
                        <img
                          src={emp.profile_image}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                          onError={(event) => { event.currentTarget.style.display = 'none'; }}
                        />
                      )}
                    </div>
                    <span className="truncate max-w-[130px]">{emp.name}</span>
                  </label>
                );
              })}
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
          className="sticky bottom-0 z-10 w-full border-t border-border bg-primary text-primary-foreground py-3 rounded-xl font-medium mt-5 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? "در حال ثبت..." : editTemplate?.id ? "ذخیره تغییرات" : "ثبت قالب"}
        </button>
      </div>
    </div>
  );
}
