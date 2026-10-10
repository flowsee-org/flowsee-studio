import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, FolderKanban, Pencil, Filter, X } from "lucide-react";
import ProjectForm from "@/components/ProjectForm";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useDeleteUndo } from "@/hooks/useDeleteUndo.jsx";
import { loadTeamMembers } from "@/lib/teamMembers";

const statusLabels = { active: "فعال", completed: "تکمیل شده", paused: "متوقف شده" };
const statusColors = { active: "bg-green-100 text-green-700", completed: "bg-blue-100 text-blue-700", paused: "bg-amber-100 text-amber-700" };

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editProject, setEditProject] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [managerFilter, setManagerFilter] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    load();
    loadTeamMembers().then((m) => setMembers(m));
  }, []);

  const load = async () => {
    setLoading(true);
    const [p, t] = await Promise.all([
      base44.entities.Project.list("-created_date"),
      base44.entities.Task.list(),
    ]);
    setProjects(p);
    setTasks(t);
    setLoading(false);
  };

  const { deleteWithUndo } = useDeleteUndo("Project", (id) => base44.entities.Project.delete(id), load);

  const managerOptions = useMemo(() => {
    const seen = new Set();
    return [...members.map((m) => m.name), ...projects.map((p) => p.manager || "")]
      .filter(Boolean)
      .filter((n) => (seen.has(n.toLowerCase()) ? false : (seen.add(n.toLowerCase()), true)));
  }, [members, projects]);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (managerFilter && p.manager !== managerFilter) return false;
      return true;
    });
  }, [projects, statusFilter, managerFilter]);

  const hasFilters = Boolean(statusFilter || managerFilter);
  const clearFilters = () => { setStatusFilter(""); setManagerFilter(""); };

  const handleDelete = async (id) => {
    const project = projects.find(p => p.id === id);
    if (project) setDeleteTarget(project);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    deleteWithUndo(deleteTarget, { title: deleteTarget.name });
    setDeleteTarget(null);
  };

  const handleEdit = (project) => {
    setEditProject(project);
    setShowForm(true);
  };

  if (loading)
    return (
      <div className="flex justify-center p-20">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">پروژه‌ها</h1>
          <p className="text-muted-foreground mt-1 text-sm">مدیریت پروژه‌های کسب‌وکار</p>
        </div>
        <button
          onClick={() => { setEditProject(null); setShowForm(true); }}
          className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:opacity-90 transition-opacity"
        >
          <Plus className="w-5 h-5" /> پروژه جدید
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-card border border-border rounded-xl p-3 sm:p-4">
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground font-medium">
          <Filter className="w-4 h-4" /> فیلترها:
        </span>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-input rounded-xl px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[170px]"
        >
          <option value="">همه وضعیت‌ها</option>
          {Object.entries(statusLabels).map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
        <select
          value={managerFilter}
          onChange={(e) => setManagerFilter(e.target.value)}
          className="border border-input rounded-xl px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[170px]"
        >
          <option value="">همه مدیران</option>
          {managerOptions.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-primary hover:underline flex items-center gap-1 mr-auto"
          >
            <X className="w-3.5 h-3.5" /> پاک کردن فیلترها
          </button>
        )}
      </div>

      {filteredProjects.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-12 text-center">
          <FolderKanban className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">
            {hasFilters ? "پروژه‌ای مطابق فیلترها پیدا نشد" : "هنوز پروژه‌ای ثبت نشده است"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((p) => {
            const projectTasks = tasks.filter((t) => t.project_id === p.id);
            const doneCount = projectTasks.filter((t) => t.status === "done").length;
            const progress = projectTasks.length > 0 ? Math.round((doneCount / projectTasks.length) * 100) : 0;
            return (
              <div key={p.id} className="bg-card rounded-2xl border border-border p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <Link to={`/projects/${p.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: (p.color || "#FE5400") + "20" }}>
                      <FolderKanban className="w-5 h-5" style={{ color: p.color || "#FE5400" }} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate hover:text-primary transition-colors">{p.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[p.status] || statusColors.active}`}>{statusLabels[p.status] || statusLabels.active}</span>
                    </div>
                  </Link>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => handleEdit(p)} className="p-1.5 text-muted-foreground hover:text-primary rounded-lg hover:bg-primary/5">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="p-1.5 text-muted-foreground hover:text-red-500 rounded-lg hover:bg-destructive/10">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {p.description && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{p.description}</p>}
                {p.manager && <p className="text-xs text-muted-foreground mb-2">مدیر: {p.manager}</p>}
                {(p.start_date || p.end_date) && (
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                    {p.start_date && (
                      <span className="flex items-center gap-1">
                        <span>شروع:</span>
                        <span className="font-medium">{p.start_date}</span>
                      </span>
                    )}
                    {p.end_date && (
                      <span className="flex items-center gap-1">
                        <span>پایان:</span>
                        <span className="font-medium">{p.end_date}</span>
                      </span>
                    )}
                  </div>
                )}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">پیشرفت</span>
                    <span className="font-medium">{doneCount}/{projectTasks.length} تسک</span>
                  </div>
                  <div className="h-2 bg-accent rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: p.color || "#FE5400" }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <ProjectForm
          editProject={editProject}
          onClose={() => { setShowForm(false); setEditProject(null); }}
          onSaved={load}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="حذف پروژه"
          description={`پروژه "${deleteTarget.name}" بلافاصله حذف می‌شود. آیا مطمئن هستید؟`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
          confirmText="بله، حذف شود"
        />
      )}
    </div>
  );
}