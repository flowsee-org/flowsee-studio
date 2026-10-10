import { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Plus, Pin, Trash2, Pencil, Megaphone, Paperclip, Users, CheckCheck, Clock, MessageSquare } from "lucide-react";
import AnnouncementModal from "@/components/AnnouncementModal";
import AnnouncementComments from "@/components/AnnouncementComments";
import ConfirmDialog from "@/components/ConfirmDialog";
import { getPersianDate } from "@/components/PersianDatePicker";
import { useDeleteUndo } from "@/hooks/useDeleteUndo.jsx";

const isHtml = (text) => /<\/?[a-z][\s\S]*>/i.test(text || "");

export default function Announcements() {
  const { user, isAdmin } = useAuth();
  const userName = user?.full_name || user?.email || "";
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [expandedComments, setExpandedComments] = useState(null);

  useEffect(() => {
    load();
    const unsub = base44.entities.Announcement.subscribe(() => load());
    return unsub;
  }, []);

  const load = async () => {
    const [data, comments] = await Promise.all([
      base44.entities.Announcement.list("-created_date"),
      base44.entities.Comment.list(),
    ]);
    const counts = {};
    comments.forEach((c) => {
      if (c.entity_type === "announcement") counts[c.entity_id] = (counts[c.entity_id] || 0) + 1;
    });
    setAnnouncements(data.map((a) => ({ ...a, _comment_count: counts[a.id] || 0 })));
    setLoading(false);
  };

  const { deleteWithUndo } = useDeleteUndo("Announcement", (id) => base44.entities.Announcement.delete(id), load);

  const today = getPersianDate(0);

  // Auto-hide expired announcements & respect targeting
  const visible = useCallback(
    (list) =>
      list.filter((a) => {
        if (a.expires_at && a.expires_at < today) return false;
        if (a.target_audience === "individual") return (a.target_names || []).includes(userName);
        return true;
      }),
    [today, userName]
  );

  const visibleAnnouncements = visible(announcements);
  const sorted = [...visibleAnnouncements].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  const unreadCount = visibleAnnouncements.filter((a) => !(a.read_by || []).includes(user?.id)).length;

  const markRead = async (a) => {
    const readBy = a.read_by || [];
    if (readBy.includes(user?.id)) return;
    await base44.entities.Announcement.update(a.id, { read_by: [...readBy, user?.id] });
    load();
  };

  const markAllRead = async () => {
    for (const a of visibleAnnouncements) {
      const readBy = a.read_by || [];
      if (!readBy.includes(user?.id)) {
        await base44.entities.Announcement.update(a.id, { read_by: [...readBy, user?.id] });
      }
    }
    load();
  };

  const togglePin = async (a) => {
    await base44.entities.Announcement.update(a.id, { pinned: !a.pinned });
    load();
  };

  const handleDelete = async (id) => {
    const announcement = announcements.find(a => a.id === id);
    if (announcement) setDeleteTarget(announcement);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteWithUndo(deleteTarget);
    load();
    setDeleteTarget(null);
  };

  const handleEdit = (a) => {
    setEditItem(a);
    setShowModal(true);
  };

  const formatDate = (d) => {
    if (!d) return "";
    try {
      return new Intl.DateTimeFormat("fa-IR", { month: "long", day: "numeric" }).format(new Date(d));
    } catch {
      return "";
    }
  };

  const audienceLabel = (a) => {
    if (a.target_audience === "all") return "همه";
    if (a.target_audience === "team") return `تیم: ${a.target_team || ""}`;
    return "افراد خاص";
  };

  if (loading)
    return (
      <div className="flex justify-center p-20">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">تابلو اعلانات</h1>
          <p className="text-muted-foreground mt-1 text-sm">اطلاعیه‌های شرکت و تیم</p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="border border-input px-4 py-2.5 rounded-xl font-medium text-sm text-muted-foreground hover:text-primary hover:border-primary/40 flex items-center gap-2 transition-colors"
            >
              <CheckCheck className="w-4 h-4" /> علامت‌گذاری همه ({unreadCount})
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => { setEditItem(null); setShowModal(true); }}
              className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:opacity-90 transition-opacity"
            >
              <Plus className="w-5 h-5" /> اعلان جدید
            </button>
          )}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-12 text-center">
          <Megaphone className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">هنوز اعلانی منتشر نشده</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((a) => {
            const isUnread = !(a.read_by || []).includes(user?.id);
            const commentCount = a._comment_count || 0;
            return (
              <div
                key={a.id}
                onClick={() => markRead(a)}
                className={`bg-card rounded-2xl border p-4 sm:p-5 cursor-pointer transition-colors ${
                  a.pinned ? "border-primary/30 bg-primary/5" : "border-border hover:border-primary/20"
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {a.pinned && <Pin className="w-4 h-4 text-primary shrink-0" />}
                    <h2 className="font-bold text-sm sm:text-base">{a.title}</h2>
                    {isUnread && <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full shrink-0">جدید</span>}
                    {a.expires_at && (
                      <span className="text-[11px] bg-accent text-muted-foreground px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                        <Clock className="w-3 h-3" /> تا {a.expires_at}
                      </span>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1 shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); togglePin(a); }} className={`p-1.5 rounded-lg ${a.pinned ? "text-primary bg-primary/10" : "text-muted-foreground hover:bg-accent"}`}>
                        <Pin className="w-4 h-4" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleEdit(a); }} className="p-1.5 text-muted-foreground hover:text-primary rounded-lg hover:bg-accent">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(a.id); }} className="p-1.5 text-muted-foreground hover:text-red-500 rounded-lg hover:bg-destructive/10">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
                {isHtml(a.body) ? (
                  <div className="text-sm text-foreground/90 rich-text-copy" dir="rtl" dangerouslySetInnerHTML={{ __html: a.body }} />
                ) : (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.body}</p>
                )}
                {a.file_url && (
                  <a href={a.file_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-xs text-primary mt-3 flex items-center gap-1">
                    <Paperclip className="w-3.5 h-3.5" /> فایل پیوست
                  </a>
                )}
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {audienceLabel(a)}</span>
                  <span>{formatDate(a.created_date)}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedComments(expandedComments === a.id ? null : a.id);
                    }}
                    className={`flex items-center gap-1 mr-auto hover:text-primary transition-colors ${expandedComments === a.id ? "text-primary" : ""}`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> {commentCount > 0 ? commentCount : "نظر"}
                  </button>
                </div>
                {expandedComments === a.id && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <AnnouncementComments announcementId={a.id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <AnnouncementModal
          editAnnouncement={editItem}
          onClose={() => { setShowModal(false); setEditItem(null); }}
          onSaved={load}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="حذف اعلان"
          description={`اعلان "${deleteTarget.title}" بلافاصله حذف می‌شود. آیا مطمئن هستید؟`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
          confirmText="بله، حذف شود"
        />
      )}
    </div>
  );
}