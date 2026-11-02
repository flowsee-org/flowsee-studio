import { request, appId } from '@/api/studioClient';
export function inviteUser({ userEmail, role = 'user', full_name = '', phone = '', initial_password = '' }) {
  return request(`/api/apps/${appId}/runtime/users/invite-user`, 'POST', { user_email: userEmail, role, full_name, phone, initial_password });
}
