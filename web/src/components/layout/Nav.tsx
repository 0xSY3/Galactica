import { useState } from "react";
import { NavLink, Link } from "react-router";
import { Sun, Moon } from "lucide-react";
import { useStatus } from "../../context/StatusContext.tsx";
import { useTheme } from "../../context/ThemeContext.tsx";
// Logo is inline SVG — no external asset

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/hunt", label: "Analyze" },
  { to: "/autopilot", label: "Autopilot" },
  { to: "/reputation", label: "Agents" },
  { to: "/acp", label: "Consensus" },
  { to: "/memory", label: "Memory" },
  { to: "/network", label: "Network" },
  { to: "/reports", label: "Reports" },
  { to: "/telegram", label: "Alerts" },
  { to: "/live", label: "Wallets" },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  const health = useStatus();
  const { theme, toggleTheme } = useTheme();

  const toggle = () => setOpen((o) => !o);
  const close = () => setOpen(false);

  const badgeClass = health
    ? health.ok
      ? "badge badge-green"
      : health.onlineCount > 0
        ? "badge badge-yellow"
        : "badge badge-red"
    : "badge badge-green";
  const badgeText = health
    ? health.ok
      ? "LIVE"
      : health.onlineCount > 0
        ? "DEGRADED"
        : "OFFLINE"
    : "LIVE";

  return (
    <>
      <nav>
        <Link className="logo" to="/">
          <div className="logo-icon">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="2" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" />
              <rect x="6" y="6" width="7" height="7" fill="var(--accent, #00FF88)" />
              <rect x="15" y="6" width="7" height="7" fill="var(--green, #F7931A)" />
              <rect x="6" y="15" width="7" height="7" fill="var(--accent2, #F7931A)" />
              <rect x="15" y="15" width="7" height="7" fill="var(--accent, #00FF88)" />
              <line x1="14" y1="4" x2="14" y2="24" stroke="currentColor" strokeWidth="1" opacity="0.3" />
              <line x1="4" y1="14" x2="24" y2="14" stroke="currentColor" strokeWidth="1" opacity="0.3" />
            </svg>
          </div>
          <div>
            Galactica<div className="logo-sub">Agent Network</div>
          </div>
        </Link>
        <button
          className={`hamburger${open ? " open" : ""}`}
          aria-label="Menu"
          onClick={toggle}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
        <div className={`nav-links${open ? " open" : ""}`}>
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
              onClick={close}
            >
              {l.label}
            </NavLink>
          ))}
        </div>
        <div className="nav-right">
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun /> : <Moon />}
          </button>
          <span className={badgeClass}>
            <span className="dot"></span> {badgeText}
          </span>
        </div>
      </nav>
      <div className={`nav-overlay${open ? " open" : ""}`} onClick={close} />
    </>
  );
}
