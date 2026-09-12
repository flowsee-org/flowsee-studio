import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { X, Plus, Pencil, Trash2, FileText, CheckCircle } from "lucide-react";
import TaskTemplateModal from "@/components/TaskTemplateModal";

const priorityLabels = { low: "کم", medium: "متوسط", high: "زیاد" };
const priorityColors = { low: "bg-slate-100 text-slate-600", medium: "bg-amber-100 text-amber-700", high: "bg-red-100 text-red-700" };

export default function TemplatePicker({ onClose, onUse }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTemplate, setEditTemplate] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const data = await base44.entities.TaskTemplate.list("-created_date");
    setTemplates(data);
    setLoading(false);
  };

  const handleDelete = async (id) => {
    await base44.entities.TaskTemplate.delete(id);
    load();
  };

  const handleEdit = (t) => {
    setEditTemplate(t);
    setShowModal(true);
  };

  const handleNew = () => {
    setEditTemplate(null);
    setShowModal(true);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-card rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-xl max-h-[90vh] overflow-y-auto scrollbar-thin" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-lg">قالب‌های تسک</h2>
            <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
          <button
            onClick={handleNew}
            className="w-full border-2 border-dashed border-primary/30 text-primary rounded-xl py-3 flex items-center justify-center gap-2 hover:bg-primary/5 transition-colors mb-4"
          >
            <Plus className="w-5 h-5" /> قالب جدید
          </button>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">هنوز قالبی ساخته نشده</p>
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map((t) => (
                <div key={t.id} className="bg-accent/30 rounded-xl p-4 border border-border">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm">{t.title}</h3>
                      {t.project_name && <p className="text-xs text-primary mt-0.5">{t.project_name}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => handleEdit(t)} className="p-1.5 text-muted-foreground hover:text-primary rounded-lg hover:bg-accent">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(t.id)} className="p-1.5 text-muted-foreground hover:text-red-500 rounded-lg hover:bg-destructive/10">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {t.description && <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{t.description}</p>}
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    {t.priority && <span className={`text-xs px-1.5 py-0.5 rounded-full ${priorityColors[t.priority]}`}>{priorityLabels[t.priority]}</span>}
                    {(t.default_assignees || []).length > 0 && <span className="text-xs text-muted-foreground">{t.default_assignees.length} مسئول</span>}
                    {(t.checklist || []).length > 0 && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> {t.checklist.length} آیتم چک‌لیست
                      </span>
                    )}
                  </div>
                  {(t.checklist || []).length > 0 && (
                    <div className="space-y-1 mb-3">
                      {(t.checklist || []).slice(0, 3).map((item, i) => (
                        <div key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-muted-foreground" /> {item}
                        </div>
                      ))}
                      {(t.checklist || []).length > 3 && <p className="text-xs text-muted-foreground">+{t.checklist.length - 3} مورد دیگر...</p>}
                    </div>
                  )}
                  <button
                    onClick={() => onUse(t)}
                    className="w-full bg-primary text-primary-foreground py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    استفاده از این قالب
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {showModal && (
        <TaskTemplateModal
          editTemplate={editTemplate}
          onClose={() => { setShowModal(false); setEditTemplate(null); }}
          onSaved={load}
        />
      )}
    </>
  );
}