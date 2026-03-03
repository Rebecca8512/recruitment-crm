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
  updated_at: string;
};

type StatusRow = {
  code: string;
  label: string;
};

type RoleRow = {
  client_id: string;
  closed_on: string | null;
  updated_at: string;
};

export default function ClientsPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [openRoleCountMap, setOpenRoleCountMap] = useState<Record<string, number>>(
    {},
  );
  const [lastActivityMap, setLastActivityMap] = useState<Record<string, string>>({});

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      const [
        { data: statusData, error: statusError },
        { data: clientsData, error },
        { data: rolesData, error: rolesError },
      ] = await Promise.all([
        supabase.from("client_statuses").select("code,label"),
        supabase
          .from("clients")
          .select("id,name,contact_number,status_code,updated_at")
          .order("name", { ascending: true }),
        supabase.from("roles").select("client_id,closed_on,updated_at"),
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

      if (rolesError) {
        setErrorMessage(rolesError.message);
        setIsLoading(false);
        return;
      }

      const map = ((statusData ?? []) as StatusRow[]).reduce<
        Record<string, string>
      >((acc, row) => {
        acc[row.code] = row.label;
        return acc;
      }, {});

      const roleRows = (rolesData ?? []) as RoleRow[];
      const openRoles: Record<string, number> = {};
      const roleLastActivity: Record<string, number> = {};

      for (const role of roleRows) {
        if (!role.closed_on) {
          openRoles[role.client_id] = (openRoles[role.client_id] ?? 0) + 1;
        }

        const roleUpdated = new Date(role.updated_at).getTime();
        roleLastActivity[role.client_id] = Math.max(
          roleLastActivity[role.client_id] ?? 0,
          roleUpdated,
        );
      }

      const clientsRows = (clientsData ?? []) as ClientRow[];
      const lastActivity: Record<string, string> = {};

      for (const client of clientsRows) {
        const clientUpdated = new Date(client.updated_at).getTime();
        const latest = Math.max(clientUpdated, roleLastActivity[client.id] ?? 0);
        lastActivity[client.id] = new Date(latest).toISOString();
      }

      setStatusMap(map);
      setOpenRoleCountMap(openRoles);
      setLastActivityMap(lastActivity);
      setClients(clientsRows);
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
        <p className={styles.eyebrow}>CRM</p>
        <h1 className={styles.title}>Clients</h1>
        <Link href="/admin/clients/new" className={styles.inlineTextLink}>
          Add new client
        </Link>
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
                    <th>Open Roles</th>
                    <th>Last Activity</th>
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
                      <td>{openRoleCountMap[client.id] ?? 0}</td>
                      <td>
                        {lastActivityMap[client.id]
                          ? new Date(lastActivityMap[client.id]).toLocaleDateString(
                              "en-GB",
                            )
                          : "-"}
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
              No clients yet. Click <strong>Add new client</strong> to create your
              first record.
            </p>
          )
        ) : null}
      </section>
    </main>
  );
}
