"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/src/lib/supabase";
import styles from "./dashboard.module.css";

type ClientRow = {
  id: string;
  status_code: string | null;
};

type RoleRow = {
  id: string;
  status_code: string;
  updated_at: string;
  total_expected_revenue: string | null;
  expected_revenue_per_position: string | null;
  number_of_positions: number | null;
  estimated_fee: number | null;
  actual_revenue: string | null;
  earned_fee: number | null;
};

type ApplicationRow = {
  id: string;
  role_id: string;
  stage: string;
};

type TaskRow = {
  id: string;
  task_status: string;
  due_at: string | null;
};

type RoleStatusRow = {
  code: string;
  label: string;
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

const BD_STAGES: { id: BDStageId; label: string }[] = [
  { id: "identifying", label: "Identifying" },
  { id: "outreach", label: "Outreach" },
  { id: "discovery", label: "Discovery" },
  { id: "terms_sent", label: "Terms Sent" },
  { id: "closed_won", label: "Closed - WON" },
  { id: "closed_lost", label: "Closed - LOST" },
];

const RT_STAGES: { id: RTStageId; label: string }[] = [
  { id: "intake", label: "Intake" },
  { id: "sourcing", label: "Sourcing" },
  { id: "shortlisting", label: "Shortlisting" },
  { id: "interviews", label: "Interviews" },
  { id: "offer_pending", label: "Offer Pending" },
  { id: "filled_pending_rebate", label: "Filled - pending rebate" },
  { id: "filled_won", label: "Filled - WON" },
  { id: "closed_lost", label: "Closed - Lost" },
];

const APP_STAGES: { id: AppStageId; label: string }[] = [
  { id: "applied", label: "Applied" },
  { id: "screening", label: "Screening" },
  { id: "shortlisted", label: "Shortlisted" },
  { id: "interview", label: "Interview" },
  { id: "offer", label: "Offer" },
  { id: "placed", label: "Placed" },
  { id: "filled_pending_rebate", label: "Filled - pending rebate" },
  { id: "filled_won", label: "Filled - Won" },
  { id: "rejected", label: "Rejected" },
  { id: "withdrawn", label: "Withdrawn" },
];

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

function mapRoleToRTStage(roleStatusCode: string, appStages: AppStageId[]): RTStageId {
  if (roleStatusCode === "pending") return "intake";
  if (roleStatusCode === "filled") return "filled_pending_rebate";
  if (roleStatusCode === "won") return "filled_won";
  if (roleStatusCode === "lost" || roleStatusCode === "cancelled") return "closed_lost";

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

function parseMoneyValue(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (!value) return 0;

  const normalized = value.replace(/[^0-9.-]/g, "");
  if (!normalized) return 0;

  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function DashboardPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [roleStatuses, setRoleStatuses] = useState<RoleStatusRow[]>([]);
  const [snapshotTimeMs, setSnapshotTimeMs] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      const [
        { data: clientsData, error: clientsError },
        { data: rolesData, error: rolesError },
        { data: applicationsData, error: applicationsError },
        { data: tasksData, error: tasksError },
        { data: roleStatusesData, error: roleStatusesError },
      ] = await Promise.all([
        supabase.from("clients").select("id,status_code"),
        supabase
          .from("roles")
          .select(
            "id,status_code,updated_at,total_expected_revenue,expected_revenue_per_position,number_of_positions,estimated_fee,actual_revenue,earned_fee",
          ),
        supabase.from("applications").select("id,role_id,stage"),
        supabase.from("tasks").select("id,task_status,due_at"),
        supabase
          .from("role_statuses")
          .select("code,label")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
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

      if (applicationsError) {
        setErrorMessage(applicationsError.message);
        setIsLoading(false);
        return;
      }

      if (tasksError) {
        const isMissingTasksTable =
          tasksError.message.toLowerCase().includes("does not exist") ||
          tasksError.message.toLowerCase().includes("schema cache");

        if (!isMissingTasksTable) {
          setErrorMessage(tasksError.message);
          setIsLoading(false);
          return;
        }
      }

      if (roleStatusesError) {
        setErrorMessage(roleStatusesError.message);
        setIsLoading(false);
        return;
      }

      setClients((clientsData ?? []) as ClientRow[]);
      setRoles((rolesData ?? []) as RoleRow[]);
      setApplications((applicationsData ?? []) as ApplicationRow[]);
      setTasks((tasksData ?? []) as TaskRow[]);
      setRoleStatuses((roleStatusesData ?? []) as RoleStatusRow[]);
      setSnapshotTimeMs(Date.now());
      setIsLoading(false);
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  const pipelineSnapshot = useMemo(() => {
    const bdCounts: Record<BDStageId, number> = {
      identifying: 0,
      outreach: 0,
      discovery: 0,
      terms_sent: 0,
      closed_won: 0,
      closed_lost: 0,
    };

    for (const client of clients) {
      const stage = mapClientStatusToBDStage(client.status_code);
      bdCounts[stage] += 1;
    }

    const appStagesByRoleId = applications.reduce<Record<string, AppStageId[]>>(
      (acc, row) => {
        const parsed = parseAppStage(row.stage);
        acc[row.role_id] = acc[row.role_id] ? [...acc[row.role_id], parsed] : [parsed];
        return acc;
      },
      {},
    );

    const rtCounts: Record<RTStageId, number> = {
      intake: 0,
      sourcing: 0,
      shortlisting: 0,
      interviews: 0,
      offer_pending: 0,
      filled_pending_rebate: 0,
      filled_won: 0,
      closed_lost: 0,
    };

    for (const role of roles) {
      const stage = mapRoleToRTStage(role.status_code, appStagesByRoleId[role.id] ?? []);
      rtCounts[stage] += 1;
    }

    const appCounts: Record<AppStageId, number> = {
      applied: 0,
      screening: 0,
      shortlisted: 0,
      interview: 0,
      offer: 0,
      placed: 0,
      filled_pending_rebate: 0,
      filled_won: 0,
      rejected: 0,
      withdrawn: 0,
    };

    for (const application of applications) {
      const stage = parseAppStage(application.stage);
      appCounts[stage] += 1;
    }

    const openBD = bdCounts.identifying + bdCounts.outreach + bdCounts.discovery + bdCounts.terms_sent;
    const openRT =
      rtCounts.intake +
      rtCounts.sourcing +
      rtCounts.shortlisting +
      rtCounts.interviews +
      rtCounts.offer_pending;
    const openApp =
      appCounts.applied +
      appCounts.screening +
      appCounts.shortlisted +
      appCounts.interview +
      appCounts.offer;

    const now = snapshotTimeMs;
    const overdueTasks = tasks.filter(
      (task) => task.task_status === "todo" && task.due_at && new Date(task.due_at).getTime() < now,
    ).length;

    return {
      bdCounts,
      rtCounts,
      appCounts,
      totalOpen: openBD + openRT + openApp,
      overdueTasks,
    };
  }, [applications, clients, roles, snapshotTimeMs, tasks]);

  const revenueSnapshot = useMemo(() => {
    const roleStatusLabelByCode = roleStatuses.reduce<Record<string, string>>((acc, row) => {
      acc[row.code] = row.label;
      return acc;
    }, {});

    const statusRows: Record<
      string,
      { roleCount: number; expectedTotal: number; earnedTotal: number }
    > = {};

    let expectedTotal = 0;
    let earnedTotal = 0;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
    let wonThisMonth = 0;

    for (const role of roles) {
      const fromTotalExpected = parseMoneyValue(role.total_expected_revenue);
      const fromPerPosition =
        parseMoneyValue(role.expected_revenue_per_position) * (role.number_of_positions ?? 0);
      const expected =
        fromTotalExpected > 0
          ? fromTotalExpected
          : fromPerPosition > 0
            ? fromPerPosition
            : parseMoneyValue(role.estimated_fee);
      const earned =
        parseMoneyValue(role.actual_revenue) > 0
          ? parseMoneyValue(role.actual_revenue)
          : parseMoneyValue(role.earned_fee);

      expectedTotal += expected;
      earnedTotal += earned;

      const statusCode = role.status_code || "unknown";
      statusRows[statusCode] = statusRows[statusCode] ?? {
        roleCount: 0,
        expectedTotal: 0,
        earnedTotal: 0,
      };

      statusRows[statusCode].roleCount += 1;
      statusRows[statusCode].expectedTotal += expected;
      statusRows[statusCode].earnedTotal += earned;

      const updatedTime = new Date(role.updated_at).getTime();
      if (statusCode === "won" && updatedTime >= monthStart && updatedTime < nextMonthStart) {
        wonThisMonth += earned;
      }
    }

    const breakdown = (roleStatuses.length > 0
      ? roleStatuses.map((status) => ({
          code: status.code,
          label: status.label,
          roleCount: statusRows[status.code]?.roleCount ?? 0,
          expectedTotal: statusRows[status.code]?.expectedTotal ?? 0,
          earnedTotal: statusRows[status.code]?.earnedTotal ?? 0,
        }))
      : Object.entries(statusRows).map(([code, row]) => ({
          code,
          label: roleStatusLabelByCode[code] ?? code,
          roleCount: row.roleCount,
          expectedTotal: row.expectedTotal,
          earnedTotal: row.earnedTotal,
        })))
      .filter((row) => row.roleCount > 0 || row.expectedTotal > 0 || row.earnedTotal > 0);

    return {
      expectedTotal,
      earnedTotal,
      gap: expectedTotal - earnedTotal,
      wonThisMonth,
      breakdown,
    };
  }, [roleStatuses, roles]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Whitmore Recruitment</p>
        <h1 className={styles.title}>Dashboard</h1>
      </header>

      {isLoading ? <p className={styles.infoText}>Loading dashboard...</p> : null}
      {errorMessage ? <p className={styles.errorText}>{errorMessage}</p> : null}

      {!isLoading ? (
        <section className={styles.grid}>
          <article className={styles.card}>
            <h2 className={styles.cardTitle}>Pipeline Snapshot</h2>

            <div className={styles.kpiRow}>
              <div className={styles.kpiCard}>
                <p className={styles.kpiLabel}>Total Open</p>
                <p className={styles.kpiValue}>{pipelineSnapshot.totalOpen}</p>
              </div>
              <div className={styles.kpiCard}>
                <p className={styles.kpiLabel}>Overdue Tasks</p>
                <p className={styles.kpiValue}>{pipelineSnapshot.overdueTasks}</p>
              </div>
            </div>

            <div className={styles.sectionBlock}>
              <h3 className={styles.sectionTitle}>Business Development</h3>
              <div className={styles.countGrid}>
                {BD_STAGES.map((stage) => (
                  <div key={stage.id} className={styles.countCell}>
                    <span>{stage.label}</span>
                    <strong>{pipelineSnapshot.bdCounts[stage.id]}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.sectionBlock}>
              <h3 className={styles.sectionTitle}>Role Tracker</h3>
              <div className={styles.countGrid}>
                {RT_STAGES.map((stage) => (
                  <div key={stage.id} className={styles.countCell}>
                    <span>{stage.label}</span>
                    <strong>{pipelineSnapshot.rtCounts[stage.id]}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.sectionBlock}>
              <h3 className={styles.sectionTitle}>Applicant Tracker</h3>
              <div className={styles.countGrid}>
                {APP_STAGES.map((stage) => (
                  <div key={stage.id} className={styles.countCell}>
                    <span>{stage.label}</span>
                    <strong>{pipelineSnapshot.appCounts[stage.id]}</strong>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className={styles.card}>
            <h2 className={styles.cardTitle}>Revenue Snapshot</h2>

            <div className={styles.kpiRow}>
              <div className={styles.kpiCard}>
                <p className={styles.kpiLabel}>Expected Revenue</p>
                <p className={styles.kpiValue}>{formatCurrency(revenueSnapshot.expectedTotal)}</p>
              </div>
              <div className={styles.kpiCard}>
                <p className={styles.kpiLabel}>Earned Revenue</p>
                <p className={styles.kpiValue}>{formatCurrency(revenueSnapshot.earnedTotal)}</p>
              </div>
              <div className={styles.kpiCard}>
                <p className={styles.kpiLabel}>Gap</p>
                <p className={styles.kpiValue}>{formatCurrency(revenueSnapshot.gap)}</p>
              </div>
              <div className={styles.kpiCard}>
                <p className={styles.kpiLabel}>Won This Month</p>
                <p className={styles.kpiValue}>{formatCurrency(revenueSnapshot.wonThisMonth)}</p>
              </div>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Roles</th>
                    <th>Expected</th>
                    <th>Earned</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueSnapshot.breakdown.length > 0 ? (
                    revenueSnapshot.breakdown.map((row) => (
                      <tr key={row.code}>
                        <td>{row.label}</td>
                        <td>{row.roleCount}</td>
                        <td>{formatCurrency(row.expectedTotal)}</td>
                        <td>{formatCurrency(row.earnedTotal)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4}>No revenue data yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      ) : null}
    </main>
  );
}
