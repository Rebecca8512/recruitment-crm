import styles from "../entity-page.module.css";

export default function RolesPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>CRM</p>
        <h1 className={styles.title}>Roles</h1>
        <p className={styles.lead}>
          Jobs opened by clients. A client can own multiple roles, each with its
          own pipeline and fee tracking fields.
        </p>
      </header>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Default statuses</h2>
        <ul className={styles.list}>
          <li>Intake</li>
          <li>Sourcing</li>
          <li>Shortlist</li>
          <li>Interview</li>
          <li>Offer</li>
          <li>Placed</li>
          <li>On Hold</li>
          <li>Closed Lost</li>
        </ul>
      </section>
    </main>
  );
}
