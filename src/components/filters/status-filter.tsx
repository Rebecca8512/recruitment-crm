"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./status-filter.module.css";

export type StatusFilterOption = {
  value: string;
  label: string;
};

type StatusFilterProps = {
  options: StatusFilterOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  onReset: () => void;
};

export function StatusFilter({
  options,
  selectedValues,
  onChange,
  onReset,
}: StatusFilterProps) {
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

  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={`${styles.trigger} ${isOpen ? styles.triggerOpen : ""}`}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span>Filter</span>
        <span className={styles.triggerCount}>{selectedValues.length}</span>
      </button>

      {isOpen ? (
        <div className={styles.dropdown}>
          <div className={styles.optionList}>
            {options.map((option) => (
              <label key={option.value} className={styles.optionRow}>
                <input
                  type="checkbox"
                  checked={selectedSet.has(option.value)}
                  onChange={(event) => {
                    if (event.target.checked) {
                      onChange([...selectedValues, option.value]);
                      return;
                    }
                    onChange(selectedValues.filter((value) => value !== option.value));
                  }}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>

          <button type="button" className={styles.resetButton} onClick={onReset}>
            Reset
          </button>
        </div>
      ) : null}
    </div>
  );
}
