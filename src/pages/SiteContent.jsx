import RichTextField from "@/components/RichTextField";
import { uploadEditorImage, uploadEditorFile } from "@/lib/editor-image";
import { useCallback, useEffect, useState } from "react";
import { ExternalLink, FileImage, Loader2, Plus, RefreshCw, Save, Trash2, Upload, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { canAccessModule } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { siteContentMediaUrl } from "@/lib/site-content-media";
import { MAIN_API_URL } from "@/lib/mainApi";

const API = `${MAIN_API_URL}/api/studio/site-content`;
const SITE = MAIN_API_URL;

function ImagePreview({ path, alt = "", className }) {
  const [failedPath, setFailedPath] = useState("");
  const failed = Boolean(path) && failedPath === path;
  if (!path || failed) {
    return (
      <div className={`flex items-center justify-center rounded-lg border border-dashed bg-muted/30 p-2 text-center text-xs text-muted-foreground ${className}`} role="img" aria-label={failed ? "تصویر پیدا نشد؛ برای بارگذاری دوباره ویرایش نمونه‌کار را باز کنید" : alt || "تصویری انتخاب نشده"}>
        {failed ? "تصویر در دسترس نیست؛ ویرایش نمونه‌کار را باز کنید" : <FileImage className="h-6 w-6" />}
      </div>
    );
  }
  return <img src={siteContentMediaUrl(path)} alt={alt} title={path} className={className} onError={() => setFailedPath(path)} />;
}

function authHeaders() {
  return {
    Authorization: `Bearer ${localStorage.getItem("studio_access_token") || ""}`,
    Accept: "application/json",
  };
}

async function apiRequest(path = "", options = {}) {
  const response = await fetch(`${API}${path}`, { ...options, headers: { ...authHeaders(), ...options.headers } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || (response.status === 401 ? "نشست Studio منقضی شده است؛ دوباره وارد شوید." : "ارتباط با نمونه‌کارها ناموفق بود."));
  return result;
}

const blankProject = () => ({ name: "", slug: "", description: "", cover_image: "", service_id: "", asset_id: "", is_featured: false, has_case_study: false, is_active: true, sort_order: 0, gallery_images: [] });
const blankCaseStudy = (project) => ({ slug: project.slug || "", title: project.name || "", lead: "", eyebrow: "", client_name: "", industry: "", services_provided: "", cover_image: project.cover_image || "", cover_caption: "", meta_title: "", meta_description: "", theme_color: "#012233", is_published: false, sections: [], colors: [] });

function Field({ label, value, onChange, type = "text", multiline = false, ...props }) {
  const classes = "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {multiline ? (
        <textarea value={value ?? ""} onChange={(event) => onChange(event.target.value)} className={`${classes} min-h-24 resize-y`} {...props} />
      ) : (
        <input type={type} value={value ?? ""} onChange={(event) => onChange(event.target.value)} className={classes} {...props} />
      )}
    </label>
  );
}

function ImageUpload({ label, value, onChange, token }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const upload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const body = new FormData();
      body.append("image", file);
      const response = await fetch(`${API}/images`, { method: "POST", headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, body });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "آپلود تصویر انجام نشد.");
      onChange(result.path);
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex flex-wrap items-center gap-3">
        <ImagePreview path={value} alt="پیش‌نمایش تصویر" className="h-20 w-28 rounded-lg border object-cover" />
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm hover:bg-accent">
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={upload} disabled={uploading} />
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? "در حال آپلود" : "انتخاب تصویر"}
        </label>
        {value && <button type="button" onClick={() => onChange("")} className="text-sm text-destructive hover:underline">حذف تصویر</button>}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">JPG، PNG یا WebP؛ حداکثر ۵ مگابایت. خروجی به WebP تبدیل می‌شود.</p>
    </div>
  );
}

