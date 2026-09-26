/** Upload rules mirrored from the backend (`StudentDocumentService` allow-list and 10 MB cap). */
export const ALLOWED_UPLOAD_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Why a file can't be uploaded, or undefined if it's fine. */
export function uploadProblem(file: File): string | undefined {
  if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) return `${file.name}: allowed files are PDF, JPG, PNG, WEBP, DOC, DOCX`;
  if (file.size > MAX_UPLOAD_BYTES) return `${file.name} is larger than 10 MB`;
  return undefined;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
