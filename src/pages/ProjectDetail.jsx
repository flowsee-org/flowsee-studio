import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ArrowRight, Users, ListTodo, FolderKanban, UserCircle, Flag, File, MessageSquare, DollarSign, CheckSquare, TrendingUp, TrendingDown } from "lucide-react";
import { formatPersianNumber as faNum } from "@/lib/number-format";
import TaskDetail from "@/components/TaskDetail";

const statusLabels = { active: "فعال", completed: "تکمیل شده", paused: "متوقف شده" };
const statusColors = { active: "bg-green-100 text-green-700", completed: "bg-blue-100 text-blue-700", paused: "bg-amber-100 text-amber-700" };
const taskStatusLabels = { todo: "در انتظار", in_progress: "در حال انجام", done: "انجام شده" };
const taskStatusColors = { todo: "bg-slate-100 text-slate-600", in_progress: "bg-blue-100 text-blue-700", done: "bg-green-100 text-green-700" };

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // overview, tasks, milestones, files, updates, budget

  useEffect(() => {
    (async () => {
      const [allProjects, allTasks, allExpenses, allIncomes] = await Promise.all([
        base44.entities.Project.list(),
        base44.entities.Task.list(),
        base44.entities.Expense.list(),
        base44.entities.Income.list(),
      ]);
      setProject(allProjects.find((p) => p.id === id));
      setTasks(allTasks.filter((t) => t.project_id === id));
      setExpenses(allExpenses.filter((e) => e.project_id === id));
      setIncomes(allIncomes.filter((i) => i.project_id === id));
      setLoading(false);
    })();
  }, [id]);

  if (loading)
    return (
      <div className="flex justify-center p-20">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );

  if (!project)
    return (
      <div className="text-center p-20">
        <p className="text-muted-foreground">پروژه یافت نشد</p>
        <button onClick={() => navigate("/projects")} className="text-primary text-sm mt-2">بازگشت</button>
      </div>
    );

  const allAssignees = [...new Set(tasks.flatMap((t) => t.assignees || (t.assignee ? [t.assignee] : [])).filter(Boolean))];
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const progress = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;
  const color = project.color || "#FE5400";

  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalIncomes = incomes.reduce((s, i) => s + (i.amount || 0), 0);
  const netProfit = totalIncomes - totalExpenses;

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <button onClick={() => navigate("/projects")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="w-4 h-4" /> بازگشت به پروژه‌ها
      </button>

      {/* Project Header */}
      <div className="bg-card rounded-2xl border border-border p-5 sm:p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: color + "20" }}>
            <FolderKanban className="w-6 h-6" style={{ color }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold">{project.name}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[project.status] || statusColors.active}`}>
                {statusLabels[project.status] || statusLabels.active}
              </span>
            </div>
            {project.description && <p className="text-sm text-muted-foreground mt-1">{project.description}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
          <div className="bg-accent/40 rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground">تسک‌ها</p>
            <p className="text-lg font-bold mt-1">{faNum(tasks.length)}</p>
          </div>
          <div className="bg-accent/40 rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground">پرسنل</p>
            <p className="text-lg font-bold mt-1">{faNum(allAssignees.length)}</p>
          </div>
          <div className="bg-accent/40 rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground">پیشرفت</p>
            <p className="text-lg font-bold mt-1">{faNum(progress)}٪</p>
          </div>
        </div>

        <div className="h-2 bg-accent rounded-full overflow-hidden mt-3">
          <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: color }} />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-border">
        <nav className="flex -mb-px overflow-x-auto" aria-label="Tabs">
          {[
            { id: 'overview', label: 'نمای کلی', icon: FolderKanban },
            { id: 'tasks', label: 'تسک‌ها', icon: ListTodo, count: tasks.length },
            { id: 'files', label: 'فایل‌ها', icon: File, count: project.files?.length || 0 },
            { id: 'updates', label: 'به‌روزرسانی‌ها', icon: MessageSquare, count: project.status_updates?.length || 0 },
            { id: 'budget', label: 'بودجه', icon: DollarSign },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== undefined && <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{faNum(tab.count)}</span>}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-4 sm:p-6">
        {activeTab === 'overview' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card rounded-2xl border border-border p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">کل درآمد</p>
                  <p className="text-2xl font-bold text-green-600">{faNum(totalIncomes)}</p>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-2xl border border-border p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">کل هزینه</p>
                  <p className="text-2xl font-bold text-red-600">{faNum(totalExpenses)}</p>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-2xl border border-border p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${netProfit >= 0 ? "bg-green-100" : "bg-red-100"}`}>
                  <TrendingUp className={`w-5 h-5 ${netProfit >= 0 ? "text-green-600" : "text-red-600"}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">سود/زیان خالص</p>
                  <p className={`text-2xl font-bold ${netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>{faNum(netProfit)}</p>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-2xl border border-border p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">بودجه / خرج شده</p>
                  <p className="text-2xl font-bold">{faNum(project.budget || 0)} / {faNum(totalExpenses)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Manager & Members */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="bg-card rounded-2xl border border-border p-5">
              <h2 className="font-bold mb-4 flex items-center gap-2 text-sm">
                <UserCircle className="w-5 h-5 text-primary" /> مدیر پروژه
              </h2>
              {project.manager ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    {project.manager.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium">{project.manager}</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">مدیری تعیین نشده است</p>
              )}
            </div>

            <div className="bg-card rounded-2xl border border-border p-5">
              <h2 className="font-bold mb-4 flex items-center gap-2 text-sm">
                <Users className="w-5 h-5 text-primary" /> اعضا ({faNum(project.members?.length || 0)})
              </h2>
              {project.members?.length === 0 ? (
                <p className="text-sm text-muted-foreground">هیچ عضوی اضافه نشده</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {project.members.map((name, i) => (
                    <div key={i} className="flex items-center gap-2 bg-accent/50 px-3 py-1.5 rounded-lg">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm">{name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Dates */}
          {(project.start_date || project.end_date) && (
            <div className="bg-card rounded-2xl border border-border p-5 mt-4">
              <h2 className="font-bold mb-3 flex items-center gap-2 text-sm">
                <Flag className="w-5 h-5 text-primary" /> تاریخ‌ها
              </h2>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {project.start_date && (
                  <span className="flex items-center gap-1">
                    <span>شروع:</span>
                    <span className="font-medium">{project.start_date}</span>
                  </span>
                )}
                {project.end_date && (
                  <span className="flex items-center gap-1">
                    <span>پایان:</span>
                    <span className="font-medium">{project.end_date}</span>
                  </span>
                )}
              </div>
            </div>
          )}
          </> )}

      {activeTab === 'tasks' && (
        <div className="space-y-4">
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">تسکی برای این پروژه ثبت نشده</p>
          ) : (
            <div className="space-y-2">
              {tasks.map((t) => {
                const assigneeList = t.assignees || (t.assignee ? [t.assignee] : []);
                return (
                  <button key={t.id} type="button" onClick={() => setSelectedTask(t)} className="flex w-full items-center justify-between gap-3 rounded-xl border-b border-border px-3 py-3 text-right transition-colors last:border-0 hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.title}</p>
                      <div className="flex items-center gap-1 mt-1">
                        {assigneeList.map((name, i) => (
                          <div key={i} className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary border border-white" title={name}>
                            {name.charAt(0).toUpperCase()}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {t.priority && <span className={`text-xs px-2 py-0.5 rounded-full ${t.priority === 'high' ? 'bg-red-100 text-red-700' : t.priority === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{t.priority === 'high' ? 'زیاد' : t.priority === 'medium' ? 'متوسط' : 'کم'}</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${taskStatusColors[t.status] || taskStatusColors.todo}`}>
                        {taskStatusLabels[t.status] || taskStatusLabels.todo}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'files' && (
        <div className="space-y-3">
          {(project.files || []).length === 0 ? (
            <div className="text-center py-8">
              <File className="w-12 h-12 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-muted-foreground">هیچ فایلی آپلود نشده</p>
            </div>
          ) : (
            <div className="space-y-2">
              {project.files.map((f, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-card border border-border rounded-xl">
                  <div className="flex items-center gap-3 min-w-0">
                    <File className="w-8 h-8 text-primary" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{f.name}</p>
                      <p className="text-xs text-muted-foreground">آپلود شده توسط {f.uploaded_by} در {f.uploaded_at}</p>
                    </div>
                  </div>
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                    دانلود
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'updates' && (
        <div className="space-y-3">
          {(project.status_updates || []).length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-muted-foreground">هیچ به‌روزرسانی‌ای ثبت نشده</p>
            </div>
          ) : (
            <div className="space-y-3">
              {project.status_updates.map((u, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {(u.author || "؟").charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{u.author}</p>
                        <p className="text-xs text-muted-foreground">{u.date}</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{u.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'budget' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-card rounded-2xl border border-border p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">بودجه تعیین شده</p>
                  <p className="text-2xl font-bold">{faNum(project.budget || 0)}</p>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-2xl border border-border p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">خارج شده</p>
                  <p className="text-2xl font-bold text-red-600">{faNum(totalExpenses)}</p>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-2xl border border-border p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">باقی‌مانده</p>
                  <p className={`text-2xl font-bold ${(project.budget || 0) - totalExpenses >= 0 ? "text-green-600" : "text-red-600"}`}>{faNum((project.budget || 0) - totalExpenses)}</p>
                </div>
              </div>
            </div>
          </div>

          {project.budget > 0 && (
            <div className="bg-card rounded-2xl border border-border p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">استفاده از بودجه</span>
                <span className="text-sm font-medium">{faNum(project.budget > 0 ? Math.round((totalExpenses / project.budget) * 100) : 0)}٪</span>
              </div>
              <div className="h-3 bg-accent rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${project.budget > 0 ? Math.min(100, (totalExpenses / project.budget) * 100) : 0}%`, backgroundColor: totalExpenses > (project.budget || 0) ? "hsl(0 84% 60%)" : color }} />
              </div>
            </div>
          )}

          <div className="bg-card rounded-2xl border border-border p-5">
            <h3 className="font-bold mb-4 flex items-center gap-2 text-sm">
              <TrendingUp className="w-5 h-5 text-green-600" /> درآمدهای پروژه
            </h3>
            {incomes.length === 0 ? (
              <p className="text-sm text-muted-foreground">هیچ درآمدی ثبت نشده</p>
            ) : (
              <div className="space-y-2">
                {incomes.map((inc) => (
                  <div key={inc.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{inc.title}</p>
                      <p className="text-xs text-muted-foreground">{inc.date}</p>
                    </div>
                    <span className="text-sm font-bold text-green-600">+{faNum(inc.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-card rounded-2xl border border-border p-5">
            <h3 className="font-bold mb-4 flex items-center gap-2 text-sm">
              <TrendingDown className="w-5 h-5 text-red-600" /> هزینه‌های پروژه
            </h3>
            {expenses.length === 0 ? (
              <p className="text-sm text-muted-foreground">هیچ هزینه‌ای ثبت نشده</p>
            ) : (
              <div className="space-y-2">
                {expenses.map((exp) => (
                  <div key={exp.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{exp.title}</p>
                      <p className="text-xs text-muted-foreground">{exp.date} • {exp.category}</p>
                    </div>
                    <span className="text-sm font-bold text-red-600">−{faNum(exp.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {selectedTask && <TaskDetail
        task={selectedTask}
        projects={[project]}
        onClose={() => setSelectedTask(null)}
        onSaved={async () => {
          const updatedTasks = await base44.entities.Task.list();
          setTasks((updatedTasks || []).filter((task) => String(task.project_id) === String(id)));
        }}
      />}

      {/* Completion Checklist */}
      <div className="bg-card rounded-2xl border border-border p-5 mt-4">
        <h2 className="font-bold mb-4 flex items-center gap-2 text-sm">
          <CheckSquare className="w-5 h-5 text-primary" /> چک‌لیست تکمیل پروژه
        </h2>
        {(project.completion_checklist || []).length === 0 ? (
          <p className="text-sm text-muted-foreground">چک‌لیستی تعریف نشده</p>
        ) : (
          <div className="space-y-2">
            {project.completion_checklist.map((item, i) => (
              <label key={i} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() => {
                    const updated = [...(project.completion_checklist || [])];
                    updated[i] = { ...updated[i], done: !updated[i].done };
                    base44.entities.Project.update(project.id, { completion_checklist: updated });
                    setProject({ ...project, completion_checklist: updated });
                  }}
                  className="w-4 h-4 accent-primary"
                />
                <span className={`${item.done ? "line-through text-muted-foreground" : "text-foreground"}`}>{item.text}</span>
              </label>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
