/**
 * Static prototype data for the not-yet-wired Settings sections
 * (payment method, payout wallets, bank wire) — replaced by the
 * services/ layer once the corresponding sinegutrade-api endpoints exist.
 */

export interface SavedCard {
  id: string
  brand: string
  last4: string
  expiry: string
}

export const SAVED_CARDS: SavedCard[] = [
  { id: 'pm_01', brand: 'Visa', last4: '4242', expiry: '08/27' },
]

export interface PayoutWallet {
  id: string
  name: string
  network: 'TRC20'
  address: string
}

export const PAYOUT_WALLETS: PayoutWallet[] = [
  {
    id: 'w_01',
    name: 'Main USDT wallet',
    network: 'TRC20',
    address: 'TQ5kkPMHdRhpYDFuU5eVe5nkTUcuXBCLCM',
  },
]

export type BankCurrency = 'USD' | 'EUR'

export interface BankAccount {
  id: string
  label: string
  currency: BankCurrency
  holderName: string
  bankName: string
  bankAddress: string
  accountType: string
  routingNumber: string
  accountNumber: string
  swiftBic: string
  iban: string
}

export const BANK_ACCOUNTS: BankAccount[] = [
  {
    id: 'bw_01',
    label: 'Primary USD account',
    currency: 'USD',
    holderName: 'Alex Trader',
    bankName: 'Chase Bank',
    bankAddress: '270 Park Ave, New York, NY',
    accountType: 'Checking',
    routingNumber: '021000021',
    accountNumber: '483920175',
    swiftBic: 'CHASUS33',
    iban: '',
  },
]
