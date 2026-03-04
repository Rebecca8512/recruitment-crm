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

type StageId =
  | "identifying"
  | "outreach"
  | "discovery"
  | "terms_sent"
  | "closed_won"
  | "closed_lost";

type StageConfig = {
  id: StageId;
  label: string;
  tooltip: string;
};

type BDPipelineCard = {
  id: string;
  clientId: string;
  title: string;
  source: string | null;
  statusLabel: string;
  stageId: StageId;
  updatedAt: string;
};

type AgeFilterValue = "any" | "7" | "14" | "30";

const VIEW_OPTIONS: { value: PipelineView; label: string }[] = [
  { value: "business-development", label: "Business Development" },
  { value: "vacancy-fill", label: "Role Tracker" },
];

const BD_STAGES: StageConfig[] = [
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

const DEFAULT_SELECTED_STAGE_IDS = BD_STAGES.map((stage) => stage.id);

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

function mapClientStatusToBDStage(statusCode: string | null): StageId {
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

export default function PipelinesPage() {
  const searchParams = useSearchParams();
  const view = resolveView(searchParams.get("view"));
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [cards, setCards] = useState<BDPipelineCard[]>([]);
  const [selectedSearchOption, setSelectedSearchOption] =
    useState<EntitySearchOption | null>(null);
  const [selectedStageIds, setSelectedStageIds] = useState<string[]>(
    DEFAULT_SELECTED_STAGE_IDS,
  );
  const [ageFilter, setAgeFilter] = useState<AgeFilterValue>("14");
  const [collapsedStageIds, setCollapsedStageIds] = useState<Set<StageId>>(new Set());

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      const [
        { data: clientRows, error: clientsError },
        { data: statusRows, error: statusesError },
      ] = await Promise.all([
        supabase
          .from("clients")
          .select("id,name,status_code,source,updated_at")
          .order("updated_at", { ascending: false }),
        supabase.from("client_statuses").select("code,label").eq("is_active", true),
      ]);

      if (!isMounted) return;

      if (clientsError) {
        setErrorMessage(clientsError.message);
        setIsLoading(false);
        return;
      }

      if (statusesError) {
        setErrorMessage(statusesError.message);
        setIsLoading(false);
        return;
      }

      const statusLabelByCode = ((statusRows ?? []) as ClientStatusRow[]).reduce<
        Record<string, string>
      >((acc, row) => {
        acc[row.code] = row.label;
        return acc;
      }, {});

      const mappedCards = ((clientRows ?? []) as ClientRow[]).map((client) => ({
        id: client.id,
        clientId: client.id,
        title: client.name,
        source: client.source,
        statusLabel: client.status_code
          ? (statusLabelByCode[client.status_code] ?? client.status_code)
          : "Unassigned",
        stageId: mapClientStatusToBDStage(client.status_code),
        updatedAt: client.updated_at,
      }));

      setCards(mappedCards);
      setIsLoading(false);
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  const searchOptions = useMemo<EntitySearchOption[]>(() => {
    return cards.map((card) => {
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
  }, [cards]);

  const ageThresholdDays = useMemo(() => {
    if (ageFilter === "any") return 0;
    return parseInt(ageFilter, 10);
  }, [ageFilter]);

  const filteredCards = useMemo(() => {
    const byStage = cards.filter((card) => selectedStageIds.includes(card.stageId));

    const byAge =
      ageThresholdDays > 0
        ? byStage.filter((card) => toAgeInDays(card.updatedAt) >= ageThresholdDays)
        : byStage;

    if (!selectedSearchOption) return byAge;

    if (selectedSearchOption.entityType !== "client") {
      return byAge;
    }

    return byAge.filter((card) => card.clientId === selectedSearchOption.entityId);
  }, [ageThresholdDays, cards, selectedSearchOption, selectedStageIds]);

  const cardsByStage = useMemo(() => {
    const grouped: Record<StageId, BDPipelineCard[]> = {
      identifying: [],
      outreach: [],
      discovery: [],
      terms_sent: [],
      closed_won: [],
      closed_lost: [],
    };

    for (const card of filteredCards) {
      grouped[card.stageId].push(card);
    }

    for (const stage of BD_STAGES) {
      grouped[stage.id].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    }

    return grouped;
  }, [filteredCards]);

  const toggleStage = (stageId: StageId) => {
    setCollapsedStageIds((current) => {
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

      {view === "vacancy-fill" ? (
        <section className={styles.placeholderCard}>
          <h2 className={styles.cardTitle}>Role Tracker Pipeline</h2>
          <p className={styles.placeholderText}>Holding layout ready for stage setup.</p>
        </section>
      ) : (
        <>
          <section className={styles.controlsCard}>
            <div className={styles.controlsRow}>
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
                options={BD_STAGES.map((stage) => ({
                  value: stage.id,
                  label: stage.label,
                }))}
                selectedValues={selectedStageIds}
                onChange={setSelectedStageIds}
                onReset={() => setSelectedStageIds(DEFAULT_SELECTED_STAGE_IDS)}
              />
              <label className={styles.ageFilter}>
                <span>Age</span>
                <select
                  value={ageFilter}
                  onChange={(event) =>
                    setAgeFilter(event.target.value as AgeFilterValue)
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
                    const isCollapsed = collapsedStageIds.has(stage.id);
                    const stageCards = cardsByStage[stage.id];
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
                            onClick={() => toggleStage(stage.id)}
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
      )}
    </main>
  );
}
