const SITE = "https://flowsee.ir";

function canonicalPath(path) {
  let normalized = String(path).trim().replace(/\\/g, "/");
  normalized = normalized.replace(/^\/+/, "").replace(/^public\//i, "");
  normalized = normalized.replace(/^(?:storage\/)?app\/public\//i, "");

  if (/^storage\//i.test(normalized) || /^(assets|images)\//i.test(normalized) || /^\d+\.jpg$/i.test(normalized)) {
    return `/${normalized}`;
  }
  return `/storage/${normalized}`;
}

export function siteContentMediaUrl(path) {
  if (!path) return "";
  const source = String(path).trim().replace(/\\/g, "/");
  if (/^data:/i.test(source)) return source;
  if (/^https?:\/\//i.test(source)) {
    const url = new URL(source);
    if (["flowsee.ir", "www.flowsee.ir"].includes(url.hostname.toLowerCase())) {
      return `${SITE}${canonicalPath(url.pathname)}${url.search}${url.hash}`;
    }
    return source;
  }
  if (source.startsWith("//")) {
    const url = new URL(`https:${source}`);
    if (["flowsee.ir", "www.flowsee.ir"].includes(url.hostname.toLowerCase())) {
      return `${SITE}${canonicalPath(url.pathname)}${url.search}${url.hash}`;
    }
    return url.href;
  }

  return `${SITE}${canonicalPath(source)}`;
}
