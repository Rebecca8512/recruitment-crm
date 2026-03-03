"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

type EmploymentRecord = {
  id: string;
  contact_id: string;
  job_title: string | null;
  is_primary: boolean | null;
  start_date: string | null;
  end_date: string | null;
  updated_at: string;
};

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
  source: string | null;
  marketing_email_opt_out: boolean;
  notes: string | null;
  linkedin_url: string | null;
  x_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  updated_at: string;
};

type ClientContactRow = {
  id: string;
  fullName: string;
  department: string | null;
  employmentJobTitle: string | null;
  contactJobTitle: string | null;
  email: string | null;
  secondaryEmail: string | null;
  workPhone: string | null;
  mobile: string | null;
  source: string | null;
  marketingEmailOptOut: boolean;
  notes: string | null;
  linkedinUrl: string | null;
  xUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  isPrimary: boolean;
  isActiveEmployment: boolean;
  lastActivity: string;
};

const TABS = ["Overview", "Contacts", "Roles", "Candidates", "Files"] as const;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function ClientProfilePage() {
  const params = useParams<{ id?: string }>();
  const clientId = Array.isArray(params.id) ? params.id[0] : params.id;
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [statusLabel, setStatusLabel] = useState<string>("Unassigned");
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("Overview");
  const [employmentRows, setEmploymentRows] = useState<EmploymentRecord[]>([]);
  const [contactRows, setContactRows] = useState<ContactRecord[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!clientId || !UUID_PATTERN.test(clientId)) {
        setErrorMessage("Invalid client id.");
        setIsLoading(false);
        return;
      }

      const [
        { data: clientData, error: clientError },
        { data: statuses },
        { data: employmentsData, error: employmentsError },
      ] =
        await Promise.all([
          supabase
            .from("clients")
            .select(
              "id,name,contact_number,email,website,industry,status_code,source,updated_at",
            )
            .eq("id", clientId)
            .maybeSingle<ClientRecord>(),
          supabase.from("client_statuses").select("code,label"),
          supabase
            .from("contact_employments")
            .select("id,contact_id,job_title,is_primary,start_date,end_date,updated_at")
            .eq("client_id", clientId),
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

      if (employmentsError) {
        setErrorMessage(employmentsError.message);
        setIsLoading(false);
        return;
      }

      const employments = (employmentsData ?? []) as EmploymentRecord[];
      const contactIds = Array.from(new Set(employments.map((row) => row.contact_id)));

      let contacts: ContactRecord[] = [];
      if (contactIds.length > 0) {
        const { data: contactsData, error: contactsError } = await supabase
          .from("contacts")
          .select(
            "id,first_name,last_name,department,email,secondary_email,job_title,work_phone,mobile,source,marketing_email_opt_out,notes,linkedin_url,x_url,facebook_url,instagram_url,updated_at",
          )
          .in("id", contactIds);

        if (!isMounted) return;

        if (contactsError) {
          setErrorMessage(contactsError.message);
          setIsLoading(false);
          return;
        }

        contacts = (contactsData ?? []) as ContactRecord[];
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
      setEmploymentRows(employments);
      setContactRows(contacts);
      setIsLoading(false);
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [clientId, supabase]);

  const clientContacts = useMemo<ClientContactRow[]>(() => {
    const contactById = contactRows.reduce<Record<string, ContactRecord>>((acc, row) => {
      acc[row.id] = row;
      return acc;
    }, {});

    return employmentRows
      .map((employment) => {
        const contact = contactById[employment.contact_id];
        if (!contact) return null;

        const contactUpdated = new Date(contact.updated_at).getTime();
        const employmentUpdated = new Date(employment.updated_at).getTime();
        const latest = Math.max(contactUpdated, employmentUpdated);

        return {
          id: contact.id,
          fullName: `${contact.first_name} ${contact.last_name}`.trim(),
          department: contact.department,
          employmentJobTitle: employment.job_title,
          contactJobTitle: contact.job_title,
          email: contact.email,
          secondaryEmail: contact.secondary_email,
          workPhone: contact.work_phone,
          mobile: contact.mobile,
          source: contact.source,
          marketingEmailOptOut: contact.marketing_email_opt_out,
          notes: contact.notes,
          linkedinUrl: contact.linkedin_url,
          xUrl: contact.x_url,
          facebookUrl: contact.facebook_url,
          instagramUrl: contact.instagram_url,
          isPrimary: Boolean(employment.is_primary),
          isActiveEmployment: !employment.end_date,
          lastActivity: new Date(latest).toISOString(),
        };
      })
      .filter((row): row is ClientContactRow => Boolean(row))
      .sort((a, b) => {
        const aPrimary = a.isPrimary && a.isActiveEmployment ? 1 : 0;
        const bPrimary = b.isPrimary && b.isActiveEmployment ? 1 : 0;
        if (aPrimary !== bPrimary) return bPrimary - aPrimary;

        const aActive = a.isActiveEmployment ? 1 : 0;
        const bActive = b.isActiveEmployment ? 1 : 0;
        if (aActive !== bActive) return bActive - aActive;

        return a.fullName.localeCompare(b.fullName);
      });
  }, [contactRows, employmentRows]);

  const effectiveSelectedContactId = useMemo(() => {
    if (clientContacts.length === 0) return null;
    const hasSelected = clientContacts.some((contact) => contact.id === selectedContactId);
    return hasSelected ? selectedContactId : clientContacts[0].id;
  }, [clientContacts, selectedContactId]);

  const selectedContact = useMemo(() => {
    if (!effectiveSelectedContactId) return null;
    return (
      clientContacts.find((contact) => contact.id === effectiveSelectedContactId) ?? null
    );
  }, [clientContacts, effectiveSelectedContactId]);

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
          {TABS.map((tab) => (
            <button
              key={tab}
              className={`${styles.tabButton} ${activeTab === tab ? styles.tabButtonActive : ""}`}
              type="button"
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
        </section>
      ) : null}

      {activeTab === "Contacts" ? (
        <>
          <section className={styles.detailsCard}>
            <div className={styles.detailsHeader}>
              <h2 className={styles.detailsTitle}>Contacts</h2>
            </div>
            {clientContacts.length > 0 ? (
              <div className={styles.tableWrap}>
                <table className={styles.dataTable}>
                  <thead>
                    <tr>
                      <th>Contact Name</th>
                      <th>Job Title</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Primary</th>
                      <th>Last Activity</th>
                      <th>Profile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientContacts.map((contact) => (
                      <tr
                        key={contact.id}
                        className={
                          effectiveSelectedContactId === contact.id
                            ? styles.tableRowActive
                            : ""
                        }
                      >
                        <td>
                          <button
                            type="button"
                            className={styles.rowSelectButton}
                            onClick={() => setSelectedContactId(contact.id)}
                          >
                            {contact.fullName}
                          </button>
                        </td>
                        <td>{contact.employmentJobTitle || contact.contactJobTitle || "-"}</td>
                        <td>{contact.email || "-"}</td>
                        <td>{contact.mobile || contact.workPhone || "-"}</td>
                        <td>{contact.isPrimary ? "Yes" : "No"}</td>
                        <td>
                          {new Date(contact.lastActivity).toLocaleDateString("en-GB")}
                        </td>
                        <td>
                          <Link
                            href={`/admin/contacts/${contact.id}`}
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
              <p className={styles.infoText}>No contacts linked to this client.</p>
            )}
          </section>

          <section className={styles.detailsCard}>
            <div className={styles.detailsHeader}>
              <h2 className={styles.detailsTitle}>Contact Details</h2>
              {selectedContact ? (
                <Link
                  href={`/admin/contacts/${selectedContact.id}`}
                  className={styles.editLink}
                >
                  Open full profile
                </Link>
              ) : null}
            </div>
            {selectedContact ? (
              <dl className={styles.detailsGrid}>
                <div>
                  <dt>Name</dt>
                  <dd>{selectedContact.fullName}</dd>
                </div>
                <div>
                  <dt>Department</dt>
                  <dd>{selectedContact.department || "-"}</dd>
                </div>
                <div>
                  <dt>Job Title</dt>
                  <dd>
                    {selectedContact.employmentJobTitle ||
                      selectedContact.contactJobTitle ||
                      "-"}
                  </dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{selectedContact.email || "-"}</dd>
                </div>
                <div>
                  <dt>Secondary Email</dt>
                  <dd>{selectedContact.secondaryEmail || "-"}</dd>
                </div>
                <div>
                  <dt>Phone</dt>
                  <dd>{selectedContact.mobile || selectedContact.workPhone || "-"}</dd>
                </div>
                <div>
                  <dt>Primary Contact</dt>
                  <dd>{selectedContact.isPrimary ? "Yes" : "No"}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{selectedContact.source || "-"}</dd>
                </div>
                <div>
                  <dt>Marketing Opt Out</dt>
                  <dd>{selectedContact.marketingEmailOptOut ? "Yes" : "No"}</dd>
                </div>
                <div>
                  <dt>LinkedIn</dt>
                  <dd>
                    {selectedContact.linkedinUrl ? (
                      <a
                        href={selectedContact.linkedinUrl}
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
                    {selectedContact.xUrl ? (
                      <a
                        href={selectedContact.xUrl}
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
                    {selectedContact.facebookUrl ? (
                      <a
                        href={selectedContact.facebookUrl}
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
                    {selectedContact.instagramUrl ? (
                      <a
                        href={selectedContact.instagramUrl}
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
                <div className={styles.notesBlockInline}>
                  <dt>Notes</dt>
                  <dd>{selectedContact.notes || "-"}</dd>
                </div>
              </dl>
            ) : (
              <p className={styles.infoText}>Select a contact to view details.</p>
            )}
          </section>
        </>
      ) : null}

      {activeTab !== "Overview" && activeTab !== "Contacts" ? (
        <section className={styles.detailsCard}>
          <div className={styles.detailsHeader}>
            <h2 className={styles.detailsTitle}>{activeTab}</h2>
          </div>
        </section>
      ) : null}
    </main>
  );
}
