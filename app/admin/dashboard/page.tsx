"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/src/lib/supabase";
import styles from "./dashboard.module.css";

type ProfileRole = "admin" | "staff";

export default function DashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [email, setEmail] = useState("");

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

      const userId = sessionData.session.user.id;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle<{ role: ProfileRole }>();

      if (profileError || !profile || profile.role !== "admin") {
        await supabase.auth.signOut();
        router.replace("/admin");
        return;
      }

      setEmail(sessionData.session.user.email ?? "");
      setIsLoading(false);
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [router, supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/admin");
  };

  if (isLoading) {
    return (
      <main className={styles.loadingWrap}>
        <p className={styles.loadingText}>Loading admin dashboard...</p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Whitmore Recruitment</p>
          <h1 className={styles.title}>Admin Dashboard</h1>
        </div>
        <button className={styles.signOutButton} onClick={handleSignOut}>
          Sign out
        </button>
      </header>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Welcome</h2>
        <p className={styles.cardText}>
          Signed in as <strong>{email}</strong>.
        </p>
        <p className={styles.cardText}>
          Your Supabase role check is active. Any non-admin account is redirected
          automatically.
        </p>
      </section>
    </main>
  );
}
