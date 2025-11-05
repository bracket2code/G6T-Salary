import React, { useEffect } from "react";
import ReactDOM from "react-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  LucideIcon,
} from "lucide-react";
import { Button } from "./Button";

type FeedbackVariant = "success" | "error" | "info";

interface FeedbackDialogProps {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  variant?: FeedbackVariant;
  dismissLabel?: string;
  onDismiss: () => void;
}

const iconByVariant: Record<FeedbackVariant, LucideIcon> = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

const accentClassByVariant: Record<FeedbackVariant, string> = {
  success:
    "text-emerald-600 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-900/30",
  error:
    "text-red-600 bg-red-50 dark:text-red-300 dark:bg-red-900/30",
  info: "text-blue-600 bg-blue-50 dark:text-blue-300 dark:bg-blue-900/30",
};

export const FeedbackDialog: React.FC<FeedbackDialogProps> = ({
  open,
  title,
  description,
  variant = "info",
  dismissLabel = "Cerrar",
  onDismiss,
}) => {
  useEffect(() => {
    if (!open) {
      return;
    }
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const Icon = iconByVariant[variant];
  const accentClasses = accentClassByVariant[variant];

  const dialog = (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/40 dark:bg-black/60"
        onClick={onDismiss}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-start gap-4">
          <div
            className={`inline-flex h-12 w-12 items-center justify-center rounded-full ${accentClasses}`}
          >
            <Icon className="h-6 w-6" />
          </div>
          <div className="flex-1 space-y-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {title}
            </h3>
            {description && (
              <div className="text-sm text-gray-600 dark:text-gray-300">
                {description}
              </div>
            )}
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <Button variant="primary" onClick={onDismiss}>
            {dismissLabel}
          </Button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(dialog, document.body);
};

export default FeedbackDialog;
