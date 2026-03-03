import styles from "./dashboard.module.css";

export default function DashboardPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Whitmore Recruitment</p>
        <h1 className={styles.title}>Dashboard</h1>
      </header>
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Welcome</h2>
        <p className={styles.cardText}>
          Your CRM shell is ready. Use the left navigation to manage clients,
          contacts, roles, and candidates.
        </p>
      </section>

      <section className={styles.grid}>
        <article className={styles.card}>
          <h3 className={styles.cardTitle}>Pipeline Snapshot</h3>
          <p className={styles.cardText}>
            This area can show live totals by status for active roles and
            candidates.
          </p>
        </article>
        <article className={styles.card}>
          <h3 className={styles.cardTitle}>Revenue Snapshot</h3>
          <p className={styles.cardText}>
            Estimated and realized fee values can be rolled up here once role
            and placement data is entered.
          </p>
        </article>
      </section>
    </main>
  );
}
