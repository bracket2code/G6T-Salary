import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = "",
  onClick,
}) => {
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border-0 overflow-hidden transition-all duration-200 w-full max-w-full ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  children,
  className = "",
}) => {
  return (
    <div
      className={`sm:px-4 py-3 border-b border-gray-100 dark:border-gray-700 transition-colors duration-200 w-full max-w-full ${className}`}
    >
      {children}
    </div>
  );
};

interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

export const CardContent: React.FC<CardContentProps> = ({
  children,
  className = "",
}) => {
  return (
    <div className={`px-4 sm:px-6 py-4 w-full max-w-full ${className}`}>
      {children}
    </div>
  );
};

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const CardFooter: React.FC<CardFooterProps> = ({
  children,
  className = "",
}) => {
  return (
    <div
      className={`px-6 py-4 border-t border-gray-100 dark:border-gray-700 transition-colors duration-200 ${className}`}
    >
      {children}
    </div>
  );
};
