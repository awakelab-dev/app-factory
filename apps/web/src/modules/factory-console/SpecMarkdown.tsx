import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Render de las specs del pipeline (funcional/técnica) como markdown en vez
 * de texto plano (pedido de Leonardo, 2026-07-19 — el `<pre>` original hacía
 * ilegibles los documentos que el Agent SDK escribe en markdown real:
 * títulos, tablas de endpoints, listas, bloques de código).
 *
 * `remark-gfm` es necesario porque las specs usan tablas (extensión GFM, no
 * CommonMark). El contenido es generado por nuestro propio runner y
 * react-markdown no inyecta HTML crudo por defecto — no hace falta
 * sanitización extra.
 *
 * Estilos: mapeo explícito por elemento con los tokens Awakelab del shell
 * (tema oscuro) en lugar de un plugin de tipografía — mantiene el control en
 * este archivo y no añade más dependencias que las dos de arriba.
 */
export function SpecMarkdown({ content }: { content: string }) {
  return (
    <div
      className="mt-3 max-h-[32rem] overflow-auto rounded-xl border border-awk-blue-700 bg-awk-navy-800 p-5 text-sm leading-relaxed text-awk-blue-100"
      data-testid="factory-spec-content"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-3 border-b border-awk-blue-700 pb-2 text-xl font-semibold text-awk-blue-50">{children}</h1>
          ),
          h2: ({ children }) => <h2 className="mb-2 mt-6 text-base font-semibold text-awk-cyan-300">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-2 mt-4 text-sm font-semibold text-awk-blue-50">{children}</h3>,
          h4: ({ children }) => <h4 className="mb-1 mt-3 text-sm font-medium text-awk-blue-200">{children}</h4>,
          p: ({ children }) => <p className="mb-3">{children}</p>,
          ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li className="marker:text-awk-cyan-400">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="mb-3 border-l-2 border-awk-cyan-500 pl-3 text-awk-blue-300">{children}</blockquote>
          ),
          strong: ({ children }) => <strong className="font-semibold text-awk-blue-50">{children}</strong>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-awk-cyan-300 underline">
              {children}
            </a>
          ),
          hr: () => <hr className="my-4 border-awk-blue-700" />,
          // Inline code vs bloque: react-markdown envuelve los bloques en
          // <pre>, así que `code` sin <pre> padre es inline. Se distingue
          // por el mapeo de `pre` (que ya aporta fondo/scroll propios).
          pre: ({ children }) => (
            <pre className="mb-3 overflow-x-auto rounded-lg border border-awk-blue-700 bg-awk-navy-900 p-3 font-mono text-xs leading-relaxed text-awk-cyan-100">
              {children}
            </pre>
          ),
          code: ({ children, className }: { children?: ReactNode; className?: string }) =>
            className ? (
              <code className={className}>{children}</code>
            ) : (
              <code className="rounded bg-awk-navy-900 px-1.5 py-0.5 font-mono text-xs text-awk-cyan-200">{children}</code>
            ),
          table: ({ children }) => (
            <div className="mb-3 overflow-x-auto">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-awk-navy-900">{children}</thead>,
          th: ({ children }) => (
            <th className="border border-awk-blue-700 px-2.5 py-1.5 text-left font-semibold text-awk-cyan-300">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="border border-awk-blue-700 px-2.5 py-1.5 align-top">{children}</td>
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
