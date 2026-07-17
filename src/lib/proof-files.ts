import { ACCEPTED_IMAGE_TYPES, MAX_PROOF_BYTES } from "@/lib/config";
import { AppError } from "@/lib/errors";

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
