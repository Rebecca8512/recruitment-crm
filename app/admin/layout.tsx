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
    isReady: true,
  },
  {
    id: "contact",
    label: "Contact",
    description: "Add a person and link employment to a client record.",
    isReady: true,
  },
  {
    id: "role",
    label: "Role",
    description: "Open a new job requirement linked to a client.",
    isReady: false,
  },
  {
    id: "candidate",
    label: "Candidate",
    description: "Capture a candidate profile, with or without an active role.",
    isReady: true,
  },
] as const;

type ProfileRole = "admin" | "staff";
type AddOptionId = (typeof ADD_OPTIONS)[number]["id"];

const ADD_ROUTES: Partial<Record<AddOptionId, string>> = {
  client: "/admin/clients/new",
  contact: "/admin/contacts/new",
  candidate: "/admin/candidates/new",
};

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
  const [comingSoonOption, setComingSoonOption] = useState<AddOptionId | null>(
    null,
  );

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
    setComingSoonOption(null);
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
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
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
              onClick={() => {
                setComingSoonOption(null);
                setIsAddModalOpen(true);
              }}
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
              <div className={styles.modalOptionGrid}>
                {ADD_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    className={styles.modalOptionCard}
                    onClick={() => {
                      const route = ADD_ROUTES[option.id];
                      if (route) {
                        closeAddModal();
                        router.push(route);
                        return;
                      }
                      setComingSoonOption(option.id);
                    }}
                  >
                    <p className={styles.modalOptionTitle}>{option.label}</p>
                    <p className={styles.modalOptionDescription}>
                      {option.description}
                    </p>
                    <p className={styles.modalOptionMeta}>
                      {option.isReady ? "Open form" : "Coming next"}
                    </p>
                  </button>
                ))}
              </div>

              <section className={styles.modalOptionPanel}>
                {comingSoonOption ? (
                  <div>
                    <h4 className={styles.modalPanelTitle}>
                      {ADD_OPTIONS.find((item) => item.id === comingSoonOption)
                        ?.label ?? "Record"}{" "}
                      form
                    </h4>
                    <p className={styles.modalPanelText}>
                      This form will be added next.
                    </p>
                    <div className={styles.modalPlaceholder}>
                      Choose an available record type above to open its page.
                    </div>
                  </div>
                ) : (
                  <div>
                    <h4 className={styles.modalPanelTitle}>Add new record</h4>
                    <p className={styles.modalPanelText}>
                      Select a record type above to continue.
                    </p>
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
