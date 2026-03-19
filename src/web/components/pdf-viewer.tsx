import React from 'react';

interface PdfViewerProps {
  title: string;
  pdfUrl?: string;
  fallbackText: string;
}

export function PdfViewer({ title, pdfUrl, fallbackText }: PdfViewerProps) {
  if (pdfUrl) {
    return (
      <iframe
        title={title}
        src={pdfUrl}
        className="h-full min-h-[70vh] w-full rounded-2xl border border-notion-border bg-white shadow-notion"
      />
    );
  }

  return (
    <div className="rounded-2xl border border-notion-border bg-notion-sidebar p-5 shadow-notion">
      <p className="whitespace-pre-wrap text-sm leading-7 text-notion-text-secondary">
        {fallbackText}
      </p>
    </div>
  );
}
