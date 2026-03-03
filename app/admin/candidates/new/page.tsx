"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/src/lib/supabase";
import styles from "../../clients/new/new-client.module.css";

const SOURCE_OPTIONS = [
  { value: "referral", label: "Referral" },
  { value: "paid_ad", label: "Paid ad" },
  { value: "social_media", label: "Social media" },
  { value: "jobboard", label: "Jobboard" },
  { value: "cold_call", label: "Cold call" },
] as const;

type UserProfile = {
  full_name: string | null;
  email: string | null;
};

type CandidateStatusOption = {
  code: string;
  label: string;
  sort_order: number;
};

type ClientOption = {
  id: string;
  name: string;
};

type RoleOption = {
  id: string;
  title: string;
  client_id: string | null;
};

type InsertedClient = {
  id: string;
  name: string;
};

type CandidateRoleApplicationInput = {
  rowId: string;
  roleId: string;
  hasResume: boolean;
  hasFormattedResume: boolean;
  hasCoverLetter: boolean;
  hasOffer: boolean;
  hasContract: boolean;
  hasOther: boolean;
  otherNote: string;
  folderUrl: string;
};

const EMPTY_ROLE_APPLICATION = (): CandidateRoleApplicationInput => ({
  rowId: crypto.randomUUID(),
  roleId: "",
  hasResume: false,
  hasFormattedResume: false,
  hasCoverLetter: false,
  hasOffer: false,
  hasContract: false,
  hasOther: false,
  otherNote: "",
  folderUrl: "",
});

