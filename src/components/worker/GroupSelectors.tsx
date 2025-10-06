import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, Users, X } from "lucide-react";
import { Worker } from "../../types/salary";

export interface WorkerGroupOption {
  id: string;
  label: string;
  description?: string;
  memberCount: number;
}

export interface WorkerSearchSelectProps {
  workers: Worker[];
  selectedWorkerIds: string[];
  onSelectionChange: (workerIds: string[]) => void;
  placeholder?: string;
  label?: string;
  multiSelect?: boolean;
}

export const WorkerSearchSelect: React.FC<WorkerSearchSelectProps> = ({
  workers,
  selectedWorkerIds,
  onSelectionChange,
  placeholder = "Buscar trabajador...",
  label = "Trabajador",
  multiSelect = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const workersById = useMemo(() => {
    const map = new Map<string, Worker>();
    workers.forEach((worker) => {
      map.set(worker.id, worker);
    });
    return map;
  }, [workers]);

  const selectedSet = useMemo(
    () => new Set<string>(selectedWorkerIds),
    [selectedWorkerIds]
  );

  const selectedWorkers = useMemo(
    () =>
      selectedWorkerIds
        .map((id) => workersById.get(id))
        .filter((worker): worker is Worker => Boolean(worker)),
    [selectedWorkerIds, workersById]
  );

  const filteredWorkers = useMemo(() => {
    const query = searchQuery.toLowerCase();
    const filtered = workers.filter((worker) => {
      if (!query) {
        return true;
      }

      return (
        worker.name.toLowerCase().includes(query) ||
        worker.email.toLowerCase().includes(query) ||
        (worker.phone && worker.phone.toLowerCase().includes(query)) ||
        (worker.department &&
          worker.department.toLowerCase().includes(query)) ||
        (worker.position && worker.position.toLowerCase().includes(query)) ||
        (worker.companyNames &&
          worker.companyNames.some((company) =>
            company.toLowerCase().includes(query)
          ))
      );
    });

    return filtered.sort((a, b) =>
      a.name.localeCompare(b.name, "es", { sensitivity: "base" })
    );
  }, [searchQuery, workers]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery("");
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, filteredWorkers.length);
  }, [filteredWorkers.length]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (!filteredWorkers.length) {
      setHighlightedIndex(-1);
      return;
    }

    if (highlightedIndex === -1) {
      setHighlightedIndex(0);
    } else if (highlightedIndex >= filteredWorkers.length) {
      setHighlightedIndex(filteredWorkers.length - 1);
    }
  }, [filteredWorkers, highlightedIndex, isOpen]);

  useEffect(() => {
    if (highlightedIndex >= 0) {
      itemRefs.current[highlightedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  const handleWorkerToggle = useCallback(
    (worker: Worker) => {
      if (multiSelect) {
        const isSelected = selectedSet.has(worker.id);
        const updated = isSelected
          ? selectedWorkerIds.filter((id) => id !== worker.id)
          : [...selectedWorkerIds, worker.id];
        setSearchQuery("");
        onSelectionChange(updated);
        setIsOpen(true);
        setHighlightedIndex(-1);
      } else {
        onSelectionChange([worker.id]);
        setSearchQuery("");
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    },
    [multiSelect, onSelectionChange, selectedSet, selectedWorkerIds]
  );

  const handleRemoveSelected = useCallback(
    (workerId: string) => {
      if (!selectedWorkerIds.length) {
        return;
      }

      if (multiSelect) {
        const updated = selectedWorkerIds.filter((id) => id !== workerId);
        onSelectionChange(updated);
      } else {
        onSelectionChange([]);
      }

      setSearchQuery("");
      setHighlightedIndex(-1);
    },
    [multiSelect, onSelectionChange, selectedWorkerIds]
  );

  const handleClear = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      setSearchQuery("");
      onSelectionChange([]);
      if (!multiSelect) {
        setIsOpen(false);
      }
      setHighlightedIndex(-1);
    },
    [multiSelect, onSelectionChange]
  );

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setSearchQuery(value);
      if (!isOpen) {
        setIsOpen(true);
      }
      setHighlightedIndex(-1);
    },
    [isOpen]
  );

  const handleInputFocus = useCallback(() => {
    setIsOpen(true);
    if (filteredWorkers.length > 0 && highlightedIndex === -1) {
      setHighlightedIndex(0);
    }
  }, [filteredWorkers.length, highlightedIndex]);

  const handleInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Backspace" && searchQuery.trim() === "") {
        if (!selectedWorkerIds.length) {
          return;
        }

        const lastSelected = selectedWorkerIds[selectedWorkerIds.length - 1];
        event.preventDefault();
        handleRemoveSelected(lastSelected);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        setHighlightedIndex(-1);
        setSearchQuery("");
        return;
      }

      if (!isOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        setIsOpen(true);
        return;
      }

      if (!filteredWorkers.length) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlightedIndex((prev) => {
          const nextIndex = prev + 1;
          if (nextIndex >= filteredWorkers.length || prev === -1) {
            return 0;
          }
          return nextIndex;
        });
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlightedIndex((prev) => {
          if (prev <= 0) {
            return filteredWorkers.length - 1;
          }
          return prev - 1;
        });
      } else if (event.key === "Enter") {
        if (highlightedIndex >= 0 && highlightedIndex < filteredWorkers.length) {
          event.preventDefault();
          handleWorkerToggle(filteredWorkers[highlightedIndex]);
        }
      }
    },
    [
      filteredWorkers,
      handleRemoveSelected,
      handleWorkerToggle,
      highlightedIndex,
      isOpen,
      searchQuery,
      selectedWorkerIds,
    ]
  );

  const hasSelection = selectedWorkers.length > 0;

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>

      <div
        className={`
          min-h-[42px] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600
          rounded-md flex items-center
          hover:border-gray-400 dark:hover:border-gray-500
          ${isOpen ? "border-blue-500 ring-1 ring-blue-500" : ""}
        `}
      >
        <div className="flex flex-1 flex-wrap items-center gap-2 px-3 py-2">
          <Search size={18} className="text-gray-400" />
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {selectedWorkers.map((worker) => (
              <span
                key={worker.id}
                className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-1 text-sm text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
              >
                {worker.name}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleRemoveSelected(worker.id);
                  }}
                  className="rounded p-0.5 transition hover:bg-blue-200 hover:text-blue-700 dark:hover:bg-blue-800/60"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            <input
              type="text"
              value={searchQuery}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              onClick={() => setIsOpen(true)}
              onKeyDown={handleInputKeyDown}
              placeholder={hasSelection ? "" : placeholder}
              className="flex-1 min-w-[140px] bg-transparent text-gray-900 placeholder:text-gray-500 focus:outline-none dark:text-white dark:placeholder:text-gray-400"
            />
          </div>
        </div>
        <div className="flex items-center space-x-1 pr-2">
          {(hasSelection || searchQuery) && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <X size={14} className="text-gray-400" />
            </button>
          )}
          <button
            type="button"
            className="p-1"
            onClick={() => setIsOpen((prev) => !prev)}
          >
            <ChevronDown
              size={16}
              className={`text-gray-400 transition-transform duration-200 ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-hidden">
          <div className="max-h-48 overflow-y-auto">
            {filteredWorkers.length === 0 ? (
              <div className="px-3 py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                {searchQuery
                  ? `No se encontraron trabajadores con "${searchQuery}"`
                  : "Escribe para buscar trabajadores"}
              </div>
            ) : (
              <>
                <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700">
                  {searchQuery
                    ? `${filteredWorkers.length} de ${workers.length} trabajadores`
                    : `${workers.length} trabajadores disponibles`}
                </div>

                {filteredWorkers.map((worker, index) => {
                  const isHighlighted = highlightedIndex === index;
                  const isSelected = selectedSet.has(worker.id);
                  const baseClasses = `px-3 py-3 cursor-pointer flex items-center justify-between border-b border-gray-100 dark:border-gray-700 last:border-b-0 hover:bg-gray-100 dark:hover:bg-gray-700`;
                  const highlightClass = isSelected
                    ? "bg-blue-50 dark:bg-blue-900/20"
                    : isHighlighted
                    ? "bg-gray-100 dark:bg-gray-700"
                    : "";

                  return (
                    <div
                      key={`${worker.id}-${index}`}
                      ref={(el) => {
                        itemRefs.current[index] = el;
                      }}
                      className={`${baseClasses} ${highlightClass}`}
                      onClick={() => handleWorkerToggle(worker)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                    >
                      <div className="flex-1 min-w-0 pr-3">
                        <button
                          type="button"
                          onDoubleClick={(event) => {
                            event.stopPropagation();
                            if (typeof window !== "undefined") {
                              const detailEvent = new CustomEvent(
                                "worker-info-modal",
                                {
                                  detail: {
                                    workerId: worker.id,
                                    workerName: worker.name,
                                  },
                                }
                              );
                              window.dispatchEvent(detailEvent);
                            }
                          }}
                          className={`w-full text-left text-sm font-medium truncate transition ${
                            isSelected
                              ? "text-blue-700 hover:text-blue-600 dark:text-blue-300"
                              : "text-gray-900 hover:text-blue-700 dark:text-white"
                          }`}
                          title="Doble clic para ver detalles del trabajador"
                        >
                          {worker.name}
                        </button>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {worker.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <Users size={14} className="text-gray-400 dark:text-gray-500" />
                        <span>{worker.companyNames?.length ?? 0}</span>
                      </div>
                      {isSelected && (
                        <Check
                          size={16}
                          className="text-blue-600 dark:text-blue-400 ml-2"
                        />
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export interface GroupSearchSelectProps {
  groups: WorkerGroupOption[];
  selectedGroupIds: string[];
  onSelectionChange: (groupIds: string[]) => void;
  placeholder?: string;
  clearOptionId?: string;
  multiSelect?: boolean;
}

export const GroupSearchSelect: React.FC<GroupSearchSelectProps> = ({
  groups,
  selectedGroupIds,
  onSelectionChange,
  placeholder = "Buscar grupo...",
  clearOptionId = "all",
  multiSelect = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const groupsById = useMemo(() => {
    const map = new Map<string, WorkerGroupOption>();
    groups.forEach((group) => {
      map.set(group.id, group);
    });
    return map;
  }, [groups]);

  const normalizedSelection = useMemo(() => {
    if (!multiSelect) {
      return selectedGroupIds.slice(0, 1);
    }

    if (selectedGroupIds.length === 0) {
      return clearOptionId ? [clearOptionId] : [];
    }

    if (
      clearOptionId &&
      selectedGroupIds.includes(clearOptionId) &&
      selectedGroupIds.length > 1
    ) {
      return selectedGroupIds.filter((id) => id !== clearOptionId);
    }

    return selectedGroupIds;
  }, [clearOptionId, multiSelect, selectedGroupIds]);

  const selectedSet = useMemo(
    () => new Set<string>(normalizedSelection),
    [normalizedSelection]
  );

  const selectedGroups = useMemo(
    () =>
      normalizedSelection
        .map((id) => groupsById.get(id))
        .filter((group): group is WorkerGroupOption => Boolean(group)),
    [groupsById, normalizedSelection]
  );

  const filteredGroups = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filtered = groups.filter((group) => {
      if (!normalizedQuery) {
        return true;
      }

      const labelMatch = group.label.toLowerCase().includes(normalizedQuery);
      const descriptionMatch = group.description
        ?.toLowerCase()
        .includes(normalizedQuery);
      return labelMatch || descriptionMatch;
    });

    return filtered.sort((a, b) => {
      if (clearOptionId) {
        if (a.id === clearOptionId) {
          return -1;
        }
        if (b.id === clearOptionId) {
          return 1;
        }
      }

      return a.label.localeCompare(b.label, "es", { sensitivity: "base" });
    });
  }, [clearOptionId, groups, searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery("");
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, filteredGroups.length);
  }, [filteredGroups.length]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (!filteredGroups.length) {
      setHighlightedIndex(-1);
      return;
    }

    if (highlightedIndex === -1) {
      setHighlightedIndex(0);
    } else if (highlightedIndex >= filteredGroups.length) {
      setHighlightedIndex(filteredGroups.length - 1);
    }
  }, [filteredGroups, highlightedIndex, isOpen]);

  useEffect(() => {
    if (highlightedIndex >= 0) {
      itemRefs.current[highlightedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  const handleSelectionChange = useCallback(
    (group: WorkerGroupOption) => {
      if (multiSelect) {
        if (group.id === clearOptionId) {
          onSelectionChange(clearOptionId ? [clearOptionId] : []);
          setSearchQuery("");
          setHighlightedIndex(-1);
          setIsOpen(false);
          return;
        }

        const current = new Set<string>(
          normalizedSelection.filter((id) => id !== clearOptionId)
        );

        if (current.has(group.id)) {
          current.delete(group.id);
        } else {
          current.add(group.id);
        }

        const updated = Array.from(current);
        if (!updated.length && clearOptionId) {
          updated.push(clearOptionId);
        }

        onSelectionChange(updated);
        setSearchQuery("");
        setIsOpen(true);
        setHighlightedIndex(-1);
      } else {
        onSelectionChange([group.id]);
        setSearchQuery("");
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    },
    [clearOptionId, multiSelect, normalizedSelection, onSelectionChange]
  );

  const handleClear = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      setSearchQuery("");
      if (multiSelect && clearOptionId) {
        onSelectionChange([clearOptionId]);
      } else {
        onSelectionChange([]);
      }
      if (!multiSelect) {
        setIsOpen(false);
      }
      setHighlightedIndex(-1);
    },
    [clearOptionId, multiSelect, onSelectionChange]
  );

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setSearchQuery(value);
      if (!isOpen) {
        setIsOpen(true);
      }
      setHighlightedIndex(-1);
    },
    [isOpen]
  );

  const handleRemoveSelected = useCallback(
    (groupId: string) => {
      if (multiSelect) {
        if (groupId === clearOptionId) {
          onSelectionChange([]);
        } else {
          const current = normalizedSelection.filter((id) => id !== groupId);
          if (!current.length && clearOptionId) {
            onSelectionChange([clearOptionId]);
          } else {
            onSelectionChange(current);
          }
        }
      } else if (clearOptionId) {
        onSelectionChange([clearOptionId]);
      } else {
        onSelectionChange([]);
      }
      setSearchQuery("");
      setHighlightedIndex(-1);
    },
    [clearOptionId, multiSelect, normalizedSelection, onSelectionChange]
  );

  const handleInputFocus = useCallback(() => {
    setIsOpen(true);
    if (filteredGroups.length > 0 && highlightedIndex === -1) {
      setHighlightedIndex(0);
    }
  }, [filteredGroups.length, highlightedIndex]);

  const handleInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Backspace" && searchQuery.trim() === "") {
        if (!normalizedSelection.length) {
          return;
        }

        const lastSelected = normalizedSelection[normalizedSelection.length - 1];
        if (lastSelected === clearOptionId && normalizedSelection.length === 1) {
          return;
        }

        event.preventDefault();
        handleRemoveSelected(lastSelected);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        setSearchQuery("");
        setHighlightedIndex(-1);
        return;
      }

      if (!isOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        setIsOpen(true);
        return;
      }

      if (!filteredGroups.length) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlightedIndex((prev) => {
          const nextIndex = prev + 1;
          if (nextIndex >= filteredGroups.length || prev === -1) {
            return 0;
          }
          return nextIndex;
        });
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlightedIndex((prev) => {
          if (prev <= 0) {
            return filteredGroups.length - 1;
          }
          return prev - 1;
        });
      } else if (event.key === "Enter") {
        if (highlightedIndex >= 0 && highlightedIndex < filteredGroups.length) {
          event.preventDefault();
          handleSelectionChange(filteredGroups[highlightedIndex]);
        }
      }
    },
    [
      clearOptionId,
      filteredGroups,
      handleRemoveSelected,
      handleSelectionChange,
      highlightedIndex,
      isOpen,
      normalizedSelection,
      searchQuery,
    ]
  );

  const hasSelection = selectedGroups.length > 0;

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Grupos
      </label>

      <div
        className={`
          min-h-[42px] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600
          rounded-md flex items-center
          hover:border-gray-400 dark:hover:border-gray-500
          ${isOpen ? "border-blue-500 ring-1 ring-blue-500" : ""}
        `}
      >
        <div className="flex flex-1 flex-wrap items-center gap-2 px-3 py-2">
          <Search size={18} className="text-gray-400" />
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {selectedGroups.map((group) => (
              <span
                key={group.id}
                className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-1 text-sm text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
              >
                {group.label}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleRemoveSelected(group.id);
                  }}
                  className="rounded p-0.5 transition hover:bg-blue-200 hover:text-blue-700 dark:hover:bg-blue-800/60"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            <input
              type="text"
              value={searchQuery}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              onClick={() => setIsOpen(true)}
              onKeyDown={handleInputKeyDown}
              placeholder={hasSelection ? "" : placeholder}
              className="flex-1 min-w-[140px] bg-transparent text-gray-900 placeholder:text-gray-500 focus:outline-none dark:text-white dark:placeholder:text-gray-400"
            />
          </div>
        </div>
        <div className="flex items-center space-x-1 pr-2">
          {(hasSelection || searchQuery) && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <X size={14} className="text-gray-400" />
            </button>
          )}
          <button
            type="button"
            className="p-1"
            onClick={() => setIsOpen((prev) => !prev)}
          >
            <ChevronDown
              size={16}
              className={`text-gray-400 transition-transform duration-200 ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-hidden">
          <div className="max-h-48 overflow-y-auto">
            {filteredGroups.length === 0 ? (
              <div className="px-3 py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                {searchQuery
                  ? `No se encontraron grupos con "${searchQuery}"`
                  : "No hay grupos disponibles"}
              </div>
            ) : (
              <>
                <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700">
                  {searchQuery
                    ? `${filteredGroups.length} de ${groups.length} grupos`
                    : `${groups.length} grupos disponibles`}
                </div>

                {filteredGroups.map((group, index) => {
                  const isHighlighted = highlightedIndex === index;
                  const isSelected = selectedSet.has(group.id);
                  const baseClasses = `px-3 py-3 cursor-pointer flex items-center justify-between border-b border-gray-100 dark:border-gray-700 last:border-b-0 hover:bg-gray-100 dark:hover:bg-gray-700`;
                  const highlightClass = isSelected
                    ? "bg-blue-50 dark:bg-blue-900/20"
                    : isHighlighted
                    ? "bg-gray-100 dark:bg-gray-700"
                    : "";

                  return (
                    <div
                      key={`${group.id}-${index}`}
                      ref={(el) => {
                        itemRefs.current[index] = el;
                      }}
                      className={`${baseClasses} ${highlightClass}`}
                      onClick={() => handleSelectionChange(group)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                    >
                      <div className="flex-1 min-w-0 pr-3">
                        <p
                          className={`text-sm font-medium truncate ${
                            isSelected
                              ? "text-blue-700 dark:text-blue-300"
                              : "text-gray-900 dark:text-white"
                          }`}
                        >
                          {group.label}
                        </p>
                        {group.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {group.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <Users
                          size={14}
                          className="text-gray-400 dark:text-gray-500"
                        />
                        <span>{group.memberCount}</span>
                      </div>
                      {isSelected && (
                        <Check
                          size={16}
                          className="text-blue-600 dark:text-blue-400 ml-2"
                        />
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export interface CompanySearchOption {
  value: string;
  label: string;
  description?: string;
}

export interface CompanySearchSelectProps {
  options: CompanySearchOption[];
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
  placeholder?: string;
  label?: string;
}

export const CompanySearchSelect: React.FC<CompanySearchSelectProps> = ({
  options,
  selectedValues,
  onSelectionChange,
  placeholder = "Buscar empresa...",
  label = "Empresas",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const optionsByValue = useMemo(() => {
    const map = new Map<string, CompanySearchOption>();
    options.forEach((option) => {
      map.set(option.value, option);
    });
    return map;
  }, [options]);

  const selectedSet = useMemo(
    () => new Set<string>(selectedValues),
    [selectedValues]
  );

  const selectedOptions = useMemo(
    () =>
      selectedValues
        .map((value) => optionsByValue.get(value))
        .filter((option): option is CompanySearchOption => Boolean(option)),
    [optionsByValue, selectedValues]
  );

  const filteredOptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = options.filter((option) => {
      if (!query) {
        return true;
      }

      const labelMatch = option.label.toLowerCase().includes(query);
      const descriptionMatch = option.description
        ?.toLowerCase()
        .includes(query);
      const valueMatch = option.value.toLowerCase().includes(query);

      return labelMatch || descriptionMatch || valueMatch;
    });

    return filtered;
  }, [options, searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery("");
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, filteredOptions.length);
  }, [filteredOptions.length]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (!filteredOptions.length) {
      setHighlightedIndex(-1);
      return;
    }

    if (highlightedIndex === -1) {
      setHighlightedIndex(0);
    } else if (highlightedIndex >= filteredOptions.length) {
      setHighlightedIndex(filteredOptions.length - 1);
    }
  }, [filteredOptions, highlightedIndex, isOpen]);

  useEffect(() => {
    if (highlightedIndex >= 0) {
      itemRefs.current[highlightedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  const handleToggle = useCallback(
    (option: CompanySearchOption) => {
      const current = new Set(selectedValues);
      if (current.has(option.value)) {
        current.delete(option.value);
      } else {
        current.add(option.value);
      }

      onSelectionChange(Array.from(current));
      setSearchQuery("");
      setIsOpen(true);
      setHighlightedIndex(-1);
    },
    [onSelectionChange, selectedValues]
  );

  const handleClear = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      setSearchQuery("");
      onSelectionChange([]);
      setHighlightedIndex(-1);
    },
    [onSelectionChange]
  );

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setSearchQuery(value);
      if (!isOpen) {
        setIsOpen(true);
      }
      setHighlightedIndex(-1);
    },
    [isOpen]
  );

  const handleRemoveSelected = useCallback(
    (value: string) => {
      const next = selectedValues.filter((item) => item !== value);
      onSelectionChange(next);
      setSearchQuery("");
      setHighlightedIndex(-1);
    },
    [onSelectionChange, selectedValues]
  );

  const handleInputFocus = useCallback(() => {
    setIsOpen(true);
    if (filteredOptions.length > 0 && highlightedIndex === -1) {
      setHighlightedIndex(0);
    }
  }, [filteredOptions.length, highlightedIndex]);

  const handleInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Backspace" && searchQuery.trim() === "") {
        if (!selectedValues.length) {
          return;
        }
        event.preventDefault();
        handleRemoveSelected(selectedValues[selectedValues.length - 1]);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        setSearchQuery("");
        setHighlightedIndex(-1);
        return;
      }

      if (!isOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        setIsOpen(true);
        return;
      }

      if (!filteredOptions.length) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlightedIndex((prev) => {
          const nextIndex = prev + 1;
          if (nextIndex >= filteredOptions.length || prev === -1) {
            return 0;
          }
          return nextIndex;
        });
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlightedIndex((prev) => {
          if (prev <= 0) {
            return filteredOptions.length - 1;
          }
          return prev - 1;
        });
      } else if (event.key === "Enter") {
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          event.preventDefault();
          handleToggle(filteredOptions[highlightedIndex]);
        }
      }
    },
    [
      filteredOptions,
      handleRemoveSelected,
      handleToggle,
      highlightedIndex,
      isOpen,
      searchQuery,
      selectedValues,
    ]
  );

  const hasSelection = selectedOptions.length > 0;

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>

      <div
        className={`
          min-h-[42px] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600
          rounded-md flex items-center
          hover:border-gray-400 dark:hover:border-gray-500
          ${isOpen ? "border-blue-500 ring-1 ring-blue-500" : ""}
        `}
      >
        <div className="flex flex-1 flex-wrap items-center gap-2 px-3 py-2">
          <Search size={18} className="text-gray-400" />
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {selectedOptions.map((option) => (
              <span
                key={option.value}
                className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-1 text-sm text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
              >
                {option.label}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleRemoveSelected(option.value);
                  }}
                  className="rounded p-0.5 transition hover:bg-blue-200 hover:text-blue-700 dark:hover:bg-blue-800/60"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            <input
              type="text"
              value={searchQuery}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              onClick={() => setIsOpen(true)}
              onKeyDown={handleInputKeyDown}
              placeholder={hasSelection ? "" : placeholder}
              className="flex-1 min-w-[140px] bg-transparent text-gray-900 placeholder:text-gray-500 focus:outline-none dark:text-white dark:placeholder:text-gray-400"
            />
          </div>
        </div>
        <div className="flex items-center space-x-1 pr-2">
          {(hasSelection || searchQuery) && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <X size={14} className="text-gray-400" />
            </button>
          )}
          <button
            type="button"
            className="p-1"
            onClick={() => setIsOpen((prev) => !prev)}
          >
            <ChevronDown
              size={16}
              className={`text-gray-400 transition-transform duration-200 ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-hidden">
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                {searchQuery
                  ? `No se encontraron empresas con "${searchQuery}"`
                  : "No hay empresas disponibles"}
              </div>
            ) : (
              <>
                <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700">
                  {searchQuery
                    ? `${filteredOptions.length} de ${options.length} empresas`
                    : `${options.length} empresas disponibles`}
                </div>

                {filteredOptions.map((option, index) => {
                  const isHighlighted = highlightedIndex === index;
                  const isSelected = selectedSet.has(option.value);
                  const baseClasses = `px-3 py-3 cursor-pointer flex items-center justify-between border-b border-gray-100 dark:border-gray-700 last:border-b-0 hover:bg-gray-100 dark:hover:bg-gray-700`;
                  const highlightClass = isSelected
                    ? "bg-blue-50 dark:bg-blue-900/20"
                    : isHighlighted
                    ? "bg-gray-100 dark:bg-gray-700"
                    : "";

                  return (
                    <div
                      key={`${option.value}-${index}`}
                      ref={(el) => {
                        itemRefs.current[index] = el;
                      }}
                      className={`${baseClasses} ${highlightClass}`}
                      onClick={() => handleToggle(option)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                    >
                      <div className="flex-1 min-w-0 pr-3">
                        <p
                          className={`text-sm font-medium truncate ${
                            isSelected
                              ? "text-blue-700 dark:text-blue-300"
                              : "text-gray-900 dark:text-white"
                          }`}
                        >
                          {option.label}
                        </p>
                        {option.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {option.description}
                          </p>
                        )}
                      </div>
                      {isSelected && (
                        <Check
                          size={16}
                          className="text-blue-600 dark:text-blue-400 ml-2"
                        />
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
