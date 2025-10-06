import React from 'react';
import { Button } from '../ui/Button';

interface PageHeaderProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  actionIcon?: React.ReactNode;
  actionDisabled?: boolean;
  actionLoading?: boolean;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  actionIcon,
  actionDisabled = false,
  actionLoading = false,
}) => {
  return (
    <div className="mb-6 pt-6 md:flex md:items-center md:justify-between">
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold leading-7 text-gray-900 dark:text-white sm:truncate sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {description}
          </p>
        )}
      </div>
      {actionLabel && onAction && (
        <div className="mt-4 flex md:mt-0 md:ml-4">
          <Button 
            onClick={onAction} 
            leftIcon={actionIcon}
            disabled={actionDisabled}
            isLoading={actionLoading}
          >
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
};
