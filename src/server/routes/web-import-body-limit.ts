export const WEB_IMPORT_BODY_LIMIT_BYTES = 25 * 1024 * 1024;
export const WEB_IMPORT_BODY_LIMIT_MB = 25;

export function getWebImportBodyLimitMessage(): string {
  return `Request body exceeds the ${WEB_IMPORT_BODY_LIMIT_MB} MB upload limit.`;
}
