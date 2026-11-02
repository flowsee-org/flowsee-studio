import { useEffect, useState } from "react";
import { studio } from "@/api/studioClient";
import { useAuth } from "@/lib/AuthContext";
import { X, Plus, Flame, AlertCircle, Clock } from "lucide-react";
import PersianDatePicker, { getPersianDate } from "@/components/PersianDatePicker";
import { loadTeamMembers } from "@/lib/teamMembers";
import { toast } from "@/components/ui/use-toast";

const suggestedTopics = [
  "مرور اهداف این فصل و اینکه چقدر پیش رفتیم",
  "حجم کار این هفته‌ها و اینکه آیا مدیریت‌پذیر است",
  "مسیر شغلی و گام بعدی برای رشد",
  "موانعی که همین حالا سر راه هستند",
];

function rankAgendaSuggestions(suggestions, query) {
  const tokens = String(query || "")
    .normalize("NFKC")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 2);
  if (!tokens.length) return suggestions.slice(0, 8);
  const ranked = suggestions.map((suggestion, index) => {
    const normalized = suggestion.normalize("NFKC").replace(/[يى]/g, "ی").replace(/ك/g, "ک");
    const score = tokens.reduce((total, token) => total + (normalized.includes(token) ? 1 : 0), 0);
    return { suggestion, score, index };
  });
  const matches = ranked.filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.index - b.index);
  return (matches.length ? matches : ranked).slice(0, 8).map((item) => item.suggestion);
}

