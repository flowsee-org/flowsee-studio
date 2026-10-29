import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Send, MessageSquare } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { formatPersianNumber as faNum } from '@/lib/number-format';

const getTimeAgo = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'همین الان';
  if (diffMins < 60) return `${faNum(diffMins)} دقیقه پیش`;
  if (diffHours < 24) return `${faNum(diffHours)} ساعت پیش`;
  if (diffDays < 7) return `${faNum(diffDays)} روز پیش`;
  return date.toLocaleDateString('fa-IR');
};

export default function TaskComments({ taskId }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadComments();
    const unsub = base44.entities.Comment.subscribe(() => loadComments());
    return unsub;
  }, [taskId]);

  const loadComments = async () => {
    try {
      const data = await base44.entities.Comment.list({ q: JSON.stringify({ entity_type: 'task', entity_id: taskId }) });
      setComments(data.sort((a, b) => new Date(a.created_date) - new Date(b.created_date)));
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!newComment.trim() || sending) return;
    setSending(true);
    try {
      await base44.entities.Comment.create({
        entity_type: 'task',
        entity_id: taskId,
        author_name: user?.full_name || user?.email || 'کاربر',
        author_email: user?.email || '',
        text: newComment.trim(),
      });
      setNewComment('');
    } catch (err) {
      console.error('Failed to send comment:', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="space-y-4 pt-4 border-t border-border">
      <h4 className="font-medium text-sm flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-primary" />
        نظرات ({faNum(comments.length)})
      </h4>

      {loading ? (
        <div className="flex justify-center py-4">
          <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-center text-muted-foreground py-4 text-sm">هنوز نظراتی ثبت نشده</p>
      ) : (
        <div className="space-y-3 max-h-60 overflow-y-auto">
          {comments.map((c) => (
            <div key={c.id} className="bg-accent/40 rounded-xl p-3">
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {(c.author_name || '؟').charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{c.author_name}</span>
                    <span className="text-xs text-muted-foreground">{getTimeAgo(c.created_date)}</span>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{c.text}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
          {(user?.full_name || user?.email || '؟').charAt(0)}
        </div>
        <div className="flex-1 relative">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="نظر خود را بنویسید... (Enter برای ارسال)"
            rows={2}
            className="w-full border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none pr-12"
          />
          <button
            onClick={handleSend}
            disabled={sending || !newComment.trim()}
            className="absolute left-2 bottom-2 p-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
