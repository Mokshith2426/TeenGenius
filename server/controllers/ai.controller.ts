/**
 * AI Controller - Handles AI endpoint business logic
 * 
 * Controllers orchestrate requests, validate inputs, and return responses.
 * They delegate AI operations to the AIService.
 */

import { Request, Response, NextFunction } from 'express';
import { AIService } from '../services/ai.service';
import { detectSubject, type Subject } from '../../src/lib/subjectDetection';

const aiService = AIService.getInstance();

// ============================================================================
// TYPES
// ============================================================================

// Local File interface matching Express/Multer File type
export interface LocalFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
  path?: string;
  stream?: any;
  destination?: string;
  filename?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: any;
}

// ============================================================================
// AI CONTROLLER
// ============================================================================

export class AIController {
  /**
   * AI Tutor Chat
   */
  public static async chat(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { message, history } = req.body;

      if (!message || !message.trim()) {
        res.status(400).json({ error: "Message is required", code: "INVALID_INPUT" });
        return;
      }

      const result = await aiService.chat(message, history || [], req);
      
      res.json({
        text: result.text,
        detectedSubject: result.detectedSubject
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Timetable Maker
   */
  public static async timetable(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { 
        subjects, 
        hoursPerDay, 
        preferences, 
        durationCategory, 
        durationValue, 
        studentClass, 
        board, 
        stream, 
        weakSubjects, 
        strongSubjects, 
        examDates, 
        goals 
      } = req.body;

      const result = await aiService.generateTimetable({
        subjects: subjects || [],
        hoursPerDay: hoursPerDay || 4,
        preferences: preferences || '',
        durationCategory: durationCategory || "weekly",
        durationValue: durationValue || "1_week",
        studentClass: studentClass || '',
        board: board || '',
        stream: stream || '',
        weakSubjects: weakSubjects || '',
        strongSubjects: strongSubjects || '',
        examDates: examDates || '',
        goals: goals || ''
      }, req);

      res.json(result);
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Notes Generator
   */
  public static async notes(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Support both multipart/form-data (with files) and JSON
      let content = '';
      let focus = '';
      let noteStyle = 'Short Notes';
      let summaryLength = 'Standard';
      let subject = 'Auto-Detect';
      const files: Array<{ name: string; data: string; mimeType: string }> = [];

      if (req.is('multipart/form-data')) {
        // Multipart form data
        content = (req.body.content as string) || '';
        focus = (req.body.focus as string) || '';
        noteStyle = (req.body.noteStyle as string) || 'Short Notes';
        summaryLength = (req.body.summaryLength as string) || 'Standard';
        subject = (req.body.subject as string) || 'Auto-Detect';

        // Extract files from multer
        if (req.files && Array.isArray(req.files)) {
          for (const file of req.files) {
            let buffer: Buffer;
            if (file.buffer) {
              buffer = file.buffer;
            } else if (file.path) {
              buffer = Buffer.from(file.path);
            } else {
              continue; // Skip files without data
            }
            files.push({
              name: file.originalname,
              data: buffer.toString('base64'),
              mimeType: file.mimetype
            });
          }
        }
      } else {
        // JSON payload
        content = (req.body.content as string) || '';
        focus = (req.body.focus as string) || '';
        noteStyle = (req.body.noteStyle as string) || 'Short Notes';
        summaryLength = (req.body.summaryLength as string) || 'Standard';
        subject = (req.body.subject as string) || 'Auto-Detect';
        
        if (req.body.files && Array.isArray(req.body.files)) {
          files.push(...req.body.files);
        }
      }

      const result = await aiService.generateNotes({
        content: content || '',
        focus: focus || '',
        noteStyle: noteStyle || 'Short Notes',
        summaryLength: summaryLength || 'Standard',
        subject: subject || 'Auto-Detect',
        files
      }, req);

      res.json(result);
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Mnemonic Generator
   */
  public static async mnemonic(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { topic } = req.body;

      const result = await aiService.generateMnemonic({ topic }, req);
      
      res.json({ mnemonics: result.mnemonics });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Flashcards Generator
   */
  public static async flashcards(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { topic, notesContent } = req.body;

      const result = await aiService.generateFlashcards({
        topic,
        notesContent: notesContent || ""
      }, req);

      res.json(result);
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Roadmap Generator
   */
  public static async roadmap(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { topic } = req.body;

      const result = await aiService.generateRoadmap({ topic }, req);

      res.json(result);
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Quiz Generator
   */
  public static async quiz(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { topic } = req.body;

      if (!topic || !topic.trim()) {
        res.status(400).json({ error: "Topic is required", code: "INVALID_INPUT" });
        return;
      }

      const result = await aiService.generateQuiz({ topic }, req);

      res.json(result);
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Quick Quiz Generator
   */
  public static async quickQuiz(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { chatText } = req.body;

      if (!chatText || !chatText.trim()) {
        res.status(400).json({ error: "Chat text history is required", code: "INVALID_INPUT" });
        return;
      }

      const result = await aiService.generateQuickQuiz({ chatText }, req);

      res.json(result);
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Editor Assist
   */
  public static async editorAssist(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { text, language, action } = req.body;

      if (!text || !text.trim()) {
        res.status(400).json({ error: "Text is required", code: "INVALID_INPUT" });
        return;
      }

      const result = await aiService.editorAssist({
        text,
        language: language || 'plain text',
        action: action || 'refactor'
      }, req);

      res.json(result);
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Mock Test Generator
   */
  public static async mockTest(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { numQuestions, subject } = req.body;

      if (!subject || !subject.trim()) {
        res.status(400).json({ error: "Subject is required", code: "INVALID_INPUT" });
        return;
      }

      const result = await aiService.generateMockTest({
        numQuestions: numQuestions || 10,
        subject: subject.trim()
      }, req);

      res.json(result);
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Practice Questions Generator
   */
  public static async practiceQuestions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { subject, chapter, difficulty, questionType } = req.body;

      if (!subject || !subject.trim()) {
        res.status(400).json({ error: "Subject is required", code: "INVALID_INPUT" });
        return;
      }

      const result = await aiService.generatePracticeQuestions({
        subject: subject.trim(),
        chapter: chapter || '',
        difficulty: difficulty || 'medium',
        questionType: questionType || 'mcq'
      }, req);

      res.json(result);
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Revision Pack Generator
   */
  public static async revisionPack(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { subject, topic } = req.body;

      if (!subject || !subject.trim()) {
        res.status(400).json({ error: "Subject is required", code: "INVALID_INPUT" });
        return;
      }

      const result = await aiService.generateRevisionPack({
        subject: subject.trim(),
        topic: topic || ''
      }, req);

      res.json(result);
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Learn With Videos Generator
   */
  public static async learnWithVideos(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { subject, topic } = req.body;

      if (!subject || !subject.trim()) {
        res.status(400).json({ error: "Subject is required", code: "INVALID_INPUT" });
        return;
      }

      const result = await aiService.generateVideoRecommendations({
        subject: subject.trim(),
        topic: topic || ''
      }, req);

      res.json(result);
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Mistake Revision Tips Generator
   */
  public static async mistakeRevisionTips(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { subject, topic, question, userAnswer, correctAnswer } = req.body;

      if (!subject || !subject.trim() || !question || !question.trim()) {
        res.status(400).json({ error: "Subject and question are required", code: "INVALID_INPUT" });
        return;
      }

      const result = await aiService.generateMistakeRevisionTips({
        subject: subject.trim(),
        topic: topic || '',
        question: question.trim(),
        userAnswer: userAnswer || '',
        correctAnswer: correctAnswer || ''
      }, req);

      res.json(result);
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Health Check
   */
  public static async health(req: Request, res: Response): Promise<void> {
    try {
      const health = await aiService.healthCheck();
      
      res.json({
        status: health.reachable ? "ok" : "error",
        configured: aiService.isConfigured(),
        provider: "groq",
        reachable: health.reachable,
        model: health.model || undefined,
        ...(health.error && { code: health.error })
      });
    } catch (error: any) {
      res.status(500).json({
        status: "error",
        configured: false,
        provider: "groq",
        reachable: false,
        error: error.message
      });
    }
  }
}

export default AIController;