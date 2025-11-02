import React, { useEffect, useMemo, useRef, useState } from "react";
import { DayPicker, DateRange } from "react-day-picker";
import { es } from "date-fns/locale";

import "react-day-picker/style.css";

import { Button } from "./Button";
import { CalendarDays } from "lucide-react";

interface DateRangePickerProps {
  value: { from: Date; to: Date };
  onChange: (range: { from: Date; to: Date }) => void;
  disabled?: boolean;
}

const formatRangeLabel = (from: Date | null, to: Date | null): string => {
  if (!from || !to) {
    return "Selecciona rango";
  }

  const formatter = new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const fromLabel = formatter.format(from);
  const toLabel = formatter.format(to);

  return fromLabel === toLabel ? fromLabel : `${fromLabel} - ${toLabel}`;
};

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current) {
        return;
      }

      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const selectedRange: DateRange = useMemo(
    () => ({ from: value.from, to: value.to }),
    [value.from, value.to]
  );

  const [draftRange, setDraftRange] = useState<DateRange>(selectedRange);
  const [isSelectingEnd, setIsSelectingEnd] = useState(false);

  useEffect(() => {
    setDraftRange({ from: value.from, to: value.to });
    setIsSelectingEnd(false);
  }, [value.from, value.to]);

  useEffect(() => {
    if (!isOpen) {
      setDraftRange({ from: value.from, to: value.to });
      setIsSelectingEnd(false);
    }
  }, [isOpen, value.from, value.to]);

  const buttonLabel = useMemo(
    () => formatRangeLabel(value.from, value.to),
    [value.from, value.to]
  );

  const handleSelect = (range: DateRange | undefined) => {
    if (!range?.from) {
      setDraftRange({ from: undefined, to: undefined });
      setIsSelectingEnd(false);
      return;
    }

    if (!isSelectingEnd) {
      setDraftRange({ from: range.from, to: undefined });
      setIsSelectingEnd(true);
      return;
    }

    const finalRange: DateRange = {
      from: range.from,
      to: range.to ?? range.from,
    };

    setDraftRange(finalRange);
    onChange({ from: finalRange.from, to: finalRange.to });
    setIsOpen(false);
    setIsSelectingEnd(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <Button
        size="lg"
        variant="primary"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={disabled}
        leftIcon={<CalendarDays className="h-5 w-5" />}
        className={`rounded-2xl px-6 py-3 text-base font-semibold tracking-wide shadow-lg shadow-blue-500/25 transition-transform hover:-translate-y-0.5 hover:shadow-blue-500/40 dark:shadow-blue-900/50 ${
          isOpen
            ? "ring-2 ring-blue-400/70 ring-offset-2 dark:ring-blue-500/70"
            : "ring-0"
        } border border-blue-400/60 bg-blue-600 hover:bg-blue-700 dark:border-blue-500/50 dark:bg-blue-500 dark:hover:bg-blue-600`}
      >
        {buttonLabel}
      </Button>
      {isOpen && !disabled && (
        <div className="absolute right-0 z-30 mt-2 rounded-xl border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-700 dark:bg-gray-900">
          <DayPicker
            mode="range"
            locale={es}
            defaultMonth={
              draftRange?.from ?? draftRange?.to ?? selectedRange.from ?? new Date()
            }
            numberOfMonths={2}
            pagedNavigation
            selected={draftRange}
            onSelect={handleSelect}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
};
