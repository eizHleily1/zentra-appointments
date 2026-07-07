export function normalizeServiceNameForComparison(name: string): string {
  return name.trim().toLowerCase();
}

export function normalizeServiceNameForStorage(name: string): string {
  return name.trim();
}
