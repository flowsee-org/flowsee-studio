import { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Plus, Trash2, Pencil, ArrowDownUp, LayoutTemplate, Filter, X, Send, CheckCircle, Clock, Search, Archive, Eye, RotateCcw } from "lucide-react";
import TaskForm from "@/components/TaskForm";
import TemplatePicker from "@/components/TemplatePicker";
import TaskRequestModal from "@/components/TaskRequestModal";
import TaskDetail from "@/components/TaskDetail";
import PersianDatePicker from "@/components/PersianDatePicker";
import ConfirmDialog from "@/components/ConfirmDialog";
import { toast } from "@/components/ui/use-toast";

const columns = [
  { id: "todo", title: "در انتظار", color: "bg-slate-100" },
  { id: "in_progress", title: "در حال انجام", color: "bg-blue-100" },
  { id: "done", title: "انجام شده", color: "bg-green-100" },
];

const priorityLabels = { low: "کم", medium: "متوسط", high: "زیاد" };
const priorityColors = { low: "bg-slate-100 text-slate-600", medium: "bg-amber-100 text-amber-700", high: "bg-red-100 text-red-700" };
const priorityOrder = { high: 3, medium: 2, low: 1 };

const sortOptions = [
  { id: "created_desc", label: "جدیدترین" },
  { id: "created_asc", label: "قدیمی‌ترین" },
  { id: "priority", label: "اولویت" },
  { id: "deadline", label: "ددلاین" },
];

const viewModes = [
  { id: "assigned", label: "اختصاص داده شده به من" },
  { id: "created", label: "ساخته شده توسط من" },
  { id: "all", label: "همه تسک‌ها", adminOnly: true },
];

function sortTasks(tasks, sortBy) {
  const sorted = [...tasks];
  switch (sortBy) {
    case "created_desc":
      return sorted.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    case "created_asc":
      return sorted.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    case "priority":
      return sorted.sort((a, b) => (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0));
    case "deadline":
      return sorted.sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999"));
    default:
      return sorted;
  }
}

function AssigneeAvatars({ task }) {
  const assignees = task.assignees || (task.assignee ? [task.assignee] : []);
  if (assignees.length === 0) return null;
  return (
    <div className="flex items-center gap-0.5">
      {assignees.slice(0, 3).map((name, i) => (
        <div
          key={i}
          className="w-6 h-6 rounded-full bg-primary/10 border border-card flex items-center justify-center text-[10px] font-bold text-primary -mr-1.5 first:mr-0"
          title={name}
        >
          {name.charAt(0).toUpperCase()}
        </div>
      ))}
      {assignees.length > 3 && (
        <span className="text-[10px] text-muted-foreground mr-1">+{assignees.length - 3}</span>
      )}
    </div>
  );
}

