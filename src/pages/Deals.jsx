import { useEffect, useMemo, useState } from "react";
import { studio } from "@/api/studioClient";
import { useAuth } from "@/lib/AuthContext";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Plus, Trash2, Pencil, X, Tag, Clock, Eye } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import SelectControl from "@/components/ui/SelectControl";
import { toast } from "@/components/ui/use-toast";
import { formatPersianNumber as faNum } from "@/lib/number-format";

const stageLabels = {
  lead: "لید",
  discovery: "دیسکاوری",
  proposal: "پروپوزال",
  won: "بسته‌شده (ثبت شده)",
  lost: "بسته‌شده (رد شده)",
};
const stageColors = {
  lead: "bg-amber-100 text-amber-700",
  discovery: "bg-blue-100 text-blue-700",
  proposal: "bg-purple-100 text-purple-700",
  won: "bg-green-100 text-green-700",
  lost: "bg-red-100 text-red-700",
};
const priorityLabels = { low: "کم", medium: "متوسط", high: "زیاد" };
const priorityColors = { low: "bg-slate-100 text-slate-600", medium: "bg-amber-100 text-amber-700", high: "bg-red-100 text-red-700" };
const sourceLabels = { referral: "مراجعه", instagram: "اینستاگرام", website: "وب‌سایت", inbound: "ورودی", cold_outreach: "تلفنтия" };

const stages = [
  { id: "lead", label: stageLabels.lead },
  { id: "discovery", label: stageLabels.discovery },
  { id: "proposal", label: stageLabels.proposal },
  { id: "won", label: stageLabels.won },
  { id: "lost", label: stageLabels.lost },
];

const blankDeal = () => ({
  title: "",
  client_id: "",
  client_name: "",
  owner_id: "",
  owner_name: "",
  stage: "lead",
  value: 0,
  priority: "medium",
  close_date: "",
  source: "website",
  comments: "",
});

