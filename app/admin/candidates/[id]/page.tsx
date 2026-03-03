"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/src/lib/supabase";
import styles from "./profile.module.css";

type CandidateRecord = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  status_code: string;
  current_employer_client_id: string | null;
  current_company: string | null;
  current_title: string | null;
  highest_qualification: string | null;
  current_salary: number | null;
  expected_salary: number | null;
  source: string | null;
  notes: string | null;
  updated_at: string;
};

type CandidateStatusRecord = {
  code: string;
  label: string;
};

type RoleStatusRecord = {
  code: string;
  label: string;
};

type ClientRecord = {
  id: string;
  name: string;
};

type RoleRecord = {
  id: string;
  title: string;
  client_id: string | null;
  status_code: string;
  job_type: string;
  target_date: string | null;
  updated_at: string;
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

type CandidateApplicationRow = {
  id: string;
  roleId: string;
  roleTitle: string;
  clientName: string | null;
  roleStatus: string;
  jobType: string;
  targetDate: string | null;
  stage: string;
  source: string | null;
  submittedOn: string | null;
  outcome: string | null;
  notes: string | null;
  lastActivity: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TABS = ["Overview", "Roles", "Notes", "Files"] as const;
const STAGE_OPTIONS = [
  "applied",
  "screening",
  "shortlisted",
  "interview",
  "offer",
  "placed",
  "rejected",
  "withdrawn",
] as const;
const FILE_PLACEHOLDERS = [
  { key: "resume", name: "Resume", status: "Coming soon" },
  { key: "formatted_resume", name: "Formatted Resume", status: "Coming soon" },
  { key: "cover_letter", name: "Cover Letter", status: "Coming soon" },
  { key: "offer_docs", name: "Offer Documents", status: "Coming soon" },
] as const;

function formatJobType(value: string) {
  if (!value) return "-";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function CandidateProfilePage() {
  const params = useParams<{ id?: string }>();
  const candidateId = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [candidate, setCandidate] = useState<CandidateRecord | null>(null);
  const [statusLabel, setStatusLabel] = useState("-");
  const [employerLabel, setEmployerLabel] = useState("-");

  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [clientNameById, setClientNameById] = useState<Record<string, string>>({});
  const [roleStatusByCode, setRoleStatusByCode] = useState<Record<string, string>>({});

  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("Overview");
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [modalError, setModalError] = useState("");
  const [isSavingApplication, setIsSavingApplication] = useState(false);
  const [roleQuery, setRoleQuery] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [applicationStage, setApplicationStage] = useState<string>("applied");
  const [applicationSource, setApplicationSource] = useState("");
  const [applicationSubmittedOn, setApplicationSubmittedOn] = useState("");
  const [applicationOutcome, setApplicationOutcome] = useState("");
  const [applicationNotes, setApplicationNotes] = useState("");

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!candidateId || !UUID_PATTERN.test(candidateId)) {
        setErrorMessage("Invalid candidate id.");
        setIsLoading(false);
        return;
      }

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (!isMounted) return;

      if (sessionError || !sessionData.session?.user) {
        router.replace("/admin");
        return;
      }

      setCurrentUserId(sessionData.session.user.id);

      const [
        { data: candidateData, error: candidateError },
        { data: candidateStatuses, error: candidateStatusError },
        { data: rolesData, error: rolesError },
        { data: roleStatuses, error: roleStatusesError },
        { data: applicationsData, error: applicationsError },
        { data: clientsData, error: clientsError },
      ] = await Promise.all([
        supabase
          .from("candidates")
          .select(
            "id,first_name,last_name,email,phone,mobile,status_code,current_employer_client_id,current_company,current_title,highest_qualification,current_salary,expected_salary,source,notes,updated_at",
          )
          .eq("id", candidateId)
          .maybeSingle<CandidateRecord>(),
        supabase.from("candidate_statuses").select("code,label"),
        supabase
          .from("roles")
          .select("id,title,client_id,status_code,job_type,target_date,updated_at")
          .order("updated_at", { ascending: false }),
        supabase.from("role_statuses").select("code,label"),
        supabase
          .from("applications")
          .select("id,role_id,candidate_id,stage,source,submitted_on,outcome,notes,updated_at")
          .eq("candidate_id", candidateId)
          .order("updated_at", { ascending: false }),
        supabase.from("clients").select("id,name"),
      ]);

      if (!isMounted) return;

      if (candidateError) {
        setErrorMessage(candidateError.message);
        setIsLoading(false);
        return;
      }

      if (!candidateData) {
        setErrorMessage("Candidate not found.");
        setIsLoading(false);
        return;
      }

      if (candidateStatusError) {
        setErrorMessage(candidateStatusError.message);
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

      if (applicationsError) {
        setErrorMessage(applicationsError.message);
        setIsLoading(false);
        return;
      }

      if (clientsError) {
        setErrorMessage(clientsError.message);
        setIsLoading(false);
        return;
      }

      const candidateStatusMap = ((candidateStatuses ?? []) as CandidateStatusRecord[]).reduce<
        Record<string, string>
      >((acc, row) => {
        acc[row.code] = row.label;
        return acc;
      }, {});

      const roleStatusMap = ((roleStatuses ?? []) as RoleStatusRecord[]).reduce<
        Record<string, string>
      >((acc, row) => {
        acc[row.code] = row.label;
        return acc;
      }, {});

      const clientMap = ((clientsData ?? []) as ClientRecord[]).reduce<Record<string, string>>(
        (acc, row) => {
          acc[row.id] = row.name;
          return acc;
        },
        {},
      );

      setStatusLabel(candidateStatusMap[candidateData.status_code] ?? candidateData.status_code);

      if (candidateData.current_employer_client_id) {
        setEmployerLabel(
          clientMap[candidateData.current_employer_client_id] ??
            candidateData.current_company ??
            "-",
        );
      } else {
        setEmployerLabel(candidateData.current_company || "-");
      }

      setCandidate(candidateData);
      setRoles((rolesData ?? []) as RoleRecord[]);
      setApplications((applicationsData ?? []) as ApplicationRecord[]);
      setClientNameById(clientMap);
      setRoleStatusByCode(roleStatusMap);
      setIsLoading(false);
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [candidateId, router, supabase]);

  const roleById = useMemo(() => {
    return roles.reduce<Record<string, RoleRecord>>((acc, role) => {
      acc[role.id] = role;
      return acc;
    }, {});
  }, [roles]);

  const applicationRows = useMemo<CandidateApplicationRow[]>(() => {
    return applications
      .map((app) => {
        const role = roleById[app.role_id];
        if (!role) {
          return {
            id: app.id,
            roleId: app.role_id,
            roleTitle: "Role unavailable",
            clientName: null,
            roleStatus: "-",
            jobType: "",
            targetDate: null,
            stage: app.stage,
            source: app.source,
            submittedOn: app.submitted_on,
            outcome: app.outcome,
            notes: app.notes,
            lastActivity: app.updated_at,
          };
        }

        return {
          id: app.id,
          roleId: role.id,
          roleTitle: role.title,
          clientName: role.client_id ? (clientNameById[role.client_id] ?? null) : null,
          roleStatus: roleStatusByCode[role.status_code] ?? role.status_code,
          jobType: role.job_type,
          targetDate: role.target_date,
          stage: app.stage,
          source: app.source,
          submittedOn: app.submitted_on,
          outcome: app.outcome,
          notes: app.notes,
          lastActivity: app.updated_at,
        };
      })
      .sort((a, b) => {
        const aSubmitted = a.submittedOn ? new Date(a.submittedOn).getTime() : 0;
        const bSubmitted = b.submittedOn ? new Date(b.submittedOn).getTime() : 0;
        if (aSubmitted !== bSubmitted) return bSubmitted - aSubmitted;
        return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
      });
  }, [applications, clientNameById, roleById, roleStatusByCode]);

  const effectiveSelectedApplicationId = useMemo(() => {
    if (applicationRows.length === 0) return null;
    const hasSelected = applicationRows.some((row) => row.id === selectedApplicationId);
    return hasSelected ? selectedApplicationId : applicationRows[0].id;
  }, [applicationRows, selectedApplicationId]);

  const selectedApplication = useMemo(() => {
    if (!effectiveSelectedApplicationId) return null;
    return (
      applicationRows.find((row) => row.id === effectiveSelectedApplicationId) ?? null
    );
  }, [applicationRows, effectiveSelectedApplicationId]);

  const filteredRoleOptions = useMemo(() => {
    const selectedRoleIds = new Set(applications.map((app) => app.role_id));
    const query = roleQuery.trim().toLowerCase();

    return roles
      .filter((role) => !selectedRoleIds.has(role.id))
      .filter((role) => {
        if (!query) return true;
        const clientName = role.client_id ? (clientNameById[role.client_id] ?? "") : "";
        const search = `${role.title} ${clientName}`.toLowerCase();
        return search.includes(query);
      })
      .slice(0, 20);
  }, [applications, clientNameById, roleQuery, roles]);

  const resetApplicationModal = () => {
    setRoleQuery("");
    setSelectedRoleId("");
    setApplicationStage("applied");
    setApplicationSource("");
    setApplicationSubmittedOn("");
    setApplicationOutcome("");
    setApplicationNotes("");
    setModalError("");
  };

  const handleAddApplication = async () => {
    if (!candidateId || !UUID_PATTERN.test(candidateId)) {
      setModalError("Invalid candidate id.");
      return;
    }

    if (!selectedRoleId) {
      setModalError("Select a role first.");
      return;
    }

    setModalError("");
    setIsSavingApplication(true);

    const payload = {
      role_id: selectedRoleId,
      candidate_id: candidateId,
      stage: applicationStage,
      source: applicationSource.trim() || null,
      submitted_on: applicationSubmittedOn || null,
      outcome: applicationOutcome.trim() || null,
      notes: applicationNotes.trim() || null,
      created_by: currentUserId,
    };

    const { data, error } = await supabase
      .from("applications")
      .insert(payload)
      .select("id,role_id,candidate_id,stage,source,submitted_on,outcome,notes,updated_at")
      .single<ApplicationRecord>();

    if (error || !data) {
      const duplicate =
        error?.message.includes("duplicate") ||
        error?.message.includes("unique") ||
        error?.message.includes("role_id_candidate_id_key");

      setModalError(
        duplicate
          ? "This candidate is already attached to that role."
          : (error?.message ?? "Failed to add application."),
      );
      setIsSavingApplication(false);
      return;
    }

    setApplications((current) => [data, ...current]);
    setSelectedApplicationId(data.id);
    setIsSavingApplication(false);
    setIsAddModalOpen(false);
    resetApplicationModal();
  };

  const handleRemoveApplication = async (applicationId: string) => {
    const { error } = await supabase
      .from("applications")
      .delete()
      .eq("id", applicationId)
      .eq("candidate_id", candidateId ?? "");

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setApplications((current) => current.filter((row) => row.id !== applicationId));
    if (selectedApplicationId === applicationId) {
      setSelectedApplicationId(null);
    }
  };

  if (isLoading) {
    return (
      <main className={styles.page}>
        <p className={styles.infoText}>Loading candidate profile...</p>
      </main>
    );
  }

  if (errorMessage || !candidate) {
    return (
      <main className={styles.page}>
        <div className={styles.headerRow}>
          <Link href="/admin/candidates" className={styles.backLink}>
            Back to Candidates
          </Link>
        </div>
        <p className={styles.errorText}>{errorMessage || "Candidate not found."}</p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.headerRow}>
        <div>
          <p className={styles.eyebrow}>Candidate Profile</p>
          <h1 className={styles.title}>
            {candidate.first_name} {candidate.last_name}
          </h1>
        </div>
        <Link href="/admin/candidates" className={styles.backLink}>
          Back to Candidates
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
            <Link
              href={`/admin/candidates/${candidate.id}/edit`}
              className={styles.editLink}
            >
              Edit details
            </Link>
          </div>
          <dl className={styles.detailsGrid}>
            <div>
              <dt>Status</dt>
              <dd>{statusLabel}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{candidate.mobile || candidate.phone || "-"}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{candidate.email || "-"}</dd>
            </div>
            <div>
              <dt>Current Employer</dt>
              <dd>{employerLabel}</dd>
            </div>
            <div>
              <dt>Current Job Title</dt>
              <dd>{candidate.current_title || "-"}</dd>
            </div>
            <div>
              <dt>Highest Qualification</dt>
              <dd>{candidate.highest_qualification || "-"}</dd>
            </div>
            <div>
              <dt>Current Salary</dt>
              <dd>
                {typeof candidate.current_salary === "number"
                  ? candidate.current_salary.toLocaleString("en-GB", {
                      style: "currency",
                      currency: "GBP",
                      maximumFractionDigits: 2,
                    })
                  : "-"}
              </dd>
            </div>
            <div>
              <dt>Expected Salary</dt>
              <dd>
                {typeof candidate.expected_salary === "number"
                  ? candidate.expected_salary.toLocaleString("en-GB", {
                      style: "currency",
                      currency: "GBP",
                      maximumFractionDigits: 2,
                    })
                  : "-"}
              </dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{candidate.source || "-"}</dd>
            </div>
            <div>
              <dt>Last Updated</dt>
              <dd>{new Date(candidate.updated_at).toLocaleDateString("en-GB")}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      {activeTab === "Roles" ? (
        <>
          <section className={styles.detailsCard}>
            <div className={styles.detailsHeader}>
              <h2 className={styles.detailsTitle}>Applied Roles</h2>
              <button
                type="button"
                className={styles.addButton}
                onClick={() => {
                  setIsAddModalOpen(true);
                  setModalError("");
                }}
              >
                + Add role application
              </button>
            </div>

            {applicationRows.length > 0 ? (
              <div className={styles.tableWrap}>
                <table className={styles.dataTable}>
                  <thead>
                    <tr>
                      <th>Role Title</th>
                      <th>Client</th>
                      <th>Stage</th>
                      <th>Status</th>
                      <th>Submitted</th>
                      <th>Last Activity</th>
                      <th>Profile</th>
                      <th>Remove</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applicationRows.map((row) => (
                      <tr
                        key={row.id}
                        className={
                          effectiveSelectedApplicationId === row.id
                            ? styles.tableRowActive
                            : ""
                        }
                      >
                        <td>
                          <button
                            type="button"
                            className={styles.rowSelectButton}
                            onClick={() => setSelectedApplicationId(row.id)}
                          >
                            {row.roleTitle}
                          </button>
                        </td>
                        <td>{row.clientName || "-"}</td>
                        <td>{row.stage}</td>
                        <td>{row.roleStatus}</td>
                        <td>
                          {row.submittedOn
                            ? new Date(row.submittedOn).toLocaleDateString("en-GB")
                            : "-"}
                        </td>
                        <td>{new Date(row.lastActivity).toLocaleDateString("en-GB")}</td>
                        <td>
                          <Link
                            href={`/admin/roles/${row.roleId}`}
                            className={styles.tableActionLink}
                          >
                            Open Profile
                          </Link>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={styles.removeLink}
                            onClick={() => handleRemoveApplication(row.id)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={styles.infoText}>
                No role applications yet. Use + Add role application.
              </p>
            )}
          </section>

          <section className={styles.detailsCard}>
            <div className={styles.detailsHeader}>
              <h2 className={styles.detailsTitle}>Application Details</h2>
              {selectedApplication ? (
                <Link
                  href={`/admin/roles/${selectedApplication.roleId}`}
                  className={styles.editLink}
                >
                  Open full profile
                </Link>
              ) : null}
            </div>
            {selectedApplication ? (
              <dl className={styles.detailsGrid}>
                <div>
                  <dt>Role Title</dt>
                  <dd>{selectedApplication.roleTitle}</dd>
                </div>
                <div>
                  <dt>Client</dt>
                  <dd>{selectedApplication.clientName || "-"}</dd>
                </div>
                <div>
                  <dt>Stage</dt>
                  <dd>{selectedApplication.stage}</dd>
                </div>
                <div>
                  <dt>Role Status</dt>
                  <dd>{selectedApplication.roleStatus}</dd>
                </div>
                <div>
                  <dt>Job Type</dt>
                  <dd>{formatJobType(selectedApplication.jobType)}</dd>
                </div>
                <div>
                  <dt>Target Date</dt>
                  <dd>
                    {selectedApplication.targetDate
                      ? new Date(selectedApplication.targetDate).toLocaleDateString(
                          "en-GB",
                        )
                      : "-"}
                  </dd>
                </div>
                <div>
                  <dt>Submitted On</dt>
                  <dd>
                    {selectedApplication.submittedOn
                      ? new Date(selectedApplication.submittedOn).toLocaleDateString(
                          "en-GB",
                        )
                      : "-"}
                  </dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{selectedApplication.source || "-"}</dd>
                </div>
                <div>
                  <dt>Outcome</dt>
                  <dd>{selectedApplication.outcome || "-"}</dd>
                </div>
                <div className={styles.notesBlockInline}>
                  <dt>Application Notes</dt>
                  <dd>{selectedApplication.notes || "-"}</dd>
                </div>
              </dl>
            ) : (
              <p className={styles.infoText}>Select an application to view details.</p>
            )}
          </section>
        </>
      ) : null}

      {activeTab === "Notes" ? (
        <section className={styles.detailsCard}>
          <div className={styles.detailsHeader}>
            <h2 className={styles.detailsTitle}>Notes</h2>
            <Link
              href={`/admin/candidates/${candidate.id}/edit`}
              className={styles.editLink}
            >
              Edit details
            </Link>
          </div>
          <dl className={styles.detailsGrid}>
            <div className={styles.notesBlockInline}>
              <dt>Candidate Notes</dt>
              <dd>{candidate.notes || "-"}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      {activeTab === "Files" ? (
        <>
          <section className={styles.detailsCard}>
            <div className={styles.detailsHeader}>
              <h2 className={styles.detailsTitle}>Files</h2>
              <button type="button" className={styles.disabledActionButton} disabled>
                Upload file (coming soon)
              </button>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>File Type</th>
                    <th>Status</th>
                    <th>Open</th>
                  </tr>
                </thead>
                <tbody>
                  {FILE_PLACEHOLDERS.map((file) => (
                    <tr key={file.key}>
                      <td>{file.name}</td>
                      <td>{file.status}</td>
                      <td>
                        <button
                          type="button"
                          className={styles.tableDisabledButton}
                          disabled
                        >
                          Coming soon
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {isAddModalOpen ? (
        <div
          className={styles.modalOverlay}
          role="presentation"
          onClick={() => {
            setIsAddModalOpen(false);
            resetApplicationModal();
          }}
        >
          <div
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            aria-label="Add role application"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Add Role Application</h3>
              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={() => {
                  setIsAddModalOpen(false);
                  resetApplicationModal();
                }}
              >
                Close
              </button>
            </div>

            <div className={styles.modalBody}>
              <label className={styles.modalField}>
                <span>Search roles</span>
                <input
                  type="text"
                  value={roleQuery}
                  onChange={(event) => setRoleQuery(event.target.value)}
                  placeholder="Search by role title or client"
                />
              </label>

              <div className={styles.roleOptionList}>
                {filteredRoleOptions.length > 0 ? (
                  filteredRoleOptions.map((role) => (
                    <button
                      key={role.id}
                      type="button"
                      className={`${styles.roleOptionButton} ${
                        selectedRoleId === role.id ? styles.roleOptionButtonActive : ""
                      }`}
                      onClick={() => setSelectedRoleId(role.id)}
                    >
                      <span>{role.title}</span>
                      <span className={styles.roleOptionMeta}>
                        {role.client_id ? clientNameById[role.client_id] ?? "-" : "-"}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className={styles.infoText}>No matching roles available.</p>
                )}
              </div>

              <div className={styles.modalGrid}>
                <label className={styles.modalField}>
                  <span>Stage</span>
                  <select
                    value={applicationStage}
                    onChange={(event) => setApplicationStage(event.target.value)}
                  >
                    {STAGE_OPTIONS.map((stage) => (
                      <option key={stage} value={stage}>
                        {stage}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.modalField}>
                  <span>Source</span>
                  <input
                    type="text"
                    value={applicationSource}
                    onChange={(event) => setApplicationSource(event.target.value)}
                  />
                </label>

                <label className={styles.modalField}>
                  <span>Submitted On</span>
                  <input
                    type="date"
                    value={applicationSubmittedOn}
                    onChange={(event) => setApplicationSubmittedOn(event.target.value)}
                  />
                </label>

                <label className={styles.modalField}>
                  <span>Outcome</span>
                  <input
                    type="text"
                    value={applicationOutcome}
                    onChange={(event) => setApplicationOutcome(event.target.value)}
                  />
                </label>
              </div>

              <label className={styles.modalField}>
                <span>Notes</span>
                <textarea
                  rows={4}
                  value={applicationNotes}
                  onChange={(event) => setApplicationNotes(event.target.value)}
                />
              </label>

              {modalError ? <p className={styles.errorText}>{modalError}</p> : null}

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.submitButton}
                  onClick={handleAddApplication}
                  disabled={isSavingApplication}
                >
                  {isSavingApplication ? "Saving..." : "Save application"}
                </button>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={() => {
                    setIsAddModalOpen(false);
                    resetApplicationModal();
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
