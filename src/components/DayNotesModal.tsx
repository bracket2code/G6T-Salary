import React, { useEffect, useId, useMemo, useState } from "react";
import { NotebookPen, Save, X } from "lucide-react";
import { Button } from "./ui/Button";
import type { DayNoteEntry } from "./WorkerHoursCalendar";
import { generateUuid } from "../lib/generateUuid";

export interface DayNotesModalProps {
  isOpen: boolean;
  workerId: string;
  dateKey: string;
  workerName: string;
  companyName: string;
  dayLabel: string;
  dateLabel?: string;
  notes: DayNoteEntry[];
  onClose: () => void;
  onSave: (payload: {
    workerId: string;
    dateKey: string;
    notes: DayNoteEntry[];
    deletedNoteIds: string[];
  }) => void;
}

export const DayNotesModal: React.FC<DayNotesModalProps> = ({
  isOpen,
  workerId,
  dateKey,
  workerName,
  dayLabel,
  dateLabel,
  notes,
  onClose,
  onSave,
}) => {
  const [editableNote, setEditableNote] = useState<{
    id: string;
    text: string;
    isNew: boolean;
    original?: DayNoteEntry;
  } | null>(null);
  const rawNoteFieldId = useId();
  const noteFieldId = `day-note-${
    rawNoteFieldId.replace(/[^a-zA-Z0-9_-]/g, "") || "field"
  }`;
  const noteHelperId = `${noteFieldId}-helper`;
  const noteFieldName = `day-note-${workerId}-${dateKey}`.replace(
    /[^a-zA-Z0-9_-]/g,
    "-"
  );

  useEffect(() => {
    if (!isOpen) {
      setEditableNote(null);
      return;
    }

    if (notes.length > 0) {
      const primary = notes[0];
      setEditableNote({
        id: primary.id,
        text: primary.text ?? "",
        isNew: false,
        original: primary,
      });
      return;
    }

    setEditableNote({
      id: generateUuid(),
      text: "",
      isNew: true,
    });
  }, [isOpen, notes]);

  const initialText = useMemo(() => (notes[0]?.text ?? "").trim(), [notes]);

  const trimmedCurrentText = useMemo(
    () => (editableNote?.text ?? "").trim(),
    [editableNote]
  );

  const preparedState = useMemo(() => {
    if (!editableNote) {
      return {
        finalNotes: [] as DayNoteEntry[],
        deletedNoteIds: [] as string[],
      };
    }

    if (!trimmedCurrentText.length) {
      return {
        finalNotes: [],
        deletedNoteIds: editableNote.original ? [editableNote.original.id] : [],
      };
    }

    const finalNote = editableNote.original
      ? {
          ...editableNote.original,
          text: trimmedCurrentText,
        }
      : {
          id: editableNote.id,
          text: trimmedCurrentText,
          origin: "note" as DayNoteEntry["origin"],
        };

    return {
      finalNotes: [finalNote],
      deletedNoteIds: [],
    };
  }, [editableNote, trimmedCurrentText]);

  const hasChanges = trimmedCurrentText !== initialText;

  const formattedLabel =
    dateLabel && dateLabel !== dayLabel
      ? `${dayLabel} · ${dateLabel}`
      : dateLabel ?? dayLabel;

  if (!isOpen) {
    return null;
  }

  const handleSaveClick = () => {
    if (!editableNote || !hasChanges) {
      onClose();
      return;
    }

    onSave({
      workerId,
      dateKey,
      notes: preparedState.finalNotes,
      deletedNoteIds: preparedState.deletedNoteIds,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[104] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-base font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">
              <NotebookPen size={16} />
              Notas del día
            </div>
            <div className="flex flex-wrap items-baseline gap-3 text-gray-500 dark:text-gray-400">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                {formattedLabel}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {workerName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-200 p-2 text-gray-500 transition hover:text-gray-900 dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label="Cerrar notas"
          >
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
          <div className="space-y-3">
            <label
              htmlFor={noteFieldId}
              className="block text-sm font-semibold text-gray-700 dark:text-gray-200"
            >
              Nota del día
            </label>
            <textarea
              id={noteFieldId}
              name={noteFieldName}
              aria-describedby={noteHelperId}
              value={editableNote?.text ?? ""}
              onChange={(event) =>
                setEditableNote((previous) =>
                  previous
                    ? {
                        ...previous,
                        text: event.target.value,
                      }
                    : {
                        id: generateUuid(),
                        text: event.target.value,
                        isNew: true,
                      }
                )
              }
              rows={6}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-900/40"
              placeholder="Escribe la nota para este día..."
            />
            <p
              id={noteHelperId}
              className="text-xs text-gray-500 dark:text-gray-400"
            >
              Solo se permite una nota por día. Para eliminarla, deja el campo
              vacío y guarda los cambios.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSaveClick}
            disabled={!hasChanges}
            leftIcon={<Save size={16} />}
          >
            Guardar notas
          </Button>
        </div>
      </div>
    </div>
  );
};
