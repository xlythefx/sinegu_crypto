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
    <footer className="footer">
      <div className="footer__grid">
        <div>
          <div className="footer__brand-row">
            <img className="footer__logo" src="/assets/logo.png" alt="" />
            <span className="footer__wordmark">SineguAlerts</span>
          </div>
          <p className="footer__blurb">
            Automated trading bots that run on your own exchange. Free to use —
            you only pay 20% of the profit you make.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <div className="footer__col-title">{col.title}</div>
            <div className="footer__col-links">
              {col.links.map((link) => (
                <span key={link}>{link}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="footer__bottom">
        <span>
          © 2026 SINEGUALERTS · ALL SYSTEMS OPERATIONAL{' '}
          <span className="footer__status-dot">●</span>
        </span>
        <span>Responsive: grids collapse ≤900px · theme persists</span>
      </div>
    </footer>
  )
}
