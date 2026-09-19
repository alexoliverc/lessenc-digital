export const VIEW_CONTENT_EVENT_REQUEST_HEADER = "x-lessenc-view-content-event-id";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeMeasurementEventId(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }

  const normalized = raw.trim().toLowerCase();

  return UUID_PATTERN.test(normalized) ? normalized : null;
}
