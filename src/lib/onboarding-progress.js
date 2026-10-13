export function getOnboardingCompletedItems({ profile, tasks = [], reports = [], meetings = [], user }) {
  const userName = user?.full_name || user?.email || "";
  const assignedTasks = tasks.filter((task) => {
    const assignees = task.assignees || (task.assignee ? [task.assignee] : []);
    return assignees.includes(userName) || task.created_by_id === user?.id;
  });
  const hasDoneMeeting = meetings.some((meeting) =>
    meeting.status === "done" && (
      meeting.created_by_id === user?.id ||
      meeting.colleague_email === user?.email ||
      (meeting.participants || []).includes(userName)
    )
  );
  const done = new Set();
  if (profile?.full_name?.trim() && profile?.profile_image && profile?.department?.trim() && (profile?.skills || []).length) done.add("profile");
  if (hasDoneMeeting) done.add("meet_manager");
  if (assignedTasks.some((task) => task.status === "done")) done.add("first_task");
  if (reports.some((report) => report.created_by_id === user?.id)) done.add("first_report");
  return done;
}
