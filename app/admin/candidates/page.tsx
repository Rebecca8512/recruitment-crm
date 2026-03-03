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

type CandidateRow = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  status_code: string;
  current_employer_client_id: string | null;
  updated_at: string;
};

type CandidateStatusRow = {
  code: string;
  label: string;
};

type ClientRow = {
  id: string;
  name: string;
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

type RoleRow = {
  id: string;
  title: string;
  client_id: string | null;
  contact_id: string | null;
};

type ApplicationRow = {
  role_id: string;
  candidate_id: string;
  updated_at: string;
};

export default function CandidatesPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [employments, setEmployments] = useState<EmploymentRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [selectedSearchOption, setSelectedSearchOption] =
    useState<EntitySearchOption | null>(null);
  const [statusOptions, setStatusOptions] = useState<CandidateStatusRow[]>([]);
  const [defaultStatusCodes, setDefaultStatusCodes] = useState<string[]>([]);
  const [selectedStatusCodes, setSelectedStatusCodes] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      const [
        { data: statusesData, error: statusesError },
        { data: candidatesData, error: candidatesError },
        { data: clientsData, error: clientsError },
        { data: contactsData, error: contactsError },
        { data: employmentsData, error: employmentsError },
        { data: rolesData, error: rolesError },
        { data: applicationsData, error: applicationsError },
      ] = await Promise.all([
        supabase.from("candidate_statuses").select("code,label"),
        supabase
          .from("candidates")
          .select(
            "id,first_name,last_name,phone,mobile,email,status_code,current_employer_client_id,updated_at",
          )
          .order("updated_at", { ascending: false }),
        supabase.from("clients").select("id,name").order("name", { ascending: true }),
        supabase.from("contacts").select("id,first_name,last_name"),
        supabase
          .from("contact_employments")
          .select("contact_id,client_id,is_primary,start_date,end_date"),
        supabase.from("roles").select("id,title,client_id,contact_id"),
        supabase.from("applications").select("role_id,candidate_id,updated_at"),
      ]);

      if (!isMounted) return;

      if (statusesError) {
        setErrorMessage(statusesError.message);
        setIsLoading(false);
        return;
      }

      if (candidatesError) {
        setErrorMessage(candidatesError.message);
        setIsLoading(false);
        return;
      }

      if (clientsError) {
        setErrorMessage(clientsError.message);
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

      if (rolesError) {
        setErrorMessage(rolesError.message);
        setIsLoading(false);
        return;
      }

      if (applicationsError) {
        setErrorMessage(applicationsError.message);
        setIsLoading(false);
        return;
      }

      const map = ((statusesData ?? []) as CandidateStatusRow[]).reduce<
        Record<string, string>
      >((acc, row) => {
        acc[row.code] = row.label;
        return acc;
      }, {});
      const statusRows = (statusesData ?? []) as CandidateStatusRow[];
      const defaults = statusRows
        .map((row) => row.code)
        .filter((code) => code !== "placed" && code !== "unavailable");

      setStatusMap(map);
      setCandidates((candidatesData ?? []) as CandidateRow[]);
      setClients((clientsData ?? []) as ClientRow[]);
      setContacts((contactsData ?? []) as ContactRow[]);
      setEmployments((employmentsData ?? []) as EmploymentRow[]);
      setRoles((rolesData ?? []) as RoleRow[]);
      setApplications((applicationsData ?? []) as ApplicationRow[]);
      setStatusOptions(statusRows);
      setDefaultStatusCodes(defaults.length > 0 ? defaults : statusRows.map((row) => row.code));
      setSelectedStatusCodes(
        defaults.length > 0 ? defaults : statusRows.map((row) => row.code),
      );
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

  const candidateIdsByRole = useMemo(() => {
    const output: Record<string, Set<string>> = {};

    for (const row of applications) {
      const set = output[row.role_id] ?? new Set<string>();
      set.add(row.candidate_id);
      output[row.role_id] = set;
    }

    return output;
  }, [applications]);

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

  const filteredCandidates = useMemo(() => {
    const statusFiltered = candidates.filter((candidate) =>
      selectedStatusCodes.includes(candidate.status_code),
    );

    if (!selectedSearchOption) return statusFiltered;

    if (selectedSearchOption.entityType === "candidate") {
      return statusFiltered.filter(
        (candidate) => candidate.id === selectedSearchOption.entityId,
      );
    }

    if (selectedSearchOption.entityType === "role") {
      const set = candidateIdsByRole[selectedSearchOption.entityId];
      if (!set || set.size === 0) return [];
      return statusFiltered.filter((candidate) => set.has(candidate.id));
    }

    if (selectedSearchOption.entityType === "client") {
      const roleIds = roles
        .filter((role) => role.client_id === selectedSearchOption.entityId)
        .map((role) => role.id);
      const candidateIds = new Set<string>();

      for (const roleId of roleIds) {
        for (const candidateId of candidateIdsByRole[roleId] ?? []) {
          candidateIds.add(candidateId);
        }
      }

      return statusFiltered.filter(
        (candidate) =>
          candidate.current_employer_client_id === selectedSearchOption.entityId ||
          candidateIds.has(candidate.id),
      );
    }

    const linkedClientIds = clientIdsByContact[selectedSearchOption.entityId] ?? new Set();
    const matchingRoleIds = roles
      .filter(
        (role) =>
          role.contact_id === selectedSearchOption.entityId ||
          (role.client_id ? linkedClientIds.has(role.client_id) : false),
      )
      .map((role) => role.id);

    const candidateIds = new Set<string>();
    for (const roleId of matchingRoleIds) {
      for (const candidateId of candidateIdsByRole[roleId] ?? []) {
        candidateIds.add(candidateId);
      }
    }

    return statusFiltered.filter(
      (candidate) =>
        (candidate.current_employer_client_id
          ? linkedClientIds.has(candidate.current_employer_client_id)
          : false) || candidateIds.has(candidate.id),
    );
  }, [
    candidateIdsByRole,
    candidates,
    clientIdsByContact,
    roles,
    selectedSearchOption,
    selectedStatusCodes,
  ]);

  const lastActivityByCandidate = useMemo(() => {
    const appActivity: Record<string, number> = {};

    for (const row of applications) {
      const updated = new Date(row.updated_at).getTime();
      appActivity[row.candidate_id] = Math.max(
        appActivity[row.candidate_id] ?? 0,
        updated,
      );
    }

    return candidates.reduce<Record<string, string>>((acc, candidate) => {
      const candidateUpdated = new Date(candidate.updated_at).getTime();
      const latest = Math.max(candidateUpdated, appActivity[candidate.id] ?? 0);
      acc[candidate.id] = new Date(latest).toISOString();
      return acc;
    }, {});
  }, [applications, candidates]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>CRM</p>
        <h1 className={styles.title}>Candidates</h1>
        <div className={styles.headerControls}>
          <Link href="/admin/candidates/new" className={styles.inlineTextLink}>
            Add new candidate
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
        {isLoading ? <p className={styles.infoText}>Loading candidates...</p> : null}
        {errorMessage ? <p className={styles.errorText}>{errorMessage}</p> : null}

        {!isLoading && !errorMessage ? (
          filteredCandidates.length > 0 ? (
            <div className={styles.tableWrap}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Candidate Name</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Last Activity</th>
                    <th>Profile</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCandidates.map((candidate) => (
                    <tr key={candidate.id}>
                      <td>{`${candidate.first_name} ${candidate.last_name}`.trim()}</td>
                      <td>{candidate.mobile || candidate.phone || "-"}</td>
                      <td>{candidate.email || "-"}</td>
                      <td>
                        <span className={styles.statusBadge}>
                          {statusMap[candidate.status_code] ?? candidate.status_code}
                        </span>
                      </td>
                      <td>
                        {lastActivityByCandidate[candidate.id]
                          ? new Date(
                              lastActivityByCandidate[candidate.id],
                            ).toLocaleDateString("en-GB")
                          : "-"}
                      </td>
                      <td>
                        <Link
                          href={`/admin/candidates/${candidate.id}`}
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
                ? "No candidates matched that selection."
                : "No candidates yet. Click Add new candidate to create your first record."}
            </p>
          )
        ) : null}
      </section>
    </main>
  );
}
