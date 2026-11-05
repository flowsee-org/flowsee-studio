import { useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, ArrowUpRight, CheckSquare } from 'lucide-react';
import { normalizeSubtasks, getSubtaskStats } from '@/lib/subtasks';
import { formatPersianNumber as faNum } from '@/lib/number-format';

export default function SubtaskList({ subtasks = [], onChange, onConvertToTask }) {
  const [newSubtask, setNewSubtask] = useState('');
  const localSubtasks = normalizeSubtasks(subtasks);
  const stats = getSubtaskStats(localSubtasks);

  const handleToggle = (index) => {
    const updated = localSubtasks.map((s, i) =>
      i === index ? { ...s, done: !s.done } : s
    );
    onChange(updated);
  };

  const handleUpdateText = (index, text) => {
    const updated = localSubtasks.map((s, i) =>
      i === index ? { ...s, title: text } : s
    );
    onChange(updated);
  };

  const handleRemove = (index) => {
    const updated = localSubtasks.filter((_, i) => i !== index);
    onChange(updated);
  };

  const handleMove = (fromIndex, toIndex) => {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= localSubtasks.length) return;
    const updated = [...localSubtasks];
    const [movedItem] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, movedItem);
    onChange(updated);
  };

  const handleAdd = () => {
    const text = newSubtask.trim();
    if (!text) return;
    const newItem = {
      id: `subtask-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: text,
      done: false,
    };
    onChange([...localSubtasks, newItem]);
    setNewSubtask('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="space-y-3">
      {localSubtasks.length > 0 && (
        <div className="space-y-1.5">
          {/* Progress bar */}
          <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
            <span className="flex items-center gap-1.5 font-medium">
              <CheckSquare className="w-3.5 h-3.5 text-primary" />
              پیشرفت: {faNum(stats.completed)} از {faNum(stats.total)} ({faNum(stats.percent)}٪)
            </span>
            {stats.allDone && (
              <span className="text-emerald-600 font-medium">همه تکمیل شدند ✓</span>
            )}
          </div>
          <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${stats.allDone ? 'bg-emerald-500' : 'bg-primary'}`}
              style={{ width: `${stats.percent}%` }}
            />
          </div>

          {/* Subtask items */}
          <div className="space-y-1.5 pt-1">
            {localSubtasks.map((subtask, index) => (
              <div
                key={subtask.id || `subtask-${index}`}
                className="flex items-center gap-2 bg-accent/40 rounded-xl px-3 py-2 border border-border/50 transition-colors hover:border-border"
              >
                <select
                  aria-label={`تغییر جایگاه زیرتسک ${index + 1}`}
                  value={index + 1}
                  onChange={(e) => handleMove(index, Number(e.target.value) - 1)}
                  className="h-7 w-9 rounded-lg bg-background border border-input text-xs font-bold text-center text-primary cursor-pointer focus:ring-1 focus:ring-primary outline-none"
                  title="تغییر شماره و جایگاه زیرتسک"
                >
                  {localSubtasks.map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}
                    </option>
                  ))}
                </select>

                <div className="flex flex-col -space-y-1">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => handleMove(index, index - 1)}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5"
                    title="یک پله بالاتر"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    disabled={index === localSubtasks.length - 1}
                    onClick={() => handleMove(index, index + 1)}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5"
                    title="یک پله پایین‌تر"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                </div>

                <input
                  type="checkbox"
                  aria-label={`تکمیل زیرتسک ${index + 1}`}
                  checked={Boolean(subtask.done)}
                  onChange={() => handleToggle(index)}
                  className="w-4 h-4 accent-primary flex-shrink-0 cursor-pointer"
                />

                <input
                  type="text"
                  aria-label={`عنوان زیرتسک ${index + 1}`}
                  value={subtask.title || ''}
                  onChange={(e) => handleUpdateText(index, e.target.value)}
                  className={`flex-1 text-sm bg-transparent border-none focus:outline-none focus:ring-0 ${
                    subtask.done ? 'line-through text-muted-foreground' : 'text-foreground'
                  }`}
                  placeholder="عنوان زیرتسک..."
                />

                {onConvertToTask && (
                  <button
                    type="button"
                    onClick={() => onConvertToTask(subtask, index)}
                    aria-label={`تبدیل زیرتسک ${index + 1} به تسک اصلی`}
                    title="تبدیل به تسک اصلی"
                    className="text-muted-foreground hover:text-primary hover:bg-primary/10 p-1 rounded-lg transition-colors"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  aria-label={`حذف زیرتسک ${index + 1}`}
                  title="حذف زیرتسک"
                  className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10 p-1 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add new subtask input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newSubtask}
          onChange={(e) => setNewSubtask(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="افزودن زیرتسک جدید..."
          className="flex-1 border border-input rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!newSubtask.trim()}
          aria-label="افزودن زیرتسک"
          className="bg-primary text-primary-foreground px-3 rounded-xl flex items-center justify-center disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
