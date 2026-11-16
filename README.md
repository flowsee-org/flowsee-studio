# Flowsee Studio

Self-hosted React frontend and Node backend. No hosted application SDK, remote authentication platform, or hosted entity API is required.

## Run locally

Use Node 22.12+ and npm. Run `npm ci`, copy `.env.example` to `.env`, and set a unique administrator email and password (at least 12 characters). Run `npm run dev` and open the Vite URL. Vite loads `.env`; the backend reads server settings through the configuration below. Alternatively set environment variables in your shell.

For the standalone application: `npm run build`, then `npm start`. Open http://127.0.0.1:3000. This serves both the compiled frontend and `/api` from one process. `npm run preview` is only a static frontend preview and does not run the API.

The administrator is created only when the database is empty. Registration is disabled by default; administrators can invite members and set their initial password. There are no demo accounts or Google login impersonation. Google OAuth is not implemented in this standalone version; use local email/password accounts.

## Storage and integrations

- `STUDIO_DATA_DIR` defaults to `.local` in the project. It contains the atomically written database, session signing secret, and private mail outbox. Keep it outside public web roots, back it up, and run only one backend process against it. Do not commit it. A corrupt database fails startup instead of silently erasing data.
- Sessions expire after 30 days. Logout and password reset invalidate previous sessions. Existing hosted tokens do not work; use local accounts.
- File uploads are stored as data URLs in local entity records (3 MB per file). Existing remote attachments must be downloaded and their record URLs replaced before the source service is disconnected. The bundled logo is local.
- Subscriptions poll the local API every three seconds and stop on unmount.
- Email defaults to `.local/mail-outbox.jsonl`; reset links and verification codes also appear in the private OTP inbox. Set SMTP variables to deliver real email using your own mail server.
- AI analysis uses a local Ollama-compatible `/api/generate` endpoint. Install a model on your host, set `STUDIO_LLM_MODEL`, and start the model service. Missing models/services produce an error, never fabricated analysis.
- SiteContent, BlogContent, WebsiteMessages and editor media use the separate Flowsee main-site API (`VITE_MAIN_API_URL`). That service is a separate repository and must accept the local Studio identity or be integrated separately. These panels are not implemented by this repository's entity backend.

## Deployment

Build and run the standalone server behind your HTTPS reverse proxy. Proxy the entire Studio origin to `127.0.0.1:3000` (including `/api`). Set `STUDIO_PUBLIC_URL` to the public origin for reset links and use a persistent `STUDIO_DATA_DIR` outside release directories. Restrict permissions on that directory and `.env` to the service account.

The production workflow runs `ops/deploy-preview.sh`. It builds a release, ensures the persistent `flowsee-studio-api.service` is listening on localhost:3000, then verifies the public `/api/health` endpoint before accepting the release. Nginx must proxy `/api/` to that port. A static HTML health check alone does not verify login.

`ops/ensure-api.sh` requires the existing user database and backs up its directory before configuring the service. It preserves accounts, passwords and the session secret; it refuses to create a blank replacement. It uses `STUDIO_DATA_DIR` from the existing `.env`, defaulting to `/var/www/flowsee-studio/.local`. The dedicated service user owns only its data directory. This deploy does not delete other applications' releases, clear Laravel caches, restart PHP, or clean shared temporary files.

Existing data is not fetched automatically. Back up the old service, export its entities, and use the administrator restore endpoint to import an `{ "entities": { "Task": [], ... } }` JSON document. Admin backups can be restored for application entities; the accompanying user directory is informational only, and user accounts, passwords, and the signing secret are not restored. Create local accounts and remap user IDs in imported records. Test imports on an isolated data directory first. Never import an old development database containing demo users into production.

## Checks

`npm test`, `npm run test:backend`, `npm run lint`, `npm run build`, `npm run typecheck`.
