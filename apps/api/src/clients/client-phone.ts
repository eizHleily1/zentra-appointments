export function normalizePhoneNumber(phoneNumber: string | null | undefined): string | null {
  if (phoneNumber === null || phoneNumber === undefined) {
    return null;
  }

  const trimmed = phoneNumber.trim();

  if (trimmed.length === 0) {
    return null;
  }

  const digitsOnly = trimmed.replace(/\D/g, "");

  return digitsOnly.length > 0 ? digitsOnly : null;
}

export function normalizeOptionalEmail(email: string | null | undefined): string | null {
  if (email === null || email === undefined) {
    return null;
  }

  const trimmed = email.trim().toLowerCase();

  return trimmed.length > 0 ? trimmed : null;
}
