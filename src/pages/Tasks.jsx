import { useEffect, useMemo, useRef, useState } from "react";
import { studio } from "@/api/studioClient";
import { useAuth } from "@/lib/AuthContext";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Plus, Trash2, Pencil, ArrowDownUp, LayoutTemplate, Filter, X, Send, CheckCircle, Clock, Search, Archive, Eye, RotateCcw, Table2, Columns3, GanttChart, UserRound, SquarePen, UsersRound, ListChecks, CheckSquare } from "lucide-react";
import TaskForm from "@/components/TaskForm";
import TemplatePicker from "@/components/TemplatePicker";
import TaskRequestModal from "@/components/TaskRequestModal";
import TaskDetail from "@/components/TaskDetail";
import PersianDatePicker from "@/components/PersianDatePicker";
import ConfirmDialog from "@/components/ConfirmDialog";
import { toast } from "@/components/ui/use-toast";
import SelectControl from "@/components/ui/SelectControl";
import { formatPersianNumber as faNum } from "@/lib/number-format";
import { fetchAllTags, subscribeToTags, getCachedTags } from "@/lib/tags";
import { getSubtaskStats } from "@/lib/subtasks";

const columns = [
  { id: "todo", title: "در انتظار", color: "bg-slate-100" },
  { id: "in_progress", title: "در حال انجام", color: "bg-blue-100" },
  { id: "done", title: "انجام شده", color: "bg-green-100" },
];
const archiveColumn = { id: "archived", title: "آرشیو", color: "bg-amber-100" };

const priorityLabels = { low: "کم", medium: "متوسط", high: "زیاد" };
const priorityColors = { low: "bg-slate-100 text-slate-600", medium: "bg-amber-100 text-amber-700", high: "bg-red-100 text-red-700" };
const priorityOrder = { high: 3, medium: 2, low: 1 };

const sortOptions = [
  { id: "priority_created", label: "اولویت، سپس جدیدترین" },
  { id: "priority", label: "اولویت" },
  { id: "created_desc", label: "جدیدترین" },
  { id: "created_asc", label: "قدیمی‌ترین" },
  { id: "deadline", label: "ددلاین" },
];

const viewModes = [
  { id: "assigned", label: "اختصاص داده شده به من", shortLabel: "اختصاصی من", Icon: UserRound },
  { id: "created", label: "ساخته شده توسط من", shortLabel: "توسط من", Icon: SquarePen },
  { id: "all", label: "همه تسک‌ها", shortLabel: "همه", Icon: UsersRound, adminOnly: true },
];

const layoutModes = [
  { id: "board", label: "برد", Icon: Columns3 },
  { id: "table", label: "جدول", Icon: Table2 },
  { id: "timeline", label: "تایم‌لاین", Icon: GanttChart },
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
    case "priority_created":
      return sorted.sort((a, b) =>
        ((priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0)) ||
        (new Date(b.created_date || 0).getTime() - new Date(a.created_date || 0).getTime())
      );
    case "deadline":
      return sorted.sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999"));
    default:
      return sorted;
  }
}

function normalizeOwnerKey(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u200c\u200d\u200e\u200f\ufeff]/g, "")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("fa-IR");
}

function taskOwnerValues(task) {
  const assignees = Array.isArray(task.assignees)
    ? task.assignees
    : typeof task.assignees === "string"
    ? (() => {
        try {
          const parsed = JSON.parse(task.assignees);
          if (Array.isArray(parsed)) return parsed;
        } catch {}
        return task.assignees.split(",").map((s) => s.trim()).filter(Boolean);
      })()
    : [];

  return [
    ...assignees,
    task.assignee,
    task.process_owner,
    task.process_owner_name,
    task.processOwner,
    task.owner,
    task.process_owner_email,
    task.owner_email,
  ].filter(Boolean);
}

function normalizeDateString(dateVal) {
  if (!dateVal) return "";
  const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
  const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
  return String(dateVal)
    .replace(/[۰-۹]/g, (d) => persianDigits.indexOf(d))
    .replace(/[٠-٩]/g, (d) => arabicDigits.indexOf(d))
    .slice(0, 10)
    .replace(/-/g, "/");
}

