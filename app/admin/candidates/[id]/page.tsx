"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
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

type ClientRecord = {
  id: string;
  name: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function CandidateProfilePage() {
  const params = useParams<{ id?: string }>();
  const candidateId = Array.isArray(params.id) ? params.id[0] : params.id;
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [candidate, setCandidate] = useState<CandidateRecord | null>(null);
  const [statusLabel, setStatusLabel] = useState("-");
  const [employerLabel, setEmployerLabel] = useState("-");

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!candidateId || !UUID_PATTERN.test(candidateId)) {
        setErrorMessage("Invalid candidate id.");
        setIsLoading(false);
        return;
      }

      const [{ data: candidateData, error: candidateError }, { data: statusData }] =
        await Promise.all([
          supabase
            .from("candidates")
            .select(
              "id,first_name,last_name,email,phone,mobile,status_code,current_employer_client_id,current_company,current_title,highest_qualification,current_salary,expected_salary,source,notes,updated_at",
            )
            .eq("id", candidateId)
            .maybeSingle<CandidateRecord>(),
          supabase.from("candidate_statuses").select("code,label"),
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

      const statusMap = ((statusData ?? []) as CandidateStatusRecord[]).reduce<
        Record<string, string>
      >((acc, row) => {
        acc[row.code] = row.label;
        return acc;
      }, {});

      setStatusLabel(statusMap[candidateData.status_code] ?? candidateData.status_code);

      if (candidateData.current_employer_client_id) {
        const { data: employerClient } = await supabase
          .from("clients")
          .select("id,name")
          .eq("id", candidateData.current_employer_client_id)
          .maybeSingle<ClientRecord>();

        if (isMounted) {
          setEmployerLabel(employerClient?.name ?? candidateData.current_company ?? "-");
        }
      } else {
        setEmployerLabel(candidateData.current_company || "-");
      }

      setCandidate(candidateData);
      setIsLoading(false);
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [candidateId, supabase]);

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

        <div className={styles.notesBlock}>
          <p className={styles.notesLabel}>Notes</p>
          <p className={styles.notesText}>{candidate.notes || "-"}</p>
        </div>
      </section>
    </main>
  );
}
