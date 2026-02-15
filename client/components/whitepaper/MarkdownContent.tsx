"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

const baseClass =
  "text-gray-700 leading-relaxed [&_.whitepaper-logo-title_table]:border-0 [&_.whitepaper-logo-title_thead]:bg-transparent [&_.whitepaper-logo-title_thead]:border-0 [&_.whitepaper-logo-title_th]:bg-transparent [&_.whitepaper-logo-title_th]:border-0 [&_.whitepaper-logo-title_th]:py-2 [&_.whitepaper-logo-title_th]:text-3xl [&_.whitepaper-logo-title_th]:font-bold [&_.whitepaper-logo-title_th]:text-gray-900 [&_.whitepaper-logo-title_th]:align-middle [&_.whitepaper-logo-title_th:first-child]:w-16 [&_.whitepaper-logo-title_img]:my-0 [&_.whitepaper-logo-title_img]:h-14 [&_.whitepaper-logo-title_img]:w-auto [&_.whitepaper-logo-title_tr]:border-0";

export function MarkdownContent({ content }: { content: string }) {
  return (
    <div className={baseClass}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-3xl font-bold text-gray-900 mt-0 mb-4">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-bold text-gray-900 mt-10 mb-4">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="mb-4">{children}</p>,
          ul: ({ children }) => (
            <ul className="list-disc pl-6 mb-4 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-6 mb-4 space-y-1">{children}</ol>
          ),
          li: ({ children }) => <li className="text-gray-700">{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-600 underline hover:text-amber-700"
            >
              {children}
            </a>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-gray-900">{children}</strong>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full text-sm border border-gray-300">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gray-100 border-b border-gray-300">
              {children}
            </thead>
          ),
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => (
            <tr className="border-b border-gray-200">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="text-left p-3 font-semibold text-gray-900">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="p-3">{children}</td>,
          hr: () => <hr className="my-8 border-gray-200" />,
          img: ({ src, alt }) => (
            <img
              src={src ?? ""}
              alt={alt ?? ""}
              className="my-4 w-full max-w-full h-auto object-contain"
            />
          ),
          code: ({ children }) => (
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono">
              {children}
            </code>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
