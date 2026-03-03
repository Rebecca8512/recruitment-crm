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

type RoleRow = {
  id: string;
  title: string;
  client_id: string | null;
  contact_id: string | null;
  job_type: string;
  status_code: string;
  total_expected_revenue: string | null;
  expected_revenue_per_position: string | null;
  estimated_fee: number | null;
  updated_at: string;
};

type StatusRow = {
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

type CandidateRow = {
  id: string;
  first_name: string;
  last_name: string;
};

type ApplicationRow = {
  role_id: string;
  candidate_id: string;
  updated_at: string;
};

function formatJobType(value: string) {
  if (!value) return "-";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function RolesPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [clients, setClients] = useState<ClientRow[]>([]);
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
        { data: statusesData, error: statusesError },
        { data: rolesData, error: rolesError },
        { data: clientsData, error: clientsError },
        { data: contactsData, error: contactsError },
        { data: employmentsData, error: employmentsError },
        { data: candidatesData, error: candidatesError },
        { data: applicationsData, error: applicationsError },
      ] = await Promise.all([
        supabase.from("role_statuses").select("code,label"),
        supabase
          .from("roles")
          .select(
            "id,title,client_id,contact_id,job_type,status_code,total_expected_revenue,expected_revenue_per_position,estimated_fee,updated_at",
          )
          .order("updated_at", { ascending: false }),
        supabase.from("clients").select("id,name").order("name", { ascending: true }),
        supabase.from("contacts").select("id,first_name,last_name"),
        supabase
          .from("contact_employments")
          .select("contact_id,client_id,is_primary,start_date,end_date"),
        supabase.from("candidates").select("id,first_name,last_name"),
        supabase.from("applications").select("role_id,candidate_id,updated_at"),
      ]);

      if (!isMounted) return;

      if (statusesError) {
        setErrorMessage(statusesError.message);
        setIsLoading(false);
        return;
      }

      if (rolesError) {
        setErrorMessage(rolesError.message);
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

      const map = ((statusesData ?? []) as StatusRow[]).reduce<
        Record<string, string>
      >((acc, row) => {
        acc[row.code] = row.label;
        return acc;
      }, {});
      const statusRows = (statusesData ?? []) as StatusRow[];
      const defaults = statusRows
        .map((row) => row.code)
        .filter((code) => code !== "on_hold" && code !== "closed_lost");

      setStatusMap(map);
      setRoles((rolesData ?? []) as RoleRow[]);
      setClients((clientsData ?? []) as ClientRow[]);
      setContacts((contactsData ?? []) as ContactRow[]);
      setEmployments((employmentsData ?? []) as EmploymentRow[]);
      setCandidates((candidatesData ?? []) as CandidateRow[]);
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

  const roleIdsByCandidate = useMemo(() => {
    const output: Record<string, Set<string>> = {};

    for (const row of applications) {
      const set = output[row.candidate_id] ?? new Set<string>();
      set.add(row.role_id);
      output[row.candidate_id] = set;
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

  const filteredRoles = useMemo(() => {
    const statusFiltered = roles.filter((role) =>
      selectedStatusCodes.includes(role.status_code),
    );

    if (!selectedSearchOption) return statusFiltered;

    if (selectedSearchOption.entityType === "role") {
      return statusFiltered.filter((role) => role.id === selectedSearchOption.entityId);
    }

    if (selectedSearchOption.entityType === "client") {
      return statusFiltered.filter(
        (role) => role.client_id === selectedSearchOption.entityId,
      );
    }

    if (selectedSearchOption.entityType === "contact") {
      const clientSet = clientIdsByContact[selectedSearchOption.entityId] ?? new Set();
      return statusFiltered.filter(
        (role) =>
          role.contact_id === selectedSearchOption.entityId ||
          (role.client_id ? clientSet.has(role.client_id) : false),
      );
    }

    const set = roleIdsByCandidate[selectedSearchOption.entityId];
    if (!set || set.size === 0) return [];
    return statusFiltered.filter((role) => set.has(role.id));
  }, [
    clientIdsByContact,
    roleIdsByCandidate,
    roles,
    selectedSearchOption,
    selectedStatusCodes,
  ]);

  const lastActivityByRole = useMemo(() => {
    const appActivity: Record<string, number> = {};

    for (const row of applications) {
      const updated = new Date(row.updated_at).getTime();
      appActivity[row.role_id] = Math.max(appActivity[row.role_id] ?? 0, updated);
    }

    return roles.reduce<Record<string, string>>((acc, role) => {
      const roleUpdated = new Date(role.updated_at).getTime();
      const latest = Math.max(roleUpdated, appActivity[role.id] ?? 0);
      acc[role.id] = new Date(latest).toISOString();
      return acc;
    }, {});
  }, [applications, roles]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>CRM</p>
        <h1 className={styles.title}>Roles</h1>
        <div className={styles.headerControls}>
          <Link href="/admin/roles/new" className={styles.inlineTextLink}>
            Add new role
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
        {isLoading ? <p className={styles.infoText}>Loading roles...</p> : null}
        {errorMessage ? <p className={styles.errorText}>{errorMessage}</p> : null}

        {!isLoading && !errorMessage ? (
          filteredRoles.length > 0 ? (
            <div className={styles.tableWrap}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Role Title</th>
                    <th>Client Name</th>
                    <th>Job Type</th>
                    <th>Status</th>
                    <th>Expected Revenue</th>
                    <th>Last Activity</th>
                    <th>Profile</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRoles.map((role) => (
                    <tr key={role.id}>
                      <td>{role.title}</td>
                      <td>
                        {role.client_id && clientNameById[role.client_id] ? (
                          <Link
                            href={`/admin/clients/${role.client_id}`}
                            className={styles.tableEntityLink}
                          >
                            {clientNameById[role.client_id]}
                          </Link>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td>{formatJobType(role.job_type)}</td>
                      <td>
                        <span className={styles.statusBadge}>
                          {statusMap[role.status_code] ?? role.status_code}
                        </span>
                      </td>
                      <td>
                        {role.total_expected_revenue ||
                          role.expected_revenue_per_position ||
                          (typeof role.estimated_fee === "number"
                            ? role.estimated_fee.toLocaleString("en-GB", {
                                style: "currency",
                                currency: "GBP",
                                maximumFractionDigits: 2,
                              })
                            : "-")}
                      </td>
                      <td>
                        {lastActivityByRole[role.id]
                          ? new Date(lastActivityByRole[role.id]).toLocaleDateString(
                              "en-GB",
                            )
                          : "-"}
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
            <p className={styles.infoText}>
              {selectedSearchOption
                ? "No roles matched that selection."
                : "No roles yet. Click Add new role to create your first record."}
            </p>
          )
        ) : null}
      </section>
    </main>
  );
}
