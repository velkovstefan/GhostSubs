import { useState, useRef } from "react";
import styles from "./Landing.module.css";

export default function Landing({ onUpload, error, user, onLogout, onLogin, onProfile }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  function handleDrop(e) {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onUpload(file);
  }

  function handleChange(e) {
    const file = e.target.files[0];
    if (file) onUpload(file);
  }

  return (
    <div className={styles.page}>
      <div className={styles.noise} />

      <header className={styles.header}>
        <span className={styles.logo}>GHOST<span>SUBS</span></span>
        <div className={styles.headerRight}>
          {user ? (
            <>
              <button className={styles.navBtn} onClick={onProfile}>My scans</button>
              <span className={styles.emailBadge}>{user.email}</span>
              <button className={styles.navBtn} onClick={onLogout}>Log out</button>
            </>
          ) : (
            <>
              <button className={styles.navBtn} onClick={onLogout}>Log in</button>
              <span className={styles.badge}>Powered by Gemini 3.1 Flash Lite</span>
            </>
            
          )}
        </div>
      </header>

      <main className={styles.main}>
        <div className={`${styles.hero} fade-up`}>
          <div className={styles.tag}>AI-powered bank CSV analysis</div>
          <h1 className={styles.title}>Find your<br />ghost subs.</h1>
          <p className={styles.sub}>
            Upload your bank export. Gemini 3.1 Flash Lite scans every transaction,
            detects recurring charges, and flags the ones quietly haunting your bank account.
          </p>
        </div>

        <div
          className={`${styles.dropzone} ${dragging ? styles.dragging : ""} fade-up fade-up-2`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current.click()}
          role="button" tabIndex={0}
          onKeyDown={e => e.key === "Enter" && inputRef.current.click()}
          aria-label="Upload CSV file"
        >
          <input ref={inputRef} type="file" accept=".csv" onChange={handleChange} hidden />
          <div className={styles.dropIcon}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 15V3m0 0L8 7m4-4l4 4M2 17l.621 2.485A2 2 0 004.561 21h14.878a2 2 0 001.94-1.515L22 17"/>
            </svg>
          </div>
          <p className={styles.dropLabel}>Drop your bank CSV here</p>
          <p className={styles.dropHint}>or click to browse · works with any bank export</p>
        </div>

        {error && <div className={`${styles.error} fade-up`}>⚠ {error}</div>}

        <div className={`${styles.steps} fade-up fade-up-3`}>
          {[
            { n: "01", t: "Export CSV", d: "Download transactions from your bank or card app" },
            { n: "02", t: "AI analysis", d: "Gemini 3.1 Flash Lite spots every recurring charge" },
            { n: "03", t: "See the ghosts", d: "Review flagged subs and see your wasted money" },
          ].map(s => (
            <div key={s.n} className={styles.step}>
              <span className={styles.stepNum}>{s.n}</span>
              <strong>{s.t}</strong>
              <span>{s.d}</span>
            </div>
          ))}
        </div>

        <div className={`${styles.banks} fade-up fade-up-4`}>
          <span className={styles.banksLabel}>Works with</span>
          {["Chase", "Bank of America", "Wells Fargo", "Revolut", "N26", "Monzo", "Any bank"].map(b => (
            <span key={b} className={styles.bankTag}>{b}</span>
          ))}
        </div>
      </main>
    </div>
  );
}
