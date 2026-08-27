import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { NavItem } from "../types.js";

export function Sidebar({
  items,
  activeId,
  onSelect,
  collapsed,
  onToggleCollapsed,
}: {
  items: NavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const mainItems = items.filter((item) => item.id !== "settings");
  const settingsItem = items.find((item) => item.id === "settings");

  return (
    <aside className={`sidebar ${collapsed ? "is-collapsed" : ""}`} aria-label="Primary">
      <div className="brand-lockup">
        <div className="brand-mark" aria-hidden="true">C</div>
        <div>
          <strong>ClarioDesk</strong>
          <span>Operations</span>
        </div>
        <button
          className="icon-button nav-collapse"
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={onToggleCollapsed}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>
      <nav className="nav-list">
        {mainItems.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            isActive={activeId === item.id}
            onSelect={onSelect}
          />
        ))}
      </nav>
      {settingsItem ? (
        <nav className="nav-list nav-list-footer">
          <NavButton
            item={settingsItem}
            isActive={activeId === settingsItem.id}
            onSelect={onSelect}
          />
        </nav>
      ) : null}
    </aside>
  );
}

function NavButton({
  item,
  isActive,
  onSelect,
}: {
  item: NavItem;
  isActive: boolean;
  onSelect: (id: string) => void;
}) {
  const Icon = item.icon;
  return (
    <button
      className={`nav-item ${isActive ? "is-active" : ""}`}
      type="button"
      title={item.label}
      onClick={() => onSelect(item.id)}
    >
      <Icon size={17} aria-hidden="true" />
      <span>{item.label}</span>
      {item.count !== undefined ? <em>{item.count}</em> : null}
    </button>
  );
}
