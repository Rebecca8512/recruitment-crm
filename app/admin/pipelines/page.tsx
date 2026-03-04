"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  EntitySearch,
  type EntitySearchOption,
} from "@/src/components/search/entity-search";
import { StatusFilter } from "@/src/components/filters/status-filter";
import { getSupabaseBrowserClient } from "@/src/lib/supabase";
import styles from "./pipelines.module.css";

type PipelineView = "business-development" | "vacancy-fill";

type ClientRow = {
  id: string;
  name: string;
  status_code: string | null;
  source: string | null;
  updated_at: string;
};

type ClientStatusRow = {
  code: string;
  label: string;
};

type RoleRow = {
  id: string;
  title: string;
  client_id: string | null;
  status_code: string;
  job_type: string | null;
  updated_at: string;
};

type RoleStatusRow = {
  code: string;
  label: string;
};

type CandidateRow = {
  id: string;
  first_name: string;
  last_name: string;
  status_code: string;
  updated_at: string;
};

type CandidateStatusRow = {
  code: string;
  label: string;
};

type ApplicationRow = {
  id: string;
  role_id: string;
  candidate_id: string;
  stage: string;
  submitted_on: string | null;
  updated_at: string;
};

type BDStageId =
  | "identifying"
  | "outreach"
  | "discovery"
  | "terms_sent"
  | "closed_won"
  | "closed_lost";

type RTStageId =
  | "intake"
  | "sourcing"
  | "shortlisting"
  | "interviews"
  | "offer_pending"
  | "filled_pending_rebate"
  | "filled_won"
  | "closed_lost";

type AppStageId =
  | "applied"
  | "screening"
  | "shortlisted"
  | "interview"
  | "offer"
  | "placed"
  | "rejected"
  | "withdrawn";

type StageConfig<T extends string> = {
  id: T;
  label: string;
  tooltip: string;
};

type BDPipelineCard = {
  id: string;
  clientId: string;
  title: string;
  source: string | null;
  statusLabel: string;
  stageId: BDStageId;
  updatedAt: string;
};

type RTPipelineCard = {
  id: string;
  roleId: string;
  title: string;
  clientId: string | null;
  clientName: string;
  roleStatusLabel: string;
  stageId: RTStageId;
  updatedAt: string;
  candidateCount: number;
  interviewCount: number;
  offerCount: number;
};

type RoleApplicationCard = {
  id: string;
  applicationId: string;
  candidateId: string;
  candidateName: string;
  candidateStatusLabel: string;
  stageId: AppStageId;
  submittedOn: string | null;
  updatedAt: string;
};

type AgeFilterValue = "any" | "7" | "14" | "30";

const VIEW_OPTIONS: { value: PipelineView; label: string }[] = [
  { value: "business-development", label: "Business Development" },
  { value: "vacancy-fill", label: "Role Tracker" },
];

const BD_STAGES: StageConfig<BDStageId>[] = [
  {
    id: "identifying",
    label: "Identifying",
    tooltip:
      "Cold leads, referrals, or targets. No one has been contacted yet.",
  },
  {
    id: "outreach",
    label: "Outreach",
    tooltip:
      'Initial contact made (Email/Phone/LinkedIn). "Knocking on the door."',
  },
  {
    id: "discovery",
    label: "Discovery",
    tooltip: "Had a conversation or meeting. Checking fit and fees.",
  },
  {
    id: "terms_sent",
    label: "Terms Sent",
    tooltip: 'The verbal "Yes" is done. Waiting on the digital signature.',
  },
  {
    id: "closed_won",
    label: "Closed - WON",
    tooltip: 'Contract signed. Move them to "Active Client" status.',
  },
  {
    id: "closed_lost",
    label: "Closed - LOST",
    tooltip: "They've said no, hire in-house, or have a fixed supplier list.",
  },
];

const RT_STAGES: StageConfig<RTStageId>[] = [
  {
    id: "intake",
    label: "Intake",
    tooltip:
      "We have the job but still getting the description and details confirmed.",
  },
  {
    id: "sourcing",
    label: "Sourcing",
    tooltip: "Actively advertising and headhunting.",
  },
  {
    id: "shortlisting",
    label: "Shortlisting",
    tooltip: "Working through applicants.",
  },
  {
    id: "interviews",
    label: "Interviews",
    tooltip: "With WR or the client.",
  },
  {
    id: "offer_pending",
    label: "Offer Pending",
    tooltip: "An offer is out, waiting on references/contracts/acceptance.",
  },
  {
    id: "filled_pending_rebate",
    label: "Filled - pending rebate",
    tooltip: "Candidate must stay in role past the rebate terms.",
  },
  {
    id: "filled_won",
    label: "Filled - WON",
    tooltip: "Congratulations!",
  },
  {
    id: "closed_lost",
    label: "Closed - Lost",
    tooltip: "Role cancelled or filled by competitor.",
  },
];

