import { useState } from "react";
import styles from "./Dashboard.module.css";

const CATEGORY_ICONS = {
  streaming: "▶", software: "⌨", news: "◉", fitness: "◈",
  food: "◆", finance: "◎", gaming: "◑", cloud: "◐", other: "◇",
};
const INTERVAL_LABEL = { weekly: "/wk", monthly: "/mo", yearly: "/yr", unknown: "" };

function toMonthly(amount, interval) {
  if (interval === "weekly") return amount * 4;
  if (interval === "yearly") return amount / 12;
  return amount;
}

function SubCard({ sub, onTag }) {
  const [expanded, setExpanded] = useState(false);
  const [loading,  setLoading]  = useState(false);

  async function tag(isGhost) {
    setLoading(true);
    await onTag(sub.id, isGhost, isGhost ? sub.reason : null);
    setLoading(false);
    setExpanded(false);
  }

  return (
    <div className={`${styles.subCard} ${sub.is_ghost ? styles.ghost : ""} fade-up`}
      onClick={() => setExpanded(e => !e)}>
      <div className={styles.subTop}>
        <div className={styles.subLeft}>
          <span className={styles.subIcon}>{CATEGORY_ICONS[sub.category] || "◇"}</span>
          <div>
            <p className={styles.subName}>{sub.name}</p>
            <p className={styles.subMeta}>
              <span className={styles.subCat}>{sub.category}</span>
              <span>·</span>
              <span>last seen {sub.last_seen}</span>
            </p>
          </div>
        </div>
        <div className={styles.subRight}>
          <span className={styles.subAmount}>
            ${sub.amount.toFixed(2)}
            <span className={styles.subInterval}>{INTERVAL_LABEL[sub.interval] || ""}</span>
          </span>
          {sub.is_ghost && <span className={styles.ghostBadge}>👻 GHOST</span>}
        </div>
      </div>

      {expanded && (
        <div className={styles.subDetail} onClick={e => e.stopPropagation()}>
          {sub.reason && (
            <p className={styles.subReason}>👻 {sub.reason}</p>
          )}
          <p className={styles.subMonthly}>
            ≈ ${toMonthly(sub.amount, sub.interval).toFixed(2)}/month
            · ${(toMonthly(sub.amount, sub.interval) * 12).toFixed(2)}/year
          </p>
          <div className={styles.tagBtns}>
            <button className={`${styles.tagBtn} ${styles.tagGhost}`} onClick={() => tag(true)} disabled={loading}>
              {loading ? "…" : "Mark as ghost 👻"}
            </button>
            <button className={`${styles.tagBtn} ${styles.tagActive}`} onClick={() => tag(false)} disabled={loading}>
              {loading ? "…" : "Still using ✓"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard({ report, user, onTag, onReset, onLogout, onProfile }) {
  const [filter, setFilter] = useState("all");
  if (!report) return null;

  const subs     = report.subscriptions || [];
  const filtered = filter === "ghost"  ? subs.filter(s => s.is_ghost)
                 : filter === "active" ? subs.filter(s => !s.is_ghost)
                 : subs;

  const pct = report.total_monthly_spend > 0
    ? Math.round((report.ghost_monthly / report.total_monthly_spend) * 100) : 0;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.logo}>GHOST<span>SUBS</span></span>
        <div className={styles.headerRight}>
          {user && <button className={styles.navBtn} onClick={onProfile}>My scans</button>}
          {user && <span className={styles.emailBadge}>{user.email}</span>}
          <button className={styles.navBtn} onClick={onReset}>← New scan</button>
          {user && <button className={styles.navBtn} onClick={onLogout}>Log out</button>}
        </div>
      </header>

      <main className={styles.main}>
        <div className={`${styles.headline} fade-up`}>
          <h1 className={styles.title}>
            {report.ghost_monthly > 0
              ? <>${`You're ghosting `}<span className={styles.accent}>${report.ghost_monthly.toFixed(2)}/mo</span></>
              : "No ghost subscriptions found 🎉"}
          </h1>
          <p className={styles.sub}>
            {report.ghost_count} of {report.total_subscriptions} subscriptions flagged as ghost
            {report.ghost_monthly > 0 && ` · ${pct}% of your monthly spend`}
          </p>
        </div>

        <div className={`${styles.stats} fade-up fade-up-1`}>
          {[
            { label: "Monthly spend",   value: `$${report.total_monthly_spend.toFixed(2)}`, sub: "all subscriptions" },
            { label: "Ghosted / month", value: `$${report.ghost_monthly.toFixed(2)}`,       sub: `${pct}% of total`, accent: true },
            { label: "Ghosted / year",  value: `$${report.ghost_yearly.toFixed(2)}`,        sub: "if nothing changes" },
            { label: "Subscriptions",   value: report.total_subscriptions,                  sub: `${report.ghost_count} ghost` },
          ].map(s => (
            <div key={s.label} className={`${styles.stat} ${s.accent ? styles.accentStat : ""}`}>
              <span className={styles.statLabel}>{s.label}</span>
              <span className={styles.statValue}>{s.value}</span>
              <span className={styles.statSub}>{s.sub}</span>
            </div>
          ))}
        </div>

        <div className={`${styles.filters} fade-up fade-up-2`}>
          {[
            { key: "all",    label: `All (${subs.length})` },
            { key: "ghost",  label: `Ghost (${subs.filter(s => s.is_ghost).length})` },
            { key: "active", label: `Active (${subs.filter(s => !s.is_ghost).length})` },
          ].map(f => (
            <button key={f.key}
              className={`${styles.filterBtn} ${filter === f.key ? styles.activeFilter : ""}`}
              onClick={() => setFilter(f.key)}>{f.label}</button>
          ))}
          <span className={styles.filterHint}>Click any card to tag it</span>
        </div>

        <div className={styles.subList}>
          {filtered.length === 0 && <div className={styles.empty}>No subscriptions in this view.</div>}
          {filtered.map((sub, i) => (
            <div key={sub.id} style={{ animationDelay: `${i * 0.04}s` }}>
              <SubCard sub={sub} onTag={onTag} />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
