import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ExternalLink, FileImage, Loader2, Plus, RefreshCw, Save, Trash2, Upload, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { siteContentMediaUrl } from "@/lib/site-content-media";

const API = "https://flowsee.ir/api/studio/site-content";
const SITE = "https://flowsee.ir";
const RTE_CDN = "https://cdn.jsdelivr.net/npm/@richscripts/richtexteditor@2.14.1/richtexteditor";
let richTextEditorAssets;

function ImagePreview({ path, alt = "", className }) {
  const [failedPath, setFailedPath] = useState("");
  const failed = Boolean(path) && failedPath === path;
  if (!path || failed) return <div className={`flex items-center justify-center rounded-lg border border-dashed bg-muted/30 p-2 text-center text-xs text-muted-foreground ${className}`} role="img" aria-label={failed ? "تصویر پیدا نشد؛ برای بارگذاری دوباره ویرایش نمونه‌کار را باز کنید" : alt || "تصویری انتخاب نشده"}>{failed ? "تصویر در دسترس نیست؛ ویرایش نمونه‌کار را باز کنید" : <FileImage className="h-6 w-6" />}</div>;
  return <img src={siteContentMediaUrl(path)} alt={alt} title={path} className={className} onError={() => setFailedPath(path)} />;
}

function loadRichTextEditor() {
  if (window.RichTextEditor) return Promise.resolve();
  if (!richTextEditorAssets) {
    richTextEditorAssets = new Promise((resolve, reject) => {
      const stylesheet = document.createElement("link");
      stylesheet.rel = "stylesheet";
      stylesheet.href = `${RTE_CDN}/rte_theme_default.min.css`;
      stylesheet.dataset.richTextEditor = "theme";
      document.head.appendChild(stylesheet);

      const script = document.createElement("script");
      script.src = `${RTE_CDN}/rte.js`;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error("بارگذاری ویرایشگر متن انجام نشد."));
      document.head.appendChild(script);
    }).catch((error) => {
      richTextEditorAssets = null;
      throw error;
    });
  }
  return richTextEditorAssets;
}

function authHeaders() {
  return {
    Authorization: `Bearer ${localStorage.getItem("base44_access_token") || ""}`,
    Accept: "application/json",
  };
}

