import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { studio } from "@/api/studioClient";
import { useAuth } from "@/lib/AuthContext";
import { useDeleteUndo } from "@/hooks/useDeleteUndo.jsx";
import { Plus, User, Mail, Phone, Search, Users, ShieldCheck, Upload, FolderOpen, Network, UserMinus, IdCard } from "lucide-react";
import { roleLabel, roleColor } from "@/lib/roles";
import EmployeeForm from "@/components/EmployeeForm";
import EmployeeProfile, { availabilityColor, availabilityLabel } from "@/components/EmployeeProfile";
import ConfirmDialog from "@/components/ConfirmDialog";
import { inviteUser } from "@/lib/invite";
import { toast } from "@/components/ui/use-toast";
import { formatPersianNumber as faNum } from "@/lib/number-format";

const roleFilterOptions = [
  { value: "", label: "همه اعضا" },
  { value: "superadmin", label: "مدیرعامل" },
  { value: "admin", label: "مدیر" },
  { value: "user", label: "پرسنل" },
];

export default function Employees() {
  const { isAdmin } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [roleFilter, setRoleFilter] = useState("");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [profileFor, setProfileFor] = useState(null);
  const [groupByDept, setGroupByDept] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showOrgChart, setShowOrgChart] = useState(false);
  const [offboardFor, setOffboardFor] = useState(null);
  const [reassignTo, setReassignTo] = useState("");

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      // Directory = auth user store (User) merged with Employee extra profile records by email.
      const [users, employeeRecords, taskList] = await Promise.all([
        studio.entities.User.list(),
        studio.entities.Employee.list().catch(() => []),
        studio.entities.Task.list().catch(() => []),
      ]);
      const byEmail = new Map();
      employeeRecords.forEach((e) => { if (e.email) byEmail.set(String(e.email).toLowerCase(), e); });
      const merged = users.map((u) => {
        const extra = byEmail.get(String(u.email || "").toLowerCase()) || {};
        return {
          id: u.id,
          name: u.full_name || u.email || "",
          email: u.email || "",
          role: u.role || "user",
          phone: u.phone || extra.phone || "",
          profile_image: u.profile_image || extra.profile_image || "",
          department: u.department || extra.department || "",
          position: u.position || extra.position || "",
          hire_date: u.hire_date || extra.hire_date || "",
          skills: u.skills || extra.skills || [],
          bio: u.bio || extra.bio || "",
          availability_status: u.availability_status || "available",
          is_active: u.is_active !== false,
        };
      });
      setEmployees(merged);
      setTasks(taskList);
    } catch (err) {
      console.error("Failed to load directory:", err);
      setEmployees([]);
    }
    setLoading(false);
  };

  const { deleteWithUndo } = useDeleteUndo("User", (id) => studio.entities.User.delete(id), load);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      if (e.is_active === false) return false;
      if (roleFilter && e.role !== roleFilter) return false;
      if (q) {
        const haystack = `${e.name} ${e.email} ${e.phone} ${e.department} ${e.position} ${(e.skills || []).join(" ")}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [employees, roleFilter, search]);

  const byDepartment = useMemo(() => {
    const map = {};
    filtered.forEach((e) => {
      const dept = e.department || "بدون دپارتمان";
      (map[dept] = map[dept] || []).push(e);
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const statCounts = {
    total: employees.filter((e) => e.is_active !== false).length,
    superadmin: employees.filter((e) => e.role === "superadmin").length,
    admin: employees.filter((e) => e.role === "admin").length,
    user: employees.filter((e) => e.role === "user").length,
  };

  const handleDelete = async (id) => {
    const employee = employees.find(e => e.id === id);
    if (employee) setDeleteTarget(employee);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteWithUndo(deleteTarget);
    load();
    setDeleteTarget(null);
  };

  // ----- Bulk CSV Import (admin) -----
  const handleCsvUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    const headers = lines[0].toLowerCase().split(",").map((h) => h.trim());
    const need = ["name", "email"];
    if (!need.every((n) => headers.includes(n))) {
      toast({ title: "فرمت CSV نامعتبر", description: "ستون‌های name و email الزامی هستند.", variant: "destructive" });
      return;
    }
    let ok = 0, fail = 0;
    for (let i = 1; i < lines.length; i++) {
      const row = {};
      lines[i].split(",").forEach((cell, idx) => { row[headers[idx]] = cell.trim(); });
      if (!row.email) { fail++; continue; }
      try {
        const full_name = row.name || ""; // ready for name column
        await inviteUser({
          userEmail: row.email,
          role: ["superadmin", "admin", "user"].includes(row.role) ? row.role : "user",
          full_name,
          phone: row.phone || "",
          initial_password: row.password || "",
        });
        // Optionally set department/position via a follow-up update on the new user is
        // not possible here without id; store them for now via Employee entity by creating
        // an employee record keyed by email (fields live on Employee too).
        try {
          await studio.entities.Employee.create({
            name: full_name || row.email,
            email: row.email,
            department: row.department || "",
            position: row.position || "",
            phone: row.phone || "",
          });
        } catch { /* employee record optional */ }
        ok++;
      } catch { fail++; }
    }
    toast({
      title: "درون‌ریزی کامل شد",
      description: `${ok} عضو اضافه شد${fail > 0 ? `، ${fail} ناموفق` : ""}.`,
    });
    setShowImport(false);
    e.target.value = "";
    load();
  };

  // ----- Offboarding (admin): deactivate + task reassignment checklist -----
  const openOffboard = (emp) => {
    setOffboardFor(emp);
    setReassignTo("");
  };
  const offboardTasks = offboardFor
    ? tasks.filter((t) => {
        const assignees = t.assignees || (t.assignee ? [t.assignee] : []);
        return assignees.includes(offboardFor.name) && t.status !== "done";
      })
    : [];

  const confirmOffboard = async () => {
    if (!offboardFor) return;
    try {
      if (reassignTo && offboardTasks.length > 0) {
        for (const t of offboardTasks) {
          const assignees = t.assignees || (t.assignee ? [t.assignee] : []);
          const next = assignees.filter((a) => a !== offboardFor.name);
          next.push(reassignTo);
          await studio.entities.Task.update(t.id, { assignees: next });
        }
      }
      const res = await fetch(`/api/apps/${(await import("@/api/studioClient")).appId}/entities/User/${offboardFor.id}/deactivate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("studio_access_token")}`,
        },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "غیرفعال‌سازی ناموفق");
      }
      toast({ title: "خروج از سازمان ثبت شد", description: `${offboardFor.name} غیرفعال شد و تسک‌ها دوباره تخصیص یافت.` });
    } catch (err) {
      toast({ title: "خطا", description: err.message, variant: "destructive" });
    }
    setOffboardFor(null);
    load();
  };

  const getInitial = (name) => (name || "؟").charAt(0);

  const staffForReassign = employees.filter((e) => e.id !== offboardFor?.id && e.is_active !== false);

  if (loading)
    return (
      <div className="flex justify-center p-20">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );

  const deptColors = ["bg-primary/10 text-primary", "bg-emerald-100 text-emerald-700", "bg-blue-100 text-blue-700", "bg-amber-100 text-amber-700", "bg-purple-100 text-purple-700"];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" /> اعضا و کارکنان
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">فهرست اعضای تیم، دپارتمان‌ها و وضعیت حضور</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowImport(true)}
              className="border border-input px-5 py-2.5 rounded-xl font-medium text-sm text-muted-foreground hover:text-primary hover:border-primary/40 flex items-center gap-2 transition-colors bg-card"
            >
              <Upload className="w-4 h-4" /> درون‌ریزی CSV
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:opacity-90 transition-opacity"
            >
              <Plus className="w-5 h-5" /> افزودن عضو
            </button>
          </div>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "کل اعضا", value: statCounts.total, color: "bg-primary/10 text-primary" },
          { label: "مدیرعامل", value: statCounts.superadmin, color: "bg-purple-100 text-purple-700" },
          { label: "مدیران", value: statCounts.admin, color: "bg-blue-100 text-blue-700" },
          { label: "پرسنل", value: statCounts.user, color: "bg-emerald-100 text-emerald-700" },
        ].map((s) => (
          <div key={s.label} className="bg-card rounded-2xl border border-border p-4">
            <div className={`inline-flex items-center gap-2 text-xs font-medium px-2.5 py-1 rounded-full ${s.color}`}>
              {s.label}
            </div>
            <p className="text-2xl font-bold mt-2">{faNum(s.value)}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو در نام، ایمیل، دپارتمان، سمت یا مهارت..."
            className="w-full border border-input rounded-xl pr-9 pl-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {roleFilterOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          onClick={() => setGroupByDept(!groupByDept)}
          className={`border rounded-xl px-4 py-2.5 text-sm font-medium flex items-center gap-2 transition-colors ${groupByDept ? "border-primary bg-primary/5 text-primary" : "border-input text-muted-foreground hover:text-primary bg-card"}`}
        >
          <FolderOpen className="w-4 h-4" /> گروه بندی بر اساس دپارتمان
        </button>
        <button
          onClick={() => setShowOrgChart(!showOrgChart)}
          className={`border rounded-xl px-4 py-2.5 text-sm font-medium flex items-center gap-2 transition-colors ${showOrgChart ? "border-primary bg-primary/5 text-primary" : "border-input text-muted-foreground hover:text-primary bg-card"}`}
        >
          <Network className="w-4 h-4" /> نمودار سازمانی
        </button>
      </div>

      {/* Org chart placeholder */}
      {showOrgChart && (
        <div className="bg-card rounded-2xl border border-border p-6">
          <h2 className="font-bold text-lg mb-5 flex items-center gap-2">
            <Network className="w-5 h-5 text-primary" /> نمودار سازمانی
          </h2>
          <div className="text-center">
            <div className="inline-block bg-purple-100 text-purple-700 rounded-xl px-5 py-2.5 font-bold text-sm">
              {roleLabel("superadmin")} — {(employees.filter((e) => e.role === "superadmin").map((e) => e.name).join("، ")) || "—"}
            </div>
          </div>
          <div className="mx-auto w-px h-5 bg-border" />
          <div className="flex flex-wrap justify-center gap-3">
            {employees.filter((e) => e.role === "admin").map((e) => (
              <div key={e.id} className="bg-primary/10 text-primary rounded-xl px-4 py-2 font-medium text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" /> {e.name}
              </div>
            ))}
            {employees.filter((e) => e.role === "admin").length === 0 && (
              <span className="text-sm text-muted-foreground">مدیری ثبت نشده است</span>
            )}
          </div>
          <div className="mx-auto w-px h-5 bg-border" />
          <div className="flex flex-wrap justify-center gap-2">
            {employees.filter((e) => e.role === "user").map((e) => (
              <span key={e.id} className="bg-accent text-muted-foreground rounded-lg px-3 py-1.5 text-xs">{e.name}</span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4 text-center">سلسله‌مراتب مدیرعامل ← مدیران ← پرسنل</p>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-12 text-center">
          <User className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">عضو یا کارمندی یافت نشد</p>
        </div>
      ) : !groupByDept ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((e) => (
            <EmployeeCard
              key={e.id}
              e={e}
              getInitial={getInitial}
              isAdmin={isAdmin}
              onProfile={() => setProfileFor(e)}
              onDelete={() => handleDelete(e.id)}
              onOffboard={() => openOffboard(e)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {byDepartment.map(([dept, list], di) => (
            <div key={dept}>
              <h2 className="font-bold mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                <FolderOpen className={`w-4 h-4 ${deptColors[di % deptColors.length]}`} /> {dept}
                <span className="text-xs bg-accent text-muted-foreground px-2 py-0.5 rounded-full">{faNum(list.length)}</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {list.map((e) => (
                  <EmployeeCard
                    key={e.id}
                    e={e}
                    getInitial={getInitial}
                    isAdmin={isAdmin}
                    onProfile={() => setProfileFor(e)}
                    onDelete={() => handleDelete(e.id)}
                    onOffboard={() => openOffboard(e)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {isAdmin && (
        <p className="text-xs text-muted-foreground text-center">
          مدیریت نقش‌ها و دعوت اعضا از طریق{" "}
          <Link to="/admin" className="text-primary hover:underline">پنل ادمین</Link> انجام می‌شود.
        </p>
      )}

      {showForm && <EmployeeForm onClose={() => setShowForm(false)} onSaved={load} />}
      {profileFor && (
        <EmployeeProfile
          employee={profileFor}
          canEdit={isAdmin}
          onClose={() => setProfileFor(null)}
          onSaved={load}
        />
      )}

      {/* Bulk import modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowImport(false)}>
          <div className="bg-card rounded-2xl w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-lg mb-3 flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" /> درون‌ریزی اعضا از CSV
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              ستون‌های الزامی: <code className="bg-accent px-1.5 py-0.5 rounded text-xs">name</code> و{" "}
              <code className="bg-accent px-1.5 py-0.5 rounded text-xs">email</code>. اختیاری:{" "}
              <code className="bg-accent px-1.5 py-0.5 rounded text-xs">role, department, position, phone, password</code>.
            </p>
            <label className="block border border-dashed border-input rounded-xl px-4 py-6 text-center text-sm text-muted-foreground cursor-pointer hover:bg-accent/30 flex items-center justify-center gap-2">
              <Upload className="w-4 h-4" /> انتخاب فایل CSV
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvUpload} />
            </label>
          </div>
        </div>
      )}

      {/* Offboarding modal */}
      {offboardFor && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setOffboardFor(null)}>
          <div className="bg-card rounded-2xl w-full max-w-md p-6 shadow-xl max-h-[90vh] overflow-y-auto scrollbar-thin" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              <UserMinus className="w-5 h-5 text-red-500" /> خروج از سازمان
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              <span className="font-medium text-foreground">{offboardFor.name}</span> غیرفعال می‌شود و دیگر نمی‌تواند وارد شود.
            </p>
            <div className="bg-accent/40 rounded-xl p-3 mb-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">تسک‌های باز ({faNum(offboardTasks.length)}):</p>
              {offboardTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground">تسک باز ندارد ✓</p>
              ) : (
                <div className="space-y-1 max-h-28 overflow-y-auto scrollbar-thin">
                  {offboardTasks.slice(0, 8).map((t) => <p key={t.id} className="text-xs truncate">• {t.title}</p>)}
                  {offboardTasks.length > 8 && <p className="text-xs text-muted-foreground">+{faNum(offboardTasks.length - 8)} تسک دیگر</p>}
                </div>
              )}
            </div>
            {offboardTasks.length > 0 && (
              <div className="mb-4">
                <label className="text-sm font-medium block mb-1.5">تخصیص مجدد تسک‌ها به</label>
                <select
                  value={reassignTo}
                  onChange={(e) => setReassignTo(e.target.value)}
                  className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">بدون تخصیص مجدد</option>
                  {staffForReassign.map((x) => (
                    <option key={x.id} value={x.name}>{x.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={confirmOffboard} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-medium hover:opacity-90 transition-opacity">
                تایید خروج
              </button>
              <button onClick={() => setOffboardFor(null)} className="px-4 py-3 text-sm text-muted-foreground border border-border rounded-xl hover:bg-accent">
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="حذف عضو"
          description={`آیا از حذف "${deleteTarget.name}" مطمئن هستید؟ این کار قابل بازگشت نیست.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
          confirmText="بله، حذف شود"
        />
      )}
    </div>
  );
}

