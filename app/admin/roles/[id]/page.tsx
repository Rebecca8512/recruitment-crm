"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
  notes: string | null;
  updated_at: string;
};

type StatusRecord = {
  code: string;
  label: string;
};

type CandidateStatusRecord = {
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
  email: string | null;
  mobile: string | null;
  phone: string | null;
  updated_at: string;
};

type EmploymentRecord = {
  contact_id: string;
  client_id: string | null;
  is_primary: boolean;
  start_date: string | null;
  end_date: string | null;
};

type ApplicationRecord = {
  id: string;
  role_id: string;
  candidate_id: string;
  stage: string;
  source: string | null;
  submitted_on: string | null;
  outcome: string | null;
  notes: string | null;
  updated_at: string;
};

type CandidateRecord = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  status_code: string;
  updated_at: string;
};

type RoleCandidateRow = {
  applicationId: string;
  candidateId: string;
  candidateName: string;
  phone: string | null;
  email: string | null;
  candidateStatus: string;
  stage: string;
  source: string | null;
  submittedOn: string | null;
  outcome: string | null;
  applicationNotes: string | null;
  lastActivity: string;
};

type RoleCommunicationNoteRecord = {
  id: string;
  role_id: string;
  contact_id: string | null;
  communication_type: string;
  job_context: string;
  note_body: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TABS = ["Overview", "Candidates", "Notes"] as const;
const COMMUNICATION_TYPE_OPTIONS = ["Email", "Phone", "Social", "In person"] as const;

function formatJobType(value: string) {
  if (!value) return "-";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function displayContactName(contact: ContactRecord | undefined) {
  if (!contact) return "-";
  return `${contact.first_name} ${contact.last_name}`.trim();
}

export default function RoleProfilePage() {
  const params = useParams<{ id?: string }>();
  const roleId = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [role, setRole] = useState<RoleRecord | null>(null);
  const [statusLabel, setStatusLabel] = useState("-");
  const [clientName, setClientName] = useState("-");
  const [contactName, setContactName] = useState("-");

  const [clientContacts, setClientContacts] = useState<ContactRecord[]>([]);
  const [candidateRows, setCandidateRows] = useState<RoleCandidateRow[]>([]);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("Overview");

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [communicationNotes, setCommunicationNotes] = useState<RoleCommunicationNoteRecord[]>([]);
  const [communicationType, setCommunicationType] = useState<string>("Email");
  const [jobContext, setJobContext] = useState<string>("role");
  const [contactId, setContactId] = useState<string>("");
  const [communicationBody, setCommunicationBody] = useState("");
  const [editingCommunicationId, setEditingCommunicationId] = useState<string | null>(null);
  const [isSavingCommunication, setIsSavingCommunication] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!roleId || !UUID_PATTERN.test(roleId)) {
        setErrorMessage("Invalid role id.");
        setIsLoading(false);
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (!isMounted) return;
      if (sessionError || !sessionData.session?.user) {
        router.replace("/admin");
        return;
      }
      setCurrentUserId(sessionData.session.user.id);

      const [
        { data: roleData, error: roleError },
        { data: statusesData, error: statusesError },
        { data: candidateStatusesData, error: candidateStatusesError },
        { data: applicationsData, error: applicationsError },
      ] = await Promise.all([
        supabase
          .from("roles")
          .select(
            "id,title,client_id,contact_id,job_type,status_code,salary_text,total_expected_revenue,expected_revenue_per_position,notes,updated_at",
          )
          .eq("id", roleId)
          .maybeSingle<RoleRecord>(),
        supabase.from("role_statuses").select("code,label"),
        supabase.from("candidate_statuses").select("code,label"),
        supabase
          .from("applications")
          .select("id,role_id,candidate_id,stage,source,submitted_on,outcome,notes,updated_at")
          .eq("role_id", roleId)
          .order("updated_at", { ascending: false }),
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

      if (statusesError) {
        setErrorMessage(statusesError.message);
        setIsLoading(false);
        return;
      }

      if (candidateStatusesError) {
        setErrorMessage(candidateStatusesError.message);
        setIsLoading(false);
        return;
      }

      if (applicationsError) {
        setErrorMessage(applicationsError.message);
        setIsLoading(false);
        return;
      }

      const statusMap = ((statusesData ?? []) as StatusRecord[]).reduce<Record<string, string>>(
        (acc, row) => {
          acc[row.code] = row.label;
          return acc;
        },
        {},
      );
      setStatusLabel(statusMap[roleData.status_code] ?? roleData.status_code);

      const candidateStatusMap = ((candidateStatusesData ?? []) as CandidateStatusRecord[]).reduce<
        Record<string, string>
      >((acc, row) => {
        acc[row.code] = row.label;
        return acc;
      }, {});

      let currentClientName = "-";
      if (roleData.client_id) {
        const { data: clientData } = await supabase
          .from("clients")
          .select("id,name")
          .eq("id", roleData.client_id)
          .maybeSingle<ClientRecord>();
        currentClientName = clientData?.name ?? "-";
      }

      const applications = (applicationsData ?? []) as ApplicationRecord[];
      const candidateIds = Array.from(new Set(applications.map((row) => row.candidate_id)));

      let candidateMap: Record<string, CandidateRecord> = {};
      if (candidateIds.length > 0) {
        const { data: candidatesData, error: candidatesError } = await supabase
          .from("candidates")
          .select("id,first_name,last_name,email,phone,mobile,status_code,updated_at")
          .in("id", candidateIds);

        if (!isMounted) return;

        if (candidatesError) {
          setErrorMessage(candidatesError.message);
          setIsLoading(false);
          return;
        }

        candidateMap = ((candidatesData ?? []) as CandidateRecord[]).reduce<
          Record<string, CandidateRecord>
        >((acc, row) => {
          acc[row.id] = row;
          return acc;
        }, {});
      }

      const mappedCandidateRows: RoleCandidateRow[] = applications
        .map((app) => {
          const candidate = candidateMap[app.candidate_id];
          const candidateName = candidate
            ? `${candidate.first_name} ${candidate.last_name}`.trim()
            : "Candidate unavailable";
          const candidateUpdated = candidate ? new Date(candidate.updated_at).getTime() : 0;
          const appUpdated = new Date(app.updated_at).getTime();
          const lastActivity = new Date(Math.max(candidateUpdated, appUpdated)).toISOString();

          return {
            applicationId: app.id,
            candidateId: app.candidate_id,
            candidateName,
            phone: candidate?.mobile || candidate?.phone || null,
            email: candidate?.email || null,
            candidateStatus: candidate
              ? candidateStatusMap[candidate.status_code] ?? candidate.status_code
              : "-",
            stage: app.stage,
            source: app.source,
            submittedOn: app.submitted_on,
            outcome: app.outcome,
            applicationNotes: app.notes,
            lastActivity,
          };
        })
        .sort(
          (a, b) =>
            new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime(),
        );

      let fetchedClientContacts: ContactRecord[] = [];
      let roleContactDisplay = "-";

      if (roleData.client_id) {
        const { data: employmentsData, error: employmentsError } = await supabase
          .from("contact_employments")
          .select("contact_id,client_id,is_primary,start_date,end_date")
          .eq("client_id", roleData.client_id);

        if (!isMounted) return;

        if (employmentsError) {
          setErrorMessage(employmentsError.message);
          setIsLoading(false);
          return;
        }

        const employmentRows = (employmentsData ?? []) as EmploymentRecord[];
        const contactIds = Array.from(
          new Set(
            employmentRows
              .map((row) => row.contact_id)
              .concat(roleData.contact_id ? [roleData.contact_id] : []),
          ),
        );

        if (contactIds.length > 0) {
          const { data: contactsData, error: contactsError } = await supabase
            .from("contacts")
            .select("id,first_name,last_name,email,mobile,phone,updated_at")
            .in("id", contactIds);

          if (!isMounted) return;

          if (contactsError) {
            setErrorMessage(contactsError.message);
            setIsLoading(false);
            return;
          }

          const contacts = (contactsData ?? []) as ContactRecord[];
          const contactById = contacts.reduce<Record<string, ContactRecord>>((acc, row) => {
            acc[row.id] = row;
            return acc;
          }, {});

          const scoreByContactId = employmentRows.reduce<Record<string, number>>((acc, row) => {
            const isPrimaryActive = row.is_primary && !row.end_date ? 20 : 0;
            const isActive = !row.end_date ? 10 : 0;
            const start = row.start_date ? new Date(row.start_date).getTime() / 1e10 : 0;
            acc[row.contact_id] = Math.max(
              acc[row.contact_id] ?? 0,
              isPrimaryActive + isActive + start,
            );
            return acc;
          }, {});

          fetchedClientContacts = contacts
            .filter((row) => scoreByContactId[row.id] !== undefined)
            .sort((a, b) => {
              const scoreDiff = (scoreByContactId[b.id] ?? 0) - (scoreByContactId[a.id] ?? 0);
              if (scoreDiff !== 0) return scoreDiff;
              return `${a.first_name} ${a.last_name}`.localeCompare(
                `${b.first_name} ${b.last_name}`,
              );
            });

          if (roleData.contact_id) {
            roleContactDisplay = displayContactName(contactById[roleData.contact_id]);
          }
        }
      }

      let fetchedNotes: RoleCommunicationNoteRecord[] = [];
      const { data: roleNotesData, error: roleNotesError } = await supabase
        .from("role_communication_notes")
        .select(
          "id,role_id,contact_id,communication_type,job_context,note_body,created_by,created_at,updated_at",
        )
        .eq("role_id", roleId)
        .order("created_at", { ascending: false });

      if (!isMounted) return;

      if (roleNotesError) {
        const isMissingTable =
          roleNotesError.message.toLowerCase().includes("does not exist") ||
          roleNotesError.message.toLowerCase().includes("schema cache");
        if (!isMissingTable) {
          setErrorMessage(roleNotesError.message);
          setIsLoading(false);
          return;
        }
      } else {
        fetchedNotes = (roleNotesData ?? []) as RoleCommunicationNoteRecord[];
      }

      setClientName(currentClientName);
      setContactName(roleContactDisplay);
      setRole(roleData);
      setCandidateRows(mappedCandidateRows);
      setSelectedApplicationId(mappedCandidateRows[0]?.applicationId ?? null);
      setClientContacts(fetchedClientContacts);
      setCommunicationNotes(fetchedNotes);
      setIsLoading(false);
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [roleId, router, supabase]);

  const contactNameById = useMemo(() => {
    return clientContacts.reduce<Record<string, string>>((acc, row) => {
      acc[row.id] = `${row.first_name} ${row.last_name}`.trim();
      return acc;
    }, {});
  }, [clientContacts]);

  const selectedCandidateRow = useMemo(() => {
    if (candidateRows.length === 0) return null;
    const selected = candidateRows.find((row) => row.applicationId === selectedApplicationId);
    return selected ?? candidateRows[0];
  }, [candidateRows, selectedApplicationId]);

  const resetNoteForm = () => {
    setCommunicationType("Email");
    setJobContext("role");
    setContactId("");
    setCommunicationBody("");
    setEditingCommunicationId(null);
  };

  const handleSaveCommunication = async () => {
    if (!roleId || !UUID_PATTERN.test(roleId)) {
      setErrorMessage("Invalid role id.");
      return;
    }

    if (!communicationBody.trim()) {
      setErrorMessage("Communication note is required.");
      return;
    }

    setErrorMessage("");
    setIsSavingCommunication(true);

    if (editingCommunicationId) {
      const { data, error } = await supabase
        .from("role_communication_notes")
        .update({
          communication_type: communicationType,
          job_context: jobContext,
          contact_id: contactId || null,
          note_body: communicationBody.trim(),
        })
        .eq("id", editingCommunicationId)
        .eq("role_id", roleId)
        .select(
          "id,role_id,contact_id,communication_type,job_context,note_body,created_by,created_at,updated_at",
        )
        .single<RoleCommunicationNoteRecord>();

      if (error || !data) {
        setErrorMessage(error?.message ?? "Failed to update communication note.");
        setIsSavingCommunication(false);
        return;
      }

      setCommunicationNotes((current) => current.map((row) => (row.id === data.id ? data : row)));
      setIsSavingCommunication(false);
      resetNoteForm();
      return;
    }

    const { data, error } = await supabase
      .from("role_communication_notes")
      .insert({
        role_id: roleId,
        communication_type: communicationType,
        job_context: jobContext,
        contact_id: contactId || null,
        note_body: communicationBody.trim(),
        created_by: currentUserId,
      })
      .select(
        "id,role_id,contact_id,communication_type,job_context,note_body,created_by,created_at,updated_at",
      )
      .single<RoleCommunicationNoteRecord>();

    if (error || !data) {
      setErrorMessage(error?.message ?? "Failed to save communication note.");
      setIsSavingCommunication(false);
      return;
    }

    setCommunicationNotes((current) => [data, ...current]);
    setIsSavingCommunication(false);
    resetNoteForm();
  };

  const handleEditCommunication = (note: RoleCommunicationNoteRecord) => {
    setEditingCommunicationId(note.id);
    setCommunicationType(note.communication_type);
    setJobContext(note.job_context || "role");
    setContactId(note.contact_id ?? "");
    setCommunicationBody(note.note_body);
    setErrorMessage("");
  };

  const handleDeleteCommunication = async (noteId: string) => {
    if (!roleId || !UUID_PATTERN.test(roleId)) {
      setErrorMessage("Invalid role id.");
      return;
    }

    const { error } = await supabase
      .from("role_communication_notes")
      .delete()
      .eq("id", noteId)
      .eq("role_id", roleId);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setCommunicationNotes((current) => current.filter((row) => row.id !== noteId));
    if (editingCommunicationId === noteId) {
      resetNoteForm();
    }
  };

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
            <Link href={`/admin/roles/${role.id}/edit`} className={styles.editLink}>
              Edit details
            </Link>
          </div>
          <dl className={styles.detailsGrid}>
            <div>
              <dt>Client</dt>
              <dd>
                {role.client_id ? (
                  <Link href={`/admin/clients/${role.client_id}`} className={styles.subtleLink}>
                    {clientName}
                  </Link>
                ) : (
                  "-"
                )}
              </dd>
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
              <dd>{role.total_expected_revenue || role.expected_revenue_per_position || "-"}</dd>
            </div>
            <div className={styles.notesBlockInline}>
              <dt>Notes</dt>
              <dd>{role.notes || "-"}</dd>
            </div>
            <div>
              <dt>Last Updated</dt>
              <dd>{new Date(role.updated_at).toLocaleDateString("en-GB")}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      {activeTab === "Candidates" ? (
        <>
          <section className={styles.detailsCard}>
            <div className={styles.detailsHeader}>
              <h2 className={styles.detailsTitle}>Candidates</h2>
            </div>

            {candidateRows.length > 0 ? (
              <div className={styles.tableWrap}>
                <table className={styles.dataTable}>
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Phone</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Stage</th>
                      <th>Last Activity</th>
                      <th>Profile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidateRows.map((row) => (
                      <tr
                        key={row.applicationId}
                        className={
                          selectedCandidateRow?.applicationId === row.applicationId
                            ? styles.tableRowActive
                            : ""
                        }
                      >
                        <td>
                          <button
                            type="button"
                            className={styles.rowSelectButton}
                            onClick={() => setSelectedApplicationId(row.applicationId)}
                          >
                            {row.candidateName}
                          </button>
                        </td>
                        <td>{row.phone || "-"}</td>
                        <td>{row.email || "-"}</td>
                        <td>{row.candidateStatus}</td>
                        <td>{row.stage}</td>
                        <td>{new Date(row.lastActivity).toLocaleDateString("en-GB")}</td>
                        <td>
                          <Link
                            href={`/admin/candidates/${row.candidateId}`}
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
              <p className={styles.infoText}>No candidates linked to this role yet.</p>
            )}
          </section>

          <section className={styles.detailsCard}>
            <div className={styles.detailsHeader}>
              <h2 className={styles.detailsTitle}>Application Details</h2>
              {selectedCandidateRow ? (
                <Link
                  href={`/admin/candidates/${selectedCandidateRow.candidateId}`}
                  className={styles.editLink}
                >
                  Open full profile
                </Link>
              ) : null}
            </div>

            {selectedCandidateRow ? (
              <dl className={styles.detailsGrid}>
                <div>
                  <dt>Candidate</dt>
                  <dd>{selectedCandidateRow.candidateName}</dd>
                </div>
                <div>
                  <dt>Stage</dt>
                  <dd>{selectedCandidateRow.stage}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{selectedCandidateRow.candidateStatus}</dd>
                </div>
                <div>
                  <dt>Submitted On</dt>
                  <dd>
                    {selectedCandidateRow.submittedOn
                      ? new Date(selectedCandidateRow.submittedOn).toLocaleDateString("en-GB")
                      : "-"}
                  </dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{selectedCandidateRow.source || "-"}</dd>
                </div>
                <div>
                  <dt>Outcome</dt>
                  <dd>{selectedCandidateRow.outcome || "-"}</dd>
                </div>
                <div className={styles.notesBlockInline}>
                  <dt>Application Notes</dt>
                  <dd>{selectedCandidateRow.applicationNotes || "-"}</dd>
                </div>
              </dl>
            ) : (
              <p className={styles.infoText}>Select a candidate to view details.</p>
            )}
          </section>
        </>
      ) : null}

      {activeTab === "Notes" ? (
        <section className={styles.detailsCard}>
          <div className={styles.detailsHeader}>
            <h2 className={styles.detailsTitle}>Notes</h2>
          </div>

          <div className={styles.communicationForm}>
            <div className={styles.communicationFormTop}>
              <label className={styles.modalField}>
                <span>Type</span>
                <select
                  value={communicationType}
                  onChange={(event) => setCommunicationType(event.target.value)}
                >
                  {COMMUNICATION_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.modalField}>
                <span>Job</span>
                <select value={jobContext} onChange={(event) => setJobContext(event.target.value)}>
                  <option value="role">This role</option>
                  <option value="general">General</option>
                </select>
              </label>

              <label className={styles.modalField}>
                <span>Contact</span>
                <select value={contactId} onChange={(event) => setContactId(event.target.value)}>
                  <option value="">Not selected</option>
                  {clientContacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {displayContactName(contact)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className={styles.modalField}>
              <span>Communication</span>
              <textarea
                rows={5}
                value={communicationBody}
                onChange={(event) => setCommunicationBody(event.target.value)}
              />
            </label>

            <div className={styles.communicationActions}>
              <button
                type="button"
                className={styles.submitButton}
                onClick={handleSaveCommunication}
                disabled={isSavingCommunication}
              >
                {isSavingCommunication
                  ? "Saving..."
                  : editingCommunicationId
                    ? "Save changes"
                    : "Save note"}
              </button>
              {editingCommunicationId ? (
                <button type="button" className={styles.cancelButton} onClick={resetNoteForm}>
                  Cancel
                </button>
              ) : null}
            </div>
          </div>

          <div className={styles.communicationList}>
            {communicationNotes.length > 0 ? (
              communicationNotes.map((note) => (
                <article key={note.id} className={styles.communicationItem}>
                  <div className={styles.communicationItemHeader}>
                    <div className={styles.communicationMeta}>
                      <span>{note.communication_type}</span>
                      <span>{new Date(note.created_at).toLocaleString("en-GB")}</span>
                      <span>{note.job_context === "general" ? "General" : role.title}</span>
                      <span>
                        {note.contact_id ? (contactNameById[note.contact_id] ?? "-") : "No contact"}
                      </span>
                    </div>
                    <div className={styles.communicationMetaActions}>
                      <button
                        type="button"
                        className={styles.discreetAction}
                        onClick={() => handleEditCommunication(note)}
                      >
                        edit
                      </button>
                      <button
                        type="button"
                        className={styles.discreetAction}
                        onClick={() => handleDeleteCommunication(note.id)}
                      >
                        delete
                      </button>
                    </div>
                  </div>
                  <p className={styles.communicationBody}>{note.note_body}</p>
                </article>
              ))
            ) : (
              <p className={styles.infoText}>No communication notes yet.</p>
            )}
          </div>
        </section>
      ) : null}
    </main>
  );
}
