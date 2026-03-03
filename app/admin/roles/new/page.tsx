"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/src/lib/supabase";
import styles from "../../clients/new/new-client.module.css";

const JOB_TYPE_OPTIONS = [
  { value: "none", label: "None" },
  { value: "full_time", label: "Full Time" },
  { value: "part_time", label: "Part Time" },
  { value: "temporary", label: "Temporary" },
  { value: "contract", label: "Contract" },
  { value: "seasonal", label: "Seasonal" },
  { value: "freelance", label: "Freelance" },
] as const;

const WORK_EXPERIENCE_OPTIONS = [
  { value: "none", label: "None" },
  { value: "0_1_year", label: "0-1 year" },
  { value: "1_3_years", label: "1-3 years" },
  { value: "4_5_years", label: "4-5 years" },
  { value: "5_plus_years", label: "5+ years" },
] as const;

type UserProfile = {
  full_name: string | null;
  email: string | null;
};

type ClientOption = {
  id: string;
  name: string;
  industry: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  county: string | null;
  postcode: string | null;
};

type ContactOption = {
  id: string;
  first_name: string;
  last_name: string;
};

type ContactEmployment = {
  contact_id: string;
  client_id: string | null;
  is_primary: boolean | null;
  start_date: string | null;
  end_date: string | null;
};

type RoleStatus = {
  code: string;
  label: string;
  sort_order: number;
};

type RichTextFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

function RichTextField({ label, value, onChange }: RichTextFieldProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const runCommand = (command: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false);
    onChange(editorRef.current?.innerHTML ?? "");
  };

  return (
    <label className={`${styles.field} ${styles.fullWidthField}`}>
      <span className={styles.label}>{label}</span>
      <div className={styles.richEditor}>
        <div className={styles.richToolbar}>
          <button type="button" onClick={() => runCommand("bold")}>
            B
          </button>
          <button type="button" onClick={() => runCommand("italic")}>
            I
          </button>
          <button type="button" onClick={() => runCommand("insertUnorderedList")}>
            List
          </button>
        </div>
        <div
          ref={editorRef}
          className={styles.richSurface}
          contentEditable
          suppressContentEditableWarning
          onInput={(event) => onChange((event.target as HTMLDivElement).innerHTML)}
        />
      </div>
    </label>
  );
}

