"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  EntitySearch,
  type EntitySearchOption,
} from "@/src/components/search/entity-search";
import { getSupabaseBrowserClient } from "@/src/lib/supabase";
import styles from "./pipelines.module.css";

type PipelineView = "business-development" | "vacancy-fill" | "applicant-tracker";

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
  | "filled_pending_rebate"
  | "filled_won"
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

type DragPayload =
  | { kind: "bd"; id: string }
  | { kind: "rt"; id: string }
  | { kind: "app"; id: string };

const VIEW_OPTIONS: { value: PipelineView; label: string }[] = [
  { value: "business-development", label: "Business Development" },
  { value: "vacancy-fill", label: "Role Tracker" },
  { value: "applicant-tracker", label: "Applicant Tracker" },
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
    id: "filled_pending_rebate",
    label: "Filled - pending rebate",
    tooltip: "Candidate placed, waiting for rebate period to clear.",
  },
  {
    id: "filled_won",
    label: "Filled - Won",
    tooltip: "Rebate window cleared and placement is fully earned.",
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

const BD_STAGE_OVERRIDES_KEY = "crm:bd-stage-overrides:v1";
const RT_STAGE_OVERRIDES_KEY = "crm:rt-stage-overrides:v1";

function resolveView(view: string | null): PipelineView {
  if (view === "vacancy-fill") return "vacancy-fill";
  if (view === "applicant-tracker") return "applicant-tracker";
  return "business-development";
}

function parseAppStage(value: string | null): AppStageId {
  switch (value) {
    case "screening":
    case "shortlisted":
    case "interview":
    case "offer":
    case "placed":
    case "filled_pending_rebate":
    case "filled_won":
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

function mapBDStageToClientStatus(stageId: BDStageId): string {
  switch (stageId) {
    case "identifying":
    case "outreach":
      return "prospect";
    case "discovery":
    case "terms_sent":
      return "warm_lead";
    case "closed_won":
      return "active";
    case "closed_lost":
      return "closed";
    default:
      return "prospect";
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

function mapRTStageToRoleStatus(stageId: RTStageId): string {
  switch (stageId) {
    case "intake":
      return "pending";
    case "sourcing":
    case "shortlisting":
    case "interviews":
    case "offer_pending":
      return "active";
    case "filled_pending_rebate":
      return "filled";
    case "filled_won":
      return "won";
    case "closed_lost":
      return "lost";
    default:
      return "pending";
  }
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
  const router = useRouter();
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
  const [collapsedBDStageIds, setCollapsedBDStageIds] = useState<Set<BDStageId>>(
    new Set(["closed_lost"]),
  );
  const [bdStageOverrides, setBdStageOverrides] = useState<
    Record<string, BDStageId>
  >(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(BD_STAGE_OVERRIDES_KEY);
      return raw ? (JSON.parse(raw) as Record<string, BDStageId>) : {};
    } catch {
      return {};
    }
  });

  const [selectedRTSearch, setSelectedRTSearch] =
    useState<EntitySearchOption | null>(null);
  const [collapsedRTStageIds, setCollapsedRTStageIds] = useState<Set<RTStageId>>(
    new Set(["closed_lost"]),
  );
  const [rtStageOverrides, setRtStageOverrides] = useState<
    Record<string, RTStageId>
  >(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(RT_STAGE_OVERRIDES_KEY);
      return raw ? (JSON.parse(raw) as Record<string, RTStageId>) : {};
    } catch {
      return {};
    }
  });

  const [collapsedAppStageIds, setCollapsedAppStageIds] = useState<Set<AppStageId>>(
    new Set(["rejected", "withdrawn"]),
  );
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);

  useEffect(() => {
    window.localStorage.setItem(
      BD_STAGE_OVERRIDES_KEY,
      JSON.stringify(bdStageOverrides),
    );
  }, [bdStageOverrides]);

  useEffect(() => {
    window.localStorage.setItem(
      RT_STAGE_OVERRIDES_KEY,
      JSON.stringify(rtStageOverrides),
    );
  }, [rtStageOverrides]);

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
      stageId:
        bdStageOverrides[client.id] ?? mapClientStatusToBDStage(client.status_code),
      updatedAt: client.updated_at,
    }));
  }, [bdStageOverrides, clientStatusLabelByCode, clients]);

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
        stageId: rtStageOverrides[role.id] ?? stageId,
        updatedAt: new Date(Math.max(roleUpdated, newestAppUpdate)).toISOString(),
        candidateCount: roleApplications.length,
        interviewCount: appStages.filter((stage) => stage === "interview").length,
        offerCount: appStages.filter((stage) => stage === "offer").length,
      };
    });
  }, [applicationsByRoleId, clientNameById, roleStatusLabelByCode, roles, rtStageOverrides]);

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

  const applicantRoleSearchOptions = useMemo<EntitySearchOption[]>(() => {
    return rtCards.map((card) => ({
      key: `role:${card.roleId}`,
      entityId: card.roleId,
      entityType: "role",
      label: card.title,
      subtitle: card.clientName !== "-" ? `for ${card.clientName}` : undefined,
      searchText: `${card.title} role ${card.clientName}`,
    }));
  }, [rtCards]);

  const selectedApplicantRoleOption = useMemo(() => {
    if (!selectedRoleId) return null;
    return (
      applicantRoleSearchOptions.find((option) => option.entityId === selectedRoleId) ??
      null
    );
  }, [applicantRoleSearchOptions, selectedRoleId]);

  const filteredBDCards = useMemo(() => {
    if (!selectedBDSearch) return bdCards;
    if (selectedBDSearch.entityType !== "client") return bdCards;

    return bdCards.filter((card) => card.clientId === selectedBDSearch.entityId);
  }, [bdCards, selectedBDSearch]);

  const filteredRTCards = useMemo(() => {
    if (!selectedRTSearch) return rtCards;

    if (selectedRTSearch.entityType === "role") {
      return rtCards.filter((card) => card.roleId === selectedRTSearch.entityId);
    }

    if (selectedRTSearch.entityType === "client") {
      return rtCards.filter((card) => card.clientId === selectedRTSearch.entityId);
    }

    return rtCards;
  }, [rtCards, selectedRTSearch]);

  const filteredRoleApplications = useMemo(() => {
    return selectedRoleApplications;
  }, [selectedRoleApplications]);

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
      filled_pending_rebate: [],
      filled_won: [],
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

  const onDragStart = (payload: DragPayload) => {
    setDragPayload(payload);
  };

  const onDragEnd = () => {
    setDragPayload(null);
  };

  const moveBDCard = async (clientId: string, stageId: BDStageId) => {
    setErrorMessage("");
    const nextStatus = mapBDStageToClientStatus(stageId);
    setBdStageOverrides((current) => ({ ...current, [clientId]: stageId }));
    setClients((current) =>
      current.map((client) =>
        client.id === clientId
          ? {
              ...client,
              status_code: nextStatus,
              updated_at: new Date().toISOString(),
            }
          : client,
      ),
    );

    const { error } = await supabase
      .from("clients")
      .update({ status_code: nextStatus })
      .eq("id", clientId);

    if (error) {
      setErrorMessage(error.message);
    }
  };

  const moveRTCard = async (roleId: string, stageId: RTStageId) => {
    setErrorMessage("");
    const nextStatus = mapRTStageToRoleStatus(stageId);
    setRtStageOverrides((current) => ({ ...current, [roleId]: stageId }));
    setRoles((current) =>
      current.map((role) =>
        role.id === roleId
          ? {
              ...role,
              status_code: nextStatus,
              updated_at: new Date().toISOString(),
            }
          : role,
      ),
    );

    const { error } = await supabase
      .from("roles")
      .update({ status_code: nextStatus })
      .eq("id", roleId);

    if (error) {
      setErrorMessage(error.message);
    }
  };

  const moveRoleApplicationCard = async (applicationId: string, stageId: AppStageId) => {
    setErrorMessage("");
    setApplications((current) =>
      current.map((row) =>
        row.id === applicationId
          ? {
              ...row,
              stage: stageId,
              updated_at: new Date().toISOString(),
            }
          : row,
      ),
    );

    const { error } = await supabase
      .from("applications")
      .update({ stage: stageId })
      .eq("id", applicationId);

    if (error) {
      setErrorMessage(error.message);
    }
  };

  const onDropToBDStage = (stageId: BDStageId) => {
    if (!dragPayload || dragPayload.kind !== "bd") return;
    void moveBDCard(dragPayload.id, stageId);
  };

  const onDropToRTStage = (stageId: RTStageId) => {
    if (!dragPayload || dragPayload.kind !== "rt") return;
    void moveRTCard(dragPayload.id, stageId);
  };

  const onDropToAppStage = (stageId: AppStageId) => {
    if (!dragPayload || dragPayload.kind !== "app") return;
    void moveRoleApplicationCard(dragPayload.id, stageId);
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
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => onDropToBDStage(stage.id)}
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
                            {isCollapsed ? "+" : "\u2212"}
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
                                  draggable
                                  onDragStart={() =>
                                    onDragStart({ kind: "bd", id: card.clientId })
                                  }
                                  onDragEnd={onDragEnd}
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
      ) : null}

      {view === "vacancy-fill" ? (
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
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => onDropToRTStage(stage.id)}
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
                            {isCollapsed ? "+" : "\u2212"}
                          </button>
                        </header>

                        {!isCollapsed ? (
                          <div className={styles.cardStack}>
                            {stageCards.length > 0 ? (
                              stageCards.map((card) => (
                                <Link
                                  key={card.id}
                                  href={`/admin/pipelines?view=applicant-tracker&role=${card.roleId}`}
                                  className={styles.pipelineCard}
                                  draggable
                                  onDragStart={() =>
                                    onDragStart({ kind: "rt", id: card.roleId })
                                  }
                                  onDragEnd={onDragEnd}
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
      ) : null}

      {view === "applicant-tracker" ? (
        <>
          <section className={styles.controlsCard}>
            <div className={styles.panelHeaderRow}>
              <div>
                <h2 className={styles.cardTitle}>
                  {selectedRole ? selectedRole.title : "Applicant Tracker"}
                </h2>
                <p className={styles.panelSubtext}>
                  {selectedRole && selectedRole.client_id
                    ? (clientNameById[selectedRole.client_id] ?? "-")
                    : "Search by role to open candidate applications"}
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
                options={applicantRoleSearchOptions}
                selected={selectedApplicantRoleOption}
                onSelect={(option) =>
                  router.push(`/admin/pipelines?view=applicant-tracker&role=${option.entityId}`)
                }
                onClear={() => router.push("/admin/pipelines?view=applicant-tracker")}
                placeholder="Search"
              />
              {selectedRole ? (
                <>
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
                </>
              ) : null}
            </div>
          </section>

          {selectedRole ? (
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
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => onDropToAppStage(stage.id)}
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
                              {isCollapsed ? "+" : "\u2212"}
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
                                    draggable
                                    onDragStart={() =>
                                      onDragStart({
                                        kind: "app",
                                        id: card.applicationId,
                                      })
                                    }
                                    onDragEnd={onDragEnd}
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
          ) : (
            <section className={styles.boardCard}>
              <p className={styles.infoText}>
                Select a role from search to open the applicant tracker.
              </p>
            </section>
          )}
        </>
      ) : null}
      
    </main>
  );
}
