"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/src/lib/supabase";
import styles from "../../new/new-client.module.css";

const SOURCE_OPTIONS = [
  { value: "referral", label: "Referral" },
  { value: "cold_outreach", label: "Cold outreach" },
  { value: "inbound_lead", label: "Inbound lead" },
  { value: "social_media", label: "Social media" },
  { value: "networking", label: "Networking" },
  { value: "paid_ads", label: "Paid ads" },
  { value: "other", label: "Other" },
] as const;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ClientSummary = {
  id: string;
  name: string;
  industry: string | null;
};

type StatusOption = {
  code: string;
  label: string;
  sort_order: number;
};

type ClientDetails = {
  id: string;
  name: string;
  contact_number: string | null;
  account_manager_id: string | null;
  industry: string | null;
  about: string | null;
  source: string | null;
  source_other: string | null;
  status_code: string | null;
  parent_client_id: string | null;
  email: string | null;
  website: string | null;
  companies_house_number: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  county: string | null;
  postcode: string | null;
};

type UserProfile = {
  full_name: string | null;
  email: string | null;
};

export default function EditClientPage() {
  const params = useParams<{ id?: string }>();
  const clientId = Array.isArray(params.id) ? params.id[0] : params.id;
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
  const [statusOptions, setStatusOptions] = useState<StatusOption[]>([]);

  const [clientName, setClientName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [industry, setIndustry] = useState("");
  const [about, setAbout] = useState("");
  const [statusCode, setStatusCode] = useState("prospect");
  const [source, setSource] = useState<string>("referral");
  const [sourceOther, setSourceOther] = useState("");
  const [parentClientId, setParentClientId] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [companiesHouseNumber, setCompaniesHouseNumber] = useState("");

  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [county, setCounty] = useState("");
  const [postcode, setPostcode] = useState("");

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!clientId || !UUID_PATTERN.test(clientId)) {
        setErrorMessage("Invalid client id.");
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

      const [{ data: clientData, error: clientError }, { data: clientsData, error: clientsError }, { data: statusesData, error: statusesError }] =
        await Promise.all([
          supabase
            .from("clients")
            .select(
              "id,name,contact_number,account_manager_id,industry,about,source,source_other,status_code,parent_client_id,email,website,companies_house_number,address_line_1,address_line_2,city,county,postcode",
            )
            .eq("id", clientId)
            .maybeSingle<ClientDetails>(),
          supabase.from("clients").select("id,name,industry").order("name", { ascending: true }),
          supabase
            .from("client_statuses")
            .select("code,label,sort_order")
            .order("sort_order", { ascending: true }),
        ]);

      if (!isMounted) return;

      if (clientError) {
        setErrorMessage(clientError.message);
        setIsLoading(false);
        return;
      }

      if (!clientData) {
        setErrorMessage("Client not found.");
        setIsLoading(false);
        return;
      }

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

      const rows = (clientsData ?? []) as ClientSummary[];
      const industries = Array.from(
        new Set(
          rows
            .map((client) => (client.industry ?? "").trim())
            .filter((value) => value.length > 0),
        ),
      ).sort((a, b) => a.localeCompare(b));

      const managerId = clientData.account_manager_id ?? sessionData.session.user.id;
      const { data: managerProfile } = await supabase
        .from("profiles")
        .select("full_name,email")
        .eq("id", managerId)
        .maybeSingle<UserProfile>();

      const managerLabel =
        managerProfile?.full_name?.trim() ||
        managerProfile?.email ||
        sessionData.session.user.email ||
        "Current user";

      setAccountManagerId(managerId);
      setAccountManagerLabel(managerLabel);

      setClientOptions(rows.filter((row) => row.id !== clientId));
      setIndustryOptions(industries);
      setStatusOptions((statusesData ?? []) as StatusOption[]);

      setClientName(clientData.name);
      setContactNumber(clientData.contact_number ?? "");
      setIndustry(clientData.industry ?? "");
      setAbout(clientData.about ?? "");
      setStatusCode(clientData.status_code ?? "prospect");
      setSource(clientData.source ?? "referral");
      setSourceOther(clientData.source_other ?? "");
      setParentClientId(clientData.parent_client_id ?? "");
      setEmail(clientData.email ?? "");
      setWebsite(clientData.website ?? "");
      setCompaniesHouseNumber(clientData.companies_house_number ?? "");
      setAddressLine1(clientData.address_line_1 ?? "");
      setAddressLine2(clientData.address_line_2 ?? "");
      setCity(clientData.city ?? "");
      setCounty(clientData.county ?? "");
      setPostcode(clientData.postcode ?? "");

      setIsLoading(false);
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [clientId, router, supabase]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!clientId || !UUID_PATTERN.test(clientId)) {
      setErrorMessage("Invalid client id.");
      return;
    }

    if (!clientName.trim()) {
      setErrorMessage("Client name is required.");
      return;
    }

    if (!accountManagerId) {
      setErrorMessage("Unable to identify the account manager.");
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
      status_code: statusCode || "prospect",
      source,
      source_other: source === "other" ? sourceOther.trim() || null : null,
      parent_client_id: parentClientId || null,
      email: email.trim() || null,
      website: website.trim() || null,
      companies_house_number: companiesHouseNumber.trim() || null,
      address_line_1: addressLine1.trim() || null,
      address_line_2: addressLine2.trim() || null,
      city: city.trim() || null,
      county: county.trim() || null,
      postcode: postcode.trim() || null,
    };

    const { error } = await supabase.from("clients").update(payload).eq("id", clientId);

    if (error) {
      setErrorMessage(error.message);
      setIsSaving(false);
      return;
    }

    setSuccessMessage("Client updated successfully.");
    setTimeout(() => {
      router.push(`/admin/clients/${clientId}`);
    }, 500);
  };

  if (isLoading) {
    return (
      <main className={styles.loadingWrap}>
        <p className={styles.loadingText}>Loading client details...</p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>CRM</p>
          <h1 className={styles.title}>Edit Client</h1>
          <p className={styles.lead}>
            Update client details, status, and contact information.
          </p>
        </div>
        <Link href={`/admin/clients/${clientId ?? ""}`} className={styles.cancelLink}>
          Back to Profile
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
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Account Manager</span>
              <input type="text" value={accountManagerLabel} readOnly />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Status</span>
              <select
                value={statusCode}
                onChange={(event) => setStatusCode(event.target.value)}
              >
                {statusOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
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
                list="industry-options"
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

        {errorMessage ? <p className={styles.errorMessage}>{errorMessage}</p> : null}
        {successMessage ? (
          <p className={styles.successMessage}>{successMessage}</p>
        ) : null}

        <div className={styles.actions}>
          <button type="submit" className={styles.submitButton} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
          <Link href={`/admin/clients/${clientId ?? ""}`} className={styles.cancelButton}>
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
