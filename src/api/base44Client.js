import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

if (!appId) {
  console.warn(
    "[base44] No app ID configured — set VITE_BASE44_APP_ID in .env.local or run via `base44 dev`. Auth and data calls will fail (404) until the backend is configured."
  );
}

// Create a client. requiresAuth is false on purpose: the app gates access
// itself (AuthContext + ProtectedRoute), so the SDK shouldn't hijack
// navigation on its own.
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});

export { appId };
