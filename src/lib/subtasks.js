export function normalizeSubtask(item, index = 0) {
  if (item == null) return null;
  if (typeof item === 'string') {
    const trimmed = item.trim();
    if (!trimmed) return null;
    return {
      id: `subtask-${index}-${trimmed.slice(0, 12)}`,
      title: trimmed,
      done: false,
    };
  }
  if (typeof item === 'object') {
    const title = String(item.title ?? item.name ?? item.text ?? '').trim();
    if (!title && !item.id) return null;
    const done = Boolean(item.done || item.completed);
    const id = item.id ? String(item.id) : `subtask-${index}-${title.slice(0, 12)}`;
    return {
      id,
      title,
      done,
    };
  }
  return null;
}
export function normalizeSubtasks(raw) {
  if (!raw) return [];
  let parsed = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      parsed = trimmed.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.map((item, idx) => normalizeSubtask(item, idx)).filter(Boolean);
}

export function getSubtaskStats(rawSubtasks) {
  const items = normalizeSubtasks(rawSubtasks);
  const total = items.length;
  const completed = items.filter((s) => s.done).length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return {
    total,
    completed,
    percent,
    hasSubtasks: total > 0,
    allDone: total > 0 && completed === total,
  };
}
