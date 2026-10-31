import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { X, Plus, Pencil, Trash2, FileText, CheckCircle } from "lucide-react";
import TaskTemplateModal from "@/components/TaskTemplateModal";
import { formatPersianNumber as faNum } from "@/lib/number-format";

const priorityLabels = { low: "کم", medium: "متوسط", high: "زیاد" };
const priorityColors = { low: "bg-slate-100 text-slate-600", medium: "bg-amber-100 text-amber-700", high: "bg-red-100 text-red-700" };
const defaultTemplates = [
  { id: "builtin:client-kickoff", title: "شروع همکاری با مشتری", description: "اطلاعات و اهداف اولیه پروژه را با مشتری نهایی کنید.", priority: "high", checklist: ["ثبت نیازمندی‌ها و محدوده کار", "تعیین مخاطب و پیام اصلی", "ثبت زمان‌بندی و نقاط تحویل", "تعیین مسئولان و کانال ارتباطی"] },
  { id: "builtin:design-review", title: "بازبینی طرح پیش از تحویل", description: "کنترل کیفی فایل‌ها و خروجی طراحی قبل از ارسال.", priority: "high", checklist: ["بررسی ابعاد و نسخه نهایی", "کنترل متن، رنگ و لوگو", "بررسی فایل‌های قابل ویرایش و خروجی‌ها", "ثبت بازخورد و تأیید مدیر پروژه"] },
  { id: "builtin:weekly-content", title: "برنامه‌ریزی محتوای هفتگی", description: "تقویم محتوایی هفته آینده را آماده و تأیید کنید.", priority: "medium", checklist: ["انتخاب موضوع‌ها و مناسبت‌ها", "نوشتن کپشن و سناریو", "آماده‌سازی طرح‌ها و ویدیوها", "زمان‌بندی انتشار و تأیید نهایی"] },
  { id: "builtin:client-followup", title: "پیگیری بازخورد مشتری", description: "بازخوردهای باز را جمع‌بندی و برای هر مورد مسئول تعیین کنید.", priority: "medium", checklist: ["مرور پیام‌ها و فایل‌های بازخورد", "تفکیک اصلاحات ضروری و پیشنهادی", "ثبت مسئول و موعد هر اصلاح", "ارسال جمع‌بندی برای تأیید"] },
  { id: "builtin:weekly-report", title: "گزارش هفتگی پروژه", description: "وضعیت پیشرفت، موانع و برنامه هفته بعد را ثبت کنید.", priority: "low", checklist: ["به‌روزرسانی وضعیت تسک‌ها", "ثبت ساعات و خروجی‌های هفته", "ثبت موانع و تصمیم‌های لازم", "تعیین اولویت‌های هفته آینده"] },
];

export default function TemplatePicker({ onClose, onUse }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTemplate, setEditTemplate] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const data = await base44.entities.TaskTemplate.list("-created_date");
    setTemplates([...defaultTemplates, ...data]);
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
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {templates.map((t) => (
                <article key={t.id} className="flex min-w-0 flex-col rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/30">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm leading-6">{t.title}</h3>
                      {t.project_name && <p className="mt-1 text-xs text-primary">پروژه: {t.project_name}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {t.id?.startsWith("builtin:") ? <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] text-primary">پیش‌فرض</span> : <>
                        <button onClick={() => handleEdit(t)} className="p-1.5 text-muted-foreground hover:text-primary rounded-lg hover:bg-accent" aria-label="ویرایش قالب">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(t.id)} className="p-1.5 text-muted-foreground hover:text-red-500 rounded-lg hover:bg-destructive/10" aria-label="حذف قالب">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>}
                    </div>
                  </div>
                  {t.description && <p className="mt-2 line-clamp-2 text-xs leading-6 text-muted-foreground">{t.description}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {t.priority && <span className={`rounded-full px-2 py-1 text-xs ${priorityColors[t.priority]}`}>اولویت {priorityLabels[t.priority]}</span>}
                    {(t.default_assignees || []).length > 0 && <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">{faNum(t.default_assignees.length)} مسئول پیش‌فرض</span>}
                    {(t.checklist || []).length > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                        <CheckCircle className="h-3.5 w-3.5" /> چک‌لیست {faNum(t.checklist.length)} مرحله
                      </span>
                    )}
                  </div>
                  {(t.checklist || []).length > 0 && (
                    <details className="mt-3 rounded-xl bg-muted/50 px-3 py-2">
                      <summary className="cursor-pointer text-xs font-medium text-muted-foreground">نمایش مراحل ضروری</summary>
                      <ul className="mt-2 space-y-1.5">{t.checklist.map((item, i) => <li key={i} className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />{item}</li>)}</ul>
                    </details>
                  )}
                  <button
                    onClick={() => onUse(t)}
                    className="mt-4 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    ساخت تسک از قالب
                  </button>
                </article>
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
