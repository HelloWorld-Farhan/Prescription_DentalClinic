import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface DropdownOption {
  value: string;
  label: string;
  icon?: string;
  badge?: string | number;
  badgeColor?: string;
}

interface CustomDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  prefixIcon?: string;
  className?: string;
  menuWidth?: string;
  align?: 'left' | 'right';
  disabled?: boolean;
}

export default function CustomDropdown({
  value,
  onChange,
  options,
  placeholder = 'Select option...',
  prefixIcon,
  className = '',
  menuWidth = 'w-56',
  align = 'left',
  disabled = false,
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <motion.button
        type="button"
        whileTap={{ scale: disabled ? 1 : 0.98 }}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`h-10 px-3.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 transition-all cursor-pointer select-none border shadow-2xs ${
          isOpen
            ? 'bg-surface-container-lowest border-primary text-primary ring-2 ring-primary/20 shadow-xs'
            : 'bg-surface-container-low hover:bg-surface-container-lowest border-surface-container-high hover:border-surface-container-highest text-on-surface'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className="flex items-center gap-2 truncate">
          {prefixIcon && (
            <span
              className={`material-symbols-outlined text-[17px] shrink-0 transition-colors ${
                isOpen ? 'text-primary' : 'text-outline'
              }`}
            >
              {prefixIcon}
            </span>
          )}
          {selectedOption?.icon && !prefixIcon && (
            <span className="material-symbols-outlined text-[16px] text-primary shrink-0">
              {selectedOption.icon}
            </span>
          )}
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        </div>

        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="material-symbols-outlined text-[18px] text-outline shrink-0 ml-1"
        >
          expand_more
        </motion.span>
      </motion.button>

      {/* Animated Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            role="listbox"
            className={`absolute top-full mt-1.5 ${
              align === 'right' ? 'right-0' : 'left-0'
            } ${menuWidth} max-h-64 overflow-y-auto no-scrollbar rounded-2xl bg-surface-container-lowest border border-surface-container-high/80 shadow-xl p-1.5 z-50`}
          >
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  type="button"
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer text-left ${
                    isSelected
                      ? 'bg-primary/10 text-primary font-bold'
                      : 'text-on-surface hover:bg-surface-container-low hover:text-primary'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {option.icon && (
                      <span
                        className={`material-symbols-outlined text-[16px] shrink-0 ${
                          isSelected ? 'text-primary' : 'text-outline'
                        }`}
                      >
                        {option.icon}
                      </span>
                    )}
                    <span className="truncate">{option.label}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {option.badge !== undefined && (
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          option.badgeColor || 'bg-surface-container text-on-surface-variant'
                        }`}
                      >
                        {option.badge}
                      </span>
                    )}
                    {isSelected && (
                      <span className="material-symbols-outlined text-[16px] text-primary">
                        check
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
