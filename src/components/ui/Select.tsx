import React from "react";
import { ChevronDown } from "lucide-react";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  label?: string;
  options: SelectOption[];
  error?: string;
  fullWidth?: boolean;
  onChange?: (value: string) => void;
  size?: "sm" | "md";
  selectClassName?: string;
}

export const Select: React.FC<SelectProps> = ({
  id,
  label,
  options,
  error,
  fullWidth = false,
  className = "",
  onChange,
  value,
  size = "md",
  selectClassName = "",
  ...props
}) => {
  const selectId =
    id || `select-${Math.random().toString(36).substring(2, 9)}`;
  const isSmall = size === "sm";

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (onChange) {
      onChange(e.target.value);
    }
  };

  return (
    <div className={`${fullWidth ? "w-full" : ""} ${className} min-w-0`}>
      {label && (
        <label
          htmlFor={selectId}
          className={`block ${
            isSmall ? "text-xs mb-1" : "text-sm mb-2"
          } font-medium text-gray-700 dark:text-gray-300`}
        >
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          className={`
            block w-full appearance-none min-w-0 text-gray-900 bg-white border border-gray-200 shadow-sm
            ${isSmall ? "px-3 py-2 text-sm rounded-md" : "px-4 py-3 rounded-lg"}
            pr-10
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            dark:bg-gray-800 dark:border-gray-600 dark:text-white dark:focus:ring-blue-400
            ${error ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""}
            transition-all duration-200
            ${selectClassName}
          `}
          value={value}
          onChange={handleChange}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400 dark:text-gray-500">
          <ChevronDown size={16} />
        </span>
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
};
