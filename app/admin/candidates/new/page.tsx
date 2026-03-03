import Link from "next/link";
import styles from "../../entity-page.module.css";

export default function NewCandidatePlaceholderPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>CRM</p>
        <h1 className={styles.title}>Add Candidate</h1>
        <p className={styles.lead}>Candidate form will be built next.</p>
        <Link href="/admin/candidates" className={styles.inlineTextLink}>
          Back to candidates
        </Link>
      </header>
    </main>
  );
}
