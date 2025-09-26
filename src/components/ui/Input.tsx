import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  size?: 'sm' | 'md';
}

export const Input: React.FC<InputProps> = ({
  id,
  label,
  error,
  fullWidth = false,
  className = '',
  leftIcon,
  size = 'md',
  ...props
}) => {
  const inputId = id || `input-${Math.random().toString(36).substring(2, 9)}`;
  const isSmall = size === 'sm';
  
  return (
    <div className={`${fullWidth ? 'w-full' : ''} min-w-0`}>
      {label && (
        <label 
          htmlFor={inputId} 
          className={`block ${isSmall ? 'text-xs mb-1' : 'text-sm mb-2'} font-medium text-gray-700 dark:text-gray-300`}
        >
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500 dark:text-gray-400">
            {leftIcon}
          </div>
        )}
        <input
          id={inputId}
          className={`
            block w-full min-w-0 text-gray-900 bg-white border border-gray-200 shadow-sm
            ${isSmall ? 'px-3 py-2 text-sm rounded-md' : 'px-4 py-3 rounded-lg'}
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            dark:bg-gray-800 dark:border-gray-600 dark:text-white dark:focus:ring-blue-400
            ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}
            ${leftIcon ? 'pl-10' : ''}
            transition-all duration-200
            ${className}
          `}
          {...props}
        />
      </div>
      {error && (
        <p className={`mt-2 ${isSmall ? 'text-xs' : 'text-sm'} text-red-600 dark:text-red-400`}>{error}</p>
      )}
    </div>
  );
};
