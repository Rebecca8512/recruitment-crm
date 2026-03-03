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
  account_manager_id: string | null;
  parent_client_id: string | null;
  email: string | null;
  website: string | null;
  google_drive_url: string | null;
  companies_house_number: string | null;
  industry: string | null;
  about: string | null;
  status_code: string | null;
  source: string | null;
  source_other: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  county: string | null;
  postcode: string | null;
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

type RoleStatusRecord = {
  code: string;
  label: string;
};

type RoleRecord = {
  id: string;
  title: string;
  contact_id: string | null;
  target_date: string | null;
  status_code: string;
  job_type: string;
  salary_text: string | null;
  expected_revenue_per_position: string | null;
  total_expected_revenue: string | null;
  actual_revenue: string | null;
  notes: string | null;
  updated_at: string;
};

type ClientRoleRow = {
  id: string;
  title: string;
  contactName: string | null;
  targetDate: string | null;
  statusCode: string;
  jobType: string;
  salaryText: string | null;
  expectedRevenuePerPosition: string | null;
  totalExpectedRevenue: string | null;
  actualRevenue: string | null;
  notes: string | null;
  lastActivity: string;
};

type ParentClientRecord = {
  name: string;
};

type ProfileRecord = {
  full_name: string | null;
  email: string | null;
};

