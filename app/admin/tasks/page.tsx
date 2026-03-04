"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StatusFilter } from "@/src/components/filters/status-filter";
import { getSupabaseBrowserClient } from "@/src/lib/supabase";
import styles from "./tasks.module.css";

type TaskType = "general" | "client" | "contact" | "role" | "candidate";
type TaskStatus = "todo" | "done" | "cancelled";
type DateFilter = "any" | "overdue" | "today" | "next_7_days" | "next_30_days";

type TaskRow = {
  id: string;
  title: string;
  task_type: TaskType;
  task_status: TaskStatus;
  due_at: string | null;
  primary_client_id: string | null;
  primary_contact_id: string | null;
  primary_role_id: string | null;
  primary_candidate_id: string | null;
  created_at: string;
  updated_at: string;
};

type TaskNoteRow = {
  id: string;
  task_id: string;
  note_body: string;
  created_at: string;
  updated_at: string;
};

type TaskLinkRow = {
  id: string;
  task_id: string;
  client_id: string | null;
  contact_id: string | null;
  role_id: string | null;
  candidate_id: string | null;
  application_id: string | null;
};

type ClientRow = { id: string; name: string };
type ContactRow = { id: string; first_name: string; last_name: string };
type RoleRow = { id: string; title: string; client_id: string | null };
type CandidateRow = { id: string; first_name: string; last_name: string };
type ApplicationRow = {
  id: string;
  role_id: string;
  candidate_id: string;
};

type LookupOption = {
  id: string;
  label: string;
  searchText: string;
};

const TASK_TYPE_LABELS: Record<TaskType, string> = {
  general: "General",
  client: "Client",
  contact: "Contact",
  role: "Role",
  candidate: "Candidate",
};

const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  done: "Done",
  cancelled: "Cancelled",
};

function toLocalDateInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  return `${year}-${month}-${day}`;
}

function displayDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function combineDateAndTime(dateInput: string, timeInput: string) {
  if (!dateInput) return null;
  const time = timeInput || "00:00";
  const combined = new Date(`${dateInput}T${time}`);
  if (Number.isNaN(combined.getTime())) return null;
  return combined.toISOString();
}

function LookupField({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: LookupOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, []);

  const selectedOption = options.find((option) => option.id === value) ?? null;

  const visibleOptions = useMemo(() => {
    if (selectedOption) return [];

    const term = query.trim().toLowerCase();
    if (!term) return [];

    return options
      .filter((option) => option.searchText.toLowerCase().includes(term))
      .slice(0, 10);
  }, [options, query, selectedOption]);

  return (
    <label className={styles.field}>
      <span>{label}</span>
      <div className={styles.lookupRoot} ref={rootRef}>
        <input
          value={selectedOption ? selectedOption.label : query}
          onChange={(event) => {
            if (selectedOption) return;
            setQuery(event.target.value);
            setIsOpen(event.target.value.trim().length > 0);
          }}
          onFocus={() => {
            if (!selectedOption && query.trim()) {
              setIsOpen(true);
            }
          }}
          readOnly={Boolean(selectedOption)}
        />

        {selectedOption ? (
          <button
            type="button"
            className={styles.lookupClearButton}
            aria-label={`Clear ${label}`}
            onClick={() => {
              onChange("");
              setQuery("");
              setIsOpen(false);
            }}
          >
            x
          </button>
        ) : null}

        {isOpen ? (
          <div className={styles.lookupDropdown}>
            {visibleOptions.length > 0 ? (
              visibleOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={styles.lookupOption}
                  onClick={() => {
                    onChange(option.id);
                    setQuery("");
                    setIsOpen(false);
                  }}
                >
                  {option.label}
                </button>
              ))
            ) : (
              <p className={styles.lookupEmpty}>No matches found.</p>
            )}
          </div>
        ) : null}
      </div>
    </label>
  );
}

