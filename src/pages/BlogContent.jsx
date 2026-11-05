import RichTextField from "@/components/RichTextField";
import { uploadEditorImage } from "@/lib/editor-image";
import { useCallback, useEffect, useState } from "react";
import { ExternalLink, FileText, Loader2, Plus, RefreshCw, Save, Trash2, Upload, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { canAccessModule } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { siteContentMediaUrl } from "@/lib/site-content-media";
import { MAIN_API_URL } from "@/lib/mainApi";
import { formatPersianNumber as faNum } from "@/lib/number-format";


const API = `${MAIN_API_URL}/api/studio/site-content/blog`;
const SITE = MAIN_API_URL;
const UiButton = /** @type {any} */ (Button);

const persianToLatin = { ا: "a", آ: "a", ب: "b", پ: "p", ت: "t", ث: "s", ج: "j", چ: "ch", ح: "h", خ: "kh", د: "d", ذ: "z", ر: "r", ز: "z", ژ: "zh", س: "s", ش: "sh", ص: "s", ض: "z", ط: "t", ظ: "z", ع: "a", غ: "gh", ف: "f", ق: "gh", ک: "k", گ: "g", ل: "l", م: "m", ن: "n", و: "v", ه: "h", ی: "y", ء: "", ئ: "y", ؤ: "v", ي: "y", ك: "k" };
function slugify(value) {
  return value.toLowerCase().split("").map((char) => persianToLatin[char] ?? char).join("")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
}
function authHeaders() { return { Authorization: `Bearer ${localStorage.getItem("studio_access_token") || ""}`, Accept: "application/json" }; }
async function apiRequest(path = "", options = {}) {
  const response = await fetch(`${API}${path}`, { cache: "no-store", ...options, headers: { ...authHeaders(), ...options.headers } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const firstError = Object.values(result.errors || {}).flat()[0];
    throw new Error(firstError || result.message || (response.status === 401 ? "نشست Studio منقضی شده است؛ دوباره وارد شوید." : "ارتباط با بلاگ ناموفق بود."));
  }
  return result;
}
function blankPost() { return { blog_category_id: "", title: "", slug: "", excerpt: "", content: "", cover_image: "", cover_alt: "", meta_title: "", meta_description: "", is_featured: false, is_published: false, published_at: "", sort_order: 0 }; }
function toLocalInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function EditorField({ label, value, onChange, multiline = false, dir = "rtl", ...props }) {
  const classes = "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";
  return <label className="block space-y-1.5"><span className="text-sm font-medium">{label}</span>{multiline ? <textarea {...props} dir={dir} value={value ?? ""} onChange={(event) => onChange(event.target.value)} className={`${classes} min-h-24 resize-y`} /> : <input {...props} dir={dir} value={value ?? ""} onChange={(event) => onChange(event.target.value)} className={classes} />}</label>;
}

function ImageUpload({ value, onChange, token }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const upload = async (event) => {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    setBusy(true); setError("");
    try {
      const body = new FormData(); body.append("image", file);
      const response = await fetch(`${MAIN_API_URL}/api/studio/site-content/images`, { method: "POST", headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, body });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "آپلود تصویر انجام نشد.");
      onChange(result.path);
    } catch (uploadError) { setError(uploadError.message); }
    finally { setBusy(false); }
  };
  return <div className="space-y-2"><span className="text-sm font-medium">تصویر شاخص</span><div className="flex flex-wrap items-center gap-3">{value ? <img src={siteContentMediaUrl(value)} alt="پیش‌نمایش تصویر مقاله" className="h-24 w-40 rounded-xl border object-cover" /> : <div className="grid h-24 w-40 place-items-center rounded-xl border border-dashed text-xs text-muted-foreground">تصویری انتخاب نشده</div>}<label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm hover:bg-accent"><input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={upload} disabled={busy} />{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{busy ? "در حال آپلود" : "انتخاب تصویر"}</label>{value && <button type="button" onClick={() => onChange("")} className="text-sm text-destructive">حذف تصویر</button>}</div><p className="text-xs text-muted-foreground">برای انتشار مقاله تصویر شاخص لازم است؛ JPG، PNG یا WebP تا ۵ مگابایت.</p>{error && <p role="alert" className="text-xs text-destructive">{error}</p>}</div>;
}

function PostEditor({ post, categories, onClose, onSaved, token }) {
  const draftKey = `flowsee_blog_draft_${post?.id || "new"}`;
  const getInitialPostForm = () => {
    const base = { ...blankPost(), ...(post || {}), blog_category_id: post?.blog_category_id || "", published_at: toLocalInput(post?.published_at), sort_order: post?.sort_order ?? 0 };
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft && typeof draft === "object") return { ...base, ...draft };
      }
    } catch {}
    return base;
  };
  const [form, setForm] = useState(getInitialPostForm);
  const [slugEdited, setSlugEdited] = useState(Boolean(post)); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const setTitle = (title) => setForm((current) => ({ ...current, title, ...(!slugEdited ? { slug: slugify(title) } : {}) }));

  useEffect(() => {
    if (form.title?.trim() || form.content?.trim() || form.excerpt?.trim()) {
      try {
        localStorage.setItem(draftKey, JSON.stringify(form));
      } catch {}
    }
  }, [form, draftKey]);

  const handleClose = () => {
    if (form.title?.trim() || form.content?.trim()) {
      try {
        localStorage.setItem(draftKey, JSON.stringify(form));
      } catch {}
    }
    onClose();
  };

  const save = async (event) => {
    event.preventDefault(); setSaving(true); setError("");
    const payload = {
      ...form,
      blog_category_id: Number(form.blog_category_id),
      sort_order: Number(form.sort_order || 0),
      published_at: form.published_at ? new Date(form.published_at).toISOString() : null,
    };
    try {
      await apiRequest(post ? `/${post.id}` : "", { method: post ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      try {
        localStorage.removeItem(draftKey);
      } catch {}
      onSaved();
    } catch (saveError) { setError(saveError.message); }
    finally { setSaving(false); }
  };
  const fieldClass = "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";
  return <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) handleClose(); }}><section role="dialog" aria-modal="true" aria-label={post ? "ویرایش مقاله" : "مقالهٔ جدید"} className="flex max-h-[95vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl"><header className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4"><div><h2 className="text-lg font-bold">{post ? "ویرایش مقاله" : "نوشتن مقالهٔ جدید"}</h2><p className="mt-1 text-xs text-muted-foreground">پیش‌نویس به‌صورت خودکار در مرورگر نگهداری می‌شود.</p></div><button type="button" onClick={handleClose} aria-label="بستن" className="rounded-lg p-2 text-muted-foreground hover:bg-accent"><X className="h-5 w-5" /></button></header><form onSubmit={save} className="space-y-5 overflow-y-auto p-5">
    <div className="grid gap-4 sm:grid-cols-2"><EditorField label="عنوان مقاله" value={form.title} onChange={setTitle} required maxLength={255} /><EditorField label="نشانی کوتاه (Slug)" value={form.slug} dir="ltr" required maxLength={255} onChange={(value) => { setSlugEdited(true); set("slug", slugify(value)); }} /><label className="block space-y-1.5"><span className="text-sm font-medium">دسته‌بندی</span><select required value={form.blog_category_id} onChange={(event) => set("blog_category_id", event.target.value)} className={fieldClass}><option value="">انتخاب دسته‌بندی</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><EditorField label="تاریخ انتشار" value={form.published_at} onChange={(value) => set("published_at", value)} type="datetime-local" dir="ltr" /></div>
    <EditorField label="خلاصهٔ مقاله" value={form.excerpt} onChange={(value) => set("excerpt", value)} multiline maxLength={1000} placeholder="خلاصه‌ای که در کارت‌های بلاگ نمایش داده می‌شود" />
    <ImageUpload value={form.cover_image} onChange={(value) => set("cover_image", value)} token={token} />
    <EditorField label="متن جایگزین تصویر" value={form.cover_alt} onChange={(value) => set("cover_alt", value)} maxLength={255} />
    <RichTextField key={post?.id || "new-post"} value={form.content} onChange={(value) => set("content", value)} uploadImage={uploadEditorImage} />
    <div className="grid gap-4 sm:grid-cols-2"><EditorField label="اولویت نمایش در صفحه اصلی (ترتیب عددی، مثلاً ۱ برای اولین)" type="number" min="0" value={form.sort_order ?? 0} onChange={(value) => set("sort_order", Number(value))} /><EditorField label="عنوان سئو" value={form.meta_title} onChange={(value) => set("meta_title", value)} maxLength={255} /></div>
    <EditorField label="توضیحات سئو" value={form.meta_description} onChange={(value) => set("meta_description", value)} multiline maxLength={500} />
    <div className="grid gap-3 sm:grid-cols-2"><label className="flex items-center gap-2 rounded-xl border p-3 text-sm"><input type="checkbox" checked={!!form.is_featured} onChange={(event) => set("is_featured", event.target.checked)} />مقالهٔ پیشنهادی</label><label className="flex items-center gap-2 rounded-xl border p-3 text-sm"><input type="checkbox" checked={!!form.is_published} onChange={(event) => set("is_published", event.target.checked)} />انتشار در سایت</label></div>
    {error && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    <footer className="sticky bottom-0 -mx-5 mt-4 flex flex-wrap justify-start gap-3 border-t border-border bg-card px-5 py-4 sm:-mx-6 sm:px-6"><UiButton type="submit" disabled={saving}>{saving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}ذخیرهٔ مقاله</UiButton><UiButton type="button" variant="outline" onClick={handleClose}>انصراف</UiButton></footer>
  </form></section></div>;
}

