import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { menuOptionClassName, menuSurfaceClassName } from './menuStyles';
import { TextInput } from './TextInput';

export interface ComboboxOption {
  value: string;
  label: string;
  meta?: string;
}

export interface ComboboxProps {
  ariaLabel: string;
  className?: string;
  leadingIcon?: React.ReactNode;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  value: string;
}

const menuOffsetPx = 6;

export function Combobox({
  ariaLabel,
  className,
  leadingIcon,
  onChange,
  options,
  placeholder,
  value
}: ComboboxProps) {
  const generatedId = useId();
  const baseId = `combobox-${generatedId}`;
  const listboxId = `${baseId}-listbox`;
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties | null>(null);
  const matches = useMemo(() => {
    const query = value.trim().toLowerCase();
    return options
      .filter((option) => (
        !query ||
        [option.label, option.value].some((candidate) =>
          candidate.toLowerCase().includes(query)
        )
      ))
      .slice(0, 8);
  }, [options, value]);

  const updateMenuPosition = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;
    const rect = input.getBoundingClientRect();
    const width = Math.min(
      Math.max(rect.width, 160),
      Math.max(160, window.innerWidth - 16)
    );
    const estimatedHeight = Math.min(
      256,
      Math.max(44, matches.length * 48 + 8)
    );
    const spaceBelow = window.innerHeight - rect.bottom;
    const openAbove =
      spaceBelow < estimatedHeight + menuOffsetPx && rect.top > spaceBelow;
    setMenuStyle({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      top: openAbove
        ? Math.max(8, rect.top - estimatedHeight - menuOffsetPx)
        : rect.bottom + menuOffsetPx,
      width
    });
  }, [matches.length]);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setActiveIndex(-1);
  }, []);

  const openMenu = useCallback(() => {
    setActiveIndex(matches.length ? 0 : -1);
    setIsOpen(true);
  }, [matches.length]);

  const choose = useCallback((index: number) => {
    const option = matches[index];
    if (!option) return;
    onChange(option.label);
    closeMenu();
    inputRef.current?.focus();
  }, [closeMenu, matches, onChange]);

  useEffect(() => {
    if (!isOpen) return undefined;
    updateMenuPosition();
    const closeOnOutsidePointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        inputRef.current?.parentElement?.contains(target) ||
        menuRef.current?.contains(target)
      ) return;
      closeMenu();
    };
    document.addEventListener('mousedown', closeOnOutsidePointer, true);
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsidePointer, true);
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [closeMenu, isOpen, updateMenuPosition]);

  const menu = isOpen && menuStyle && typeof document !== 'undefined'
    ? createPortal(
      <div
        ref={menuRef}
        id={listboxId}
        role="listbox"
        aria-label={`${ariaLabel} suggestions`}
        className={menuSurfaceClassName(
          'type-ui fixed z-[140] max-h-64 py-1'
        )}
        style={menuStyle}
      >
        {matches.length ? matches.map((option, index) => {
          const selected =
            value.trim().toLowerCase() === option.label.toLowerCase();
          return (
            <button
              key={option.value}
              id={`${baseId}-option-${index}`}
              type="button"
              role="option"
              aria-selected={selected}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(index)}
              className={menuOptionClassName({
                active: index === activeIndex,
                selected,
                className: 'justify-between rounded-none px-4'
              })}
            >
              <span className="min-w-0">
                <span className="block truncate">{option.label}</span>
                {option.meta && (
                  <span className="mono block truncate type-caption">
                    {option.meta}
                  </span>
                )}
              </span>
              {selected && (
                <Check
                  className="h-4 w-4 shrink-0 text-accent-strong"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        }) : (
          <p className="px-4 py-3 type-ui text-ui-text-muted">
            No matching workspaces
          </p>
        )}
      </div>,
      document.body
    )
    : null;

  return (
    <div className={twMerge('relative min-w-0', className)}>
      {leadingIcon && (
        <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-ui-text-muted">
          {leadingIcon}
        </span>
      )}
      <TextInput
        ref={inputRef}
        id={baseId}
        type="search"
        role="combobox"
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-activedescendant={
          isOpen && activeIndex >= 0
            ? `${baseId}-option-${activeIndex}`
            : undefined
        }
        value={value}
        placeholder={placeholder}
        className={twMerge(
          'appearance-none pr-20 [&::-webkit-search-cancel-button]:hidden',
          leadingIcon && 'pl-10'
        )}
        onChange={(event) => {
          onChange(event.target.value);
          openMenu();
        }}
        onClick={() => {
          if (!isOpen) openMenu();
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!isOpen) {
              openMenu();
            } else {
              setActiveIndex((current) => {
                if (!matches.length) return -1;
                const direction = event.key === 'ArrowDown' ? 1 : -1;
                return (current + direction + matches.length) % matches.length;
              });
            }
          } else if (
            event.key === 'Enter' &&
            isOpen &&
            activeIndex >= 0
          ) {
            event.preventDefault();
            choose(activeIndex);
          } else if (event.key === 'Escape') {
            event.preventDefault();
            closeMenu();
          } else if (event.key === 'Tab') {
            closeMenu();
          }
        }}
      />
      {value && (
        <button
          type="button"
          aria-label={`Clear ${ariaLabel.toLowerCase()}`}
          className="absolute right-10 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-ui-text-muted hover:bg-ui-bg hover:text-ui-text focus:outline-none focus-visible:ring-2 focus-visible:ring-control-boundary"
          onClick={() => {
            onChange('');
            inputRef.current?.focus();
            openMenu();
          }}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
      <button
        type="button"
        aria-label={`Show ${ariaLabel.toLowerCase()} suggestions`}
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md text-ui-text-muted hover:bg-ui-bg hover:text-ui-text focus:outline-none focus-visible:ring-2 focus-visible:ring-control-boundary"
        onClick={() => {
          if (isOpen) {
            closeMenu();
          } else {
            openMenu();
            inputRef.current?.focus();
          }
        }}
      >
        <ChevronDown
          className={clsx(
            'h-4 w-4 transition-transform',
            isOpen && 'rotate-180'
          )}
          aria-hidden="true"
        />
      </button>
      {menu}
    </div>
  );
}
