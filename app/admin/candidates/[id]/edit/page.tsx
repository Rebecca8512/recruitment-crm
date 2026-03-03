"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/src/lib/supabase";
import styles from "../../../clients/new/new-client.module.css";

const SOURCE_OPTIONS = [
  { value: "referral", label: "Referral" },
  { value: "paid_ad", label: "Paid ad" },
  { value: "social_media", label: "Social media" },
  { value: "jobboard", label: "Jobboard" },
  { value: "cold_call", label: "Cold call" },
] as const;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

type CandidateDetails = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  county: string | null;
  postcode: string | null;
  current_employer_client_id: string | null;
  current_company: string | null;
  current_title: string | null;
  highest_qualification: string | null;
  current_salary: number | null;
  expected_salary: number | null;
  notes: string | null;
  linkedin_url: string | null;
  facebook_url: string | null;
  x_url: string | null;
  instagram_url: string | null;
  status_code: string;
  owner_user_id: string | null;
  source: string | null;
  marketing_email_opt_out: boolean;
  education_institution: string | null;
  education_field: string | null;
  education_graduation_year: number | null;
  experience_years: number | null;
  notice_period_weeks: number | null;
  core_skills: string | null;
};

type InsertedClient = {
  id: string;
  name: string;
};

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

export default function EditCandidatePage() {
  const params = useParams<{ id?: string }>();
  const candidateId = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const [ownerUserId, setOwnerUserId] = useState("");
  const [ownerLabel, setOwnerLabel] = useState("");
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
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

      const user = sessionData.session.user;

      const [
        { data: candidateData, error: candidateError },
        { data: clientsData, error: clientsError },
        { data: candidateStatuses, error: candidateStatusesError },
        { data: clientStatuses, error: clientStatusesError },
      ] = await Promise.all([
        supabase
          .from("candidates")
          .select(
            "id,first_name,last_name,email,phone,mobile,address_line_1,address_line_2,city,county,postcode,current_employer_client_id,current_company,current_title,highest_qualification,current_salary,expected_salary,notes,linkedin_url,facebook_url,x_url,instagram_url,status_code,owner_user_id,source,marketing_email_opt_out,education_institution,education_field,education_graduation_year,experience_years,notice_period_weeks,core_skills",
          )
          .eq("id", candidateId)
          .maybeSingle<CandidateDetails>(),
        supabase.from("clients").select("id,name").order("name", { ascending: true }),
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

      if (clientStatusesError) {
        setErrorMessage(clientStatusesError.message);
        setIsLoading(false);
        return;
      }

      const assignedOwnerId = candidateData.owner_user_id ?? user.id;
      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("full_name,email")
        .eq("id", assignedOwnerId)
        .maybeSingle<UserProfile>();

      const owner =
        ownerProfile?.full_name?.trim() ||
        ownerProfile?.email ||
        user.email ||
        "Current user";

      const clientRows = (clientsData ?? []) as ClientOption[];
      setOwnerUserId(assignedOwnerId);
      setOwnerLabel(owner);
      setClientOptions(clientRows);

      const candidateStatusRows = (candidateStatuses ?? []) as CandidateStatusOption[];
      setCandidateStatusOptions(candidateStatusRows);

      const lowestClientStatus = (clientStatuses ?? [])[0] as
        | { code: string }
        | undefined;
      if (lowestClientStatus?.code) {
        setLowestClientStatusCode(lowestClientStatus.code);
      }

      setName(`${candidateData.first_name} ${candidateData.last_name}`.trim());
      setEmail(candidateData.email ?? "");
      setPhone(candidateData.phone ?? "");
      setMobile(candidateData.mobile ?? "");
      setAddressLine1(candidateData.address_line_1 ?? "");
      setAddressLine2(candidateData.address_line_2 ?? "");
      setCity(candidateData.city ?? "");
      setCounty(candidateData.county ?? "");
      setPostcode(candidateData.postcode ?? "");

      const linkedEmployer = candidateData.current_employer_client_id
        ? clientRows.find((row) => row.id === candidateData.current_employer_client_id)
            ?.name
        : null;

      setCurrentEmployerName(linkedEmployer ?? candidateData.current_company ?? "");
      setCurrentJobTitle(candidateData.current_title ?? "");
      setHighestQualification(candidateData.highest_qualification ?? "");
      setCurrentSalary(
        typeof candidateData.current_salary === "number"
          ? String(candidateData.current_salary)
          : "",
      );
      setExpectedSalary(
        typeof candidateData.expected_salary === "number"
          ? String(candidateData.expected_salary)
          : "",
      );
      setNotes(candidateData.notes ?? "");

      setLinkedInUrl(candidateData.linkedin_url ?? "");
      setFacebookUrl(candidateData.facebook_url ?? "");
      setXUrl(candidateData.x_url ?? "");
      setInstagramUrl(candidateData.instagram_url ?? "");

      setCandidateStatus(candidateData.status_code ?? "new");
      setSource(candidateData.source ?? "referral");
      setMarketingEmailOptOut(candidateData.marketing_email_opt_out);

      setEducationInstitution(candidateData.education_institution ?? "");
      setEducationField(candidateData.education_field ?? "");
      setEducationGraduationYear(
        typeof candidateData.education_graduation_year === "number"
          ? String(candidateData.education_graduation_year)
          : "",
      );

      setExperienceYears(
        typeof candidateData.experience_years === "number"
          ? String(candidateData.experience_years)
          : "",
      );
      setNoticePeriodWeeks(
        typeof candidateData.notice_period_weeks === "number"
          ? String(candidateData.notice_period_weeks)
          : "",
      );
      setCoreSkills(candidateData.core_skills ?? "");
      setIsLoading(false);
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [candidateId, router, supabase]);

  const resolveEmployerClient = async () => {
    const employer = currentEmployerName.trim();
    if (!employer)
      return {
        clientId: null as string | null,
        clientName: null as string | null,
      };

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

    if (!candidateId || !UUID_PATTERN.test(candidateId)) {
      setErrorMessage("Invalid candidate id.");
      return;
    }

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
    };

    const { error } = await supabase
      .from("candidates")
      .update(payload)
      .eq("id", candidateId);

    if (error) {
      setErrorMessage(error.message);
      setIsSaving(false);
      return;
    }

    setSuccessMessage("Candidate updated successfully.");
    setTimeout(() => {
      router.push(`/admin/candidates/${candidateId}`);
    }, 500);
  };

  const handleDeleteCandidate = async () => {
    if (!candidateId || !UUID_PATTERN.test(candidateId)) {
      setDeleteError("Invalid candidate id.");
      return;
    }

    setDeleteError("");
    setIsDeleting(true);

    const { error } = await supabase
      .from("candidates")
      .delete()
      .eq("id", candidateId);

    if (error) {
      setDeleteError(error.message);
      setIsDeleting(false);
      return;
    }

    router.push("/admin/candidates");
  };

  if (isLoading) {
    return (
      <main className={styles.loadingWrap}>
        <p className={styles.loadingText}>Loading candidate details...</p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>CRM</p>
          <h1 className={styles.title}>Edit Candidate</h1>
        </div>
        <Link
          href={`/admin/candidates/${candidateId ?? ""}`}
          className={styles.cancelLink}
        >
          Back to Profile
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

        {errorMessage ? <p className={styles.errorMessage}>{errorMessage}</p> : null}
        {successMessage ? (
          <p className={styles.successMessage}>{successMessage}</p>
        ) : null}

        <div className={styles.actions}>
          <button type="submit" className={styles.submitButton} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
          <Link
            href={`/admin/candidates/${candidateId ?? ""}`}
            className={styles.cancelButton}
          >
            Cancel
          </Link>
          <button
            type="button"
            className={styles.subtleDeleteLink}
            onClick={() => setShowDeleteWarning((value) => !value)}
          >
            Delete candidate
          </button>
        </div>

        {showDeleteWarning ? (
          <div className={styles.deleteWarningCard}>
            <p className={styles.deleteWarningTitle}>Delete this candidate?</p>
            <p className={styles.deleteWarningText}>
              This permanently removes the candidate profile and their linked
              applications.
            </p>
            {deleteError ? (
              <p className={styles.deleteErrorText}>{deleteError}</p>
            ) : null}
            <div className={styles.deleteActions}>
              <button
                type="button"
                className={styles.confirmDeleteButton}
                onClick={handleDeleteCandidate}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete permanently"}
              </button>
              <button
                type="button"
                className={styles.cancelDeleteButton}
                onClick={() => {
                  setShowDeleteWarning(false);
                  setDeleteError("");
                }}
                disabled={isDeleting}
              >
                Keep candidate
              </button>
            </div>
          </div>
        ) : null}
      </form>
    </main>
  );
}
