import Link from "next/link";
import styles from "./pipelines.module.css";

type PipelineView = "business-development" | "vacancy-fill";

const VIEW_OPTIONS: { value: PipelineView; label: string }[] = [
  { value: "business-development", label: "Business Development" },
  { value: "vacancy-fill", label: "Vacancy Fill" },
];

function resolveView(view: string | undefined): PipelineView {
  if (view === "vacancy-fill") return "vacancy-fill";
  return "business-development";
}

export default async function PipelinesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawView = params.view;
  const view = resolveView(typeof rawView === "string" ? rawView : undefined);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>CRM</p>
        <h1 className={styles.title}>Pipelines</h1>
      </header>

      <section className={styles.switchCard}>
        <div className={styles.switchRow}>
          {VIEW_OPTIONS.map((option) => {
            const isActive = option.value === view;
            return (
              <Link
                key={option.value}
                href={`/admin/pipelines?view=${option.value}`}
                className={`${styles.switchButton} ${isActive ? styles.switchButtonActive : ""}`}
                aria-current={isActive ? "page" : undefined}
              >
                {option.label}
              </Link>
            );
          })}
        </div>
      </section>

      <section className={styles.placeholderCard}>
        <h2 className={styles.cardTitle}>
          {view === "business-development"
            ? "Business Development Pipeline"
            : "Vacancy Fill Pipeline"}
        </h2>
        <p className={styles.placeholderText}>Pipeline stages will be added here.</p>
      </section>
    </main>
  );
}
