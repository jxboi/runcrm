"use client";

import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type DropdownOption = { value: string; label: string };

export default function DropdownMenu({
  options,
  value,
  onChange,
  id,
  ariaLabel,
  className,
  buttonClassName,
  leadingIcon: LeadingIcon,
  renderOption,
  portal = true,
  renderValue,
  menuClassName,
  showChevron = true,
}: {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  id: string;
  ariaLabel: string;
  className: string;
  buttonClassName?: string;
  leadingIcon?: LucideIcon;
  renderOption?: (option: DropdownOption, selected: boolean) => ReactNode;
  portal?: boolean;
  renderValue?: (option: DropdownOption | undefined) => ReactNode;
  menuClassName?: string;
  showChevron?: boolean;
}) {
  const selectedOption = options.find((item) => item.value === value) ?? options[0];

  return (
    <Menu as="div" className={`relative ${className}`}>
      {({ open }) => (
        <>
          <MenuButton
            id={id}
            aria-label={ariaLabel}
            aria-controls={`${id}-options`}
            className={`crm-dropdown-trigger inline-flex h-9 w-full items-center gap-2 rounded-lg border border-slate-700 bg-transparent px-2.5 text-xs font-medium outline-none transition hover:border-indigo-500/60 ${buttonClassName ?? ""}`}
          >
            {LeadingIcon && <LeadingIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={1.8} />}
            {renderValue ? renderValue(selectedOption) : <span className="min-w-0 flex-1 truncate text-left">{selectedOption?.label ?? ""}</span>}
            {showChevron && (
              <ChevronDown
                aria-hidden="true"
                className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : "rotate-0"}`}
                strokeWidth={2}
              />
            )}
          </MenuButton>
          <MenuItems
            id={`${id}-options`}
            aria-label={ariaLabel}
            anchor="bottom start"
            portal={portal}
            transition
            className={`z-[70] mt-2 w-max min-w-[var(--button-width)] max-w-[calc(100vw-2rem)] origin-top-left overflow-x-auto rounded-2xl border border-slate-700 bg-slate-950 p-1.5 text-slate-200 shadow-xl shadow-slate-900/10 outline-none transition duration-100 ease-out data-closed:scale-95 data-closed:opacity-0 data-enter:ease-out data-leave:duration-75 data-leave:ease-in ${menuClassName ?? ""}`}
          >
            {options.map((item) => (
              <MenuItem key={item.value}>
                {({ focus }) => (
                  <button
                    type="button"
                    title={item.label}
                    aria-label={item.label}
                    onClick={() => onChange(item.value)}
                    className={`crm-dropdown-option flex w-full items-center rounded-xl text-left text-sm transition ${
                      renderOption ? "h-9 justify-center p-0" : "justify-between px-3 py-2.5"
                    } ${
                      focus ? "bg-slate-800 text-slate-100" : "text-slate-300"
                    }`}
                  >
                    {renderOption ? renderOption(item, value === item.value) : <span className="whitespace-nowrap">{item.label}</span>}
                    {!renderOption && value === item.value && <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />}
                  </button>
                )}
              </MenuItem>
            ))}
          </MenuItems>
        </>
      )}
    </Menu>
  );
}
