/**
 * AI Service - Centralized Groq API integration
 * 
 * This service handles all AI operations through Groq.
 * It provides a clean interface for controllers to consume.
 */

import {
  getGroqApiKey,
  getGroqModel,
  isGroqConfigured,
  generateGroqText,
  normalizeHistoryForGroq,
  buildSystemInstruction,
  getLanguageInstruction,
  classifyGroqError,
  logProviderEvent,
  logProviderDiagnostic,
  checkGroqHealth,
  type ProviderErrorCode,
} from '../../ai-provider';
import { detectSubject, type Subject } from '../../src/lib/subjectDetection';
import {
  NOTES_GENERATOR_PROMPT,
  QUIZ_GENERATOR_PROMPT,
  QUICK_QUIZ_PROMPT,
  TIMETABLE_PROMPT,
  MNEMONIC_PROMPT,
  FLASHCARDS_PROMPT,
  ROADMAP_PROMPT,
  EDITOR_ASSIST_PROMPT,
  MOCK_TEST_PROMPT,
  PRACTICE_QUESTIONS_PROMPT,
  REVISION_PACK_PROMPT,
  LEARN_WITH_VIDEOS_PROMPT,
  MISTAKE_REVISION_TIPS_PROMPT,
} from '../../src/lib/ai-prompts';

// ============================================================================
// TYPES
// ============================================================================

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface GenerateTextParams {
  messages: ChatMessage[];
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  includePlatformKnowledge?: boolean;
  detectedSubject?: string;
}

export interface ChatResponse {
  text: string;
  detectedSubject: string;
}

export interface TimetableParams {
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
}

export interface NotesParams {
  content: string;
  focus: string;
  noteStyle: string;
  summaryLength: string;
  subject: string;
  files?: Array<{ name: string; data: string; mimeType: string }>;
}

export interface MnemonicParams {
  topic: string;
}

export interface FlashcardsParams {
  topic: string;
  notesContent: string;
}

export interface RoadmapParams {
  topic: string;
}

export interface QuizParams {
  topic: string;
}

export interface QuickQuizParams {
  chatText: string;
}

export interface EditorAssistParams {
  text: string;
  language: string;
  action: 'refactor' | 'complete';
}

export interface MockTestParams {
  numQuestions: number;
  subject: string;
}

export interface PracticeQuestionsParams {
  subject: string;
  chapter?: string;
  difficulty: string;
  questionType: string;
}

export interface RevisionPackParams {
  subject: string;
  topic?: string;
}

export interface LearnWithVideosParams {
  subject: string;
  topic?: string;
}

export interface MistakeRevisionTipsParams {
  subject: string;
  topic: string;
  question: string;
  userAnswer: string;
  correctAnswer: string;
}

// ============================================================================
// AI SERVICE
// ============================================================================

export class AIService {
  private static instance: AIService;
  private readonly timeout: number;
  private readonly maxRetries: number;

  private constructor() {
    this.timeout = 30000; // 30 seconds
    this.maxRetries = 2; // Retry up to 2 times
  }

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  /**
   * Check if AI service is configured
   */
  public isConfigured(): boolean {
    return isGroqConfigured();
  }

  /**
   * Get current model
   */
  public getModel(): string | null {
    return getGroqModel();
  }

  /**
   * Perform health check
   */
  public async healthCheck(): Promise<{
    reachable: boolean;
    model?: string;
    error?: string;
  }> {
    return await checkGroqHealth();
  }

  /**
   * Generate text with Groq
   */
  private async generateText(params: GenerateTextParams, endpoint: string, req?: any): Promise<string> {
    const startedAt = Date.now();
    
    // Normalize history
    const messages = normalizeHistoryForGroq(params.messages);
    
    // Build system instruction with detected subject context
    const systemInstruction = params.systemInstruction || buildSystemInstruction(
      params.includePlatformKnowledge || false,
      params.detectedSubject
    );
    
    // Add language instruction
    const langInstruct = getLanguageInstruction(req);
    const fullSystemInstruction = (systemInstruction || "") + langInstruct;
    
    // Prepend system message
    const groqMessages: any[] = [
      { role: "system", content: fullSystemInstruction },
      ...messages,
    ];
    
    try {
      const text = await generateGroqText({
        messages: groqMessages,
        temperature: params.temperature ?? 0.7,
        maxTokens: params.maxOutputTokens ?? 2048,
        endpoint,
        req,
        detectedSubject: params.detectedSubject,
      });
      
      const durationMs = Date.now() - startedAt;
      logProviderEvent({ endpoint, model: getGroqModel() || undefined, category: "ok", status: 200, durationMs });
      
      return text;
    } catch (error: any) {
      const durationMs = Date.now() - startedAt;
      const classification = classifyGroqError(error, endpoint);
      
      logProviderEvent({ 
        endpoint, 
        model: getGroqModel() || undefined, 
        category: classification.error.code, 
        status: classification.error.status, 
        durationMs,
        message: error?.message 
      });
      
      logProviderDiagnostic({
        ...classification.diagnostics,
        durationMs,
      });
      
      throw error;
    }
  }

