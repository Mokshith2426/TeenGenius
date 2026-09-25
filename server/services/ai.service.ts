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
import { extractSource, type ExtractedSource } from './source-extractor.service';
import {
  NOTES_GENERATOR_PROMPT,
  QUIZ_GENERATOR_PROMPT,
  QUICK_QUIZ_PROMPT,
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

export interface NotesParams {
  content: string;
  focus: string;
  noteStyle: string;
  summaryLength: string;
  subject: string;
  files?: Array<{ name: string; data: string; mimeType: string }>;
}

export interface NotesFromUrlParams {
  url: string;
  focus: string;
  noteStyle: string;
  summaryLength: string;
  subject: string;
}

export interface NotesFromUrlResult {
  notes: string;
  source: {
    type: string;
    label: string;
    title: string;
    url: string;
    chars: number;
    language?: string;
  };
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
   * Notes Generator
   *
   * The extracted source text is wrapped in an explicit "SOURCE MATERIAL"
   * block so the model can never confuse raw scraped/transcribed text with
   * student instructions (prompt-injection hardening for the URL flow).
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
   * URL -> extracted text -> short notes.
   *
   * The source is fetched and parsed server-side (see source-extractor.service)
   * and ONLY the extracted text reaches the model. The raw URL is never sent to
   * the LLM, because a text model cannot open a page or watch a video.
   */
  public async generateNotesFromUrl(
    params: NotesFromUrlParams,
    req?: any
  ): Promise<NotesFromUrlResult> {
    // 1) Validate + fetch + extract (throws a student-readable error on failure).
    const source = await extractSource(params.url);

    // 2) Reuse the exact same notes pipeline as text/file input.
    const notesText = await this.generateNotes(
      {
        content: source.text,
        focus: params.focus || '',
        noteStyle: params.noteStyle || 'Short Notes',
        summaryLength: params.summaryLength || 'Standard',
        subject: params.subject || 'Auto-Detect',
      },
      req
    );

    // The extracted body text is intentionally NOT returned to the browser —
    // only metadata the UI needs to caption the notes.
    return {
      notes: notesText.notes,
      source: {
        type: source.type,
        label: source.label,
        title: source.title,
        url: source.url,
        chars: source.chars,
        language: source.language,
      },
    };
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

}

export default AIService.getInstance();
