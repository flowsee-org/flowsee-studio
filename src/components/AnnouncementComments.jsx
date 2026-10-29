import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Send, MessageSquare, Reply, Clock } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { formatPersianNumber as faNum } from "@/lib/number-format";

const getTimeAgo = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "همین الان";
  if (diffMins < 60) return `${faNum(diffMins)} دقیقه پیش`;
  if (diffHours < 24) return `${faNum(diffHours)} ساعت پیش`;
  if (diffDays < 7) return `${faNum(diffDays)} روز پیش`;
  return date.toLocaleDateString("fa-IR");
};

export default function AnnouncementComments({ announcementId }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadComments();
    const unsub = base44.entities.Comment.subscribe(() => loadComments());
    return unsub;
  }, [announcementId]);

  const loadComments = async () => {
    try {
      const data = await base44.entities.Comment.list({ q: JSON.stringify({ entity_type: "announcement", entity_id: announcementId }) });
      setComments(data.sort((a, b) => new Date(a.created_date) - new Date(b.created_date)));
    } catch (err) {
      console.error("Failed to load comments:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!newComment.trim() || sending) return;
    setSending(true);
    try {
      await base44.entities.Comment.create({
        entity_type: "announcement",
        entity_id: announcementId,
        author_name: user?.full_name || user?.email || "کاربر",
        author_email: user?.email || "",
        text: newComment.trim(),
      });
      setNewComment("");
    } catch (err) {
      console.error("Failed to send comment:", err);
    } finally {
      setSending(false);
    }
  };

  const handleReply = async (parentId) => {
    const text = replyText.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await base44.entities.Comment.create({
        entity_type: "announcement",
        entity_id: announcementId,
        author_name: user?.full_name || user?.email || "کاربر",
        author_email: user?.email || "",
        text,
        parent_id: parentId,
      });
      setReplyTo(null);
      setReplyText("");
    } catch (err) {
      console.error("Failed to reply:", err);
    } finally {
      setSending(false);
    }
  };

  const topLevel = comments.filter((c) => !c.parent_id);
  const repliesOf = (id) => comments.filter((c) => c.parent_id === id);

  return (
    <div className="space-y-3 pt-3 border-t border-border">
      <button
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
      >
        <MessageSquare className="w-3.5 h-3.5" /> گفتگو ({faNum(comments.length)})
      </button>

      {!loading && comments.length === 0 && (
        <p className="text-xs text-muted-foreground">هنوز نظری ثبت نشده است. اولین نظر را بنویسید.</p>
      )}

      <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
        {topLevel.map((c) => (
          <div key={c.id} className="bg-accent/40 rounded-xl p-3">
            <div className="flex items-start gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                {(c.author_name || "؟").charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{c.author_name}</span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> {getTimeAgo(c.created_date)}</span>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap">{c.text}</p>
                <button
                  onClick={() => { setReplyTo(replyTo === c.id ? null : c.id); setReplyText(""); }}
                  className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mt-1.5"
                >
                  <Reply className="w-3 h-3" /> پاسخ
                </button>

                {replyTo === c.id && (
                  <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleReply(c.id); }}
                      placeholder="پاسخ به این نظر..."
                      className="flex-1 border border-input rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <button onClick={() => handleReply(c.id)} disabled={!replyText.trim()} className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium disabled:opacity-50 hover:bg-primary/20">
                      ارسال
                    </button>
                  </div>
                )}

                {repliesOf(c.id).length > 0 && (
                  <div className="space-y-2 mt-2 mr-4 border-r-2 border-border pr-3">
                    {repliesOf(c.id).map((r) => (
                      <div key={r.id} className="bg-card rounded-lg p-2.5">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-xs">{r.author_name}</span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {getTimeAgo(r.created_date)}</span>
                        </div>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{r.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
          {(user?.full_name || user?.email || "؟").charAt(0)}
        </div>
        <div className="flex-1 relative">
          <input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSend(); } }}
            placeholder="نظر خود را بنویسید و Enter بزنید..."
            className="w-full border border-input rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            onClick={handleSend}
            disabled={sending || !newComment.trim()}
            className="absolute left-1.5 top-1/2 -translate-y-1/2 p-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