async function apiRequest(path = "", options = {}) {
  const response = await fetch(`${API}${path}`, { ...options, headers: { ...authHeaders(), ...options.headers } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || (response.status === 401 ? "نشست Studio منقضی شده است؛ دوباره وارد شوید." : "ارتباط با محتوای سایت ناموفق بود."));
  return result;
}

const blankProject = () => ({ name: "", slug: "", description: "", cover_image: "", service_id: "", asset_id: "", is_featured: false, has_case_study: false, is_active: true, sort_order: 0, gallery_images: [] });
const blankCaseStudy = (project) => ({ slug: project.slug || "", title: project.name || "", lead: "", eyebrow: "", client_name: "", industry: "", services_provided: "", cover_image: project.cover_image || "", cover_caption: "", meta_title: "", meta_description: "", theme_color: "#012233", is_published: false, sections: [], colors: [] });

function Field({ label, value, onChange, type = "text", multiline = false, ...props }) {
  const classes = "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";
  return <label className="block space-y-1.5"><span className="text-sm font-medium">{label}</span>{multiline ? <textarea value={value ?? ""} onChange={(event) => onChange(event.target.value)} className={`${classes} min-h-24 resize-y`} {...props} /> : <input type={type} value={value ?? ""} onChange={(event) => onChange(event.target.value)} className={classes} {...props} />}</label>;
}

function RichTextField({ label, value, onChange }) {
  const id = useId().replace(/:/g, "");
  const changeRef = useRef(onChange);
  const [loadError, setLoadError] = useState("");
  useEffect(() => { changeRef.current = onChange; }, [onChange]);
  useEffect(() => {
    let active = true;
    let editor;
    loadRichTextEditor().then(() => {
      if (!active) return;
      editor = new window.RichTextEditor(`#${id}`, {
        toolbar: "custom",
        toolbar_custom: "{paragraphs,fontname,fontsize}|{bold,italic,underline,strike,superscript,subscript}|{forecolor,backcolor,removeformat}/{justifymenu,insertorderedlist,insertunorderedlist,insertblockquote,indent,outdent}|{insertlink,unlink,insertimage,insertvideo,inserttable}|{undo,redo,find,cleancode,code,preview,fullscreen}",
        toolbarMobile: "mobile",
        maxWidthForMobile: 720,
        height: "340px",
        contentCssUrl: `${RTE_CDN}/runtime/richtexteditor_content.css`,
        contentCssText: "body{direction:rtl;text-align:right;font-family:Tahoma,Arial,sans-serif;font-size:16px;line-height:1.8;padding:12px;color:#222} img,video{max-width:100%;height:auto}",
        editorBodyCssText: "direction:rtl;text-align:right;font-family:Tahoma,Arial,sans-serif;font-size:16px;line-height:1.8;padding:12px;",
        linkDefaultProtocol: "https://",
        showStatistics: true,
        showTagList: true,
        pasteMarkdown: true,
      });
      editor.setHTMLCode(value || "");
      editor.attachEvent("change", () => changeRef.current(editor.getHTMLCode()));
    }).catch((error) => {
      if (active) setLoadError(error.message || "ویرایشگر بارگذاری نشد.");
    });
    return () => {
      active = false;
      editor?.destroy?.();
    };
  // The editor is initialized once per mounted field; its own change event keeps React state current.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return <div className="space-y-1.5"><span className="text-sm font-medium">{label}</span><div id={id} dir="rtl" className="min-h-52 rounded-xl border border-input bg-background" />{loadError && <><p role="alert" className="text-xs text-destructive">{loadError}</p><textarea aria-label={label} value={value ?? ""} onChange={(event) => onChange(event.target.value)} className="min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm" /></>}</div>;
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
  return <div className="space-y-2"><span className="text-sm font-medium">{label}</span><div className="flex flex-wrap items-center gap-3"><ImagePreview path={value} alt="پیش‌نمایش تصویر" className="h-20 w-28 rounded-lg border object-cover" /><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm hover:bg-accent"><input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={upload} disabled={uploading} />{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{uploading ? "در حال آپلود" : "انتخاب تصویر"}</label>{value && <button type="button" onClick={() => onChange("")} className="text-sm text-destructive hover:underline">حذف تصویر</button>}</div>{error && <p className="text-xs text-destructive">{error}</p>}<p className="text-xs text-muted-foreground">JPG، PNG یا WebP؛ حداکثر ۵ مگابایت. خروجی به WebP تبدیل می‌شود.</p></div>;
}

function CaseStudyEditor({ project, services, token, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    ...blankProject(),
    ...(project || {}),
    ...blankCaseStudy(project || blankProject()),
    ...(project?.case_study || {}),
    service_id: project?.service_id || "",
    gallery_images: project?.gallery_images || [],
    sections: project?.case_study?.sections || [],
    colors: project?.case_study?.colors || [],
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const updateSection = (index, key, value) => setForm((current) => ({ ...current, sections: current.sections.map((section, i) => i === index ? { ...section, [key]: value } : section) }));
  const save = async (event) => {
    event.preventDefault(); setSaving(true); setError("");
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
    } catch (saveError) { setError(saveError.message); }
    finally { setSaving(false); }
  };
  return <Modal title={project ? `ویرایش نمونه‌کار «${project.name}»` : "ساخت نمونه‌کار جدید"} onClose={onClose}>
    <form onSubmit={save} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2"><Field label="نام پروژه" value={form.name} onChange={(v) => set("name", v)} required /><Field label="عنوان کیس‌استادی" value={form.title} onChange={(v) => set("title", v)} required /><Field label="اسلاگ یکتا" value={form.slug} onChange={(v) => set("slug", v)} required dir="ltr" /><label className="block space-y-1.5"><span className="text-sm font-medium">دسته‌بندی خدمت</span><select value={form.service_id} onChange={(event) => set("service_id", event.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm"><option value="">بدون دسته‌بندی</option>{services.map((service) => <option key={service.id} value={service.id}>{service.title}</option>)}</select></label><Field label="نام مشتری" value={form.client_name} onChange={(v) => set("client_name", v)} /><Field label="حوزهٔ فعالیت" value={form.industry} onChange={(v) => set("industry", v)} /><Field label="خدمات ارائه‌شده" value={form.services_provided} onChange={(v) => set("services_provided", v)} /><Field label="برچسب بالای عنوان" value={form.eyebrow} onChange={(v) => set("eyebrow", v)} /></div>
      <Field label="توضیح کوتاه کارت پروژه" value={form.description} onChange={(v) => set("description", v)} multiline />
      <RichTextField label="خلاصهٔ کیس‌استادی" value={form.lead} onChange={(v) => set("lead", v)} />
      <ImageUpload label="تصویر اصلی پروژه و کیس‌استادی" value={form.cover_image} onChange={(v) => set("cover_image", v)} token={token} />
      <div className="grid gap-3 sm:grid-cols-2"><label className="flex items-center gap-2 rounded-xl border p-3 text-sm"><input type="checkbox" checked={!!form.is_active} onChange={(e) => set("is_active", e.target.checked)} />نمایش پروژه در سایت</label><label className="flex items-center gap-2 rounded-xl border p-3 text-sm"><input type="checkbox" checked={!!form.is_featured} onChange={(e) => set("is_featured", e.target.checked)} />پروژهٔ ویژه</label><label className="flex items-center gap-2 rounded-xl border p-3 text-sm"><input type="checkbox" checked={!!form.is_published} onChange={(e) => set("is_published", e.target.checked)} />انتشار کیس‌استادی در سایت</label></div>
      <GalleryEditor images={form.gallery_images || []} token={token} onChange={(images) => set("gallery_images", images)} />
      <div className="grid gap-4 sm:grid-cols-2"><Field label="عنوان سئو" value={form.meta_title} onChange={(v) => set("meta_title", v)} /><Field label="توضیحات سئو" value={form.meta_description} onChange={(v) => set("meta_description", v)} /><Field label="کپشن کاور" value={form.cover_caption} onChange={(v) => set("cover_caption", v)} /><Field label="رنگ اصلی" type="color" value={form.theme_color || "#012233"} onChange={(v) => set("theme_color", v)} /></div>
      <div className="flex items-center justify-between"><h3 className="font-semibold">بخش‌های داستان پروژه</h3><Button type="button" variant="outline" size="sm" onClick={() => set("sections", [...form.sections, { slug: `section-${form.sections.length + 1}`, title: "", lead: "", eyebrow: "", index_label: String(form.sections.length + 1), band_image: "", band_caption: "", steps: [], images: [] }])}><Plus className="ml-1 h-4 w-4" />افزودن بخش</Button></div>
      {form.sections.map((section, index) => <div key={section.id || index} className="space-y-4 rounded-xl border border-border p-4"><div className="flex items-center justify-between"><span className="font-medium">بخش {index + 1}</span><button type="button" onClick={() => set("sections", form.sections.filter((_, i) => i !== index))} className="rounded-lg p-2 text-destructive hover:bg-destructive/10" aria-label="حذف بخش"><Trash2 className="h-4 w-4" /></button></div><div className="grid gap-3 sm:grid-cols-2"><Field label="عنوان بخش" value={section.title} onChange={(v) => updateSection(index, "title", v)} required /><Field label="اسلاگ بخش" value={section.slug} onChange={(v) => updateSection(index, "slug", v)} required dir="ltr" /><Field label="برچسب کوچک" value={section.eyebrow} onChange={(v) => updateSection(index, "eyebrow", v)} /><Field label="شماره" value={section.index_label} onChange={(v) => updateSection(index, "index_label", v)} /></div><RichTextField label="متن بخش" value={section.lead} onChange={(v) => updateSection(index, "lead", v)} /><ImageUpload label="تصویر پس‌زمینهٔ بخش (اختیاری)" value={section.band_image} onChange={(v) => updateSection(index, "band_image", v)} token={token} /><StepsEditor steps={section.steps || []} onChange={(steps) => updateSection(index, "steps", steps)} /><GalleryEditor images={section.images || []} token={token} onChange={(images) => updateSection(index, "images", images)} /></div>)}
      <div className="flex items-center justify-between"><h3 className="font-semibold">پالت رنگ</h3><Button type="button" variant="outline" size="sm" onClick={() => set("colors", [...form.colors, { name: "", hex: "#FE5400" }])}><Plus className="ml-1 h-4 w-4" />افزودن رنگ</Button></div>
      {form.colors.map((color, index) => <div key={color.id || index} className="grid grid-cols-[1fr_100px_auto] items-end gap-2"><Field label="نام رنگ" value={color.name} onChange={(name) => set("colors", form.colors.map((item, i) => i === index ? { ...item, name } : item))} required /><Field label="کد رنگ" type="color" value={color.hex} onChange={(hex) => set("colors", form.colors.map((item, i) => i === index ? { ...item, hex } : item))} /><button type="button" onClick={() => set("colors", form.colors.filter((_, i) => i !== index))} className="mb-1 rounded-lg p-2 text-destructive" aria-label="حذف رنگ"><Trash2 className="h-4 w-4" /></button></div>)}
      {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <ModalActions saving={saving} onClose={onClose} />
    </form>
  </Modal>;
}

function StepsEditor({ steps, onChange }) {
  return <div className="space-y-2 rounded-lg bg-accent/40 p-3"><div className="flex items-center justify-between"><span className="text-sm font-medium">مراحل</span><button type="button" onClick={() => onChange([...steps, { title: "", description: "", step_number: String(steps.length + 1) }])} className="text-xs text-primary">افزودن مرحله</button></div>{steps.map((step, index) => <div key={step.id || index} className="grid gap-2 sm:grid-cols-[100px_1fr_auto]"><input aria-label="شماره مرحله" value={step.step_number || ""} onChange={(e) => onChange(steps.map((item, i) => i === index ? { ...item, step_number: e.target.value } : item))} className="rounded-lg border bg-background px-2 py-2 text-sm" placeholder="شماره" /><input aria-label="عنوان مرحله" value={step.title || ""} onChange={(e) => onChange(steps.map((item, i) => i === index ? { ...item, title: e.target.value } : item))} className="rounded-lg border bg-background px-2 py-2 text-sm" placeholder="عنوان مرحله" /><button type="button" aria-label="حذف مرحله" onClick={() => onChange(steps.filter((_, i) => i !== index))} className="text-destructive"><X className="h-4 w-4" /></button><div className="sm:col-span-3"><RichTextField label="توضیحات مرحله" value={step.description} onChange={(description) => onChange(steps.map((item, i) => i === index ? { ...item, description } : item))} /></div></div>)}</div>;
}

function GalleryEditor({ images, token, onChange }) {
  const upload = async (event) => {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    const body = new FormData(); body.append("image", file);
    const response = await fetch(`${API}/images`, { method: "POST", headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, body });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "آپلود تصویر ناموفق بود.");
    onChange([...images, { path: result.path, caption: "", alt: "", layout: "full" }]);
  };
  return <div className="space-y-2 rounded-lg bg-accent/40 p-3"><div className="flex items-center justify-between"><span className="text-sm font-medium">تصاویر گالری</span><label className="cursor-pointer text-xs text-primary"><input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => upload(e).catch((error) => window.alert(error.message))} />افزودن تصویر</label></div>{images.map((image, index) => <div key={image.id || `${image.path}-${index}`} className="flex flex-wrap items-center gap-2"><ImagePreview path={image.path} alt={image.alt || image.caption || "پیش‌نمایش تصویر گالری"} className="h-12 w-16 shrink-0 rounded object-cover" /><input aria-label="کپشن تصویر" value={image.caption || ""} onChange={(e) => onChange(images.map((item, i) => i === index ? { ...item, caption: e.target.value } : item))} className="min-w-0 flex-1 rounded-lg border bg-background px-2 py-2 text-sm" placeholder="کپشن" /><input aria-label="متن جایگزین تصویر" value={image.alt || ""} onChange={(e) => onChange(images.map((item, i) => i === index ? { ...item, alt: e.target.value } : item))} className="min-w-0 flex-1 rounded-lg border bg-background px-2 py-2 text-sm" placeholder="توضیح برای صفحه‌خوان" /><select aria-label="چیدمان تصویر" value={image.layout || "full"} onChange={(e) => onChange(images.map((item, i) => i === index ? { ...item, layout: e.target.value } : item))} className="rounded-lg border bg-background px-2 py-2 text-sm"><option value="full">تمام‌عرض</option><option value="half">نیمه</option><option value="third">یک‌سوم</option></select><button type="button" onClick={() => onChange(images.filter((_, i) => i !== index))} className="text-destructive" aria-label="حذف تصویر"><X className="h-4 w-4" /></button></div>)}</div>;
}

function Modal({ title, onClose, children }) {
  return <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div role="dialog" aria-modal="true" aria-label={title} className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl"><header className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4"><h2 className="text-lg font-bold">{title}</h2><button type="button" onClick={onClose} aria-label="بستن" className="rounded-lg p-2 text-muted-foreground hover:bg-accent"><X className="h-5 w-5" /></button></header><div className="overflow-y-auto p-5">{children}</div></div></div>;
}

function ModalActions({ saving, onClose }) {
  return <footer className="flex justify-start gap-3 border-t border-border pt-4"><Button type="submit" disabled={saving}>{saving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}ذخیره</Button><Button type="button" variant="outline" onClick={onClose}>انصراف</Button></footer>;
}

export default function SiteContent() {
  const { user, isSuperadmin } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const result = await apiRequest(); setProjects(result.projects || []); setServices(result.services || []); }
    catch (loadError) { setError(loadError.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (isSuperadmin && user) load(); }, [isSuperadmin, user, load, refresh]);
  const saved = () => { setEditor(null); setRefresh((value) => value + 1); toast({ title: "محتوای سایت ذخیره شد" }); };
  const deleteProject = async (project) => {
    if (!window.confirm(`پروژهٔ «${project.name}» و کیس‌استادی وابسته حذف شود؟`)) return;
    try { await apiRequest(`/projects/${project.id}`, { method: "DELETE" }); setRefresh((value) => value + 1); toast({ title: "پروژه حذف شد" }); }
    catch (deleteError) { toast({ title: "حذف انجام نشد", description: deleteError.message, variant: "destructive" }); }
  };
  if (!isSuperadmin) return <div dir="rtl" className="mx-auto flex min-h-80 max-w-3xl items-center justify-center rounded-2xl border bg-card p-8 text-center text-muted-foreground">مدیریت محتوای سایت فقط برای مدیر اصلی Studio فعال است.</div>;

  return <main dir="rtl" className="mx-auto max-w-7xl space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">محتوای سایت</h1><p className="mt-1 text-sm text-muted-foreground">هر نمونه‌کار و کیس‌استادی را یک‌جا مدیریت کنید.</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => setRefresh((value) => value + 1)} disabled={loading}><RefreshCw className={`ml-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />تازه‌سازی</Button><Button onClick={() => setEditor({ type: "case-study", project: null })}><Plus className="ml-2 h-4 w-4" />نمونه‌کار جدید</Button></div></header>
    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"><span>{error}</span><Button variant="outline" size="sm" onClick={() => setRefresh((value) => value + 1)}>تلاش دوباره</Button></div>}
    {loading ? <div className="flex min-h-56 items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />در حال دریافت محتوا…</div> : projects.length === 0 ? <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">هنوز نمونه‌کاری برای سایت ثبت نشده است.</div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{projects.map((project) => <article key={project.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="relative h-44 bg-accent"><ImagePreview path={project.cover_image} alt={project.name} className="h-full w-full object-cover" /><span className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs ${project.is_active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>{project.is_active ? "نمایش در سایت" : "پیش‌نویس"}</span></div><div className="space-y-3 p-4"><div><h2 className="font-bold">{project.name}</h2><p className="mt-1 text-xs text-muted-foreground" dir="ltr">/{project.slug} · {project.service?.title || "بدون دسته‌بندی"}</p></div>{project.description && <p className="line-clamp-2 text-sm text-muted-foreground">{project.description}</p>}<div className="flex items-center justify-between border-t border-border pt-3"><span className={`text-xs ${project.case_study?.is_published ? "text-emerald-700" : "text-muted-foreground"}`}>{project.case_study ? (project.case_study.is_published ? "کیس‌استادی منتشرشده" : "کیس‌استادی پیش‌نویس") : "کیس‌استادی ندارد"}</span><a className="inline-flex items-center gap-1 text-xs text-primary hover:underline" href={`${SITE}/projects/${project.slug}`} target="_blank" rel="noreferrer">مشاهده <ExternalLink className="h-3 w-3" /></a></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => setEditor({ type: "case-study", project })}><FileImage className="ml-1 h-3.5 w-3.5" />{project.case_study ? "ویرایش نمونه‌کار" : "ساخت نمونه‌کار"}</Button><Button variant="ghost" size="sm" onClick={() => deleteProject(project)} className="mr-auto text-destructive"><Trash2 className="h-4 w-4" /><span className="sr-only">حذف نمونه‌کار</span></Button></div></div></article>)}</div>}
    {editor?.type === "case-study" && <CaseStudyEditor project={editor.project} services={services} token={localStorage.getItem("base44_access_token")} onClose={() => setEditor(null)} onSaved={saved} />}
  </main>;
}
