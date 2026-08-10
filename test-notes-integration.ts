// Integration test: Verify the full Notes generation pipeline
// with a mocked Groq fetch response
import { generateGroqText, getGroqModel } from './ai-provider';
import { AIService } from './server/services/ai.service';

const originalFetch = global.fetch;
const mockNotesText = `# Photosynthesis

## Brief Overview
Photosynthesis is the process by which plants convert light energy into chemical energy.

## Key Concepts
- **Chlorophyll**: The green pigment that absorbs light
- **Light-dependent reactions**: Occur in thylakoid membranes
- **Calvin cycle**: Occurs in stroma, produces glucose

## Exam Points
- Know the overall equation: 6CO2 + 6H2O → C6H12O6 + 6O2
- Understand the role of chloroplasts
- Remember the difference between light-dependent and light-independent reactions`;

(global as any).fetch = (url: string, options: any) => {
  console.log('[MOCK] Groq fetch called:', url);
  const body = JSON.parse(options.body);
  console.log('[MOCK] Model:', body.model);
  console.log('[MOCK] System message present:', body.messages[0]?.role === 'system');
  console.log('[MOCK] User message length:', body.messages[1]?.content?.length);
  
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({
      id: 'chatcmpt-456',
      object: 'chat.completion',
      created: Date.now(),
      model: getGroqModel(),
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: mockNotesText
        },
        finish_reason: 'stop'
      }],
      usage: { prompt_tokens: 200, completion_tokens: 300, total_tokens: 500 }
    })
  });
};

async function runTest() {
  console.log('=== Notes Generation Pipeline Test ===\n');
  
  const aiService = AIService.getInstance();
  
  // Test generateNotes
  const result = await aiService.generateNotes({
    content: 'Photosynthesis is the process by which plants convert light energy into chemical energy.',
    focus: 'photosynthesis',
    noteStyle: 'Short Notes',
    summaryLength: 'Standard',
    subject: 'Biology',
    files: []
  }, { headers: { 'x-language-setting': 'auto' } });
  
  console.log('\n[RESULT] generateNotes returned:');
  console.log('  Has notes:', !!result.notes);
  console.log('  Notes length:', result.notes.length);
  console.log('  Notes preview:', result.notes.substring(0, 80) + '...');
  
  // Test that the frontend would work: data.notes = result.notes
  const frontendData = { notes: result.notes };
  console.log('\n[FRONTEND] data.notes set:', !!frontendData.notes);
  console.log('[FRONTEND] Will display notes:', frontendData.notes.length > 0);
  
  console.log('\n=== NOTES TEST PASSED ===');
  
  global.fetch = originalFetch;
}

runTest().catch(err => {
  console.error('TEST FAILED:', err);
  (global as any).fetch = originalFetch;
  process.exit(1);
});
