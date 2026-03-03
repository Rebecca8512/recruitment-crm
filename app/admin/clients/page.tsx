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
  id: string;
  title: string;
  client_id: string | null;
  closed_on: string | null;
  updated_at: string;
};

type ContactRow = {
  id: string;
  first_name: string;
  last_name: string;
};

type EmploymentRow = {
  contact_id: string;
  client_id: string | null;
  is_primary: boolean | null;
  start_date: string | null;
  end_date: string | null;
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

type ClientNoteRow = {
  client_id: string;
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
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [employments, setEmployments] = useState<EmploymentRow[]>([]);
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [selectedSearchOption, setSelectedSearchOption] =
    useState<EntitySearchOption | null>(null);
  const [statusOptions, setStatusOptions] = useState<StatusRow[]>([]);
  const [defaultStatusCodes, setDefaultStatusCodes] = useState<string[]>([]);
  const [selectedStatusCodes, setSelectedStatusCodes] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      const [
        { data: statusData, error: statusError },
        { data: clientsData, error },
        { data: rolesData, error: rolesError },
        { data: contactsData, error: contactsError },
        { data: employmentsData, error: employmentsError },
        { data: candidatesData, error: candidatesError },
        { data: applicationsData, error: applicationsError },
        { data: clientNotesData, error: clientNotesError },
      ] = await Promise.all([
        supabase.from("client_statuses").select("code,label"),
        supabase
          .from("clients")
          .select("id,name,contact_number,status_code,updated_at")
          .order("name", { ascending: true }),
        supabase.from("roles").select("id,title,client_id,closed_on,updated_at"),
        supabase.from("contacts").select("id,first_name,last_name"),
        supabase
          .from("contact_employments")
          .select("contact_id,client_id,is_primary,start_date,end_date"),
        supabase.from("candidates").select("id,first_name,last_name"),
        supabase.from("applications").select("candidate_id,role_id"),
        supabase.from("client_communication_notes").select("client_id,updated_at"),
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

      const map = ((statusData ?? []) as StatusRow[]).reduce<
        Record<string, string>
      >((acc, row) => {
        acc[row.code] = row.label;
        return acc;
      }, {});
      const statusRows = (statusData ?? []) as StatusRow[];
      const activeStatusCodes = statusRows
        .filter(
          (row) =>
            row.code === "active_client" ||
            row.label.trim().toLowerCase() === "active client",
        )
        .map((row) => row.code);
      const defaults =
        activeStatusCodes.length > 0
          ? activeStatusCodes
          : statusRows.map((row) => row.code);

      const roleRows = (rolesData ?? []) as RoleRow[];
      const openRoles: Record<string, number> = {};
      const roleLastActivity: Record<string, number> = {};

      for (const role of roleRows) {
        if (!role.closed_on && role.client_id) {
          openRoles[role.client_id] = (openRoles[role.client_id] ?? 0) + 1;
        }

        const roleUpdated = new Date(role.updated_at).getTime();
        if (role.client_id) {
          roleLastActivity[role.client_id] = Math.max(
            roleLastActivity[role.client_id] ?? 0,
            roleUpdated,
          );
        }
      }

      const clientsRows = (clientsData ?? []) as ClientRow[];
      const clientNoteLastActivity: Record<string, number> = {};
      for (const note of (clientNotesData ?? []) as ClientNoteRow[]) {
        const noteUpdated = new Date(note.updated_at).getTime();
        clientNoteLastActivity[note.client_id] = Math.max(
          clientNoteLastActivity[note.client_id] ?? 0,
          noteUpdated,
        );
      }
      const lastActivity: Record<string, string> = {};

      for (const client of clientsRows) {
        const clientUpdated = new Date(client.updated_at).getTime();
        const latest = Math.max(
          clientUpdated,
          roleLastActivity[client.id] ?? 0,
          clientNoteLastActivity[client.id] ?? 0,
        );
        lastActivity[client.id] = new Date(latest).toISOString();
      }

      setStatusMap(map);
      setOpenRoleCountMap(openRoles);
      setLastActivityMap(lastActivity);
      setClients(clientsRows);
      setRoles((rolesData ?? []) as RoleRow[]);
      setContacts((contactsData ?? []) as ContactRow[]);
      setEmployments((employmentsData ?? []) as EmploymentRow[]);
      setCandidates((candidatesData ?? []) as CandidateRow[]);
      setApplications((applicationsData ?? []) as ApplicationRow[]);
      setStatusOptions(statusRows);
      setDefaultStatusCodes(defaults);
      setSelectedStatusCodes(defaults);
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

  const roleById = useMemo(() => {
    return roles.reduce<Record<string, RoleRow>>((acc, role) => {
      acc[role.id] = role;
      return acc;
    }, {});
  }, [roles]);

  const clientIdsByContact = useMemo(() => {
    const grouped = employments.reduce<Record<string, EmploymentRow[]>>(
      (acc, row) => {
        acc[row.contact_id] = acc[row.contact_id]
          ? [...acc[row.contact_id], row]
          : [row];
        return acc;
      },
      {},
    );

    const output: Record<string, Set<string>> = {};

    for (const [contactId, rows] of Object.entries(grouped)) {
      const clientIds = new Set(
        rows
          .map((row) => row.client_id)
          .filter((id): id is string => Boolean(id && clientNameById[id])),
      );
      output[contactId] = clientIds;
    }

    return output;
  }, [clientNameById, employments]);

  const displayCompanyByContact = useMemo(() => {
    const grouped = employments.reduce<Record<string, EmploymentRow[]>>(
      (acc, row) => {
        acc[row.contact_id] = acc[row.contact_id]
          ? [...acc[row.contact_id], row]
          : [row];
        return acc;
      },
      {},
    );

    const output: Record<string, string> = {};

    for (const [contactId, rows] of Object.entries(grouped)) {
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
  }, [clientNameById, employments]);

  const clientIdsByCandidate = useMemo(() => {
    const output: Record<string, Set<string>> = {};

    for (const row of applications) {
      const role = roleById[row.role_id];
      if (!role?.client_id) continue;

      const set = output[row.candidate_id] ?? new Set<string>();
      set.add(role.client_id);
      output[row.candidate_id] = set;
    }

    return output;
  }, [applications, roleById]);

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

  const filteredClients = useMemo(() => {
    const statusFiltered = clients.filter((client) =>
      client.status_code ? selectedStatusCodes.includes(client.status_code) : false,
    );

    if (!selectedSearchOption) return statusFiltered;

    if (selectedSearchOption.entityType === "client") {
      return statusFiltered.filter(
        (client) => client.id === selectedSearchOption.entityId,
      );
    }

    if (selectedSearchOption.entityType === "role") {
      const role = roleById[selectedSearchOption.entityId];
      if (!role?.client_id) return [];
      return statusFiltered.filter((client) => client.id === role.client_id);
    }

    if (selectedSearchOption.entityType === "contact") {
      const set = clientIdsByContact[selectedSearchOption.entityId];
      if (!set || set.size === 0) return [];
      return statusFiltered.filter((client) => set.has(client.id));
    }

    const set = clientIdsByCandidate[selectedSearchOption.entityId];
    if (!set || set.size === 0) return [];
    return statusFiltered.filter((client) => set.has(client.id));
  }, [
    clientIdsByCandidate,
    clientIdsByContact,
    clients,
    roleById,
    selectedStatusCodes,
    selectedSearchOption,
  ]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>CRM</p>
        <h1 className={styles.title}>Clients</h1>
        <div className={styles.headerControls}>
          <Link href="/admin/clients/new" className={styles.inlineTextLink}>
            Add new client
          </Link>
          <EntitySearch
            options={searchOptions}
            selected={selectedSearchOption}
            onSelect={(option) => setSelectedSearchOption(option)}
            onClear={() => setSelectedSearchOption(null)}
            placeholder="Search"
          />
          <StatusFilter
            options={statusOptions.map((row) => ({ value: row.code, label: row.label }))}
            selectedValues={selectedStatusCodes}
            onChange={setSelectedStatusCodes}
            onReset={() => setSelectedStatusCodes(defaultStatusCodes)}
          />
        </div>
      </header>

      <section className={styles.card}>
        {isLoading ? <p className={styles.infoText}>Loading clients...</p> : null}
        {errorMessage ? <p className={styles.errorText}>{errorMessage}</p> : null}

        {!isLoading && !errorMessage ? (
          filteredClients.length > 0 ? (
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
                  {filteredClients.map((client) => (
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
              {selectedSearchOption
                ? "No clients matched that selection."
                : "No clients yet. Click Add new client to create your first record."}
            </p>
          )
        ) : null}
      </section>
    </main>
  );
}
