import styles from "./Uploading.module.css";

const STEPS = [
  "Reading your CSV…",
  "Sending to Gemini 3.1 Flash Lite…",
  "Detecting recurring charges…",
  "Flagging ghost subscriptions…",
  "Building your report…",
];

export default function Uploading() {
  return (
    <div className={styles.page}>
      <div className={styles.center}>
        <div className={styles.spinner} />
        <h2 className={styles.title}>Hunting for ghost subscriptions</h2>
        <div className={styles.steps}>
          {STEPS.map((s, i) => (
            <div key={s} className={styles.step} style={{ animationDelay: `${i * 0.9}s` }}>
              <span className={styles.dot} style={{ animationDelay: `${i * 0.9}s` }} />
              {s}
            </div>
          ))}
        </div>
        <p className={styles.note}>Gemini 3.1 Flash Lite reads every transaction — usually under 15 seconds.</p>
      </div>
    </div>
  );
}
