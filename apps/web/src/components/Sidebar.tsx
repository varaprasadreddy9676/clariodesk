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
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`nav-item ${activeId === item.id ? "is-active" : ""}`}
              type="button"
              onClick={() => onSelect(item.id)}
            >
              <Icon size={17} aria-hidden="true" />
              <span>{item.label}</span>
              {item.count !== undefined ? <em>{item.count}</em> : null}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