export default function TasksPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);

  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [taskNotes, setTaskNotes] = useState<TaskNoteRow[]>([]);
  const [taskLinks, setTaskLinks] = useState<TaskLinkRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteTargetTaskId, setDeleteTargetTaskId] = useState<string | null>(null);

  const [titleInput, setTitleInput] = useState("");
  const [typeInput, setTypeInput] = useState<TaskType>("general");
  const [dueDateInput, setDueDateInput] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return toLocalDateInputValue(tomorrow);
  });
  const [dueTimeInput, setDueTimeInput] = useState("");

  const [primaryClientId, setPrimaryClientId] = useState("");
  const [primaryContactId, setPrimaryContactId] = useState("");
  const [primaryRoleId, setPrimaryRoleId] = useState("");
  const [primaryCandidateId, setPrimaryCandidateId] = useState("");

  const [relatedClientId, setRelatedClientId] = useState("");
  const [relatedContactId, setRelatedContactId] = useState("");
  const [relatedRoleId, setRelatedRoleId] = useState("");
  const [relatedCandidateId, setRelatedCandidateId] = useState("");

  const [initialNoteInput, setInitialNoteInput] = useState("");
  const [newNoteInput, setNewNoteInput] = useState("");

  const [selectedStatusFilters, setSelectedStatusFilters] = useState<string[]>([
    "todo",
  ]);
  const [selectedTypeFilters, setSelectedTypeFilters] = useState<string[]>([
    "general",
    "client",
    "contact",
    "role",
    "candidate",
  ]);
  const [selectedDateFilter, setSelectedDateFilter] = useState<DateFilter>("any");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    const [
      { data: tasksData, error: tasksError },
      { data: notesData, error: notesError },
      { data: linksData, error: linksError },
      { data: clientsData, error: clientsError },
      { data: contactsData, error: contactsError },
      { data: rolesData, error: rolesError },
      { data: candidatesData, error: candidatesError },
      { data: applicationsData, error: applicationsError },
    ] = await Promise.all([
      supabase
        .from("tasks")
        .select(
          "id,title,task_type,task_status,due_at,primary_client_id,primary_contact_id,primary_role_id,primary_candidate_id,created_at,updated_at",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("task_notes")
        .select("id,task_id,note_body,created_at,updated_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("task_related_links")
        .select("id,task_id,client_id,contact_id,role_id,candidate_id,application_id"),
      supabase.from("clients").select("id,name").order("name", { ascending: true }),
      supabase
        .from("contacts")
        .select("id,first_name,last_name")
        .order("first_name", { ascending: true })
        .order("last_name", { ascending: true }),
      supabase.from("roles").select("id,title,client_id").order("title", { ascending: true }),
      supabase
        .from("candidates")
        .select("id,first_name,last_name")
        .order("first_name", { ascending: true })
        .order("last_name", { ascending: true }),
      supabase.from("applications").select("id,role_id,candidate_id"),
    ]);

    const firstError =
      tasksError ??
      notesError ??
      linksError ??
      clientsError ??
      contactsError ??
      rolesError ??
      candidatesError ??
      applicationsError;

    if (firstError) {
      setErrorMessage(
        `${firstError.message} If this references a missing or non-null due_at constraint, run supabase/task_planner_due_optional_patch.sql in Supabase SQL editor.`,
      );
      setIsLoading(false);
      return;
    }

    const loadedTasks = (tasksData ?? []) as TaskRow[];
    setTasks(loadedTasks);
    setTaskNotes((notesData ?? []) as TaskNoteRow[]);
    setTaskLinks((linksData ?? []) as TaskLinkRow[]);
    setClients((clientsData ?? []) as ClientRow[]);
    setContacts((contactsData ?? []) as ContactRow[]);
    setRoles((rolesData ?? []) as RoleRow[]);
    setCandidates((candidatesData ?? []) as CandidateRow[]);
    setApplications((applicationsData ?? []) as ApplicationRow[]);

    setSelectedTaskId((current) => {
      if (current && loadedTasks.some((task) => task.id === current)) {
        return current;
      }
      return loadedTasks[0]?.id ?? null;
    });

    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadData]);

  const clientNameById = useMemo(() => {
    return clients.reduce<Record<string, string>>((acc, client) => {
      acc[client.id] = client.name;
      return acc;
    }, {});
  }, [clients]);

  const contactNameById = useMemo(() => {
    return contacts.reduce<Record<string, string>>((acc, contact) => {
      acc[contact.id] = `${contact.first_name} ${contact.last_name}`.trim();
      return acc;
    }, {});
  }, [contacts]);

  const roleNameById = useMemo(() => {
    return roles.reduce<Record<string, string>>((acc, role) => {
      acc[role.id] = role.title;
      return acc;
    }, {});
  }, [roles]);

  const candidateNameById = useMemo(() => {
    return candidates.reduce<Record<string, string>>((acc, candidate) => {
      acc[candidate.id] = `${candidate.first_name} ${candidate.last_name}`.trim();
      return acc;
    }, {});
  }, [candidates]);

  const applicationById = useMemo(() => {
    return applications.reduce<Record<string, ApplicationRow>>((acc, row) => {
      acc[row.id] = row;
      return acc;
    }, {});
  }, [applications]);

  const applicationsByRoleId = useMemo(() => {
    return applications.reduce<Record<string, ApplicationRow[]>>((acc, row) => {
      acc[row.role_id] = acc[row.role_id] ? [...acc[row.role_id], row] : [row];
      return acc;
    }, {});
  }, [applications]);

  const notesByTaskId = useMemo(() => {
    return taskNotes.reduce<Record<string, TaskNoteRow[]>>((acc, note) => {
      acc[note.task_id] = acc[note.task_id] ? [...acc[note.task_id], note] : [note];
      return acc;
    }, {});
  }, [taskNotes]);

  const linksByTaskId = useMemo(() => {
    return taskLinks.reduce<Record<string, TaskLinkRow[]>>((acc, link) => {
      acc[link.task_id] = acc[link.task_id] ? [...acc[link.task_id], link] : [link];
      return acc;
    }, {});
  }, [taskLinks]);

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, tasks],
  );

  const selectedTaskNotes = useMemo(() => {
    if (!selectedTaskId) return [];
    return notesByTaskId[selectedTaskId] ?? [];
  }, [notesByTaskId, selectedTaskId]);

  const selectedTaskLinks = useMemo(() => {
    if (!selectedTaskId) return [];
    return linksByTaskId[selectedTaskId] ?? [];
  }, [linksByTaskId, selectedTaskId]);

  const relatedClientOptions = useMemo<LookupOption[]>(
    () =>
      clients.map((client) => ({
        id: client.id,
        label: client.name,
        searchText: `${client.name} client`,
      })),
    [clients],
  );

  const relatedContactOptions = useMemo<LookupOption[]>(
    () =>
      contacts.map((contact) => {
        const name = contactNameById[contact.id] || "";
        return {
          id: contact.id,
          label: name,
          searchText: `${name} contact`,
        };
      }),
    [contactNameById, contacts],
  );

  const relatedRoleOptions = useMemo<LookupOption[]>(
    () =>
      roles.map((role) => ({
        id: role.id,
        label: role.title,
        searchText: `${role.title} role`,
      })),
    [roles],
  );

  const relatedCandidateOptions = useMemo<LookupOption[]>(
    () =>
      candidates.map((candidate) => {
        const name = candidateNameById[candidate.id] || "";
        return {
          id: candidate.id,
          label: name,
          searchText: `${name} candidate`,
        };
      }),
    [candidateNameById, candidates],
  );

  const filteredTasks = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );
    const todayEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );
    const next7 = new Date(todayStart);
    next7.setDate(next7.getDate() + 7);
    const next30 = new Date(todayStart);
    next30.setDate(next30.getDate() + 30);

    return tasks.filter((task) => {
      if (!selectedStatusFilters.includes(task.task_status)) {
        return false;
      }

      if (!selectedTypeFilters.includes(task.task_type)) {
        return false;
      }

      if (selectedDateFilter === "any") {
        return true;
      }

      if (!task.due_at) {
        return false;
      }

      const dueDate = new Date(task.due_at);
      if (selectedDateFilter === "overdue") {
        return dueDate.getTime() < now.getTime();
      }

      if (selectedDateFilter === "today") {
        return dueDate >= todayStart && dueDate <= todayEnd;
      }

      if (selectedDateFilter === "next_7_days") {
        return dueDate >= todayStart && dueDate <= next7;
      }

      if (selectedDateFilter === "next_30_days") {
        return dueDate >= todayStart && dueDate <= next30;
      }

      return true;
    });
  }, [selectedDateFilter, selectedStatusFilters, selectedTypeFilters, tasks]);

  const setStatus = async (taskId: string, taskStatus: TaskStatus) => {
    setErrorMessage("");
    const { error } = await supabase
      .from("tasks")
      .update({ task_status: taskStatus })
      .eq("id", taskId);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    await loadData();
  };

  const deleteTask = async (taskId: string) => {
    setErrorMessage("");

    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setDeleteTargetTaskId(null);
    await loadData();
  };

  const createTask = async () => {
    if (!titleInput.trim()) {
      setErrorMessage("Task name is required.");
      return;
    }

    setIsSavingTask(true);
    setErrorMessage("");

    const dueAtIso = combineDateAndTime(dueDateInput, dueTimeInput);

    const primary = {
      client: typeInput === "client" ? primaryClientId || null : null,
      contact: typeInput === "contact" ? primaryContactId || null : null,
      role: typeInput === "role" ? primaryRoleId || null : null,
      candidate: typeInput === "candidate" ? primaryCandidateId || null : null,
    };

    const { data: insertedTask, error: taskInsertError } = await supabase
      .from("tasks")
      .insert({
        title: titleInput.trim(),
        task_type: typeInput,
        task_status: "todo",
        due_at: dueAtIso,
        primary_client_id: primary.client,
        primary_contact_id: primary.contact,
        primary_role_id: primary.role,
        primary_candidate_id: primary.candidate,
      })
      .select("id")
      .single<{ id: string }>();

    if (taskInsertError || !insertedTask) {
      setErrorMessage(taskInsertError?.message ?? "Failed to create task.");
      setIsSavingTask(false);
      return;
    }

    const roleIdForAutoLinks =
      primary.role || relatedRoleId || (typeInput === "role" ? primaryRoleId : "");

    const linkRows: Array<{
      task_id: string;
      client_id: string | null;
      contact_id: string | null;
      role_id: string | null;
      candidate_id: string | null;
      application_id: string | null;
    }> = [];
    const seen = new Set<string>();

    const addLink = (row: {
      client_id?: string | null;
      contact_id?: string | null;
      role_id?: string | null;
      candidate_id?: string | null;
      application_id?: string | null;
    }) => {
      const normalized = {
        client_id: row.client_id ?? null,
        contact_id: row.contact_id ?? null,
        role_id: row.role_id ?? null,
        candidate_id: row.candidate_id ?? null,
        application_id: row.application_id ?? null,
      };

      if (
        !normalized.client_id &&
        !normalized.contact_id &&
        !normalized.role_id &&
        !normalized.candidate_id &&
        !normalized.application_id
      ) {
        return;
      }

      const key = `${normalized.client_id}|${normalized.contact_id}|${normalized.role_id}|${normalized.candidate_id}|${normalized.application_id}`;
      if (seen.has(key)) return;

      seen.add(key);
      linkRows.push({ task_id: insertedTask.id, ...normalized });
    };

    addLink({ client_id: primary.client });
    addLink({ contact_id: primary.contact });
    addLink({ role_id: primary.role });
    addLink({ candidate_id: primary.candidate });

    addLink({ client_id: relatedClientId || null });
    addLink({ contact_id: relatedContactId || null });
    addLink({ role_id: relatedRoleId || null });
    addLink({ candidate_id: relatedCandidateId || null });

    if (typeInput === "role" && roleIdForAutoLinks) {
      for (const application of applicationsByRoleId[roleIdForAutoLinks] ?? []) {
        addLink({
          role_id: roleIdForAutoLinks,
          candidate_id: application.candidate_id,
          application_id: application.id,
        });
      }
    }

    if (typeInput === "candidate" && primaryCandidateId && (primary.role || relatedRoleId)) {
      const matchedApplication = applications.find(
        (row) =>
          row.candidate_id === primaryCandidateId &&
          row.role_id === (primary.role || relatedRoleId),
      );
      if (matchedApplication) {
        addLink({
          role_id: matchedApplication.role_id,
          candidate_id: matchedApplication.candidate_id,
          application_id: matchedApplication.id,
        });
      }
    }

    if (linkRows.length > 0) {
      const { error: linksInsertError } = await supabase
        .from("task_related_links")
        .insert(linkRows);

      if (linksInsertError) {
        setErrorMessage(linksInsertError.message);
        setIsSavingTask(false);
        return;
      }
    }

    if (initialNoteInput.trim()) {
      const { error: noteInsertError } = await supabase.from("task_notes").insert({
        task_id: insertedTask.id,
        note_body: initialNoteInput.trim(),
      });

      if (noteInsertError) {
        setErrorMessage(noteInsertError.message);
        setIsSavingTask(false);
        return;
      }
    }

    setTitleInput("");
    setTypeInput("general");
    setPrimaryClientId("");
    setPrimaryContactId("");
    setPrimaryRoleId("");
    setPrimaryCandidateId("");
    setRelatedClientId("");
    setRelatedContactId("");
    setRelatedRoleId("");
    setRelatedCandidateId("");
    setInitialNoteInput("");

    await loadData();
    setSelectedTaskId(insertedTask.id);
    setIsCreateOpen(false);
    setIsSavingTask(false);
  };

  const addTaskNote = async () => {
    if (!selectedTaskId) {
      setErrorMessage("Select a task first.");
      return;
    }

    if (!newNoteInput.trim()) {
      setErrorMessage("Enter a note before saving.");
      return;
    }

    setIsSavingNote(true);
    setErrorMessage("");

    const { error } = await supabase.from("task_notes").insert({
      task_id: selectedTaskId,
      note_body: newNoteInput.trim(),
    });

    if (error) {
      setErrorMessage(error.message);
      setIsSavingNote(false);
      return;
    }

    setNewNoteInput("");
    await loadData();
    setIsSavingNote(false);
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>CRM</p>
        <h1 className={styles.title}>Tasks</h1>
      </header>

      <div className={styles.headerControls}>
        <button
          type="button"
          className={styles.inlineTextLinkButton}
          onClick={() => setIsCreateOpen((current) => !current)}
        >
          {isCreateOpen ? "Close new task" : "Add new task"}
        </button>

        <StatusFilter
          triggerLabel="Status"
          options={[
            { value: "todo", label: "To do" },
            { value: "done", label: "Done" },
          ]}
          selectedValues={selectedStatusFilters}
          onChange={(values) => setSelectedStatusFilters(values)}
          onReset={() => setSelectedStatusFilters(["todo"])}
        />

        <StatusFilter
          triggerLabel="Type"
          options={[
            { value: "general", label: "General" },
            { value: "client", label: "Client" },
            { value: "contact", label: "Contact" },
            { value: "role", label: "Role" },
            { value: "candidate", label: "Candidate" },
          ]}
          selectedValues={selectedTypeFilters}
          onChange={(values) => setSelectedTypeFilters(values)}
          onReset={() =>
            setSelectedTypeFilters([
              "general",
              "client",
              "contact",
              "role",
              "candidate",
            ])
          }
        />

        <label className={styles.dateFilterField}>
          <span>Date</span>
          <select
            value={selectedDateFilter}
            onChange={(event) => setSelectedDateFilter(event.target.value as DateFilter)}
          >
            <option value="any">Any date</option>
            <option value="overdue">Overdue</option>
            <option value="today">Today</option>
            <option value="next_7_days">Next 7 days</option>
            <option value="next_30_days">Next 30 days</option>
          </select>
        </label>
      </div>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Task list</h2>

        {isLoading ? <p className={styles.infoText}>Loading tasks...</p> : null}
        {errorMessage ? <p className={styles.errorText}>{errorMessage}</p> : null}

        {!isLoading ? (
          <div className={styles.tableWrap}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Open</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.length > 0 ? (
                  filteredTasks.map((task) => {
                    const isSelected = selectedTaskId === task.id;
                    return (
                      <tr key={task.id} className={isSelected ? styles.selectedRow : undefined}>
                        <td>{task.title}</td>
                        <td>{displayDateTime(task.due_at)}</td>
                        <td>{TASK_TYPE_LABELS[task.task_type]}</td>
                        <td>{TASK_STATUS_LABELS[task.task_status]}</td>
                        <td>
                          <button
                            type="button"
                            className={styles.tableActionButton}
                            onClick={() => setSelectedTaskId(task.id)}
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5}>No tasks in this filter.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {isCreateOpen ? (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Add task</h2>

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Task name *</span>
              <input value={titleInput} onChange={(event) => setTitleInput(event.target.value)} />
            </label>

            <label className={styles.field}>
              <span>Date</span>
              <input
                type="date"
                value={dueDateInput}
                onChange={(event) => setDueDateInput(event.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span>Time</span>
              <input
                type="time"
                value={dueTimeInput}
                onChange={(event) => setDueTimeInput(event.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span>Task type</span>
              <select
                value={typeInput}
                onChange={(event) => setTypeInput(event.target.value as TaskType)}
              >
                <option value="general">General</option>
                <option value="client">Client</option>
                <option value="contact">Contact</option>
                <option value="role">Role</option>
                <option value="candidate">Candidate</option>
              </select>
            </label>

            {typeInput === "client" ? (
              <label className={styles.field}>
                <span>Primary client</span>
                <select
                  value={primaryClientId}
                  onChange={(event) => setPrimaryClientId(event.target.value)}
                >
                  <option value="">None</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {typeInput === "contact" ? (
              <label className={styles.field}>
                <span>Primary contact</span>
                <select
                  value={primaryContactId}
                  onChange={(event) => setPrimaryContactId(event.target.value)}
                >
                  <option value="">None</option>
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contactNameById[contact.id]}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {typeInput === "role" ? (
              <label className={styles.field}>
                <span>Primary role</span>
                <select
                  value={primaryRoleId}
                  onChange={(event) => setPrimaryRoleId(event.target.value)}
                >
                  <option value="">None</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.title}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {typeInput === "candidate" ? (
              <label className={styles.field}>
                <span>Primary candidate</span>
                <select
                  value={primaryCandidateId}
                  onChange={(event) => setPrimaryCandidateId(event.target.value)}
                >
                  <option value="">None</option>
                  {candidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidateNameById[candidate.id]}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <LookupField
              label="Related client"
              options={relatedClientOptions}
              value={relatedClientId}
              onChange={setRelatedClientId}
            />

            <LookupField
              label="Related contact"
              options={relatedContactOptions}
              value={relatedContactId}
              onChange={setRelatedContactId}
            />

            <LookupField
              label="Related role"
              options={relatedRoleOptions}
              value={relatedRoleId}
              onChange={setRelatedRoleId}
            />

            <LookupField
              label="Related candidate"
              options={relatedCandidateOptions}
              value={relatedCandidateId}
              onChange={setRelatedCandidateId}
            />
          </div>

          <label className={styles.field}>
            <span>Initial note</span>
            <textarea
              rows={3}
              value={initialNoteInput}
              onChange={(event) => setInitialNoteInput(event.target.value)}
            />
          </label>

          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={isSavingTask}
              onClick={createTask}
            >
              {isSavingTask ? "Saving..." : "Save task"}
            </button>
          </div>
        </section>
      ) : null}

      <section className={styles.card}>
        <div className={styles.detailsHeader}>
          <h2 className={styles.cardTitle}>Task details</h2>
          {selectedTask ? (
            <div className={styles.statusActions}>
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => setStatus(selectedTask.id, "todo")}
              >
                To do
              </button>
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => setStatus(selectedTask.id, "done")}
              >
                Done
              </button>
              <button
                type="button"
                className={styles.deleteLinkButton}
                onClick={() => setDeleteTargetTaskId(selectedTask.id)}
              >
                Delete
              </button>
            </div>
          ) : null}
        </div>

        {selectedTask ? (
          <div className={styles.detailsGrid}>
            <div>
              <p className={styles.metaLabel}>Task</p>
              <p className={styles.metaValue}>{selectedTask.title}</p>
            </div>
            <div>
              <p className={styles.metaLabel}>Date</p>
              <p className={styles.metaValue}>{displayDateTime(selectedTask.due_at)}</p>
            </div>
            <div>
              <p className={styles.metaLabel}>Type</p>
              <p className={styles.metaValue}>{TASK_TYPE_LABELS[selectedTask.task_type]}</p>
            </div>
            <div>
              <p className={styles.metaLabel}>Status</p>
              <p className={styles.metaValue}>{TASK_STATUS_LABELS[selectedTask.task_status]}</p>
            </div>
          </div>
        ) : (
          <p className={styles.infoText}>Select a task from the list.</p>
        )}

        {selectedTask ? (
          <div className={styles.relatedWrap}>
            <p className={styles.metaLabel}>Related records</p>
            {selectedTaskLinks.length > 0 ? (
              <ul className={styles.linkList}>
                {selectedTaskLinks.map((link) => {
                  const application =
                    link.application_id && applicationById[link.application_id]
                      ? applicationById[link.application_id]
                      : null;
                  const clientId = link.client_id || null;
                  const contactId = link.contact_id || null;
                  const roleId = link.role_id || application?.role_id || null;
                  const candidateId =
                    link.candidate_id || application?.candidate_id || null;

                  return (
                    <li key={link.id}>
                      {clientId ? (
                        <Link href={`/admin/clients/${clientId}`} className={styles.entityLink}>
                          Client: {clientNameById[clientId] ?? "Unknown"}
                        </Link>
                      ) : null}
                      {contactId ? (
                        <Link
                          href={`/admin/contacts/${contactId}`}
                          className={styles.entityLink}
                        >
                          Contact: {contactNameById[contactId] ?? "Unknown"}
                        </Link>
                      ) : null}
                      {roleId ? (
                        <Link href={`/admin/roles/${roleId}`} className={styles.entityLink}>
                          Role: {roleNameById[roleId] ?? "Unknown"}
                        </Link>
                      ) : null}
                      {candidateId ? (
                        <Link
                          href={`/admin/candidates/${candidateId}`}
                          className={styles.entityLink}
                        >
                          Candidate: {candidateNameById[candidateId] ?? "Unknown"}
                        </Link>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className={styles.infoText}>No related records linked yet.</p>
            )}
          </div>
        ) : null}

        {selectedTask ? (
          <div className={styles.notesWrap}>
            <p className={styles.metaLabel}>Notes</p>

            <label className={styles.field}>
              <textarea
                rows={3}
                value={newNoteInput}
                onChange={(event) => setNewNoteInput(event.target.value)}
                placeholder="Add communication or task progress note"
              />
            </label>

            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.primaryButton}
                disabled={isSavingNote}
                onClick={addTaskNote}
              >
                {isSavingNote ? "Saving..." : "Add note"}
              </button>
            </div>

            {selectedTaskNotes.length > 0 ? (
              <ul className={styles.noteList}>
                {selectedTaskNotes.map((note) => (
                  <li key={note.id}>
                    <p className={styles.noteDate}>{displayDateTime(note.created_at)}</p>
                    <p className={styles.noteBody}>{note.note_body}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.infoText}>No notes yet.</p>
            )}
          </div>
        ) : null}
      </section>

      {deleteTargetTaskId ? (
        <div
          className={styles.modalOverlay}
          role="presentation"
          onClick={() => setDeleteTargetTaskId(null)}
        >
          <div
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            aria-label="Delete task"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className={styles.modalTitle}>Delete task?</h3>
            <p className={styles.modalText}>This will permanently remove the task and its notes.</p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalButton}
                onClick={() => setDeleteTargetTaskId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.modalDeleteButton}
                onClick={() => void deleteTask(deleteTargetTaskId)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
