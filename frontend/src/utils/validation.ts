/**
 * Form validation utilities used across registration, complaint submission,
 * and staff management forms.
 */

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidCNIC = (cnic: string): boolean => {
  const cleaned = cnic.replace(/[-\s]/g, '');
  return /^\d{13}$/.test(cleaned);
};

export const isValidPhone = (phone: string): boolean => {
  const cleaned = phone.replace(/[-\s+()]/g, '');
  return /^\d{10,12}$/.test(cleaned);
};

export const isStrongPassword = (password: string): boolean => {
  return password.length >= 8;
};

/**
 * Returns a password strength score from 0-4.
 * 0 = very weak, 4 = strong
 */
export const getPasswordStrength = (password: string): number => {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  return score;
};

export const getPasswordStrengthLabel = (score: number): string => {
  const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
  return labels[score] || 'Very Weak';
};
