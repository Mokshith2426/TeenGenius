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
      const { content, focus, noteStyle, summaryLength, subject } = req.body;

      const result = await aiService.generateNotes({
        content: content || '',
        focus: focus || '',
        noteStyle: noteStyle || 'Short Notes',
        summaryLength: summaryLength || 'Standard',
        subject: subject || 'Auto-Detect'
      }, req);

      res.json(result);
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Homework Solver
   */
  public static async solveHomework(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { question, subject } = req.body;

      const result = await aiService.solveHomework({
        question: question || 'Solve the problem.',
        subject: subject || 'Auto-Detect'
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