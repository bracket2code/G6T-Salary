import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, Users, X } from "lucide-react";
import { Worker } from "../../types/salary";

export interface WorkerGroupOption {
  id: string;
  label: string;
  description?: string;
  memberCount: number;
}

const formatSelectionSummary = (
  count: number,
  singular: string,
  plural: string
) => {
  if (count <= 0) {
    return "";
  }
  if (count === 1) {
    return singular;
  }
  return `${count} ${plural}`;
};

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

  const selectionLabel = useMemo(() => {
    if (!selectedWorkerIds.length) {
      return "";
    }

    if (!multiSelect) {
      const worker = workersById.get(selectedWorkerIds[0]);
      return worker?.name ?? "";
    }

    if (selectedWorkerIds.length === 1) {
      const worker = workersById.get(selectedWorkerIds[0]);
      return worker?.name ?? "";
    }

    return formatSelectionSummary(
      selectedWorkerIds.length,
      "1 trabajador seleccionado",
      "trabajadores seleccionados"
    );
  }, [multiSelect, selectedWorkerIds, workersById]);

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
    [filteredWorkers, handleWorkerToggle, highlightedIndex, isOpen]
  );

  const inputDisplayValue = isOpen ? searchQuery : selectionLabel;
  const hasSelection = selectedWorkerIds.length > 0;

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
        <div className="flex-1 flex items-center px-3 py-2">
          <Search size={18} className="text-gray-400 mr-2" />
          <input
            type="text"
            value={inputDisplayValue}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onClick={() => setIsOpen(true)}
            onKeyDown={handleInputKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none"
          />
        </div>
        <div className="flex items-center space-x-1">
          {(hasSelection || searchQuery) && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 mr-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <X size={14} className="text-gray-400" />
            </button>
          )}
          <button
            type="button"
            className="p-1 mr-2"
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
                        <p
                          className={`text-sm font-medium truncate ${
                            isSelected
                              ? "text-blue-700 dark:text-blue-300"
                              : "text-gray-900 dark:text-white"
                          }`}
                        >
                          {worker.name}
                        </p>
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

  const selectionLabel = useMemo(() => {
    if (!selectedGroups.length) {
      return "";
    }

    if (!multiSelect) {
      return selectedGroups[0]?.label ?? "";
    }

    if (selectedGroups.length === 1) {
      return selectedGroups[0]?.label ?? "";
    }

    return formatSelectionSummary(
      selectedGroups.length,
      "1 grupo seleccionado",
      "grupos seleccionados"
    );
  }, [multiSelect, selectedGroups]);

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

    return filtered.sort((a, b) =>
      a.label.localeCompare(b.label, "es", { sensitivity: "base" })
    );
  }, [groups, searchQuery]);

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

  const handleInputFocus = useCallback(() => {
    setIsOpen(true);
    if (filteredGroups.length > 0 && highlightedIndex === -1) {
      setHighlightedIndex(0);
    }
  }, [filteredGroups.length, highlightedIndex]);

  const handleInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
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
    [filteredGroups, handleSelectionChange, highlightedIndex, isOpen]
  );

  const inputDisplayValue = isOpen ? searchQuery : selectionLabel;
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
        <div className="flex-1 flex items-center px-3 py-2">
          <Search size={18} className="text-gray-400 mr-2" />
          <input
            type="text"
            value={inputDisplayValue}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onClick={() => setIsOpen(true)}
            onKeyDown={handleInputKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none"
          />
        </div>
        <div className="flex items-center space-x-1">
          {(hasSelection || searchQuery) && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 mr-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <X size={14} className="text-gray-400" />
            </button>
          )}
          <button
            type="button"
            className="p-1 mr-2"
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
