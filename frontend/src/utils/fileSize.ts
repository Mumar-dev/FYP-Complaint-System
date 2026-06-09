/**
 * File size formatting utility.
 * Used in complaint attachment uploads.
 */

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + units[i];
};

/**
 * Maximum allowed file size for attachments (5MB).
 */
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Allowed MIME types for complaint attachments.
 */
export const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/jpg',
  'application/pdf',
];

/**
 * Validates a file for upload based on size and type.
 */
export const validateFile = (file: File): { valid: boolean; error?: string } => {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File size must be less than ${formatFileSize(MAX_FILE_SIZE)}` };
  }
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return { valid: false, error: 'Only JPG, PNG, and PDF files are allowed' };
  }
  return { valid: true };
};
