import Groq from 'groq-sdk';

// Initialize the SDK. We use a fallback if not provided to prevent crashes on startup.
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'MISSING_KEY' });
const GROQ_MODEL = 'qwen/qwen3.8-27b';

export type ComplaintPriorityType = 'low' | 'medium' | 'high' | 'critical';

export interface ClassificationResult {
  department: string;
  priority: ComplaintPriorityType;
  aiPriority: ComplaintPriorityType;
  systemPriority: ComplaintPriorityType;
  aiDepartment: string | null;
  systemDepartment: string | null;
  aiSuggestedDepartment: string | null;
  systemSuggestedDepartment: string | null;
}

const PRIORITY_RANKS: Record<ComplaintPriorityType, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

/**
 * Health check for AI API configuration at startup or diagnostic time.
 */
export const checkAiHealth = async (): Promise<{ ok: boolean; model: string; error?: string }> => {
  if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'MISSING_KEY') {
    return { ok: false, model: GROQ_MODEL, error: 'GROQ_API_KEY environment variable is missing.' };
  }
  try {
    const response = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: 'Respond with valid JSON: {"status":"ok"}' }],
      max_tokens: 30,
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });
    const content = response.choices[0]?.message?.content;
    if (content) {
      return { ok: true, model: GROQ_MODEL };
    }
    return { ok: false, model: GROQ_MODEL, error: 'Empty response returned by AI model.' };
  } catch (err: any) {
    return { ok: false, model: GROQ_MODEL, error: err?.message || String(err) };
  }
};

/**
 * Evaluates system rule priority based on emergency/severity keywords.
 */
export const determineSystemPriority = (text: string, hasKeywordMatch: boolean): ComplaintPriorityType => {
  const lower = text.toLowerCase();

  // 1. Critical Emergency Keywords (Immediate hazard to life/property)
  const criticalKeywords = [
    'sparking',
    'sparks',
    'fire',
    'smoke',
    'shock',
    'electric shock',
    'short circuit',
    'burst pipe',
    'pipe burst',
    'gas leak',
    'gas smell',
    'flooding',
    'total power outage',
    'complete outage',
    'explosion',
    'transformer blast',
    'burning smell',
    'live wire',
    'hanging wire'
  ];

  if (criticalKeywords.some(kw => lower.includes(kw))) {
    return 'critical';
  }

  // 2. High Severity Keywords (Substantial disruption/security/sanitation risk)
  const highKeywords = [
    'power outage',
    'outage',
    'blackout',
    'no water',
    'water cut',
    'broken lock',
    'door lock broken',
    'leak',
    'water leak',
    'sewage',
    'tripping',
    'breaker tripping',
    'elevator stuck',
    'lift stuck',
    'alarm ringing',
    'theft',
    'trespassing',
    'fight'
  ];

  if (highKeywords.some(kw => lower.includes(kw))) {
    return 'high';
  }

  // 3. Low Severity Keywords (Cosmetic, minor aesthetic issues)
  const lowKeywords = [
    'paint scratch',
    'minor scratch',
    'cosmetic',
    'dirty lobby',
    'dusty',
    'light bulb dim',
    'garden weed',
    'lawn grass',
    'suggestion',
    'inquiry'
  ];

  if (lowKeywords.some(kw => lower.includes(kw))) {
    return 'low';
  }

  // Default system rule: medium if keyword match, otherwise medium
  return 'medium';
};

/**
 * Invokes LLM via Groq with dynamic departments fetched from MongoDB.
 * Runs BOTH keyword/system matching and AI classification.
 * Evaluates BOTH System Rule Priority and AI Assessment Priority, resolving final priority
 * using the highest-rank-wins rule: low (1) < medium (2) < high (3) < critical (4).
 */