export default function Deals() {
  const { user, isAdmin } = useAuth();
  const userName = user?.full_name || user?.email || "";
  const [deals, setDeals] = useState([]);
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editDeal, setEditDeal] = useState(null);
  const [form, setForm] = useState(blankDeal);
  const [stageFilter, setStageFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [detailDeal, setDetailDeal] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [d, c, u] = await Promise.all([
        studio.entities.Deal.list("-created_date"),
        studio.entities.Client.list("-created_date"),
        studio.entities.User.list(),
      ]);
      setDeals(d);
      setClients(c);
      setUsers(u);
    } catch (err) {
      console.error("Failed to load deals:", err);
      setDeals([]);
      setClients([]);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filteredDeals = useMemo(() => {
    return deals.filter((d) => {
      if (stageFilter && d.stage !== stageFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      return (
        d.title.toLowerCase().includes(q) ||
        d.client_name.toLowerCase().includes(q) ||
        d.owner_name.toLowerCase().includes(q) ||
        (d.comments || "").toLowerCase().includes(q)
      );
    });
  }, [deals, stageFilter, searchQuery]);

  const columnDeals = useMemo(() => {
    const result = {};
    stages.forEach((s) => {
      result[s.id] = filteredDeals.filter((d) => d.stage === s.id);
    });
    return result;
  }, [filteredDeals]);

  const totalValue = (stageId) =>
    columnDeals[stageId]?.reduce((sum, d) => sum + Number(d.value || 0), 0) || 0;

  const handleSave = async () => {
    if (!form.title.trim()) return;
    try {
      const client = clients.find((c) => c.id === form.client_id);
      const owner = users.find((u) => u.id === form.owner_id);
      const data = {
        ...form,
        client_name: client?.name || form.client_name || "",
        owner_name: owner?.full_name || owner?.email || form.owner_name || "",
      };
      if (editDeal?.id) {
        await studio.entities.Deal.update(editDeal.id, data);
        toast({ title: "معامله بروزرسانی شد" });
      } else {
        await studio.entities.Deal.create({ ...data, created_by_id: user?.id });
        toast({ title: "معامله ثبت شد" });
      }
      setShowForm(false);
      setEditDeal(null);
      setForm(blankDeal());
      load();
    } catch (err) {
      console.error(err);
      toast({ title: "خطا در ذخیره معامله", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await studio.entities.Deal.delete(deleteTarget.id);
      setDeleteTarget(null);
      load();
      toast({ title: "معامله حذف شد" });
    } catch (err) {
      toast({ title: "حذف انجام نشد", description: err.message, variant: "destructive" });
    } finally {
      setDeleteTarget(null);
    }
  };

  const onDragEnd = async (result) => {
    if (!result.destination) return;
    const dealId = result.draggableId;
    const newStage = result.destination.droppableId;
    const deal = deals.find((d) => d.id === dealId);
    if (!deal) return;
    if (newStage === deal.stage) return;
    try {
      await studio.entities.Deal.update(dealId, { stage: newStage });
      load();
    } catch (err) {
      toast({ title: "تغییر مرحله انجام نشد", description: err.message, variant: "destructive" });
    }
  };

  const handleViewDetail = (deal) => setDetailDeal(deal);

  if (loading)
    return (
      <div className="flex justify-center p-20">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">معاملات — پایپ‌لاین فروش</h1>
          <p className="mt-1 text-sm text-muted-foreground">ردیابی لیدها تا تبدیل به قرارداد با نمای کانبان</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative">
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"><Tag className="w-4 h-4" /></div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی عنوان، مشتری، کارشناس..."
              className="border border-input rounded-xl pr-9 pl-3 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 w-[240px]"
            />
          </div>
          <SelectControl
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="border border-input rounded-xl px-3 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 sm:min-w-[160px]"
          >
            <option value="">تمام مراحل</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </SelectControl>
          <button
            onClick={() => { setEditDeal(null); setForm(blankDeal()); setShowForm(true); }}
            className="rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium inline-flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" /> معامله جدید
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {stages.map((s) => (
          <div key={s.id} className="rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <span className={`text-xs font-bold ${stageColors[s.stage || s.id]}`}>
                {faNum(columnDeals[s.id]?.length || 0)}
              </span>
            </div>
            <div className="text-2xl font-bold text-primary mt-1">
              {faNum(totalValue(s.id))} تومان
            </div>
          </div>
        ))}
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-5">
          {stages.map((col) => {
            const colDeals = columnDeals[col.id];
            return (
              <Droppable droppableId={col.id} key={col.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`w-full min-w-0 rounded-2xl p-3 min-h-[400px] flex flex-col ${
                      snapshot.isDraggingOver ? "bg-primary/5" : "bg-card border border-border"
                    }`}
                  >
                    <div className="mb-3 flex flex-col items-stretch gap-2 px-1">
                      <div className="flex items-center justify-between gap-2 px-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${stageColors[col.id]} text-xs font-bold`}>
                            {col.label}
                          </span>
                          <span className="text-xs text-muted-foreground">{faNum(colDeals.length)}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{faNum(totalValue(col.id))} تومان</div>
                      </div>
                    </div>
                    <div className="space-y-2 flex-1">
                      {colDeals.map((d, i) => (
                        <Draggable draggableId={d.id} index={i} key={d.id}>
                          {(prov) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              {...prov.dragHandleProps}
                              className={`relative bg-card border border-border rounded-xl p-2.5 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-primary/30 transition-all`}
                              onClick={() => handleViewDetail(d)}
                            >
                              <div className="flex items-start justify-between gap-1 mb-2">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setEditDeal(d); setShowForm(true); }}
                                  className="p-1 text-muted-foreground hover:bg-primary/10 hover:text-primary rounded-lg" title="ویرایش"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(d); }}
                                  className="p-1 text-muted-foreground hover:bg-red-50/10 hover:text-red-600 rounded-lg" title="حذف"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <p dir="rtl" title={d.title} className="font-medium text-right text-sm leading-snug flex-1 min-w-0 truncate">
                                {d.title}
                              </p>
                              <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                                {d.client_name && (
                                  <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full truncate max-w-[80px]">
                                    {d.client_name}
                                  </span>
                                )}
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${priorityColors[d.priority]}`}>
                                  {priorityLabels[d.priority]}
                                </span>
                                {d.value && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Tag className="w-3 h-3" /> {faNum(d.value)}
                                  </span>
                                )}
                                {d.close_date && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> {d.close_date}
                                  </span>
                                )}
                              </div>
                              <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">{d.owner_name || "بدون کارشناس"}</span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleViewDetail(d); }}
                                  className="p-1 text-muted-foreground hover:text-primary rounded-lg"
                                  title="مشاهده جزئیات"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {colDeals.length === 0 && <p className="text-center text-xs text-muted-foreground py-6">خالی</p>}
                    </div>
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </DragDropContext>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">{editDeal ? "ویرایش معامله" : "معامله جدید"}</h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-accent rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1.5">عنوان معامله <span className="text-primary">*</span></label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5">مشتری</label>
                  <SelectControl
                    value={form.client_id}
                    onChange={(e) => setForm({ ...form, client_id: e.target.value, client_name: clients.find((c) => c.id === e.target.value)?.name || "" })}
                    className="w-full border border-input rounded-xl px-3 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">بدون مشتری</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </SelectControl>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">کارشناس مسئول</label>
                  <SelectControl
                    value={form.owner_id}
                    onChange={(e) => setForm({ ...form, owner_id: e.target.value, owner_name: users.find((u) => u.id === e.target.value)?.full_name || users.find((u) => u.id === e.target.value)?.email || "" })}
                    className="w-full border border-input rounded-xl px-3 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">بدون تخصیص</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                    ))}
                  </SelectControl>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5">مرحلة قیف</label>
                  <select
                    value={form.stage}
                    onChange={(e) => setForm({ ...form, stage: e.target.value })}
                    className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>{s.label}</option>
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
                    {Object.entries(priorityLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5">ارزش معامله (تومان)</label>
                  <input
                    type="number"
                    value={form.value || 0}
                    onChange={(e) => setForm({ ...form, value: Number(e.target.value) || 0 })}
                    className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">تاریخ بسته‌بندی پیش‌بینی</label>
                  <input
                    type="date"
                    value={form.close_date}
                    onChange={(e) => setForm({ ...form, close_date: e.target.value })}
                    className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">کانال ورودی</label>
                  <select
                    value={form.source}
                    onChange={(e) => setForm({ ...form, source: e.target.value })}
                    className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {Object.entries(sourceLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <label className="text-sm font-medium block mb-1.5">یادداشت‌ها / فعالیت</label>
                  <textarea
                    value={form.comments}
                    onChange={(e) => setForm({ ...form, comments: e.target.value })}
                    rows={3}
                    className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
              <div className="pt-2 border-t border-border flex items-center justify-between">
                <button type="button" onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground px-3 py-2 text-sm rounded-lg">انصراف</button>
                <button type="submit" className="bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium rounded-lg hover:opacity-90 transition-opacity">ذخیره معامله</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailDeal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">جزئیات معامله</h2>
              <button onClick={() => setDetailDeal(null)} className="p-2 hover:bg-accent rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">عنوان</label>
                <p className="text-lg font-medium">{detailDeal.title}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">مشتری</label>
                  <p>{detailDeal.client_name || "—"}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">کارشناس مسئول</label>
                  <p>{detailDeal.owner_name || "—"}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">مرحلة</label>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${stageColors[detailDeal.stage]}`}>
                    {stageLabels[detailDeal.stage]}
                  </span>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">اولویت</label>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${priorityColors[detailDeal.priority]}`}>
                    {priorityLabels[detailDeal.priority]}
                  </span>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">ارزش</label>
                  <p className="font-mono">{faNum(detailDeal.value || 0)} تومان</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">تاریخ بسته‌بندی</label>
                  <p>{detailDeal.close_date || "—"}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">کانال</label>
                  <p>{sourceLabels[detailDeal.source] || detailDeal.source || "—"}</p>
                </div>
              </div>
              {detailDeal.comments && (
                <div>
                  <label className="text-sm font-medium block mb-1">یادداشت‌ها</label>
                  <p className="whitespace-pre-wrap text-muted-foreground">{detailDeal.comments}</p>
                </div>
              )}
              <div className="pt-4 border-t border-border flex items-center justify-between">
                <button
                  onClick={() => { setDetailDeal(null); setEditDeal(detailDeal); setShowForm(true); }}
                  className="text-primary hover:underline px-3 py-2 text-sm rounded-lg"
                >
                  <Pencil className="w-3.5 h-3.5 inline mr-1" /> ویرایش معامله
                </button>
                <button onClick={() => setDetailDeal(null)} className="text-muted-foreground hover:text-foreground px-3 py-2 text-sm rounded-lg">بستن</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="حذف معامله"
          description={`معامله «${deleteTarget.title}» حذف می‌شود. آیا مطمئن هستید؟`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          confirmText="بله، حذف شود"
        />
      )}
    </div>
  );
}
