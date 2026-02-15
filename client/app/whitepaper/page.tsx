import { readFile } from "fs/promises";
import path from "path";
import { MarkdownContent } from "@/components/whitepaper/MarkdownContent";
import { GoHomeLink } from "@/components/ui";

const PDF_FILENAME = "whitepaper.pdf";

async function getWhitepaperContent(): Promise<string> {
  const filePath = path.join(process.cwd(), "content", "whitepaper.md");
  const content = await readFile(filePath, "utf-8");
  return content;
}

export default async function WhitepaperPage() {
  const content = await getWhitepaperContent();

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <article className="max-w-3xl mx-auto px-4 py-8 pb-16">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <GoHomeLink variant="link" />
          <a
            href={`/${PDF_FILENAME}`}
            download={PDF_FILENAME}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-gray-800 bg-white px-4 py-2 text-sm font-medium text-gray-900 shadow-[4px_4px_0_rgba(0,0,0,0.12)] hover:bg-amber-50 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
              aria-hidden
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download PDF
          </a>
        </div>

        <MarkdownContent content={content} />

        <footer className="mt-12 pt-6 border-t border-gray-200">
          <GoHomeLink variant="link" className="mt-4" />
        </footer>
      </article>
    </div>
  );
}
