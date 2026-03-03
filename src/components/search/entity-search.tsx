"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./entity-search.module.css";

export type EntitySearchKind = "client" | "contact" | "role" | "candidate";

export type EntitySearchOption = {
  key: string;
  entityId: string;
  entityType: EntitySearchKind;
  label: string;
  subtitle?: string;
  searchText: string;
};

type EntitySearchProps = {
  options: EntitySearchOption[];
  selected: EntitySearchOption | null;
  onSelect: (option: EntitySearchOption) => void;
  onClear: () => void;
  placeholder?: string;
};

const ENTITY_LABELS: Record<EntitySearchKind, string> = {
  client: "Client",
  contact: "Contact",
  role: "Role",
  candidate: "Candidate",
};

export function EntitySearch({
  options,
  selected,
  onSelect,
  onClear,
  placeholder = "Search",
}: EntitySearchProps) {
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

  const filteredOptions = useMemo(() => {
    if (selected) return [];

    const term = query.trim().toLowerCase();
    if (!term) return [];

    const matches = options.filter((option) =>
      option.searchText.toLowerCase().includes(term),
    );

    return matches.slice(0, 12);
  }, [options, query, selected]);

  return (
    <div className={styles.root} ref={rootRef}>
      <div className={styles.inputWrap}>
        <span className={styles.icon} aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path
              d="M10.5 3a7.5 7.5 0 0 1 5.96 12.06l4.24 4.24-1.4 1.4-4.24-4.24A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z"
              fill="currentColor"
            />
          </svg>
        </span>

        <input
          type="text"
          value={selected ? selected.label : query}
          placeholder={placeholder}
          className={styles.input}
          onFocus={() => {
            if (!selected && query.trim()) setIsOpen(true);
          }}
          onChange={(event) => {
            if (selected) return;
            setQuery(event.target.value);
            setIsOpen(event.target.value.trim().length > 0);
          }}
          readOnly={Boolean(selected)}
        />

        {selected ? (
          <button
            type="button"
            className={styles.clearButton}
            aria-label="Clear search"
            onClick={() => {
              onClear();
              setQuery("");
              setIsOpen(false);
            }}
          >
            x
          </button>
        ) : null}
      </div>

      {isOpen ? (
        <div className={styles.dropdown}>
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                className={styles.option}
                onClick={() => {
                  onSelect(option);
                  setIsOpen(false);
                }}
              >
                <div className={styles.optionMain}>
                  <span>{option.label}</span>
                  <span className={styles.optionType}>
                    {ENTITY_LABELS[option.entityType]}
                  </span>
                </div>
                {option.subtitle ? (
                  <p className={styles.optionSubtitle}>{option.subtitle}</p>
                ) : null}
              </button>
            ))
          ) : (
            <p className={styles.empty}>No matches found.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
