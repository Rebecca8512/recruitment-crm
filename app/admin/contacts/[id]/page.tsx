"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/src/lib/supabase";
import styles from "./profile.module.css";

type ContactRecord = {
  id: string;
  first_name: string;
  last_name: string;
  department: string | null;
  email: string | null;
  secondary_email: string | null;
  job_title: string | null;
  work_phone: string | null;
  mobile: string | null;
  phone: string | null;
  source: string | null;
  marketing_email_opt_out: boolean;
  notes: string | null;
  linkedin_url: string | null;
  x_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  updated_at: string;
};

type EmploymentRecord = {
  client_id: string | null;
  is_primary: boolean | null;
  start_date: string | null;
  end_date: string | null;
};

type ClientRecord = {
  id: string;
  name: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TABS = ["Overview", "Social Links"] as const;

export default function ContactProfilePage() {
  const params = useParams<{ id?: string }>();
  const contactId = Array.isArray(params.id) ? params.id[0] : params.id;
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [contact, setContact] = useState<ContactRecord | null>(null);
  const [clientName, setClientName] = useState<string>("-");
  const [clientId, setClientId] = useState<string | null>(null);
  const [statusLabel, setStatusLabel] = useState("Unassigned");
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("Overview");

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!contactId || !UUID_PATTERN.test(contactId)) {
        setErrorMessage("Invalid contact id.");
        setIsLoading(false);
        return;
      }

      const [
        { data: contactData, error: contactError },
        { data: employmentsData, error: employmentsError },
      ] = await Promise.all([
        supabase
          .from("contacts")
          .select(
            "id,first_name,last_name,department,email,secondary_email,job_title,work_phone,mobile,phone,source,marketing_email_opt_out,notes,linkedin_url,x_url,facebook_url,instagram_url,updated_at",
          )
          .eq("id", contactId)
          .maybeSingle<ContactRecord>(),
        supabase
          .from("contact_employments")
          .select("client_id,is_primary,start_date,end_date")
          .eq("contact_id", contactId),
      ]);

      if (!isMounted) return;

      if (contactError) {
        setErrorMessage(contactError.message);
        setIsLoading(false);
        return;
      }

      if (employmentsError) {
        setErrorMessage(employmentsError.message);
        setIsLoading(false);
        return;
      }

      if (!contactData) {
        setErrorMessage("Contact not found.");
        setIsLoading(false);
        return;
      }

      const employments = (employmentsData ?? []) as EmploymentRecord[];
      const linkedRows = employments.filter((row) => Boolean(row.client_id));

      if (linkedRows.length === 0) {
        setStatusLabel("Unassigned");
      } else {
        const hasActiveLink = linkedRows.some((row) => !row.end_date);
        setStatusLabel(hasActiveLink ? "Assigned" : "Previous");
      }

      const prioritized = [...linkedRows].sort((a, b) => {
        const aPrimary = a.is_primary && !a.end_date ? 1 : 0;
        const bPrimary = b.is_primary && !b.end_date ? 1 : 0;
        if (aPrimary !== bPrimary) return bPrimary - aPrimary;

        const aActive = !a.end_date ? 1 : 0;
        const bActive = !b.end_date ? 1 : 0;
        if (aActive !== bActive) return bActive - aActive;

        const aStart = a.start_date ? new Date(a.start_date).getTime() : 0;
        const bStart = b.start_date ? new Date(b.start_date).getTime() : 0;
        return bStart - aStart;
      });

      const preferredClientId = prioritized[0]?.client_id;
      if (preferredClientId) {
        const { data: clientData } = await supabase
          .from("clients")
          .select("id,name")
          .eq("id", preferredClientId)
          .maybeSingle<ClientRecord>();

        if (isMounted) {
          setClientId(clientData?.id ?? null);
          setClientName(clientData?.name ?? "-");
        }
      }

      setContact(contactData);
      setIsLoading(false);
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [contactId, supabase]);

  if (isLoading) {
    return (
      <main className={styles.page}>
        <p className={styles.infoText}>Loading contact profile...</p>
      </main>
    );
  }

  if (errorMessage || !contact) {
    return (
      <main className={styles.page}>
        <div className={styles.headerRow}>
          <Link href="/admin/contacts" className={styles.backLink}>
            Back to Contacts
          </Link>
        </div>
        <p className={styles.errorText}>{errorMessage || "Contact not found."}</p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.headerRow}>
        <div>
          <p className={styles.eyebrow}>Contact Profile</p>
          <h1 className={styles.title}>
            {contact.first_name} {contact.last_name}
          </h1>
        </div>
        <Link href="/admin/contacts" className={styles.backLink}>
          Back to Contacts
        </Link>
      </header>

      <section className={styles.tabsCard}>
        <div className={styles.tabsWrap}>
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`${styles.tabButton} ${activeTab === tab ? styles.tabButtonActive : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </section>

      {activeTab === "Overview" ? (
        <section className={styles.detailsCard}>
          <div className={styles.detailsHeader}>
            <h2 className={styles.detailsTitle}>Overview</h2>
            <Link href={`/admin/contacts/${contact.id}/edit`} className={styles.editLink}>
              Edit details
            </Link>
          </div>
          <dl className={styles.detailsGrid}>
            <div>
              <dt>Status</dt>
              <dd>{statusLabel}</dd>
            </div>
            <div>
              <dt>Client</dt>
              <dd>
                {clientId ? (
                  <Link href={`/admin/clients/${clientId}`} className={styles.subtleLink}>
                    {clientName}
                  </Link>
                ) : (
                  clientName
                )}
              </dd>
            </div>
            <div>
              <dt>Contact Name</dt>
              <dd>
                {contact.first_name} {contact.last_name}
              </dd>
            </div>
            <div>
              <dt>Department</dt>
              <dd>{contact.department || "-"}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{contact.email || "-"}</dd>
            </div>
            <div>
              <dt>Secondary Email</dt>
              <dd>{contact.secondary_email || "-"}</dd>
            </div>
            <div>
              <dt>Job Title</dt>
              <dd>{contact.job_title || "-"}</dd>
            </div>
            <div>
              <dt>Work Phone</dt>
              <dd>{contact.work_phone || contact.phone || "-"}</dd>
            </div>
            <div>
              <dt>Mobile</dt>
              <dd>{contact.mobile || "-"}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{contact.source || "-"}</dd>
            </div>
            <div>
              <dt>Marketing Email Opt Out</dt>
              <dd>{contact.marketing_email_opt_out ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt>Last Updated</dt>
              <dd>{new Date(contact.updated_at).toLocaleDateString("en-GB")}</dd>
            </div>
            <div className={styles.notesBlockInline}>
              <dt>Notes</dt>
              <dd>{contact.notes || "-"}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      {activeTab === "Social Links" ? (
        <section className={styles.detailsCard}>
          <div className={styles.detailsHeader}>
            <h2 className={styles.detailsTitle}>Social Links</h2>
          </div>
          <dl className={styles.detailsGrid}>
            <div>
              <dt>LinkedIn</dt>
              <dd>
                {contact.linkedin_url ? (
                  <a
                    href={contact.linkedin_url}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.subtleLink}
                  >
                    Open
                  </a>
                ) : (
                  "-"
                )}
              </dd>
            </div>
            <div>
              <dt>X</dt>
              <dd>
                {contact.x_url ? (
                  <a
                    href={contact.x_url}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.subtleLink}
                  >
                    Open
                  </a>
                ) : (
                  "-"
                )}
              </dd>
            </div>
            <div>
              <dt>Facebook</dt>
              <dd>
                {contact.facebook_url ? (
                  <a
                    href={contact.facebook_url}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.subtleLink}
                  >
                    Open
                  </a>
                ) : (
                  "-"
                )}
              </dd>
            </div>
            <div>
              <dt>Instagram</dt>
              <dd>
                {contact.instagram_url ? (
                  <a
                    href={contact.instagram_url}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.subtleLink}
                  >
                    Open
                  </a>
                ) : (
                  "-"
                )}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}
    </main>
  );
}
