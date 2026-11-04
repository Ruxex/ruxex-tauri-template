export type ConfigWriteErrorCode =
  | "configLayerReadonly"
  | "configRequirementReadonly"
  | "configVersionConflict"
  | "configValidationError"
  | "configPathNotFound"
  | "configSchemaUnknownKey"
  | "userLayerNotFound";

const CONFIG_WRITE_ERROR_CODES: ReadonlySet<string> = new Set([
  "configLayerReadonly",
  "configRequirementReadonly",
  "configVersionConflict",
  "configValidationError",
  "configPathNotFound",
  "configSchemaUnknownKey",
  "userLayerNotFound",
]);

export function getConfigWriteErrorCode(
  error: unknown,
): ConfigWriteErrorCode | null {
  if (!error || typeof error !== "object") {
    return null;
  }
  const data = (error as { data?: unknown }).data;
  if (!data || typeof data !== "object") {
    return null;
  }
  const code = (data as { config_write_error_code?: unknown })
    .config_write_error_code;
  return typeof code === "string" && CONFIG_WRITE_ERROR_CODES.has(code)
    ? (code as ConfigWriteErrorCode)
    : null;
}