export default function MeetingModal({ onClose, onSaved }) {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [colleague, setColleague] = useState("");
  const [colleagueEmail, setColleagueEmail] = useState("");
  const [date, setDate] = useState(getPersianDate(0));
  const [time, setTime] = useState("10:00");
  const [endTime, setEndTime] = useState("10:45");
  const [topics, setTopics] = useState([""]);
  const [urgent, setUrgent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [isGroup, setIsGroup] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [agendaSuggestions, setAgendaSuggestions] = useState(suggestedTopics);

  useEffect(() => {
    let active = true;
    Promise.all([
      loadTeamMembers(),
      studio.entities.Meeting.list("-created_date").catch(() => []),
    ]).then(([all, history]) => {
      if (!active) return;
      setMembers(all.filter((m) => m.email !== user?.email && m.name !== (user?.full_name || user?.email)));
      const historicTopics = history
        .filter((meeting) => meeting.created_by_id === user?.id || meeting.colleague === (user?.full_name || user?.email))
        .flatMap((meeting) => Array.isArray(meeting.topics) ? meeting.topics : [])
        .map((topic) => String(topic || "").trim())
        .filter(Boolean);
      setAgendaSuggestions([...new Set([...historicTopics, ...suggestedTopics])].slice(0, 8));
    }).catch(() => {
      if (active) setMembers([]);
    });
    return () => { active = false; };
  }, [user?.id, user?.email, user?.full_name]);

  useEffect(() => {
    if (!time) return;
    const [hours, minutes] = time.split(":").map(Number);
    const totalMinutes = Math.min(23 * 60 + 59, hours * 60 + minutes + (urgent ? 15 : 45));
    const nextEndTime = String(Math.floor(totalMinutes / 60)).padStart(2, "0") + ":" + String(totalMinutes % 60).padStart(2, "0");
    setEndTime(nextEndTime);
  }, [urgent, time]);

  const handleColleagueChange = (name) => {
    const member = members.find((m) => m.name === name);
    setColleague(name);
    setColleagueEmail(member?.email || "");
  };

  const addTopic = () => setTopics([...topics, ""]);
  const updateTopic = (i, val) => setTopics(topics.map((t, idx) => (idx === i ? val : t)));
  const removeTopic = (i) => setTopics(topics.filter((_, idx) => idx !== i));
  const addSuggested = (topic) => {
    if (!topics.includes(topic)) setTopics([...topics.filter((t) => t !== ""), topic]);
  };
  const contextualSuggestions = rankAgendaSuggestions(agendaSuggestions, topics.find((topic) => topic.trim()) || "");

  const toggleParticipant = (name) => {
    const current = participants || [];
    const newParticipants = current.includes(name)
      ? current.filter((a) => a !== name)
      : [...current, name];
    setParticipants(newParticipants);
  };

  const handleSave = async () => {
    if ((!isGroup && !colleague) || (isGroup && participants.length === 0)) return;
    if (!date) return;
    setSaving(true);
    setError("");
    try {
      const meetingData = {
        colleague: isGroup ? "جلسه گروهی" : colleague,
        colleague_email: isGroup ? participants.map(p => members.find(m => m.name === p)?.email).filter(Boolean).join(",") : colleagueEmail,
        date,
        time,
        end_time: endTime,
        topics: topics.filter((t) => t.trim()),
        status: "pending",
        urgent,
        is_group: isGroup,
        participants: isGroup ? participants : [],
      };

      await studio.entities.Meeting.create(meetingData);
      toast({ title: "جلسه ثبت شد", description: isGroup ? "جلسه گروهی برای شرکت‌کنندگان ارسال گردید." : "درخواست جلسه به همکار ارسال گردید." });
      setSaving(false);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || "خطا در ثبت جلسه");
      toast({ title: "خطا", description: err.message || "ثبت جلسه ناموفق بود", variant: "destructive" });
      setSaving(false);
    }
  };

  const getDuration = () => {
    if (!time || !endTime) return "—";
    const [startH, startM] = time.split(":").map(Number);
    const [endH, endM] = endTime.split(":").map(Number);
    const start = startH * 60 + startM;
    const end = endH * 60 + endM;
    const diff = end - start;
    if (diff <= 0) return "نامعتبر";
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return `${h > 0 ? h + " ساعت" : ""} ${m > 0 ? m + " دقیقه" : ""}`.trim();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-xl max-h-[90vh] overflow-y-auto scrollbar-thin" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg">ثبت جلسه</h2>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={isGroup}
                onChange={(e) => setIsGroup(e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-sm font-medium">جلسه گروهی (چندین شرکت‌کننده)</span>
            </label>
          </div>

          {!isGroup ? (
            <div>
              <label className="text-sm font-medium block mb-1.5">
                با چه کسی؟ <span className="text-primary">*</span>
              </label>
              <select
                value={colleague}
                onChange={(e) => handleColleagueChange(e.target.value)}
                className="w-full border border-input rounded-xl px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">یک همکار را انتخاب کن...</option>
                {members.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.email ? `${m.name} — ${m.email}` : m.name}
                  </option>
                ))}
              </select>
              {members.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1.5">عضوی یافت نشد. از پنل ادمین کاربران را دعوت کنید.</p>
              )}
            </div>
          ) : (
            <div>
              <label className="text-sm font-medium block mb-1.5">
                شرکت‌کنندگان <span className="text-primary">*</span>
              </label>
              <div className="border border-input rounded-xl p-2.5 max-h-40 overflow-y-auto scrollbar-thin space-y-1.5">
                {members.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">عضوی یافت نشد</p>}
                {members.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 cursor-pointer hover:bg-accent/50 rounded-lg px-2 py-1.5">
                    <input
                      type="checkbox"
                      checked={(participants || []).includes(m.name)}
                      onChange={() => toggleParticipant(m.name)}
                      className="w-4 h-4 accent-primary"
                    />
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm">{m.name}</span>
                  </label>
                ))}
              </div>
              {(participants || []).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {participants.map((name) => (
                    <span key={name} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full flex items-center gap-1">
                      {name}
                      <button onClick={() => toggleParticipant(name)} className="hover:text-red-500">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1.5">تاریخ</label>
              <PersianDatePicker
                label=""
                required
                value={date}
                onChange={setDate}
                placeholder="انتخاب تاریخ"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">ساعت شروع</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                dir="ltr"
                className="w-full border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">ساعت پایان</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                dir="ltr"
                className="w-full border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-xl">
            <Clock className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-primary">مدت زمان: {getDuration()}</span>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">اولویت</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setUrgent(false)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  !urgent ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground"
                }`}
              >
                عادی
              </button>
              <button
                type="button"
                onClick={() => setUrgent(true)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
                  urgent ? "bg-red-500 text-white" : "bg-accent text-muted-foreground"
                }`}
              >
                <Flame className="w-4 h-4" /> فوری
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">دستور جلسه</label>
            {topics.map((t, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={t}
                  onChange={(e) => updateTopic(i, e.target.value)}
                  placeholder={`موضوع ${i + 1}`}
                  className="flex-1 border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                {topics.length > 1 && (
                  <button onClick={() => removeTopic(i)} className="p-2 text-muted-foreground hover:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button onClick={addTopic} className="text-primary text-sm font-medium flex items-center gap-1 mt-1">
              <Plus className="w-4 h-4" /> افزودن موضوع
            </button>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">پیشنهاد بر اساس موضوع و سابقهٔ جلسه‌ها:</p>
            <div className="flex flex-wrap gap-2">
              {contextualSuggestions.map((t, i) => (
                <button
                  key={i}
                  onClick={() => addSuggested(t)}
                  className="text-xs bg-accent border border-border rounded-full px-3 py-1.5 hover:bg-primary/10 hover:border-primary/30 transition-colors text-right"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
        <div className="sticky bottom-0 -mx-5 sm:-mx-6 mt-5 flex items-center justify-between gap-3 border-t border-border bg-card px-5 py-4 sm:-mx-6 sm:px-6">
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground px-4 py-2.5">
            بستن
          </button>
          <button
            onClick={handleSave}
            disabled={saving || (!isGroup && !colleague) || (isGroup && participants.length === 0) || !date}
            className="bg-primary text-primary-foreground px-8 py-2.5 rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex-1 max-w-[60%]"
          >
            {saving ? "در حال ثبت..." : "ثبت جلسه"}
          </button>
        </div>
      </div>
    </div>
  );
}
