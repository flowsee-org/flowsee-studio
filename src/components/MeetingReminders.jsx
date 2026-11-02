import { useEffect, useState } from "react";
import { studio } from "@/api/studioClient";
import { useAuth } from "@/lib/AuthContext";
import { CalendarClock, Video, X } from "lucide-react";
import { getPersianDate } from "@/components/PersianDatePicker";
import { Link } from "react-router-dom";

/** Converts a Persian "YYYY/MM/DD" string into a comparable key (digits). */
const toCompareKey = (d) => {
  const parts = String(d || "").split("/");
  if (parts.length !== 3) return "";
  const y = parts[0].padStart(4, "0");
  const m = parts[1].padStart(2, "0");
  const day = parts[2].padStart(2, "0");
  return `${y}${m}${day}`;
};

export default function MeetingReminders() {
  const { user } = useAuth();
  const userName = user?.full_name || user?.email || "";
  const userEmail = user?.email || "";
  const [meetings, setMeetings] = useState([]);
  const [dismissed, setDismissed] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await studio.entities.Meeting.list("-created_date");
        setMeetings(data);
      } catch {
        setMeetings([]);
      }
      setLoading(false);
    };
    load();
    const unsub = studio.entities.Meeting.subscribe(load);
    return unsub;
  }, []);

  if (loading) return null;

  const todayKey = toCompareKey(getPersianDate(0));
  const tomorrowKey = toCompareKey(getPersianDate(1));

  // Meetings happening today or tomorrow that are not done/cancelled and involve me.
  const relevant = meetings
    .filter((m) => m.status !== "done" && m.status !== "cancelled")
    .filter((m) => {
      const key = toCompareKey(m.date);
      return key === todayKey || key === tomorrowKey;
    })
    .filter((m) => {
      if (m.created_by_id === user?.id) return true;
      if (m.colleague === userName || m.colleague_email === userEmail) return true;
      if (m.is_group && (m.participants || []).includes(userName)) return true;
      return false;
    })
    .filter((m) => !dismissed.includes(m.id))
    .sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")));

  const today = relevant.filter((m) => toCompareKey(m.date) === todayKey);
  const upcoming = relevant.filter((m) => toCompareKey(m.date) === tomorrowKey);

  if (relevant.length === 0) return null;

  return (
    <div className="bg-gradient-to-l from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-sm sm:text-base flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-primary" />
          یادآوری جلسات
        </h2>
        <button onClick={() => setDismissed(relevant.map((m) => m.id))} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
          <X className="w-3.5 h-3.5" /> مخفی کردن
        </button>
      </div>
      <div className="space-y-2">
        {today.map((m) => (
          <div key={m.id} className="flex items-center justify-between gap-3 bg-card rounded-xl px-3 py-2.5 border border-primary/20">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                <CalendarClock className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">امروز {m.time ? `ساعت ${m.time}` : ""} — {m.colleague}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {m.status === "confirmed" ? "تایید شده" : m.status === "pending" ? "در انتظار تایید" : m.status === "rescheduled" ? "زمان پیشنهادی" : "—"}
                </p>
              </div>
            </div>
            <Link to="/meetings" className="text-xs text-primary shrink-0 font-medium hover:underline flex items-center gap-1">
              مشاهده
            </Link>
          </div>
        ))}
        {upcoming.map((m) => (
          <div key={m.id} className="flex items-center justify-between gap-3 bg-card rounded-xl px-3 py-2.5 border border-border">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center shrink-0">
                <Video className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">فردا {m.time ? `ساعت ${m.time}` : ""} — {m.colleague}</p>
                <p className="text-xs text-muted-foreground truncate">{m.status === "confirmed" ? "تایید شده" : "در انتظار"}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}