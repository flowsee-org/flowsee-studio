export const appId = 'studio';
const base = `/api/apps/${appId}`;
const tokenKey = 'studio_access_token';
export async function request(path, method = 'GET', body) {
  const token = localStorage.getItem(tokenKey);
  const multipart = body instanceof FormData;
  const res = await fetch(path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(!multipart && body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.message || 'Request failed'), { status: res.status, data });
  return data;
}
const setToken = token => localStorage.setItem(tokenKey, token);
async function authenticate(action, body) {
  const data = await request(`${base}/auth/${action}`, 'POST', body);
  if (data.access_token) setToken(data.access_token);
  return data;
}
/** @param {string} name */
const entity = name => {
  const path = `${base}/entities/${encodeURIComponent(name)}`;
  const list = (sort = undefined, limit = undefined, skip = undefined, fields = undefined) => {
    const params = typeof sort === 'object' ? sort : { sort, limit, skip, fields };
    const query = new URLSearchParams(Object.entries(params || {}).filter(([, v]) => v !== undefined));
    return request(`${path}?${query}`);
  };
  return {
    list,
    filter: (q, sort, limit, skip) => list({ q: JSON.stringify(q), sort, limit, skip }),
    get: id => request(`${path}/${encodeURIComponent(id)}`),
    create: body => request(path, 'POST', body),
    update: (id, body) => request(`${path}/${encodeURIComponent(id)}`, 'PUT', body),
    delete: id => request(`${path}/${encodeURIComponent(id)}`, 'DELETE'),
    subscribe(callback) {
      let previous, stopped = false, timer;
      const poll = async () => {
        try {
          const rows = await list();
          const current = JSON.stringify(rows);
          if (!stopped && previous !== undefined && previous !== current) callback({ type: 'refresh' });
          previous = current;
        } catch { /* Next poll retries transient connection failures. */ }
        if (!stopped) timer = setTimeout(poll, 3000);
      };
      poll();
      return () => { stopped = true; clearTimeout(timer); };
    },
  };
};
export const studio = {
  appId,
  entities: new Proxy(/** @type {Record<string, ReturnType<typeof entity>>} */ ({}), { get: (_, name) => typeof name === 'string' ? entity(name) : undefined }),
  auth: {
    setToken,
    me: () => request(`${base}/entities/User/me`),
    updateMe: body => request(`${base}/entities/User/me`, 'PUT', body),
    loginViaEmailPassword: (email, password) => authenticate('login', { email, password }),
    register: async body => ({ data: await authenticate('register', body) }),
    verifyOtp: ({ email, otpCode }) => authenticate('verify-otp', { email, otp_code: otpCode }),
    resendOtp: email => authenticate('resend-otp', { email }),
    resetPasswordRequest: email => authenticate('reset-password-request', { email }),
    resetPassword: ({ resetToken, newPassword }) => authenticate('reset-password', { reset_token: resetToken, new_password: newPassword }),
    isAuthenticated: async () => { try { await request(`${base}/entities/User/me`); return true; } catch { return false; } },
    async logout() { try { await request('/api/apps/auth/logout', 'POST'); } finally { localStorage.removeItem(tokenKey); window.location.assign('/login'); } },
    redirectToLogin: () => window.location.assign('/login'),
  },
  users: { inviteUser: (user_email, role) => request(`${base}/runtime/users/invite-user`, 'POST', { user_email, role }) },
  integrations: { Core: {
    UploadFile: ({ file }) => { const form = new FormData(); form.append('file', file); return request(`${base}/integration-endpoints/Core/UploadFile`, 'POST', form); },
    InvokeLLM: body => request(`${base}/integration-endpoints/Core/InvokeLLM`, 'POST', body),
  } },
};
