import { useEffect, useRef, useState } from "react";

interface TelegramUser {
  id: number;
  first_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramUser) => void;
  }
}

export function LoginPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME;

  useEffect(() => {
    window.onTelegramAuth = async (user: TelegramUser) => {
      await fetch("/api/auth/telegram", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user),
      });
      window.location.href = "/";
    };

    if (!botUsername || !containerRef.current) return;

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    containerRef.current.appendChild(script);
  }, [botUsername]);

  const [devIds, setDevIds] = useState<string[]>([]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    fetch("/api/auth/dev-accounts", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { ids: string[] }) => setDevIds(d.ids))
      .catch(() => undefined);
  }, []);

  const devLoginAs = async (id?: string) => {
    await fetch("/api/auth/dev-login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? { id } : {}),
    });
    window.location.href = "/";
  };

  return (
    <div className="login">
      <h1>Watchlist Hub</h1>
      <p style={{ color: "var(--text-2)" }}>Sign in with your Telegram account.</p>
      <div ref={containerRef} style={{ display: "flex", justifyContent: "center" }} />
      {!botUsername && (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
          Set VITE_TELEGRAM_BOT_USERNAME to enable the login widget.
        </p>
      )}
      {import.meta.env.DEV && (
        <div style={{ marginTop: "1.5rem" }}>
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Dev login (local only):</p>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
            {devIds.map((id) => (
              <button className="btn btn--primary" key={id} onClick={() => devLoginAs(id)}>
                Login as {id}
              </button>
            ))}
            {devIds.length === 0 && (
              <button className="btn btn--primary" onClick={() => devLoginAs()}>
                Dev login
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
