"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/src/lib/supabase";
import styles from "./login.module.css";

type ProfileRole = "admin" | "staff";

export default function AdminLoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (!isMounted) return;

      if (error) {
        setErrorMessage(error.message);
        setIsCheckingSession(false);
        return;
      }

      if (data.session) {
        router.replace("/admin/dashboard");
        return;
      }

      setIsCheckingSession(false);
    };

    void checkSession();

    return () => {
      isMounted = false;
    };
  }, [router, supabase]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setErrorMessage("");
    setIsSubmitting(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error || !data.user) {
      setErrorMessage(error?.message ?? "Unable to sign in.");
      setIsSubmitting(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle<{ role: ProfileRole }>();

    if (profileError) {
      await supabase.auth.signOut();
      setErrorMessage(
        "Signed in, but profile lookup failed. Check your profiles table and RLS setup.",
      );
      setIsSubmitting(false);
      return;
    }

    if (!profile || profile.role !== "admin") {
      await supabase.auth.signOut();
      setErrorMessage("This account is not allowed to access the admin area.");
      setIsSubmitting(false);
      return;
    }

    router.replace("/admin/dashboard");
  };

  return (
    <main className={styles.page}>
      <section className={styles.brandPanel}>
        <p className={styles.eyebrow}>Whitmore Recruitment</p>
        <h1 className={styles.title}>Admin Console</h1>
        <p className={styles.subtitle}>
          Secure access for operations, candidate pipelines, and client records.
        </p>
        <a
          href="https://whitmorerecruitment.co.uk"
          target="_blank"
          rel="noreferrer"
          className={styles.websiteLink}
        >
          Visit main website
        </a>
      </section>

      <section className={styles.formPanel}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Sign in</h2>
          <p className={styles.cardSubtitle}>
            Use your admin email and password. Registration is disabled on this
            screen.
          </p>

          <form onSubmit={handleSubmit} className={styles.form}>
            <label className={styles.label} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className={styles.input}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={isSubmitting || isCheckingSession}
            />

            <label className={styles.label} htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className={styles.input}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              disabled={isSubmitting || isCheckingSession}
            />

            {errorMessage ? (
              <p className={styles.errorMessage} role="alert">
                {errorMessage}
              </p>
            ) : null}

            <button
              type="submit"
              className={styles.submitButton}
              disabled={isSubmitting || isCheckingSession}
            >
              {isCheckingSession
                ? "Checking session..."
                : isSubmitting
                  ? "Signing in..."
                  : "Continue to dashboard"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
