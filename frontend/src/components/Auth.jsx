import { useState } from "react";
import styles from "./Auth.module.css";

const API = import.meta.env.VITE_API_URL || "/api";

export default function Auth({ onAuth }) {
  const [mode,    setMode]    = useState("login");
  const [email,   setEmail]   = useState("");
  const [pass,    setPass]    = useState("");
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res  = await fetch(`${API}/auth/${mode === "login" ? "login" : "register"}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: email.trim(), password: pass }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Something went wrong");
      onAuth(data.token, data.user);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function switchMode(m) { setMode(m); setError(""); setEmail(""); setPass(""); }

  return (
    <div className={styles.page}>
      <div className={styles.glow} />
      <header className={styles.header}>
        <span className={styles.logo}>GHOST<span>SUBS</span></span>
      </header>

      <main className={styles.main}>
        <div className={`${styles.card} fade-up`}>
          <div className={styles.tabs}>
            <button className={`${styles.tab} ${mode === "login"  ? styles.active : ""}`} onClick={() => switchMode("login")}>Log in</button>
            <button className={`${styles.tab} ${mode === "signup" ? styles.active : ""}`} onClick={() => switchMode("signup")}>Sign up</button>
          </div>

          <div className={styles.body}>
            <h2 className={styles.title}>{mode === "login" ? "Welcome back" : "Create account"}</h2>
            <p className={styles.sub}>{mode === "login" ? "Log in to see your scan history" : "Sign up to save scans across sessions"}</p>

            <form onSubmit={submit} className={styles.form}>
              <div className={styles.field}>
                <label>Email</label>
                <input type="email" placeholder="you@example.com" value={email}
                  onChange={e => setEmail(e.target.value)} required autoFocus />
              </div>
              <div className={styles.field}>
                <label>Password</label>
                <input type="password" placeholder={mode === "signup" ? "Min. 6 characters" : "Your password"}
                  value={pass} onChange={e => setPass(e.target.value)} required />
              </div>
              {error && <p className={styles.error}>⚠ {error}</p>}
              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? "…" : mode === "login" ? "Log in" : "Create account"}
              </button>
            </form>

            <p className={styles.guest}>
              Or <button className={styles.guestBtn} onClick={() => onAuth(null, null)}>continue as guest</button> — scans won't be saved.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
