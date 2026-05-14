import type { FormEvent } from "react";
import { Icon } from "../components/Icon";

export type AuthMode = "login" | "register";

export interface AuthValues {
  name: string;
  email: string;
  password: string;
}

interface LandingProps {
  authError: string;
  authMode: AuthMode;
  authValues: AuthValues;
  isLoading: boolean;
  onModeChange: (mode: AuthMode) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onValueChange: (field: keyof AuthValues, value: string) => void;
}

const productCards = [
  {
    icon: "cloud" as const,
    title: "Bring your own bucket",
    text: "Connect AWS S3 or Google Cloud Storage and keep files in storage you control.",
  },
  {
    icon: "users" as const,
    title: "Team-safe access",
    text: "Whitelist teammates at the connection or file level without exposing raw cloud credentials.",
  },
  {
    icon: "link" as const,
    title: "Short-lived sharing",
    text: "Generate expiring links backed by signed cloud URLs for controlled external delivery.",
  },
];

export function Landing({
  authError,
  authMode,
  authValues,
  isLoading,
  onModeChange,
  onSubmit,
  onValueChange,
}: LandingProps) {
  function jumpToAuth(mode: AuthMode) {
    onModeChange(mode);
    window.requestAnimationFrame(() => {
      document
        .getElementById("auth-card")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  return (
    <main className="landing-shell">
      <nav className="landing-nav" aria-label="Landing navigation">
        <div className="brand-lockup">
          <span className="brand-mark">
            <Icon name="shield" size={22} />
          </span>
          <div>
            <strong>TeamVault</strong>
            <small>Secure cloud file access</small>
          </div>
        </div>

        <div className="landing-actions">
          <button
            className="ghost-button compact"
            onClick={() => jumpToAuth("login")}
            type="button"
          >
            Sign in
          </button>
          <button
            className="primary-button compact"
            onClick={() => jumpToAuth("register")}
            type="button"
          >
            Get started
          </button>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="hero-copy">
          <span className="eyebrow">Team file vault</span>
          <h1>Share cloud files without handing over the keys.</h1>
          <p>
            TeamVault gives teams a clean workspace for bucket-backed uploads,
            access control, signed downloads, and expiring public share links.
          </p>
          <div className="hero-cta">
            <button
              className="primary-button"
              onClick={() => jumpToAuth("register")}
              type="button"
            >
              <Icon name="plus" size={18} />
              Create workspace
            </button>
            <button
              className="secondary-button"
              onClick={() => jumpToAuth("login")}
              type="button"
            >
              <Icon name="lock" size={18} />
              Sign in
            </button>
          </div>
          <div className="auth-proof landing-proof">
            <span>
              <Icon name="database" size={18} />
              AWS S3
            </span>
            <span>
              <Icon name="cloud" size={18} />
              Google Cloud Storage
            </span>
            <span>
              <Icon name="upload" size={18} />
              Files and folders
            </span>
          </div>
        </div>

        <section className="auth-panel landing-auth-card" id="auth-card">
          <div className="segmented-control" role="tablist">
            <button
              aria-selected={authMode === "login"}
              className={authMode === "login" ? "active" : ""}
              onClick={() => onModeChange("login")}
              role="tab"
              type="button"
            >
              Sign in
            </button>
            <button
              aria-selected={authMode === "register"}
              className={authMode === "register" ? "active" : ""}
              onClick={() => onModeChange("register")}
              role="tab"
              type="button"
            >
              Create account
            </button>
          </div>

          <form className="auth-form" onSubmit={onSubmit}>
            {authMode === "register" ? (
              <label>
                Name
                <input
                  autoComplete="name"
                  onChange={(event) => onValueChange("name", event.target.value)}
                  placeholder="Avery Stone"
                  required
                  value={authValues.name}
                />
              </label>
            ) : null}
            <label>
              Email
              <input
                autoComplete="email"
                onChange={(event) => onValueChange("email", event.target.value)}
                placeholder="avery@company.com"
                required
                type="email"
                value={authValues.email}
              />
            </label>
            <label>
              Password
              <input
                autoComplete={
                  authMode === "login" ? "current-password" : "new-password"
                }
                minLength={authMode === "register" ? 6 : 1}
                onChange={(event) =>
                  onValueChange("password", event.target.value)
                }
                placeholder="password"
                required
                type="password"
                value={authValues.password}
              />
            </label>

            {authError ? (
              <div className="inline-alert" role="alert">
                <Icon name="alert" size={17} />
                {authError}
              </div>
            ) : null}

            <button className="primary-button full-width" disabled={isLoading}>
              <Icon name={authMode === "login" ? "lock" : "plus"} size={18} />
              {isLoading
                ? "Working..."
                : authMode === "login"
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>
        </section>
      </section>

      <section className="landing-section">
        <div>
          <span className="eyebrow">Why TeamVault</span>
          <h2>One workspace for private buckets and human sharing.</h2>
        </div>
        <div className="landing-card-grid">
          {productCards.map((card) => (
            <article className="landing-card" key={card.title}>
              <span className="connection-icon">
                <Icon name={card.icon} size={20} />
              </span>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
