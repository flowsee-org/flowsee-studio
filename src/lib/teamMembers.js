import { base44 } from "@/api/base44Client";

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
    const name = u.full_name || u.email;
    const key = (u.email || name || "").toLowerCase();
    if (name && !seenEmails.has(key)) {
      seenEmails.add(key);
      seenNames.add(name.toLowerCase());
      merged.push({ id: u.id, name, email: u.email });
    }
  });

  // Second pass: add employees, but try to match with existing users by email
  employees.forEach((e) => {
    const emailKey = (e.email || "").toLowerCase();
    const nameKey = (e.name || "").toLowerCase();

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