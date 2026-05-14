export type IconName =
  | "alert"
  | "check"
  | "cloud"
  | "copy"
  | "database"
  | "external"
  | "file"
  | "grid"
  | "key"
  | "link"
  | "lock"
  | "logout"
  | "plus"
  | "refresh"
  | "search"
  | "shield"
  | "trash"
  | "upload"
  | "users";

const icons: Record<IconName, string[]> = {
  alert: [
    "M12 9v4",
    "M12 17h.01",
    "M10.3 4.3 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z",
  ],
  check: ["M20 6 9 17l-5-5"],
  cloud: [
    "M17.5 19H8a5 5 0 1 1 1.1-9.9A6 6 0 0 1 20 12.5 3.5 3.5 0 0 1 17.5 19Z",
  ],
  copy: [
    "M8 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2Z",
    "M16 8V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2",
  ],
  database: [
    "M4 6c0-2.2 3.6-4 8-4s8 1.8 8 4-3.6 4-8 4-8-1.8-8-4Z",
    "M4 6v6c0 2.2 3.6 4 8 4s8-1.8 8-4V6",
    "M4 12v6c0 2.2 3.6 4 8 4s8-1.8 8-4v-6",
  ],
  external: ["M14 3h7v7", "M10 14 21 3", "M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"],
  file: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z", "M14 2v6h6"],
  grid: ["M4 4h7v7H4Z", "M13 4h7v7h-7Z", "M4 13h7v7H4Z", "M13 13h7v7h-7Z"],
  key: ["M15 7a5 5 0 1 0-4.5 8H7v3H4v3H1v-3.6L9 9.4A5 5 0 0 0 15 7Z", "M15 7h.01"],
  link: ["M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 1 0-7.1-7.1l-1.1 1.1", "M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 1 0 12 20.1l1.1-1.1"],
  lock: ["M6 10V8a6 6 0 1 1 12 0v2", "M5 10h14v11H5Z", "M12 15v2"],
  logout: ["M10 17 15 12 10 7", "M15 12H3", "M21 3v18"],
  plus: ["M12 5v14", "M5 12h14"],
  refresh: ["M20 6v5h-5", "M4 18v-5h5", "M19 11a7 7 0 0 0-12.2-4.6L4 9", "M5 13a7 7 0 0 0 12.2 4.6L20 15"],
  search: ["M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z", "M21 21l-4.3-4.3"],
  shield: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z", "M9.5 12l1.7 1.7 3.8-4"],
  trash: ["M3 6h18", "M8 6V4h8v2", "M6 6l1 16h10l1-16", "M10 11v6", "M14 11v6"],
  upload: ["M12 16V4", "M7 9l5-5 5 5", "M4 16v4h16v-4"],
  users: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M22 21v-2a4 4 0 0 0-3-3.9", "M16 3.1a4 4 0 0 1 0 7.8"],
};

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  title?: string;
}

export function Icon({ name, size = 18, className, title }: IconProps) {
  return (
    <svg
      aria-hidden={title ? undefined : true}
      className={className}
      fill="none"
      height={size}
      role={title ? "img" : undefined}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.9"
      viewBox="0 0 24 24"
      width={size}
    >
      {title ? <title>{title}</title> : null}
      {icons[name].map((path) => (
        <path d={path} key={path} />
      ))}
    </svg>
  );
}
