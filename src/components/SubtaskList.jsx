import { useState } from 'react';
import { CheckSquare, Plus, Trash2, GripVertical } from 'lucide-react';

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
            <div key={index} className="flex items-center gap-2 bg-accent/40 rounded-lg px-3 py-2">
              <input
                type="checkbox"
                checked={subtask.done}
                onChange={() => handleToggle(index)}
                className="w-4 h-4 accent-primary flex-shrink-0"
              />
              <input
                type="text"
                value={subtask.title}
                onChange={(e) => handleUpdateText(index, e.target.value)}
                className={`flex-1 text-sm bg-transparent border-none focus:outline-none focus:ring-0 ${subtask.done ? 'line-through text-muted-foreground' : ''}`}
              />
              <button
                onClick={() => handleRemove(index)}
                className="text-muted-foreground hover:text-red-500 p-1"
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
          onClick={handleAdd}
          disabled={!newSubtask.trim()}
          className="bg-primary text-primary-foreground px-3 rounded-xl flex items-center disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}