import { describe, expect, it } from "vitest";
import {
  insertAtSelection,
  validateComposerAttachment,
} from "./composer-utils.js";

describe("composer utilities", () => {
  it("inserts emoji at the active selection", () => {
    expect(insertAtSelection("Hello world", "👋", 6, 11)).toEqual({
      value: "Hello 👋",
      caret: 8,
    });
  });

  it("accepts a supported attachment below the size limit", () => {
    expect(
      validateComposerAttachment({
        name: "proof.png",
        type: "image/png",
        size: 1024,
      }),
    ).toBeNull();
  });

  it("rejects unsupported and oversized attachments", () => {
    expect(
      validateComposerAttachment({
        name: "archive.exe",
        type: "application/x-msdownload",
        size: 1024,
      }),
    ).toMatch(/not supported/i);
    expect(
      validateComposerAttachment({
        name: "large.mp4",
        type: "video/mp4",
        size: 17 * 1024 * 1024,
      }),
    ).toMatch(/16 MB/i);
  });
});
