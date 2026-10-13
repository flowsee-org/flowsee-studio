import test from "node:test";
import assert from "node:assert/strict";
import { getOnboardingCompletedItems } from "./onboarding-progress.js";

const user = { id: "staff-1", email: "staff@example.com", full_name: "کارمند" };

test("onboarding only completes items backed by current profile and work records", () => {
  const done = getOnboardingCompletedItems({
    profile: { full_name: user.full_name, profile_image: "/avatar.png", department: "طراحی", skills: ["UI"] },
    tasks: [{ id: "task-1", status: "done", assignee: user.full_name }],
    reports: [{ id: "report-1", created_by_id: user.id }],
    meetings: [{ id: "meeting-1", status: "done", colleague_email: user.email }],
    user,
  });

  assert.deepEqual([...done].sort(), ["first_report", "first_task", "meet_manager", "profile"].sort());
});

test("opening the checklist or stale saved flags cannot complete unverified steps", () => {
  const done = getOnboardingCompletedItems({
    profile: { onboarding_progress: ["profile", "read_rules", "setup_tools", "security", "calendar"] },
    tasks: [{ id: "task-1", status: "in_progress", assignee: user.full_name }],
    reports: [],
    meetings: [{ id: "meeting-1", status: "pending", created_by_id: user.id }],
    user,
  });

  assert.deepEqual([...done], []);
});

test("an unrelated person's task or work report does not complete this user's onboarding", () => {
  const done = getOnboardingCompletedItems({
    profile: { full_name: user.full_name, profile_image: "/avatar.png", department: "طراحی", skills: ["UI"] },
    tasks: [{ id: "task-1", status: "done", assignee: "همکار دیگر" }],
    reports: [{ id: "report-1", created_by_id: "staff-2" }],
    meetings: [],
    user,
  });

  assert.deepEqual([...done], ["profile"]);
});
