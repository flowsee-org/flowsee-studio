import { siteContentMediaUrl } from './site-content-media';
import { MAIN_API_URL } from './mainApi.js';



export async function uploadEditorImage(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('تصویر JPG، PNG یا WebP انتخاب کنید.');
  if (file.size > 5 * 1024 * 1024) throw new Error('حجم تصویر باید حداکثر ۵ مگابایت باشد.');
  const body = new FormData();
  body.append('image', file);
  const response = await fetch(`${MAIN_API_URL}/api/studio/site-content/images`, {
    method: 'POST', body,
    headers: { Authorization: `Bearer ${localStorage.getItem('studio_access_token') || ''}`, Accept: 'application/json' },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.path) throw new Error(result.message || 'آپلود تصویر انجام نشد؛ دوباره تلاش کنید.');
  return siteContentMediaUrl(result.path);
}
