import { useEffect, useRef } from "react";

const EMOJIS = [
  "😀",
  "😂",
  "😊",
  "😍",
  "🙏",
  "👍",
  "🎉",
  "❤️",
  "✅",
  "👀",
  "🤝",
  "💯",
  "😢",
  "😮",
  "🔥",
  "📌",
];

export function EmojiPicker({
  onSelect,
  onClose,
}: {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}) {
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) onClose();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [onClose]);

  return (
    <div
      className="emoji-picker"
      role="dialog"
      aria-label="Choose emoji"
      ref={pickerRef}
    >
      {EMOJIS.map((emoji) => (
        <button
          type="button"
          key={emoji}
          aria-label={`Insert ${emoji}`}
          onClick={() => onSelect(emoji)}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
