import { Lock } from 'lucide-react'
import LegalPage from '../components/legal/LegalPage'
import { PRIVACY } from '../lib/privacy'

export default function Privacy() {
  return <LegalPage doc={PRIVACY} icon={Lock} />
}
