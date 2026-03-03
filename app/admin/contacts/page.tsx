import Link from "next/link";
import styles from "../entity-page.module.css";

export default function ContactsPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>CRM</p>
        <h1 className={styles.title}>Contacts</h1>
        <Link href="/admin/contacts/new" className={styles.inlineTextLink}>
          Add new contact
        </Link>
      </header>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Relationship model</h2>
        <ul className={styles.list}>
          <li>One contact can have multiple employment records over time.</li>
          <li>Each employment record links a contact to a client.</li>
          <li>Current employer is defined by active employment dates.</li>
        </ul>
      </section>
    </main>
  );
}
