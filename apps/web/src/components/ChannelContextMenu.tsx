import {
  Archive,
  ArchiveRestore,
  Bell,
  BellOff,
  Clipboard,
  Copy,
  Inbox,
  MessageCircleMore,
  Pin,
  PinOff,
  RefreshCcw,
} from "lucide-react";
import { useEffect, useRef } from "react";
import type { Channel } from "../types.js";

export type ChannelMenuAction =
  | "open"
  | "refresh"
  | "mark-unread"
  | "pin"
  | "unpin"
  | "mute"
  | "unmute"
  | "archive"
  | "unarchive"
  | "copy-title"
  | "copy-provider-id"
  | "copy-clario-id";

export type ChannelMenuState = {
  channel: Channel;
  x: number;
  y: number;
};

export function ChannelContextMenu({
  state,
  onClose,
  onAction,
}: {
  state: ChannelMenuState;
  onClose: () => void;
  onAction: (
    action: ChannelMenuAction,
    channel: Channel,
  ) => void | Promise<void>;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const items: Array<
    | { kind: "separator" }
    | {
        kind: "action";
        action: ChannelMenuAction;
        label: string;
        icon: typeof Inbox;
      }
  > = [
    { kind: "action", action: "open", label: "Open chat", icon: Inbox },
    {
      kind: "action",
      action: "refresh",
      label: "Refresh from WhatsApp",
      icon: RefreshCcw,
    },
    ...(!state.channel.isMarkedUnread
      ? ([
          {
            kind: "action" as const,
            action: "mark-unread" as const,
            label: "Mark as unread",
            icon: MessageCircleMore,
          },
        ] as const)
      : []),
    { kind: "separator" },
    {
      kind: "action",
      action: state.channel.isPinned ? "unpin" : "pin",
      label: state.channel.isPinned ? "Unpin chat" : "Pin chat",
      icon: state.channel.isPinned ? PinOff : Pin,
    },
    {
      kind: "action",
      action: state.channel.isMuted ? "unmute" : "mute",
      label: state.channel.isMuted ? "Unmute chat" : "Mute chat",
      icon: state.channel.isMuted ? Bell : BellOff,
    },
    {
      kind: "action",
      action: state.channel.status === "archived" ? "unarchive" : "archive",
      label:
        state.channel.status === "archived" ? "Unarchive chat" : "Archive chat",
      icon: state.channel.status === "archived" ? ArchiveRestore : Archive,
    },
    { kind: "separator" },
    { kind: "action", action: "copy-title", label: "Copy title", icon: Copy },
    {
      kind: "action",
      action: "copy-provider-id",
      label: "Copy WhatsApp ID",
      icon: Clipboard,
    },
    {
      kind: "action",
      action: "copy-clario-id",
      label: "Copy ClarioDesk ID",
      icon: Clipboard,
    },
  ];

  useEffect(() => {
    function handlePointer(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (!menuRef.current) return;
      const buttons = Array.from(
        menuRef.current.querySelectorAll<HTMLButtonElement>("button"),
      );
      if (!buttons.length) return;
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const target =
        event.key === "ArrowDown"
          ? buttons[(current + 1) % buttons.length]
          : event.key === "ArrowUp"
            ? buttons[(current - 1 + buttons.length) % buttons.length]
            : event.key === "Home"
              ? buttons[0]
              : event.key === "End"
                ? buttons.at(-1)
                : undefined;
      if (target) {
        event.preventDefault();
        target.focus();
      }
    }
    window.addEventListener("pointerdown", handlePointer);
    window.addEventListener("keydown", handleKey);
    menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      window.removeEventListener("pointerdown", handlePointer);
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="message-context-menu channel-context-menu"
      role="menu"
      style={{ left: state.x, top: state.y }}
      aria-label="Channel actions"
    >
      {items.map((item, index) => {
        if (item.kind === "separator")
          return (
            <div
              key={`sep-${index}`}
              className="menu-separator"
              role="separator"
            />
          );
        const Icon = item.icon;
        return (
          <button
            key={item.action}
            type="button"
            role="menuitem"
            onClick={() => void onAction(item.action, state.channel)}
          >
            <Icon size={16} aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
