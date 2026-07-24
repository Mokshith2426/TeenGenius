/**
 * Centralized subject detection utility for TeenGenius.
 * Used across all AI-powered features for consistent subject classification.
 */

export type Subject = 
  | 'Mathematics'
  | 'Physics'
  | 'Chemistry'
  | 'Biology'
  | 'English'
  | 'Social Science'
  | 'Computer Science'
  | 'Economics'
  | 'Accountancy'
  | 'Business Studies'
  | 'Political Science'
  | 'Geography'
  | 'History'
  | 'Civics'
  | 'General Science'
  | 'Telugu'
  | 'Hindi'
  | 'General';

/**
 * Detects the academic subject from text using keyword matching.
 * Returns the detected subject or null if no match found.
 */
export function detectSubject(text: string): Subject | null {
  if (!text || typeof text !== 'string') return null;
  
  const lower = text.toLowerCase();
  
  // Mathematics
  if (/\b(solve|equation|matrix|matrices|integral|integration|derivative|calculus|algebra|theorem|triangle|geometry|fraction|trigonometry|logarithm|sum|probability|ratio|percentage|\+|-|\*|\/|=)\b/.test(lower)) {
    return 'Mathematics';
  }
  
  // Physics
  if (/\b(force|velocity|acceleration|gravity|photon|quantum|optics|lens|relativity|thermodynamics|energy|power|watt|joule|friction|motion|magnet|electricity|ohm|voltage)\b/.test(lower)) {
    return 'Physics';
  }
  
  // Chemistry
  if (/\b(reaction|acid|base|ph|molecule|atom|element|organic|valency|solution|catalyst|chemistry|covalent|ionic|gas|liquid|solid|periodic table)\b/.test(lower)) {
    return 'Chemistry';
  }
  
  // Biology
  if (/\b(cell|mitosis|meiosis|photosynthesis|dna|rna|gene|genetics|evolution|organism|bacteria|virus|plant|animal|species|human body|anatomy|ecology|respiration)\b/.test(lower)) {
    return 'Biology';
  }
  
  // Computer Science
  if (/\b(programming|code|binary|python|javascript|java|compiler|algorithm|loop|array|variable|database|sql|html|css|software|hardware|network|server)\b/.test(lower)) {
    return 'Computer Science';
  }
  
  // Languages
  if (/\b(telugu|andhra|telangana)\b/.test(lower)) {
    return 'Telugu';
  }
  
  if (/\b(hindi|bharat|constitution|swaraj)\b/.test(lower)) {
    return 'Hindi';
  }
  
  if (/\b(essay|poem|grammar|literature|noun|verb|adjective|tense|vocabulary|shakespeare|sonnet|pronoun|paragraph)\b/.test(lower)) {
    return 'English';
  }
  
  // Social Science
  if (/\b(history|social|geography|revolution|civic|economics|democracy|freedom|constitution|continent|ocean|climate|map)\b/.test(lower)) {
    return 'Social Science';
  }
  
  // General Science
  if (/\b(science|experiment|laboratory|scientific|hypothesis|phenomenon)\b/.test(lower)) {
    return 'General Science';
  }
  
  return null;
}

/**
 * Gets a user-friendly display name for a subject.
 */
export function getSubjectDisplayName(subject: Subject | string): string {
  const displayNames: Record<string, string> = {
    'Mathematics': 'Mathematics',
    'Physics': 'Physics',
    'Chemistry': 'Chemistry',
    'Biology': 'Biology',
    'English': 'English',
    'Social Science': 'Social Science',
    'Computer Science': 'Computer Science',
    'Economics': 'Economics',
    'Accountancy': 'Accountancy',
    'Business Studies': 'Business Studies',
    'Political Science': 'Political Science',
    'Geography': 'Geography',
    'History': 'History',
    'Civics': 'Civics',
    'General Science': 'General Science',
    'Telugu': 'Telugu',
    'Hindi': 'Hindi',
    'General': 'General',
  };
  
  return displayNames[subject] || subject;
}