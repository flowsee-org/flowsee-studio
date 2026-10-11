const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 600 * 1024;

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("خواندن تصویر ناموفق بود."));
    reader.readAsDataURL(blob);
  });
}

async function decodeImage(file) {
  if (typeof createImageBitmap === "function") return createImageBitmap(file);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Compress a local image into a modest data URL so avatars/logos can be
 * persisted with their profile/settings without a separate upload service. */
export async function imageFileToDataUrl(file, { maxDimension = 1200 } = {}) {
  if (!file?.type?.startsWith("image/")) throw new Error("فقط فایل تصویری انتخاب کنید.");
  if (file.size > MAX_SOURCE_BYTES) throw new Error("حجم فایل اولیه باید کمتر از ۱۰ مگابایت باشد.");

  const image = await decodeImage(file);
  try {
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    let width = Math.max(1, Math.round(image.width * scale));
    let height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("مرورگر امکان پردازش تصویر را ندارد.");

    for (let attempt = 0; attempt < 5; attempt += 1) {
      canvas.width = width;
      canvas.height = height;
      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.82 - attempt * 0.08));
      if (!blob) throw new Error("فشرده‌سازی تصویر ناموفق بود.");
      if (blob.size <= MAX_OUTPUT_BYTES) return await readBlobAsDataUrl(blob);
      width = Math.max(1, Math.round(width * 0.78));
      height = Math.max(1, Math.round(height * 0.78));
    }

    throw new Error("حجم تصویر پس از فشرده‌سازی هنوز زیاد است.");
  } finally {
    image.close?.();
  }
}
