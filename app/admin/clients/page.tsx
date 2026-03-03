import styles from "../entity-page.module.css";

export default function ClientsPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>CRM</p>
        <h1 className={styles.title}>Clients</h1>
        <p className={styles.lead}>
          Businesses you work with, including cold outreach prospects and active
          accounts.
        </p>
      </header>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Default statuses</h2>
        <ul className={styles.list}>
          <li>Prospect</li>
          <li>Nurturing</li>
          <li>Active Client</li>
          <li>Dormant</li>
          <li>Archived</li>
        </ul>
      </section>
    </main>
  );
}
