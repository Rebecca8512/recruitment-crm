import Link from "next/link";
import styles from "../../entity-page.module.css";

export default function NewRolePlaceholderPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>CRM</p>
        <h1 className={styles.title}>Add Role</h1>
        <p className={styles.lead}>Role form will be built next.</p>
        <Link href="/admin/roles" className={styles.inlineTextLink}>
          Back to roles
        </Link>
      </header>
    </main>
  );
}
