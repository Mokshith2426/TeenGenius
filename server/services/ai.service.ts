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
  HOMEWORK_SOLVER_PROMPT,
  NOTES_GENERATOR_PROMPT,
  QUIZ_GENERATOR_PROMPT,
  QUICK_QUIZ_PROMPT,
  TIMETABLE_PROMPT,
  MNEMONIC_PROMPT,
  FLASHCARDS_PROMPT,
  ROADMAP_PROMPT,
  EDITOR_ASSIST_PROMPT,
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
}

export interface HomeworkParams {
  question: string;
  subject: string;
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

// ============================================================================
// AI SERVICE
// ============================================================================

export class AIService {
  private static instance: AIService;
  private readonly timeout: number;

  private constructor() {
    this.timeout = 30000; // 30 seconds
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
      return JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("Timetable JSON Parse Error:", parseError, generatedText);
      throw parseError;
    }
  }

  /**
   * Notes Generator
   */
  public async generateNotes(params: NotesParams, req?: any): Promise<{ notes: string }> {
    const formattedPrompt = NOTES_GENERATOR_PROMPT({
      content: params.content || '',
      focus: params.focus || '',
      noteStyle: params.noteStyle || 'Short Notes',
      summaryLength: params.summaryLength || 'Standard',
      subject: params.subject || 'Auto-Detect'
    });

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
   * Homework Solver
   */
  public async solveHomework(params: HomeworkParams, req?: any): Promise<{ solution: string }> {
    const prompt = HOMEWORK_SOLVER_PROMPT(params.question || 'Solve the problem.', params.subject || 'Auto-Detect');

    const solutionText = await this.generateText(
      {
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
      "/api/ai/solve-homework",
      req
    );

    return { solution: solutionText };
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
      const flashcards = JSON.parse(cleanedText);
      return { flashcards };
    } catch (e) {
      console.error("Flashcards JSON Parse Error:", e, flashcardsText);
      throw e;
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
      const roadmap = JSON.parse(cleanedText);
      return { roadmap };
    } catch (e) {
      console.error("Roadmap Parse Error:", e, roadmapText);
      throw e;
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
      const quiz = JSON.parse(cleanedText);
      return { quiz };
    } catch (e) {
      console.error("Quiz Parse Error:", e, quizText);
      throw e;
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
      const quiz = JSON.parse(cleanedText);
      return { quiz };
    } catch (e) {
      console.error("Quick quiz json parse error:", e, quickQuizText);
      throw e;
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
}

export default AIService.getInstance();