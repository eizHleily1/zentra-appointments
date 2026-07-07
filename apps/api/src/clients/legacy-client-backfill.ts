/**
 * Mirrors the legacy backfill display-name logic in iteration-11-appointment-clients.sql.
 */
export function deriveLegacyClientDisplayName(email: string): string {
  return deriveClientDisplayNameFromEmail(email);
}

export function deriveClientDisplayNameFromEmail(email: string): string {
  const localPart = email.split("@")[0]?.trim();

  if (!localPart) {
    return "Customer";
  }

  return localPart;
}
