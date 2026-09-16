import { useMemo, type ComponentType } from 'react'
import { AlertTriangle, Mail, ScrollText, Send, ShieldCheck } from 'lucide-react'
import { useActiveSection } from '../../hooks/useActiveSection'
import ScrollToTop from '../ui/ScrollToTop'
import type { LegalBlock, LegalDocumentContent } from '../../types/legal'

const WRAP = 'max-w-[1280px] mx-auto px-10 max-[560px]:px-5'

/** One contact channel — icon, label, and the address as a real link. Stacked, so several sit as a column. */
function ContactLine({
  icon: Icon,
  label,
  href,
  text,
  external = false,
}: {
  icon: ComponentType<{ size?: number; className?: string }>
  label: string
  href: string
  text: string
  external?: boolean
}) {
  return (
    <div className="mt-3 flex w-fit max-w-full items-center gap-3 rounded-field border border-border bg-surface px-4 py-3">
      <Icon size={16} className="shrink-0 text-accent" />
      <span className="font-mono text-[11px] uppercase tracking-widest text-faint">
        {label}
      </span>
      <a
        href={href}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className="break-all text-[14.5px] font-semibold text-accent hover:underline"
      >
        {text}
      </a>
    </div>
  )
}

function Block({ block }: { block: LegalBlock }) {
  switch (block.kind) {
    case 'h3':
      return (
        <h3 className="font-display text-[17px] font-bold text-text mt-7 mb-2.5 first:mt-0">
          {block.text}
        </h3>
      )

    case 'list':
      return (
        <ul className="my-4 flex flex-col gap-2.5">
          {block.items.map((item) => (
            <li key={item} className="flex gap-3 text-[15px] leading-[1.7] text-muted">
              <span
                aria-hidden
                className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )

    case 'note':
      return (
        <div className="my-4 flex gap-3.5 rounded-card border border-accent-line bg-accent-soft p-5 max-[560px]:p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-accent" />
          <p className="text-[15px] leading-[1.75] text-text">{block.text}</p>
        </div>
      )

    case 'email':
      return (
        <ContactLine
          icon={Mail}
          label={block.label}
          href={`mailto:${block.address}`}
          text={block.address}
        />
      )

    case 'telegram':
      return (
        <ContactLine
          icon={Send}
          label={block.label}
          href={`https://t.me/${block.handle}`}
          text={`@${block.handle}`}
          external
        />
      )

    default:
      return (
        <p className="my-4 text-[15px] leading-[1.8] text-muted first:mt-0">
          {block.text}
        </p>
      )
  }
}

interface LegalDocumentProps {
  doc: LegalDocumentContent
  /**
   * Label in the pill above the title. Defaults to the legal one — the same
   * renderer also carries long-form product documents (see `/trading-bot`),
   * which must not announce themselves as legal text.
   */
  eyebrow?: string
  icon?: ComponentType<{ size?: number; className?: string }>
}

/**
 * Renders a legal document (see `types/legal.ts`) as a reading page: sticky
 * table of contents on desktop, a collapsible one on mobile, numbered sections
 * in a single measured column.
 */
export default function LegalDocument({
  doc,
  eyebrow = 'Legal · Pixel Alpha',
  icon: Icon = ScrollText,
}: LegalDocumentProps) {
  const ids = useMemo(() => doc.sections.map((s) => s.id), [doc])
  const active = useActiveSection(ids)

  const toc = (
    <ul className="flex flex-col gap-0.5">
      {doc.sections.map((s) => {
        const isActive = s.id === active
        return (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className={`flex gap-2.5 rounded-btn px-3 py-2 text-[13.5px] leading-snug transition-colors ${
                isActive
                  ? 'bg-accent-soft text-text'
                  : 'text-muted hover:bg-surface hover:text-text'
              }`}
            >
              <span
                className={`font-mono text-[11px] pt-0.5 ${isActive ? 'text-accent' : 'text-faint'}`}
              >
                {s.number}
              </span>
              <span>{s.title}</span>
            </a>
          </li>
        )
      })}
    </ul>
  )

  return (
    <main className="relative">
      {/* Header */}
      <header
        className={`${WRAP} pt-14 pb-10 max-[560px]:pt-10`}
        data-aos="fade-up"
      >
        <div className="inline-flex items-center gap-2 rounded-pill border border-accent-line bg-accent-soft px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-widest text-accent">
          <Icon size={13} />
          {eyebrow}
        </div>
        <h1 className="font-display text-[46px] font-extrabold tracking-[-0.03em] leading-[1.05] mt-5 max-[900px]:text-[34px]">
          {doc.title}
        </h1>
        <p className="mt-3 font-mono text-[12px] uppercase tracking-widest text-faint">
          Last updated: {doc.updatedAt}
        </p>
        <p className="mt-6 max-w-[70ch] border-l-2 border-accent pl-5 text-[15.5px] leading-[1.8] text-muted">
          {doc.lede}
        </p>
      </header>

      <div
        className={`${WRAP} grid gap-12 pb-24 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-16`}
      >
        {/* Table of contents — sticky rail on desktop */}
        <aside className="hidden lg:block">
          <nav
            aria-label="Table of contents"
            className="sticky top-8 max-h-[calc(100vh-4rem)] overflow-y-auto pr-2"
          >
            <div className="mb-3 px-3 font-mono text-[11px] uppercase tracking-widest text-faint">
              Contents
            </div>
            {toc}
          </nav>
        </aside>

        <div>
          {/* Table of contents — collapsible on mobile/tablet */}
          <details className="mb-10 rounded-card border border-border bg-surface p-4 lg:hidden">
            <summary className="cursor-pointer select-none font-mono text-[12px] uppercase tracking-widest text-faint">
              Jump to section
            </summary>
            <div className="mt-3">{toc}</div>
          </details>

          <article>
            {doc.sections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                data-aos="fade-up"
                className="scroll-mt-8 border-t border-hair pt-10 mt-10 first:border-t-0 first:pt-0 first:mt-0"
              >
                <div className="flex items-baseline gap-3.5">
                  <span className="font-mono text-[13px] text-accent">
                    {section.number}
                  </span>
                  <h2 className="font-display text-[26px] font-extrabold tracking-[-0.02em] leading-tight max-[560px]:text-[22px]">
                    {section.title}
                  </h2>
                </div>
                <div className="mt-4 max-w-[76ch]">
                  {section.blocks.map((block, i) => (
                    <Block key={i} block={block} />
                  ))}
                </div>
              </section>
            ))}
          </article>

          {/* Acknowledgment */}
          <div
            data-aos="fade-up"
            className="mt-12 flex gap-4 rounded-card border border-border bg-surface p-6 max-[560px]:p-5"
          >
            <ShieldCheck size={20} className="mt-0.5 shrink-0 text-accent" />
            <div>
              <div className="font-display text-[17px] font-bold">
                Acknowledgment
              </div>
              <p className="mt-2 text-[15px] leading-[1.75] text-muted">
                {doc.acknowledgment}
              </p>
            </div>
          </div>
        </div>
      </div>

      <ScrollToTop />
    </main>
  )
}
