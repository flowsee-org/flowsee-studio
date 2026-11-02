import { useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

export default function SubtaskList({ subtasks = [], onChange }) {
  const [newSubtask, setNewSubtask] = useState('');
  const localSubtasks = [...subtasks];

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
    if (!newSubtask.trim()) return;
    onChange([...localSubtasks, { title: newSubtask.trim(), done: false }]);
    setNewSubtask('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="space-y-2">
      {localSubtasks.length > 0 && (
        <div className="space-y-1.5">
          {localSubtasks.map((subtask, index) => (
            <div key={index} className="flex items-center gap-2 bg-accent/40 rounded-xl px-3 py-2 border border-border/50">
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
                checked={subtask.done}
                onChange={() => handleToggle(index)}
                className="w-4 h-4 accent-primary flex-shrink-0 cursor-pointer"
              />
              <input
                type="text"
                aria-label={`عنوان زیرتسک ${index + 1}`}
                value={subtask.title}
                onChange={(e) => handleUpdateText(index, e.target.value)}
                className={`flex-1 text-sm bg-transparent border-none focus:outline-none focus:ring-0 ${subtask.done ? 'line-through text-muted-foreground' : ''}`}
              />
              <button
                type="button"
                onClick={() => handleRemove(index)}
                aria-label={`حذف زیرتسک ${index + 1}`}
                className="text-muted-foreground hover:text-red-500 p-1 rounded-lg"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={newSubtask}
          onChange={(e) => setNewSubtask(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="زیرتسک جدید..."
          className="flex-1 border border-input rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!newSubtask.trim()}
          aria-label="افزودن زیرتسک"
          className="bg-primary text-primary-foreground px-3 rounded-xl flex items-center disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