export default function BlogContent() {
  const { user } = useAuth(); const { toast } = useToast();
  const [posts, setPosts] = useState([]); const [categories, setCategories] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [editor, setEditor] = useState(null); const [refresh, setRefresh] = useState(0);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await apiRequest();
      setPosts(result.posts || []);
      setCategories(result.categories || []);
    } catch (loadError) { setError(loadError.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (user && canAccessModule(user, "blog-content")) load(); }, [user, load, refresh]);
  const saved = () => { setEditor(null); setRefresh((value) => value + 1); toast({ title: "مقاله ذخیره شد" }); };
  const remove = async (post) => { if (!window.confirm(`مقالهٔ «${post.title}» حذف شود؟`)) return; try { await apiRequest(`/${post.id}`, { method: "DELETE" }); setRefresh((value) => value + 1); toast({ title: "مقاله حذف شد" }); } catch (deleteError) { toast({ title: "حذف انجام نشد", description: deleteError.message, variant: "destructive" }); } };

  const updateSortOrder = async (post, newOrder) => {
    try {
      await apiRequest(`/${post.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...post, sort_order: Number(newOrder) || 0 }),
      });
      setRefresh((value) => value + 1);
      toast({ title: "اولویت نمایش به‌روز شد" });
    } catch (err) {
      toast({ title: "خطا در تغییر اولویت", description: err.message, variant: "destructive" });
    }
  };

  const sortedPosts = [...posts].sort((a, b) => (Number(a.sort_order ?? 9999) - Number(b.sort_order ?? 9999)));

  if (!canAccessModule(user, "blog-content")) return <div dir="rtl" className="mx-auto flex min-h-80 max-w-3xl items-center justify-center rounded-2xl border bg-card p-8 text-center text-muted-foreground">شما دسترسی به مدیریت مقالات بلاگ را ندارید. برای دریافت دسترسی با مدیر سیستم تماس بگیرید.</div>;
  return <main dir="rtl" className="mx-auto max-w-7xl space-y-5"><header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">مقالات بلاگ</h1><p className="mt-1 text-sm text-muted-foreground">نوشتن، دسته‌بندی و انتشار مقاله‌ها در سایت Flowsee (اولویت ۱ زودتر از بقیه در سایت دیده می‌شود).</p></div><div className="flex gap-2"><UiButton variant="outline" onClick={() => setRefresh((value) => value + 1)} disabled={loading}><RefreshCw className={`ml-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />تازه‌سازی</UiButton><UiButton onClick={() => setEditor({ post: null })}><Plus className="ml-2 h-4 w-4" />مقالهٔ جدید</UiButton></div></header>
    <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border bg-card p-4"><span className="text-xs text-muted-foreground">همهٔ مقاله‌ها</span><p className="mt-1 text-2xl font-bold">{faNum(posts.length)}</p></div><div className="rounded-2xl border bg-card p-4"><span className="text-xs text-muted-foreground">منتشرشده</span><p className="mt-1 text-2xl font-bold text-emerald-600">{faNum(posts.filter((post) => post.is_published).length)}</p></div><div className="rounded-2xl border bg-card p-4"><span className="text-xs text-muted-foreground">پیش‌نویس</span><p className="mt-1 text-2xl font-bold text-amber-600">{faNum(posts.filter((post) => !post.is_published).length)}</p></div></div>
    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"><span>{error}</span><UiButton variant="outline" size="sm" onClick={() => setRefresh((value) => value + 1)}>تلاش دوباره</UiButton></div>}
    {loading ? <div className="flex min-h-56 items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />در حال دریافت مقاله‌ها…</div> : sortedPosts.length === 0 ? <div className="grid min-h-64 justify-items-center content-center gap-3 rounded-2xl border border-dashed p-10 text-center"><FileText className="h-8 w-8 text-muted-foreground" /><p className="font-medium">هنوز مقاله‌ای ثبت نشده است.</p><p className="text-sm text-muted-foreground">یک مقاله بنویسید تا در بلاگ و صفحهٔ اصلی سایت دیده شود.</p><UiButton onClick={() => setEditor({ post: null })}><Plus className="ml-2 h-4 w-4" />نوشتن مقاله</UiButton></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{sortedPosts.map((post) => <article key={post.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm flex flex-col justify-between"><div className="relative h-44 bg-accent">{post.cover_image ? <img src={siteContentMediaUrl(post.cover_image)} alt={post.cover_alt || post.title} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-muted-foreground"><FileText className="h-9 w-9" /></div>}<div className="absolute right-3 top-3 flex gap-1.5 flex-wrap"><span className={`rounded-full px-2.5 py-1 text-xs ${post.is_published ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{post.is_published ? "منتشرشده" : "پیش‌نویس"}</span>{post.sort_order !== undefined && post.sort_order !== null && (<span className="rounded-full bg-background/90 backdrop-blur-sm border px-2.5 py-1 text-xs font-semibold text-primary">اولویت {post.sort_order}</span>)}</div></div><div className="space-y-3 p-4 flex-1 flex flex-col justify-between"><div><h2 className="line-clamp-2 font-bold">{post.title}</h2><p className="mt-1 text-xs text-muted-foreground">{post.category?.name} <span dir="ltr">· /blog/{post.slug}</span></p>{post.excerpt && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{post.excerpt}</p>}</div><div><div className="flex items-center justify-between border-t border-border pt-3 mb-3"><div className="flex items-center gap-1.5 text-xs text-muted-foreground"><span>اولویت:</span><input type="number" min="0" defaultValue={post.sort_order ?? 0} onBlur={(e) => { const val = Number(e.target.value); if (val !== (post.sort_order ?? 0)) updateSortOrder(post, val); }} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} className="w-14 h-7 rounded-lg border border-input bg-background px-1.5 text-center text-xs font-bold text-primary focus:ring-1 focus:ring-primary outline-none" title="تغییر سریع اولویت نمایش در سایت اصلی (۱ یعنی اولین)" /></div>{post.is_published && <a className="inline-flex items-center gap-1 text-xs text-primary hover:underline" href={`${SITE}/blog/${post.slug}`} target="_blank" rel="noreferrer">مشاهده <ExternalLink className="h-3 w-3" /></a>}</div><div className="flex gap-2"><UiButton variant="outline" size="sm" onClick={() => setEditor({ post })}>ویرایش</UiButton><UiButton variant="ghost" size="sm" onClick={() => remove(post)} className="mr-auto text-destructive hover:bg-destructive/10" aria-label={`حذف ${post.title}`}><Trash2 className="h-4 w-4" /></UiButton></div></div></div></article>)}</div>}
    {editor && <PostEditor key={editor.post?.id || "new"} post={editor.post} categories={categories} token={localStorage.getItem("studio_access_token")} onClose={() => setEditor(null)} onSaved={saved} />}
  </main>;
}


