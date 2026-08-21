/**
 * Rwanda administrative hierarchy: Province → District → Sector → Cell.
 * Data generated from official NISR village list via rwanda-geo-data
 * (5 provinces, 30 districts, 416 sectors, 2,148 cells).
 */
import hierarchyJson from './rwanda-hierarchy.json';

export type RwandaHierarchy = Record<string, Record<string, Record<string, string[]>>>;

export const RWANDA_HIERARCHY = hierarchyJson as RwandaHierarchy;

export function getProvinces(): string[] {
  return Object.keys(RWANDA_HIERARCHY).sort((a, b) => a.localeCompare(b));
}

export function getDistricts(province: string): string[] {
  if (!province) return [];
  return Object.keys(RWANDA_HIERARCHY[province] || {}).sort((a, b) => a.localeCompare(b));
}

export function getSectors(province: string, district: string): string[] {
  if (!province || !district) return [];
  return Object.keys(RWANDA_HIERARCHY[province]?.[district] || {}).sort((a, b) =>
    a.localeCompare(b)
  );
}

/** Cells for a sector; if sector is empty, all cells in the district. */
export function getCells(province: string, district: string, sector?: string): string[] {
  if (!province || !district) return [];
  const sectorMap = RWANDA_HIERARCHY[province]?.[district];
  if (!sectorMap) return [];

  if (sector && sectorMap[sector]) {
    return [...sectorMap[sector]].sort((a, b) => a.localeCompare(b));
  }

  const all = new Set<string>();
  for (const cells of Object.values(sectorMap)) {
    for (const cell of cells) all.add(cell);
  }
  return [...all].sort((a, b) => a.localeCompare(b));
}
