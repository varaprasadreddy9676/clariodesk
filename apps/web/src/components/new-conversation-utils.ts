export function normalizePhoneInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const digits = trimmed.replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

export function parseParticipantPhones(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\n,]+/)
        .map(normalizePhoneInput)
        .filter((phone) => /^\+[1-9]\d{6,14}$/.test(phone)),
    ),
  ];
}