function toNullableInteger(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanHtml(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "<br>" || trimmed === "<div><br></div>") {
    return null;
  }
  return trimmed;
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export default function NewRolePage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [ownerUserId, setOwnerUserId] = useState("");
  const [ownerLabel, setOwnerLabel] = useState("");
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [contactOptions, setContactOptions] = useState<ContactOption[]>([]);
  const [employmentRows, setEmploymentRows] = useState<ContactEmployment[]>([]);
  const [roleStatuses, setRoleStatuses] = useState<RoleStatus[]>([]);
  const [industryOptions, setIndustryOptions] = useState<string[]>([]);

  const [postingTitle, setPostingTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [contactId, setContactId] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [jobStatus, setJobStatus] = useState("intake");
  const [industry, setIndustry] = useState("");
  const [jobType, setJobType] = useState("full_time");
  const [salaryText, setSalaryText] = useState("");
  const [workExperience, setWorkExperience] = useState("none");
  const [notes, setNotes] = useState("");

  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [county, setCounty] = useState("");
  const [postcode, setPostcode] = useState("");
  const [addressText, setAddressText] = useState("");
  const [isRemote, setIsRemote] = useState(false);
  const [isHybrid, setIsHybrid] = useState(false);
  const [addressMessage, setAddressMessage] = useState("");

  const [numberOfPositions, setNumberOfPositions] = useState("");
  const [expectedRevenuePerPosition, setExpectedRevenuePerPosition] = useState("");
  const [totalExpectedRevenue, setTotalExpectedRevenue] = useState("");
  const [actualRevenue, setActualRevenue] = useState("");

  const [jobDescriptionHtml, setJobDescriptionHtml] = useState("");
  const [requirementsHtml, setRequirementsHtml] = useState("");
  const [benefitsHtml, setBenefitsHtml] = useState("");

  const [listingJobBoards, setListingJobBoards] = useState("");
  const [listingSocialMedia, setListingSocialMedia] = useState("");

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
        { data: contactsData, error: contactsError },
        { data: employmentsData, error: employmentsError },
        { data: statusesData, error: statusesError },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name,email")
          .eq("id", user.id)
          .maybeSingle<UserProfile>(),
        supabase
          .from("clients")
          .select(
            "id,name,industry,address_line_1,address_line_2,city,county,postcode",
          )
          .order("name", { ascending: true }),
        supabase.from("contacts").select("id,first_name,last_name"),
        supabase
          .from("contact_employments")
          .select("contact_id,client_id,is_primary,start_date,end_date"),
        supabase
          .from("role_statuses")
          .select("code,label,sort_order")
          .order("sort_order", { ascending: true }),
      ]);

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

      if (statusesError) {
        setErrorMessage(statusesError.message);
        setIsLoading(false);
        return;
      }

      const owner =
        profile?.full_name?.trim() || profile?.email || user.email || "Current user";

      const clients = (clientsData ?? []) as ClientOption[];
      const industries = Array.from(
        new Set(
          clients
            .map((client) => (client.industry ?? "").trim())
            .filter((value) => value.length > 0),
        ),
      ).sort((a, b) => a.localeCompare(b));

      const statuses = (statusesData ?? []) as RoleStatus[];

      setOwnerLabel(owner);
      setClientOptions(clients);
      setContactOptions((contactsData ?? []) as ContactOption[]);
      setEmploymentRows((employmentsData ?? []) as ContactEmployment[]);
      setRoleStatuses(statuses);
      setIndustryOptions(industries);
      if (statuses.length > 0) {
        setJobStatus(statuses[0].code);
      }
      setIsLoading(false);
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [router, supabase]);

  const clientById = useMemo(() => {
    return clientOptions.reduce<Record<string, ClientOption>>((acc, client) => {
      acc[client.id] = client;
      return acc;
    }, {});
  }, [clientOptions]);

  const availableContacts = useMemo(() => {
    if (!clientId) return contactOptions;

    const linkedRows = employmentRows.filter((row) => row.client_id === clientId);
    if (linkedRows.length === 0) return [];

    const scoreByContactId = linkedRows.reduce<Record<string, number>>((acc, row) => {
      const isPrimaryActive = row.is_primary && !row.end_date ? 20 : 0;
      const isActive = !row.end_date ? 10 : 0;
      const start = row.start_date ? new Date(row.start_date).getTime() / 1e10 : 0;
      acc[row.contact_id] = Math.max(
        acc[row.contact_id] ?? 0,
        isPrimaryActive + isActive + start,
      );
      return acc;
    }, {});

    return contactOptions
      .filter((contact) => scoreByContactId[contact.id] !== undefined)
      .sort((a, b) => {
        const scoreDiff =
          (scoreByContactId[b.id] ?? 0) - (scoreByContactId[a.id] ?? 0);
        if (scoreDiff !== 0) return scoreDiff;
        return `${a.first_name} ${a.last_name}`.localeCompare(
          `${b.first_name} ${b.last_name}`,
        );
      });
  }, [clientId, contactOptions, employmentRows]);

  const useClientAddress = () => {
    setAddressMessage("");

    if (!clientId) {
      setAddressMessage("Select a client first.");
      return;
    }

    const client = clientById[clientId];
    if (!client) {
      setAddressMessage("Selected client not found.");
      return;
    }

    const hasAddress = Boolean(
      client.address_line_1 ||
        client.address_line_2 ||
        client.city ||
        client.county ||
        client.postcode,
    );

    if (!hasAddress) {
      setAddressMessage("The selected client doesn't have any address.");
      return;
    }

    setAddressLine1(client.address_line_1 ?? "");
    setAddressLine2(client.address_line_2 ?? "");
    setCity(client.city ?? "");
    setCounty(client.county ?? "");
    setPostcode(client.postcode ?? "");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!postingTitle.trim()) {
      setErrorMessage("Posting title is required.");
      return;
    }

    if (!clientId) {
      setErrorMessage("Client name is required.");
      return;
    }

    if (!ownerUserId) {
      setErrorMessage("Unable to identify the assigned recruiter.");
      return;
    }

    const numberOfPositionsValue = toNullableInteger(numberOfPositions);
    if (numberOfPositions.trim() && numberOfPositionsValue === null) {
      setErrorMessage("Number of positions must be a whole number.");
      return;
    }

    setIsSaving(true);

    const descriptionHtml = cleanHtml(jobDescriptionHtml);
    const requirementsRichHtml = cleanHtml(requirementsHtml);
    const benefitsRichHtml = cleanHtml(benefitsHtml);

    const payload = {
      title: postingTitle.trim(),
      client_id: clientId,
      contact_id: contactId || null,
      owner_user_id: ownerUserId,
      created_by: ownerUserId,
      target_date: targetDate || null,
      status_code: jobStatus || "intake",
      industry: industry.trim() || null,
      job_type: jobType,
      salary_text: salaryText.trim() || null,
      work_experience: workExperience,
      notes: notes.trim() || null,
      address_line_1: addressLine1.trim() || null,
      address_line_2: addressLine2.trim() || null,
      city: city.trim() || null,
      county: county.trim() || null,
      postcode: postcode.trim() || null,
      address_text: addressText.trim() || null,
      is_remote: isRemote,
      is_hybrid: isHybrid,
      number_of_positions: numberOfPositionsValue,
      expected_revenue_per_position: expectedRevenuePerPosition.trim() || null,
      total_expected_revenue: totalExpectedRevenue.trim() || null,
      actual_revenue: actualRevenue.trim() || null,
      job_description_html: descriptionHtml,
      requirements_html: requirementsRichHtml,
      benefits_html: benefitsRichHtml,
      listing_job_boards: listingJobBoards.trim() || null,
      listing_social_media: listingSocialMedia.trim() || null,
      description: descriptionHtml ? stripHtml(descriptionHtml) : null,
    };

    const { error } = await supabase.from("roles").insert(payload);

    if (error) {
      const isSchemaMismatch =
        error.message.includes("column") || error.message.includes("schema cache");
      setErrorMessage(
        isSchemaMismatch
          ? "Roles table is missing new fields. Run supabase/role_form_patch.sql and retry."
          : error.message,
      );
      setIsSaving(false);
      return;
    }

    setSuccessMessage("Role saved successfully.");
    setTimeout(() => {
      router.push("/admin/roles");
    }, 500);
  };

  if (isLoading) {
    return (
      <main className={styles.loadingWrap}>
        <p className={styles.loadingText}>Loading role form...</p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>CRM</p>
          <h1 className={styles.title}>Add Role</h1>
        </div>
        <Link href="/admin/roles" className={styles.cancelLink}>
          Back to Roles
        </Link>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Role Information</h2>
          <div className={styles.grid}>
            <label className={styles.field}>
              <span className={styles.label}>Posting title *</span>
              <input
                type="text"
                value={postingTitle}
                onChange={(event) => setPostingTitle(event.target.value)}
                required
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Client name *</span>
              <select
                value={clientId}
                onChange={(event) => {
                  setClientId(event.target.value);
                  setContactId("");
                  setAddressMessage("");
                }}
                required
              >
                <option value="">Select client</option>
                {clientOptions.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Contact name</span>
              <select
                value={contactId}
                onChange={(event) => setContactId(event.target.value)}
              >
                <option value="">Unassigned</option>
                {availableContacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {`${contact.first_name} ${contact.last_name}`}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Assigned recruiter</span>
              <input type="text" value={ownerLabel} readOnly />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Target date</span>
              <input
                type="date"
                value={targetDate}
                onChange={(event) => setTargetDate(event.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Job status</span>
              <select
                value={jobStatus}
                onChange={(event) => setJobStatus(event.target.value)}
              >
                {roleStatuses.map((status) => (
                  <option key={status.code} value={status.code}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Industry</span>
              <input
                type="text"
                value={industry}
                onChange={(event) => setIndustry(event.target.value)}
                list="role-industry-options"
              />
              <datalist id="role-industry-options">
                {industryOptions.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Job Type</span>
              <select
                value={jobType}
                onChange={(event) => setJobType(event.target.value)}
              >
                {JOB_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Salary</span>
              <input
                type="text"
                value={salaryText}
                onChange={(event) => setSalaryText(event.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Work Experience</span>
              <select
                value={workExperience}
                onChange={(event) => setWorkExperience(event.target.value)}
              >
                {WORK_EXPERIENCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className={`${styles.field} ${styles.fullWidthField}`}>
            <span className={styles.label}>Notes</span>
            <textarea
              rows={4}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeaderInline}>
            <h2 className={styles.sectionTitle}>Address Information</h2>
            <button
              type="button"
              className={styles.inlineTextButton}
              onClick={useClientAddress}
            >
              Use Client Address
            </button>
          </div>

          {addressMessage ? <p className={styles.warningMessage}>{addressMessage}</p> : null}

          <div className={styles.checkboxRow}>
            <label className={styles.checkboxField}>
              <input
                type="checkbox"
                checked={isRemote}
                onChange={(event) => setIsRemote(event.target.checked)}
              />
              <span>Remote</span>
            </label>
            <label className={styles.checkboxField}>
              <input
                type="checkbox"
                checked={isHybrid}
                onChange={(event) => setIsHybrid(event.target.checked)}
              />
              <span>Hybrid</span>
            </label>
          </div>

          <label className={`${styles.field} ${styles.fullWidthField}`}>
            <span className={styles.label}>Address</span>
            <textarea
              rows={3}
              value={addressText}
              onChange={(event) => setAddressText(event.target.value)}
            />
          </label>

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
          <h2 className={styles.sectionTitle}>Forecast Details</h2>
          <div className={styles.grid}>
            <label className={styles.field}>
              <span className={styles.label}>Number of positions</span>
              <input
                type="number"
                value={numberOfPositions}
                onChange={(event) => setNumberOfPositions(event.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Expected revenue per position</span>
              <input
                type="text"
                value={expectedRevenuePerPosition}
                onChange={(event) => setExpectedRevenuePerPosition(event.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Total expected revenue</span>
              <input
                type="text"
                value={totalExpectedRevenue}
                onChange={(event) => setTotalExpectedRevenue(event.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Actual revenue</span>
              <input
                type="text"
                value={actualRevenue}
                onChange={(event) => setActualRevenue(event.target.value)}
              />
            </label>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Job Information</h2>
          <RichTextField
            label="Job Description"
            value={jobDescriptionHtml}
            onChange={setJobDescriptionHtml}
          />
          <RichTextField
            label="Requirements"
            value={requirementsHtml}
            onChange={setRequirementsHtml}
          />
          <RichTextField
            label="Benefits"
            value={benefitsHtml}
            onChange={setBenefitsHtml}
          />
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Listing Information</h2>
          <label className={`${styles.field} ${styles.fullWidthField}`}>
            <span className={styles.label}>Job boards</span>
            <textarea
              rows={3}
              value={listingJobBoards}
              onChange={(event) => setListingJobBoards(event.target.value)}
            />
          </label>
          <label className={`${styles.field} ${styles.fullWidthField}`}>
            <span className={styles.label}>Social media</span>
            <textarea
              rows={3}
              value={listingSocialMedia}
              onChange={(event) => setListingSocialMedia(event.target.value)}
            />
          </label>
        </section>

        {errorMessage ? <p className={styles.errorMessage}>{errorMessage}</p> : null}
        {successMessage ? (
          <p className={styles.successMessage}>{successMessage}</p>
        ) : null}

        <div className={styles.actions}>
          <button type="submit" className={styles.submitButton} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Role"}
          </button>
          <Link href="/admin/roles" className={styles.cancelButton}>
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
