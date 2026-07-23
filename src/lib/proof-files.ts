import "server-only";

// @ts-expect-error sharp 0.35.0 omits its bundled type entry from the package exports map.
import sharp from "sharp";
import { ACCEPTED_IMAGE_TYPES, MAX_PROOF_BYTES } from "@/lib/config";
import { AppError } from "@/lib/errors";

const MAX_IMAGE_PIXELS = 40_000_000;
const MAX_IMAGE_EDGE = 2_400;
const MAX_SANITIZED_BYTES = 3 * 1024 * 1024;

export function validateProofFile(value: FormDataEntryValue | null): asserts value is File {
  if (!(value instanceof File)) {
    throw new AppError("Choose an image to submit.", 400, "MISSING_PROOF");
  }

  if (!ACCEPTED_IMAGE_TYPES.includes(value.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    throw new AppError("Use a JPG, PNG, or WebP image.", 400, "INVALID_FILE_TYPE");
  }

  if (value.size <= 0 || value.size > MAX_PROOF_BYTES) {
    throw new AppError("The image must be smaller than 5 MB.", 400, "INVALID_FILE_SIZE");
  }
}

export function hasValidImageSignature(bytes: Uint8Array, mimeType: string) {
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (mimeType === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
  }

  if (mimeType === "image/webp") {
    return bytes.length >= 12
      && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
      && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }

  return false;
}

export function extensionForMimeType(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

export async function sanitizeProofImage(bytes: Uint8Array) {
  try {
    const options = {
      failOn: "error",
      limitInputPixels: MAX_IMAGE_PIXELS,
    } as const;
    const metadata = await sharp(bytes, { ...options, animated: true }).metadata();
    if (!metadata.width || !metadata.height || (metadata.pages ?? 1) !== 1) {
      throw new AppError("Use a single-frame JPG, PNG, or WebP image.", 400, "UNSAFE_IMAGE_CONTENT");
    }

    const image = sharp(bytes, { ...options, animated: false });
    const sanitized = await image
      .rotate()
      .resize({
        width: MAX_IMAGE_EDGE,
        height: MAX_IMAGE_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });

    if (sanitized.data.byteLength > MAX_SANITIZED_BYTES) {
      throw new AppError("The image is too detailed to process safely. Try a smaller crop.", 400, "SANITIZED_IMAGE_TOO_LARGE");
    }

    return {
      bytes: sanitized.data,
      mimeType: "image/jpeg" as const,
      extension: "jpg" as const,
      width: sanitized.info.width,
      height: sanitized.info.height,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "The image could not be decoded safely. Export it again as a JPG, PNG, or WebP file.",
      400,
      "INVALID_IMAGE_CONTENT",
    );
  }
}
