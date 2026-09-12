// Shared role labels/colors for the app. Mirrors the role hierarchy in
// AuthContext (superadmin > admin > user).
export const roleLabels = {
  superadmin: "مدیرعامل",
  admin: "مدیر",
  user: "پرسنل",
};

export const roleColors = {
  superadmin: "bg-purple-100 text-purple-700",
  admin: "bg-primary/10 text-primary",
  user: "bg-accent text-muted-foreground",
};

// Ordered list used by dropdowns (CEO first).
export const roleOptions = [
  { value: "user", label: roleLabels.user },
  { value: "admin", label: roleLabels.admin },
  { value: "superadmin", label: roleLabels.superadmin },
];

export const roleLabel = (role) => roleLabels[role] || roleLabels.user;
export const roleColor = (role) => roleColors[role] || roleColors.user;
export const canManageAll = (role) => role === "superadmin" || role === "admin";