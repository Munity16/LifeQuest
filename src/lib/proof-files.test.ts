import { describe, expect, it } from "vitest";
import { extensionForMimeType, hasValidImageSignature } from "@/lib/proof-files";

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
});