const APPLICATION_STAGES: StageConfig<AppStageId>[] = [
  { id: "applied", label: "Applied", tooltip: "Application received." },
  {
    id: "screening",
    label: "Screening",
    tooltip: "Initial qualification and screening.",
  },
  {
    id: "shortlisted",
    label: "Shortlisted",
    tooltip: "Candidate selected for deeper review.",
  },
  {
    id: "interview",
    label: "Interview",
    tooltip: "Interview process in progress.",
  },
  {
    id: "offer",
    label: "Offer",
    tooltip: "Offer shared, awaiting response.",
  },
  {
    id: "placed",
    label: "Placed",
    tooltip: "Candidate started in role.",
  },
  {
    id: "rejected",
    label: "Rejected",
    tooltip: "Application closed as rejected.",
  },
  {
    id: "withdrawn",
    label: "Withdrawn",
    tooltip: "Candidate withdrew from the process.",
  },
];

const DEFAULT_BD_STAGE_IDS = BD_STAGES.map((stage) => stage.id);
const DEFAULT_RT_STAGE_IDS = RT_STAGES.map((stage) => stage.id);
const DEFAULT_APP_STAGE_IDS = APPLICATION_STAGES.map((stage) => stage.id);

const AGE_FILTER_OPTIONS: { value: AgeFilterValue; label: string }[] = [
  { value: "any", label: "Any Age" },
  { value: "7", label: "7+ Days" },
  { value: "14", label: "14+ Days" },
  { value: "30", label: "30+ Days" },
];

function resolveView(view: string | null): PipelineView {
  if (view === "vacancy-fill") return "vacancy-fill";
  return "business-development";
}

function parseAppStage(value: string | null): AppStageId {
  switch (value) {
    case "screening":
    case "shortlisted":
    case "interview":
    case "offer":
    case "placed":
    case "rejected":
    case "withdrawn":
      return value;
    default:
      return "applied";
  }
}

function mapClientStatusToBDStage(statusCode: string | null): BDStageId {
  switch (statusCode) {
    case "prospect":
      return "identifying";
    case "warm_lead":
      return "discovery";
    case "active":
    case "inactive_client":
      return "closed_won";
    case "archived":
    case "closed":
      return "closed_lost";
    default:
      return "outreach";
  }
}

function mapRoleToRTStage(roleStatusCode: string, appStages: AppStageId[]): RTStageId {
  if (roleStatusCode === "pending") return "intake";

  if (roleStatusCode === "filled") return "filled_pending_rebate";
  if (roleStatusCode === "won") return "filled_won";
  if (roleStatusCode === "lost" || roleStatusCode === "cancelled") {
    return "closed_lost";
  }

  if (roleStatusCode === "active") {
    if (appStages.some((stage) => stage === "offer")) return "offer_pending";
    if (appStages.some((stage) => stage === "interview")) return "interviews";
    if (appStages.some((stage) => stage === "shortlisted" || stage === "screening")) {
      return "shortlisting";
    }
    if (appStages.some((stage) => stage === "applied")) return "sourcing";
  }

  return "sourcing";
}

