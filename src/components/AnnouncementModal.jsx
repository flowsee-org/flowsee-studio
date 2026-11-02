import { useEffect, useState } from "react";
import { studio } from "@/api/studioClient";
import { X, Upload, Pin, Clock } from "lucide-react";
import RichTextField from "@/components/RichTextField";
import PersianDatePicker from "@/components/PersianDatePicker";

export default function AnnouncementModal({ editAnnouncement, onClose, onSaved }) {
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState(
    editAnnouncement || {
      title: "",
      body: "",
      file_url: "",
      target_audience: "all",
      target_team: "",
      target_names: [],
      pinned: false,
      expires_at: "",
    }
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    studio.entities.Employee.list().then(setEmployees);
  }, []);

  const toggleName = (name) => {
    const current = form.target_names || [];
    setForm({
      ...form,
      target_names: current.includes(name) ? current.filter((n) => n !== name) : [...current, name],
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await studio.integrations.Core.UploadFile({ file });
      setForm({ ...form, file_url });
    } catch (err) {
      console.error("Upload failed", err);
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!form.title || !form.body) return;
    setSaving(true);
    const data = { ...form };
    if (data.target_audience !== "team") data.target_team = "";
    if (data.target_audience !== "individual") data.target_names = [];
    if (editAnnouncement?.id) {
      await studio.entities.Announcement.update(editAnnouncement.id, data);
    } else {
      await studio.entities.Announcement.create(data);
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl w-full max-w-xl p-5 sm:p-6 shadow-xl max-h-[90vh] overflow-y-auto scrollbar-thin" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg">{editAnnouncement?.id ? "ویرایش اعلان" : "اعلان جدید"}</h2>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">
              عنوان <span className="text-[#D35400]">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">
              متن <span className="text-[#D35400]">*</span>
            </label>
            <div className="border border-input rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-primary/30 [&_.ql-editor]:min-h-[140px] [&_.ql-editor]:text-sm [&_.ql-toolbar]:border-b [&_.ql-toolbar]:border-input [&_.ql-container]:border-0">
              <RichTextField label="متن اعلان" value={form.body} onChange={(html) => setForm({ ...form, body: html })} placeholder="متن اعلان را بنویسید…" />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">می‌توانید متن را پررنگ، زیرخط‌دار یا به صورت لیست بنویسید.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1.5">مخاطب</label>
              <select
                value={form.target_audience}
                onChange={(e) => setForm({ ...form, target_audience: e.target.value })}
                className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="all">همه</option>
                <option value="team">تیم</option>
                <option value="individual">افراد خاص</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">تاریخ انقضا</label>
              <PersianDatePicker
                label=""
                value={form.expires_at || ""}
                onChange={(v) => setForm({ ...form, expires_at: v })}
                placeholder="بدون انقضا"
              />
            </div>
          </div>
          {form.target_audience === "team" && (
            <div>
              <label className="text-sm font-medium block mb-1.5">نام تیم</label>
              <input
                type="text"
                value={form.target_team || ""}
                onChange={(e) => setForm({ ...form, target_team: e.target.value })}
                placeholder="مثلاً: تیم فروش"
                className="w-full border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          )}
          {form.target_audience === "individual" && (
            <div>
              <label className="text-sm font-medium block mb-1.5">انتخاب افراد</label>
              <div className="border border-input rounded-xl p-2.5 max-h-32 overflow-y-auto scrollbar-thin space-y-1">
                {employees.map((emp) => (
                  <label key={emp.id} className="flex items-center gap-2 cursor-pointer hover:bg-accent/50 rounded-lg px-2 py-1.5">
                    <input
                      type="checkbox"
                      checked={(form.target_names || []).includes(emp.name)}
                      onChange={() => toggleName(emp.name)}
                      className="w-4 h-4 accent-primary"
                    />
                    <span className="text-sm">{emp.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="text-sm font-medium block mb-1.5">فایل پیوست</label>
            <div className="flex items-center gap-2">
              <label className="flex-1 border border-dashed border-input rounded-xl px-4 py-2.5 text-sm text-muted-foreground cursor-pointer hover:bg-accent/30 flex items-center gap-2">
                <Upload className="w-4 h-4" />
                {uploading ? "در حال آپلود..." : form.file_url ? "فایل آپلود شده ✓" : "آپلود فایل"}
                <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
              </label>
              {form.file_url && (
                <button onClick={() => setForm({ ...form, file_url: "" })} className="text-xs text-red-500 hover:underline">
                  حذف
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.pinned || false}
                onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-sm flex items-center gap-1"><Pin className="w-4 h-4" /> پین کردن اعلان</span>
            </label>
            {form.expires_at && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> منقضی در {form.expires_at}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !form.title || !form.body}
          className="sticky bottom-0 z-10 w-full border-t border-border bg-primary text-primary-foreground py-3 rounded-xl font-medium mt-5 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? "در حال ثبت..." : editAnnouncement?.id ? "ذخیره تغییرات" : "ثبت اعلان"}
        </button>
      </div>
    </div>
  );
}
