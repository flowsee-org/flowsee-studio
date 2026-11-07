import { studio } from "../api/studioClient.js";

export const DEFAULT_TAGS = [
  "طراحی",
  "توسعه",
  "محتوا",
  "بازاریابی",
  "پشتیبانی",
  "فوری",
];

const LOCAL_STORAGE_TAGS_KEY = "flowsee_shared_tags_cache";
const TAG_UPDATED_EVENT = "flowsee:tags-updated";

let inMemoryTags = null;

function normalizeTag(tag) {
  return String(tag || "")
    .trim()
    .normalize("NFKC");
}

export function getCachedTags() {
  if (inMemoryTags && inMemoryTags.length > 0) return inMemoryTags;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_TAGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        inMemoryTags = parsed;
        return parsed;
      }
    }
  } catch {
    // Ignore storage parse issues
  }
  return DEFAULT_TAGS;
}

function syncCache(tags) {
  const clean = [...new Set(tags.map(normalizeTag).filter(Boolean))];
  inMemoryTags = clean;
  try {
    localStorage.setItem(LOCAL_STORAGE_TAGS_KEY, JSON.stringify(clean));
  } catch {
    // Ignore storage quote errors
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(TAG_UPDATED_EVENT, { detail: clean }));
  }
  return clean;
}

export async function fetchAllTags() {
  try {
    const [tagRecords, taskRecords] = await Promise.all([
      studio.entities.Tag.list().catch(() => []),
      studio.entities.Task.list().catch(() => []),
    ]);

    const entityTagNames = (Array.isArray(tagRecords) ? tagRecords : [])
      .map((t) => t.name || t.title)
      .filter(Boolean);

    const taskTags = (Array.isArray(taskRecords) ? taskRecords : [])
      .flatMap((task) => (Array.isArray(task.tags) ? task.tags : []))
      .filter(Boolean);

    const merged = [...new Set([...DEFAULT_TAGS, ...getCachedTags(), ...entityTagNames, ...taskTags])];
    return syncCache(merged);
  } catch (err) {
    console.warn("Error fetching persistent tags:", err);
    return getCachedTags();
  }
}

export async function persistNewTag(rawTag) {
  const tag = normalizeTag(rawTag);
  if (!tag) return getCachedTags();

  const current = getCachedTags();
  if (!current.includes(tag)) {
    syncCache([...current, tag]);
  }

  if (typeof window !== "undefined") {
    try {
      const existing = await studio.entities.Tag.list().catch(() => []);
      const alreadySaved = (Array.isArray(existing) ? existing : []).some(
        (t) => normalizeTag(t.name || t.title) === tag
      );
      if (!alreadySaved) {
        await studio.entities.Tag.create({ name: tag });
      }
    } catch (err) {
      console.warn("Could not save new tag to Tag entity:", err);
    }
  }

  return getCachedTags();
}

export function subscribeToTags(callback) {
  if (typeof window === "undefined") return () => {};
  const handler = (event) => {
    if (Array.isArray(event.detail)) callback(event.detail);
  };
  window.addEventListener(TAG_UPDATED_EVENT, handler);
  return () => window.removeEventListener(TAG_UPDATED_EVENT, handler);
}