export default function Tasks() {
  const { user, isAdmin } = useAuth();
  const userName = user?.full_name || user?.email || "";
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [sortBy, setSortBy] = useState("created_desc");
  const [showTemplates, setShowTemplates] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [projectFilter, setProjectFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [creatorNames] = useState({});
  const [viewMode, setViewMode] = useState("assigned");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState(new Set());
  const [detailTask, setDetailTask] = useState(null);

  // ConfirmDialog states
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const [t, p] = await Promise.all([
      base44.entities.Task.list("-created_date"),
      base44.entities.Project.list(),
    ]);
    setTasks(t);
    setProjects(p);
    setLoading(false);
  };

  // Base visible tasks based on role
  const baseVisibleTasks = isAdmin
    ? tasks
    : tasks.filter((t) => {
        const assignees = t.assignees || (t.assignee ? [t.assignee] : []);
        return assignees.includes(userName) || t.created_by_id === user?.id;
      });

  // Apply view mode filter
  const viewFilteredTasks = useMemo(() => {
    return baseVisibleTasks.filter((t) => {
      const assignees = t.assignees || (t.assignee ? [t.assignee] : []);
      if (viewMode === "assigned") return assignees.includes(userName);
      if (viewMode === "created") return t.created_by_id === user?.id;
      return true; // "all"
    });
  }, [baseVisibleTasks, viewMode, userName, user?.id]);

  // Apply archived filter
  const archivedFilteredTasks = useMemo(() => {
    return showArchived
      ? viewFilteredTasks.filter(t => t.archived)
      : viewFilteredTasks.filter(t => !t.archived);
  }, [viewFilteredTasks, showArchived]);

  // Apply search filter
  const searchFilteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return archivedFilteredTasks;
    const query = searchQuery.trim().toLowerCase();
    return archivedFilteredTasks.filter((t) =>
      t.title.toLowerCase().includes(query) ||
      (t.description || "").toLowerCase().includes(query) ||
      (t.task_number || "").toLowerCase().includes(query)
    );
  }, [archivedFilteredTasks, searchQuery]);

  // Apply other filters
  const filteredTasks = useMemo(() => {
    return searchFilteredTasks.filter((t) => {
      if (projectFilter && t.project_id !== projectFilter) return false;
      if (employeeFilter) {
        const assignees = t.assignees || (t.assignee ? [t.assignee] : []);
        if (!assignees.includes(employeeFilter)) return false;
      }
      if (dateFrom && t.due_date && t.due_date < dateFrom) return false;
      if (dateTo && t.due_date && t.due_date > dateTo) return false;
      return true;
    });
  }, [searchFilteredTasks, projectFilter, employeeFilter, dateFrom, dateTo]);

  const hasTaskFilters = Boolean(projectFilter || employeeFilter || dateFrom || dateTo || searchQuery);
  const clearTaskFilters = () => {
    setProjectFilter("");
    setEmployeeFilter("");
    setDateFrom("");
    setDateTo("");
    setSearchQuery("");
  };

  // Incoming task requests
  const incomingRequests = useMemo(() => {
    return tasks.filter((t) =>
      t.kind === "request" &&
      t.requestee === userName &&
      t.request_status === "pending"
    );
  }, [tasks, userName]);

  const handleAcceptRequest = async (request) => {
    await base44.entities.Task.update(request.id, {
      request_status: "accepted",
      kind: "task",
      status: "todo",
    });
    load();
  };

  const handleRejectRequest = async (request) => {
    await base44.entities.Task.update(request.id, {
      request_status: "rejected",
    });
    load();
  };

  const handleDelayRequest = async (request) => {
    await base44.entities.Task.update(request.id, {
      request_status: "delayed",
    });
    load();
  };

  const onDragEnd = async (result) => {
    if (!result.destination) return;
    const taskId = result.draggableId;
    const newStatus = result.destination.droppableId;
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
    await base44.entities.Task.update(taskId, { status: newStatus });
  };

  const handleDelete = async (id) => {
    await base44.entities.Task.delete(id);
    setSelectedTasks(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    load();
  };

  const handleBulkDelete = async () => {
    for (const id of selectedTasks) {
      await base44.entities.Task.delete(id);
    }
    setSelectedTasks(new Set());
    load();
    toast({ title: `${selectedTasks.size} تسک حذف شد` });
  };

  const handleBulkArchive = async () => {
    for (const id of selectedTasks) {
      await base44.entities.Task.update(id, { archived: true });
    }
    setSelectedTasks(new Set());
    load();
    toast({ title: `${selectedTasks.size} تسک بایگانی شد` });
  };

  const handleBulkStatusChange = async (status) => {
    for (const id of selectedTasks) {
      await base44.entities.Task.update(id, { status });
    }
    setSelectedTasks(new Set());
    load();
    toast({ title: `${selectedTasks.size} تسک بروزرسانی شد` });
  };

  const handleBulkAssign = async (assignee) => {
    for (const id of selectedTasks) {
      await base44.entities.Task.update(id, { assignees: [assignee], assignee });
    }
    setSelectedTasks(new Set());
    load();
    toast({ title: `${selectedTasks.size} تسک به ${assignee} اختصاص یافت` });
  };

  const handleEdit = (task) => {
    setEditTask(task);
    setShowForm(true);
  };

  const handleViewDetail = (task) => {
    setDetailTask(task);
  };

  const useTemplate = (template) => {
    const checklistText = (template.checklist || []).length > 0
      ? (template.description ? template.description + "\n\n" : "") + "📋 چک‌لیست:\n" + template.checklist.map((item) => `☐ ${item}`).join("\n")
      : template.description || "";
    setEditTask({
      title: template.title,
      description: checklistText,
      project_id: template.project_id || "",
      project_name: template.project_name || "",
      priority: template.priority || "medium",
      assignees: template.default_assignees || [userName],
      assignee: template.default_assignees?.[0] || userName,
      status: "todo",
      due_date: "",
    });
    setShowTemplates(false);
    setShowForm(true);
  };

  const toggleSelect = (id) => {
    setSelectedTasks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Sort tasks within each column
  const columnTasks = useMemo(() => {
    const result = {};
    columns.forEach(col => {
      result[col.id] = sortTasks(filteredTasks.filter(t => t.status === col.id), sortBy);
    });
    return result;
  }, [filteredTasks, sortBy]);

  if (loading)
    return (
      <div className="flex justify-center p-20">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{isAdmin ? "تسک‌ها" : "تسک‌های من"}</h1>
          <p className="text-muted-foreground mt-1 text-sm">مدیریت تسک‌ها به‌سبک ترلو</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی عنوان، توضیحات، شماره..."
              className="border border-input rounded-xl pr-9 pl-3 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none w-[220px]"
            />
          </div>
          <div className="relative">
            <ArrowDownUp className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border border-input rounded-xl pr-9 pl-3 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none"
            >
              {sortOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
          {/* View Mode Tabs */}
          <div className="flex border border-border rounded-xl bg-card p-1">
            {viewModes.filter(v => !v.adminOnly || isAdmin).map((v) => (
              <button
                key={v.id}
                onClick={() => setViewMode(v.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === v.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowRequestModal(true)}
            className="border border-purple-300 text-purple-600 px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:bg-purple-50 transition-colors text-sm whitespace-nowrap"
          >
            <Send className="w-5 h-5" /> درخواست تسک
          </button>
          <button
            onClick={() => setShowTemplates(true)}
            className="border border-primary/30 text-primary px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:bg-primary/5 transition-colors text-sm whitespace-nowrap"
          >
            <LayoutTemplate className="w-5 h-5" /> قالب‌ها
          </button>
          <button
            onClick={() => { setEditTask(null); setShowForm(true); }}
            className="bg-primary text-primary-foreground px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:opacity-90 transition-opacity text-sm whitespace-nowrap"
          >
            <Plus className="w-5 h-5" /> تسک جدید
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-20">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 bg-card border border-border rounded-xl p-3 sm:p-4">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground font-medium">
              <Filter className="w-4 h-4" /> فیلترها:
            </span>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="border border-input rounded-xl px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[180px]"
            >
              <option value="">همه پروژه‌ها</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {isAdmin && (
              <select
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
                className="border border-input rounded-xl px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[180px]"
              >
                <option value="">همه کارمندان</option>
                {Array.from(new Set(baseVisibleTasks.flatMap(t => t.assignees || (t.assignee ? [t.assignee] : [])))).map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            )}
            <PersianDatePicker label="از تاریخ" value={dateFrom} onChange={setDateFrom} placeholder="از ددلاین" />
            <PersianDatePicker label="تا تاریخ" value={dateTo} onChange={setDateTo} placeholder="تا ددلاین" />
            <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              بایگانی‌ها
            </label>
            {hasTaskFilters && (
              <button
                onClick={clearTaskFilters}
                className="text-xs text-primary hover:underline flex items-center gap-1 ml-auto"
              >
                <X className="w-3.5 h-3.5" /> پاک کردن فیلترها
              </button>
            )}
          </div>

          {/* Incoming task requests */}
          {incomingRequests.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Send className="w-4 h-4 text-amber-700" />
                  </div>
                  <h3 className="font-bold text-amber-800">درخواست‌های تسک دریافتی ({incomingRequests.length})</h3>
                </div>
              </div>
              <div className="space-y-2">
                {incomingRequests.map((req) => (
                  <div key={req.id} className="bg-card border border-border rounded-lg p-3">
                    <p className="font-medium text-sm">{req.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                      {req.project_name && <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full">{req.project_name}</span>}
                      {req.due_date && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {req.due_date}</span>}
                      <span className="flex items-center gap-1">از طرف: {req.created_by_id && creatorNames ? creatorNames[req.created_by_id] || "همکار" : "همکار"}</span>
                    </div>
                    {req.requestee_note && (
                      <p className="text-sm text-muted-foreground mt-1.5 italic">پیام: {req.requestee_note}</p>
                    )}
                    <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border">
                      <button
                        onClick={() => handleAcceptRequest(req)}
                        className="flex-1 bg-green-500 text-white py-1.5 rounded-lg text-xs font-medium hover:bg-green-600"
                      >
                        <CheckCircle className="w-3.5 h-3.5 inline -mt-0.5 ml-1" /> قبول
                      </button>
                      <button
                        onClick={() => handleDelayRequest(req)}
                        className="flex-1 bg-amber-500 text-white py-1.5 rounded-lg text-xs font-medium hover:bg-amber-600"
                      >
                        <Clock className="w-3.5 h-3.5 inline -mt-0.5 ml-1" /> تعویق
                      </button>
                      <button
                        onClick={() => handleRejectRequest(req)}
                        className="flex-1 bg-red-500 text-white py-1.5 rounded-lg text-xs font-medium hover:bg-red-600"
                      >
                        <X className="w-3.5 h-3.5 inline -mt-0.5 ml-1" /> رد
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bulk Action Bar */}
          {selectedTasks.size > 0 && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
              <span className="font-medium text-primary">{selectedTasks.size} تسک انتخاب شده</span>
              <div className="flex flex-wrap gap-2">
                <select
                  onChange={(e) => { handleBulkStatusChange(e.target.value); e.target.value = ""; }}
                  className="border border-input rounded-xl px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">تغییر وضعیت به...</option>
                  <option value="todo">در انتظار</option>
                  <option value="in_progress">در حال انجام</option>
                  <option value="done">انجام شده</option>
                </select>
                <select
                  onChange={(e) => { handleBulkAssign(e.target.value); e.target.value = ""; }}
                  className="border border-input rounded-xl px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[150px]"
                >
                  <option value="">اختصاص به...</option>
                  {Array.from(new Set(baseVisibleTasks.flatMap(t => t.assignees || (t.assignee ? [t.assignee] : [])))).map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <button
                  onClick={handleBulkArchive}
                  className="bg-amber-500 text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-amber-600 flex items-center gap-1"
                >
                  <Archive className="w-3.5 h-3.5" /> بایگانی
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="bg-red-500 text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-red-600 flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> حذف
                </button>
                <button
                  onClick={() => setSelectedTasks(new Set())}
                  className="text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg text-xs flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" /> لغو
                </button>
              </div>
            </div>
          )}

          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-thin">
              {columns.map((col) => {
                const colTasks = columnTasks[col.id];
                return (
                <Droppable droppableId={col.id} key={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`snap-start flex-shrink-0 w-64 max-w-[82vw] rounded-2xl p-3 min-h-[600px] flex flex-col ${
                        snapshot.isDraggingOver ? "bg-primary/5" : "bg-card border border-border"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3 px-1">
                        <h3 className="font-bold text-sm">{col.title}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${col.color}`}>{colTasks.length}</span>
                      </div>
                      <div className="space-y-2 flex-1">
                        {colTasks.map((t, i) => (
                          <Draggable draggableId={t.id} index={i} key={t.id}>
                            {(prov) => (
                              <div
                                ref={prov.innerRef}
                                {...prov.draggableProps}
                                {...prov.dragHandleProps}
                                className={`bg-card border border-border rounded-xl p-2.5 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${
                                  selectedTasks.has(t.id) ? "ring-2 ring-primary ring-offset-2" : ""
                                }`}
                                onClick={(e) => {
                                  if (!e.target.closest('button') && !selectedTasks.has(t.id)) {
                                    handleViewDetail(t);
                                  }
                                }}
                              >
                                {/* Selection checkbox */}
                                <div className="flex items-start justify-between gap-1 mb-2">
                                  <input
                                    type="checkbox"
                                    checked={selectedTasks.has(t.id)}
                                    onChange={() => toggleSelect(t.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-4 h-4 accent-primary mt-0.5 shrink-0"
                                  />
                                  <div className="flex gap-0.5 shrink-0">
                                    <button onClick={(e) => { e.stopPropagation(); handleEdit(t); }} className="p-1 text-muted-foreground hover:text-primary rounded" title="ویرایش">
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(t); }} className="p-1 text-muted-foreground hover:text-red-500 rounded" title="حذف">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); handleViewDetail(t); }} className="p-1 text-muted-foreground hover:text-primary rounded" title="مشاهده جزئیات">
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                                <div className="flex items-start justify-between gap-1">
                                  {t.task_number && (
                                    <span className="text-xs font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded-full shrink-0">{t.task_number}</span>
                                  )}
                                  <p className="font-medium text-sm leading-snug flex-1 min-w-0 truncate">{t.title}</p>
                                </div>
                                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                  {t.priority && (
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${priorityColors[t.priority]}`}>{priorityLabels[t.priority]}</span>
                                  )}
                                  {t.project_name && (
                                    <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full truncate max-w-[90px]">{t.project_name}</span>
                                  )}
                                  {t.due_date && (
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Clock className="w-3 h-3" /> {t.due_date}
                                    </span>
                                  )}
                                  {t.recurring_config && (
                                    <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                      <RotateCcw className="w-3 h-3" /> تکراری
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                                  <AssigneeAvatars task={t} />
                                  {t.time_spent && (
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Clock className="w-3 h-3" /> {t.time_spent}h
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        {colTasks.length === 0 && <p className="text-center text-xs text-muted-foreground py-6">خالی</p>}
                      </div>
                    </div>
                  )}
                </Droppable>
                );
              })}
            </div>
          </DragDropContext>
        </div>
      )}

      {showForm && (
        <TaskForm
          projects={projects}
          userName={userName}
          editTask={editTask}
          onClose={() => { setShowForm(false); setEditTask(null); }}
          onSaved={load}
        />
      )}

      {showTemplates && (
        <TemplatePicker
          onClose={() => setShowTemplates(false)}
          onUse={useTemplate}
        />
      )}

      {showRequestModal && (
        <TaskRequestModal
          projects={projects}
          onClose={() => setShowRequestModal(false)}
          onSaved={load}
        />
      )}

      {detailTask && (
        <TaskDetail
          task={detailTask}
          onClose={() => setDetailTask(null)}
          onSaved={load}
          projects={projects}
        />
      )}

      {/* ConfirmDialogs */}
      {deleteTarget && (
        <ConfirmDialog
          title="حذف تسک"
          description={`${deleteTarget.title} بلافاصله حذف می‌شود. آیا مطمئن هستید؟`}
          onConfirm={() => handleDelete(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
          confirmText="بله، حذف شود"
        />
      )}
    </div>
  );
}