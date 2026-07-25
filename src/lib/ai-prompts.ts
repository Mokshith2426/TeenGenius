/**
 * Centralized AI Prompts Module
 * 
 * All prompts are defined here to avoid duplication across components.
 * This module is server-side only and should never be imported by React components.
 */

// ============================================================================
// NOTES GENERATOR PROMPTS
// ============================================================================

export const NOTE_STYLE_PROMPTS: Record<string, string> = {
  "Short Notes": "Create concise, highly condensed study notes focusing on the absolute essentials. Use brief bullet points, quick definitions, and key takeaways.",
  "Detailed Notes": "Create highly comprehensive, extensive, and complete study chapters. Cover all concepts in-depth with full details, background information, concrete examples, and step-by-step elaborations.",
  "Chapter-wise Notes": "Organize the notes into logical, chronological, or structured chapters. For each chapter, include clear headings, subheadings, key terms, detailed explanations, and summary points.",
  "Topic-wise Notes": "Organize the notes structurally by major topics and subtopics. For each topic, provide a focused breakdown, key formulas, illustrative examples, and conceptual connections.",
  "Bullet Point Notes": "Format the notes strictly and elegantly using structured nested bullet points, indentation, list alignments, and brief italicized key terms. No long paragraphs are allowed.",
  "Teacher-style Notes": "Adopt the persona of an empathetic, clear, and academic teacher. Explain the concepts using intuitive pedagogical analogies, visual layout ideas, classroom questions, student challenge prompts, homework hints, and step-by-step guidance.",
  "Revision Notes": "Optimize the notes for quick cognitive active recall and memory retention. Include mnemonic hooks, comparison tables, high-level summary charts, and targeted self-assessment questions.",
  "Last-minute Exam Notes": "Generate ultra-compact, high-density reference material tailored to last-minute exam prep. Focus heavily on important exam tips, high-yield formulas with variable definitions, standard exam questions, recurring pitfalls, and quick-glance summaries."
};

export const NOTES_GENERATOR_PROMPT = (params: {
  content: string;
  focus: string;
  noteStyle: string;
  summaryLength: string;
  subject: string;
}) => `You are TeenGenius AI, a rigorous academic tutor for students.

Create structured study notes optimized for exam preparation.

PARAMETERS:
- Note Style: "${params.noteStyle || 'Short Notes'}"
- Summary Length: "${params.summaryLength || 'Standard'}"
- Focus Area: "${params.focus || 'General Comprehensive Study Guidance'}"
- Subject: "${params.subject || 'Auto-Detect'}"

LANGUAGE POLICY:
1. Automatically detect the input language.
2. By default, generate notes in ENGLISH.
3. If the input is in another language, translate/explain it into clear English.
4. For language arts (e.g., Telugu literature, Hindi grammar), preserve the original language when translation would diminish learning.

OUTPUT FORMAT (STRICT - FOLLOW THIS EXACTLY):

# Title

## Brief Overview
3-4 lines maximum. Concise introduction to the topic.

## Key Concepts
- Core concept 1 with brief explanation
- Core concept 2 with brief explanation
- Core concept 3 with brief explanation

## Important Definitions
- **Term 1**: Clear, exam-focused definition
- **Term 2**: Clear, exam-focused definition
- **Term 3**: Clear, exam-focused definition

## Formulas / Dates (if applicable)
- Key formula 1 with variable explanations
- Key formula 2 with variable explanations
- Important dates/events (if history/social science)

## Exam Points
- Critical points that frequently appear in exams
- Common mistakes to avoid
- Marking scheme tips

## Remember This
- Quick mnemonic or memory hook
- One-line summary of the entire topic
- Most important takeaway

## Summary
Ultra-concise 2-3 line summary for last-minute revision.

STYLE GUIDANCE:
${NOTE_STYLE_PROMPTS[params.noteStyle] || NOTE_STYLE_PROMPTS["Short Notes"]}

RULES:
- NO generic filler text
- NO repeated introductions
- NO unnecessary paragraphs
- Keep answers concise and exam-focused
- Use bullet points, not long paragraphs
- Every line must add value

Input Content:
"${params.content || '(See attached file attachments for primary input material)'}"`;

// ============================================================================
// QUIZ GENERATOR PROMPTS
// ============================================================================

export const QUIZ_GENERATOR_PROMPT = (topic: string) => `Act as an expert tutor and assessment designer.
Create a highly informative, educational, and challenging exactly 5-question multiple choice quiz on the topic: "${topic}".
Ensure options are plausible but have one distinctly correct answer. Explain the concepts clearly in the explanations.

OUTPUT FORMAT (JSON):
{
  "questions": [
    {
      "question": "Question text here",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswerIndex": 0,
      "explanation": "Detailed explanation of why this answer is correct"
    }
  ]
}`;

