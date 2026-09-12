import { appParams } from "@/lib/app-params";

// The SDK's base44.users.inviteUser only allows "user" | "admin". Local
// backend + full app support "superadmin" too, so when superadmin is needed we
// call the same runtime endpoint directly with the stored token.
export async function inviteUser({ userEmail, role = "user", full_name = "", phone = "", initial_password = "" }) {
  const body = { user_email: userEmail, role, full_name, phone };
  if (initial_password) body.initial_password = initial_password;

  try {
    const res = await base44Invite(body);
    return res;
  } catch (err) {
    // Fall back to the SDK call for user/admin roles (works against both the
    // local backend and hosted Base44).
    const { base44 } = await import("@/api/base44Client");
    return base44.users.inviteUser(userEmail, role);
  }
}

async function base44Invite(body) {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("base44_access_token") : "";
  const res = await fetch(`/api/apps/${appParams.appId}/runtime/users/invite-user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `Invite failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.message) message = data.message;
    } catch {
      /* keep default message */
    }
    throw new Error(message);
  }
  return res.json();
}