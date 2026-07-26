/**
 * AI Routes - Defines all AI-related API endpoints
 * 
 * Routes map HTTP endpoints to controller methods.
 * Middleware is applied here for validation, authentication, etc.
 */

import { Router } from 'express';
import { AIController } from '../controllers/ai.controller';
import { 
  validateInput, 
  checkAiKey, 
  requestBurstGuard 
} from '../middleware/ai.middleware';

const router = Router();

// ============================================================================
// AI ROUTES
// ============================================================================

/**
 * @route   POST /api/ai/chat
 * @desc    AI Tutor Chat endpoint
 * @access  Public (with API key check)
 */
router.post('/chat', 
  validateInput, 
  checkAiKey, 
  requestBurstGuard, 
  AIController.chat
);

/**
 * @route   POST /api/ai/timetable
 * @desc    Generate AI-powered timetable
 * @access  Public (with API key check)
 */
router.post('/timetable', 
  validateInput, 
  checkAiKey, 
  requestBurstGuard, 
  AIController.timetable
);

/**
 * @route   POST /api/ai/notes
 * @desc    Generate study notes
 * @access  Public (with API key check)
 */
router.post('/notes', 
  validateInput, 
  checkAiKey, 
  requestBurstGuard, 
  AIController.notes
);

/**
 * @route   POST /api/ai/mnemonic
 * @desc    Generate mnemonics
 * @access  Public (with API key check)
 */
router.post('/mnemonic', 
  validateInput, 
  checkAiKey, 
  requestBurstGuard, 
  AIController.mnemonic
);

/**
 * @route   POST /api/ai/flashcards
 * @desc    Generate flashcards
 * @access  Public (with API key check)
 */
router.post('/flashcards', 
  validateInput, 
  checkAiKey, 
  requestBurstGuard, 
  AIController.flashcards
);

/**
 * @route   POST /api/ai/roadmap
 * @desc    Generate learning roadmap
 * @access  Public (with API key check)
 */
router.post('/roadmap', 
  validateInput, 
  checkAiKey, 
  requestBurstGuard, 
  AIController.roadmap
);

/**
 * @route   POST /api/ai/quiz
 * @desc    Generate quiz
 * @access  Public (with API key check)
 */
router.post('/quiz', 
  validateInput, 
  checkAiKey, 
  requestBurstGuard, 
  AIController.quiz
);

/**
 * @route   POST /api/ai/quick-quiz
 * @desc    Generate quick quiz from chat history
 * @access  Public (with API key check)
 */
router.post('/quick-quiz', 
  validateInput, 
  checkAiKey, 
  requestBurstGuard, 
  AIController.quickQuiz
);

/**
 * @route   POST /api/ai/editor-assist
 * @desc    AI editor assistance
 * @access  Public (with API key check)
 */
router.post('/editor-assist', 
  validateInput, 
  checkAiKey, 
  requestBurstGuard, 
  AIController.editorAssist
);

/**
 * @route   POST /api/ai/mock-test
 * @desc    Generate mock test questions
 * @access  Public (with API key check)
 */
router.post('/mock-test', 
  validateInput, 
  checkAiKey, 
  requestBurstGuard, 
  AIController.mockTest
);

/**
 * @route   POST /api/ai/practice-questions
 * @desc    Generate practice questions
 * @access  Public (with API key check)
 */
router.post('/practice-questions', 
  validateInput, 
  checkAiKey, 
  requestBurstGuard, 
  AIController.practiceQuestions
);

/**
 * @route   POST /api/ai/revision-pack
 * @desc    Generate revision pack
 * @access  Public (with API key check)
 */
router.post('/revision-pack', 
  validateInput, 
  checkAiKey, 
  requestBurstGuard, 
  AIController.revisionPack
);

/**
 * @route   POST /api/ai/learn-with-videos
 * @desc    Get video recommendations
 * @access  Public (with API key check)
 */
router.post('/learn-with-videos', 
  validateInput, 
  checkAiKey, 
  requestBurstGuard, 
  AIController.learnWithVideos
);

/**
 * @route   POST /api/ai/mistake-revision-tips
 * @desc    Generate revision tips for mistakes
 * @access  Public (with API key check)
 */
router.post('/mistake-revision-tips', 
  validateInput, 
  checkAiKey, 
  requestBurstGuard, 
  AIController.mistakeRevisionTips
);

/**
 * @route   GET /api/health/ai
 * @desc    AI service health check
 * @access  Public
 */
router.get('/health/ai', AIController.health);

export default router;