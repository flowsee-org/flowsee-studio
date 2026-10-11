import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, Inbox, Loader2, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const TOKEN_KEY = "flowsee.websiteMessagesToken";
const API_URL = "https://flowsee.ir/api/studio/website-messages";

function getInitialToken() {
  try {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const incomingToken = params.get("leadToken");
    if (incomingToken) {
      sessionStorage.setItem(TOKEN_KEY, incomingToken);
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      return incomingToken;
    }
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

const statusStyles = {
  new: "bg-sky-50 text-sky-700 ring-sky-200",
  contacted: "bg-amber-50 text-amber-700 ring-amber-200",
  negotiating: "bg-violet-50 text-violet-700 ring-violet-200",
  archived: "bg-slate-100 text-slate-600 ring-slate-200",
};

export default function WebsiteMessages() {
  const [token, setToken] = useState(getInitialToken);
  const [messages, setMessages] = useState([]);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [counts, setCounts] = useState({});
  const [statuses, setStatuses] = useState({});
  const [services, setServices] = useState({});
  const [status, setStatus] = useState("new");
  const [service, setService] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (!token) return undefined;
    const controller = new AbortController();
    const loadMessages = async () => {
      setIsLoading(true);
      setError("");
      const query = new URLSearchParams({ page: String(page), per_page: "20" });
      if (status) query.set("status", status);
      if (service) query.set("service", service);
      if (debouncedSearch) query.set("search", debouncedSearch);
      try {
        const response = await fetch(API_URL + "?" + query.toString(), {
          headers: { Authorization: "Bearer " + token, Accept: "application/json" },
          signal: controller.signal,
        });
        if (response.status === 401) {
          sessionStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setError("اتصال امن منقضی شده است. دوباره به پنل پیام‌های سایت وصل شوید.");
          return;
        }
        if (response.status === 403) {
          sessionStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setError("این حساب در پنل flowsee.ir دسترسی مدیر ندارد.");
          return;
        }
        if (!response.ok) throw new Error("دریافت پیام‌ها ناموفق بود. دوباره تلاش کنید.");
        const result = await response.json();
        setMessages(result.data || []);
        setMeta(result.meta || { current_page: 1, last_page: 1, total: 0 });
        setCounts(result.counts || {});
        setStatuses(result.statuses || {});
        setServices(result.services || {});
      } catch (requestError) {
        if (requestError.name !== "AbortError") setError(requestError.message || "ارتباط با سرور برقرار نشد.");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    loadMessages();
    return () => controller.abort();
  }, [token, status, service, debouncedSearch, page, refreshKey]);

  const countCards = useMemo(() => Object.entries(statuses), [statuses]);
  const reconnect = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    window.location.assign("https://flowsee.ir/admin/studio-messages-connect");
  };

  return (
    <section className="mx-auto flex min-h-full max-w-[1600px] flex-col gap-5" dir="rtl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Inbox className="h-6 w-6 text-primary" /> پیام‌های سایت فلوسی</h1>
          <p className="mt-1 text-sm text-muted-foreground">درخواست‌های flowsee.ir را همین‌جا ببین و جست‌وجو کن.</p>
        </div>
        {token && <Button variant="outline" onClick={() => setRefreshKey((value) => value + 1)} disabled={isLoading}><RefreshCw className={"h-4 w-4 " + (isLoading ? "animate-spin" : "")} /> تازه‌سازی</Button>}
      </header>

      {!token ? (
        <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="rounded-full bg-primary/10 p-4 text-primary"><Inbox className="h-8 w-8" /></div>
          <div><h2 className="text-lg font-semibold">اتصال امن به پیام‌های سایت</h2><p className="mt-1 max-w-lg text-sm text-muted-foreground">برای دیدن درخواست‌ها با حساب مدیر flowsee.ir تأیید هویت کن. دسترسی این اتصال فقط برای خواندن پیام‌هاست.</p></div>
          <Button onClick={reconnect}>ورود و نمایش پیام‌ها <ArrowLeft className="h-4 w-4" /></Button>
          {error && <p className="max-w-xl text-sm text-destructive" role="alert">{error}</p>}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{countCards.map(([key, label]) => <button key={key} type="button" onClick={() => { setStatus(key); setPage(1); }} className={"rounded-xl border bg-card p-4 text-right shadow-sm transition hover:border-primary/40 " + (status === key ? "border-primary ring-1 ring-primary/20" : "border-border")}><span className="text-sm text-muted-foreground">{label}</span><span className="mt-1 block text-2xl font-bold tabular-nums">{Number(counts[key] || 0).toLocaleString("fa-IR")}</span></button>)}</div>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="relative min-w-[220px] flex-1"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="جست‌وجو در نام، تماس یا توضیحات" className="pr-9" aria-label="جست‌وجوی پیام‌ها" /></div>
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="h-9 min-w-[150px] rounded-md border border-input bg-background px-3 text-sm" aria-label="فیلتر وضعیت"><option value="">همهٔ وضعیت‌ها</option>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
            <select value={service} onChange={(event) => { setService(event.target.value); setPage(1); }} className="h-9 min-w-[180px] rounded-md border border-input bg-background px-3 text-sm" aria-label="فیلتر خدمت"><option value="">همهٔ خدمات</option>{Object.entries(services).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
          </div>
          {error && <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert"><span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />{error}</span><Button variant="outline" size="sm" onClick={reconnect}>اتصال دوباره</Button></div>}
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            {isLoading ? <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> در حال دریافت پیام‌ها…</div> : messages.length === 0 ? <div className="flex min-h-48 flex-col items-center justify-center gap-2 p-8 text-center"><Inbox className="h-8 w-8 text-muted-foreground/60" /><p className="font-medium">پیامی با این فیلتر پیدا نشد</p><p className="text-sm text-muted-foreground">فیلتر وضعیت یا عبارت جست‌وجو را تغییر بده.</p></div> : <><div className="overflow-x-auto"><table className="w-full min-w-[800px] text-sm"><thead className="bg-muted/50 text-right text-muted-foreground"><tr><th className="px-4 py-3 font-medium">نام و راه تماس</th><th className="px-4 py-3 font-medium">خدمت</th><th className="px-4 py-3 font-medium">خلاصهٔ درخواست</th><th className="px-4 py-3 font-medium">وضعیت</th><th className="px-4 py-3 font-medium">تاریخ ثبت</th><th className="px-4 py-3 font-medium">جزئیات</th></tr></thead><tbody className="divide-y divide-border">{messages.map((message) => <tr key={message.id} className="align-top hover:bg-muted/20"><td className="px-4 py-3"><div className="font-medium">{message.name}</div><a href={"tel:" + message.phone} dir="ltr" className="mt-1 inline-block text-muted-foreground hover:text-primary">{message.phone}</a>{message.email && <a href={"mailto:" + message.email} dir="ltr" className="block text-xs text-muted-foreground hover:text-primary">{message.email}</a>}</td><td className="px-4 py-3">{services[message.service] || message.service}</td><td className="max-w-[320px] px-4 py-3 text-muted-foreground"><p className="line-clamp-2 whitespace-pre-line">{message.details}</p></td><td className="px-4 py-3"><span className={"inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset " + (statusStyles[message.status] || statusStyles.new)}>{statuses[message.status] || message.status}</span></td><td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(message.created_at)}</td><td className="px-4 py-3"><Button variant="outline" size="sm" onClick={() => setSelectedMessage(message)}>مشاهده</Button></td></tr>)}</tbody></table></div><footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground"><span>{Number(meta.total || 0).toLocaleString("fa-IR")} پیام · صفحهٔ {Number(meta.current_page || 1).toLocaleString("fa-IR")} از {Number(meta.last_page || 1).toLocaleString("fa-IR")}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1 || isLoading} onClick={() => setPage((value) => Math.max(1, value - 1))}>قبلی</Button><Button variant="outline" size="sm" disabled={page >= meta.last_page || isLoading} onClick={() => setPage((value) => value + 1)}>بعدی</Button></div></footer></>}
          </div>
        </>
      )}
      <Dialog open={Boolean(selectedMessage)} onOpenChange={(open) => { if (!open) setSelectedMessage(null); }}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl" dir="rtl">{selectedMessage && <><DialogHeader className="text-right"><DialogTitle>{selectedMessage.name}</DialogTitle><DialogDescription>{services[selectedMessage.service] || selectedMessage.service} · {formatDate(selectedMessage.created_at)}</DialogDescription></DialogHeader><div className="space-y-4 text-sm"><div className="flex flex-wrap gap-x-5 gap-y-2"><a href={"tel:" + selectedMessage.phone} dir="ltr" className="text-primary hover:underline">{selectedMessage.phone}</a>{selectedMessage.email && <a href={"mailto:" + selectedMessage.email} dir="ltr" className="text-primary hover:underline">{selectedMessage.email}</a>}</div><div className="rounded-xl bg-muted/40 p-4 leading-7 whitespace-pre-wrap">{selectedMessage.details}</div><div><span className="text-muted-foreground">وضعیت پیگیری: </span>{statuses[selectedMessage.status] || selectedMessage.status}</div></div></>}</DialogContent></Dialog>
    </section>
  );
}