function matchesCustomFilters(task, { projectFilter, employeeFilter, tagFilter, dateFrom, dateTo }) {
  if (projectFilter) {
    const projId = String(projectFilter);
    const matchesProj =
      String(task.project_id ?? "") === projId ||
      String(task.project?.id ?? "") === projId ||
      String(task.project_name ?? "") === projId;
    if (!matchesProj) return false;
  }

  if (employeeFilter) {
    if (!matchesTaskOwner(task, employeeFilter)) return false;
  }

  if (tagFilter) {
    let taskTags = [];
    if (Array.isArray(task.tags)) {
      taskTags = task.tags;
    } else if (typeof task.tags === "string") {
      try {
        const parsed = JSON.parse(task.tags);
        if (Array.isArray(parsed)) taskTags = parsed;
      } catch {
        taskTags = task.tags.split(",").map((s) => s.trim()).filter(Boolean);
      }
    }
    if (!taskTags.includes(tagFilter)) return false;
  }

  if (dateFrom) {
    if (!task.due_date) return false;
    const taskDue = normalizeDateString(task.due_date);
    const from = normalizeDateString(dateFrom);
    if (taskDue < from) return false;
  }

  if (dateTo) {
    if (!task.due_date) return false;
    const taskDue = normalizeDateString(task.due_date);
    const to = normalizeDateString(dateTo);
    if (taskDue > to) return false;
  }

  return true;
}

function matchesTaskOwner(task, value) {
  const key = normalizeOwnerKey(value);
  return !!key && taskOwnerValues(task).some((owner) => normalizeOwnerKey(owner) === key);
}

