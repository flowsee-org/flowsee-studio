// Shared base URL for the Flowsee main-site API used by Studio admin pages.
// Production builds should always target the main-site API, not the static Studio host.
// Local development can leave VITE_MAIN_API_URL empty to use the dev server's /api routes.
const configuredBase = (import.meta.env.VITE_MAIN_API_URL || "").trim();
const isProductionStudio =
  typeof window !== "undefined" && window.location.hostname === "studio.flowsee.ir";

export const MAIN_API_URL = (configuredBase || (isProductionStudio ? "https://flowsee.ir" : ""))
  .replace(/\/+$/, "");
