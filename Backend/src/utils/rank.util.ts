/**
 * Helper to ensure restored staff rank is one of the valid normal staff ranks:
 * 'junior', 'senior', 'team_lead', 'supervisor'.
 * If the rank is undefined, 'head', or invalid, it cleanly falls back to 'junior'.
 */
export const normalizeStaffRank = (rank?: string): 'junior' | 'senior' | 'team_lead' | 'supervisor' => {
  if (!rank) return 'junior';
  const lower = rank.toLowerCase().trim();
  if (lower === 'supervisor') return 'supervisor';
  if (lower === 'team_lead' || lower === 'team lead' || lower === 'lead') return 'team_lead';
  if (lower === 'senior') return 'senior';
  if (lower === 'junior' || lower === 'standard') return 'junior';
  return 'junior';
};
