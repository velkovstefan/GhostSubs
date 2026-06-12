import { useState, useEffect } from "react";
import Auth     from "./components/Auth";
import Landing  from "./components/Landing";
import Uploading from "./components/Uploading";
import Dashboard from "./components/Dashboard";
import Profile   from "./components/Profile";

const API = import.meta.env.VITE_API_URL || "/api";

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function App() {
  const [view,   setView]   = useState("landing");
  const [token,  setToken]  = useState(null);
  const [user,   setUser]   = useState(null);
  const [scanId, setScanId] = useState(null);
  const [report, setReport] = useState(null);
  const [error,  setError]  = useState("");

  // Restore session on mount
  useEffect(() => {
    const saved = localStorage.getItem("ghost_token");
    if (!saved) { setView("landing"); return; }
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${saved}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(u  => { setToken(saved); setUser(u); setView("landing"); })
      .catch(() => { localStorage.removeItem("ghost_token"); setView("auth"); });
  }, []);

  function handleAuth(t, u) {
    if (t) localStorage.setItem("ghost_token", t);
    setToken(t); setUser(u); setView("landing");
  }

  function handleLogout() {
    localStorage.removeItem("ghost_token");
    setToken(null); setUser(null); setReport(null); setScanId(null);
    setView("auth");
  }
  function handleLogin(){
    setView("auth");
  }

  async function handleUpload(file) {
    setView("uploading"); setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res  = await fetch(`${API}/upload`, { method: "POST", headers: authHeaders(token), body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");
      const rRes  = await fetch(`${API}/report/${data.scan_id}`);
      const rData = await rRes.json();
      if (!rRes.ok) throw new Error("Failed to load report");
      setScanId(data.scan_id); setReport(rData); setView("dashboard");
    } catch (e) { setError(e.message); setView("landing"); }
  }

  async function loadScan(id) {
    try {
      const res  = await fetch(`${API}/report/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error("Failed to load scan");
      setScanId(id); setReport(data); setView("dashboard");
    } catch (e) { setError(e.message); }
  }

  async function handleTag(subId, isGhost, reason) {
    await fetch(`${API}/subscriptions/${subId}/tag`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ is_ghost: isGhost, reason }),
    });
    const rRes = await fetch(`${API}/report/${scanId}`);
    setReport(await rRes.json());
  }

  const nav = { token, user, onLogout: handleLogout, onLogin: handleLogin, onHome: () => setView("landing"), onProfile: () => setView("profile") };

  if (view === "init")      return null;
  if (view === "auth")      return <Auth onAuth={handleAuth} />;
  if (view === "uploading") return <Uploading />;
  if (view === "profile")   return <Profile {...nav} onSelectScan={loadScan} />;
  if (view === "dashboard") return <Dashboard report={report} onTag={handleTag} onReset={() => setView("landing")} {...nav} />;
  return <Landing onUpload={handleUpload} error={error} {...nav} />;
}
