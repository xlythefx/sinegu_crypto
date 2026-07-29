const COLUMNS = [
  {
    title: 'PRODUCT',
    links: ['Flow Master', 'Structure', 'Exchanges', 'Pricing'],
  },
  { title: 'RESOURCES', links: ['Docs', 'Live results', 'Security', 'Status'] },
  { title: 'COMPANY', links: ['About', 'Careers', 'Blog', 'Terms'] },
]

export default function Footer() {
  return (
    <footer className="border-t border-hair">
      <div className="max-w-[1280px] mx-auto py-11 px-10 grid grid-cols-[1.6fr_1fr_1fr_1fr] gap-8 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
        <div>
          <div className="flex items-center gap-2.5 mb-3.5">
            <img
              className="w-5 h-5 object-contain scale-[1.6]"
              src="/assets/logo.png"
              alt=""
            />
            <span className="font-display font-extrabold text-[17px]">
              SineguAlerts
            </span>
          </div>
          <p className="text-[13px] text-faint leading-[1.6] max-w-[280px]">
            Automated trading bots that run on your own exchange. Free to use —
            you only pay 20% of the profit you make.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <div className="font-mono text-[11px] text-faint mb-3.5">
              {col.title}
            </div>
            <div className="flex flex-col gap-2.5 text-[13.5px] text-muted">
              {col.links.map((link) => (
                <span className="cursor-pointer" key={link}>
                  {link}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="max-w-[1280px] mx-auto py-[18px] px-10 border-t border-hair flex justify-between font-mono text-[11px] text-faint flex-wrap gap-2">
        <span>
          © 2026 SINEGUALERTS · ALL SYSTEMS OPERATIONAL{' '}
          <span className="text-green">●</span>
        </span>
        <span>Responsive: grids collapse ≤900px · theme persists</span>
      </div>
    </footer>
  )
}