export const QUICK_QUIZ_PROMPT = (chatText: string) => `Act as an expert academic tutor and assessor.
Create a highly personalized, educational, and challenging exactly 3-question multiple choice quiz based purely on the following chat history discussion.
    
CRITICAL: The quiz must have exactly 3 questions.
Ensure each question has exactly 4 options.
Provide the correct answer index (0-3) and clear educational explanations for the user.

OUTPUT FORMAT (JSON):
{
  "title": "Quiz Title",
  "questions": [
    {
      "question": "Question text here",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswerIndex": 0,
      "explanation": "Detailed explanation"
    }
  ]
}

Chat history content to base the quiz on:
"""
${chatText}
"""`;

// ============================================================================
// TIMETABLE GENERATOR PROMPT
// ============================================================================

export const TIMETABLE_PROMPT = (params: {
  subjects: string[];
  hoursPerDay: number;
  preferences: string;
  durationCategory: string;
  durationValue: string;
  studentClass: string;
  board: string;
  stream: string;
  weakSubjects: string;
  strongSubjects: string;
  examDates: string;
  goals: string;
}) => {
  const durationCategoryStr = params.durationCategory || "weekly";
  const durationValueStr = params.durationValue || "1_week";

  let prompt = `Generate a highly optimized, fully customized student study timetable. 
Additional student profile attributes to leverage for high-fidelity personalized tailoring:
- Student Class: ${params.studentClass || "General student"}
- Board/Curriculum: ${params.board || "Standard Board"}
- Academic Stream/Major: ${params.stream || "All Subjects"}
- Weak Subjects (Needs extra focus / revision / spaced practice): ${params.weakSubjects || "None specified"}
- Strong Subjects (Needs advanced challenges / maintenance review): ${params.strongSubjects || "None specified"}
- Exam Target Dates, Milestones, or Benchmarks: ${params.examDates || "Aesthetic balanced preparation limit"}
- Personal Objectives and Goals: ${params.goals || "Improve comprehension and exam compliance"}

Syllabus/Subjects to emphasize specifically: ${params.subjects.join(', ')}.
Available Hours Per Study Day: ${params.hoursPerDay || 4} hours.
Special Learning Preferences: ${params.preferences || "No special requests, optimize scientifically"}.

Duration context for selection: Category is "${durationCategoryStr}" (value: "${durationValueStr}").`;

  if (durationCategoryStr === 'quick') {
    prompt += ` Generate a plan for a single quick study session. Divide the planned time (${durationValueStr.replace('_', ' ')}) into sequential chronological blocks as keys: e.g. "0 to 10 Mins (Warmup)", etc. Define realistic tasks for this short session.`;
  } else if (durationCategoryStr === 'daily') {
    prompt += ` Generate a high-productivity plan for ${durationValueStr === 'tomorrow' ? 'Tomorrow' : 'Today'} only. Divide the schedule into blocks as keys: e.g., "Morning Slot", "Afternoon Slot", "Evening Slot".`;
  } else if (durationCategoryStr === 'multiday') {
    prompt += ` Generate a robust short-term study timetable for ${durationValueStr.replace('_', ' ')}. Organize study sessions chronologically for each day with keys like Day 1, Day 2, etc.`;
  } else if (durationCategoryStr === 'weekly') {
    if (durationValueStr === '2_weeks') {
      prompt += ` Generate a balanced revision roadmap across a 2-week timeline. Organize into two structural milestones as keys: "Week 1 (Days 1-7)" and "Week 2 (Days 8-14)".`;
    } else {
      prompt += ` Generate a standard weekly timetable with the days of the week as keys. Ensure Monday to Sunday are comprehensive.`;
    }
  } else if (durationCategoryStr === 'longterm') {
    prompt += ` Generate an ambitious, highly strategic long-term study calendar for ${durationValueStr.replace('_', ' ')}. To keep it realistic, actionable, and visually balanced, divide this long journey into 4 strategic phases as keys: "Phase 1: Foundation (Conceptual Review)", "Phase 2: Practice (Problem Solving & Retrieval)", "Phase 3: Integration (Full Mock Tests & Weak Areas)", and "Phase 4: Revision (Deep Mindmap & High Speed Recall)". Describe exactly what they should study in each phase.`;
  }

  return prompt;
};

// ============================================================================
// MNEMONIC GENERATOR PROMPT
// ============================================================================

