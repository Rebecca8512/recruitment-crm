"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/src/lib/supabase";
import styles from "../../clients/new/new-client.module.css";

const SOURCE_OPTIONS = [
  { value: "paid_ad", label: "Paid Ad" },
  { value: "cold_call", label: "Cold Call" },
  { value: "referral", label: "Referral" },
  { value: "internal", label: "Internal" },
  { value: "search_engine", label: "Search Engine" },
  { value: "networking", label: "Networking" },
] as const;

type UserProfile = {
  full_name: string | null;
  email: string | null;
};

type ClientOption = {
  id: string;
  name: string;
};

type InsertedContact = {
  id: string;
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

export default function NewContactPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [ownerUserId, setOwnerUserId] = useState("");
  const [ownerLabel, setOwnerLabel] = useState("");
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);

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
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (!isMounted) return;

      if (sessionError || !sessionData.session?.user) {
        router.replace("/admin");
        return;
      }

      const user = sessionData.session.user;
      setOwnerUserId(user.id);

      const [{ data: profile }, { data: clientsData, error: clientsError }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("full_name,email")
            .eq("id", user.id)
            .maybeSingle<UserProfile>(),
          supabase.from("clients").select("id,name").order("name", { ascending: true }),
        ]);

      if (clientsError) {
        setErrorMessage(clientsError.message);
        setIsLoading(false);
        return;
      }

      const label =
        profile?.full_name?.trim() || profile?.email || user.email || "Current user";
      setOwnerLabel(label);
      setClientOptions((clientsData ?? []) as ClientOption[]);
      setIsLoading(false);
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [router, supabase]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

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
      setErrorMessage("Unable to identify the logged-in agent.");
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
      created_by: ownerUserId,
    };

    const { data: insertedContact, error: contactError } = await supabase
      .from("contacts")
      .insert(contactPayload)
      .select("id")
      .single<InsertedContact>();

    if (contactError || !insertedContact?.id) {
      const isSchemaMismatch =
        contactError?.message.includes("column") ||
        contactError?.message.includes("schema cache");
      setErrorMessage(
        isSchemaMismatch
          ? "Contacts table is missing new fields. Run supabase/contact_form_patch.sql and retry."
          : (contactError?.message ?? "Failed to save contact."),
      );
      setIsSaving(false);
      return;
    }

    if (clientId) {
      const { error: employmentError } = await supabase
        .from("contact_employments")
        .insert({
          contact_id: insertedContact.id,
          client_id: clientId,
          job_title: jobTitle.trim() || null,
          is_primary: isPrimaryContact,
          created_by: ownerUserId,
        });

      if (employmentError) {
        await supabase.from("contacts").delete().eq("id", insertedContact.id);
        setErrorMessage(
          employmentError.message.includes("column")
            ? "Contact employment schema is missing fields. Run latest CRM SQL patches and retry."
            : employmentError.message,
        );
        setIsSaving(false);
        return;
      }
    }

    setSuccessMessage("Contact saved successfully.");
    setTimeout(() => {
      router.push("/admin/contacts");
    }, 500);
  };

  if (isLoading) {
    return (
      <main className={styles.loadingWrap}>
        <p className={styles.loadingText}>Loading contact form...</p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>CRM</p>
          <h1 className={styles.title}>Add Contact</h1>
        </div>
        <Link href="/admin/contacts" className={styles.cancelLink}>
          Back to Contacts
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

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Attachment Information</h2>
          <div className={styles.attachmentGrid}>
            <div className={styles.attachmentCard}>
              <p className={styles.attachmentTitle}>Attachment</p>
              <button type="button" className={styles.disabledButton} disabled>
                Upload coming soon
              </button>
            </div>
          </div>
        </section>

        {errorMessage ? <p className={styles.errorMessage}>{errorMessage}</p> : null}
        {successMessage ? (
          <p className={styles.successMessage}>{successMessage}</p>
        ) : null}

        <div className={styles.actions}>
          <button type="submit" className={styles.submitButton} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Contact"}
          </button>
          <Link href="/admin/contacts" className={styles.cancelButton}>
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
