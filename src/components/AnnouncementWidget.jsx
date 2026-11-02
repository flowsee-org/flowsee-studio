import { useEffect, useState } from "react";
import { studio } from "@/api/studioClient";
import { useAuth } from "@/lib/AuthContext";
import { Megaphone, Pin, ArrowLeft, Paperclip } from "lucide-react";
import { Link } from "react-router-dom";
import { getPersianDate } from "@/components/PersianDatePicker";
import { plainTextFromHtml } from "@/lib/announcementSanitize";

export default function AnnouncementWidget() {
  const { user } = useAuth();
  const userName = user?.full_name || user?.email || "";
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    const unsub = studio.entities.Announcement.subscribe(() => load());
    return unsub;
  }, []);

  const load = async () => {
    const data = await studio.entities.Announcement.list("-created_date");
    setAnnouncements(data);
    setLoading(false);
  };

  const today = getPersianDate(0);
  const visible = announcements.filter((a) => {
    if (a.expires_at && a.expires_at < today) return false;
    if (a.target_audience === "individual") return (a.target_names || []).includes(userName);
    return true;
  });

  const sorted = [...visible].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  const display = sorted.slice(0, 4);

  const markRead = async (a) => {
    const readBy = a.read_by || [];
    if (readBy.includes(user?.id)) return;
    await studio.entities.Announcement.update(a.id, { read_by: [...readBy, user?.id] });
    load();
  };

  if (loading || display.length === 0) return null;

  return (
    <div className="bg-card rounded-2xl border border-border p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-sm sm:text-base flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-primary" />
          اعلانات
        </h2>
        <Link to="/announcements" className="text-xs text-primary hover:underline flex items-center gap-1">
          همه <ArrowLeft className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="space-y-2">
        {display.map((a) => {
          const isUnread = !(a.read_by || []).includes(user?.id);
          return (
            <div
              key={a.id}
              onClick={() => markRead(a)}
              className={`rounded-xl p-3 cursor-pointer transition-colors ${
                a.pinned ? "bg-primary/5 border border-primary/20" : "bg-accent/30 hover:bg-accent/50"
              }`}
            >
              <div className="flex items-start gap-2">
                {a.pinned && <Pin className="w-4 h-4 text-primary shrink-0 mt-0.5" />}
                {isUnread && !a.pinned && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{a.title}</p>
                    {isUnread && <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">جدید</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{plainTextFromHtml(a.body)}</p>
                  {a.file_url && (
                    <a href={a.file_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-xs text-primary mt-1.5 flex items-center gap-1">
                      <Paperclip className="w-3 h-3" /> فایل پیوست
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}