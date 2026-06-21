const AVATAR_COLORS = [
  "#5b8c6a",
  "#6a8fb5",
  "#b57c5b",
  "#8a6db5",
  "#b55b7c",
  "#4f9a94",
  "#9a824f",
  "#7c5bb5",
  "#5b9ab5",
  "#a05b8c",
];

/** Deterministic avatar background color from a seed string. */
export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length] ?? "#6a8fb5";
}

/** Up-to-two-letter initials from a chat/contact title. */
export function avatarInitials(title: string): string {
  const words = title
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "#";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}