type ClientCommunicationNoteRecord = {
  id: string;
  client_id: string;
  role_id: string | null;
  contact_id: string | null;
  communication_type: string;
  activity_type: string;
  note_body: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const TABS = ["Overview", "Contacts", "Roles", "Candidates", "Notes"] as const;
const COMMUNICATION_TYPE_OPTIONS = ["Email", "Phone", "Social", "In person"] as const;
const ACTIVITY_TYPE_OPTIONS = ["Outbound", "Inbound"] as const;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function formatJobType(value: string) {
  if (!value) return "-";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function ClientProfilePage() {
  const params = useParams<{ id?: string }>();
  const clientId = Array.isArray(params.id) ? params.id[0] : params.id;
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [statusLabel, setStatusLabel] = useState<string>("Unassigned");
  const [accountManagerLabel, setAccountManagerLabel] = useState("-");
  const [parentClientName, setParentClientName] = useState("-");

  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("Overview");
  const [employmentRows, setEmploymentRows] = useState<EmploymentRecord[]>([]);
  const [contactRows, setContactRows] = useState<ContactRecord[]>([]);
  const [roleRows, setRoleRows] = useState<RoleRecord[]>([]);
  const [roleStatusMap, setRoleStatusMap] = useState<Record<string, string>>({});
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [communicationNotes, setCommunicationNotes] = useState<ClientCommunicationNoteRecord[]>(
    [],
  );
  const [communicationType, setCommunicationType] = useState<string>("Email");
  const [activityType, setActivityType] = useState<string>("Outbound");
  const [noteRoleId, setNoteRoleId] = useState<string>("");
  const [noteContactId, setNoteContactId] = useState<string>("");
  const [noteBody, setNoteBody] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!clientId || !UUID_PATTERN.test(clientId)) {
        setErrorMessage("Invalid client id.");
        setIsLoading(false);
        return;
      }

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (!isMounted) return;

      if (sessionError || !sessionData.session?.user) {
        setErrorMessage("You must be signed in.");
        setIsLoading(false);
        return;
      }

      setCurrentUserId(sessionData.session.user.id);

      const [
        { data: clientData, error: clientError },
        { data: statuses },
        { data: employmentsData, error: employmentsError },
        { data: rolesData, error: rolesError },
        { data: roleStatusesData, error: roleStatusesError },
        { data: clientNotesData, error: clientNotesError },
      ] = await Promise.all([
        supabase
          .from("clients")
          .select(
            "id,name,contact_number,account_manager_id,parent_client_id,email,website,google_drive_url,companies_house_number,industry,about,status_code,source,source_other,address_line_1,address_line_2,city,county,postcode,updated_at",
          )
          .eq("id", clientId)
          .maybeSingle<ClientRecord>(),
        supabase.from("client_statuses").select("code,label"),
        supabase
          .from("contact_employments")
          .select("id,contact_id,job_title,is_primary,start_date,end_date,updated_at")
          .eq("client_id", clientId),
        supabase
          .from("roles")
          .select(
            "id,title,contact_id,target_date,status_code,job_type,salary_text,expected_revenue_per_position,total_expected_revenue,actual_revenue,notes,updated_at",
          )
          .eq("client_id", clientId)
          .order("updated_at", { ascending: false }),
        supabase.from("role_statuses").select("code,label"),
        supabase
          .from("client_communication_notes")
          .select(
            "id,client_id,role_id,contact_id,communication_type,activity_type,note_body,created_by,created_at,updated_at",
          )
          .eq("client_id", clientId)
          .order("created_at", { ascending: false }),
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

      if (rolesError) {
        setErrorMessage(rolesError.message);
        setIsLoading(false);
        return;
      }

      if (roleStatusesError) {
        setErrorMessage(roleStatusesError.message);
        setIsLoading(false);
        return;
      }

      if (clientNotesError) {
        const isMissingTable =
          clientNotesError.message.toLowerCase().includes("does not exist") ||
          clientNotesError.message.toLowerCase().includes("schema cache");
        if (!isMissingTable) {
          setErrorMessage(clientNotesError.message);
          setIsLoading(false);
          return;
        }
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

      const roleStatuses = ((roleStatusesData ?? []) as RoleStatusRecord[]).reduce<
        Record<string, string>
      >((acc, row) => {
        acc[row.code] = row.label;
        return acc;
      }, {});

      let parentName = "-";
      if (clientData.parent_client_id) {
        const { data: parentData } = await supabase
          .from("clients")
          .select("name")
          .eq("id", clientData.parent_client_id)
          .maybeSingle<ParentClientRecord>();

        if (!isMounted) return;
        parentName = parentData?.name ?? "-";
      }

      let managerName = "-";
      if (clientData.account_manager_id) {
        const { data: managerData } = await supabase
          .from("profiles")
          .select("full_name,email")
          .eq("id", clientData.account_manager_id)
          .maybeSingle<ProfileRecord>();

        if (!isMounted) return;
        managerName =
          managerData?.full_name?.trim() || managerData?.email || "-";
      }

      setClient(clientData);
      setStatusLabel(
        clientData.status_code
          ? (statusMap[clientData.status_code] ?? clientData.status_code)
          : "Unassigned",
      );
      setParentClientName(parentName);
      setAccountManagerLabel(managerName);
      setEmploymentRows(employments);
      setContactRows(contacts);
      setRoleRows((rolesData ?? []) as RoleRecord[]);
      setCommunicationNotes((clientNotesData ?? []) as ClientCommunicationNoteRecord[]);
      setRoleStatusMap(roleStatuses);
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

  const clientRoles = useMemo<ClientRoleRow[]>(() => {
    const contactNameById = contactRows.reduce<Record<string, string>>((acc, contact) => {
      acc[contact.id] = `${contact.first_name} ${contact.last_name}`.trim();
      return acc;
    }, {});

    return roleRows
      .map((role) => ({
        id: role.id,
        title: role.title,
        contactName: role.contact_id ? (contactNameById[role.contact_id] ?? null) : null,
        targetDate: role.target_date,
        statusCode: role.status_code,
        jobType: role.job_type,
        salaryText: role.salary_text,
        expectedRevenuePerPosition: role.expected_revenue_per_position,
        totalExpectedRevenue: role.total_expected_revenue,
        actualRevenue: role.actual_revenue,
        notes: role.notes,
        lastActivity: role.updated_at,
      }))
      .sort(
        (a, b) =>
          new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime(),
      );
  }, [contactRows, roleRows]);

  const effectiveSelectedRoleId = useMemo(() => {
    if (clientRoles.length === 0) return null;
    const hasSelected = clientRoles.some((role) => role.id === selectedRoleId);
    return hasSelected ? selectedRoleId : clientRoles[0].id;
  }, [clientRoles, selectedRoleId]);

  const selectedRole = useMemo(() => {
    if (!effectiveSelectedRoleId) return null;
    return clientRoles.find((role) => role.id === effectiveSelectedRoleId) ?? null;
  }, [clientRoles, effectiveSelectedRoleId]);

  const contactNameById = useMemo(() => {
    return contactRows.reduce<Record<string, string>>((acc, row) => {
      acc[row.id] = `${row.first_name} ${row.last_name}`.trim();
      return acc;
    }, {});
  }, [contactRows]);

  const roleTitleById = useMemo(() => {
    return roleRows.reduce<Record<string, string>>((acc, row) => {
      acc[row.id] = row.title;
      return acc;
    }, {});
  }, [roleRows]);

  const resetNoteForm = () => {
    setCommunicationType("Email");
    setActivityType("Outbound");
    setNoteRoleId("");
    setNoteContactId("");
    setNoteBody("");
    setEditingNoteId(null);
  };

  const handleEditNote = (note: ClientCommunicationNoteRecord) => {
    setEditingNoteId(note.id);
    setCommunicationType(note.communication_type);
    setActivityType(note.activity_type);
    setNoteRoleId(note.role_id ?? "");
    setNoteContactId(note.contact_id ?? "");
    setNoteBody(note.note_body);
    setErrorMessage("");
  };

  const handleSaveNote = async () => {
    if (!clientId || !UUID_PATTERN.test(clientId)) {
      setErrorMessage("Invalid client id.");
      return;
    }

    if (!noteBody.trim()) {
      setErrorMessage("Communication note is required.");
      return;
    }

    setErrorMessage("");
    setIsSavingNote(true);

    if (editingNoteId) {
      const { data, error } = await supabase
        .from("client_communication_notes")
        .update({
          communication_type: communicationType,
          activity_type: activityType,
          role_id: noteRoleId || null,
          contact_id: noteContactId || null,
          note_body: noteBody.trim(),
        })
        .eq("id", editingNoteId)
        .eq("client_id", clientId)
        .select(
          "id,client_id,role_id,contact_id,communication_type,activity_type,note_body,created_by,created_at,updated_at",
        )
        .single<ClientCommunicationNoteRecord>();

      if (error || !data) {
        setErrorMessage(error?.message ?? "Failed to update note.");
        setIsSavingNote(false);
        return;
      }

      setCommunicationNotes((current) => current.map((row) => (row.id === data.id ? data : row)));
      setIsSavingNote(false);
      resetNoteForm();
      return;
    }

    const { data, error } = await supabase
      .from("client_communication_notes")
      .insert({
        client_id: clientId,
        communication_type: communicationType,
        activity_type: activityType,
        role_id: noteRoleId || null,
        contact_id: noteContactId || null,
        note_body: noteBody.trim(),
        created_by: currentUserId,
      })
      .select(
        "id,client_id,role_id,contact_id,communication_type,activity_type,note_body,created_by,created_at,updated_at",
      )
      .single<ClientCommunicationNoteRecord>();

    if (error || !data) {
      setErrorMessage(error?.message ?? "Failed to save note.");
      setIsSavingNote(false);
      return;
    }

    setCommunicationNotes((current) => [data, ...current]);
    setIsSavingNote(false);
    resetNoteForm();
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!clientId || !UUID_PATTERN.test(clientId)) {
      setErrorMessage("Invalid client id.");
      return;
    }

    const { error } = await supabase
      .from("client_communication_notes")
      .delete()
      .eq("id", noteId)
      .eq("client_id", clientId);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setCommunicationNotes((current) => current.filter((row) => row.id !== noteId));
    if (editingNoteId === noteId) {
      resetNoteForm();
    }
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
        <>
          <section className={styles.detailsCard}>
            <div className={styles.detailsHeader}>
              <h2 className={styles.detailsTitle}>Overview</h2>
              <Link href={`/admin/clients/${client.id}/edit`} className={styles.editLink}>
                Edit details
              </Link>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Client Name</th>
                    <th>Status</th>
                    <th>Contact Number</th>
                    <th>Email</th>
                    <th>Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className={styles.tableRowActive}>
                    <td>{client.name}</td>
                    <td>{statusLabel}</td>
                    <td>{client.contact_number || "-"}</td>
                    <td>{client.email || "-"}</td>
                    <td>{new Date(client.updated_at).toLocaleDateString("en-GB")}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className={styles.detailsCard}>
            <div className={styles.detailsHeader}>
              <h2 className={styles.detailsTitle}>Client Details</h2>
            </div>
            <dl className={styles.detailsGrid}>
              <div>
                <dt>Account Manager</dt>
                <dd>{accountManagerLabel}</dd>
              </div>
              <div>
                <dt>Parent Client</dt>
                <dd>{parentClientName}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{statusLabel}</dd>
              </div>
              <div>
                <dt>Industry</dt>
                <dd>{client.industry || "-"}</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>{client.source || "-"}</dd>
              </div>
              <div>
                <dt>Source Other</dt>
                <dd>{client.source_other || "-"}</dd>
              </div>
              <div>
                <dt>Website</dt>
                <dd>{client.website || "-"}</dd>
              </div>
              <div>
                <dt>Drive Share URL</dt>
                <dd>
                  {client.google_drive_url ? (
                    <a
                      href={client.google_drive_url}
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
                <dt>Companies House Number</dt>
                <dd>{client.companies_house_number || "-"}</dd>
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
                <dt>Address Line 1</dt>
                <dd>{client.address_line_1 || "-"}</dd>
              </div>
              <div>
                <dt>Address Line 2</dt>
                <dd>{client.address_line_2 || "-"}</dd>
              </div>
              <div>
                <dt>City</dt>
                <dd>{client.city || "-"}</dd>
              </div>
              <div>
                <dt>County</dt>
                <dd>{client.county || "-"}</dd>
              </div>
              <div>
                <dt>Postcode</dt>
                <dd>{client.postcode || "-"}</dd>
              </div>
              <div className={styles.notesBlockInline}>
                <dt>About</dt>
                <dd>{client.about || "-"}</dd>
              </div>
            </dl>
          </section>
        </>
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

      {activeTab === "Roles" ? (
        <>
          <section className={styles.detailsCard}>
            <div className={styles.detailsHeader}>
              <h2 className={styles.detailsTitle}>Roles</h2>
            </div>
            {clientRoles.length > 0 ? (
              <div className={styles.tableWrap}>
                <table className={styles.dataTable}>
                  <thead>
                    <tr>
                      <th>Role Title</th>
                      <th>Contact</th>
                      <th>Status</th>
                      <th>Job Type</th>
                      <th>Target Date</th>
                      <th>Expected Revenue</th>
                      <th>Last Activity</th>
                      <th>Profile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientRoles.map((role) => (
                      <tr
                        key={role.id}
                        className={
                          effectiveSelectedRoleId === role.id ? styles.tableRowActive : ""
                        }
                      >
                        <td>
                          <button
                            type="button"
                            className={styles.rowSelectButton}
                            onClick={() => setSelectedRoleId(role.id)}
                          >
                            {role.title}
                          </button>
                        </td>
                        <td>{role.contactName || "-"}</td>
                        <td>{roleStatusMap[role.statusCode] ?? role.statusCode}</td>
                        <td>{formatJobType(role.jobType)}</td>
                        <td>
                          {role.targetDate
                            ? new Date(role.targetDate).toLocaleDateString("en-GB")
                            : "-"}
                        </td>
                        <td>
                          {role.totalExpectedRevenue ||
                            role.expectedRevenuePerPosition ||
                            "-"}
                        </td>
                        <td>
                          {new Date(role.lastActivity).toLocaleDateString("en-GB")}
                        </td>
                        <td>
                          <Link
                            href={`/admin/roles/${role.id}`}
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
              <p className={styles.infoText}>No roles linked to this client.</p>
            )}
          </section>

          <section className={styles.detailsCard}>
            <div className={styles.detailsHeader}>
              <h2 className={styles.detailsTitle}>Role Details</h2>
              {selectedRole ? (
                <Link href={`/admin/roles/${selectedRole.id}`} className={styles.editLink}>
                  Open full profile
                </Link>
              ) : null}
            </div>
            {selectedRole ? (
              <dl className={styles.detailsGrid}>
                <div>
                  <dt>Role Title</dt>
                  <dd>{selectedRole.title}</dd>
                </div>
                <div>
                  <dt>Contact</dt>
                  <dd>{selectedRole.contactName || "-"}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{roleStatusMap[selectedRole.statusCode] ?? selectedRole.statusCode}</dd>
                </div>
                <div>
                  <dt>Job Type</dt>
                  <dd>{formatJobType(selectedRole.jobType)}</dd>
                </div>
                <div>
                  <dt>Target Date</dt>
                  <dd>
                    {selectedRole.targetDate
                      ? new Date(selectedRole.targetDate).toLocaleDateString("en-GB")
                      : "-"}
                  </dd>
                </div>
                <div>
                  <dt>Salary</dt>
                  <dd>{selectedRole.salaryText || "-"}</dd>
                </div>
                <div>
                  <dt>Expected Revenue Per Position</dt>
                  <dd>{selectedRole.expectedRevenuePerPosition || "-"}</dd>
                </div>
                <div>
                  <dt>Total Expected Revenue</dt>
                  <dd>{selectedRole.totalExpectedRevenue || "-"}</dd>
                </div>
                <div>
                  <dt>Actual Revenue</dt>
                  <dd>{selectedRole.actualRevenue || "-"}</dd>
                </div>
                <div>
                  <dt>Last Activity</dt>
                  <dd>{new Date(selectedRole.lastActivity).toLocaleDateString("en-GB")}</dd>
                </div>
                <div className={styles.notesBlockInline}>
                  <dt>Notes</dt>
                  <dd>{selectedRole.notes || "-"}</dd>
                </div>
              </dl>
            ) : (
              <p className={styles.infoText}>Select a role to view details.</p>
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
                <span>Activity</span>
                <select
                  value={activityType}
                  onChange={(event) => setActivityType(event.target.value)}
                >
                  {ACTIVITY_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.modalField}>
                <span>Contact</span>
                <select
                  value={noteContactId}
                  onChange={(event) => setNoteContactId(event.target.value)}
                >
                  <option value="">Not selected</option>
                  {contactRows.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.first_name} {contact.last_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.modalField}>
                <span>Role</span>
                <select
                  value={noteRoleId}
                  onChange={(event) => setNoteRoleId(event.target.value)}
                >
                  <option value="">Not selected</option>
                  {roleRows.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className={styles.modalField}>
              <span>Communication</span>
              <textarea
                rows={5}
                value={noteBody}
                onChange={(event) => setNoteBody(event.target.value)}
              />
            </label>
            <div className={styles.communicationActions}>
              <button
                type="button"
                className={styles.submitButton}
                onClick={handleSaveNote}
                disabled={isSavingNote}
              >
                {isSavingNote ? "Saving..." : editingNoteId ? "Save changes" : "Save note"}
              </button>
              {editingNoteId ? (
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
                      <span>{note.activity_type}</span>
                      <span>{new Date(note.created_at).toLocaleString("en-GB")}</span>
                      <span>{note.contact_id ? contactNameById[note.contact_id] ?? "-" : "No contact"}</span>
                      <span>{note.role_id ? roleTitleById[note.role_id] ?? "-" : "No role"}</span>
                    </div>
                    <div className={styles.communicationMetaActions}>
                      <button
                        type="button"
                        className={styles.discreetAction}
                        onClick={() => handleEditNote(note)}
                      >
                        edit
                      </button>
                      <button
                        type="button"
                        className={styles.discreetAction}
                        onClick={() => handleDeleteNote(note.id)}
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

      {activeTab === "Candidates" ? (
        <section className={styles.detailsCard}>
          <div className={styles.detailsHeader}>
            <h2 className={styles.detailsTitle}>Candidates</h2>
          </div>
        </section>
      ) : null}
    </main>
  );
}
