import { useState, useEffect } from "react";
import styles from "./Profile.module.css";

const API = import.meta.env.VITE_API_URL || "/api";
const INTERVAL_LABEL = { weekly: "/wk", monthly: "/mo", yearly: "/yr", unknown: "" };

function fmt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function Profile({ token, user, onLogout, onHome, onSelectScan }) {
  const [scans,    setScans]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [details,  setDetails]  = useState({});

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/scans`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { setScans(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  async function toggleScan(scanId) {
    if (expanded === scanId) { setExpanded(null); return; }
    setExpanded(scanId);
    if (!details[scanId]) {
      const res  = await fetch(`${API}/report/${scanId}`);
      const data = await res.json();
      setDetails(d => ({ ...d, [scanId]: data }));
    }
  }

  const totalGhostly = scans.reduce((sum, s) => sum + s.ghost_monthly, 0);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.back} onClick={onHome}>← Back</button>
        <span className={styles.logo}>GHOST<span>SUBS</span></span>
        <button className={styles.logoutBtn} onClick={onLogout}>Log out</button>
      </header>

      <main className={styles.main}>
        {/* Profile hero */}
        <div className={`${styles.hero} fade-up`}>
          <div className={styles.avatar}>{user?.email?.[0]?.toUpperCase() || "G"}</div>
          <div>
            <h1 className={styles.email}>{user?.email}</h1>
            <p className={styles.since}>Member since {fmt(user?.created_at)}</p>
          </div>
        </div>

        {/* Summary stats */}
        {scans.length > 0 && (
          <div className={`${styles.stats} fade-up fade-up-1`}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Total scans</span>
              <span className={styles.statValue}>{scans.length}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Ghost subs found</span>
              <span className={styles.statValue}>{scans.reduce((s, sc) => s + sc.ghost_count, 0)}</span>
            </div>
            <div className={`${styles.stat} ${styles.accentStat}`}>
              <span className={styles.statLabel}>Latest ghost waste</span>
              <span className={styles.statValue}>${scans[0]?.ghost_monthly?.toFixed(2) || "0.00"}/mo</span>
            </div>
          </div>
        )}

        {/* Scan list */}
        <div className={`${styles.section} fade-up fade-up-2`}>
          <h2 className={styles.sectionTitle}>Scan history</h2>

          {loading && <p className={styles.empty}>Loading…</p>}
          {!loading && scans.length === 0 && (
            <div className={styles.emptyCard}>
              <p className={styles.emptyTitle}>No scans yet</p>
              <p className={styles.emptySub}>Upload your first bank CSV to get started.</p>
              <button className={styles.uploadBtn} onClick={onHome}>Upload CSV →</button>
            </div>
          )}

          {scans.map((sc, i) => (
            <div key={sc.scan_id} className={`${styles.scanCard} fade-up`} style={{ animationDelay: `${i * 0.04}s` }}>
              <div className={styles.scanHeader} onClick={() => toggleScan(sc.scan_id)}>
                <div className={styles.scanLeft}>
                  <span className={styles.scanDate}>{fmt(sc.created_at)}</span>
                  <div className={styles.scanBadges}>
                    <span className={styles.badge}>{sc.total_subs} subscriptions</span>
                    {sc.ghost_count > 0 && <span className={styles.ghostBadge}>{sc.ghost_count} ghost</span>}
                  </div>
                </div>
                <div className={styles.scanRight}>
                  <div className={styles.scanAmounts}>
                    <span className={styles.scanTotal}>${sc.monthly_spend.toFixed(2)}/mo total</span>
                    {sc.ghost_monthly > 0 && (
                      <span className={styles.scanWasted}>${sc.ghost_monthly.toFixed(2)} ghosted</span>
                    )}
                  </div>
                  <div className={styles.scanActions}>
                    <button className={styles.viewBtn} onClick={e => { e.stopPropagation(); onSelectScan(sc.scan_id); }}>
                      View report →
                    </button>
                    <span className={styles.chevron}>{expanded === sc.scan_id ? "▲" : "▼"}</span>
                  </div>
                </div>
              </div>

              {/* Expanded subscription list */}
              {expanded === sc.scan_id && (
                <div className={styles.scanDetail}>
                  {!details[sc.scan_id] && <p className={styles.loadingDetail}>Loading…</p>}
                  {details[sc.scan_id]?.subscriptions?.map(sub => (
                    <div key={sub.id} className={`${styles.subRow} ${sub.is_ghost ? styles.ghostRow : ""}`}>
                      <div className={styles.subInfo}>
                        <span className={styles.subName}>{sub.name}</span>
                        <span className={styles.subCat}>{sub.category}</span>
                        {sub.is_ghost && sub.reason && (
                          <span className={styles.subReason}>👻 {sub.reason}</span>
                        )}
                      </div>
                      <div className={styles.subMeta}>
                        <span className={styles.subAmount}>${sub.amount.toFixed(2)}{INTERVAL_LABEL[sub.interval] || ""}</span>
                        {sub.is_ghost && <span className={styles.ghostTag}>ghost</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
