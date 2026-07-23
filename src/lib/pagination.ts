export const PROFILE_CAMPAIGN_PAGE_SIZE = 6;

export function normalizePage(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function pageRange(page: number, pageSize = PROFILE_CAMPAIGN_PAGE_SIZE) {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

export function totalPages(totalItems: number, pageSize = PROFILE_CAMPAIGN_PAGE_SIZE) {
  return Math.max(1, Math.ceil(totalItems / pageSize));
}
