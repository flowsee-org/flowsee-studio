# Dig in Flowsee Studio

Installed with `digdesign init --yes --brand '#FE5400' --font iransans --agent codex`.
The CLI and generated theme are versioned in the repository. There is no need
to upload anything to the Dig dashboard to run Studio.

Studio currently uses Tailwind 3 and HSL channel tokens; the upstream Dig theme
uses Tailwind 4 and complete OKLCH colors. `npm run dig:sync` extracts the Dig
token declarations into a scoped `.dig-ui` runtime. New rich text editors load
this runtime, including light/dark surfaces, without changing existing screens.
The generated source remains available for `dig update theme`.

Studio's existing Vazirmatn webfont is the runtime font until licensed IRANSansX
files are available. Do not reference nonexistent font files or Next.js font
APIs in this Vite app. The orange primary has dark foreground text for contrast.

After updating Dig: run `npm run dig:sync`, then `npm run build`.
`npm run dig:health` prints a read-only JSON report locally. Uploading that report
to the external Dig dashboard is optional; no reports or project code are sent
automatically. MCP servers are not enabled globally by this setup.
