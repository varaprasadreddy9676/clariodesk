import { MessageCirclePlus, UserRound, UsersRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ApiPhone } from "../api.js";
import { NewChatDialog, type NewChatInput } from "./NewChatDialog.js";
import { NewGroupDialog, type NewGroupInput } from "./NewGroupDialog.js";

export function NewConversationFab({
  phones,
  onCreateChat,
  onCreateGroup,
}: {
  phones: ApiPhone[];
  onCreateChat: (input: NewChatInput) => Promise<void>;
  onCreateGroup: (input: NewGroupInput) => Promise<void>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<"chat" | "group" | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const outside = (event: MouseEvent) =>
      rootRef.current &&
      !rootRef.current.contains(event.target as Node) &&
      setMenuOpen(false);
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menuOpen) {
        setMenuOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [menuOpen]);

  return (
    <>
      <div className="new-conversation" ref={rootRef}>
        {menuOpen ? (
          <div className="new-conversation-menu" role="menu">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setDialog("group");
                setMenuOpen(false);
              }}
            >
              <span>
                <UsersRound size={17} />
              </span>
              New group
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setDialog("chat");
                setMenuOpen(false);
              }}
            >
              <span>
                <UserRound size={17} />
              </span>
              New chat
            </button>
          </div>
        ) : null}
        <button
          ref={buttonRef}
          className="new-conversation-fab"
          type="button"
          aria-label="New conversation"
          title="New conversation"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
          disabled={!phones.length}
        >
          <MessageCirclePlus size={23} />
        </button>
      </div>
      {dialog === "chat" ? (
        <NewChatDialog
          phones={phones}
          onCreate={onCreateChat}
          onClose={() => {
            setDialog(null);
            buttonRef.current?.focus();
          }}
        />
      ) : null}
      {dialog === "group" ? (
        <NewGroupDialog
          phones={phones}
          onCreate={onCreateGroup}
          onClose={() => {
            setDialog(null);
            buttonRef.current?.focus();
          }}
        />
      ) : null}
    </>
  );
}
