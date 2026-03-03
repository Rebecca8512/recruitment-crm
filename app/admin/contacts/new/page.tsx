import Link from "next/link";
import styles from "../../entity-page.module.css";

export default function NewContactPlaceholderPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>CRM</p>
        <h1 className={styles.title}>Add Contact</h1>
        <p className={styles.lead}>Contact form will be built next.</p>
        <Link href="/admin/contacts" className={styles.inlineTextLink}>
          Back to contacts
        </Link>
      </header>
    </main>
  );
}
