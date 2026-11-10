import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownProps {
  children: string
  /** 'md' = chat answers (14px), 'sm' = documents in a panel (13.5px). */
  size?: 'sm' | 'md'
  className?: string
}

/** Every external link opens in a new tab and carries no referrer. */
const LINK = 'font-semibold text-accent underline decoration-accent-line underline-offset-2 hover:decoration-accent'

const COMPONENTS: Components = {
  h1: ({ children }) => <h3 className="font-display text-[1.25em] font-extrabold leading-[1.3] text-text">{children}</h3>,
  h2: ({ children }) => <h4 className="font-display text-[1.12em] font-extrabold leading-[1.35] text-text">{children}</h4>,
  h3: ({ children }) => <h5 className="text-[1.02em] font-bold leading-[1.4] text-text">{children}</h5>,
  h4: ({ children }) => <h6 className="text-[1em] font-bold leading-[1.4] text-text">{children}</h6>,
  h5: ({ children }) => <p className="font-bold text-text">{children}</p>,
  h6: ({ children }) => <p className="font-bold text-muted">{children}</p>,
  p: ({ children }) => <p>{children}</p>,
  strong: ({ children }) => <strong className="font-bold text-text">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  del: ({ children }) => <del className="text-muted">{children}</del>,
  ul: ({ children }) => <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-faint">{children}</ul>,
  ol: ({ children }) => <ol className="flex list-decimal flex-col gap-1.5 pl-5 marker:text-faint">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5 [&>ol]:mt-1.5 [&>ul]:mt-1.5">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="flex flex-col gap-2 border-l-2 border-accent-line pl-3.5 text-muted">{children}</blockquote>
  ),
  hr: () => <hr className="border-0 border-t border-hair" />,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className={LINK}>
      {children}
    </a>
  ),
  // A picture in an answer is shown as a link — the job cards are where results are previewed.
  img: ({ src, alt }) =>
    typeof src === 'string' && src ? (
      <a href={src} target="_blank" rel="noopener noreferrer" className={LINK}>
        {alt?.trim() || 'Open the picture'}
      </a>
    ) : null,
  code: ({ children }) => (
    <code className="rounded-[6px] border border-hair bg-surface2 px-1.5 py-px font-mono text-[0.88em] text-text">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="overflow-x-auto rounded-row border border-hair bg-surface2 px-3.5 py-3 font-mono text-[12.5px] leading-[1.6] text-text [&_code]:border-0 [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-[1em]">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="max-w-full overflow-x-auto rounded-row border border-hair">
      <table className="w-full border-collapse text-[0.93em]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-surface2">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b border-hair px-3 py-2 text-left font-mono text-[0.82em] font-semibold uppercase tracking-[0.06em] text-faint">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="border-t border-hair px-3 py-2 align-top">{children}</td>,
  input: ({ checked }) => (
    <input type="checkbox" checked={Boolean(checked)} readOnly disabled className="mr-1.5 translate-y-px accent-[var(--accent)]" />
  ),
}

const SIZE: Record<'sm' | 'md', string> = {
  sm: 'text-[13.5px] leading-[1.65]',
  md: 'text-[14px] leading-[1.7]',
}

/**
 * Markdown as the design system draws it — the agent's answers and the
 * brand brief. GitHub-style lists, tables and task boxes are on (remark-gfm).
 *
 * Raw HTML is never rendered: `skipHtml` drops it, and react-markdown's own
 * URL check already refuses `javascript:` and other unsafe links. Headings
 * step down one level so a "# Title" inside an answer never outranks the
 * page's own headings.
 */
export default function Markdown({ children, size = 'md', className = '' }: MarkdownProps) {
  return (
    <div
      className={`min-w-0 break-words text-text [&>*+*]:mt-3 [&>*+h3]:mt-5 [&>*+h4]:mt-5 [&>*+h5]:mt-4 ${SIZE[size]} ${className}`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={COMPONENTS}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
