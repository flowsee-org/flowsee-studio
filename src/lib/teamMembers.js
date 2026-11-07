import { studio } from "@/api/studioClient";

const normalizeKey = (value) => String(value || "")
  .normalize("NFKC")
  .replace(/[\u200c\u200d\u200e\u200f\ufeff]/g, "")
  .replace(/[يى]/g, "ی")
  .replace(/ك/g, "ک")
  .replace(/\s+/g, " ")
  .trim()
  .toLocaleLowerCase("fa-IR");

const excludedTaskAssigneeEmails = new Set([
  "ceo@flowsee.local",
  "admin@flowsee.local",
  "staff@flowsee.local",
  "google.demo@flowsee.local",
]);
const excludedTaskAssigneeNames = new Set([
  "مدیرعامل",
  "مدیر سیستم",
  "پرسنل نمونه",
].map(normalizeKey));

export async function loadTeamMembers() {
  let users = [];
  let employees = [];
  try {
    [users, employees] = await Promise.all([
      studio.entities.User.list(),
      studio.entities.Employee.list(),
    ]);
  } catch {
    // Non-admin users may not be able to list all users; try employees only
    try {
      employees = await studio.entities.Employee.list();
    } catch {
      employees = [];
    }
  }
  const merged = [];
  const seenEmails = new Set();
  const seenNames = new Set();

  // First pass: add all users
  users.forEach((u) => {
    const name = String(u.full_name || u.fullName || u.name || u.email || "").trim();
    const emailKey = normalizeKey(u.email);
    const nameKey = normalizeKey(name);
    if (excludedTaskAssigneeEmails.has(emailKey) || excludedTaskAssigneeNames.has(nameKey)) return;
    const key = emailKey || nameKey;
    if (name && !seenEmails.has(key) && !seenNames.has(nameKey)) {
      seenEmails.add(key);
      seenNames.add(nameKey);
      merged.push({ id: u.id, name, email: u.email, profile_image: u.profile_image || u.extra?.profile_image || "" });
    }
  });

  // Second pass: add employees, but try to match with existing users by email
  employees.forEach((e) => {
    const emailKey = normalizeKey(e.email);
    const employeeName = String(e.name || e.full_name || e.fullName || e.display_name || "").trim();
    const nameKey = normalizeKey(employeeName);
    if (excludedTaskAssigneeEmails.has(emailKey) || excludedTaskAssigneeNames.has(nameKey)) return;

    // Check if there's already a user with this email
    const existingByEmail = emailKey && seenEmails.has(emailKey);
    // Check if there's already a user with this name
    const existingByName = nameKey && seenNames.has(nameKey);

    if (employeeName && !existingByEmail && !existingByName) {
      // Add as new entry
      if (emailKey) seenEmails.add(emailKey);
      seenNames.add(nameKey);
      merged.push({ id: e.id, name: employeeName, email: e.email, profile_image: e.profile_image || e.extra?.profile_image || "" });
    } else if (employeeName && emailKey && existingByEmail) {
      // Update the existing entry with employee info if needed
      const existing = merged.find((m) => normalizeKey(m.email) === emailKey);
      if (existing) {
        existing.profile_image ||= e.profile_image || e.extra?.profile_image || "";
        // Keep the user's name (full_name) as primary
        // We don't override the name from employee
      }
    }
  });

  return merged;
}

export function filterAssignees(members) {
  if (!Array.isArray(members)) return [];
  return members.filter((member) => member && member.name && !excludedTaskAssigneeNames.has(normalizeKey(member.name)));
}
