import { base44 } from "@/api/base44Client";

const normalizeKey = (value) => String(value || "")
  .normalize("NFKC")
  .replace(/[\u200c\u200d\u200e\u200f\ufeff]/g, "")
  .replace(/[يى]/g, "ی")
  .replace(/ك/g, "ک")
  .replace(/\s+/g, " ")
  .trim()
  .toLocaleLowerCase("fa-IR");

export async function loadTeamMembers() {
  let users = [];
  let employees = [];
  try {
    [users, employees] = await Promise.all([
      base44.entities.User.list(),
      base44.entities.Employee.list(),
    ]);
  } catch {
    // Non-admin users may not be able to list all users; try employees only
    try {
      employees = await base44.entities.Employee.list();
    } catch {
      employees = [];
    }
  }
  const merged = [];
  const seenEmails = new Set();
  const seenNames = new Set();

  // First pass: add all users
  users.forEach((u) => {
    const name = String(u.full_name || u.email || "").trim();
    const emailKey = normalizeKey(u.email);
    const nameKey = normalizeKey(name);
    const key = emailKey || nameKey;
    if (name && !seenEmails.has(key) && !seenNames.has(nameKey)) {
      seenEmails.add(key);
      seenNames.add(nameKey);
      merged.push({ id: u.id, name, email: u.email });
    }
  });

  // Second pass: add employees, but try to match with existing users by email
  employees.forEach((e) => {
    const emailKey = normalizeKey(e.email);
    const nameKey = normalizeKey(e.name);

    // Check if there's already a user with this email
    const existingByEmail = emailKey && seenEmails.has(emailKey);
    // Check if there's already a user with this name
    const existingByName = nameKey && seenNames.has(nameKey);

    if (e.name && !existingByEmail && !existingByName) {
      // Add as new entry
      if (emailKey) seenEmails.add(emailKey);
      seenNames.add(nameKey);
      merged.push({ id: e.id, name: e.name, email: e.email });
    } else if (e.name && emailKey && existingByEmail) {
      // Update the existing entry with employee info if needed
      const existing = merged.find(m => m.email?.toLowerCase() === emailKey);
      if (existing) {
        // Keep the user's name (full_name) as primary
        // We don't override the name from employee
      }
    }
  });

  return merged;
}