function ColorPaletteItem({ color, onChange, onRemove }) {
  const [mode, setMode] = useState("hex");

  const toRgb = (hexStr) => {
    const match = (hexStr || "").replace("#", "").match(/.{1,2}/g);
    if (!match || match.length < 3) return "rgb(0, 0, 0)";
    const [r, g, b] = match.map((x) => parseInt(x, 16));
    return `rgb(${r || 0}, ${g || 0}, ${b || 0})`;
  };

  const handleRgbChange = (rgbStr) => {
    const digits = rgbStr.match(/\d+/g);
    if (digits && digits.length >= 3) {
      const [r, g, b] = digits.slice(0, 3).map(Number);
      const clamp = (n) => Math.min(255, Math.max(0, n || 0));
      const toHexPart = (n) => clamp(n).toString(16).padStart(2, "0");
      const newHex = `#${toHexPart(r)}${toHexPart(g)}${toHexPart(b)}`;
      onChange({ ...color, hex: newHex });
    }
  };

  const handleHexChange = (val) => {
    let clean = val.trim();
    if (!clean.startsWith("#")) clean = "#" + clean;
    onChange({ ...color, hex: clean });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-border/80 bg-accent/20">
      <div className="flex-1 min-w-[140px]">
        <label className="text-xs font-medium text-muted-foreground block mb-1">نام رنگ</label>
        <input
          value={color.name}
          onChange={(e) => onChange({ ...color, name: e.target.value })}
          placeholder="مثلاً نارنجی برند"
          required
          className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
        />
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-muted-foreground block mb-1">پیش‌نمایش</label>
        <div
          style={{ backgroundColor: color.hex }}
          className="h-10 w-10 rounded-xl border border-black/20 shadow-xs shrink-0 flex items-center justify-center relative overflow-hidden"
          title={`پیش‌نمایش: ${color.hex}`}
        >
          <input
            type="color"
            value={/^#[0-9A-Fa-f]{6}$/.test(color.hex) ? color.hex : "#FE5400"}
            onChange={(e) => onChange({ ...color, hex: e.target.value })}
            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
            title="انتخاب از پالت رنگی"
          />
        </div>
      </div>

      <div className="w-[150px]">
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-muted-foreground">{mode === "hex" ? "کد Hex (پیش‌فرض)" : "کد RGB"}</label>
          <button
            type="button"
            onClick={() => setMode(mode === "hex" ? "rgb" : "hex")}
            className="text-[11px] text-primary hover:underline font-medium"
          >
            {mode === "hex" ? "حالت RGB" : "حالت Hex"}
          </button>
        </div>
        {mode === "hex" ? (
          <input
            dir="ltr"
            value={color.hex}
            onChange={(e) => handleHexChange(e.target.value)}
            placeholder="#FE5400"
            required
            pattern="^#[0-9A-Fa-f]{6}$"
            title="کد هگز ۶ رقمی با #"
            className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-mono"
          />
        ) : (
          <input
            dir="ltr"
            defaultValue={toRgb(color.hex)}
            onChange={(e) => handleRgbChange(e.target.value)}
            placeholder="rgb(254, 84, 0)"
            className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-xs font-mono"
          />
        )}
      </div>

      <button
        type="button"
        onClick={onRemove}
        aria-label="حذف رنگ"
        className="rounded-lg p-2 text-destructive hover:bg-destructive/10 mt-3"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function CaseStudyEditor({ project, services, token, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    ...blankProject(),
    ...(project || {}),
    ...blankCaseStudy(project || blankProject()),
    ...(project?.case_study || {}),
    service_id: project?.service_id || "",
    sort_order: project?.sort_order ?? 0,
    gallery_images: project?.gallery_images || [],
    sections: project?.case_study?.sections || [],
    colors: project?.case_study?.colors || [],
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const updateSection = (index, key, value) => setForm((current) => ({ ...current, sections: current.sections.map((section, i) => i === index ? { ...section, [key]: value } : section) }));
  
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const projectPayload = {
        name: form.name,
        slug: form.slug,
        description: form.description || "",
        cover_image: form.cover_image || "",
        service_id: form.service_id || null,
        asset_id: form.asset_id || "",
        is_featured: !!form.is_featured,
        has_case_study: true,
        is_active: !!form.is_active,
        sort_order: Number(form.sort_order || 0),
        gallery_images: form.gallery_images || [],
      };
      const projectResponse = await fetch(project ? `${API}/projects/${project.id}` : `${API}/projects`, {
        method: project ? "PUT" : "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(projectPayload),
      });
      const savedProject = await projectResponse.json().catch(() => ({}));
      if (!projectResponse.ok) throw new Error(savedProject.message || "ذخیره پروژه انجام نشد.");

      const { sections, colors, ...caseStudy } = form;
      const response = await fetch(`${API}/projects/${project?.id || savedProject.project.id}/case-study`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ ...caseStudy, sections, colors }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "ذخیره کیس‌استادی انجام نشد.");
      onSaved();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={project ? `ویرایش نمونه‌کار «${project.name}»` : "ساخت نمونه‌کار جدید"} onClose={onClose}>
      <form onSubmit={save} className="space-y-5">
        <EditorSection title="اطلاعات پروژه" defaultOpen>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="نام پروژه" value={form.name} onChange={(v) => set("name", v)} required />
            <Field label="عنوان کیس‌استادی" value={form.title} onChange={(v) => set("title", v)} required />
            <Field label="اسلاگ یکتا" value={form.slug} onChange={(v) => set("slug", v)} required dir="ltr" />
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">دسته‌بندی خدمت</span>
              <select value={form.service_id} onChange={(event) => set("service_id", event.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm">
                <option value="">بدون دسته‌بندی</option>
                {services.map((service) => <option key={service.id} value={service.id}>{service.title}</option>)}
              </select>
            </label>
            <Field label="نام مشتری" value={form.client_name} onChange={(v) => set("client_name", v)} />
            <Field label="حوزهٔ فعالیت" value={form.industry} onChange={(v) => set("industry", v)} />
            <Field label="خدمات ارائه‌شده" value={form.services_provided} onChange={(v) => set("services_provided", v)} />
            <Field label="برچسب بالای عنوان" value={form.eyebrow} onChange={(v) => set("eyebrow", v)} />
          </div>
          <Field label="توضیح کوتاه کارت پروژه" value={form.description} onChange={(v) => set("description", v)} multiline />
        </EditorSection>

        <EditorSection title="داستان و تصاویر پروژه">
          <RichTextField uploadImage={uploadEditorImage} uploadFile={uploadEditorFile} label="خلاصهٔ کیس‌استادی" value={form.lead} onChange={(v) => set("lead", v)} />
          <ImageUpload label="تصویر اصلی پروژه و کیس‌استادی" value={form.cover_image} onChange={(v) => set("cover_image", v)} token={token} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 rounded-xl border p-3 text-sm">
              <input type="checkbox" checked={!!form.is_active} onChange={(e) => set("is_active", e.target.checked)} />نمایش پروژه در سایت
            </label>
            <label className="flex items-center gap-2 rounded-xl border p-3 text-sm">
              <input type="checkbox" checked={!!form.is_featured} onChange={(e) => set("is_featured", e.target.checked)} />پروژهٔ ویژه
            </label>
            <label className="flex items-center gap-2 rounded-xl border p-3 text-sm">
              <input type="checkbox" checked={!!form.is_published} onChange={(e) => set("is_published", e.target.checked)} />انتشار کیس‌استادی در سایت
            </label>
          </div>
          <GalleryEditor images={form.gallery_images || []} token={token} onChange={(images) => set("gallery_images", images)} />
        </EditorSection>

        <EditorSection title="سئو و تنظیمات نمایش">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="اولویت نمایش در صفحه اصلی (ترتیب عددی، مثلاً ۱ برای اولین)" type="number" min="0" value={form.sort_order} onChange={(v) => set("sort_order", Number(v))} />
            <Field label="عنوان سئو" value={form.meta_title} onChange={(v) => set("meta_title", v)} />
            <Field label="توضیحات سئو" value={form.meta_description} onChange={(v) => set("meta_description", v)} />
            <Field label="کپشن کاور" value={form.cover_caption} onChange={(v) => set("cover_caption", v)} />
            <Field label="رنگ اصلی تم" type="color" value={form.theme_color || "#012233"} onChange={(v) => set("theme_color", v)} />
          </div>
        </EditorSection>

        <EditorSection title="بخش‌های داستان پروژه">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">بخش‌های داستان پروژه</h3>
            <Button type="button" variant="outline" size="sm" onClick={() => set("sections", [...form.sections, { slug: `section-${form.sections.length + 1}`, title: "", lead: "", eyebrow: "", index_label: String(form.sections.length + 1), band_image: "", band_caption: "", steps: [], images: [] }])}>
              <Plus className="ml-1 h-4 w-4" />افزودن بخش
            </Button>
          </div>
          {form.sections.map((section, index) => (
            <EditorSection key={section.id || index} title={section.title || `بخش ${index + 1}`} defaultOpen={!section.title}>
              <div className="flex items-center justify-between">
                <span className="font-medium">بخش {index + 1}</span>
                <button type="button" onClick={() => set("sections", form.sections.filter((_, i) => i !== index))} className="rounded-lg p-2 text-destructive hover:bg-destructive/10" aria-label="حذف بخش">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="عنوان بخش" value={section.title} onChange={(v) => updateSection(index, "title", v)} required />
                <Field label="اسلاگ بخش" value={section.slug} onChange={(v) => updateSection(index, "slug", v)} required dir="ltr" />
                <Field label="برچسب کوچک" value={section.eyebrow} onChange={(v) => updateSection(index, "eyebrow", v)} />
                <Field label="شماره" value={section.index_label} onChange={(v) => updateSection(index, "index_label", v)} />
              </div>
              <RichTextField uploadImage={uploadEditorImage} uploadFile={uploadEditorFile} label="متن بخش" value={section.lead} onChange={(v) => updateSection(index, "lead", v)} />
              <ImageUpload label="تصویر پس‌زمینهٔ بخش (اختیاری)" value={section.band_image} onChange={(v) => updateSection(index, "band_image", v)} token={token} />
              <StepsEditor steps={section.steps || []} onChange={(steps) => updateSection(index, "steps", steps)} />
              <GalleryEditor images={section.images || []} token={token} onChange={(images) => updateSection(index, "images", images)} />
            </EditorSection>
          ))}
        </EditorSection>

        <EditorSection title="پالت رنگ">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">پالت رنگ پروژه</h3>
            <Button type="button" variant="outline" size="sm" onClick={() => set("colors", [...form.colors, { name: "", hex: "#FE5400" }])}>
              <Plus className="ml-1 h-4 w-4" />افزودن رنگ
            </Button>
          </div>
          <div className="space-y-2.5">
            {form.colors.length === 0 && <p className="text-xs text-muted-foreground py-2 text-center border border-dashed rounded-xl">هنوز رنگی برای این پروژه ثبت نشده است.</p>}
            {form.colors.map((color, index) => (
              <ColorPaletteItem
                key={color.id || index}
                color={color}
                onChange={(updated) => set("colors", form.colors.map((item, i) => i === index ? updated : item))}
                onRemove={() => set("colors", form.colors.filter((_, i) => i !== index))}
              />
            ))}
          </div>
        </EditorSection>

        {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        <ModalActions saving={saving} onClose={onClose} />
      </form>
    </Modal>
  );
}

function EditorSection({ title, defaultOpen = false, children }) {
  return (
    <details open={defaultOpen} className="group rounded-2xl border border-border bg-card" onInvalidCapture={(event) => { event.currentTarget.open = true; }}>
      <summary className="cursor-pointer select-none rounded-2xl px-4 py-4 font-semibold focus-visible:outline-primary">{title}</summary>
      <div className="space-y-4 border-t border-border p-4">{children}</div>
    </details>
  );
}

function StepsEditor({ steps, onChange }) {
  return (
    <div className="space-y-2 rounded-lg bg-accent/40 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">مراحل</span>
        <button type="button" onClick={() => onChange([...steps, { title: "", description: "", step_number: String(steps.length + 1) }])} className="text-xs text-primary">افزودن مرحله</button>
      </div>
      {steps.map((step, index) => (
        <div key={step.id || index} className="grid gap-2 sm:grid-cols-[100px_1fr_auto]">
          <input aria-label="شماره مرحله" value={step.step_number || ""} onChange={(e) => onChange(steps.map((item, i) => i === index ? { ...item, step_number: e.target.value } : item))} className="rounded-lg border bg-background px-2 py-2 text-sm" placeholder="شماره" />
          <input aria-label="عنوان مرحله" value={step.title || ""} onChange={(e) => onChange(steps.map((item, i) => i === index ? { ...item, title: e.target.value } : item))} className="rounded-lg border bg-background px-2 py-2 text-sm" placeholder="عنوان مرحله" />
          <button type="button" aria-label="حذف مرحله" onClick={() => onChange(steps.filter((_, i) => i !== index))} className="text-destructive"><X className="h-4 w-4" /></button>
          <div className="sm:col-span-3">
            <RichTextField uploadImage={uploadEditorImage} uploadFile={uploadEditorFile} label="توضیحات مرحله" value={step.description} onChange={(description) => onChange(steps.map((item, i) => i === index ? { ...item, description } : item))} />
          </div>
        </div>
      ))}
    </div>
  );
}

function GalleryEditor({ images, token, onChange }) {
  const upload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const body = new FormData();
    body.append("image", file);
    const response = await fetch(`${API}/images`, { method: "POST", headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, body });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "آپلود تصویر ناموفق بود.");
    onChange([...images, { path: result.path, caption: "", alt: "", layout: "full" }]);
  };

  return (
    <div className="space-y-2 rounded-lg bg-accent/40 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">تصاویر گالری</span>
        <label className="cursor-pointer text-xs text-primary">
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => upload(e).catch((error) => window.alert(error.message))} />
          افزودن تصویر
        </label>
      </div>
      {images.map((image, index) => (
        <div key={image.id || `${image.path}-${index}`} className="flex flex-wrap items-center gap-2">
          <ImagePreview path={image.path} alt={image.alt || image.caption || "پیش‌نمایش تصویر گالری"} className="h-12 w-16 shrink-0 rounded object-cover" />
          <input aria-label="کپشن تصویر" value={image.caption || ""} onChange={(e) => onChange(images.map((item, i) => i === index ? { ...item, caption: e.target.value } : item))} className="min-w-0 flex-1 rounded-lg border bg-background px-2 py-2 text-sm" placeholder="کپشن" />
          <input aria-label="متن جایگزین تصویر" value={image.alt || ""} onChange={(e) => onChange(images.map((item, i) => i === index ? { ...item, alt: e.target.value } : item))} className="min-w-0 flex-1 rounded-lg border bg-background px-2 py-2 text-sm" placeholder="توضیح برای صفحه‌خوان" />
          <select aria-label="چیدمان تصویر" value={image.layout || "full"} onChange={(e) => onChange(images.map((item, i) => i === index ? { ...item, layout: e.target.value } : item))} className="rounded-lg border bg-background px-2 py-2 text-sm">
            <option value="full">تمام‌عرض</option>
            <option value="half">نیمه</option>
            <option value="third">یک‌سوم</option>
          </select>
          <button type="button" onClick={() => onChange(images.filter((_, i) => i !== index))} className="text-destructive" aria-label="حذف تصویر">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title} className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
        <header className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="بستن" className="rounded-lg p-2 text-muted-foreground hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({ saving, onClose }) {
  return (
    <footer className="sticky bottom-0 -mx-5 mt-4 flex flex-wrap justify-start gap-3 border-t border-border bg-card px-5 py-4 sm:-mx-6 sm:px-6">
      <Button type="submit" disabled={saving}>
        {saving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
        ذخیره
      </Button>
      <Button type="button" variant="outline" onClick={onClose}>انصراف</Button>
    </footer>
  );
}

export default function SiteContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState(null);
  const [refresh, setRefresh] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest();
      setProjects(result.projects || []);
      setServices(result.services || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && canAccessModule(user, "site-content")) load();
  }, [user, load, refresh]);

  const saved = () => {
    setEditor(null);
    setRefresh((value) => value + 1);
    toast({ title: "نمونه‌کارها ذخیره شد" });
  };

  const deleteProject = async (project) => {
    if (!window.confirm(`پروژهٔ «${project.name}» و کیس‌استادی وابسته حذف شود؟`)) return;
    try {
      await apiRequest(`/projects/${project.id}`, { method: "DELETE" });
      setRefresh((value) => value + 1);
      toast({ title: "پروژه حذف شد" });
    } catch (deleteError) {
      toast({ title: "حذف انجام نشد", description: deleteError.message, variant: "destructive" });
    }
  };

  if (!canAccessModule(user, "site-content")) {
    return (
      <div dir="rtl" className="mx-auto flex min-h-80 max-w-3xl items-center justify-center rounded-2xl border bg-card p-8 text-center text-muted-foreground">
        شما دسترسی به مدیریت محتوای سایت و نمونه‌کارها را ندارید.
      </div>
    );
  }

  return (
    <main dir="rtl" className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">نمونه‌کارها</h1>
          <p className="mt-1 text-sm text-muted-foreground">هر نمونه‌کار، پالت رنگ و کیس‌استادی را یک‌جا مدیریت کنید.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setRefresh((value) => value + 1)} disabled={loading}>
            <RefreshCw className={`ml-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            تازه‌سازی
          </Button>
          <Button onClick={() => setEditor({ type: "case-study", project: null })}>
            <Plus className="ml-2 h-4 w-4" />
            نمونه‌کار جدید
          </Button>
        </div>
      </header>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={() => setRefresh((value) => value + 1)}>تلاش دوباره</Button>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-56 items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />در حال دریافت محتوا…
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">هنوز نمونه‌کاری برای سایت ثبت نشده است.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <article key={project.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm flex flex-col">
              <div className="relative h-44 bg-accent">
                <ImagePreview path={project.cover_image} alt={project.name} className="h-full w-full object-cover" />
                <div className="absolute right-3 top-3 flex gap-1.5 flex-wrap">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${project.is_active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>
                    {project.is_active ? "نمایش در سایت" : "پیش‌نویس"}
                  </span>
                  {project.sort_order !== undefined && project.sort_order !== null && (
                    <span className="rounded-full bg-background/90 backdrop-blur-sm border px-2.5 py-1 text-xs font-semibold text-primary">
                      اولویت {project.sort_order}
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-3 p-4 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <div>
                    <h2 className="font-bold text-base">{project.name}</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground" dir="ltr">/{project.slug} · {project.service?.title || "بدون دسته‌بندی"}</p>
                  </div>
                  {project.description && <p className="line-clamp-2 text-sm text-muted-foreground">{project.description}</p>}

                  {/* Color Palette preview in Studio */}
                  {project.case_study?.colors?.length > 0 && (
                    <div className="flex items-center gap-1.5 pt-2 border-t border-border/60">
                      <span className="text-xs text-muted-foreground shrink-0">رنگ‌ها:</span>
                      <div className="flex flex-wrap gap-1">
                        {project.case_study.colors.map((c, i) => (
                          <span
                            key={i}
                            title={`${c.name} (${c.hex})`}
                            style={{ backgroundColor: c.hex }}
                            className="inline-block h-4 w-4 rounded-full border border-black/20 shadow-xs"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between border-t border-border pt-3 mb-3">
                    <span className={`text-xs ${project.case_study?.is_published ? "text-emerald-700 font-medium" : "text-muted-foreground"}`}>
                      {project.case_study ? (project.case_study.is_published ? "کیس‌استادی منتشرشده" : "کیس‌استادی پیش‌نویس") : "کیس‌استادی ندارد"}
                    </span>
                    <a className="inline-flex items-center gap-1 text-xs text-primary hover:underline" href={`${SITE}/projects/${project.slug}`} target="_blank" rel="noreferrer">
                      مشاهده در سایت <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditor({ type: "case-study", project })}>
                      <FileImage className="ml-1 h-3.5 w-3.5" />
                      {project.case_study ? "ویرایش نمونه‌کار" : "ساخت نمونه‌کار"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteProject(project)} className="mr-auto text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">حذف نمونه‌کار</span>
                    </Button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {editor?.type === "case-study" && (
        <CaseStudyEditor
          project={editor.project}
          services={services}
          token={localStorage.getItem("studio_access_token")}
          onClose={() => setEditor(null)}
          onSaved={saved}
        />
      )}
    </main>
  );
}
