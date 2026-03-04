"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  EntitySearch,
  type EntitySearchOption,
} from "@/src/components/search/entity-search";
import { StatusFilter } from "@/src/components/filters/status-filter";
import { getSupabaseBrowserClient } from "@/src/lib/supabase";
import styles from "../entity-page.module.css";

type ContactRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  mobile: string | null;
  work_phone: string | null;
  phone: string | null;
  status_code: string | null;
  updated_at: string;
};

type EmploymentRow = {
  contact_id: string;
  client_id: string | null;
  is_primary: boolean | null;
  start_date: string | null;
  end_date: string | null;
  updated_at: string;
};

type ClientRow = {
  id: string;
  name: string;
};

type RoleRow = {
  id: string;
  title: string;
  client_id: string | null;
  contact_id: string | null;
  updated_at: string;
};

type CandidateRow = {
  id: string;
  first_name: string;
  last_name: string;
};

type ApplicationRow = {
  candidate_id: string;
  role_id: string;
};

type ContactStatusRow = {
  code: string;
  label: string;
};

export default function ContactsPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [employments, setEmployments] = useState<EmploymentRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [contactStatuses, setContactStatuses] = useState<ContactStatusRow[]>([]);
  const [selectedSearchOption, setSelectedSearchOption] =
    useState<EntitySearchOption | null>(null);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([
    "active_contact",
  ]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      const [
        { data: contactsData, error: contactsError },
        { data: employmentsData, error: employmentsError },
        { data: clientsData, error: clientsError },
        { data: rolesData, error: rolesError },
        { data: candidatesData, error: candidatesError },
        { data: applicationsData, error: applicationsError },
        { data: contactStatusesData, error: contactStatusesError },
      ] = await Promise.all([
        supabase
          .from("contacts")
          .select(
            "id,first_name,last_name,email,mobile,work_phone,phone,status_code,updated_at",
          )
          .order("first_name", { ascending: true })
          .order("last_name", { ascending: true }),
        supabase
          .from("contact_employments")
          .select("contact_id,client_id,is_primary,start_date,end_date,updated_at"),
        supabase.from("clients").select("id,name").order("name", { ascending: true }),
        supabase
          .from("roles")
          .select("id,title,client_id,contact_id,updated_at")
          .order("updated_at", { ascending: false }),
        supabase.from("candidates").select("id,first_name,last_name"),
        supabase.from("applications").select("candidate_id,role_id"),
        supabase
          .from("contact_statuses")
          .select("code,label")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
      ]);

      if (!isMounted) return;

      if (contactsError) {
        setErrorMessage(contactsError.message);
        setIsLoading(false);
        return;
      }

      if (employmentsError) {
        setErrorMessage(employmentsError.message);
        setIsLoading(false);
        return;
      }

      if (clientsError) {
        setErrorMessage(clientsError.message);
        setIsLoading(false);
        return;
      }

      if (rolesError) {
        setErrorMessage(rolesError.message);
        setIsLoading(false);
        return;
      }

      if (candidatesError) {
        setErrorMessage(candidatesError.message);
        setIsLoading(false);
        return;
      }

      if (applicationsError) {
        setErrorMessage(applicationsError.message);
        setIsLoading(false);
        return;
      }

      if (contactStatusesError) {
        setErrorMessage(contactStatusesError.message);
        setIsLoading(false);
        return;
      }

      setContacts((contactsData ?? []) as ContactRow[]);
      setEmployments((employmentsData ?? []) as EmploymentRow[]);
      setClients((clientsData ?? []) as ClientRow[]);
      setRoles((rolesData ?? []) as RoleRow[]);
      setCandidates((candidatesData ?? []) as CandidateRow[]);
      setApplications((applicationsData ?? []) as ApplicationRow[]);
      setContactStatuses((contactStatusesData ?? []) as ContactStatusRow[]);
      setIsLoading(false);
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  const clientNameById = useMemo(() => {
    return clients.reduce<Record<string, string>>((acc, client) => {
      acc[client.id] = client.name;
      return acc;
    }, {});
  }, [clients]);

  const contactNameById = useMemo(() => {
    return contacts.reduce<Record<string, string>>((acc, contact) => {
      acc[contact.id] = `${contact.first_name} ${contact.last_name}`.trim();
      return acc;
    }, {});
  }, [contacts]);

  const roleById = useMemo(() => {
    return roles.reduce<Record<string, RoleRow>>((acc, role) => {
      acc[role.id] = role;
      return acc;
    }, {});
  }, [roles]);

  const employmentsByContact = useMemo(() => {
    return employments.reduce<Record<string, EmploymentRow[]>>((acc, row) => {
      acc[row.contact_id] = acc[row.contact_id]
        ? [...acc[row.contact_id], row]
        : [row];
      return acc;
    }, {});
  }, [employments]);

  const contactIdsByClient = useMemo(() => {
    const output: Record<string, Set<string>> = {};

    for (const row of employments) {
      if (!row.client_id || !contactNameById[row.contact_id]) continue;
      const set = output[row.client_id] ?? new Set<string>();
      set.add(row.contact_id);
      output[row.client_id] = set;
    }

    return output;
  }, [contactNameById, employments]);

  const displayCompanyByContact = useMemo(() => {
    const output: Record<string, string> = {};

    for (const [contactId, rows] of Object.entries(employmentsByContact)) {
      const prioritized = [...rows].sort((a, b) => {
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

      const clientId = prioritized[0]?.client_id;
      if (clientId && clientNameById[clientId]) {
        output[contactId] = clientNameById[clientId];
      }
    }

    return output;
  }, [clientNameById, employmentsByContact]);

  const clientIdByContact = useMemo(() => {
    const output: Record<string, string> = {};

    for (const [contactId, rows] of Object.entries(employmentsByContact)) {
      const prioritized = [...rows].sort((a, b) => {
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

      const clientId = prioritized[0]?.client_id;
      if (clientId && clientNameById[clientId]) {
        output[contactId] = clientId;
      }
    }

    return output;
  }, [clientNameById, employmentsByContact]);

  const statusLabelByCode = useMemo(() => {
    return contactStatuses.reduce<Record<string, string>>((acc, status) => {
      acc[status.code] = status.label;
      return acc;
    }, {});
  }, [contactStatuses]);

  const lastActivityMap = useMemo(() => {
    const output: Record<string, string> = {};
    const employmentActivity: Record<string, number> = {};
    const roleActivity: Record<string, number> = {};

    for (const row of employments) {
      const activity = row.updated_at ? new Date(row.updated_at).getTime() : 0;
      employmentActivity[row.contact_id] = Math.max(
        employmentActivity[row.contact_id] ?? 0,
        activity,
      );
    }

    for (const role of roles) {
      if (!role.contact_id) continue;
      const activity = new Date(role.updated_at).getTime();
      roleActivity[role.contact_id] = Math.max(
        roleActivity[role.contact_id] ?? 0,
        activity,
      );
    }

    for (const contact of contacts) {
      const contactUpdated = new Date(contact.updated_at).getTime();
      const latest = Math.max(
        contactUpdated,
        employmentActivity[contact.id] ?? 0,
        roleActivity[contact.id] ?? 0,
      );
      output[contact.id] = new Date(latest).toISOString();
    }

    return output;
  }, [contacts, employments, roles]);

  const contactIdsByRole = useMemo(() => {
    const output: Record<string, Set<string>> = {};

    for (const role of roles) {
      const set = output[role.id] ?? new Set<string>();

      if (role.contact_id && contactNameById[role.contact_id]) {
        set.add(role.contact_id);
      }

      if (role.client_id && contactIdsByClient[role.client_id]) {
        for (const contactId of contactIdsByClient[role.client_id]) {
          set.add(contactId);
        }
      }

      output[role.id] = set;
    }

    return output;
  }, [contactIdsByClient, contactNameById, roles]);

  const contactIdsByCandidate = useMemo(() => {
    const output: Record<string, Set<string>> = {};

    for (const row of applications) {
      const role = roleById[row.role_id];
      if (!role) continue;

      const set = output[row.candidate_id] ?? new Set<string>();

      for (const contactId of contactIdsByRole[role.id] ?? []) {
        set.add(contactId);
      }

      output[row.candidate_id] = set;
    }

    return output;
  }, [applications, contactIdsByRole, roleById]);

  const searchOptions = useMemo<EntitySearchOption[]>(() => {
    const clientOptions = clients.map((client) => ({
      key: `client:${client.id}`,
      entityId: client.id,
      entityType: "client" as const,
      label: client.name,
      searchText: `${client.name} client`,
    }));

    const contactOptions = contacts.map((contact) => {
      const label = `${contact.first_name} ${contact.last_name}`.trim();
      const company = displayCompanyByContact[contact.id];
      return {
        key: `contact:${contact.id}`,
        entityId: contact.id,
        entityType: "contact" as const,
        label,
        subtitle: company ? `at ${company}` : undefined,
        searchText: `${label} contact ${company ?? ""}`,
      };
    });

    const roleOptions = roles.map((role) => {
      const company = role.client_id ? clientNameById[role.client_id] : "";
      return {
        key: `role:${role.id}`,
        entityId: role.id,
        entityType: "role" as const,
        label: role.title,
        subtitle: company ? `for ${company}` : undefined,
        searchText: `${role.title} role ${company}`,
      };
    });

    const candidateOptions = candidates.map((candidate) => {
      const label = `${candidate.first_name} ${candidate.last_name}`.trim();
      return {
        key: `candidate:${candidate.id}`,
        entityId: candidate.id,
        entityType: "candidate" as const,
        label,
        searchText: `${label} candidate`,
      };
    });

    return [...clientOptions, ...contactOptions, ...roleOptions, ...candidateOptions];
  }, [candidates, clientNameById, clients, contacts, displayCompanyByContact, roles]);

  const filteredContacts = useMemo(() => {
    const statusFiltered = contacts.filter((contact) =>
      selectedStatuses.includes(contact.status_code ?? "target_contact"),
    );

    if (!selectedSearchOption) return statusFiltered;

    if (selectedSearchOption.entityType === "contact") {
      return statusFiltered.filter(
        (contact) => contact.id === selectedSearchOption.entityId,
      );
    }

    if (selectedSearchOption.entityType === "client") {
      const set = contactIdsByClient[selectedSearchOption.entityId];
      if (!set || set.size === 0) return [];
      return statusFiltered.filter((contact) => set.has(contact.id));
    }

    if (selectedSearchOption.entityType === "role") {
      const set = contactIdsByRole[selectedSearchOption.entityId];
      if (!set || set.size === 0) return [];
      return statusFiltered.filter((contact) => set.has(contact.id));
    }

    const set = contactIdsByCandidate[selectedSearchOption.entityId];
    if (!set || set.size === 0) return [];
    return statusFiltered.filter((contact) => set.has(contact.id));
  }, [
    contactIdsByCandidate,
    contactIdsByClient,
    contactIdsByRole,
    contacts,
    selectedStatuses,
    selectedSearchOption,
  ]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>CRM</p>
        <h1 className={styles.title}>Contacts</h1>
        <div className={styles.headerControls}>
          <Link href="/admin/contacts/new" className={styles.inlineTextLink}>
            Add new contact
          </Link>
          <EntitySearch
            options={searchOptions}
            selected={selectedSearchOption}
            onSelect={(option) => setSelectedSearchOption(option)}
            onClear={() => setSelectedSearchOption(null)}
            placeholder="Search"
          />
          <StatusFilter
            options={contactStatuses.map((option) => ({
              value: option.code,
              label: option.label,
            }))}
            selectedValues={selectedStatuses}
            onChange={setSelectedStatuses}
            onReset={() => setSelectedStatuses(["active_contact"])}
          />
        </div>
      </header>

      <section className={styles.card}>
        {isLoading ? <p className={styles.infoText}>Loading contacts...</p> : null}
        {errorMessage ? <p className={styles.errorText}>{errorMessage}</p> : null}

        {!isLoading && !errorMessage ? (
          filteredContacts.length > 0 ? (
            <div className={styles.tableWrap}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Contact Name</th>
                    <th>Email</th>
                    <th>Contact Number</th>
                    <th>Client Name</th>
                    <th>Status</th>
                    <th>Last Activity</th>
                    <th>Profile</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContacts.map((contact) => (
                    <tr key={contact.id}>
                      <td>{`${contact.first_name} ${contact.last_name}`.trim()}</td>
                      <td>{contact.email || "-"}</td>
                      <td>
                        {contact.mobile ||
                          contact.work_phone ||
                          contact.phone ||
                          "-"}
                      </td>
                      <td>
                        {clientIdByContact[contact.id] &&
                        displayCompanyByContact[contact.id] ? (
                          <Link
                            href={`/admin/clients/${clientIdByContact[contact.id]}`}
                            className={styles.tableEntityLink}
                          >
                            {displayCompanyByContact[contact.id]}
                          </Link>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td>
                        <span className={styles.statusBadge}>
                          {statusLabelByCode[contact.status_code ?? ""] ??
                            contact.status_code ??
                            "Target Contact"}
                        </span>
                      </td>
                      <td>
                        {lastActivityMap[contact.id]
                          ? new Date(lastActivityMap[contact.id]).toLocaleDateString(
                              "en-GB",
                            )
                          : "-"}
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
            <p className={styles.infoText}>
              {selectedSearchOption
                ? "No contacts matched that selection."
                : "No contacts yet. Click Add new contact to create your first record."}
            </p>
          )
        ) : null}
      </section>
    </main>
  );
}
