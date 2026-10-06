export type SupportedImage = {
  bytes: ArrayBuffer;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
};

export class ImageInputError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413 = 400,
  ) {
    super(message);
  }
}

export async function readImageUpload(
  request: Request,
  maxBytes: number,
): Promise<SupportedImage> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data;")) {
    throw new ImageInputError("Expected multipart/form-data");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new ImageInputError("Invalid multipart form data");
  }

  const entries = [...form.entries()];
  if (entries.length !== 1 || entries[0][0] !== "file" || !(entries[0][1] instanceof File)) {
    throw new ImageInputError("Provide exactly one file field named file");
  }

  const file = entries[0][1];
  if (file.size > maxBytes) {
    throw new ImageInputError("Image exceeds the upload size limit", 413);
  }

  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > maxBytes) {
    throw new ImageInputError("Image exceeds the upload size limit", 413);
  }

  const view = new Uint8Array(bytes);
  if (
    view.length >= 3 &&
    view[0] === 0xff &&
    view[1] === 0xd8 &&
    view[2] === 0xff
  ) {
    return { bytes, contentType: "image/jpeg", extension: "jpg" };
  }
  if (
    view.length >= 8 &&
    view[0] === 0x89 &&
    view[1] === 0x50 &&
    view[2] === 0x4e &&
    view[3] === 0x47 &&
    view[4] === 0x0d &&
    view[5] === 0x0a &&
    view[6] === 0x1a &&
    view[7] === 0x0a
  ) {
    return { bytes, contentType: "image/png", extension: "png" };
  }
  if (
    view.length >= 12 &&
    String.fromCharCode(...view.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...view.subarray(8, 12)) === "WEBP"
  ) {
    return { bytes, contentType: "image/webp", extension: "webp" };
  }

  throw new ImageInputError("Only JPEG, PNG, and WebP images are supported");
}

export function imageUrl(key: string | null | undefined) {
  if (!key) return null;
  if (/^https?:\/\//i.test(key)) return key;
  return `/api/public/images/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export function isOwnedImageKey(
  key: string | null | undefined,
  expectedPrefix: string,
) {
  if (!key?.startsWith(expectedPrefix)) return false;
  const name = key.slice(expectedPrefix.length);
  return /^[0-9a-f-]{36}\.(?:jpg|png|webp)$/.test(name);
}

export function isPublicImageKey(key: string) {
  const parts = key.split("/");
  if (parts.some((part) => !part || part === "." || part === ".." || /[%\\]/.test(part))) {
    return false;
  }

  const filename = "[0-9a-f-]{36}\\.(?:jpg|png|webp)";
  if (
    parts.length === 5 &&
    parts[0] === "businesses" &&
    /^[1-9]\d*$/.test(parts[1]) &&
    parts[2] === "items" &&
    /^[1-9]\d*$/.test(parts[3])
  ) {
    return new RegExp(`^${filename}$`).test(parts[4]);
  }
  if (
    parts.length === 4 &&
    parts[0] === "businesses" &&
    /^[1-9]\d*$/.test(parts[1]) &&
    (parts[2] === "logo" || parts[2] === "banner")
  ) {
    return new RegExp(`^${filename}$`).test(parts[3]);
  }
  if (
    parts.length === 4 &&
    parts[0] === "users" &&
    /^[A-Za-z0-9_-]{1,128}$/.test(parts[1]) &&
    parts[2] === "avatar"
  ) {
    return new RegExp(`^${filename}$`).test(parts[3]);
  }
  return false;
}
