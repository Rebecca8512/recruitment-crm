"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/src/lib/supabase";
import styles from "./profile.module.css";

type ClientRecord = {
  id: string;
  name: string;
  contact_number: string | null;
  email: string | null;
  website: string | null;
  industry: string | null;
  status_code: string | null;
  source: string | null;
  updated_at: string;
};

type StatusRecord = {
  code: string;
  label: string;
};

const TABS = ["Overview", "Contacts", "Roles", "Candidates", "Files"] as const;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function ClientProfilePage() {
  const params = useParams<{ id?: string }>();
  const clientId = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [statusLabel, setStatusLabel] = useState<string>("Unassigned");
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!clientId || !UUID_PATTERN.test(clientId)) {
        setErrorMessage("Invalid client id.");
        setIsLoading(false);
        return;
      }

      const [{ data: clientData, error: clientError }, { data: statuses }] =
        await Promise.all([
          supabase
            .from("clients")
            .select(
              "id,name,contact_number,email,website,industry,status_code,source,updated_at",
            )
            .eq("id", clientId)
            .maybeSingle<ClientRecord>(),
          supabase.from("client_statuses").select("code,label"),
        ]);

      if (!isMounted) return;

      if (clientError) {
        setErrorMessage(clientError.message);
        setIsLoading(false);
        return;
      }

      if (!clientData) {
        setErrorMessage("Client not found.");
        setIsLoading(false);
        return;
      }

      const statusMap = ((statuses ?? []) as StatusRecord[]).reduce<
        Record<string, string>
      >((acc, row) => {
        acc[row.code] = row.label;
        return acc;
      }, {});

      setClient(clientData);
      setStatusLabel(
        clientData.status_code
          ? (statusMap[clientData.status_code] ?? clientData.status_code)
          : "Unassigned",
      );
      setIsLoading(false);
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [clientId, supabase]);

  const handleDeleteClient = async () => {
    if (!clientId || !UUID_PATTERN.test(clientId)) {
      setDeleteError("Invalid client id.");
      return;
    }

    setDeleteError("");
    setIsDeleting(true);

    // Safety first: explicitly unassign relations before deleting the client.
    const { error: rolesUnassignError } = await supabase
      .from("roles")
      .update({ client_id: null })
      .eq("client_id", clientId);

    if (rolesUnassignError) {
      const requiresPatch =
        rolesUnassignError.message.includes("null value") ||
        rolesUnassignError.message.includes("not-null") ||
        rolesUnassignError.message.includes("violates");

      setDeleteError(
        requiresPatch
          ? "Delete blocked by old constraints. Run supabase/client_delete_unassign_patch.sql, then retry."
          : rolesUnassignError.message,
      );
      setIsDeleting(false);
      return;
    }

    const { error: employmentsUnassignError } = await supabase
      .from("contact_employments")
      .update({ client_id: null })
      .eq("client_id", clientId);

    if (employmentsUnassignError) {
      const requiresPatch =
        employmentsUnassignError.message.includes("null value") ||
        employmentsUnassignError.message.includes("not-null") ||
        employmentsUnassignError.message.includes("violates");

      setDeleteError(
        requiresPatch
          ? "Delete blocked by old constraints. Run supabase/client_delete_unassign_patch.sql, then retry."
          : employmentsUnassignError.message,
      );
      setIsDeleting(false);
      return;
    }

    const { error } = await supabase.from("clients").delete().eq("id", clientId);

    if (error) {
      const requiresPatch =
        error.message.includes("roles_client_id_fkey") ||
        error.message.includes("contact_employments_client_id_fkey");

      setDeleteError(
        requiresPatch
          ? "Delete blocked by old constraints. Run supabase/client_delete_unassign_patch.sql, then retry."
          : error.message,
      );
      setIsDeleting(false);
      return;
    }

    router.push("/admin/clients");
  };

  if (isLoading) {
    return (
      <main className={styles.page}>
        <p className={styles.infoText}>Loading client profile...</p>
      </main>
    );
  }

  if (errorMessage || !client) {
    return (
      <main className={styles.page}>
        <div className={styles.headerRow}>
          <Link href="/admin/clients" className={styles.backLink}>
            Back to Clients
          </Link>
        </div>
        <p className={styles.errorText}>{errorMessage || "Client not found."}</p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.headerRow}>
        <div>
          <p className={styles.eyebrow}>Client Profile</p>
          <h1 className={styles.title}>{client.name}</h1>
          <p className={styles.subtitle}>
            Last updated: {new Date(client.updated_at).toLocaleDateString("en-GB")}
          </p>
        </div>
        <Link href="/admin/clients" className={styles.backLink}>
          Back to Clients
        </Link>
      </header>

      <section className={styles.tabsCard}>
        <div className={styles.tabsWrap}>
          {TABS.map((tab, index) => (
            <button
              key={tab}
              className={`${styles.tabButton} ${index === 0 ? styles.tabButtonActive : ""}`}
              type="button"
            >
              {tab}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.detailsCard}>
        <div className={styles.detailsHeader}>
          <h2 className={styles.detailsTitle}>Overview</h2>
          <Link href={`/admin/clients/${client.id}/edit`} className={styles.editLink}>
            Edit details
          </Link>
        </div>
        <dl className={styles.detailsGrid}>
          <div>
            <dt>Status</dt>
            <dd>{statusLabel}</dd>
          </div>
          <div>
            <dt>Contact Number</dt>
            <dd>{client.contact_number || "-"}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{client.email || "-"}</dd>
          </div>
          <div>
            <dt>Website</dt>
            <dd>{client.website || "-"}</dd>
          </div>
          <div>
            <dt>Industry</dt>
            <dd>{client.industry || "-"}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>{client.source || "-"}</dd>
          </div>
        </dl>

        <div className={styles.deleteSection}>
          <button
            type="button"
            className={styles.deleteLink}
            onClick={() => setShowDeleteWarning((value) => !value)}
          >
            Delete client
          </button>

          {showDeleteWarning ? (
            <div className={styles.deleteWarningCard}>
              <p className={styles.deleteWarningTitle}>Delete this client?</p>
              <p className={styles.deleteWarningText}>
                This permanently removes the client profile. Contacts, roles, and
                candidates are retained and become unassigned.
              </p>
              {deleteError ? (
                <p className={styles.deleteErrorText}>{deleteError}</p>
              ) : null}
              <div className={styles.deleteActions}>
                <button
                  type="button"
                  className={styles.confirmDeleteButton}
                  onClick={handleDeleteClient}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Delete permanently"}
                </button>
                <button
                  type="button"
                  className={styles.cancelDeleteButton}
                  onClick={() => {
                    setShowDeleteWarning(false);
                    setDeleteError("");
                  }}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
