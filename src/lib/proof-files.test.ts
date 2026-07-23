import { describe, expect, it } from "vitest";
// @ts-expect-error sharp 0.35.0 omits its bundled type entry from the package exports map.
import sharp from "sharp";
import { extensionForMimeType, hasValidImageSignature, sanitizeProofImage } from "@/lib/proof-files";

describe("proof file validation", () => {
  it("recognises supported image signatures", () => {
    expect(hasValidImageSignature(new Uint8Array([0xff, 0xd8, 0xff, 0x00]), "image/jpeg")).toBe(true);
    expect(hasValidImageSignature(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png")).toBe(true);
    expect(hasValidImageSignature(new TextEncoder().encode("RIFF0000WEBP"), "image/webp")).toBe(true);
  });

  it("rejects spoofed image content", () => {
    expect(hasValidImageSignature(new TextEncoder().encode("not an image"), "image/png")).toBe(false);
  });

  it("derives storage extensions from trusted MIME values", () => {
    expect(extensionForMimeType("image/png")).toBe("png");
    expect(extensionForMimeType("image/webp")).toBe("webp");
    expect(extensionForMimeType("image/jpeg")).toBe("jpg");
  });

  it("decodes, rotates, normalizes, and strips metadata before storage", async () => {
    const source = await sharp({
      create: { width: 12, height: 6, channels: 3, background: "#563d1f" },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const output = await sanitizeProofImage(source);
    const metadata = await sharp(output.bytes).metadata();

    expect(output.mimeType).toBe("image/jpeg");
    expect(output.extension).toBe("jpg");
    expect(output.width).toBe(6);
    expect(output.height).toBe(12);
    expect(metadata.orientation).toBeUndefined();
    expect(metadata.exif).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
  });

  it("rejects corrupt payloads even when their header resembles an image", async () => {
    await expect(
      sanitizeProofImage(new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x01])),
    ).rejects.toMatchObject({ code: "INVALID_IMAGE_CONTENT" });
  });

  it("resizes oversized dimensions while preserving the image ratio", async () => {
    const source = await sharp({
      create: { width: 3_000, height: 1_000, channels: 3, background: "#14182b" },
    }).png().toBuffer();
    const output = await sanitizeProofImage(source);

    expect(output.width).toBe(2_400);
    expect(output.height).toBe(800);
    expect(output.bytes.byteLength).toBeLessThanOrEqual(3 * 1024 * 1024);
  });

  it("rejects animated images", async () => {
    const pixels = Buffer.alloc(12 * 24 * 4);
    for (let pixel = 0; pixel < 12 * 12; pixel += 1) {
      pixels[pixel * 4] = 255;
      pixels[pixel * 4 + 3] = 255;
    }
    for (let pixel = 12 * 12; pixel < 12 * 24; pixel += 1) {
      pixels[pixel * 4 + 2] = 255;
      pixels[pixel * 4 + 3] = 255;
    }
    const animated = await sharp(pixels, {
      raw: { width: 12, height: 24, channels: 4, pageHeight: 12 },
    }).webp({ pageHeight: 12, loop: 0, delay: [100, 100] }).toBuffer();

    await expect(sanitizeProofImage(animated)).rejects.toMatchObject({ code: "UNSAFE_IMAGE_CONTENT" });
  });
});
