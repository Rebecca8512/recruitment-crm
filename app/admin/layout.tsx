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

const ADD_OPTIONS = [
  {
    id: "client",
    label: "Client",
    description: "Create a business account, including status and notes.",
  },
  {
    id: "contact",
    label: "Contact",
    description: "Add a person and link employment to a client record.",
  },
  {
    id: "role",
    label: "Role",
    description: "Open a new job requirement linked to a client.",
  },
  {
    id: "candidate",
    label: "Candidate",
    description: "Capture a candidate profile, with or without an active role.",
  },
] as const;

type ProfileRole = "admin" | "staff";
type AddOptionId = (typeof ADD_OPTIONS)[number]["id"];

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const isLoginRoute = pathname === "/admin";
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeAddOption, setActiveAddOption] = useState<AddOptionId>("client");

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

  const closeAddModal = () => {
    setIsAddModalOpen(false);
  };

  useEffect(() => {
    if (!isAddModalOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeAddModal();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isAddModalOpen]);

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
          <div className={styles.topActions}>
            <button
              className={styles.actionButton}
              onClick={() => setIsAddModalOpen(true)}
            >
              + Add
            </button>
            <button className={styles.actionButton} onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </header>

        <section className={styles.pageContent}>{children}</section>
      </div>

      {isAddModalOpen ? (
        <div
          className={styles.modalOverlay}
          role="presentation"
          onClick={closeAddModal}
        >
          <div
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            aria-label="Add CRM record"
            onClick={(event) => event.stopPropagation()}
          >
            <header className={styles.modalHeader}>
              <div>
                <p className={styles.modalEyebrow}>Create Record</p>
                <h3 className={styles.modalTitle}>What would you like to add?</h3>
              </div>
              <button className={styles.modalCloseButton} onClick={closeAddModal}>
                Close
              </button>
            </header>

            <div className={styles.modalBody}>
              <aside className={styles.modalOptionList}>
                {ADD_OPTIONS.map((option) => {
                  const isActive = option.id === activeAddOption;
                  return (
                    <button
                      key={option.id}
                      className={`${styles.modalOptionButton} ${isActive ? styles.modalOptionButtonActive : ""}`}
                      onClick={() => setActiveAddOption(option.id)}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </aside>

              <section className={styles.modalOptionPanel}>
                {ADD_OPTIONS.filter((option) => option.id === activeAddOption).map(
                  (option) => (
                    <div key={option.id}>
                      <h4 className={styles.modalPanelTitle}>
                        Add {option.label}
                      </h4>
                      <p className={styles.modalPanelText}>{option.description}</p>
                      <div className={styles.modalPlaceholder}>
                        Form for {option.label.toLowerCase()} will be built here
                        next.
                      </div>
                    </div>
                  ),
                )}
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
