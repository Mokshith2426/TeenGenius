import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { preprocessLaTeX } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

interface MarkdownRendererProps {
  content: string;
  onLinkClick?: (href: string) => void;
  className?: string;
}

/**
 * Centralized Markdown renderer for TeenGenius.
 * Handles LaTeX math, GFM (tables, strikethrough), and internal navigation links.
 */
export default function MarkdownRenderer({ content, onLinkClick, className = '' }: MarkdownRendererProps) {
  const navigate = useNavigate();

  const handleLinkClick = (href: string, children: React.ReactNode) => {
    const textContent = String(children || '').toLowerCase().trim();
    const hrefLower = String(href || '').toLowerCase();

    // Internal navigation patterns
    if (
      textContent.includes('focus zone') || 
      textContent.includes('focus room') || 
      hrefLower.includes('focus')
    ) {
      navigate('/app/focus');
      return true;
    } else if (
      textContent.includes('homework solver') || 
      textContent.includes('equation analyzer') ||
      hrefLower.includes('homework') || 
      hrefLower.includes('solve-homework')
    ) {
      navigate('/app/homework-solver');
      return true;
    } else if (
      textContent.includes('notes lab') || 
      textContent.includes('notes synthesizer') || 
      textContent.includes('notes generator') ||
      hrefLower.includes('notes')
    ) {
      navigate('/app/notes');
      return true;
    } else if (
      textContent.includes('roadmap') || 
      textContent.includes('roadmap architect') ||
      hrefLower.includes('roadmap')
    ) {
      navigate('/app/roadmap');
      return true;
    } else if (
      textContent.includes('memory lab') || 
      textContent.includes('memory palace') || 
      textContent.includes('loci') ||
      hrefLower.includes('memory') || 
      hrefLower.includes('mnemonic')
    ) {
      navigate('/app/memory-lab');
      return true;
    } else if (
      textContent.includes('timetable') || 
      textContent.includes('schedule') || 
      hrefLower.includes('timetable')
    ) {
      navigate('/app/timetable');
      return true;
    } else if (onLinkClick) {
      onLinkClick(href);
      return true;
    }

    // External links open in new tab
    if (href && !href.startsWith('/') && !href.startsWith('#')) {
      window.open(href, '_blank', 'noopener,noreferrer');
      return true;
    }

    // Internal paths
    if (href && (href.startsWith('/') || href.startsWith('#'))) {
      navigate(href);
      return true;
    }

    return false;
  };

  return (
    <div className={`prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-headings:font-black prose-headings:uppercase prose-headings:tracking-tighter prose-headings:text-zinc-900 dark:prose-headings:text-white prose-strong:text-blue-600 prose-ul:list-disc prose-ol:list-decimal overflow-x-auto whitespace-pre-wrap ${className}`}>
      <ReactMarkdown 
        remarkPlugins={[remarkGfm, remarkMath]} 
        rehypePlugins={[rehypeKatex]}
        components={{
          a: ({ href, children, ...props }) => {
            const handled = handleLinkClick(href || '', children);
            return (
              <a 
                href={href} 
                onClick={(e) => handled && e.preventDefault()} 
                className="text-blue-600 hover:underline font-bold cursor-pointer inline-flex items-center gap-0.5"
                {...props}
              >
                {children}
              </a>
            );
          }
        }}
      >
        {preprocessLaTeX(typeof content === 'string' ? content : JSON.stringify(content || ''))}
      </ReactMarkdown>
    </div>
  );
}