export const uniqueIds = (values: readonly (string | null)[]): string[] =>
  Array.from(
    new Set(values.filter((v): v is string => typeof v === "string")),
  );
