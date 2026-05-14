import type { User } from "../types";
import { Icon } from "./Icon";

interface NavbarProps {
  user: User;
  isRefreshing: boolean;
  onLogout: () => void;
  onRefresh: () => void;
}

export function Navbar({
  user,
  isRefreshing,
  onLogout,
  onRefresh,
}: NavbarProps) {
  return (
    <header className="topbar">
      <div className="brand-lockup" aria-label="TeamVault">
        <span className="brand-mark">
          <Icon name="shield" size={20} />
        </span>
        <div>
          <strong>TeamVault</strong>
          <small>Secure cloud file access</small>
        </div>
      </div>

      <div className="topbar-actions">
        <button
          className="icon-button"
          disabled={isRefreshing}
          onClick={onRefresh}
          title="Refresh workspace"
          type="button"
        >
          <Icon name="refresh" size={18} />
        </button>
        <div className="user-chip">
          <span>{user.name.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{user.name}</strong>
            <small>{user.email}</small>
          </div>
        </div>
        <button
          className="ghost-button compact"
          onClick={onLogout}
          title="Sign out"
          type="button"
        >
          <Icon name="logout" size={17} />
          <span>Sign out</span>
        </button>
      </div>
    </header>
  );
}
