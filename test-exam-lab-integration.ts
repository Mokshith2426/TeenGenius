// Integration test: Verify the full Exam Lab pipeline (practice questions + revision pack)
// with a mocked Groq fetch response
import { AIService } from './server/services/ai.service';

const originalFetch = global.fetch;
const mockPracticeJSON = '{"questions":[{"question":"What is the quadratic formula?","options":["x = (-b ± √(b²-4ac)) / 2a","x = (-b ± √(b²+4ac)) / 2a","x = (b ± √(b²-4ac)) / 2a","x = (b ± √(b²+4ac)) / 2a"],"correctAnswerIndex":0,"explanation":"The quadratic formula solves ax² + bx + c = 0. The discriminant b²-4ac determines the nature of roots."}]}';
const mockRevisionJSON = '{"subject":"Mathematics","materials":[{"title":"Important Formulas","content":"Quadratic formula: x = (-b ± √(b²-4ac)) / 2a","type":"formula"}],"flashcards":[{"question":"What is the quadratic formula?","answer":"x = (-b ± √(b²-4ac)) / 2a"}]}';

(global as any).fetch = (url: string, options: any) => {
  const body = JSON.parse(options.body);
  const content = body.messages[1] && body.messages[1].content || '';
  const isPractice = content.includes('multiple choice');
  const isRevision = content.includes('revision pack');
  let responseContent = '';

  if (isPractice) {
    responseContent = mockPracticeJSON;
  } else if (isRevision) {
    responseContent = mockRevisionJSON;
  } else {
    responseContent = mockPracticeJSON;
  }

  console.log('[MOCK] Groq fetch called:', url);
  console.log('[MOCK] Type:', isPractice ? 'practice' : isRevision ? 'revision' : 'other');

  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({
      id: 'chatcmpt-789',
      object: 'chat.completion',
      created: Date.now(),
      model: 'llama-3.3-70b-versatile',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: responseContent
        },
        finish_reason: 'stop'
      }]
    })
  });
};

async function runTest() {
  console.log('=== Exam Lab Pipeline Test ===\n');
  
  const aiService = AIService.getInstance();
  const req = { headers: { 'x-language-setting': 'auto' } };
  
  // Test generatePracticeQuestions
  const practiceResult = await aiService.generatePracticeQuestions({
    subject: 'Mathematics',
    chapter: 'Quadratic Equations',
    difficulty: 'medium',
    questionType: 'mcq'
  }, req);
  
  console.log('[RESULT] Practice Questions:');
  console.log('  Has questions:', !!practiceResult.questions);
  console.log('  Question count:', practiceResult.questions?.length);
  console.log('  First Q:', practiceResult.questions?.[0]?.question);
  console.log('  Options:', practiceResult.questions?.[0]?.options);
  console.log('  Correct answer index:', practiceResult.questions?.[0]?.correctAnswerIndex);
  
  // Test generateRevisionPack
  const revisionResult = await aiService.generateRevisionPack({
    subject: 'Mathematics',
    topic: 'Quadratic Equations'
  }, req);
  
  console.log('\n[RESULT] Revision Pack:');
  console.log('  Has materials:', !!revisionResult.materials);
  console.log('  Has flashcards:', !!revisionResult.flashcards);
  console.log('  Materials count:', revisionResult.materials?.length);
  console.log('  Flashcards count:', revisionResult.flashcards?.length);
  
  // Test generateMockTest
  const mockResult = await aiService.generateMockTest({
    numQuestions: 5,
    subject: 'Mathematics'
  }, req);
  
  console.log('\n[RESULT] Mock Test:');
  console.log('  Has questions:', !!mockResult.questions);
  console.log('  Question count:', mockResult.questions?.length);
  
  console.log('\n=== EXAM LAB TEST PASSED ===');
  
  global.fetch = originalFetch;
}

runTest().catch(err => {
  console.error('TEST FAILED:', err);
  (global as any).fetch = originalFetch;
  process.exit(1);
});
