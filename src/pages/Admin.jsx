import { useEffect, useState } from "react";
import { studio } from "@/api/studioClient";
import { useAuth } from "@/lib/AuthContext";
import { Shield, UserPlus, Mail, Users, TrendingUp, TrendingDown, LogOut, RotateCcw, Key, Activity, ShieldCheck, UserX, Upload, Plus, Trash2, FileSpreadsheet } from "lucide-react";
import { roleLabel, roleColor } from "@/lib/roles";
import ConfirmDialog from "@/components/ConfirmDialog";
import { appId } from "@/api/studioClient";
import EmployeeForm from "@/components/EmployeeForm";
import EmployeeProfile from "@/components/EmployeeProfile";
import { MODULES } from "@/lib/permissions";
import { useDeleteUndo } from "@/hooks/useDeleteUndo.jsx";
import { formatPersianNumber as formatFaNum } from "@/lib/number-format";
import { buildUsersWorkbook, buildTasksWorkbook, buildExpensesWorkbook, downloadWorkbook } from "@/lib/excelExport";

const faNum = (n) => Number(n || 0).toLocaleString("fa-IR");

export default function Admin() {
  const { user, isSuperadmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");
  const [showSessions, setShowSessions] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState("");
  const [sendingDigest, setSendingDigest] = useState(false);
  const [digestMsg, setDigestMsg] = useState("");
  const [showUserForm, setShowUserForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [profileFor, setProfileFor] = useState(null);

  // ConfirmDialog states
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [forceLogoutTarget, setForceLogoutTarget] = useState(null);
  const [resetPasswordTarget, setResetPasswordTarget] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    const [u, e, i] = await Promise.all([
      studio.entities.User.list(),
      studio.entities.Expense.list(),
      studio.entities.Income.list(),
    ]);
    setUsers(u);
    setExpenses(e);
    setIncomes(i);
    if (!silent) setLoading(false);
  };

  const { deleteWithUndo } = useDeleteUndo(
    "User",
    (id) => studio.entities.User.delete(id),
    load
  );

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    await deleteWithUndo({ id: target.id, name: target.full_name || target.email });
  };

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    setInviteMsg("");
    try {
      await studio.users.inviteUser(inviteEmail, inviteRole);
      setInviteMsg("دعوت‌نامه با موفقیت ارسال شد");
      setInviteEmail("");
      load();
    } catch (err) {
      setInviteMsg(err.message || "ارسال دعوت‌نامه ناموفق بود");
    }
    setInviting(false);
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const updateData = { role: newRole };
      if (newRole === "admin") {
        updateData.module_access = MODULES.map((m) => m.id);
      }
      await studio.entities.User.update(userId, updateData);
      load();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeactivate = async (targetUser) => {
    try {
      // Call the deactivate endpoint
      const res = await fetch(`/api/apps/${appId}/entities/User/${targetUser.id}/deactivate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("studio_access_token")}`,
        },
      });
      if (res.ok) {
        load();
      } else {
        const data = await res.json();
        alert(data.message || "خطا در غیرفعال کردن");
      }
    } catch (err) {
      console.error(err);
      alert("خطا در ارتباط با سرور");
    }
    setDeactivateTarget(null);
  };

  const handleForceLogout = async (targetUser) => {
    try {
      await studio.entities.User.update(targetUser.id, { force_logout: true });
      load();
    } catch (err) {
      console.error(err);
    }
    setForceLogoutTarget(null);
  };

  const handleResetPassword = async (targetUser) => {
    try {
      await studio.auth.resetPasswordRequest(targetUser.email);
      alert("لینک بازیابی رمز برای " + targetUser.email + " ارسال شد");
    } catch (err) {
      console.error(err);
      alert("خطا در ارسال لینک بازیابی");
    }
    setResetPasswordTarget(null);
  };

  const handleRestoreUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoring(true);
    setRestoreMsg("");
    try {
      const token = localStorage.getItem("studio_access_token");
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/apps/${appId}/restore`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        setRestoreMsg("✅ بکاپ با موفقیت بازیابی شد. صفحه رفرش می‌شود...");
        setTimeout(() => window.location.reload(), 1500);
      } else {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "بازیابی ناموفق");
      }
    } catch (err) {
      setRestoreMsg(err.message);
    }
    setRestoring(false);
  };

  const handleSendDigest = async () => {
    setSendingDigest(true);
    setDigestMsg("");
    try {
      const token = localStorage.getItem("studio_access_token");
      const res = await fetch(`/api/apps/${appId}/announcement/digest`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setDigestMsg(`✅ ارسال شد — ${formatFaNum(data.sent)} گیرنده، ${formatFaNum(data.count)} اعلامیه`);
    } catch {
      setDigestMsg("❌ ارسال ناموفق بود");
    }
    setSendingDigest(false);
  };

  const exportJsonBackup = async () => {
    try {
      setRestoreMsg("در حال آماده‌سازی فایل بکاپ...");
      const token = localStorage.getItem("studio_access_token");
      const response = await fetch(`/api/apps/${appId}/backup`, {
        headers: { Authorization: ["Bearer ", token].join("") },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "دریافت بکاپ ناموفق بود");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const aElem = document.createElement("a");
      aElem.href = url;
      aElem.download = `flowsee-backup-${new Date().toISOString().slice(0, 10)}.json`;
      aElem.style.display = "none";
      document.body.appendChild(aElem);
      aElem.click();
      aElem.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setRestoreMsg("✅ فایل بکاپ با موفقیت دانلود شد.");
    } catch (err) {
      setRestoreMsg("❌ خطا در ساخت بکاپ: " + err.message);
    }
  };

  const exportUsersExcel = async () => {
    try {
      setRestoreMsg("در حال دریافت اطلاعات و آماده‌سازی فایل اکسل کاربران...");
      const userList = await studio.entities.User.list().catch(() => users);
      const wb = buildUsersWorkbook(userList);
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadWorkbook(wb, `flowsee-users-${dateStr}.xlsx`);
      setRestoreMsg("✅ فایل اکسل کاربران با موفقیت دانلود شد.");
    } catch (err) {
      setRestoreMsg("❌ خطا در خروجی اکسل کاربران: " + err.message);
    }
  };

  const exportTasksExcel = async () => {
    try {
      setRestoreMsg("در حال دریافت اطلاعات و آماده‌سازی فایل اکسل تسک‌ها...");
      const [taskList, projectList] = await Promise.all([
        studio.entities.Task.list("-created_date").catch(() => []),
        studio.entities.Project.list().catch(() => []),
      ]);
      const wb = buildTasksWorkbook(taskList, projectList);
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadWorkbook(wb, `flowsee-tasks-${dateStr}.xlsx`);
      setRestoreMsg("✅ فایل اکسل تسک‌ها با موفقیت دانلود شد.");
    } catch (err) {
      setRestoreMsg("❌ خطا در خروجی اکسل تسک‌ها: " + err.message);
    }
  };

  const exportExpensesExcel = async () => {
    try {
      setRestoreMsg("در حال دریافت اطلاعات و آماده‌سازی فایل اکسل هزینه‌ها...");
      const [expList, projectList] = await Promise.all([
        studio.entities.Expense.list("-date").catch(() => expenses),
        studio.entities.Project.list().catch(() => []),
      ]);
      const wb = buildExpensesWorkbook(expList, projectList);
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadWorkbook(wb, `flowsee-expenses-${dateStr}.xlsx`);
      setRestoreMsg("✅ فایل اکسل هزینه‌ها با موفقیت دانلود شد.");
    } catch (err) {
      setRestoreMsg("❌ خطا در خروجی اکسل هزینه‌ها: " + err.message);
    }
  };

  const totalExpense = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalIncome = incomes.reduce((s, i) => s + (i.amount || 0), 0);

  if (loading)
    return (
      <div className="flex justify-center p-20">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" /> پنل ادمین
          </h1>
          <p className="text-muted-foreground mt-1">مدیریت حساب، کاربران و تنظیمات</p>
        </div>
        <button onClick={() => setShowUserForm(true)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> ساخت کاربر
        </button>
      </div>

      {/* Profile */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <h2 className="font-bold text-lg mb-4">حساب من</h2>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl">
            {(user?.full_name || user?.email || "؟").charAt(0)}
          </div>
          <div>
            <p className="font-bold text-lg">{user?.full_name || "مدیر"}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <span className="inline-block text-xs bg-primary/10 text-primary px-3 py-1 rounded-full mt-2">
              {isSuperadmin ? "مدیرعامل (CEO)" : "مدیر کل"}
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card rounded-2xl border border-border p-5">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mb-3">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-sm text-muted-foreground">کل کاربران</p>
          <p className="text-2xl font-bold mt-1">{faNum(users.length)}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-5">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center mb-3">
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-sm text-muted-foreground">کل درآمد</p>
          <p className="text-2xl font-bold mt-1">{faNum(totalIncome)}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-5">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center mb-3">
            <TrendingDown className="w-5 h-5 text-red-600" />
          </div>
          <p className="text-sm text-muted-foreground">کل هزینه</p>
          <p className="text-2xl font-bold mt-1">{faNum(totalExpense)}</p>
        </div>
      </div>

      {/* Invite user */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-primary" /> دعوت پرسنل جدید
        </h2>
        <p className="text-sm text-muted-foreground mb-4">برای اضافه کردن پرسنل، ایمیل او را وارد کنید. دعوت‌نامه برایش ارسال می‌شود.</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Mail className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="email@example.com"
              className="w-full border border-input rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="user">پرسنل</option>
            <option value="admin">مدیر</option>
            <option value="superadmin">مدیرعامل</option>
          </select>
          <button
            onClick={handleInvite}
            disabled={inviting || !inviteEmail}
            className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 whitespace-nowrap"
          >
            {inviting ? "در حال ارسال..." : "ارسال دعوت‌نامه"}
          </button>
        </div>
        {inviteMsg && (
          <p className={`text-sm mt-3 ${inviteMsg.includes("موفق") ? "text-green-600" : "text-red-500"}`}>{inviteMsg}</p>
        )}
      </div>

      {/* Active Sessions */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" /> جلسات فعال
          </h2>
          <button
            onClick={() => setShowSessions(!showSessions)}
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            {showSessions ? "مخفی کردن" : "نمایش"} جلسات
          </button>
        </div>
        {showSessions && (
          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-4 text-sm font-medium text-muted-foreground border-b border-border pb-2">
              <span>کاربر</span>
              <span>ورود</span>
              <span>آی‌پی / دستگاه</span>
              <span>عملیات</span>
            </div>
            {users.filter(u => u.id !== user?.id).map((u) => (
              <div key={u.id} className="grid grid-cols-4 gap-4 text-sm items-center py-2 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    {(u.full_name || u.email || "؟").charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium">{u.full_name || "بدون نام"}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                </div>
                <span className="text-muted-foreground">{u.last_login ? new Date(u.last_login).toLocaleString("fa-IR") : "—"}</span>
                <span className="text-muted-foreground">{u.device_info || "—"}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setForceLogoutTarget(u)}
                    className="text-xs text-red-500 hover:underline flex items-center gap-1"
                  >
                    <LogOut className="w-3.5 h-3.5" /> خروج اجباری
                  </button>
                </div>
              </div>
            ))}
            {users.filter(u => u.id !== user?.id).length === 0 && (
              <p className="text-center text-muted-foreground py-4">سایر کاربران جلسه فعالی ندارند</p>
            )}
          </div>
        )}
      </div>

      {/* User list */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="p-6 pb-4">
          <div>
            <h2 className="font-bold text-lg">کاربران</h2>
            <p className="mt-1 text-xs text-muted-foreground">ساخت حساب، تغییر نقش و مدیریت دسترسی ورود کاربران</p>
          </div>
        </div>
        <div className="divide-y divide-border">
          {users.map((u) => {
            const isSelf = u.id === user?.id;
            const isSuper = u.role === "superadmin";
            const canDeactivate = !isSelf && !isSuper && (u.is_active !== false);
            const canDelete = !isSelf && !isSuper && (u.role !== "admin" || isSuperadmin);
            const isDeactivated = u.is_active === false;

            return (
              <div key={u.id} className={`flex items-center justify-between gap-3 p-4 hover:bg-accent/30 ${isDeactivated ? "opacity-50 bg-muted/30" : ""}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                    {(u.full_name || u.email || "؟").charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{u.full_name || "بدون نام"}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${roleColor(u.role)}`}>
                        {isSuper && <ShieldCheck className="w-3 h-3 inline -mt-0.5 ml-1" />}
                        {roleLabel(u.role)}
                      </span>
                      {isDeactivated && (
                        <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                          غیرفعال
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                  {/* Role dropdown - only for non-superadmin, non-self */}
                  {!isSelf && !isSuper && (
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      className="border border-input rounded-xl px-2 py-1.5 text-xs bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 shrink-0"
                    >
                      <option value="user">پرسنل</option>
                      <option value="admin">مدیر</option>
                    </select>
                  )}
                  {isSuper && isSelf && (
                    <span className="text-xs text-primary font-medium bg-primary/10 px-2 py-1 rounded-full">
                      محافظت شده
                    </span>
                  )}

                  {/* Deactivate button */}
                  {canDeactivate && (
                    <button
                      onClick={() => setDeactivateTarget(u)}
                      className="text-xs text-red-500 hover:underline flex items-center gap-1"
                    >
                      <UserX className="w-3.5 h-3.5" /> غیرفعال
                    </button>
                  )}

                  {canDelete && (
                    <button
                      onClick={() => setDeleteTarget(u)}
                      className="text-xs text-red-600 hover:underline flex items-center gap-1"
                      title="حذف کاربر"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> حذف
                    </button>
                  )}

                  {/* Reset password button - for all except self */}
                  {!isSelf && (
                    <button
                      onClick={() => setResetPasswordTarget(u)}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <Key className="w-3.5 h-3.5" /> بازنشانی رمز
                    </button>
                  )}

                  {/* Permissions button */}
                  <button
                    onClick={() => setProfileFor({
                      ...u,
                      name: u.full_name || u.email,
                      module_access: u.module_access,
                    })}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                    title="مدیریت دسترسی‌ها و پروفایل"
                  >
                    <Shield className="w-3.5 h-3.5" /> دسترسی‌ها
                  </button>

                  {/* Force logout button - for all except self */}
                  {!isSelf && (
                    <button
                      onClick={() => setForceLogoutTarget(u)}
                      className="text-xs text-orange-500 hover:underline flex items-center gap-1"
                    >
                      <LogOut className="w-3.5 h-3.5" /> خروج
                    </button>
                  )}
                </div>

                {/* ConfirmDialogs */}
                {deactivateTarget?.id === u.id && (
                  <ConfirmDialog
                    title="غیرفعال کردن کاربر"
                    description={`${u.full_name || u.email} دیگر نمی‌تواند وارد شود. آیا مطمئن هستید؟`}
                    onConfirm={() => handleDeactivate(u)}
                    onCancel={() => setDeactivateTarget(null)}
                    confirmText="بله، غیرفعال شود"
                  />
                )}
                {deleteTarget?.id === u.id && (
                  <ConfirmDialog
                    title="حذف کاربر"
                    description={`حساب ${u.full_name || u.email} حذف و امکان ورودش مسدود می‌شود. اطلاعات به‌صورت موقت نگه داشته می‌شود و تا ۵ ثانیه امکان بازگردانی دارید.`}
                    onConfirm={handleDeleteUser}
                    onCancel={() => setDeleteTarget(null)}
                    confirmText="حذف کاربر"
                  />
                )}
                {forceLogoutTarget?.id === u.id && (
                  <ConfirmDialog
                    title="خروج اجباری"
                    description={`${u.full_name || u.email} بلافاصله خارج می‌شود و باید دوباره وارد شود.`}
                    onConfirm={() => handleForceLogout(u)}
                    onCancel={() => setForceLogoutTarget(null)}
                    confirmText="بله، خارج شود"
                    variant="destructive"
                  />
                )}
                {resetPasswordTarget?.id === u.id && (
                  <ConfirmDialog
                    title="بازنشانی رمز عبور"
                    description={`لینک بازیابی رمز برای ${u.email} ارسال می‌شود.`}
                    onConfirm={() => handleResetPassword(u)}
                    onCancel={() => setResetPasswordTarget(null)}
                    confirmText="ارسال لینک"
                    variant="default"
                  />
                )}
              </div>
            );
          })}
          {users.length === 0 && <p className="text-center text-muted-foreground py-8">کاربری یافت نشد</p>}
        </div>
      </div>

      {showUserForm && (
        <EmployeeForm
          isSuperadmin={isSuperadmin}
          onClose={() => setShowUserForm(false)}
          onSaved={() => load({ silent: true })}
        />
      )}

      {/* Backup/Restore */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
          <RotateCcw className="w-5 h-5 text-primary" /> پشتیبان‌گیری و بازیابی
        </h2>
        <p className="text-sm text-muted-foreground mb-4">دانلود یا بازیابی داده‌های برنامه؛ حساب‌های کاربری و رمزها بازیابی نمی‌شوند (فقط برای مدیرعامل)</p>
        <div className="flex gap-3 flex-wrap">
          <button
            type="button"
            onClick={exportJsonBackup}
            className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-medium hover:opacity-90 transition-opacity flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <RotateCcw className="w-5 h-5" /> دانلود بکاپ JSON
          </button>
          <button
            type="button"
            onClick={exportUsersExcel}
            className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-medium hover:opacity-90 transition-opacity flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <FileSpreadsheet className="w-5 h-5" /> اکسپورت کاربران (Excel)
          </button>
          <button
            type="button"
            onClick={exportTasksExcel}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-medium hover:opacity-90 transition-opacity flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <FileSpreadsheet className="w-5 h-5" /> اکسپورت تسک‌ها (Excel)
          </button>
          <button
            type="button"
            onClick={exportExpensesExcel}
            className="bg-amber-600 text-white px-5 py-2.5 rounded-xl font-medium hover:opacity-90 transition-opacity flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <FileSpreadsheet className="w-5 h-5" /> اکسپورت هزینه‌ها (Excel)
          </button>
        </div>
      </div>

      {/* Restore */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Upload className="w-5 h-5 text-primary" /> بازیابی از بکاپ
        </h2>
        <p className="text-sm text-muted-foreground mb-4">فایل JSON بکاپ را انتخاب کنید. این عملیات داده‌های موجود را جایگزین می‌کند (فقط مدیرعامل).</p>
        <label className="block border border-dashed border-input rounded-xl px-4 py-6 text-center text-sm text-muted-foreground cursor-pointer hover:bg-accent/30 flex items-center justify-center gap-2">
          <Upload className="w-4 h-4" /> انتخاب فایل بکاپ
          <input type="file" accept=".json,application/json" className="hidden" onChange={handleRestoreUpload} disabled={restoring} />
        </label>
        {restoreMsg && (
          <p className={`text-sm mt-3 ${restoreMsg.startsWith("✅") ? "text-green-600" : "text-red-500"}`}>{restoreMsg}</p>
        )}
      </div>

      {/* Announcement Email Digest */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" /> خلاصه روزانه اعلامیه‌ها
        </h2>
        <p className="text-sm text-muted-foreground mb-4">ارسال ایمیل خلاصه اعلامیه‌های ۲۴ ساعت گذشته به همه کاربران فعال (فقط مدیران)</p>
        <button
          onClick={handleSendDigest}
          disabled={sendingDigest}
          className="bg-purple-600 text-white px-5 py-2.5 rounded-xl font-medium hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50"
        >
          <Mail className="w-5 h-5" />
          {sendingDigest ? "در حال ارسال..." : "ارسال خلاصه روزانه"}
        </button>
        {digestMsg && <p className={`text-sm mt-3 ${digestMsg.startsWith("✅") ? "text-green-600" : "text-red-500"}`}>{digestMsg}</p>}
      </div>

      {profileFor && (
        <EmployeeProfile
          employee={profileFor}
          canEdit={true}
          onClose={() => setProfileFor(null)}
          onSaved={() => { setProfileFor(null); load(); }}
        />
      )}
    </div>
  );
}
