import { UNASSIGNED_COMPANY_ID } from "../constants/company";

export const trimToNull = (value?: string | null): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const normalizeKeyPart = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.toLowerCase() === UNASSIGNED_COMPANY_ID) {
    return UNASSIGNED_COMPANY_ID;
  }

  return trimmed;
};

export const normalizeCompanyLabel = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }
  return trimmed
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
};