function toAgeInDays(updatedAt: string) {
  const now = Date.now();
  const then = new Date(updatedAt).getTime();
  const diffMs = Math.max(now - then, 0);
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function formatSource(value: string | null) {
  if (!value) return "-";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-GB");
}

export default function PipelinesPage() {
  const searchParams = useSearchParams();
  const view = resolveView(searchParams.get("view"));
  const selectedRoleId = searchParams.get("role");
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [clientStatuses, setClientStatuses] = useState<ClientStatusRow[]>([]);
  const [roleStatuses, setRoleStatuses] = useState<RoleStatusRow[]>([]);
  const [candidateStatuses, setCandidateStatuses] = useState<CandidateStatusRow[]>([]);

  const [selectedBDSearch, setSelectedBDSearch] =
    useState<EntitySearchOption | null>(null);
  const [selectedBDStageIds, setSelectedBDStageIds] = useState<string[]>(
    DEFAULT_BD_STAGE_IDS,
  );
  const [bdAgeFilter, setBdAgeFilter] = useState<AgeFilterValue>("14");
  const [collapsedBDStageIds, setCollapsedBDStageIds] = useState<Set<BDStageId>>(
    new Set(),
  );

  const [selectedRTSearch, setSelectedRTSearch] =
    useState<EntitySearchOption | null>(null);
  const [selectedRTStageIds, setSelectedRTStageIds] = useState<string[]>(
    DEFAULT_RT_STAGE_IDS,
  );
  const [rtAgeFilter, setRtAgeFilter] = useState<AgeFilterValue>("14");
  const [collapsedRTStageIds, setCollapsedRTStageIds] = useState<Set<RTStageId>>(
    new Set(),
  );

  const [selectedAppSearch, setSelectedAppSearch] =
    useState<EntitySearchOption | null>(null);
  const [selectedAppStageIds, setSelectedAppStageIds] = useState<string[]>(
    DEFAULT_APP_STAGE_IDS,
  );
  const [appAgeFilter, setAppAgeFilter] = useState<AgeFilterValue>("14");
  const [collapsedAppStageIds, setCollapsedAppStageIds] = useState<Set<AppStageId>>(
    new Set(),
  );

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      const [
        { data: clientRows, error: clientsError },
        { data: roleRows, error: rolesError },
        { data: candidateRows, error: candidatesError },
        { data: applicationRows, error: applicationsError },
        { data: clientStatusRows, error: clientStatusesError },
        { data: roleStatusRows, error: roleStatusesError },
        { data: candidateStatusRows, error: candidateStatusesError },
      ] = await Promise.all([
        supabase
          .from("clients")
          .select("id,name,status_code,source,updated_at")
          .order("updated_at", { ascending: false }),
        supabase
          .from("roles")
          .select("id,title,client_id,status_code,job_type,updated_at")
          .order("updated_at", { ascending: false }),
        supabase
          .from("candidates")
          .select("id,first_name,last_name,status_code,updated_at"),
        supabase
          .from("applications")
          .select("id,role_id,candidate_id,stage,submitted_on,updated_at")
          .order("updated_at", { ascending: false }),
        supabase.from("client_statuses").select("code,label").eq("is_active", true),
        supabase.from("role_statuses").select("code,label").eq("is_active", true),
        supabase
          .from("candidate_statuses")
          .select("code,label")
          .eq("is_active", true),
      ]);

      if (!isMounted) return;

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

      if (clientStatusesError) {
        setErrorMessage(clientStatusesError.message);
        setIsLoading(false);
        return;
      }

      if (roleStatusesError) {
        setErrorMessage(roleStatusesError.message);
        setIsLoading(false);
        return;
      }

      if (candidateStatusesError) {
        setErrorMessage(candidateStatusesError.message);
        setIsLoading(false);
        return;
      }

      setClients((clientRows ?? []) as ClientRow[]);
      setRoles((roleRows ?? []) as RoleRow[]);
      setCandidates((candidateRows ?? []) as CandidateRow[]);
      setApplications((applicationRows ?? []) as ApplicationRow[]);
      setClientStatuses((clientStatusRows ?? []) as ClientStatusRow[]);
      setRoleStatuses((roleStatusRows ?? []) as RoleStatusRow[]);
      setCandidateStatuses((candidateStatusRows ?? []) as CandidateStatusRow[]);
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

  const candidateById = useMemo(() => {
    return candidates.reduce<Record<string, CandidateRow>>((acc, candidate) => {
      acc[candidate.id] = candidate;
      return acc;
    }, {});
  }, [candidates]);

  const clientStatusLabelByCode = useMemo(() => {
    return clientStatuses.reduce<Record<string, string>>((acc, row) => {
      acc[row.code] = row.label;
      return acc;
    }, {});
  }, [clientStatuses]);

  const roleStatusLabelByCode = useMemo(() => {
    return roleStatuses.reduce<Record<string, string>>((acc, row) => {
      acc[row.code] = row.label;
      return acc;
    }, {});
  }, [roleStatuses]);

  const candidateStatusLabelByCode = useMemo(() => {
    return candidateStatuses.reduce<Record<string, string>>((acc, row) => {
      acc[row.code] = row.label;
      return acc;
    }, {});
  }, [candidateStatuses]);

  const applicationsByRoleId = useMemo(() => {
    return applications.reduce<Record<string, ApplicationRow[]>>((acc, row) => {
      acc[row.role_id] = acc[row.role_id] ? [...acc[row.role_id], row] : [row];
      return acc;
    }, {});
  }, [applications]);

  const bdCards = useMemo<BDPipelineCard[]>(() => {
    return clients.map((client) => ({
      id: client.id,
      clientId: client.id,
      title: client.name,
      source: client.source,
      statusLabel: client.status_code
        ? (clientStatusLabelByCode[client.status_code] ?? client.status_code)
        : "Unassigned",
      stageId: mapClientStatusToBDStage(client.status_code),
      updatedAt: client.updated_at,
    }));
  }, [clientStatusLabelByCode, clients]);

  const rtCards = useMemo<RTPipelineCard[]>(() => {
    return roles.map((role) => {
      const roleApplications = applicationsByRoleId[role.id] ?? [];
      const appStages = roleApplications.map((row) => parseAppStage(row.stage));
      const stageId = mapRoleToRTStage(role.status_code, appStages);
      const newestAppUpdate = roleApplications.reduce<number>((max, row) => {
        const rowTime = new Date(row.updated_at).getTime();
        return Math.max(max, rowTime);
      }, 0);
      const roleUpdated = new Date(role.updated_at).getTime();

      return {
        id: role.id,
        roleId: role.id,
        title: role.title,
        clientId: role.client_id,
        clientName: role.client_id ? (clientNameById[role.client_id] ?? "-") : "-",
        roleStatusLabel: roleStatusLabelByCode[role.status_code] ?? role.status_code,
        stageId,
        updatedAt: new Date(Math.max(roleUpdated, newestAppUpdate)).toISOString(),
        candidateCount: roleApplications.length,
        interviewCount: appStages.filter((stage) => stage === "interview").length,
        offerCount: appStages.filter((stage) => stage === "offer").length,
      };
    });
  }, [applicationsByRoleId, clientNameById, roleStatusLabelByCode, roles]);

  const selectedRole = useMemo(() => {
    if (!selectedRoleId) return null;
    return roleById[selectedRoleId] ?? null;
  }, [roleById, selectedRoleId]);

  const selectedRoleApplications = useMemo<RoleApplicationCard[]>(() => {
    if (!selectedRole) return [];

    return (applicationsByRoleId[selectedRole.id] ?? []).map((row) => {
      const candidate = candidateById[row.candidate_id];
      const candidateUpdated = candidate ? new Date(candidate.updated_at).getTime() : 0;
      const appUpdated = new Date(row.updated_at).getTime();
      const candidateName = candidate
        ? `${candidate.first_name} ${candidate.last_name}`.trim()
        : "Candidate unavailable";

      return {
        id: row.id,
        applicationId: row.id,
        candidateId: row.candidate_id,
        candidateName,
        candidateStatusLabel: candidate
          ? (candidateStatusLabelByCode[candidate.status_code] ?? candidate.status_code)
          : "-",
        stageId: parseAppStage(row.stage),
        submittedOn: row.submitted_on,
        updatedAt: new Date(Math.max(appUpdated, candidateUpdated)).toISOString(),
      };
    });
  }, [applicationsByRoleId, candidateById, candidateStatusLabelByCode, selectedRole]);

  const bdSearchOptions = useMemo<EntitySearchOption[]>(() => {
    return bdCards.map((card) => {
      const stage = BD_STAGES.find((item) => item.id === card.stageId);
      return {
        key: `client:${card.clientId}`,
        entityId: card.clientId,
        entityType: "client",
        label: card.title,
        subtitle: stage ? `in ${stage.label}` : undefined,
        searchText: `${card.title} client ${stage?.label ?? ""}`,
      };
    });
  }, [bdCards]);

  const rtSearchOptions = useMemo<EntitySearchOption[]>(() => {
    const roleOptions = rtCards.map((card) => ({
      key: `role:${card.roleId}`,
      entityId: card.roleId,
      entityType: "role" as const,
      label: card.title,
      subtitle: card.clientName !== "-" ? `for ${card.clientName}` : undefined,
      searchText: `${card.title} role ${card.clientName}`,
    }));

    const clientOptions = clients.map((client) => ({
      key: `client:${client.id}`,
      entityId: client.id,
      entityType: "client" as const,
      label: client.name,
      searchText: `${client.name} client`,
    }));

    return [...roleOptions, ...clientOptions];
  }, [clients, rtCards]);

  const appSearchOptions = useMemo<EntitySearchOption[]>(() => {
    return selectedRoleApplications.map((row) => ({
      key: `candidate:${row.candidateId}:${row.applicationId}`,
      entityId: row.candidateId,
      entityType: "candidate",
      label: row.candidateName,
      subtitle: `in ${APPLICATION_STAGES.find((stage) => stage.id === row.stageId)?.label ?? "Applied"}`,
      searchText: `${row.candidateName} candidate`,
    }));
  }, [selectedRoleApplications]);

  const bdAgeThreshold = useMemo(() => {
    if (bdAgeFilter === "any") return 0;
    return parseInt(bdAgeFilter, 10);
  }, [bdAgeFilter]);

  const rtAgeThreshold = useMemo(() => {
    if (rtAgeFilter === "any") return 0;
    return parseInt(rtAgeFilter, 10);
  }, [rtAgeFilter]);

  const appAgeThreshold = useMemo(() => {
    if (appAgeFilter === "any") return 0;
    return parseInt(appAgeFilter, 10);
  }, [appAgeFilter]);

  const filteredBDCards = useMemo(() => {
    const byStage = bdCards.filter((card) => selectedBDStageIds.includes(card.stageId));
    const byAge =
      bdAgeThreshold > 0
        ? byStage.filter((card) => toAgeInDays(card.updatedAt) >= bdAgeThreshold)
        : byStage;

    if (!selectedBDSearch) return byAge;
    if (selectedBDSearch.entityType !== "client") return byAge;

    return byAge.filter((card) => card.clientId === selectedBDSearch.entityId);
  }, [bdAgeThreshold, bdCards, selectedBDSearch, selectedBDStageIds]);

  const filteredRTCards = useMemo(() => {
    const byStage = rtCards.filter((card) => selectedRTStageIds.includes(card.stageId));
    const byAge =
      rtAgeThreshold > 0
        ? byStage.filter((card) => toAgeInDays(card.updatedAt) >= rtAgeThreshold)
        : byStage;

    if (!selectedRTSearch) return byAge;

    if (selectedRTSearch.entityType === "role") {
      return byAge.filter((card) => card.roleId === selectedRTSearch.entityId);
    }

    if (selectedRTSearch.entityType === "client") {
      return byAge.filter((card) => card.clientId === selectedRTSearch.entityId);
    }

    return byAge;
  }, [rtAgeThreshold, rtCards, selectedRTSearch, selectedRTStageIds]);

  const filteredRoleApplications = useMemo(() => {
    const byStage = selectedRoleApplications.filter((card) =>
      selectedAppStageIds.includes(card.stageId),
    );
    const byAge =
      appAgeThreshold > 0
        ? byStage.filter((card) => toAgeInDays(card.updatedAt) >= appAgeThreshold)
        : byStage;

    if (!selectedAppSearch) return byAge;
    if (selectedAppSearch.entityType !== "candidate") return byAge;

    return byAge.filter((card) => card.candidateId === selectedAppSearch.entityId);
  }, [appAgeThreshold, selectedAppSearch, selectedAppStageIds, selectedRoleApplications]);

  const bdCardsByStage = useMemo(() => {
    const grouped: Record<BDStageId, BDPipelineCard[]> = {
      identifying: [],
      outreach: [],
      discovery: [],
      terms_sent: [],
      closed_won: [],
      closed_lost: [],
    };

    for (const card of filteredBDCards) grouped[card.stageId].push(card);

    for (const stage of BD_STAGES) {
      grouped[stage.id].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    }

    return grouped;
  }, [filteredBDCards]);

  const rtCardsByStage = useMemo(() => {
    const grouped: Record<RTStageId, RTPipelineCard[]> = {
      intake: [],
      sourcing: [],
      shortlisting: [],
      interviews: [],
      offer_pending: [],
      filled_pending_rebate: [],
      filled_won: [],
      closed_lost: [],
    };

    for (const card of filteredRTCards) grouped[card.stageId].push(card);

    for (const stage of RT_STAGES) {
      grouped[stage.id].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    }

    return grouped;
  }, [filteredRTCards]);

  const roleApplicationsByStage = useMemo(() => {
    const grouped: Record<AppStageId, RoleApplicationCard[]> = {
      applied: [],
      screening: [],
      shortlisted: [],
      interview: [],
      offer: [],
      placed: [],
      rejected: [],
      withdrawn: [],
    };

    for (const card of filteredRoleApplications) grouped[card.stageId].push(card);

    for (const stage of APPLICATION_STAGES) {
      grouped[stage.id].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    }

    return grouped;
  }, [filteredRoleApplications]);

  const toggleBDStage = (stageId: BDStageId) => {
    setCollapsedBDStageIds((current) => {
      const next = new Set(current);
      if (next.has(stageId)) {
        next.delete(stageId);
      } else {
        next.add(stageId);
      }
      return next;
    });
  };

  const toggleRTStage = (stageId: RTStageId) => {
    setCollapsedRTStageIds((current) => {
      const next = new Set(current);
      if (next.has(stageId)) {
        next.delete(stageId);
      } else {
        next.add(stageId);
      }
      return next;
    });
  };

  const toggleAppStage = (stageId: AppStageId) => {
    setCollapsedAppStageIds((current) => {
      const next = new Set(current);
      if (next.has(stageId)) {
        next.delete(stageId);
      } else {
        next.add(stageId);
      }
      return next;
    });
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>CRM</p>
        <h1 className={styles.title}>Pipelines</h1>
      </header>

      <section className={styles.switchCard}>
        <div className={styles.switchRow}>
          {VIEW_OPTIONS.map((option) => {
            const isActive = option.value === view;
            return (
              <Link
                key={option.value}
                href={`/admin/pipelines?view=${option.value}`}
                className={`${styles.switchButton} ${isActive ? styles.switchButtonActive : ""}`}
                aria-current={isActive ? "page" : undefined}
              >
                {option.label}
              </Link>
            );
          })}
        </div>
      </section>

      {view === "business-development" ? (
        <>
          <section className={styles.controlsCard}>
            <div className={styles.controlsRow}>
              <Link href="/admin/clients/new" className={styles.inlineTextLink}>
                Add new client
              </Link>
              <EntitySearch
                options={bdSearchOptions}
                selected={selectedBDSearch}
                onSelect={(option) => setSelectedBDSearch(option)}
                onClear={() => setSelectedBDSearch(null)}
                placeholder="Search"
              />
              <StatusFilter
                options={BD_STAGES.map((stage) => ({
                  value: stage.id,
                  label: stage.label,
                }))}
                selectedValues={selectedBDStageIds}
                onChange={setSelectedBDStageIds}
                onReset={() => setSelectedBDStageIds(DEFAULT_BD_STAGE_IDS)}
              />
              <label className={styles.ageFilter}>
                <span>Age</span>
                <select
                  value={bdAgeFilter}
                  onChange={(event) =>
                    setBdAgeFilter(event.target.value as AgeFilterValue)
                  }
                >
                  {AGE_FILTER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <span
                className={styles.helpIcon}
                tabIndex={0}
                aria-label="Business development stage definitions"
              >
                i
                <span className={styles.helpTooltip}>
                  {BD_STAGES.map((stage) => (
                    <span key={stage.id} className={styles.helpLine}>
                      <strong>{stage.label}:</strong> {stage.tooltip}
                    </span>
                  ))}
                </span>
              </span>
            </div>
          </section>

          <section className={styles.boardCard}>
            {isLoading ? <p className={styles.infoText}>Loading pipeline...</p> : null}
            {errorMessage ? <p className={styles.errorText}>{errorMessage}</p> : null}
            {!isLoading && !errorMessage ? (
              <div className={styles.boardScroll}>
                <div className={styles.boardGrid}>
                  {BD_STAGES.map((stage) => {
                    const isCollapsed = collapsedBDStageIds.has(stage.id);
                    const stageCards = bdCardsByStage[stage.id];
                    return (
                      <article
                        key={stage.id}
                        className={`${styles.stageColumn} ${isCollapsed ? styles.stageColumnCollapsed : ""}`}
                      >
                        <header className={styles.stageHeader}>
                          <div
                            className={`${styles.stageTitleWrap} ${isCollapsed ? styles.stageTitleWrapCollapsed : ""}`}
                          >
                            <h2 className={styles.stageTitle}>{stage.label}</h2>
                            <span className={styles.stageCount}>{stageCards.length}</span>
                          </div>
                          <button
                            type="button"
                            className={styles.collapseButton}
                            onClick={() => toggleBDStage(stage.id)}
                          >
                            {isCollapsed ? "Open" : "Close"}
                          </button>
                        </header>

                        {!isCollapsed ? (
                          <div className={styles.cardStack}>
                            {stageCards.length > 0 ? (
                              stageCards.map((card) => (
                                <Link
                                  key={card.id}
                                  href={`/admin/clients/${card.clientId}`}
                                  className={styles.pipelineCard}
                                >
                                  <p className={styles.cardTitleText}>{card.title}</p>
                                  <dl className={styles.cardMeta}>
                                    <div>
                                      <dt>Status</dt>
                                      <dd>{card.statusLabel}</dd>
                                    </div>
                                    <div>
                                      <dt>Source</dt>
                                      <dd>{formatSource(card.source)}</dd>
                                    </div>
                                    <div>
                                      <dt>Age</dt>
                                      <dd>{toAgeInDays(card.updatedAt)}d</dd>
                                    </div>
                                  </dl>
                                </Link>
                              ))
                            ) : (
                              <p className={styles.emptyStage}>No records.</p>
                            )}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </section>
        </>
      ) : (
        <>
          {!selectedRole ? (
            <>
              <section className={styles.controlsCard}>
                <div className={styles.controlsRow}>
                  <Link href="/admin/roles/new" className={styles.inlineTextLink}>
                    Add new role
                  </Link>
                  <EntitySearch
                    options={rtSearchOptions}
                    selected={selectedRTSearch}
                    onSelect={(option) => setSelectedRTSearch(option)}
                    onClear={() => setSelectedRTSearch(null)}
                    placeholder="Search"
                  />
                  <StatusFilter
                    options={RT_STAGES.map((stage) => ({
                      value: stage.id,
                      label: stage.label,
                    }))}
                    selectedValues={selectedRTStageIds}
                    onChange={setSelectedRTStageIds}
                    onReset={() => setSelectedRTStageIds(DEFAULT_RT_STAGE_IDS)}
                  />
                  <label className={styles.ageFilter}>
                    <span>Age</span>
                    <select
                      value={rtAgeFilter}
                      onChange={(event) =>
                        setRtAgeFilter(event.target.value as AgeFilterValue)
                      }
                    >
                      {AGE_FILTER_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span
                    className={styles.helpIcon}
                    tabIndex={0}
                    aria-label="Role tracker stage definitions"
                  >
                    i
                    <span className={styles.helpTooltip}>
                      {RT_STAGES.map((stage) => (
                        <span key={stage.id} className={styles.helpLine}>
                          <strong>{stage.label}:</strong> {stage.tooltip}
                        </span>
                      ))}
                    </span>
                  </span>
                </div>
              </section>

              <section className={styles.boardCard}>
                {isLoading ? <p className={styles.infoText}>Loading role tracker...</p> : null}
                {errorMessage ? <p className={styles.errorText}>{errorMessage}</p> : null}
                {!isLoading && !errorMessage ? (
                  <div className={styles.boardScroll}>
                    <div className={styles.boardGridWide}>
                      {RT_STAGES.map((stage) => {
                        const isCollapsed = collapsedRTStageIds.has(stage.id);
                        const stageCards = rtCardsByStage[stage.id];
                        return (
                          <article
                            key={stage.id}
                            className={`${styles.stageColumn} ${isCollapsed ? styles.stageColumnCollapsed : ""}`}
                          >
                            <header className={styles.stageHeader}>
                              <div
                                className={`${styles.stageTitleWrap} ${isCollapsed ? styles.stageTitleWrapCollapsed : ""}`}
                              >
                                <h2 className={styles.stageTitle}>{stage.label}</h2>
                                <span className={styles.stageCount}>{stageCards.length}</span>
                              </div>
                              <button
                                type="button"
                                className={styles.collapseButton}
                                onClick={() => toggleRTStage(stage.id)}
                              >
                                {isCollapsed ? "Open" : "Close"}
                              </button>
                            </header>

                            {!isCollapsed ? (
                              <div className={styles.cardStack}>
                                {stageCards.length > 0 ? (
                                  stageCards.map((card) => (
                                    <Link
                                      key={card.id}
                                      href={`/admin/pipelines?view=vacancy-fill&role=${card.roleId}`}
                                      className={styles.pipelineCard}
                                    >
                                      <p className={styles.cardTitleText}>{card.title}</p>
                                      <p className={styles.cardSubtleText}>{card.clientName}</p>
                                      <dl className={styles.cardMetaSplit}>
                                        <div>
                                          <dt>Candidates</dt>
                                          <dd>{card.candidateCount}</dd>
                                        </div>
                                        <div>
                                          <dt>Interviews</dt>
                                          <dd>{card.interviewCount}</dd>
                                        </div>
                                        <div>
                                          <dt>Offers</dt>
                                          <dd>{card.offerCount}</dd>
                                        </div>
                                      </dl>
                                      <dl className={styles.cardMeta}>
                                        <div>
                                          <dt>Status</dt>
                                          <dd>{card.roleStatusLabel}</dd>
                                        </div>
                                        <div>
                                          <dt>Age</dt>
                                          <dd>{toAgeInDays(card.updatedAt)}d</dd>
                                        </div>
                                        <div>
                                          <dt>Open</dt>
                                          <dd>Applications</dd>
                                        </div>
                                      </dl>
                                    </Link>
                                  ))
                                ) : (
                                  <p className={styles.emptyStage}>No records.</p>
                                )}
                              </div>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </section>
            </>
          ) : (
            <>
              <section className={styles.controlsCard}>
                <div className={styles.panelHeaderRow}>
                  <div>
                    <h2 className={styles.cardTitle}>{selectedRole.title}</h2>
                    <p className={styles.panelSubtext}>
                      {selectedRole.client_id
                        ? (clientNameById[selectedRole.client_id] ?? "-")
                        : "-"}
                    </p>
                  </div>
                  <Link
                    href="/admin/pipelines?view=vacancy-fill"
                    className={styles.switchButton}
                  >
                    Back to Role Tracker
                  </Link>
                </div>
                <div className={styles.controlsRow}>
                  <EntitySearch
                    options={appSearchOptions}
                    selected={selectedAppSearch}
                    onSelect={(option) => setSelectedAppSearch(option)}
                    onClear={() => setSelectedAppSearch(null)}
                    placeholder="Search"
                  />
                  <StatusFilter
                    options={APPLICATION_STAGES.map((stage) => ({
                      value: stage.id,
                      label: stage.label,
                    }))}
                    selectedValues={selectedAppStageIds}
                    onChange={setSelectedAppStageIds}
                    onReset={() => setSelectedAppStageIds(DEFAULT_APP_STAGE_IDS)}
                  />
                  <label className={styles.ageFilter}>
                    <span>Age</span>
                    <select
                      value={appAgeFilter}
                      onChange={(event) =>
                        setAppAgeFilter(event.target.value as AgeFilterValue)
                      }
                    >
                      {AGE_FILTER_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span
                    className={styles.helpIcon}
                    tabIndex={0}
                    aria-label="Candidate application stage definitions"
                  >
                    i
                    <span className={styles.helpTooltip}>
                      {APPLICATION_STAGES.map((stage) => (
                        <span key={stage.id} className={styles.helpLine}>
                          <strong>{stage.label}:</strong> {stage.tooltip}
                        </span>
                      ))}
                    </span>
                  </span>
                </div>
              </section>

              <section className={styles.boardCard}>
                {isLoading ? (
                  <p className={styles.infoText}>Loading applications...</p>
                ) : null}
                {errorMessage ? <p className={styles.errorText}>{errorMessage}</p> : null}
                {!isLoading && !errorMessage ? (
                  <div className={styles.boardScroll}>
                    <div className={styles.boardGridWide}>
                      {APPLICATION_STAGES.map((stage) => {
                        const isCollapsed = collapsedAppStageIds.has(stage.id);
                        const stageCards = roleApplicationsByStage[stage.id];
                        return (
                          <article
                            key={stage.id}
                            className={`${styles.stageColumn} ${isCollapsed ? styles.stageColumnCollapsed : ""}`}
                          >
                            <header className={styles.stageHeader}>
                              <div
                                className={`${styles.stageTitleWrap} ${isCollapsed ? styles.stageTitleWrapCollapsed : ""}`}
                              >
                                <h2 className={styles.stageTitle}>{stage.label}</h2>
                                <span className={styles.stageCount}>{stageCards.length}</span>
                              </div>
                              <button
                                type="button"
                                className={styles.collapseButton}
                                onClick={() => toggleAppStage(stage.id)}
                              >
                                {isCollapsed ? "Open" : "Close"}
                              </button>
                            </header>

                            {!isCollapsed ? (
                              <div className={styles.cardStack}>
                                {stageCards.length > 0 ? (
                                  stageCards.map((card) => (
                                    <Link
                                      key={card.id}
                                      href={`/admin/candidates/${card.candidateId}`}
                                      className={styles.pipelineCard}
                                    >
                                      <p className={styles.cardTitleText}>{card.candidateName}</p>
                                      <dl className={styles.cardMeta}>
                                        <div>
                                          <dt>Status</dt>
                                          <dd>{card.candidateStatusLabel}</dd>
                                        </div>
                                        <div>
                                          <dt>Submitted</dt>
                                          <dd>{formatDate(card.submittedOn)}</dd>
                                        </div>
                                        <div>
                                          <dt>Age</dt>
                                          <dd>{toAgeInDays(card.updatedAt)}d</dd>
                                        </div>
                                      </dl>
                                    </Link>
                                  ))
                                ) : (
                                  <p className={styles.emptyStage}>No records.</p>
                                )}
                              </div>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </section>
            </>
          )}
        </>
      )}
    </main>
  );
}
