import { AlertTriangle } from 'lucide-react'
import LegalPage from '../components/legal/LegalPage'
import { RISK_DISCLOSURE } from '../lib/riskDisclosure'

export default function RiskDisclosure() {
  return <LegalPage doc={RISK_DISCLOSURE} icon={AlertTriangle} />
}
