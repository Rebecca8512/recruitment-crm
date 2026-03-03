"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/src/lib/supabase";
import styles from "../entity-page.module.css";

type ClientRow = {
  id: string;
  name: string;
  contact_number: string | null;
  status_code: string | null;
};

type StatusRow = {
  code: string;
  label: string;
};

export default function ClientsPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      const [{ data: statusData, error: statusError }, { data: clientsData, error }] =
        await Promise.all([
          supabase.from("client_statuses").select("code,label"),
          supabase
            .from("clients")
            .select("id,name,contact_number,status_code")
            .order("name", { ascending: true }),
        ]);

      if (!isMounted) return;

      if (statusError) {
        setErrorMessage(statusError.message);
        setIsLoading(false);
        return;
      }

      if (error) {
        setErrorMessage(error.message);
        setIsLoading(false);
        return;
      }

      const map = ((statusData ?? []) as StatusRow[]).reduce<
        Record<string, string>
      >((acc, row) => {
        acc[row.code] = row.label;
        return acc;
      }, {});

      setStatusMap(map);
      setClients((clientsData ?? []) as ClientRow[]);
      setIsLoading(false);
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <div>
            <p className={styles.eyebrow}>CRM</p>
            <h1 className={styles.title}>Clients</h1>
            <p className={styles.lead}>
              Businesses you work with, including cold outreach prospects and
              active accounts.
            </p>
          </div>
          <Link href="/admin/clients/new" className={styles.actionLink}>
            + Add Client
          </Link>
        </div>
      </header>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Client CRM</h2>
        <p className={styles.lead}>
          Quick view of active client records with direct access to profile pages.
        </p>

        {isLoading ? <p className={styles.infoText}>Loading clients...</p> : null}
        {errorMessage ? <p className={styles.errorText}>{errorMessage}</p> : null}

        {!isLoading && !errorMessage ? (
          clients.length > 0 ? (
            <div className={styles.tableWrap}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Client Name</th>
                    <th>Contact Number</th>
                    <th>Status</th>
                    <th>Profile</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr key={client.id}>
                      <td>{client.name}</td>
                      <td>{client.contact_number || "-"}</td>
                      <td>
                        <span className={styles.statusBadge}>
                          {client.status_code
                            ? (statusMap[client.status_code] ?? client.status_code)
                            : "Unassigned"}
                        </span>
                      </td>
                      <td>
                        <Link
                          href={`/admin/clients/${client.id}`}
                          className={styles.tableActionLink}
                        >
                          Open Profile
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.infoText}>
              No clients yet. Click <strong>+ Add Client</strong> to create your
              first record.
            </p>
          )
        ) : null}
      </section>
    </main>
  );
}