function EmployeeCard({ e, getInitial, isAdmin, onProfile, onDelete, onOffboard }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <button onClick={onProfile} className="flex items-center gap-3 min-w-0 text-right">
          <div className="relative w-12 h-12 rounded-full shrink-0">
            {e.profile_image ? (
              <img src={e.profile_image} alt={e.name} className="w-12 h-12 rounded-full object-cover" onError={(ev) => { ev.target.style.display = "none"; }} />
            ) : (
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-primary font-bold text-lg">{getInitial(e.name)}</span>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm truncate">{e.name}</p>
            <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 font-medium ${roleColor(e.role)}`}>
              {e.role === "superadmin" && <ShieldCheck className="w-3 h-3 inline -mt-0.5 ml-1" />}
              {roleLabel(e.role)}
            </span>
          </div>
        </button>
        <span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${availabilityColor(e.availability_status)}`}>
          {availabilityLabel(e.availability_status)}
        </span>
      </div>
      <div className="space-y-1.5 mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
        {e.email ? (
          <p className="flex items-center gap-2 truncate"><Mail className="w-3.5 h-3.5 shrink-0" /> <span className="truncate" dir="ltr">{e.email}</span></p>
        ) : (
          <p className="text-muted-foreground">—</p>
        )}
        {e.phone && <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 shrink-0" /> <span dir="ltr">{e.phone}</span></p>}
        {e.department && <p className="flex items-center gap-2"><FolderOpen className="w-3.5 h-3.5 shrink-0" /> {e.department}{e.position ? ` • ${e.position}` : ""}</p>}
        {(e.skills || []).length > 0 && (
          <p className="flex items-center gap-2"><IdCard className="w-3.5 h-3.5 shrink-0" /> {(e.skills || []).slice(0, 3).join("، ")}{e.skills.length > 3 ? "..." : ""}</p>
        )}
      </div>
      {isAdmin && (
        <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border">
          <button onClick={onProfile} className="text-xs text-primary px-2 py-1 rounded-lg hover:bg-primary/10 flex items-center gap-1">
            پروفایل
          </button>
          {e.role !== "superadmin" && (
            <button onClick={onOffboard} className="text-xs text-red-500 px-2 py-1 rounded-lg hover:bg-destructive/10 flex items-center gap-1 mr-auto">
              <UserMinus className="w-3 h-3" /> خروج
            </button>
          )}
          <button onClick={onDelete} className="text-xs text-muted-foreground hover:text-red-500 px-2 py-1 rounded-lg flex items-center gap-1">
            حذف
          </button>
        </div>
      )}
    </div>
  );
}
