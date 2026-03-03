"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/src/lib/supabase";
import styles from "../../../clients/new/new-client.module.css";

const SOURCE_OPTIONS = [
  { value: "paid_ad", label: "Paid Ad" },
  { value: "cold_call", label: "Cold Call" },
  { value: "referral", label: "Referral" },
  { value: "internal", label: "Internal" },
  { value: "search_engine", label: "Search Engine" },
  { value: "networking", label: "Networking" },
] as const;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type UserProfile = {
  full_name: string | null;
  email: string | null;
};

type ClientOption = {
  id: string;
  name: string;
};

type ContactDetails = {
  id: string;
  first_name: string;
  last_name: string;
  department: string | null;
  email: string | null;
  secondary_email: string | null;
  job_title: string | null;
  work_phone: string | null;
  mobile: string | null;
  phone: string | null;
  linkedin_url: string | null;
  x_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  source: string | null;
  owner_user_id: string | null;
  marketing_email_opt_out: boolean;
  notes: string | null;
};

type EmploymentRow = {
  id: string;
  client_id: string | null;
  job_title: string | null;
  is_primary: boolean | null;
  start_date: string | null;
  end_date: string | null;
};

function splitContactName(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((value) => value.length > 0);

  if (parts.length < 2) {
    return null;
  }

  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ");

  return { firstName, lastName };
}

function sortEmployments(rows: EmploymentRow[]) {
  return [...rows].sort((a, b) => {
    const aPrimary = a.is_primary && !a.end_date ? 1 : 0;
    const bPrimary = b.is_primary && !b.end_date ? 1 : 0;
    if (aPrimary !== bPrimary) return bPrimary - aPrimary;

    const aActive = !a.end_date ? 1 : 0;
    const bActive = !b.end_date ? 1 : 0;
    if (aActive !== bActive) return bActive - aActive;

    const aStart = a.start_date ? new Date(a.start_date).getTime() : 0;
    const bStart = b.start_date ? new Date(b.start_date).getTime() : 0;
    return bStart - aStart;
  });
}