function uniqueOwnerOptions(tasks) {
  const owners = new Map();
  tasks.forEach((task) => taskOwnerValues(task).forEach((owner) => {
    const key = normalizeOwnerKey(owner);
    if (key && !owners.has(key)) owners.set(key, String(owner).trim());
  }));
  return [...owners.values()];
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
        <span className="text-[10px] text-muted-foreground mr-1">+{faNum(assignees.length - 3)}</span>
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
  const [columnSort, setColumnSort] = useState({ todo: "priority_created", in_progress: "priority_created", done: "priority_created" });
  const [tableSort, setTableSort] = useState("priority_created");
  const [layoutMode, setLayoutMode] = useState("board");
  const [showTemplates, setShowTemplates] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [projectFilter, setProjectFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [allTags, setAllTags] = useState(() => getCachedTags());
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [creatorNames] = useState({});
  const [viewMode, setViewMode] = useState(() => (isAdmin ? "all" : "assigned"));
  const [showArchived, setShowArchived] = useState(false);
  const [showArchiveColumn, setShowArchiveColumn] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [mobileBoardColumn, setMobileBoardColumn] = useState("todo");
  const [isMobileBoard, setIsMobileBoard] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);
  const [selectedTasks, setSelectedTasks] = useState(new Set());
  const [detailTask, setDetailTask] = useState(null);
  const [longPressedTaskId, setLongPressedTaskId] = useState(null);
  const longPressTimer = useRef(null);
  const longPressTriggered = useRef(false);
  const clearLongPressTimer = () => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };

  // ConfirmDialog states
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    load();
    fetchAllTags().then(setAllTags);
    return subscribeToTags(setAllTags);
  }, []);

  useEffect(() => {
    if (isAdmin) {
      setViewMode("all");
    }
  }, [isAdmin]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const updateMobileBoard = (event) => setIsMobileBoard(event.matches);
    setIsMobileBoard(mediaQuery.matches);
    mediaQuery.addEventListener("change", updateMobileBoard);
    return () => mediaQuery.removeEventListener("change", updateMobileBoard);
  }, []);

  const load = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    const [t, p] = await Promise.all([
      studio.entities.Task.list("-created_date"),
      studio.entities.Project.list(),
    ]);
    setTasks(t);
    setProjects(p);
    if (showSpinner) setLoading(false);
  };

  // Base visible tasks based on role
  const baseVisibleTasks = isAdmin
    ? tasks
    : tasks.filter((t) => {
        return matchesTaskOwner(t, userName) || matchesTaskOwner(t, user?.email) || [t.process_owner_id, t.owner_id].some((ownerId) => String(ownerId || "") === String(user?.id || "")) || t.created_by_id === user?.id;
      });

  // Apply view mode filter
  const viewFilteredTasks = useMemo(() => {
    return baseVisibleTasks.filter((t) => {
      if (viewMode === "assigned") return matchesTaskOwner(t, userName) || matchesTaskOwner(t, user?.email) || [t.process_owner_id, t.owner_id].some((ownerId) => String(ownerId || "") === String(user?.id || ""));
      if (viewMode === "created") return t.created_by_id === user?.id;
      return true; // "all"
    });
  }, [baseVisibleTasks, viewMode, userName, user?.email, user?.id]);

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
    return searchFilteredTasks.filter((t) =>
      matchesCustomFilters(t, { projectFilter, employeeFilter, tagFilter, dateFrom, dateTo })
    );
  }, [searchFilteredTasks, projectFilter, employeeFilter, tagFilter, dateFrom, dateTo]);

  const hasTaskFilters = Boolean(projectFilter || employeeFilter || tagFilter || dateFrom || dateTo || searchQuery);
  const clearTaskFilters = () => {
    setProjectFilter("");
    setEmployeeFilter("");
    setTagFilter("");
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
    await studio.entities.Task.update(request.id, {
      request_status: "accepted",
      kind: "task",
      status: "todo",
    });
    load();
  };

  const handleRejectRequest = async (request) => {
    await studio.entities.Task.update(request.id, {
      request_status: "rejected",
    });
    load();
  };

  const handleDelayRequest = async (request) => {
    await studio.entities.Task.update(request.id, {
      request_status: "delayed",
    });
    load();
  };

  const onDragEnd = async (result) => {
    if (!result.destination) return;
    const taskId = result.draggableId;
    const newStatus = result.destination.droppableId;
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    if (newStatus === "archived" && !isAdmin) {
      toast({ title: "فقط مدیر می‌تواند تسک را تأیید و بایگانی کند", variant: "destructive" });
      return;
    }
    const update = newStatus === "archived"
      ? { status: "done", completion_approved: true, archived: true }
      : { status: newStatus, ...(task.archived ? { archived: false, completion_approved: false } : {}) };
    setTasks((prev) => prev.map((item) => item.id === taskId ? { ...item, ...update } : item));
    await studio.entities.Task.update(taskId, update);
  };

  const handleDelete = async (id) => {
    try {
      await studio.entities.Task.delete(id);
      setSelectedTasks(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await load();
      toast({ title: "تسک حذف شد" });
    } catch (err) {
      console.error("Failed to delete task:", err);
      toast({
        title: "حذف تسک انجام نشد",
        description: err?.message || "لطفاً دوباره تلاش کنید.",
        variant: "destructive",
      });
    } finally {
      setDeleteTarget(null);
    }
  };

  const toggleArchiveTask = async (task) => {
    try {
      await studio.entities.Task.update(task.id, { archived: !task.archived });
      await load();
      toast({ title: task.archived ? "تسک از بایگانی خارج شد" : "تسک بایگانی شد" });
    } catch (err) {
      toast({ title: "تغییر بایگانی انجام نشد", description: err?.message || "دوباره تلاش کنید.", variant: "destructive" });
    }
  };

  const approveAndArchiveTask = async (task) => {
    try {
      await studio.entities.Task.update(task.id, { status: "done", completion_approved: true, archived: true });
      await load();
      toast({ title: "تسک تأیید و به آرشیو منتقل شد" });
    } catch (err) {
      toast({ title: "انتقال به آرشیو انجام نشد", description: err?.message || "دوباره تلاش کنید.", variant: "destructive" });
    }
  };

  const handleBulkDelete = async () => {
    for (const id of selectedTasks) {
      await studio.entities.Task.delete(id);
    }
    setSelectedTasks(new Set());
    load();
    toast({ title: `${faNum(selectedTasks.size)} تسک حذف شد` });
  };

  const handleBulkArchive = async () => {
    const count = selectedTasks.size;
    try {
      for (const id of selectedTasks) {
        await studio.entities.Task.update(id, { archived: !showArchived });
      }
      setSelectedTasks(new Set());
      await load();
      toast({ title: `${faNum(count)} تسک ${showArchived ? "از بایگانی خارج شد" : "بایگانی شد"}` });
    } catch (err) {
      toast({ title: "عملیات بایگانی کامل نشد", description: err?.message || "دوباره تلاش کنید.", variant: "destructive" });
    }
  };

  const handleBulkStatusChange = async (status) => {
    for (const id of selectedTasks) {
      await studio.entities.Task.update(id, { status });
    }
    setSelectedTasks(new Set());
    load();
    toast({ title: `${faNum(selectedTasks.size)} تسک بروزرسانی شد` });
  };

  const handleBulkAssign = async (assignee) => {
    for (const id of selectedTasks) {
      await studio.entities.Task.update(id, { assignees: [assignee], assignee });
    }
    setSelectedTasks(new Set());
    load();
    toast({ title: `${faNum(selectedTasks.size)} تسک به ${assignee} اختصاص یافت` });
  };

  const handleEdit = (task) => {
    setEditTask(task);
    setShowForm(true);
  };

  const handleViewDetail = (task) => {
    setDetailTask(task);
  };

  const useTemplate = (template) => {
    const checklistItems = template.checklist || [];
    const checklistText = checklistItems.length > 0
      ? (template.description ? template.description + "\n\n" : "") + "📋 چک‌لیست:\n" + checklistItems.map((item) => `☐ ${item}`).join("\n")
      : template.description || "";
    setEditTask({
      title: template.title,
      description: checklistText,
      subtasks: checklistItems.map((item) => ({ title: item, done: false })),
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
      result[col.id] = sortTasks(filteredTasks.filter(t => t.status === col.id), columnSort[col.id]);
    });
    const query = searchQuery.trim().toLowerCase();
    const archived = viewFilteredTasks.filter((task) => {
      if (!task.archived) return false;
      if (query && !task.title.toLowerCase().includes(query) && !(task.description || "").toLowerCase().includes(query) && !(task.task_number || "").toLowerCase().includes(query)) return false;
      return matchesCustomFilters(task, { projectFilter, employeeFilter, tagFilter, dateFrom, dateTo });
    });
    result.archived = sortTasks(archived, "priority_created");
    return result;
  }, [filteredTasks, viewFilteredTasks, columnSort, searchQuery, projectFilter, employeeFilter, tagFilter, dateFrom, dateTo]);

  const sortedTableTasks = useMemo(() => sortTasks(filteredTasks, tableSort), [filteredTasks, tableSort]);
  const availableBoardColumns = showArchiveColumn ? [...columns, archiveColumn] : columns;
  const boardColumns = isMobileBoard ? availableBoardColumns.filter((column) => column.id === mobileBoardColumn) : availableBoardColumns;

  if (loading)
    return (
      <div className="flex justify-center p-20">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{isAdmin ? "تسک‌ها" : "تسک‌های من"}</h1>
          <p className="text-muted-foreground mt-1 text-sm">مدیریت تسک‌ها به‌سبک ترلو</p>
        </div>
        <div className="grid grid-cols-6 gap-2 w-full sm:w-auto sm:flex sm:items-center sm:flex-wrap">
          <div className="relative hidden sm:block">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی عنوان، توضیحات، شماره..."
              className="border border-input rounded-xl pr-9 pl-3 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none w-[220px]"
            />
          </div>
          <button
            onClick={() => setShowSearch((value) => !value)}
            aria-label="جستجوی تسک‌ها"
            aria-expanded={showSearch}
            title="جستجوی تسک‌ها"
            className={`relative col-start-1 row-start-1 h-10 w-10 justify-self-center rounded-xl border inline-flex items-center justify-center transition-colors sm:hidden ${showSearch || searchQuery ? "border-primary/40 bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-accent"}`}
          >
            <Search className="h-4 w-4" />
            {searchQuery && <span className="absolute -top-1 -left-1 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />}
          </button>
          <div className="col-span-6 sm:hidden" hidden={!showSearch}>
            <div className="relative">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="search"
                autoFocus={showSearch}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجوی عنوان، توضیحات، شماره..."
                aria-label="جستجوی تسک‌ها"
                className="w-full border border-input rounded-xl pr-9 pl-3 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          <div className="flex border border-border rounded-xl bg-card p-1 col-span-3 col-start-1 row-start-2 justify-self-start sm:justify-self-auto" role="group" aria-label="نمایش تسک‌ها">
            {layoutModes.map(({ id, label, Icon }) => (
              <button key={id} onClick={() => setLayoutMode(id)} aria-pressed={layoutMode === id}
                title={label}
                aria-label={label}
                className={`h-8 min-w-8 px-2 sm:px-2.5 py-1.5 rounded-lg text-sm flex items-center justify-center gap-1.5 ${layoutMode === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                <Icon className="w-4 h-4 shrink-0" /><span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
          {/* View Mode Tabs */}
          <div className="flex border border-border rounded-xl bg-card p-1 col-span-3 col-start-2 row-start-1 justify-self-end sm:justify-self-auto" role="group" aria-label="نوع تسک">
            {viewModes.filter(v => !v.adminOnly || isAdmin).map((v) => (
              <button
                key={v.id}
                onClick={() => setViewMode(v.id)}
                title={v.label}
                aria-label={v.label}
                aria-pressed={viewMode === v.id}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === v.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="inline-flex items-center gap-1.5"><v.Icon className="h-4 w-4" /><span className="hidden sm:inline">{v.label}</span><span className="sr-only sm:hidden">{v.shortLabel}</span></span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            aria-label="فیلتر تسک‌ها"
            title="فیلتر تسک‌ها"
            className={`relative col-start-5 row-start-1 h-10 w-10 sm:h-auto sm:w-auto sm:px-3 sm:py-2 justify-self-center border rounded-xl font-medium inline-flex items-center justify-center gap-1.5 transition-colors ${showFilters || hasTaskFilters ? "border-primary/40 text-primary bg-primary/5" : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"}`}
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline text-sm">فیلترها</span>
            {hasTaskFilters && <span className="h-2 w-2 rounded-full bg-primary" aria-label="فیلتر فعال" />}
          </button>
          <button
            onClick={() => { setShowArchived((v) => !v); setSelectedTasks(new Set()); }}
            aria-pressed={showArchived}
            aria-label={showArchived ? "بازگشت به تسک‌های فعال" : "مشاهده بایگانی"}
            title={showArchived ? "بازگشت به تسک‌های فعال" : "مشاهده بایگانی"}
            className={`relative col-start-6 row-start-1 h-10 w-10 justify-self-center rounded-xl border inline-flex items-center justify-center transition-colors ${showArchived ? "border-amber-400 text-amber-700 bg-amber-50" : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"}`}
          >
            {showArchived ? <RotateCcw className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setShowRequestModal(true)}
            aria-label="درخواست تسک"
            title="درخواست تسک"
            className="col-start-4 row-start-2 h-10 w-10 justify-self-center rounded-xl border border-purple-300 text-purple-600 inline-flex items-center justify-center hover:bg-purple-50 transition-colors sm:h-auto sm:w-auto sm:px-4 sm:py-2.5 sm:gap-2 sm:text-sm sm:whitespace-nowrap"
          >
            <Send className="w-4 h-4 sm:w-5 sm:h-5" /><span className="hidden sm:inline">درخواست تسک</span>
          </button>
          <button
            onClick={() => setShowTemplates(true)}
            aria-label="قالب‌های تسک"
            title="قالب‌های تسک"
            className="col-start-5 row-start-2 h-10 w-10 justify-self-center rounded-xl border border-primary/30 text-primary inline-flex items-center justify-center hover:bg-primary/5 transition-colors sm:h-auto sm:w-auto sm:px-4 sm:py-2.5 sm:gap-2 sm:text-sm sm:whitespace-nowrap"
          >
            <LayoutTemplate className="w-4 h-4 sm:w-5 sm:h-5" /><span className="hidden sm:inline">قالب‌ها</span>
          </button>
          <button
            onClick={() => { setEditTask(null); setShowForm(true); }}
            aria-label="ساخت تسک جدید"
            title="ساخت تسک جدید"
            className="col-start-6 row-start-2 h-10 w-10 justify-self-center rounded-xl bg-primary text-primary-foreground inline-flex items-center justify-center hover:opacity-90 transition-opacity sm:h-auto sm:w-auto sm:px-4 sm:py-2.5 sm:gap-2 sm:text-sm sm:whitespace-nowrap"
          >
            <Plus className="w-5 h-5" /><span className="hidden sm:inline">تسک جدید</span>
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
          {showFilters && <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center gap-2 sm:gap-3 bg-card border border-border rounded-xl p-3 sm:p-4 animate-in fade-in slide-in-from-top-1">
            <span className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground font-medium">
              <Filter className="w-4 h-4" /> فیلترها:
            </span>
            <SelectControl
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="col-span-2 w-full sm:col-span-1 sm:w-auto text-sm sm:min-w-[170px]"
            >
              <option value="">همه پروژه‌ها</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </SelectControl>
            {isAdmin && (
              <SelectControl
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
                className="col-span-2 w-full sm:col-span-1 sm:w-auto text-sm sm:min-w-[170px]"
              >
                <option value="">همه کارمندان</option>
                {uniqueOwnerOptions(baseVisibleTasks).map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </SelectControl>
            )}
            <SelectControl
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="col-span-2 w-full sm:col-span-1 sm:w-auto text-sm sm:min-w-[140px]"
            >
              <option value="">همه برچسب‌ها</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </SelectControl>
            <div className="col-span-2 min-w-0 sm:col-span-1 sm:w-44">
              <PersianDatePicker value={dateFrom} onChange={setDateFrom} placeholder="از ددلاین" hideQuickButtons />
            </div>
            <div className="col-span-2 min-w-0 sm:col-span-1 sm:w-44">
              <PersianDatePicker value={dateTo} onChange={setDateTo} placeholder="تا ددلاین" hideQuickButtons />
            </div>
            {hasTaskFilters && (
              <button
                onClick={clearTaskFilters}
                className="text-xs text-primary hover:underline flex items-center gap-1 col-span-2 sm:col-span-1 sm:mr-auto"
              >
                <X className="w-3.5 h-3.5" /> پاک کردن فیلترها
              </button>
            )}
          </div>}

          {/* Incoming task requests */}
          {incomingRequests.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Send className="w-4 h-4 text-amber-700" />
                  </div>
                  <h3 className="font-bold text-amber-800">درخواست‌های تسک دریافتی ({faNum(incomingRequests.length)})</h3>
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
                <SelectControl
                  onChange={(e) => { handleBulkStatusChange(e.target.value); e.target.value = ""; }}
                  className="border border-input rounded-xl px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">تغییر وضعیت به...</option>
                  <option value="todo">در انتظار</option>
                  <option value="in_progress">در حال انجام</option>
                  <option value="done">انجام شده</option>
                </SelectControl>
                <SelectControl
                  onChange={(e) => { handleBulkAssign(e.target.value); e.target.value = ""; }}
                  className="border border-input rounded-xl px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[150px]"
                >
                  <option value="">اختصاص به...</option>
                  {uniqueOwnerOptions(baseVisibleTasks).map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </SelectControl>
                <button
                  onClick={handleBulkArchive}
                  className="bg-amber-500 text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-amber-600 flex items-center gap-1"
                >
                  <Archive className="w-3.5 h-3.5" /> {showArchived ? "خروج از بایگانی" : "بایگانی"}
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

          {layoutMode === "board" ? <>
            <div className="mb-2 flex justify-end">
              <button type="button" onClick={() => { setShowArchiveColumn((value) => !value); if (!showArchiveColumn && isMobileBoard) setMobileBoardColumn("archived"); else if (showArchiveColumn && mobileBoardColumn === "archived") setMobileBoardColumn("todo"); }} aria-expanded={showArchiveColumn} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${showArchiveColumn ? "border-amber-300 bg-amber-50 text-amber-800" : "border-border bg-card text-muted-foreground hover:bg-accent"}`}>
                <Archive className="h-4 w-4" /> {showArchiveColumn ? "پنهان‌کردن آرشیو" : "نمایش آرشیو"} <span className="rounded-full bg-background/70 px-1.5 text-xs">{faNum(columnTasks.archived.length)}</span>
              </button>
            </div>
            <div className={`grid gap-1.5 rounded-xl border border-border bg-card p-1 md:hidden ${showArchiveColumn ? "grid-cols-4" : "grid-cols-3"}`} role="group" aria-label="انتخاب ستون تسک">
              {availableBoardColumns.map((col) => {
                const ColumnIcon = col.id === "todo" ? Clock : col.id === "in_progress" ? RotateCcw : col.id === "archived" ? Archive : CheckCircle;
                return <button key={col.id} onClick={() => setMobileBoardColumn(col.id)} aria-pressed={mobileBoardColumn === col.id} aria-label={`${col.title}، ${faNum(columnTasks[col.id].length)} تسک`} title={col.title} className={`flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-1.5 py-2 text-xs font-medium transition-colors ${mobileBoardColumn === col.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}><ColumnIcon className="h-4 w-4 shrink-0" /><span className="truncate">{col.title.replace("در ", "")}</span><span className={`rounded-full px-1.5 ${mobileBoardColumn === col.id ? "bg-white/20" : "bg-accent"}`}>{faNum(columnTasks[col.id].length)}</span></button>;
              })}
            </div>
            <DragDropContext onDragEnd={onDragEnd}>
            <div className={`grid w-full grid-cols-1 gap-3 pb-3 md:grid-cols-3 ${showArchiveColumn ? "xl:grid-cols-4" : ""}`}>
              {boardColumns.map((col) => {
                const colTasks = columnTasks[col.id];
                return (
                <Droppable droppableId={col.id} key={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`w-full min-w-0 rounded-2xl p-3 min-h-[320px] flex flex-col md:min-h-[600px] ${
                        snapshot.isDraggingOver ? "bg-primary/5" : "bg-card border border-border"
                      }`}
                    >
                      <div className="mb-3 flex flex-col items-stretch gap-2 px-1">
                        <div className="flex items-center justify-between gap-2"><h3 className="font-bold text-sm">{col.title}</h3><span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${col.color}`}>{faNum(colTasks.length)}</span></div>
                        <div className="min-w-0">
                          <SelectControl aria-label={`مرتب‌سازی ستون ${col.title}`} value={columnSort[col.id]} onChange={(e) => setColumnSort((prev) => ({ ...prev, [col.id]: e.target.value }))} className="h-9 w-full min-w-0 text-xs">
                            {sortOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                          </SelectControl>
                        </div>
                      </div>
                      <div className="space-y-2 flex-1">
                        {colTasks.map((t, i) => (
                          <Draggable draggableId={t.id} index={i} key={t.id}>
                            {(prov) => (
                              <div
                                ref={prov.innerRef}
                                {...prov.draggableProps}
                                {...prov.dragHandleProps}
                                className={`relative bg-card border border-border rounded-xl p-2.5 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-primary/30 transition-all ${
                                  selectedTasks.has(t.id) ? "ring-2 ring-primary ring-offset-2" : ""
                                }`}
                                onClick={(e) => {
                                  if (longPressTriggered.current) {
                                    longPressTriggered.current = false;
                                    e.preventDefault();
                                    e.stopPropagation();
                                    return;
                                  }
                                  if (!e.target.closest('button') && !selectedTasks.has(t.id)) {
                                    handleViewDetail(t);
                                  }
                                }}
                                onTouchStart={() => {
                                  clearLongPressTimer();
                                  longPressTriggered.current = false;
                                  setLongPressedTaskId(null);
                                  longPressTimer.current = window.setTimeout(() => {
                                    longPressTriggered.current = true;
                                    setLongPressedTaskId(t.id);
                                  }, 450);
                                }}
                                onTouchEnd={() => {
                                  clearLongPressTimer();
                                  if (longPressTriggered.current) {
                                    longPressTimer.current = window.setTimeout(() => {
                                      setLongPressedTaskId(null);
                                      longPressTriggered.current = false;
                                      longPressTimer.current = null;
                                    }, 2500);
                                  }
                                }}
                                onTouchMove={() => { clearLongPressTimer(); longPressTriggered.current = false; setLongPressedTaskId(null); }}
                                onTouchCancel={() => { clearLongPressTimer(); longPressTriggered.current = false; setLongPressedTaskId(null); }}
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
                                    <button onClick={(e) => { e.stopPropagation(); handleEdit(t); }} className="p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary rounded-lg transition-colors" title="ویرایش">
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(t); }} className="p-1.5 text-muted-foreground hover:bg-red-50/10 hover:text-red-600 rounded-lg transition-colors" title="حذف">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); toggleArchiveTask(t); }} className="p-1.5 text-muted-foreground hover:bg-amber-50/10 hover:text-amber-600 rounded-lg transition-colors" title={t.archived ? "خروج از بایگانی" : "بایگانی"}>
                                      {t.archived ? <RotateCcw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); handleViewDetail(t); }} className="p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary rounded-lg transition-colors" title="مشاهده جزئیات">
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                                {col.id === "done" && isAdmin && !t.archived && (
                                  <button type="button" onClick={(e) => { e.stopPropagation(); approveAndArchiveTask(t); }} className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-green-50 px-2 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100">
                                    <CheckCircle className="h-3.5 w-3.5" /> تأیید و انتقال به آرشیو
                                  </button>
                                )}
                                <div className="flex items-start justify-between gap-1">
                                  {t.task_number && (
                                    <span className="text-xs font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded-full shrink-0">{t.task_number}</span>
                                  )}
                                  <p dir="rtl" title={t.title} className="font-medium text-right text-sm leading-snug flex-1 min-w-0 truncate">{t.title}</p>
                                </div>
                                {longPressedTaskId === t.id && <div role="tooltip" dir="rtl" className="absolute inset-x-2 top-12 z-30 rounded-lg border border-border bg-popover p-3 text-popover-foreground text-right shadow-lg">
                                  <p dir="rtl" className="font-semibold text-right text-sm whitespace-normal break-words">{t.title}</p>
                                  {t.description && <p className="mt-1 text-xs leading-relaxed whitespace-pre-wrap break-words">{t.description}</p>}
                                </div>}
                                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                  {t.priority && (
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${priorityColors[t.priority]}`}>{priorityLabels[t.priority]}</span>
                                  )}
                                  {t.project_name && (
                                    <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full truncate max-w-[80px]">{t.project_name}</span>
                                  )}
                                  {t.due_date && (
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Clock className="w-3 h-3" /> {t.due_date}
                                    </span>
                                  )}
                                  {t.recurring_config && (
                                    <span className="text-xs bg-purple-100 text-purple-700 border border-purple/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                                      <RotateCcw className="w-3 h-3" /> تکراری
                                    </span>
                                  )}
                                  {Array.isArray(t.subtasks) && t.subtasks.length > 0 && (() => {
                                    const stats = getSubtaskStats(t.subtasks);
                                    return stats.hasSubtasks ? (
                                      <span
                                        title={`پیشرفت زیرتسک‌ها: ${faNum(stats.completed)} از ${faNum(stats.total)}`}
                                        className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                          stats.allDone
                                            ? "bg-emerald-100 text-emerald-800 border border-emerald/20"
                                            : "bg-accent text-muted-foreground"
                                        }`}
                                      >
                                        <CheckSquare className="w-3 h-3" />
                                        {faNum(stats.completed)}/{faNum(stats.total)}
                                      </span>
                                    ) : null;
                                  })()}
                                  {(Array.isArray(t.tags) ? t.tags : []).slice(0, 3).map((tag) => (
                                    <span key={tag} className="max-w-24 truncate rounded-md bg-muted border border-border/60 px-1.5 py-0.5 text-xs text-muted-foreground">{tag}</span>
                                  ))}
                                  {Array.isArray(t.tags) && t.tags.length > 3 && <span className="text-xs text-muted-foreground">+{faNum(t.tags.length - 3)}</span>}
                                </div>
                                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/60">
                                  <div className="flex items-center gap-2.5">
                                    <AssigneeAvatars task={t} />
                                    {Array.isArray(t.subtasks) && t.subtasks.length > 0 && (
                                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" aria-label={`${faNum(t.subtasks.length)} زیرتسک`}>
                                        <ListChecks className="h-3.5 w-3.5" />{faNum(t.subtasks.length)}
                                      </span>
                                    )}
                                  </div>
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
          </> : layoutMode === "table" ? (
            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full text-sm text-right">
                <thead className="bg-accent/40 text-muted-foreground">
                  <tr>
                    <th className="p-3 font-medium">تسک</th>
                    <th className="p-3 font-medium">وضعیت</th>
                    <th className="p-3 font-medium"><button onClick={() => setTableSort((v) => v === "priority" ? "priority_created" : "priority")} className="inline-flex items-center gap-1">اولویت <ArrowDownUp className="w-3.5 h-3.5" /></button></th>
                    <th className="p-3 font-medium">مسئول</th>
                    <th className="p-3 font-medium"><button onClick={() => setTableSort("deadline")} className="inline-flex items-center gap-1">ددلاین <ArrowDownUp className="w-3.5 h-3.5" /></button></th>
                    <th className="p-3 font-medium"><button onClick={() => setTableSort((v) => v === "created_asc" ? "created_desc" : "created_asc")} className="inline-flex items-center gap-1">تاریخ ایجاد <ArrowDownUp className="w-3.5 h-3.5" /></button></th>
                    <th className="p-3 font-medium">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedTableTasks.map((task) => <tr key={task.id} className="hover:bg-accent/20">
                    <td className="p-3">
                      <div className="flex items-center flex-wrap gap-1">
                        <button dir="rtl" onClick={() => handleViewDetail(task)} className="block w-full text-right font-medium hover:text-primary">{task.title}</button>
                        {task.subtasks?.length > 0 && (() => {
                          const stats = getSubtaskStats(task.subtasks);
                          return stats.hasSubtasks ? (
                            <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full ${stats.allDone ? 'bg-emerald-100 text-emerald-800' : 'bg-muted text-muted-foreground'}`}>
                              <CheckSquare className="w-3 h-3" />
                              {faNum(stats.completed)}/{faNum(stats.total)}
                            </span>
                          ) : null;
                        })()}
                      </div>
                      {task.task_number && <div className="text-xs text-muted-foreground mt-1">{task.task_number}</div>}
                    </td>
                    <td className="p-3"><SelectControl aria-label={`وضعیت ${task.title}`} value={task.status} onChange={async (e) => { await studio.entities.Task.update(task.id, { status: e.target.value }); await load(); }} className="h-8">{columns.map((column) => <option key={column.id} value={column.id}>{column.title}</option>)}</SelectControl></td>
                    <td className="p-3"><span className={`rounded-full px-2 py-1 text-xs ${priorityColors[task.priority]}`}>{priorityLabels[task.priority]}</span></td>
                    <td className="p-3">{(task.assignees || (task.assignee ? [task.assignee] : [])).join("، ") || "—"}</td>
                    <td className="p-3">{task.due_date || "—"}</td>
                    <td className="p-3">{task.created_date ? new Date(task.created_date).toLocaleDateString("fa-IR") : "—"}</td>
                    <td className="p-3"><div className="flex gap-1"><button aria-label="ویرایش تسک" onClick={() => handleEdit(task)} className="rounded-lg p-1.5 hover:bg-primary/10"><Pencil className="h-4 w-4" /></button><button aria-label={task.archived ? "خروج از بایگانی" : "بایگانی"} onClick={() => toggleArchiveTask(task)} className="rounded-lg p-1.5 hover:bg-amber-100"><Archive className="h-4 w-4" /></button><button aria-label="حذف تسک" onClick={() => setDeleteTarget(task)} className="rounded-lg p-1.5 hover:bg-red-100 text-red-600"><Trash2 className="h-4 w-4" /></button></div></td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto">
              <div className="relative space-y-3 before:absolute before:bottom-4 before:right-4 before:top-4 before:w-px before:bg-border">
                {[...sortedTableTasks].sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999")).map((task) => <div key={task.id} className="relative pr-10">
                  <span className={`absolute right-[11px] top-4 h-2.5 w-2.5 rounded-full ring-4 ring-background ${task.status === "done" ? "bg-green-500" : task.status === "in_progress" ? "bg-blue-500" : "bg-amber-500"}`} />
                  <button onClick={() => handleViewDetail(task)} className="w-full rounded-xl border border-border bg-card p-4 text-right hover:border-primary/40 hover:shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2"><span dir="rtl" className="text-right font-semibold">{task.title}</span><span className="text-xs text-muted-foreground">{task.due_date ? `سررسید ${task.due_date}` : "بدون ددلاین"}</span></div>
                    <div className="mt-2 flex flex-wrap gap-2"><span className={`rounded-full px-2 py-0.5 text-xs ${priorityColors[task.priority]}`}>{priorityLabels[task.priority]}</span><span className="text-xs text-muted-foreground">{columns.find((column) => column.id === task.status)?.title}</span></div>
                  </button>
                </div>)}
              </div>
            </div>
          )}
        </div>
      )}

      <TaskForm
        key={editTask?.id ?? (editTask ? JSON.stringify(editTask) : "new")}
        projects={projects}
        editTask={editTask}
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSaved={() => load(false)}
      />

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
