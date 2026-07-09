import React from 'react';

export default function RouteLoading() {
  return (
    <div className="w-full h-full min-h-[50vh] flex flex-col items-center justify-center p-8 text-center select-none animate-fadeIn">
      <div className="p-4 bg-zinc-100 dark:bg-zinc-900 rounded-full text-blue-600 mb-4 animate-pulse">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin text-blue-500">
          <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
          <path d="M21 3v5h-5"/>
        </svg>
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 dark:text-zinc-500 italic">Loading study workspace...</p>
    </div>
  );
}