export default function EditContactPage() {
  const params = useParams<{ id?: string }>();
  const contactId = Array.isArray(params.id) ? params.id[0] : params.id;
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

  const [primaryEmploymentId, setPrimaryEmploymentId] = useState<string | null>(null);

  const [contactName, setContactName] = useState("");
  const [department, setDepartment] = useState("");
  const [email, setEmail] = useState("");
  const [secondaryEmail, setSecondaryEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [workPhone, setWorkPhone] = useState("");
  const [mobile, setMobile] = useState("");
  const [clientId, setClientId] = useState("");
  const [notes, setNotes] = useState("");
  const [linkedInUrl, setLinkedInUrl] = useState("");
  const [xUrl, setXUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [source, setSource] = useState<string>("paid_ad");
  const [isPrimaryContact, setIsPrimaryContact] = useState(false);
  const [marketingEmailOptOut, setMarketingEmailOptOut] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!contactId || !UUID_PATTERN.test(contactId)) {
        setErrorMessage("Invalid contact id.");
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
        { data: contactData, error: contactError },
        { data: clientsData, error: clientsError },
        { data: employmentsData, error: employmentsError },
      ] = await Promise.all([
        supabase
          .from("contacts")
          .select(
            "id,first_name,last_name,department,email,secondary_email,job_title,work_phone,mobile,phone,linkedin_url,x_url,facebook_url,instagram_url,source,owner_user_id,marketing_email_opt_out,notes",
          )
          .eq("id", contactId)
          .maybeSingle<ContactDetails>(),
        supabase.from("clients").select("id,name").order("name", { ascending: true }),
        supabase
          .from("contact_employments")
          .select("id,client_id,job_title,is_primary,start_date,end_date")
          .eq("contact_id", contactId),
      ]);

      if (!isMounted) return;

      if (contactError) {
        setErrorMessage(contactError.message);
        setIsLoading(false);
        return;
      }

      if (!contactData) {
        setErrorMessage("Contact not found.");
        setIsLoading(false);
        return;
      }

      if (clientsError) {
        setErrorMessage(clientsError.message);
        setIsLoading(false);
        return;
      }

      if (employmentsError) {
        setErrorMessage(employmentsError.message);
        setIsLoading(false);
        return;
      }

      const assignedOwnerId = contactData.owner_user_id ?? user.id;
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

      const employments = sortEmployments((employmentsData ?? []) as EmploymentRow[]);
      const selectedEmployment = employments[0] ?? null;

      setOwnerUserId(assignedOwnerId);
      setOwnerLabel(owner);
      setClientOptions((clientsData ?? []) as ClientOption[]);

      setPrimaryEmploymentId(selectedEmployment?.id ?? null);
      setClientId(selectedEmployment?.client_id ?? "");
      setIsPrimaryContact(Boolean(selectedEmployment?.is_primary));

      setContactName(`${contactData.first_name} ${contactData.last_name}`.trim());
      setDepartment(contactData.department ?? "");
      setEmail(contactData.email ?? "");
      setSecondaryEmail(contactData.secondary_email ?? "");
      setJobTitle(contactData.job_title ?? selectedEmployment?.job_title ?? "");
      setWorkPhone(contactData.work_phone ?? "");
      setMobile(contactData.mobile ?? contactData.phone ?? "");
      setNotes(contactData.notes ?? "");
      setLinkedInUrl(contactData.linkedin_url ?? "");
      setXUrl(contactData.x_url ?? "");
      setFacebookUrl(contactData.facebook_url ?? "");
      setInstagramUrl(contactData.instagram_url ?? "");
      setSource(contactData.source ?? "paid_ad");
      setMarketingEmailOptOut(contactData.marketing_email_opt_out);
      setIsLoading(false);
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [contactId, router, supabase]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!contactId || !UUID_PATTERN.test(contactId)) {
      setErrorMessage("Invalid contact id.");
      return;
    }

    if (!contactName.trim()) {
      setErrorMessage("Contact name is required.");
      return;
    }

    const parsedName = splitContactName(contactName);
    if (!parsedName) {
      setErrorMessage("Use full contact name (first and last).");
      return;
    }

    if (!ownerUserId) {
      setErrorMessage("Unable to identify the contact owner.");
      return;
    }

    setIsSaving(true);

    const contactPayload = {
      first_name: parsedName.firstName,
      last_name: parsedName.lastName,
      department: department.trim() || null,
      email: email.trim() || null,
      secondary_email: secondaryEmail.trim() || null,
      job_title: jobTitle.trim() || null,
      work_phone: workPhone.trim() || null,
      mobile: mobile.trim() || null,
      phone: mobile.trim() || null,
      notes: notes.trim() || null,
      linkedin_url: linkedInUrl.trim() || null,
      x_url: xUrl.trim() || null,
      facebook_url: facebookUrl.trim() || null,
      instagram_url: instagramUrl.trim() || null,
      source,
      owner_user_id: ownerUserId,
      marketing_email_opt_out: marketingEmailOptOut,
    };

    const { error: updateError } = await supabase
      .from("contacts")
      .update(contactPayload)
      .eq("id", contactId);

    if (updateError) {
      setErrorMessage(updateError.message);
      setIsSaving(false);
      return;
    }

    if (isPrimaryContact) {
      const { error: clearPrimaryError } = await supabase
        .from("contact_employments")
        .update({ is_primary: false })
        .eq("contact_id", contactId);

      if (clearPrimaryError) {
        setErrorMessage(clearPrimaryError.message);
        setIsSaving(false);
        return;
      }
    }

    if (clientId) {
      if (primaryEmploymentId) {
        const { error: employmentError } = await supabase
          .from("contact_employments")
          .update({
            client_id: clientId,
            job_title: jobTitle.trim() || null,
            is_primary: isPrimaryContact,
            end_date: null,
          })
          .eq("id", primaryEmploymentId);

        if (employmentError) {
          setErrorMessage(employmentError.message);
          setIsSaving(false);
          return;
        }
      } else {
        const { data: insertedEmployment, error: employmentError } = await supabase
          .from("contact_employments")
          .insert({
            contact_id: contactId,
            client_id: clientId,
            job_title: jobTitle.trim() || null,
            is_primary: isPrimaryContact,
            created_by: ownerUserId,
          })
          .select("id")
          .single<{ id: string }>();

        if (employmentError || !insertedEmployment?.id) {
          setErrorMessage(employmentError?.message ?? "Failed to update employment.");
          setIsSaving(false);
          return;
        }

        setPrimaryEmploymentId(insertedEmployment.id);
      }
    } else if (primaryEmploymentId) {
      const { error: unassignEmploymentError } = await supabase
        .from("contact_employments")
        .update({ client_id: null, is_primary: false })
        .eq("id", primaryEmploymentId);

      if (unassignEmploymentError) {
        setErrorMessage(unassignEmploymentError.message);
        setIsSaving(false);
        return;
      }
    }

    setSuccessMessage("Contact updated successfully.");
    setTimeout(() => {
      router.push(`/admin/contacts/${contactId}`);
    }, 500);
  };

  const handleDeleteContact = async () => {
    if (!contactId || !UUID_PATTERN.test(contactId)) {
      setDeleteError("Invalid contact id.");
      return;
    }

    setDeleteError("");
    setIsDeleting(true);

    const { error } = await supabase.from("contacts").delete().eq("id", contactId);

    if (error) {
      setDeleteError(error.message);
      setIsDeleting(false);
      return;
    }

    router.push("/admin/contacts");
  };

  if (isLoading) {
    return (
      <main className={styles.loadingWrap}>
        <p className={styles.loadingText}>Loading contact details...</p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>CRM</p>
          <h1 className={styles.title}>Edit Contact</h1>
        </div>
        <Link href={`/admin/contacts/${contactId ?? ""}`} className={styles.cancelLink}>
          Back to Profile
        </Link>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Contact Information</h2>
          <div className={styles.grid}>
            <label className={styles.field}>
              <span className={styles.label}>Contact Name *</span>
              <input
                type="text"
                value={contactName}
                onChange={(event) => setContactName(event.target.value)}
                required
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Department</span>
              <input
                type="text"
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
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
              <span className={styles.label}>Secondary Email</span>
              <input
                type="email"
                value={secondaryEmail}
                onChange={(event) => setSecondaryEmail(event.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Job Title</span>
              <input
                type="text"
                value={jobTitle}
                onChange={(event) => setJobTitle(event.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Work Phone</span>
              <input
                type="tel"
                value={workPhone}
                onChange={(event) => setWorkPhone(event.target.value)}
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

            <label className={styles.field}>
              <span className={styles.label}>Client Name</span>
              <select
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
              >
                <option value="">Unassigned</option>
                {clientOptions.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
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

            <label className={styles.field}>
              <span className={styles.label}>Contact Owner</span>
              <input type="text" value={ownerLabel} readOnly />
            </label>

            <label className={styles.checkboxField}>
              <input
                type="checkbox"
                checked={isPrimaryContact}
                onChange={(event) => setIsPrimaryContact(event.target.checked)}
              />
              <span>Is primary contact</span>
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
              <span className={styles.label}>X</span>
              <input
                type="url"
                value={xUrl}
                onChange={(event) => setXUrl(event.target.value)}
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
              <span className={styles.label}>Instagram</span>
              <input
                type="url"
                value={instagramUrl}
                onChange={(event) => setInstagramUrl(event.target.value)}
              />
            </label>
          </div>
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
            href={`/admin/contacts/${contactId ?? ""}`}
            className={styles.cancelButton}
          >
            Cancel
          </Link>
          <button
            type="button"
            className={styles.subtleDeleteLink}
            onClick={() => setShowDeleteWarning((value) => !value)}
          >
            Delete contact
          </button>
        </div>

        {showDeleteWarning ? (
          <div className={styles.deleteWarningCard}>
            <p className={styles.deleteWarningTitle}>Delete this contact?</p>
            <p className={styles.deleteWarningText}>
              This permanently removes the contact profile. Linked roles become
              unassigned from this contact.
            </p>
            {deleteError ? (
              <p className={styles.deleteErrorText}>{deleteError}</p>
            ) : null}
            <div className={styles.deleteActions}>
              <button
                type="button"
                className={styles.confirmDeleteButton}
                onClick={handleDeleteContact}
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
                Keep contact
              </button>
            </div>
          </div>
        ) : null}
      </form>
    </main>
  );
}
