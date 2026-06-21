export const MAX_COMPOSER_ATTACHMENT_BYTES = 16 * 1024 * 1024;

const SUPPORTED_ATTACHMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "audio/mpeg",
  "audio/ogg",
  "application/pdf",
  "text/plain",
]);

export function insertAtSelection(
  value: string,
  insertion: string,
  start: number,
  end: number,
): { value: string; caret: number } {
  return {
    value: `${value.slice(0, start)}${insertion}${value.slice(end)}`,
    caret: start + insertion.length,
  };
}

export function validateComposerAttachment(file: {
  name: string;
  type: string;
  size: number;
}): string | null {
  if (!SUPPORTED_ATTACHMENT_TYPES.has(file.type)) {
    return `${file.name || "This file"} is not supported`;
  }
  if (file.size > MAX_COMPOSER_ATTACHMENT_BYTES) {
    return "Attachments must be 16 MB or smaller";
  }
  return null;
}
