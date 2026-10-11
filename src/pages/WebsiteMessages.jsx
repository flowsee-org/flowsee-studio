import { ExternalLink, Inbox } from "lucide-react";

export default function WebsiteMessages() {
  return (
    <section className="mx-auto flex h-full max-w-[1600px] flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Inbox className="h-6 w-6 text-primary" /> پیام‌های سایت فلوسی</h1>
          <p className="mt-1 text-sm text-muted-foreground">درخواست‌های ثبت‌شده در flowsee.ir، از همان پنل و پایگاه دادهٔ اصلی.</p>
        </div>
        <a href="https://flowsee.ir/admin" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-accent">
          <ExternalLink className="h-4 w-4" /> بازکردن در صفحهٔ جدا
        </a>
      </header>
      <div className="min-h-[70vh] flex-1 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <iframe
          title="پنل پیام‌ها و درخواست‌های وب‌سایت فلوسی"
          src="https://flowsee.ir/admin"
          referrerPolicy="same-origin"
          className="h-[75vh] min-h-[620px] w-full border-0 bg-white"
        />
      </div>
      <p className="text-xs text-muted-foreground">ورود پنل وب‌سایت مستقل است؛ اگر صفحهٔ ورود باز شد، با حساب مدیر flowsee.ir وارد شوید.</p>
    </section>
  );
}
