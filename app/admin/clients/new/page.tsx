"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/src/lib/supabase";
import styles from "./new-client.module.css";

const SOURCE_OPTIONS = [
  { value: "referral", label: "Referral" },
  { value: "cold_outreach", label: "Cold outreach" },
  { value: "inbound_lead", label: "Inbound lead" },
  { value: "social_media", label: "Social media" },
  { value: "networking", label: "Networking" },
  { value: "paid_ads", label: "Paid ads" },
  { value: "other", label: "Other" },
] as const;

type ClientSummary = {
  id: string;
  name: string;
  industry: string | null;
};

type UserProfile = {
  full_name: string | null;
  email: string;
};

export default function NewClientPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [accountManagerId, setAccountManagerId] = useState("");
  const [accountManagerLabel, setAccountManagerLabel] = useState("");

  const [clientOptions, setClientOptions] = useState<ClientSummary[]>([]);
  const [industryOptions, setIndustryOptions] = useState<string[]>([]);

  const [clientName, setClientName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [industry, setIndustry] = useState("");
  const [about, setAbout] = useState("");
  const [source, setSource] = useState<string>("referral");
  const [sourceOther, setSourceOther] = useState("");
  const [parentClientId, setParentClientId] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [companiesHouseNumber, setCompaniesHouseNumber] = useState("");
  const [driveShareUrl, setDriveShareUrl] = useState("");

  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [county, setCounty] = useState("");
  const [postcode, setPostcode] = useState("");

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
      setAccountManagerId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name,email")
        .eq("id", user.id)
        .maybeSingle<UserProfile>();

      const profileLabel =
        profile?.full_name?.trim() || profile?.email || user.email || "Current user";
      setAccountManagerLabel(profileLabel);

      const { data: clientsData, error: clientsError } = await supabase
        .from("clients")
        .select("id,name,industry")
        .order("name", { ascending: true });

      if (clientsError) {
        setErrorMessage(clientsError.message);
        setIsLoading(false);
        return;
      }

      const clientRows = (clientsData ?? []) as ClientSummary[];
      const industries = Array.from(
        new Set(
          clientRows
            .map((client) => (client.industry ?? "").trim())
            .filter((value) => value.length > 0),
        ),
      ).sort((a, b) => a.localeCompare(b));

      setClientOptions(clientRows);
      setIndustryOptions(industries);
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

    if (!clientName.trim()) {
      setErrorMessage("Client name is required.");
      return;
    }

    if (!accountManagerId) {
      setErrorMessage("Unable to identify the current logged-in user.");
      return;
    }

    if (source === "other" && !sourceOther.trim()) {
      setErrorMessage("Please provide details for source = Other.");
      return;
    }

    setIsSaving(true);

    const payload = {
      name: clientName.trim(),
      contact_number: contactNumber.trim() || null,
      account_manager_id: accountManagerId,
      industry: industry.trim() || null,
      about: about.trim() || null,
      source,
      source_other: source === "other" ? sourceOther.trim() || null : null,
      parent_client_id: parentClientId || null,
      email: email.trim() || null,
      website: website.trim() || null,
      companies_house_number: companiesHouseNumber.trim() || null,
      google_drive_url: driveShareUrl.trim() || null,
      address_line_1: addressLine1.trim() || null,
      address_line_2: addressLine2.trim() || null,
      city: city.trim() || null,
      county: county.trim() || null,
      postcode: postcode.trim() || null,
      created_by: accountManagerId,
    };

    const { error } = await supabase.from("clients").insert(payload);

    if (error) {
      const isSchemaMismatch =
        error.message.includes("column") || error.message.includes("schema cache");
      setErrorMessage(
        isSchemaMismatch
          ? "Client table is missing new fields. Run supabase/crm_client_form_patch.sql and retry."
          : error.message,
      );
      setIsSaving(false);
      return;
    }

    setSuccessMessage("Client saved successfully.");
    setTimeout(() => {
      router.push("/admin/clients");
    }, 600);
  };

  if (isLoading) {
    return (
      <main className={styles.loadingWrap}>
        <p className={styles.loadingText}>Loading client form...</p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>CRM</p>
          <h1 className={styles.title}>Add Client</h1>
          <p className={styles.lead}>
            Create a client record once, then reuse it for contacts, roles, and
            parent-company relationships.
          </p>
        </div>
        <Link href="/admin/clients" className={styles.cancelLink}>
          Back to Clients
        </Link>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Client Information</h2>
          <div className={styles.grid}>
            <label className={styles.field}>
              <span className={styles.label}>Client Name *</span>
              <input
                type="text"
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                required
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Contact Number</span>
              <input
                type="tel"
                value={contactNumber}
                onChange={(event) => setContactNumber(event.target.value)}
                placeholder="e.g. 020 1234 5678"
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Account Manager</span>
              <input type="text" value={accountManagerLabel} readOnly />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Industry</span>
              <input
                type="text"
                value={industry}
                onChange={(event) => setIndustry(event.target.value)}
                list="industry-options"
                placeholder="Free type or reuse existing"
              />
              <datalist id="industry-options">
                {industryOptions.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
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

            {source === "other" ? (
              <label className={styles.field}>
                <span className={styles.label}>Other Source Details</span>
                <input
                  type="text"
                  value={sourceOther}
                  onChange={(event) => setSourceOther(event.target.value)}
                />
              </label>
            ) : null}

            <label className={styles.field}>
              <span className={styles.label}>Parent Client</span>
              <select
                value={parentClientId}
                onChange={(event) => setParentClientId(event.target.value)}
              >
                <option value="">None</option>
                {clientOptions.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
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
              <span className={styles.label}>Website</span>
              <input
                type="url"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                placeholder="https://"
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Companies House Number</span>
              <input
                type="text"
                value={companiesHouseNumber}
                onChange={(event) => setCompaniesHouseNumber(event.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Drive Share URL</span>
              <input
                type="url"
                value={driveShareUrl}
                onChange={(event) => setDriveShareUrl(event.target.value)}
                placeholder="https://"
              />
            </label>
          </div>

          <label className={`${styles.field} ${styles.fullWidthField}`}>
            <span className={styles.label}>About</span>
            <textarea
              value={about}
              onChange={(event) => setAbout(event.target.value)}
              rows={5}
            />
          </label>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Address Information</h2>
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
          <h2 className={styles.sectionTitle}>Attachment Information</h2>
          <div className={styles.attachmentGrid}>
            <div className={styles.attachmentCard}>
              <p className={styles.attachmentTitle}>Client Contract</p>
              <p className={styles.attachmentText}>
                File upload will be enabled after storage buckets are configured.
              </p>
              <button type="button" className={styles.disabledButton} disabled>
                Upload coming soon
              </button>
            </div>

            <div className={styles.attachmentCard}>
              <p className={styles.attachmentTitle}>Other</p>
              <p className={styles.attachmentText}>
                Add supporting documents once storage setup is in place.
              </p>
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
            {isSaving ? "Saving..." : "Save Client"}
          </button>
          <Link href="/admin/clients" className={styles.cancelButton}>
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
