export const extractObservationText = (
  raw: unknown
): string | undefined => {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const source = raw as Record<string, unknown>;
  const observations = source.observations ?? source.observation;

  if (typeof observations === "string") {
    const trimmed = observations.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (Array.isArray(observations)) {
    const joined = observations
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean)
      .join(" · ");
    return joined.length > 0 ? joined : undefined;
  }

  return undefined;
};

export const extractShiftDescription = (
  shift: unknown,
  fallback?: string
): string | undefined => {
  const observationText = extractObservationText(shift);
  if (observationText) {
    return observationText;
  }

  if (
    shift &&
    typeof shift === "object" &&
    typeof (shift as { description?: unknown }).description === "string"
  ) {
    const directDescription = (
      shift as { description: string }
    ).description.trim();
    if (directDescription.length > 0) {
      return directDescription;
    }
  }

  if (typeof fallback === "string") {
    const trimmedFallback = fallback.trim();
    if (trimmedFallback.length > 0) {
      return trimmedFallback;
    }
  }

  return undefined;
};