export const classifyComplaint = async (
  text: string,
  validDepartments: { name: string; description?: string; keywords: string[] }[]
): Promise<ClassificationResult | null> => {
  const allowedPriorities: ComplaintPriorityType[] = ['low', 'medium', 'high', 'critical'];
  const normalizedText = text.toLowerCase();

  console.log(`[AI Routing] Initiating classification for complaint: "${text.slice(0, 70)}..."`);
  console.log(`[AI Routing] Dynamic departments passed (${validDepartments.length}):`, validDepartments.map(d => d.name));

  // 1. Determine keyword/system department match
  const keywordMatches = validDepartments
    .flatMap(department => (department.keywords || []).map(keyword => ({
      department: department.name,
      keyword: keyword.toLowerCase().trim()
    })))
    .filter(match => match.keyword && normalizedText.includes(match.keyword))
    .sort((left, right) => right.keyword.length - left.keyword.length);

  const matchedDepartmentName = keywordMatches.length > 0 ? keywordMatches[0].department : null;
  console.log(`[AI Routing] Keyword/System match result: ${matchedDepartmentName ? `"${matchedDepartmentName}" (via matched keyword: "${keywordMatches[0].keyword}")` : 'None (No keywords matched)'}`);

  // 2. Determine System Rule Priority
  const systemPriority = determineSystemPriority(text, Boolean(matchedDepartmentName));

  // 3. Prepare AI Prompt with dynamic active/approved department names and descriptions
  const departmentsContext = validDepartments.map(d => ({
    name: d.name,
    description: d.description || '',
    keywords: d.keywords || []
  }));

  const prompt = `You are an expert autonomous dispatcher system for a residential community.
Analyze the following user complaint and strictly classify it.

ALLOWED DEPARTMENTS (You MUST select ONLY a department name from this exact list):
${JSON.stringify(departmentsContext, null, 2)}

ALLOWED PRIORITIES: ${JSON.stringify(allowedPriorities)}
Priority Guidelines:
- critical: Immediate safety hazards, sparks, fire, smoke, gas leaks, complete power failure, flooding, live wires.
- high: Substantial disruption, severe water leaks, partial power loss, lift failure, security breaches.
- medium: Standard maintenance faults, appliance repairs, routine plumbing/carpentry.
- low: Minor cosmetic issues, lawn maintenance, general questions.

RULES:
1. Return ONLY the department name exactly as provided in ALLOWED DEPARTMENTS. No guessing.
2. If unsure, choose the closest valid department based on context and description.
3. Assess the priority realistically based on severity and urgency.

Return exactly ONE valid JSON object with the following keys without markdown or explanations:
{
  "department": "<choose exactly one from ALLOWED DEPARTMENTS based on context>",
  "priority": "<choose exactly one from: low, medium, high, critical>"
}

Complaint Text: "${text}"`;

  let aiDepartment: string | null = null;
  let aiPriority: ComplaintPriorityType = systemPriority; // Fallback if AI fails

  try {
    const aiPromise = groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: GROQ_MODEL,
      temperature: 0.1,
      max_tokens: 150,
      response_format: { type: 'json_object' }
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI Classification Timeout (6s)')), 6000)
    );

    const completion = (await Promise.race([aiPromise, timeoutPromise])) as any;
    const content = completion.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      if (parsed.department) {
        // Validate that AI returned a valid department name from the dynamic list (case-insensitive)
        const matchedValidDept = validDepartments.find(
          d => d.name.trim().toLowerCase() === String(parsed.department).trim().toLowerCase()
        );
        if (matchedValidDept) {
          aiDepartment = matchedValidDept.name;
        } else {
          console.warn(`[AI Routing] AI returned "${parsed.department}" which was not in the dynamic list.`);
        }
      }
      if (parsed.priority && allowedPriorities.includes(parsed.priority.toLowerCase())) {
        aiPriority = parsed.priority.toLowerCase() as ComplaintPriorityType;
      }
    }
    console.log(`[AI Routing] AI API result: Department: "${aiDepartment || 'None'}", Priority: "${aiPriority}"`);
  } catch (error: any) {
    console.error(`[AI Routing] ❌ AI API error: ${error.message} - Falling back gracefully.`);
  }

  // 4. Resolve Final Department:
  // AI-validated department takes precedence if AI picked an active department.
  // If AI failed or returned nothing, fall back to keyword match, then the first dynamic department.
  const finalDepartment = aiDepartment || matchedDepartmentName || (validDepartments[0]?.name || 'General');

  // 5. Highest-Rank-Wins Rule for Final Priority:
  // low (1) < medium (2) < high (3) < critical (4)
  const systemRank = PRIORITY_RANKS[systemPriority] || 2;
  const aiRank = PRIORITY_RANKS[aiPriority] || 2;
  const resolvedPriority: ComplaintPriorityType = systemRank >= aiRank ? systemPriority : aiPriority;

  console.log(`[AI Routing Summary] Text: "${text.slice(0, 45)}..." | System Match: [${matchedDepartmentName || 'None'} / ${systemPriority}] | AI Result: [${aiDepartment || 'None'} / ${aiPriority}] | Final Routed: [${finalDepartment} / ${resolvedPriority}]`);

  return {
    department: finalDepartment,
    priority: resolvedPriority,
    aiPriority,
    systemPriority,
    aiDepartment,
    systemDepartment: matchedDepartmentName,
    aiSuggestedDepartment: aiDepartment,
    systemSuggestedDepartment: matchedDepartmentName
  };
};
