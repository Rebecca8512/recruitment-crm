"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/src/lib/supabase";
import styles from "./profile.module.css";

type RoleRecord = {
  id: string;
  title: string;
  client_id: string | null;
  contact_id: string | null;
  job_type: string;
  status_code: string;
  salary_text: string | null;
  total_expected_revenue: string | null;
  expected_revenue_per_position: string | null;
  updated_at: string;
};

type StatusRecord = {
  code: string;
  label: string;
};

type ClientRecord = {
  id: string;
  name: string;
};

type ContactRecord = {
  id: string;
  first_name: string;
  last_name: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function formatJobType(value: string) {
  if (!value) return "-";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function RoleProfilePage() {
  const params = useParams<{ id?: string }>();
  const roleId = Array.isArray(params.id) ? params.id[0] : params.id;
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [role, setRole] = useState<RoleRecord | null>(null);
  const [statusLabel, setStatusLabel] = useState("-");
  const [clientName, setClientName] = useState("-");
  const [contactName, setContactName] = useState("-");

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!roleId || !UUID_PATTERN.test(roleId)) {
        setErrorMessage("Invalid role id.");
        setIsLoading(false);
        return;
      }

      const [{ data: roleData, error: roleError }, { data: statusesData }] =
        await Promise.all([
          supabase
            .from("roles")
            .select(
              "id,title,client_id,contact_id,job_type,status_code,salary_text,total_expected_revenue,expected_revenue_per_position,updated_at",
            )
            .eq("id", roleId)
            .maybeSingle<RoleRecord>(),
          supabase.from("role_statuses").select("code,label"),
        ]);

      if (!isMounted) return;

      if (roleError) {
        setErrorMessage(roleError.message);
        setIsLoading(false);
        return;
      }

      if (!roleData) {
        setErrorMessage("Role not found.");
        setIsLoading(false);
        return;
      }

      const statusMap = ((statusesData ?? []) as StatusRecord[]).reduce<
        Record<string, string>
      >((acc, row) => {
        acc[row.code] = row.label;
        return acc;
      }, {});

      setStatusLabel(statusMap[roleData.status_code] ?? roleData.status_code);

      if (roleData.client_id) {
        const { data: clientData } = await supabase
          .from("clients")
          .select("id,name")
          .eq("id", roleData.client_id)
          .maybeSingle<ClientRecord>();
        if (isMounted) setClientName(clientData?.name ?? "-");
      }

      if (roleData.contact_id) {
        const { data: contactData } = await supabase
          .from("contacts")
          .select("id,first_name,last_name")
          .eq("id", roleData.contact_id)
          .maybeSingle<ContactRecord>();
        if (isMounted) {
          setContactName(
            contactData
              ? `${contactData.first_name} ${contactData.last_name}`.trim()
              : "-",
          );
        }
      }

      setRole(roleData);
      setIsLoading(false);
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [roleId, supabase]);

  if (isLoading) {
    return (
      <main className={styles.page}>
        <p className={styles.infoText}>Loading role profile...</p>
      </main>
    );
  }

  if (errorMessage || !role) {
    return (
      <main className={styles.page}>
        <div className={styles.headerRow}>
          <Link href="/admin/roles" className={styles.backLink}>
            Back to Roles
          </Link>
        </div>
        <p className={styles.errorText}>{errorMessage || "Role not found."}</p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.headerRow}>
        <div>
          <p className={styles.eyebrow}>Role Profile</p>
          <h1 className={styles.title}>{role.title}</h1>
        </div>
        <Link href="/admin/roles" className={styles.backLink}>
          Back to Roles
        </Link>
      </header>

      <section className={styles.detailsCard}>
        <div className={styles.detailsHeader}>
          <h2 className={styles.detailsTitle}>Overview</h2>
          <Link href={`/admin/roles/${role.id}/edit`} className={styles.editLink}>
            Edit details
          </Link>
        </div>
        <dl className={styles.detailsGrid}>
          <div>
            <dt>Client</dt>
            <dd>{clientName}</dd>
          </div>
          <div>
            <dt>Contact</dt>
            <dd>{contactName}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{statusLabel}</dd>
          </div>
          <div>
            <dt>Job Type</dt>
            <dd>{formatJobType(role.job_type)}</dd>
          </div>
          <div>
            <dt>Salary</dt>
            <dd>{role.salary_text || "-"}</dd>
          </div>
          <div>
            <dt>Expected Revenue</dt>
            <dd>
              {role.total_expected_revenue || role.expected_revenue_per_position || "-"}
            </dd>
          </div>
          <div>
            <dt>Last Updated</dt>
            <dd>{new Date(role.updated_at).toLocaleDateString("en-GB")}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