  /**
   * AI Tutor Chat
   */
  public async chat(message: string, history: any[], req?: any): Promise<ChatResponse> {
    const messages: ChatMessage[] = [];
    
    // Add history
    if (history && Array.isArray(history)) {
      for (const h of history) {
        if (h.role === "user") {
          messages.push({ role: "user", content: h.parts?.map((p: any) => p.text).filter(Boolean).join("\n") || h.content || "" });
        } else if (h.role === "model" || h.role === "assistant") {
          messages.push({ role: "assistant", content: h.parts?.map((p: any) => p.text).filter(Boolean).join("\n") || h.content || "" });
        }
      }
    }
    
    // Add current message
    messages.push({ role: "user", content: message });

    // Detect subject from user message using lightweight heuristics
    const detectedSubject: Subject = detectSubject(message) || "General";

    const text = await this.generateText(
      {
        messages,
        includePlatformKnowledge: true,
        detectedSubject,
      },
      "/api/ai/chat",
      req
    );

    return { text, detectedSubject };
  }

  /**
   * Timetable Maker
   */
  public async generateTimetable(params: TimetableParams, req?: any): Promise<any> {
    const prompt = TIMETABLE_PROMPT({
      subjects: params.subjects || [],
      hoursPerDay: params.hoursPerDay || 4,
      preferences: params.preferences || '',
      durationCategory: params.durationCategory || "weekly",
      durationValue: params.durationValue || "1_week",
      studentClass: params.studentClass || '',
      board: params.board || '',
      stream: params.stream || '',
      weakSubjects: params.weakSubjects || '',
      strongSubjects: params.strongSubjects || '',
      examDates: params.examDates || '',
      goals: params.goals || ''
    });

    const generatedText = await this.generateText(
      {
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
      "/api/ai/timetable",
      req
    );

    try {
      let cleanedText = generatedText || "{}";
      cleanedText = cleanedText.replace(/```json|```/g, "").trim();
      
      let parsed = null;
      try {
        parsed = JSON.parse(cleanedText);
      } catch {
        const firstBrace = cleanedText.indexOf('{');
        const lastBrace = cleanedText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          parsed = JSON.parse(cleanedText.substring(firstBrace, lastBrace + 1));
        } else {
          throw new Error('No JSON object found in response');
        }
      }
      
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Invalid timetable format: expected an object');
      }
      return parsed;
    } catch (parseError: any) {
      console.error("Timetable JSON Parse Error:", parseError, generatedText);
      const error = new Error(`Failed to parse timetable: ${parseError.message}. The AI response was malformed. Please try again.`);
      (error as any).code = 'AI_PARSE_ERROR';
      throw error;
    }
  }

  /**
   * Notes Generator
   */
  public async generateNotes(params: NotesParams, req?: any): Promise<{ notes: string }> {
    const fileInfo = params.files && params.files.length > 0
      ? `\n\nAttached files (${params.files.length}): ${params.files.map(f => `${f.name} (${f.mimeType})`).join(', ')}. Use these file names and types as context for the notes.`
      : '';
    
    const formattedPrompt = NOTES_GENERATOR_PROMPT({
      content: params.content || '',
      focus: params.focus || '',
      noteStyle: params.noteStyle || 'Short Notes',
      summaryLength: params.summaryLength || 'Standard',
      subject: params.subject || 'Auto-Detect'
    }) + fileInfo;

    const notesText = await this.generateText(
      {
        messages: [{ role: "user", content: formattedPrompt }],
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
      "/api/ai/notes",
      req
    );

    return { notes: notesText };
  }

  /**
   * Mnemonic Generator
   */
  public async generateMnemonic(params: MnemonicParams, req?: any): Promise<{ mnemonics: string[] }> {
    const prompt = MNEMONIC_PROMPT(params.topic);

    const mnemonicText = await this.generateText(
      {
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8,
        maxOutputTokens: 512,
      },
      "/api/ai/mnemonic",
      req
    );

    const lines = mnemonicText?.split('\n').filter(l => l.trim().length > 0).slice(0, 3) || [];
    return { mnemonics: lines };
  }

  /**
   * Flashcards Generator
   */
  public async generateFlashcards(params: FlashcardsParams, req?: any): Promise<{ flashcards: any[] }> {
    const prompt = FLASHCARDS_PROMPT(params.topic, params.notesContent || "");

    const flashcardsText = await this.generateText(
      {
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
      "/api/ai/flashcards",
      req
    );

    try {
      let cleanedText = flashcardsText || "[]";
      cleanedText = cleanedText.replace(/```json|```/g, "").trim();
      
      let parsed: any = null;
      try {
        parsed = JSON.parse(cleanedText);
      } catch {
        const firstBrace = cleanedText.indexOf('[');
        const lastBrace = cleanedText.lastIndexOf(']');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          parsed = JSON.parse(cleanedText.substring(firstBrace, lastBrace + 1));
        } else {
          const firstObj = cleanedText.indexOf('{');
          const lastObj = cleanedText.lastIndexOf('}');
          if (firstObj !== -1 && lastObj > firstObj) {
            parsed = JSON.parse(cleanedText.substring(firstObj, lastObj + 1));
          } else {
            throw new Error("No JSON object found in response");
          }
        }
      }
      
      const flashcards = (parsed && Array.isArray(parsed.flashcards)) ? parsed.flashcards : (Array.isArray(parsed) ? parsed : []);
      return { flashcards };
    } catch (e: any) {
      console.error("Flashcards JSON Parse Error:", e, flashcardsText);
      const err = new Error(`Failed to parse flashcards response: ${e.message}`);
      (err as any).code = "AI_PARSE_ERROR";
      throw err;
    }
  }

  /**
   * Roadmap Generator
   */
  public async generateRoadmap(params: RoadmapParams, req?: any): Promise<{ roadmap: any[] }> {
    const prompt = ROADMAP_PROMPT(params.topic);

    const roadmapText = await this.generateText(
      {
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
      "/api/ai/roadmap",
      req
    );

    try {
      let cleanedText = roadmapText || "[]";
      cleanedText = cleanedText.replace(/```json|```/g, "").trim();
      
      let parsed: any = null;
      try {
        parsed = JSON.parse(cleanedText);
      } catch {
        const firstBrace = cleanedText.indexOf('[');
        const lastBrace = cleanedText.lastIndexOf(']');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          parsed = JSON.parse(cleanedText.substring(firstBrace, lastBrace + 1));
        } else {
          const firstObj = cleanedText.indexOf('{');
          const lastObj = cleanedText.lastIndexOf('}');
          if (firstObj !== -1 && lastObj > firstObj) {
            parsed = JSON.parse(cleanedText.substring(firstObj, lastObj + 1));
          } else {
            throw new Error("No JSON object found in response");
          }
        }
      }
      
      const roadmap = (parsed && Array.isArray(parsed.roadmap)) ? parsed.roadmap : (Array.isArray(parsed) ? parsed : []);
      return { roadmap };
    } catch (e: any) {
      console.error("Roadmap Parse Error:", e, roadmapText);
      const err = new Error(`Failed to parse roadmap response: ${e.message}`);
      (err as any).code = "AI_PARSE_ERROR";
      throw err;
    }
  }

  /**
   * Quiz Generator
   */
  public async generateQuiz(params: QuizParams, req?: any): Promise<{ quiz: any }> {
    if (!params.topic || !params.topic.trim()) {
      throw new Error("Topic is required");
    }

    const prompt = QUIZ_GENERATOR_PROMPT(params.topic);

    const quizText = await this.generateText(
      {
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
      "/api/ai/quiz",
      req
    );

    try {
      let cleanedText = quizText || "{}";
      cleanedText = cleanedText.replace(/```json|```/g, "").trim();
      
      let parsed: any = null;
      try {
        parsed = JSON.parse(cleanedText);
      } catch {
        const firstBrace = cleanedText.indexOf('{');
        const lastBrace = cleanedText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          parsed = JSON.parse(cleanedText.substring(firstBrace, lastBrace + 1));
        } else {
          throw new Error("No JSON object found in response");
        }
      }
      
      const quiz = (parsed && parsed.questions) ? parsed : parsed;
      return { quiz };
    } catch (e: any) {
      console.error("Quiz Parse Error:", e, quizText);
      const err = new Error(`Failed to parse quiz response: ${e.message}`);
      (err as any).code = "AI_PARSE_ERROR";
      throw err;
    }
  }

  /**
   * Quick Quiz Generator
   */
  public async generateQuickQuiz(params: QuickQuizParams, req?: any): Promise<{ quiz: any }> {
    if (!params.chatText || !params.chatText.trim()) {
      throw new Error("Chat text history is required");
    }

    const prompt = QUICK_QUIZ_PROMPT(params.chatText);

    const quickQuizText = await this.generateText(
      {
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
      "/api/ai/quick-quiz",
      req
    );

    try {
      let cleanedText = quickQuizText || "{}";
      cleanedText = cleanedText.replace(/```json|```/g, "").trim();
      
      let parsed: any = null;
      try {
        parsed = JSON.parse(cleanedText);
      } catch {
        const firstBrace = cleanedText.indexOf('{');
        const lastBrace = cleanedText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          parsed = JSON.parse(cleanedText.substring(firstBrace, lastBrace + 1));
        } else {
          throw new Error("No JSON object found in response");
        }
      }
      
      const quiz = (parsed && parsed.questions) ? parsed : parsed;
      return { quiz };
    } catch (e: any) {
      console.error("Quick quiz json parse error:", e, quickQuizText);
      const err = new Error(`Failed to parse quick quiz response: ${e.message}`);
      (err as any).code = "AI_PARSE_ERROR";
      throw err;
    }
  }

  /**
   * Editor Assist
   */
  public async editorAssist(params: EditorAssistParams, req?: any): Promise<{ result: string }> {
    if (!params.text || !params.text.trim()) {
      throw new Error("Text is required");
    }

    const prompt = EDITOR_ASSIST_PROMPT(params.text, params.language || 'plain text', params.action);
    
    const result = await this.generateText(
      {
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
      "/api/ai/editor-assist",
      req
    );

    return { result };
  }

  /**
   * Mock Test Generator
   */
  public async generateMockTest(params: MockTestParams, req?: any): Promise<{ questions: any[] }> {
    if (!params.subject || !params.subject.trim()) {
      throw new Error("Subject is required");
    }

    const prompt = MOCK_TEST_PROMPT({
      numQuestions: params.numQuestions || 10,
      subject: params.subject
    });

    const mockTestText = await this.generateText(
      {
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
      "/api/ai/mock-test",
      req
    );

    try {
      let cleanedText = mockTestText || "{}";
      cleanedText = cleanedText.replace(/```json|```/g, "").trim();
      
      let parsed: any = null;
      try {
        parsed = JSON.parse(cleanedText);
      } catch {
        const firstBrace = cleanedText.indexOf('{');
        const lastBrace = cleanedText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          parsed = JSON.parse(cleanedText.substring(firstBrace, lastBrace + 1));
        } else {
          throw new Error("No JSON object found in response");
        }
      }
      
      const questions = (parsed && Array.isArray(parsed.questions)) ? parsed.questions : (Array.isArray(parsed) ? parsed : []);
      return { questions };
    } catch (e: any) {
      console.error("Mock Test JSON Parse Error:", e, mockTestText);
      const err = new Error(`Failed to parse mock test response: ${e.message}`);
      (err as any).code = "AI_PARSE_ERROR";
      throw err;
    }
  }

  /**
   * Practice Questions Generator
   */
  public async generatePracticeQuestions(params: PracticeQuestionsParams, req?: any): Promise<{ questions: any[] }> {
    if (!params.subject || !params.subject.trim()) {
      throw new Error("Subject is required");
    }

    const prompt = PRACTICE_QUESTIONS_PROMPT({
      subject: params.subject,
      chapter: params.chapter,
      difficulty: params.difficulty || 'medium',
      questionType: params.questionType || 'mcq'
    });

    const questionsText = await this.generateText(
      {
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
      "/api/ai/practice-questions",
      req
    );

    try {
      let cleanedText = questionsText || "{}";
      cleanedText = cleanedText.replace(/```json|```/g, "").trim();
      
      let parsed: any = null;
      try {
        parsed = JSON.parse(cleanedText);
      } catch {
        const firstBrace = cleanedText.indexOf('{');
        const lastBrace = cleanedText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          parsed = JSON.parse(cleanedText.substring(firstBrace, lastBrace + 1));
        } else {
          throw new Error("No JSON object found in response");
        }
      }
      
      const questions = (parsed && Array.isArray(parsed.questions)) ? parsed.questions : (Array.isArray(parsed) ? parsed : []);
      return { questions };
    } catch (e: any) {
      console.error("Practice Questions JSON Parse Error:", e, questionsText);
      const err = new Error(`Failed to parse practice questions response: ${e.message}`);
      (err as any).code = "AI_PARSE_ERROR";
      throw err;
    }
  }

  /**
   * Revision Pack Generator
   */
  public async generateRevisionPack(params: RevisionPackParams, req?: any): Promise<any> {
    if (!params.subject || !params.subject.trim()) {
      throw new Error("Subject is required");
    }

    const prompt = REVISION_PACK_PROMPT({
      subject: params.subject,
      topic: params.topic
    });

    const revisionPackText = await this.generateText(
      {
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
      "/api/ai/revision-pack",
      req
    );

    try {
      let cleanedText = revisionPackText || "{}";
      cleanedText = cleanedText.replace(/```json|```/g, "").trim();
      
      let parsed: any = null;
      try {
        parsed = JSON.parse(cleanedText);
      } catch {
        const firstBrace = cleanedText.indexOf('{');
        const lastBrace = cleanedText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          parsed = JSON.parse(cleanedText.substring(firstBrace, lastBrace + 1));
        } else {
          throw new Error("No JSON object found in response");
        }
      }
      
      return parsed;
    } catch (e: any) {
      console.error("Revision Pack JSON Parse Error:", e, revisionPackText);
      const err = new Error(`Failed to parse revision pack response: ${e.message}`);
      (err as any).code = "AI_PARSE_ERROR";
      throw err;
    }
  }

  /**
   * Learn With Videos Generator
   */
  public async generateVideoRecommendations(params: LearnWithVideosParams, req?: any): Promise<{ videos: any[] }> {
    if (!params.subject || !params.subject.trim()) {
      throw new Error("Subject is required");
    }

    const prompt = LEARN_WITH_VIDEOS_PROMPT({
      subject: params.subject,
      topic: params.topic
    });

    const videosText = await this.generateText(
      {
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
      "/api/ai/learn-with-videos",
      req
    );

    try {
      let cleanedText = videosText || "{}";
      cleanedText = cleanedText.replace(/```json|```/g, "").trim();
      
      let parsed: any = null;
      try {
        parsed = JSON.parse(cleanedText);
      } catch {
        const firstBrace = cleanedText.indexOf('{');
        const lastBrace = cleanedText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          parsed = JSON.parse(cleanedText.substring(firstBrace, lastBrace + 1));
        } else {
          throw new Error("No JSON object found in response");
        }
      }
      
      const videos = (parsed && Array.isArray(parsed.videos)) ? parsed.videos : [];
      return { videos };
    } catch (e: any) {
      console.error("Videos JSON Parse Error:", e, videosText);
      const err = new Error(`Failed to parse video recommendations response: ${e.message}`);
      (err as any).code = "AI_PARSE_ERROR";
      throw err;
    }
  }

  /**
   * Mistake Revision Tips Generator
   */
  public async generateMistakeRevisionTips(params: MistakeRevisionTipsParams, req?: any): Promise<{ tips: string }> {
    const prompt = MISTAKE_REVISION_TIPS_PROMPT({
      subject: params.subject,
      topic: params.topic,
      question: params.question,
      userAnswer: params.userAnswer,
      correctAnswer: params.correctAnswer
    });

    const tipsText = await this.generateText(
      {
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
      "/api/ai/mistake-revision-tips",
      req
    );

    return { tips: tipsText };
  }
}

export default AIService.getInstance();