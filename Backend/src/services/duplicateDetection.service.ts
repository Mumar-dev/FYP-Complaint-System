import { Complaint } from '../models/complaint.model';
import { IComplaint } from '../interfaces/complaint.interface';
import { Types } from 'mongoose';

// Common stop words to exclude from text overlap analysis
const STOP_WORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'in', 'of', 'to',
  'it', 'for', 'with', 'as', 'by', 'this', 'that', 'from', 'there', 'here',
  'my', 'our', 'we', 'i', 'me', 'please', 'urgent', 'issue', 'problem', 'help'
]);

/**
 * Extracts normalized tokens from a text string, ignoring stop words and punctuation.
 */
const extractTokens = (text: string): Set<string> => {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP_WORDS.has(w))
  );
};

export class DuplicateDetectionService {
  /**
   * Identifies potentially related complaints based on:
   * 1. Same departmentId
   * 2. Active status (submitted, pending_assignment, assigned, in_progress, under_verification)
   * 3. Proximity: either GPS distance within ~500 meters or matching street/block address
   * 4. Time window: submitted within the last 72 hours
   * 5. Text similarity check: normalized keyword overlap on title + description
   */
  static async findPotentialDuplicates(params: {
    title?: string;
    description?: string;
    category?: string;
    departmentId: Types.ObjectId | string;
    lat?: number;
    lng?: number;
    address?: string;
    excludeComplaintId?: Types.ObjectId | string;
  }): Promise<IComplaint[]> {
    const timeLimit = new Date(Date.now() - 72 * 60 * 60 * 1000); // 72 hours

    const query: any = {
      departmentId: params.departmentId,
      status: { $in: ['submitted', 'pending_assignment', 'assigned', 'in_progress', 'under_verification'] },
      createdAt: { $gte: timeLimit }
    };

    if (params.excludeComplaintId) {
      query._id = { $ne: new Types.ObjectId(params.excludeComplaintId as string) };
    }

    const candidates = await Complaint.find(query).limit(15);
    const related: IComplaint[] = [];

    // Extract incoming tokens from title + description
    const incomingText = `${params.title || ''} ${params.description || ''}`;
    const incomingTokens = extractTokens(incomingText);

    for (const candidate of candidates) {
      // 1. Proximity Check
      let isLocationMatch = false;

      // Check GPS coordinate proximity (~0.005 deg is approx 500m)
      if (params.lat && params.lng && candidate.location?.lat && candidate.location?.lng) {
        const dLat = Math.abs(candidate.location.lat - params.lat);
        const dLng = Math.abs(candidate.location.lng - params.lng);
        if (dLat < 0.005 && dLng < 0.005) {
          isLocationMatch = true;
        }
      }

      // Check address text similarity if coordinates unavailable or as secondary
      if (!isLocationMatch && params.address && candidate.location?.address) {
        const cleanA = params.address.toLowerCase().trim();
        const cleanB = candidate.location.address.toLowerCase().trim();
        if (cleanA.includes(cleanB) || cleanB.includes(cleanA)) {
          isLocationMatch = true;
        }
      }

      // If location does not match, skip
      if (!isLocationMatch) {
        continue;
      }

      // 2. Text Similarity Check
      // Calculate token overlap to ensure unrelated issues at the same building aren't falsely flagged
      if (incomingTokens.size > 0) {
        const candidateText = `${candidate.title || ''} ${candidate.description || ''}`;
        const candidateTokens = extractTokens(candidateText);

        let overlapCount = 0;
        for (const token of incomingTokens) {
          if (candidateTokens.has(token)) {
            overlapCount++;
          }
        }

        // Require at least 2 common significant words, or 1 common word if incoming text is very brief (<= 3 words)
        const minOverlap = incomingTokens.size <= 3 ? 1 : 2;
        if (overlapCount >= minOverlap) {
          related.push(candidate);
        }
      } else {
        // Fallback to location match if no significant tokens exist
        related.push(candidate);
      }
    }

    return related;
  }
}
