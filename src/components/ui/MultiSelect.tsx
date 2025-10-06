import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  showSelectAll?: boolean;
  enableSearch?: boolean;
  searchPlaceholder?: string;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = "Seleccionar opciones",
  className = "",
  disabled = false,
  showSelectAll = true,
  enableSearch = false,
  searchPlaceholder = "Buscar...",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
    }
  }, [isOpen]);

  const handleToggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter(v => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  const handleSelectAll = () => {
    onChange(options.map(option => option.value));
  };

  const handleDeselectAll = () => {
    onChange([]);
  };
  const handleRemoveOption = (optionValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(value.filter(v => v !== optionValue));
  };

  const selectedOptions = options.filter(option => value.includes(option.value));
  const allSelected = options.length > 0 && value.length === options.length;
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredOptions = enableSearch && normalizedSearch
    ? options.filter((option) =>
        option.label.toLowerCase().includes(normalizedSearch) ||
        option.value.toLowerCase().includes(normalizedSearch)
      )
    : options;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div
        className={`
          min-h-[42px] px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 
          rounded-md cursor-pointer flex items-center justify-between
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-400 dark:hover:border-gray-500'}
          ${isOpen ? 'border-blue-500 ring-1 ring-blue-500' : ''}
        `}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div className="flex-1 flex flex-wrap gap-1">
          {selectedOptions.length === 0 ? (
            <span className="text-gray-500 dark:text-gray-400">{placeholder}</span>
          ) : (
            selectedOptions.map((option) => (
              <span
                key={option.value}
                className="inline-flex items-center px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-sm"
              >
                {option.label}
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => handleRemoveOption(option.value, e)}
                    className="ml-1 hover:text-blue-600 dark:hover:text-blue-200"
                  >
                    <X size={12} />
                  </button>
                )}
              </span>
            ))
          )}
        </div>
        <ChevronDown 
          size={16} 
          className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
          {showSelectAll && options.length > 0 && (
            <>
              <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    disabled={allSelected}
                    className={`
                      px-2 py-1 text-xs rounded transition-colors
                      ${allSelected 
                        ? 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed' 
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50'
                      }
                    `}
                  >
                    Seleccionar todos
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    disabled={value.length === 0}
                    className={`
                      px-2 py-1 text-xs rounded transition-colors
                      ${value.length === 0 
                        ? 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                      }
                    `}
                  >
                    Deseleccionar todos
                  </button>
                </div>
              </div>
            </>
          )}
          {enableSearch && options.length > 0 && (
            <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600">
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder:text-gray-400"
              />
            </div>
          )}
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-gray-500 dark:text-gray-400 text-sm">
              {enableSearch && normalizedSearch
                ? "No se encontraron resultados"
                : "No hay opciones disponibles"}
            </div>
          ) : (
            filteredOptions.map((option) => {
              const isSelected = value.includes(option.value);
              return (
                <div
                  key={option.value}
                  className={`
                    px-3 py-2 cursor-pointer flex items-center justify-between
                    hover:bg-gray-100 dark:hover:bg-gray-700
                    ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
                  `}
                  onClick={() => handleToggleOption(option.value)}
                >
                  <span className={`text-sm ${isSelected ? 'text-blue-700 dark:text-blue-300 font-medium' : 'text-gray-700 dark:text-gray-300'}`}>
                    {option.label}
                  </span>
                  {isSelected && (
                    <Check size={16} className="text-blue-600 dark:text-blue-400" />
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
