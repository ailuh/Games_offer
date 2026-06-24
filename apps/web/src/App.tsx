import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { api } from "./api/client";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { WatchPage } from "./pages/WatchPage";

export function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    api
      .me()
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false));
  }, []);

  if (authed === null) return <p>Loading…</p>;

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={authed ? <DashboardPage /> : <Navigate to="/login" replace />} />
      <Route path="/watch" element={authed ? <WatchPage /> : <Navigate to="/login" replace />} />
    </Routes>
  );
}
