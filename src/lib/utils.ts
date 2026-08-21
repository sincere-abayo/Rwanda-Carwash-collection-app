import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId() {
  return crypto.randomUUID();
}

/**
 * Display label for lists, detail, and exports.
 * Optional name + landmark, joined with a comma — nothing invented when name is empty.
 */
export function formatCarwashDisplay(cw: {
  name?: string | null;
  address?: string | null;
}): string {
  const raw = (cw.name || '').trim();
  const facility =
    raw &&
    !/^unnamed(\s+carwash)?(\s+\d+)?$/i.test(raw) &&
    raw !== 'Carwash Facility'
      ? raw
      : '';
  const address = (cw.address || '').trim();
  if (facility && address) return `${facility}, ${address}`;
  return facility || address || '';
}
