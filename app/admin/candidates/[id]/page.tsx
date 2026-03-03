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

type ApplicationFileRecord = {
  id: string;
  application_id: string;
  has_resume: boolean;
  has_formatted_resume: boolean;
  has_cover_letter: boolean;
  has_offer: boolean;
  has_contract: boolean;
  has_other: boolean;
  other_note: string | null;
  folder_url: string | null;
  updated_at: string;
};

type FileFormState = {
  hasResume: boolean;
  hasFormattedResume: boolean;
  hasCoverLetter: boolean;
  hasOffer: boolean;
  hasContract: boolean;
  hasOther: boolean;
  otherNote: string;
  folderUrl: string;
};

type CandidateCommunicationNoteRecord = {
  id: string;
  candidate_id: string;
  role_id: string | null;
  communication_type: string;
  note_body: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type CandidateCommunicationNoteRow = {
  id: string;
  roleId: string | null;
  roleTitle: string | null;
  communicationType: string;
  noteBody: string;
  createdAt: string;
  updatedAt: string;
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
const COMMUNICATION_TYPE_OPTIONS = ["Email", "Phone", "Social", "In person"] as const;

const EMPTY_FILE_FORM: FileFormState = {
  hasResume: false,
  hasFormattedResume: false,
  hasCoverLetter: false,
  hasOffer: false,
  hasContract: false,
  hasOther: false,
  otherNote: "",
  folderUrl: "",
};

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
  const [applicationFiles, setApplicationFiles] = useState<ApplicationFileRecord[]>([]);
  const [communicationNotes, setCommunicationNotes] = useState<
    CandidateCommunicationNoteRecord[]
  >([]);
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
  const [communicationType, setCommunicationType] = useState<string>("Email");
  const [communicationRoleId, setCommunicationRoleId] = useState<string>("");
  const [communicationBody, setCommunicationBody] = useState("");
  const [editingCommunicationId, setEditingCommunicationId] = useState<string | null>(null);
  const [isSavingCommunication, setIsSavingCommunication] = useState(false);
  const [editingFileApplicationId, setEditingFileApplicationId] = useState<string | null>(
    null,
  );
  const [fileForm, setFileForm] = useState<FileFormState>(EMPTY_FILE_FORM);
  const [isSavingFile, setIsSavingFile] = useState(false);

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
        { data: communicationNotesData, error: communicationNotesError },
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
        supabase
          .from("candidate_communication_notes")
          .select(
            "id,candidate_id,role_id,communication_type,note_body,created_by,created_at,updated_at",
          )
          .eq("candidate_id", candidateId)
          .order("created_at", { ascending: false }),
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

      if (communicationNotesError) {
        setErrorMessage(communicationNotesError.message);
        setIsLoading(false);
        return;
      }

      const currentApplications = (applicationsData ?? []) as ApplicationRecord[];
      let currentApplicationFiles: ApplicationFileRecord[] = [];
      if (currentApplications.length > 0) {
        const applicationIds = currentApplications.map((row) => row.id);
        const { data: fileData, error: fileError } = await supabase
          .from("application_files")
          .select(
            "id,application_id,has_resume,has_formatted_resume,has_cover_letter,has_offer,has_contract,has_other,other_note,folder_url,updated_at",
          )
          .in("application_id", applicationIds);

        if (fileError) {
          setErrorMessage(fileError.message);
          setIsLoading(false);
          return;
        }

        currentApplicationFiles = (fileData ?? []) as ApplicationFileRecord[];
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
      setApplications(currentApplications);
      setApplicationFiles(currentApplicationFiles);
      setCommunicationNotes(
        (communicationNotesData ?? []) as CandidateCommunicationNoteRecord[],
      );
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

  const applicationFileByApplicationId = useMemo(() => {
    return applicationFiles.reduce<Record<string, ApplicationFileRecord>>((acc, row) => {
      acc[row.application_id] = row;
      return acc;
    }, {});
  }, [applicationFiles]);

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

  const communicationRows = useMemo<CandidateCommunicationNoteRow[]>(() => {
    return communicationNotes.map((row) => ({
      id: row.id,
      roleId: row.role_id,
      roleTitle: row.role_id ? (roleById[row.role_id]?.title ?? "Role unavailable") : null,
      communicationType: row.communication_type,
      noteBody: row.note_body,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }, [communicationNotes, roleById]);

  const resetCommunicationForm = () => {
    setCommunicationType("Email");
    setCommunicationRoleId("");
    setCommunicationBody("");
    setEditingCommunicationId(null);
  };

  const handleSaveCommunication = async () => {
    if (!candidateId || !UUID_PATTERN.test(candidateId)) {
      setErrorMessage("Invalid candidate id.");
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
        .from("candidate_communication_notes")
        .update({
          role_id: communicationRoleId || null,
          communication_type: communicationType,
          note_body: communicationBody.trim(),
        })
        .eq("id", editingCommunicationId)
        .eq("candidate_id", candidateId)
        .select(
          "id,candidate_id,role_id,communication_type,note_body,created_by,created_at,updated_at",
        )
        .single<CandidateCommunicationNoteRecord>();

      if (error || !data) {
        setErrorMessage(error?.message ?? "Failed to update communication note.");
        setIsSavingCommunication(false);
        return;
      }

      setCommunicationNotes((current) =>
        current.map((row) => (row.id === data.id ? data : row)),
      );
      setIsSavingCommunication(false);
      resetCommunicationForm();
      return;
    }

    const { data, error } = await supabase
      .from("candidate_communication_notes")
      .insert({
        candidate_id: candidateId,
        role_id: communicationRoleId || null,
        communication_type: communicationType,
        note_body: communicationBody.trim(),
        created_by: currentUserId,
      })
      .select(
        "id,candidate_id,role_id,communication_type,note_body,created_by,created_at,updated_at",
      )
      .single<CandidateCommunicationNoteRecord>();

    if (error || !data) {
      setErrorMessage(error?.message ?? "Failed to save communication note.");
      setIsSavingCommunication(false);
      return;
    }

    setCommunicationNotes((current) => [data, ...current]);
    setIsSavingCommunication(false);
    resetCommunicationForm();
  };

  const handleEditCommunication = (row: CandidateCommunicationNoteRow) => {
    setEditingCommunicationId(row.id);
    setCommunicationType(row.communicationType);
    setCommunicationRoleId(row.roleId ?? "");
    setCommunicationBody(row.noteBody);
    setErrorMessage("");
  };

  const handleDeleteCommunication = async (communicationId: string) => {
    if (!candidateId || !UUID_PATTERN.test(candidateId)) {
      setErrorMessage("Invalid candidate id.");
      return;
    }

    const { error } = await supabase
      .from("candidate_communication_notes")
      .delete()
      .eq("id", communicationId)
      .eq("candidate_id", candidateId);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setCommunicationNotes((current) =>
      current.filter((row) => row.id !== communicationId),
    );
    if (editingCommunicationId === communicationId) {
      resetCommunicationForm();
    }
  };

  const startFileEdit = (applicationId: string, paperwork?: ApplicationFileRecord) => {
    setEditingFileApplicationId(applicationId);
    setFileForm({
      hasResume: paperwork?.has_resume ?? false,
      hasFormattedResume: paperwork?.has_formatted_resume ?? false,
      hasCoverLetter: paperwork?.has_cover_letter ?? false,
      hasOffer: paperwork?.has_offer ?? false,
      hasContract: paperwork?.has_contract ?? false,
      hasOther: paperwork?.has_other ?? false,
      otherNote: paperwork?.other_note ?? "",
      folderUrl: paperwork?.folder_url ?? "",
    });
    setErrorMessage("");
  };

  const cancelFileEdit = () => {
    setEditingFileApplicationId(null);
    setFileForm(EMPTY_FILE_FORM);
    setIsSavingFile(false);
  };

  const handleSaveFile = async (applicationId: string) => {
    setErrorMessage("");
    setIsSavingFile(true);

    const { data, error } = await supabase
      .from("application_files")
      .upsert(
        {
          application_id: applicationId,
          has_resume: fileForm.hasResume,
          has_formatted_resume: fileForm.hasFormattedResume,
          has_cover_letter: fileForm.hasCoverLetter,
          has_offer: fileForm.hasOffer,
          has_contract: fileForm.hasContract,
          has_other: fileForm.hasOther,
          other_note: fileForm.otherNote.trim() || null,
          folder_url: fileForm.folderUrl.trim() || null,
          created_by: currentUserId,
        },
        { onConflict: "application_id" },
      )
      .select(
        "id,application_id,has_resume,has_formatted_resume,has_cover_letter,has_offer,has_contract,has_other,other_note,folder_url,updated_at",
      )
      .single<ApplicationFileRecord>();

    if (error || !data) {
      setErrorMessage(error?.message ?? "Failed to save file checklist.");
      setIsSavingFile(false);
      return;
    }

    setApplicationFiles((current) => {
      const withoutCurrent = current.filter((row) => row.application_id !== applicationId);
      return [data, ...withoutCurrent];
    });
    cancelFileEdit();
  };

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

    const { data: createdFileRow, error: createdFileError } = await supabase
      .from("application_files")
      .upsert(
        {
          application_id: data.id,
          created_by: currentUserId,
        },
        { onConflict: "application_id" },
      )
      .select(
        "id,application_id,has_resume,has_formatted_resume,has_cover_letter,has_offer,has_contract,has_other,other_note,folder_url,updated_at",
      )
      .single<ApplicationFileRecord>();

    if (createdFileError) {
      setModalError(createdFileError.message);
      setIsSavingApplication(false);
      return;
    }

    setApplications((current) => [data, ...current]);
    if (createdFileRow) {
      setApplicationFiles((current) => [
        ...current.filter((row) => row.application_id !== createdFileRow.application_id),
        createdFileRow,
      ]);
    }
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
    setApplicationFiles((current) =>
      current.filter((row) => row.application_id !== applicationId),
    );
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
                <select
                  value={communicationRoleId}
                  onChange={(event) => setCommunicationRoleId(event.target.value)}
                >
                  <option value="">General conversation</option>
                  {applicationRows.map((row) => (
                    <option key={row.roleId} value={row.roleId}>
                      {row.roleTitle}
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
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={resetCommunicationForm}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </div>

          <div className={styles.communicationList}>
            {communicationRows.length > 0 ? (
              communicationRows.map((row) => (
                <article key={row.id} className={styles.communicationItem}>
                  <div className={styles.communicationItemHeader}>
                    <div className={styles.communicationMeta}>
                      <span>{row.communicationType}</span>
                      <span>{new Date(row.createdAt).toLocaleString("en-GB")}</span>
                      <span>{row.roleTitle || "General"}</span>
                    </div>
                    <div className={styles.communicationMetaActions}>
                      <button
                        type="button"
                        className={styles.discreetAction}
                        onClick={() => handleEditCommunication(row)}
                      >
                        edit
                      </button>
                      <button
                        type="button"
                        className={styles.discreetAction}
                        onClick={() => handleDeleteCommunication(row.id)}
                      >
                        delete
                      </button>
                    </div>
                  </div>
                  <p className={styles.communicationBody}>{row.noteBody}</p>
                </article>
              ))
            ) : (
              <p className={styles.infoText}>No communication notes yet.</p>
            )}
          </div>
        </section>
      ) : null}

      {activeTab === "Files" ? (
        <section className={styles.detailsCard}>
          <div className={styles.detailsHeader}>
            <h2 className={styles.detailsTitle}>Files</h2>
          </div>
          {applicationRows.length > 0 ? (
            <div className={styles.fileRoleList}>
              {applicationRows.map((row) => {
                const paperwork = applicationFileByApplicationId[row.id];
                const isEditingThisRow = editingFileApplicationId === row.id;
                return (
                  <article key={row.id} className={styles.fileRoleCard}>
                    <div className={styles.fileRoleHeader}>
                      <div>
                        <p className={styles.fileRoleTitle}>{row.roleTitle}</p>
                        <p className={styles.fileRoleMeta}>
                          {row.clientName || "-"}
                        </p>
                      </div>
                      <Link
                        href={`/admin/roles/${row.roleId}`}
                        className={styles.editLink}
                      >
                        Open role
                      </Link>
                    </div>
                    {isEditingThisRow ? (
                      <>
                        <div className={styles.fileChecklistRow}>
                          <label className={styles.fileCheckItem}>
                            <input
                              type="checkbox"
                              checked={fileForm.hasResume}
                              onChange={(event) =>
                                setFileForm((current) => ({
                                  ...current,
                                  hasResume: event.target.checked,
                                }))
                              }
                            />
                            <span>Resume</span>
                          </label>
                          <label className={styles.fileCheckItem}>
                            <input
                              type="checkbox"
                              checked={fileForm.hasFormattedResume}
                              onChange={(event) =>
                                setFileForm((current) => ({
                                  ...current,
                                  hasFormattedResume: event.target.checked,
                                }))
                              }
                            />
                            <span>Formatted resume</span>
                          </label>
                          <label className={styles.fileCheckItem}>
                            <input
                              type="checkbox"
                              checked={fileForm.hasCoverLetter}
                              onChange={(event) =>
                                setFileForm((current) => ({
                                  ...current,
                                  hasCoverLetter: event.target.checked,
                                }))
                              }
                            />
                            <span>Cover letter</span>
                          </label>
                          <label className={styles.fileCheckItem}>
                            <input
                              type="checkbox"
                              checked={fileForm.hasOffer}
                              onChange={(event) =>
                                setFileForm((current) => ({
                                  ...current,
                                  hasOffer: event.target.checked,
                                }))
                              }
                            />
                            <span>Offer</span>
                          </label>
                          <label className={styles.fileCheckItem}>
                            <input
                              type="checkbox"
                              checked={fileForm.hasContract}
                              onChange={(event) =>
                                setFileForm((current) => ({
                                  ...current,
                                  hasContract: event.target.checked,
                                }))
                              }
                            />
                            <span>Contract</span>
                          </label>
                          <label className={styles.fileCheckItem}>
                            <input
                              type="checkbox"
                              checked={fileForm.hasOther}
                              onChange={(event) =>
                                setFileForm((current) => ({
                                  ...current,
                                  hasOther: event.target.checked,
                                }))
                              }
                            />
                            <span>Other</span>
                          </label>
                        </div>
                        <div className={styles.fileFormGrid}>
                          <label className={styles.modalField}>
                            <span>Folder URL</span>
                            <input
                              type="url"
                              value={fileForm.folderUrl}
                              onChange={(event) =>
                                setFileForm((current) => ({
                                  ...current,
                                  folderUrl: event.target.value,
                                }))
                              }
                              placeholder="https://"
                            />
                          </label>
                          <label className={styles.modalField}>
                            <span>Other note</span>
                            <textarea
                              rows={3}
                              value={fileForm.otherNote}
                              onChange={(event) =>
                                setFileForm((current) => ({
                                  ...current,
                                  otherNote: event.target.value,
                                }))
                              }
                            />
                          </label>
                        </div>
                        <div className={styles.fileActions}>
                          <button
                            type="button"
                            className={styles.submitButton}
                            onClick={() => handleSaveFile(row.id)}
                            disabled={isSavingFile}
                          >
                            {isSavingFile ? "Saving..." : "Save changes"}
                          </button>
                          <button
                            type="button"
                            className={styles.cancelButton}
                            onClick={cancelFileEdit}
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className={styles.fileChecklistRow}>
                          <label className={styles.fileCheckItem}>
                            <input type="checkbox" checked={paperwork?.has_resume ?? false} readOnly disabled />
                            <span>Resume</span>
                          </label>
                          <label className={styles.fileCheckItem}>
                            <input
                              type="checkbox"
                              checked={paperwork?.has_formatted_resume ?? false}
                              readOnly
                              disabled
                            />
                            <span>Formatted resume</span>
                          </label>
                          <label className={styles.fileCheckItem}>
                            <input
                              type="checkbox"
                              checked={paperwork?.has_cover_letter ?? false}
                              readOnly
                              disabled
                            />
                            <span>Cover letter</span>
                          </label>
                          <label className={styles.fileCheckItem}>
                            <input type="checkbox" checked={paperwork?.has_offer ?? false} readOnly disabled />
                            <span>Offer</span>
                          </label>
                          <label className={styles.fileCheckItem}>
                            <input
                              type="checkbox"
                              checked={paperwork?.has_contract ?? false}
                              readOnly
                              disabled
                            />
                            <span>Contract</span>
                          </label>
                          <label className={styles.fileCheckItem}>
                            <input type="checkbox" checked={paperwork?.has_other ?? false} readOnly disabled />
                            <span>Other</span>
                          </label>
                        </div>
                        <dl className={styles.fileDetailGrid}>
                          <div>
                            <dt>Folder URL</dt>
                            <dd>
                              {paperwork?.folder_url ? (
                                <a
                                  href={paperwork.folder_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={styles.subtleLink}
                                >
                                  Open folder
                                </a>
                              ) : (
                                "-"
                              )}
                            </dd>
                          </div>
                          <div>
                            <dt>Other note</dt>
                            <dd>{paperwork?.other_note || "-"}</dd>
                          </div>
                        </dl>
                        <div className={styles.fileActions}>
                          <button
                            type="button"
                            className={styles.discreetAction}
                            onClick={() => startFileEdit(row.id, paperwork)}
                          >
                            edit
                          </button>
                        </div>
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className={styles.infoText}>No role applications yet.</p>
          )}
        </section>
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
