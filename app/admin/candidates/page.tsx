import Link from "next/link";
import styles from "../entity-page.module.css";

export default function CandidatesPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>CRM</p>
        <h1 className={styles.title}>Candidates</h1>
        <Link href="/admin/candidates/new" className={styles.inlineTextLink}>
          Add new candidate
        </Link>
      </header>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Default statuses</h2>
        <ul className={styles.list}>
          <li>New</li>
          <li>Screening</li>
          <li>Shortlisted</li>
          <li>Interviewing</li>
          <li>Offered</li>
          <li>Placed</li>
          <li>Unavailable</li>
        </ul>
      </section>
    </main>
  );
}
