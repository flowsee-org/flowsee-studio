import { useEffect, useId, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { TableKit } from "@tiptap/extension-table";
import { Bold, Italic, Underline, Strikethrough, List, ListOrdered, Quote, Undo2, Redo2, Link, Unlink, ImagePlus, Table2, AlignRight, AlignCenter, AlignLeft, AlignJustify, FileText, Maximize2, Minimize2, Code2 } from "lucide-react";
import { uploadEditorFile } from "@/lib/editor-image";
import "./rich-text.css";

export default function RichTextField({ label = "متن مقاله", value = "", onChange, placeholder = "اینجا بنویسید…", uploadImage = null, uploadFile = uploadEditorFile }) {
  const id = useId();
  const change = useRef(onChange);
  change.current = onChange;
  const [expanded, setExpanded] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [url, setUrl] = useState("");
  const [alt, setAlt] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: { openOnClick: false, defaultProtocol: "https" } }),
      Image,
      TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["left", "center", "right", "justify"] }),
      Placeholder.configure({ placeholder }),
      TableKit.configure({ table: { resizable: false } }),
    ],
    content: value || "",
    editorProps: { attributes: { dir: "rtl", role: "textbox", "aria-multiline": "true", "aria-labelledby": id } },
    onUpdate: ({ editor: current }) => change.current(current.isEmpty ? "" : current.getHTML()),
  });
  useEditorState({ editor, selector: ({ editor: current }) => current ? { selection: current.state.selection.from, json: current.getJSON(), marks: current.state.storedMarks } : null });
  useEffect(() => {
    if (editor && value !== editor.getHTML() && !(editor.isEmpty && !value)) editor.commands.setContent(value || "", { emitUpdate: false });
  }, [editor, value]);
  useEffect(() => {
    if (!expanded) return;
    const key = (event) => { if (event.key === "Escape") setExpanded(false); };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [expanded]);
  if (!editor) return null;
  const tool = (title, Icon, action, active = false, disabled = false) => <button key={title} type="button" title={title} aria-label={title} aria-pressed={active} disabled={disabled} onClick={action}><Icon size={17} /></button>;
  const openInsert = (type) => { setDialog(type); setUrl(type === "link" ? editor.getAttributes("link").href || "" : ""); setAlt(""); setError(""); };
  const upload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true); setError('');
    try {
      if (dialog === "file") {
        if (!uploadFile) throw new Error("سرویس آپلود فایل فعال نیست.");
        const res = await uploadFile(file);
        setUrl(res.url);
        setAlt(res.name || file.name);
      } else {
        if (!uploadImage) throw new Error("سرویس آپلود تصویر فعال نیست.");
        setUrl(await uploadImage(file));
      }
    }
    catch (failure) { setError(failure.message || 'آپلود ناموفق بود.'); }
    finally { setUploading(false); }
  };
  const insert = () => {
    let parsed;
    try { parsed = new URL(url); } catch { setError("یک نشانی کامل با https وارد کنید."); return; }
    if (!["https:", "http:"].includes(parsed.protocol)) { setError("فقط نشانی http یا https مجاز است."); return; }
    if (dialog === "image") {
      editor.chain().focus().setImage({ src: parsed.href, alt }).run();
    } else if (dialog === "file") {
      const labelText = alt.trim() || "دانلود فایل پیوست (PDF)";
      editor.chain().focus().insertContent(`<p><a href="${parsed.href}" target="_blank" rel="noopener noreferrer" class="flowsee-pdf-link">📄 ${labelText}</a></p>`).run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: parsed.href }).run();
    }
    setDialog(null);
  };
  return <div className={`dig-ui flowsee-editor ${expanded ? "flowsee-editor-expanded" : ""}`}>
    <div className="flowsee-editor-heading"><span id={id}>{label}</span><span>Tiptap</span></div>
    <div className="flowsee-editor-tools" role="toolbar" aria-label="قالب‌بندی متن">
      <select aria-label="نوع متن" value={editor.isActive("heading") ? editor.getAttributes("heading").level : "p"} onChange={(event) => event.target.value === "p" ? editor.chain().focus().setParagraph().run() : editor.chain().focus().toggleHeading({ level: /** @type {2 | 3 | 4} */ (Number(event.target.value)) }).run()}><option value="p">پاراگراف</option><option value="2">عنوان ۲</option><option value="3">عنوان ۳</option><option value="4">عنوان ۴</option></select>
      {tool("پررنگ", Bold, () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"))}
      {tool("مورب", Italic, () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"))}
      {tool("زیرخط", Underline, () => editor.chain().focus().toggleUnderline().run(), editor.isActive("underline"))}
      {tool("خط‌خورده", Strikethrough, () => editor.chain().focus().toggleStrike().run(), editor.isActive("strike"))}
      {tool("فهرست", List, () => editor.chain().focus().toggleBulletList().run(), editor.isActive("bulletList"))}
      {tool("فهرست شماره‌دار", ListOrdered, () => editor.chain().focus().toggleOrderedList().run(), editor.isActive("orderedList"))}
      {tool("نقل‌قول", Quote, () => editor.chain().focus().toggleBlockquote().run(), editor.isActive("blockquote"))}
      {tool("راست‌چین", AlignRight, () => editor.chain().focus().setTextAlign("right").run(), editor.isActive({ textAlign: "right" }))}
      {tool("وسط‌چین", AlignCenter, () => editor.chain().focus().setTextAlign("center").run(), editor.isActive({ textAlign: "center" }))}
      {tool("چپ‌چین", AlignLeft, () => editor.chain().focus().setTextAlign("left").run(), editor.isActive({ textAlign: "left" }))}
      {tool("تراز کامل (Justify)", AlignJustify, () => editor.chain().focus().setTextAlign("justify").run(), editor.isActive({ textAlign: "justify" }))}
      {tool("افزودن لینک", Link, () => openInsert("link"), editor.isActive("link"))}
      {tool("حذف لینک", Unlink, () => editor.chain().focus().unsetLink().run(), false, !editor.isActive("link"))}
      {tool("افزودن تصویر", ImagePlus, () => openInsert("image"))}
      {tool("افزودن فایل / PDF", FileText, () => openInsert("file"))}
      {tool("افزودن جدول", Table2, () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}
      {tool("بلوک کد", Code2, () => editor.chain().focus().toggleCodeBlock().run(), editor.isActive("codeBlock"))}
      {tool("بازگردانی", Undo2, () => editor.chain().focus().undo().run(), false, !editor.can().undo())}
      {tool("انجام دوباره", Redo2, () => editor.chain().focus().redo().run(), false, !editor.can().redo())}
      {tool(expanded ? "خروج از تمام‌صفحه" : "تمام‌صفحه", expanded ? Minimize2 : Maximize2, () => setExpanded(!expanded), expanded)}
    </div>
    {editor.isActive("table") && <div className="flowsee-editor-tools"><button type="button" onClick={() => editor.chain().focus().addRowAfter().run()}>افزودن ردیف</button><button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()}>افزودن ستون</button><button type="button" onClick={() => editor.chain().focus().deleteRow().run()}>حذف ردیف</button><button type="button" onClick={() => editor.chain().focus().deleteColumn().run()}>حذف ستون</button><button type="button" onClick={() => editor.chain().focus().deleteTable().run()}>حذف جدول</button></div>}
    {dialog && <div className="flowsee-editor-insert" role="group" aria-label={dialog === "image" ? "درج تصویر" : dialog === "file" ? "درج فایل / PDF" : "درج لینک"}><input autoFocus aria-label="نشانی" dir="ltr" type="url" placeholder="https://" value={url} onChange={(event) => setUrl(event.target.value)} />{(dialog === "image" || dialog === "file") && <input aria-label={dialog === "file" ? "عنوان فایل / متن دکمه" : "متن جایگزین تصویر"} placeholder={dialog === "file" ? "نام یا عنوان فایل PDF" : "توضیح تصویر برای سئو و دسترس‌پذیری"} value={alt} onChange={(event) => setAlt(event.target.value)} />}<button type="button" onClick={insert}>درج</button><button type="button" onClick={() => setDialog(null)}>انصراف</button>{error && <p role="alert">{error}</p>}</div>}
    {dialog === 'image' && uploadImage && <div className="flowsee-editor-insert"><label>آپلود تصویر از دستگاه<input aria-label="آپلود تصویر از دستگاه" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={upload} /></label><span role="status">{uploading ? 'در حال آپلود؛ بعد از پایان، درج را بزنید…' : 'JPG، PNG یا WebP، حداکثر ۵ مگابایت'}</span></div>}
    {dialog === 'file' && uploadFile && <div className="flowsee-editor-insert"><label>آپلود فایل یا PDF از دستگاه<input aria-label="آپلود فایل یا PDF از دستگاه" type="file" accept=".pdf,application/pdf,image/jpeg,image/png,image/webp" disabled={uploading} onChange={upload} /></label><span role="status">{uploading ? 'در حال آپلود فایل؛ بعد از پایان، درج را بزنید…' : 'فایل PDF، JPG یا PNG تا ۲۰ مگابایت'}</span></div>}
    <EditorContent editor={editor} />
    <div className="flowsee-editor-status">{editor.getText().trim().split(/\s+/).filter(Boolean).length.toLocaleString("fa-IR")} واژه · ذخیره با دکمهٔ ذخیره</div>
  </div>;
}
