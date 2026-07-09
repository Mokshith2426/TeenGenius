export const SUPPORTED_LANGUAGES = [
  { code: 'auto', name: 'Auto Detect' }
];

export function getActiveLanguage(): string {
  return 'auto';
}

export function setActiveLanguage(code: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('TEEN_GENIUS_LANGUAGE', 'auto');
    window.dispatchEvent(new CustomEvent('language-change', { detail: { language: 'auto' } }));
  }
}

export function getLanguageInstruction(languageCode?: string): string {
  return `Language requirement:
- Automatically detect the language of the student's input (typed text, pasted text, uploaded document, or OCR text).
- By default, generate all educational explanations, structured notes, and homework solutions in clear, premium English.
- If the source material or input text is in another language (such as Telugu, Hindi, Tamil, German, Spanish, French, etc.), automatically understand the content but translate and explain it entirely in English.
- ONLY preserve the original language when it is absolutely necessary, such as language-specific subjects or classes (e.g., Telugu, Hindi, Sanskrit, French, Spanish, German courses) where translation would reduce the educational value of the assignment or test material.`;
}