function splitFullName(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((value) => value.length > 0);

  if (parts.length < 2) return null;
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function toNullableNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNullableInteger(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function NewCandidatePage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [ownerUserId, setOwnerUserId] = useState("");
  const [ownerLabel, setOwnerLabel] = useState("");
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);
  const [candidateStatusOptions, setCandidateStatusOptions] = useState<
    CandidateStatusOption[]
  >([]);
  const [lowestClientStatusCode, setLowestClientStatusCode] = useState("prospect");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [mobile, setMobile] = useState("");

  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [county, setCounty] = useState("");
  const [postcode, setPostcode] = useState("");

  const [currentEmployerName, setCurrentEmployerName] = useState("");
  const [currentJobTitle, setCurrentJobTitle] = useState("");
  const [highestQualification, setHighestQualification] = useState("");
  const [currentSalary, setCurrentSalary] = useState("");
  const [expectedSalary, setExpectedSalary] = useState("");
  const [notes, setNotes] = useState("");

  const [linkedInUrl, setLinkedInUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [xUrl, setXUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");

  const [candidateStatus, setCandidateStatus] = useState("new");
  const [source, setSource] = useState<string>("referral");
  const [marketingEmailOptOut, setMarketingEmailOptOut] = useState(false);

  const [educationInstitution, setEducationInstitution] = useState("");
  const [educationField, setEducationField] = useState("");
  const [educationGraduationYear, setEducationGraduationYear] = useState("");

  const [experienceYears, setExperienceYears] = useState("");
  const [noticePeriodWeeks, setNoticePeriodWeeks] = useState("");
  const [coreSkills, setCoreSkills] = useState("");
  const [roleApplications, setRoleApplications] = useState<
    CandidateRoleApplicationInput[]
  >([EMPTY_ROLE_APPLICATION()]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (!isMounted) return;

      if (sessionError || !sessionData.session?.user) {
        router.replace("/admin");
        return;
      }

      const user = sessionData.session.user;
      setOwnerUserId(user.id);

      const [
        { data: profile },
        { data: clientsData, error: clientsError },
        { data: rolesData, error: rolesError },
        { data: candidateStatuses, error: candidateStatusesError },
        { data: clientStatuses, error: clientStatusesError },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name,email")
          .eq("id", user.id)
          .maybeSingle<UserProfile>(),
        supabase.from("clients").select("id,name").order("name", { ascending: true }),
        supabase
          .from("roles")
          .select("id,title,client_id")
          .order("title", { ascending: true }),
        supabase
          .from("candidate_statuses")
          .select("code,label,sort_order")
          .order("sort_order", { ascending: true }),
        supabase
          .from("client_statuses")
          .select("code,sort_order")
          .order("sort_order", { ascending: true })
          .limit(1),
      ]);

      if (clientsError) {
        setErrorMessage(clientsError.message);
        setIsLoading(false);
        return;
      }

      if (candidateStatusesError) {
        setErrorMessage(candidateStatusesError.message);
        setIsLoading(false);
        return;
      }

      if (rolesError) {
        setErrorMessage(rolesError.message);
        setIsLoading(false);
        return;
      }

      if (clientStatusesError) {
        setErrorMessage(clientStatusesError.message);
        setIsLoading(false);
        return;
      }

      const owner =
        profile?.full_name?.trim() || profile?.email || user.email || "Current user";
      setOwnerLabel(owner);
      setClientOptions((clientsData ?? []) as ClientOption[]);
      setRoleOptions((rolesData ?? []) as RoleOption[]);

      const candidateStatusRows = (candidateStatuses ?? []) as CandidateStatusOption[];
      setCandidateStatusOptions(candidateStatusRows);
      if (candidateStatusRows.length > 0) {
        setCandidateStatus(candidateStatusRows[0].code);
      }

      const lowestClientStatus = (clientStatuses ?? [])[0] as
        | { code: string }
        | undefined;
      if (lowestClientStatus?.code) {
        setLowestClientStatusCode(lowestClientStatus.code);
      }

      setIsLoading(false);
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [router, supabase]);

  const clientNameById = useMemo(() => {
    return clientOptions.reduce<Record<string, string>>((acc, client) => {
      acc[client.id] = client.name;
      return acc;
    }, {});
  }, [clientOptions]);

  const updateRoleApplicationRow = (
    rowId: string,
    updater: (current: CandidateRoleApplicationInput) => CandidateRoleApplicationInput,
  ) => {
    setRoleApplications((current) =>
      current.map((row) => (row.rowId === rowId ? updater(row) : row)),
    );
  };

  const addRoleApplicationRow = () => {
    setRoleApplications((current) => [...current, EMPTY_ROLE_APPLICATION()]);
  };

  const removeRoleApplicationRow = (rowId: string) => {
    setRoleApplications((current) => {
      if (current.length === 1) {
        return [EMPTY_ROLE_APPLICATION()];
      }

      return current.filter((row) => row.rowId !== rowId);
    });
  };

  const resolveEmployerClient = async () => {
    const employer = currentEmployerName.trim();
    if (!employer) return { clientId: null as string | null, clientName: null as string | null };

    const existing = clientOptions.find(
      (client) => client.name.trim().toLowerCase() === employer.toLowerCase(),
    );
    if (existing) return { clientId: existing.id, clientName: existing.name };

    if (!ownerUserId) {
      throw new Error("Unable to identify the logged-in agent.");
    }

    const { data: insertedClient, error: createClientError } = await supabase
      .from("clients")
      .insert({
        name: employer,
        status_code: lowestClientStatusCode,
        account_manager_id: ownerUserId,
        created_by: ownerUserId,
      })
      .select("id,name")
      .single<InsertedClient>();

    if (createClientError || !insertedClient) {
      throw new Error(
        createClientError?.message ??
          "Unable to create current employer in clients table.",
      );
    }

    setClientOptions((current) =>
      [...current, { id: insertedClient.id, name: insertedClient.name }].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    );

    return { clientId: insertedClient.id, clientName: insertedClient.name };
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!name.trim()) {
      setErrorMessage("Name is required.");
      return;
    }

    const parsedName = splitFullName(name);
    if (!parsedName) {
      setErrorMessage("Use full name (first and last).");
      return;
    }

    if (!ownerUserId) {
      setErrorMessage("Unable to identify the logged-in agent.");
      return;
    }

    const currentSalaryValue = toNullableNumber(currentSalary);
    if (currentSalary.trim() && currentSalaryValue === null) {
      setErrorMessage("Current salary must be a number.");
      return;
    }

    const expectedSalaryValue = toNullableNumber(expectedSalary);
    if (expectedSalary.trim() && expectedSalaryValue === null) {
      setErrorMessage("Expected salary must be a number.");
      return;
    }

    const graduationYearValue = toNullableInteger(educationGraduationYear);
    if (educationGraduationYear.trim() && graduationYearValue === null) {
      setErrorMessage("Graduation year must be a whole number.");
      return;
    }

    const experienceYearsValue = toNullableNumber(experienceYears);
    if (experienceYears.trim() && experienceYearsValue === null) {
      setErrorMessage("Experience years must be a number.");
      return;
    }

    const noticeWeeksValue = toNullableInteger(noticePeriodWeeks);
    if (noticePeriodWeeks.trim() && noticeWeeksValue === null) {
      setErrorMessage("Notice period must be a whole number.");
      return;
    }

    const nonEmptyRoleRows = roleApplications.filter((row) => {
      const hasPaperworkValues =
        row.hasResume ||
        row.hasFormattedResume ||
        row.hasCoverLetter ||
        row.hasOffer ||
        row.hasContract ||
        row.hasOther ||
        row.otherNote.trim().length > 0 ||
        row.folderUrl.trim().length > 0;
      return row.roleId || hasPaperworkValues;
    });

    const duplicateRoleIds = new Set<string>();
    const seenRoleIds = new Set<string>();
    for (const row of nonEmptyRoleRows) {
      if (!row.roleId) {
        setErrorMessage("Select a role for each application row you complete.");
        return;
      }
      if (seenRoleIds.has(row.roleId)) {
        duplicateRoleIds.add(row.roleId);
      }
      seenRoleIds.add(row.roleId);
    }

    if (duplicateRoleIds.size > 0) {
      setErrorMessage("A role can only be selected once in this form.");
      return;
    }

    setIsSaving(true);

    let employerClientId: string | null = null;
    let employerClientName: string | null = null;

    try {
      const employerResult = await resolveEmployerClient();
      employerClientId = employerResult.clientId;
      employerClientName = employerResult.clientName;
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to resolve employer.",
      );
      setIsSaving(false);
      return;
    }

    const payload = {
      first_name: parsedName.firstName,
      last_name: parsedName.lastName,
      email: email.trim() || null,
      phone: phone.trim() || null,
      mobile: mobile.trim() || null,
      address_line_1: addressLine1.trim() || null,
      address_line_2: addressLine2.trim() || null,
      city: city.trim() || null,
      county: county.trim() || null,
      postcode: postcode.trim() || null,
      current_employer_client_id: employerClientId,
      current_company: employerClientName || null,
      current_title: currentJobTitle.trim() || null,
      highest_qualification: highestQualification.trim() || null,
      current_salary: currentSalaryValue,
      expected_salary: expectedSalaryValue,
      notes: notes.trim() || null,
      linkedin_url: linkedInUrl.trim() || null,
      facebook_url: facebookUrl.trim() || null,
      x_url: xUrl.trim() || null,
      instagram_url: instagramUrl.trim() || null,
      status_code: candidateStatus || "new",
      owner_user_id: ownerUserId,
      source,
      marketing_email_opt_out: marketingEmailOptOut,
      education_institution: educationInstitution.trim() || null,
      education_field: educationField.trim() || null,
      education_graduation_year: graduationYearValue,
      experience_years: experienceYearsValue,
      notice_period_weeks: noticeWeeksValue,
      core_skills: coreSkills.trim() || null,
      created_by: ownerUserId,
    };

    const { data: insertedCandidate, error } = await supabase
      .from("candidates")
      .insert(payload)
      .select("id")
      .single<{ id: string }>();

    if (error || !insertedCandidate) {
      const isSchemaMismatch =
        error?.message.includes("column") || error?.message.includes("schema cache");
      setErrorMessage(
        isSchemaMismatch
          ? "Candidates table is missing new fields. Run supabase/candidate_form_patch.sql and retry."
          : (error?.message ?? "Failed to create candidate."),
      );
      setIsSaving(false);
      return;
    }

    if (nonEmptyRoleRows.length > 0) {
      const applicationPayload = nonEmptyRoleRows.map((row) => ({
        role_id: row.roleId,
        candidate_id: insertedCandidate.id,
        stage: "applied",
        source: source || null,
        created_by: ownerUserId,
      }));

      const { data: createdApplications, error: applicationInsertError } = await supabase
        .from("applications")
        .insert(applicationPayload)
        .select("id,role_id");

      if (applicationInsertError) {
        setErrorMessage(
          `Candidate saved, but role applications failed: ${applicationInsertError.message}`,
        );
        setIsSaving(false);
        return;
      }

      const applicationIdByRoleId = new Map<string, string>();
      for (const app of createdApplications ?? []) {
        applicationIdByRoleId.set(app.role_id as string, app.id as string);
      }

      const filePayload = nonEmptyRoleRows
        .map((row) => {
          const applicationId = applicationIdByRoleId.get(row.roleId);
          if (!applicationId) return null;
          return {
            application_id: applicationId,
            has_resume: row.hasResume,
            has_formatted_resume: row.hasFormattedResume,
            has_cover_letter: row.hasCoverLetter,
            has_offer: row.hasOffer,
            has_contract: row.hasContract,
            has_other: row.hasOther,
            other_note: row.otherNote.trim() || null,
            folder_url: row.folderUrl.trim() || null,
            created_by: ownerUserId,
          };
        })
        .filter((value): value is NonNullable<typeof value> => value !== null);

      if (filePayload.length > 0) {
        const { error: fileInsertError } = await supabase
          .from("application_files")
          .upsert(filePayload, { onConflict: "application_id" });

        if (fileInsertError) {
          setErrorMessage(
            `Candidate and applications saved, but paperwork details failed: ${fileInsertError.message}`,
          );
          setIsSaving(false);
          return;
        }
      }
    }

    setSuccessMessage("Candidate saved successfully.");
    setTimeout(() => {
      router.push("/admin/candidates");
    }, 500);
  };

  if (isLoading) {
    return (
      <main className={styles.loadingWrap}>
        <p className={styles.loadingText}>Loading candidate form...</p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>CRM</p>
          <h1 className={styles.title}>Add Candidate</h1>
        </div>
        <Link href="/admin/candidates" className={styles.cancelLink}>
          Back to Candidates
        </Link>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Basic Info</h2>
          <div className={styles.grid}>
            <label className={styles.field}>
              <span className={styles.label}>Name *</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Phone</span>
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Mobile</span>
              <input
                type="tel"
                value={mobile}
                onChange={(event) => setMobile(event.target.value)}
              />
            </label>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Address</h2>
          <div className={styles.grid}>
            <label className={styles.field}>
              <span className={styles.label}>Address Line 1</span>
              <input
                type="text"
                value={addressLine1}
                onChange={(event) => setAddressLine1(event.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Address Line 2</span>
              <input
                type="text"
                value={addressLine2}
                onChange={(event) => setAddressLine2(event.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>City</span>
              <input
                type="text"
                value={city}
                onChange={(event) => setCity(event.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>County</span>
              <input
                type="text"
                value={county}
                onChange={(event) => setCounty(event.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Postcode</span>
              <input
                type="text"
                value={postcode}
                onChange={(event) => setPostcode(event.target.value)}
              />
            </label>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Professional Details</h2>
          <div className={styles.grid}>
            <label className={styles.field}>
              <span className={styles.label}>Current Employer</span>
              <input
                type="text"
                value={currentEmployerName}
                onChange={(event) => setCurrentEmployerName(event.target.value)}
                list="candidate-employer-options"
              />
              <datalist id="candidate-employer-options">
                {clientOptions.map((client) => (
                  <option key={client.id} value={client.name} />
                ))}
              </datalist>
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Current job title</span>
              <input
                type="text"
                value={currentJobTitle}
                onChange={(event) => setCurrentJobTitle(event.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Highest qualification held</span>
              <input
                type="text"
                value={highestQualification}
                onChange={(event) => setHighestQualification(event.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Current Salary</span>
              <input
                type="number"
                step="0.01"
                value={currentSalary}
                onChange={(event) => setCurrentSalary(event.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Expected salary</span>
              <input
                type="number"
                step="0.01"
                value={expectedSalary}
                onChange={(event) => setExpectedSalary(event.target.value)}
              />
            </label>
          </div>
          <label className={`${styles.field} ${styles.fullWidthField}`}>
            <span className={styles.label}>Notes</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={5}
            />
          </label>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Social Links</h2>
          <div className={styles.grid}>
            <label className={styles.field}>
              <span className={styles.label}>LinkedIn</span>
              <input
                type="url"
                value={linkedInUrl}
                onChange={(event) => setLinkedInUrl(event.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Facebook</span>
              <input
                type="url"
                value={facebookUrl}
                onChange={(event) => setFacebookUrl(event.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>X</span>
              <input
                type="url"
                value={xUrl}
                onChange={(event) => setXUrl(event.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Instagram</span>
              <input
                type="url"
                value={instagramUrl}
                onChange={(event) => setInstagramUrl(event.target.value)}
              />
            </label>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Other Info</h2>
          <div className={styles.grid}>
            <label className={styles.field}>
              <span className={styles.label}>Candidate status</span>
              <select
                value={candidateStatus}
                onChange={(event) => setCandidateStatus(event.target.value)}
              >
                {candidateStatusOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Owner</span>
              <input type="text" value={ownerLabel} readOnly />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Source</span>
              <select
                value={source}
                onChange={(event) => setSource(event.target.value)}
              >
                {SOURCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.checkboxField}>
              <input
                type="checkbox"
                checked={marketingEmailOptOut}
                onChange={(event) => setMarketingEmailOptOut(event.target.checked)}
              />
              <span>Marketing email opt out</span>
            </label>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Educational Details</h2>
          <div className={styles.grid}>
            <label className={styles.field}>
              <span className={styles.label}>Institution</span>
              <input
                type="text"
                value={educationInstitution}
                onChange={(event) => setEducationInstitution(event.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Field of study</span>
              <input
                type="text"
                value={educationField}
                onChange={(event) => setEducationField(event.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Graduation year</span>
              <input
                type="number"
                value={educationGraduationYear}
                onChange={(event) => setEducationGraduationYear(event.target.value)}
              />
            </label>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Experience Details</h2>
          <div className={styles.grid}>
            <label className={styles.field}>
              <span className={styles.label}>Years of experience</span>
              <input
                type="number"
                step="0.1"
                value={experienceYears}
                onChange={(event) => setExperienceYears(event.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Notice period (weeks)</span>
              <input
                type="number"
                value={noticePeriodWeeks}
                onChange={(event) => setNoticePeriodWeeks(event.target.value)}
              />
            </label>
          </div>
          <label className={`${styles.field} ${styles.fullWidthField}`}>
            <span className={styles.label}>Core skills</span>
            <textarea
              value={coreSkills}
              onChange={(event) => setCoreSkills(event.target.value)}
              rows={4}
            />
          </label>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeaderInline}>
            <h2 className={styles.sectionTitle}>Role Applications</h2>
            <button
              type="button"
              className={styles.inlineTextButton}
              onClick={addRoleApplicationRow}
            >
              + Add another role
            </button>
          </div>
          <div className={styles.roleApplicationList}>
            {roleApplications.map((row, index) => (
              <div key={row.rowId} className={styles.roleApplicationCard}>
                <div className={styles.roleApplicationHeader}>
                  <p className={styles.attachmentTitle}>Role {index + 1}</p>
                  <button
                    type="button"
                    className={styles.subtleDeleteLink}
                    onClick={() => removeRoleApplicationRow(row.rowId)}
                  >
                    Remove
                  </button>
                </div>
                <div className={styles.grid}>
                  <label className={styles.field}>
                    <span className={styles.label}>Role</span>
                    <select
                      value={row.roleId}
                      onChange={(event) =>
                        updateRoleApplicationRow(row.rowId, (current) => ({
                          ...current,
                          roleId: event.target.value,
                        }))
                      }
                    >
                      <option value="">Select role</option>
                      {roleOptions.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.title}
                          {role.client_id
                            ? ` - ${clientNameById[role.client_id] ?? "Client"}`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>Folder URL</span>
                    <input
                      type="url"
                      value={row.folderUrl}
                      onChange={(event) =>
                        updateRoleApplicationRow(row.rowId, (current) => ({
                          ...current,
                          folderUrl: event.target.value,
                        }))
                      }
                      placeholder="https://"
                    />
                  </label>
                </div>

                <div className={styles.paperworkRow}>
                  <label className={styles.checkboxField}>
                    <input
                      type="checkbox"
                      checked={row.hasResume}
                      onChange={(event) =>
                        updateRoleApplicationRow(row.rowId, (current) => ({
                          ...current,
                          hasResume: event.target.checked,
                        }))
                      }
                    />
                    <span>Resume</span>
                  </label>
                  <label className={styles.checkboxField}>
                    <input
                      type="checkbox"
                      checked={row.hasFormattedResume}
                      onChange={(event) =>
                        updateRoleApplicationRow(row.rowId, (current) => ({
                          ...current,
                          hasFormattedResume: event.target.checked,
                        }))
                      }
                    />
                    <span>Formatted resume</span>
                  </label>
                  <label className={styles.checkboxField}>
                    <input
                      type="checkbox"
                      checked={row.hasCoverLetter}
                      onChange={(event) =>
                        updateRoleApplicationRow(row.rowId, (current) => ({
                          ...current,
                          hasCoverLetter: event.target.checked,
                        }))
                      }
                    />
                    <span>Cover letter</span>
                  </label>
                  <label className={styles.checkboxField}>
                    <input
                      type="checkbox"
                      checked={row.hasOffer}
                      onChange={(event) =>
                        updateRoleApplicationRow(row.rowId, (current) => ({
                          ...current,
                          hasOffer: event.target.checked,
                        }))
                      }
                    />
                    <span>Offer</span>
                  </label>
                  <label className={styles.checkboxField}>
                    <input
                      type="checkbox"
                      checked={row.hasContract}
                      onChange={(event) =>
                        updateRoleApplicationRow(row.rowId, (current) => ({
                          ...current,
                          hasContract: event.target.checked,
                        }))
                      }
                    />
                    <span>Contract</span>
                  </label>
                  <label className={styles.checkboxField}>
                    <input
                      type="checkbox"
                      checked={row.hasOther}
                      onChange={(event) =>
                        updateRoleApplicationRow(row.rowId, (current) => ({
                          ...current,
                          hasOther: event.target.checked,
                        }))
                      }
                    />
                    <span>Other</span>
                  </label>
                </div>

                <label className={`${styles.field} ${styles.fullWidthField}`}>
                  <span className={styles.label}>Other note</span>
                  <textarea
                    rows={3}
                    value={row.otherNote}
                    onChange={(event) =>
                      updateRoleApplicationRow(row.rowId, (current) => ({
                        ...current,
                        otherNote: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
            ))}
          </div>
        </section>

        {errorMessage ? <p className={styles.errorMessage}>{errorMessage}</p> : null}
        {successMessage ? (
          <p className={styles.successMessage}>{successMessage}</p>
        ) : null}

        <div className={styles.actions}>
          <button type="submit" className={styles.submitButton} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Candidate"}
          </button>
          <Link href="/admin/candidates" className={styles.cancelButton}>
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