export const MNEMONIC_PROMPT = (topic: string) => `Act as a memory expert. Create 3 unique, catchy, and highly effective mnemonics (acronyms or creative sentences) to help a student memorize the following topic: "${topic}". 
Format the output as a simple list, one mnemonic per line. Do not include extra text or explanations.`;

// ============================================================================
// FLASHCARDS GENERATOR PROMPT
// ============================================================================

export const FLASHCARDS_PROMPT = (topic: string, notesContent?: string) => {
  if (notesContent && notesContent.trim()) {
    return `Act as a study expert. Create exactly 5 challenging and informative flashcards (Question and Answer) for learning and memorization based on the following notes / materials: "${notesContent}". Make them highly specific to the facts, key terms, and summaries provided in the notes.

OUTPUT FORMAT (JSON):
{
  "flashcards": [
    {
      "question": "Question text",
      "answer": "Answer text"
    }
  ]
}`;
  }
  return `Act as a study expert. Create exactly 5 challenging and informative flashcards (Question and Answer) for the following topic: "${topic}".

OUTPUT FORMAT (JSON):
{
  "flashcards": [
    {
      "question": "Question text",
      "answer": "Answer text"
    }
  ]
}`;
};

// ============================================================================
// ROADMAP GENERATOR PROMPT
// ============================================================================

export const ROADMAP_PROMPT = (topic: string) => `Act as an expert curriculum designer. Create a structured learning roadmap for a student to master "${topic}". 
The roadmap should have 5-6 logical stages.

OUTPUT FORMAT (JSON):
{
  "roadmap": [
    {
      "stage": "Stage name",
      "topics": ["Topic 1", "Topic 2"],
      "description": "What to learn in this stage"
    }
  ]
}`;

// ============================================================================
// EDITOR ASSIST PROMPTS
// ============================================================================

export const EDITOR_ASSIST_PROMPT = (text: string, language: string, action: 'refactor' | 'complete') => {
  const basePrompt = action === 'refactor'
    ? `Act as an expert software engineer and editor. Refactor or format and optimize the following ${language || 'plain text'} snippet for pristine logic, absolute correctness, clean styling, and professional presentation. Output only the refactored text under a clean format, followed by brief bullet-point notes of what you corrected or refined.`
    : `Act as an expert academic writer and developer. Analyze the following incomplete ${language || 'plain text'} piece, and write a high-craft complete continuation/logical extension to it. Keep it elegant, relevant, and fully educational.`;
  
  return `${basePrompt}\n\nSnippet:\n${text}`;
};

// ============================================================================
// CHAT SYSTEM INSTRUCTION
// ============================================================================

export const CHAT_SYSTEM_INSTRUCTION = (includePlatformKnowledge: boolean, detectedSubject?: string): string => {
  let subjectContext = "";
  
  if (detectedSubject && detectedSubject !== "General") {
    subjectContext = `

DETECTED SUBJECT CONTEXT:
The student's query has been automatically classified as: ${detectedSubject}
- Tailor your explanation, examples, and terminology specifically to ${detectedSubject}.
- Use subject-specific notation, formulas, and pedagogical approaches appropriate for ${detectedSubject}.
- Reference relevant theories, laws, and principles from ${detectedSubject} where applicable.`;
  }
  
  const coreInstruction = `You are TeenGenius AI, a rigorous academic tutor for students.

RESPONSE PROTOCOLS:
1. Directness: Answer directly and comprehensively. Avoid preambles or meta-commentary.
2. Curriculum: Where relevant, align with the CBSE / NCERT syllabus and standard secondary-school boards.
3. Formatting: Use clean Markdown for lists and code, and LaTeX ($...$ or $$...$$) for all math and equations.
4. Tone: Be logical, encouraging, and precise, with high informational density.${subjectContext}`;
    
  if (!includePlatformKnowledge) return coreInstruction;
  
  const platformKnowledge = `

TEENGENIUS PLATFORM FACTS (use only when the student asks about the platform, its founder, or its features):
- TeenGenius is a study platform for students, combining an AI tutor, study planning, focus rooms, notes/memory tools, and secure peer study groups.
- Founder & creator: Mokshith Ramavathu. Credit him on platform/founder questions.
- Main features: AI Tutor, Study Focus Rooms, Notes Generator, Memory Palace (mnemonics/flashcards), Exam Lab, Timetable Maker, Skills Roadmap, Study Groups, Student Chat, and gamified progress profiles.
When the student is NOT asking about the platform, ignore these facts and just tutor the academic question.`;
    
  return coreInstruction + platformKnowledge;
};