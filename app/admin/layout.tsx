"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/src/lib/supabase";
import styles from "./admin-shell.module.css";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/contacts", label: "Contacts" },
  { href: "/admin/roles", label: "Roles" },
  { href: "/admin/candidates", label: "Candidates" },
];

type ProfileRole = "admin" | "staff";

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const isLoginRoute = pathname === "/admin";
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    if (isLoginRoute) {
      return;
    }

    let isMounted = true;

    const enforceAdminSession = async () => {
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

      setUserEmail(sessionData.session.user.email ?? "");
      setIsCheckingAuth(false);
    };

    void enforceAdminSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/admin");
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [isLoginRoute, router, supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/admin");
  };

  if (isLoginRoute) {
    return <>{children}</>;
  }

  if (isCheckingAuth) {
    return (
      <main className={styles.loadingWrap}>
        <p className={styles.loadingText}>Checking admin session...</p>
      </main>
    );
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <p className={styles.brandEyebrow}>Whitmore Recruitment</p>
          <h2 className={styles.brandTitle}>CRM</h2>
        </div>

        <nav className={styles.nav} aria-label="Main navigation">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <p className={styles.sidebarFooter}>
          Signed in as <span>{userEmail}</span>
        </p>
      </aside>

      <div className={styles.contentArea}>
        <header className={styles.topBar}>
          <a
            href="https://whitmorerecruitment.co.uk"
            target="_blank"
            rel="noreferrer"
            className={styles.websiteLink}
          >
            Visit main website
          </a>
          <button className={styles.signOutButton} onClick={handleSignOut}>
            Sign out
          </button>
        </header>

        <section className={styles.pageContent}>{children}</section>
      </div>
    </div>
  );
}
