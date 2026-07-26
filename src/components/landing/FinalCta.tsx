import { useNavigate } from 'react-router-dom'

export default function FinalCta() {
  const navigate = useNavigate()
  return (
    <section data-aos="fade-up" className="cta">
        <div className="cta__bg" />
        <div className="cta__content">
          <div className="cta__pill">NO CARD · NO MINIMUM · CANCEL ANYTIME</div>
          <h2 className="cta__title">
            Take the other side
            <br />
            of the market.
          </h2>
          <p className="cta__sub">
            Connect your exchange and switch on your first bot in minutes. Keep
            80% of every win — we take 20% of profit and nothing else.
          </p>
          <div className="cta__actions">
            <button
              className="cta__btn-primary"
              onClick={() => navigate('/auth')}
            >
              Start free with SineguAlerts →
            </button>
            <button className="cta__btn-outline">See live results</button>
          </div>
          <div className="cta__trust">
            <span>◆ 48,200+ active traders</span>
            <span>◆ $128M profit generated</span>
            <span>◆ Funds stay on your exchange</span>
          </div>
        </div>
    </section>
  )
}
