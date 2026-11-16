/**
 * The WhatsApp number (owner, 2026-11-16): required at sign-up beside the
 * Telegram username, and before a customer may connect an exchange. Stored
 * in E.164 (`+66812345678`) — the API's `ContactHandles::normalizeWhatsapp`
 * is the one that decides; this is its client twin, so the field can say
 * what is wrong before the form is sent. Typed, never verified.
 *
 * The form asks for a COUNTRY (its calling code) and the number as people
 * write it at home ("081 234 5678"); `composeWhatsapp` joins the two. A
 * number typed with its own `+` / `00` overrides the picker.
 */

/** ISO 3166 alpha-2 → calling code. NANP countries all share `1` (the area code is part of the number). */
const CALLING_CODES: Record<string, string> = {
  AF: '93', AL: '355', DZ: '213', AS: '1', AD: '376', AO: '244', AI: '1', AG: '1', AR: '54', AM: '374',
  AW: '297', AU: '61', AT: '43', AZ: '994', BS: '1', BH: '973', BD: '880', BB: '1', BY: '375', BE: '32',
  BZ: '501', BJ: '229', BM: '1', BT: '975', BO: '591', BA: '387', BW: '267', BR: '55', VG: '1', BN: '673',
  BG: '359', BF: '226', BI: '257', KH: '855', CM: '237', CA: '1', CV: '238', KY: '1', CF: '236', TD: '235',
  CL: '56', CN: '86', CO: '57', KM: '269', CG: '242', CD: '243', CK: '682', CR: '506', CI: '225', HR: '385',
  CU: '53', CW: '599', CY: '357', CZ: '420', DK: '45', DJ: '253', DM: '1', DO: '1', EC: '593', EG: '20',
  SV: '503', GQ: '240', ER: '291', EE: '372', SZ: '268', ET: '251', FK: '500', FO: '298', FJ: '679', FI: '358',
  FR: '33', GF: '594', PF: '689', GA: '241', GM: '220', GE: '995', DE: '49', GH: '233', GI: '350', GR: '30',
  GL: '299', GD: '1', GP: '590', GU: '1', GT: '502', GG: '44', GN: '224', GW: '245', GY: '592', HT: '509',
  HN: '504', HK: '852', HU: '36', IS: '354', IN: '91', ID: '62', IR: '98', IQ: '964', IE: '353', IM: '44',
  IL: '972', IT: '39', JM: '1', JP: '81', JE: '44', JO: '962', KZ: '7', KE: '254', KI: '686', XK: '383',
  KW: '965', KG: '996', LA: '856', LV: '371', LB: '961', LS: '266', LR: '231', LY: '218', LI: '423', LT: '370',
  LU: '352', MO: '853', MG: '261', MW: '265', MY: '60', MV: '960', ML: '223', MT: '356', MH: '692', MQ: '596',
  MR: '222', MU: '230', YT: '262', MX: '52', FM: '691', MD: '373', MC: '377', MN: '976', ME: '382', MS: '1',
  MA: '212', MZ: '258', MM: '95', NA: '264', NR: '674', NP: '977', NL: '31', NC: '687', NZ: '64', NI: '505',
  NE: '227', NG: '234', NU: '683', KP: '850', MK: '389', MP: '1', NO: '47', OM: '968', PK: '92', PW: '680',
  PS: '970', PA: '507', PG: '675', PY: '595', PE: '51', PH: '63', PL: '48', PT: '351', PR: '1', QA: '974',
  RE: '262', RO: '40', RU: '7', RW: '250', BL: '590', KN: '1', LC: '1', MF: '590', PM: '508', VC: '1',
  WS: '685', SM: '378', ST: '239', SA: '966', SN: '221', RS: '381', SC: '248', SL: '232', SG: '65', SX: '1',
  SK: '421', SI: '386', SB: '677', SO: '252', ZA: '27', KR: '82', SS: '211', ES: '34', LK: '94', SD: '249',
  SR: '597', SE: '46', CH: '41', SY: '963', TW: '886', TJ: '992', TZ: '255', TH: '66', TL: '670', TG: '228',
  TO: '676', TT: '1', TN: '216', TR: '90', TM: '993', TC: '1', TV: '688', UG: '256', UA: '380', AE: '971',
  GB: '44', US: '1', UY: '598', UZ: '998', VU: '678', VA: '39', VE: '58', VN: '84', VI: '1', WF: '681',
  YE: '967', ZM: '260', ZW: '263',
}

/** Which country a shared code reads as when nothing says otherwise. */
const PRIMARY: Record<string, string> = { '1': 'US', '7': 'RU', '44': 'GB', '39': 'IT', '262': 'RE', '590': 'GP' }

/** Italy keeps its leading 0 after the country code; everywhere else it is the trunk prefix and goes. */
const KEEPS_LEADING_ZERO = new Set(['39'])

/** API twin: `+`, a country code that never starts with 0, 7–15 digits in all. */
export const WHATSAPP_PATTERN = /^\+[1-9][0-9]{6,14}$/
export const WHATSAPP_HINT = 'Enter your WhatsApp number with its country code, e.g. +66 81 234 5678.'

export interface PhoneCountry {
  iso: string
  code: string
  name: string
  /** Regional-indicator emoji (Windows shows the two letters instead). */
  flag: string
}

function flagOf(iso: string): string {
  return String.fromCodePoint(...[...iso].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

let cached: PhoneCountry[] | null = null

/** Every country, sorted by its English name. */
export function phoneCountries(): PhoneCountry[] {
  if (cached) return cached
  let names: Intl.DisplayNames | null = null
  try {
    names = new Intl.DisplayNames(['en'], { type: 'region' })
  } catch {
    names = null
  }
  cached = Object.entries(CALLING_CODES)
    .map(([iso, code]) => {
      let name = iso
      try {
        name = names?.of(iso) ?? iso
      } catch {
        name = iso
      }
      return { iso, code, name, flag: flagOf(iso) }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
  return cached
}

export function callingCode(iso: string): string | null {
  return CALLING_CODES[iso] ?? null
}

/** The country the browser says it is in (`en-PH` → PH), if we know its code. */
export function browserCountry(): string {
  try {
    const langs = navigator.languages?.length ? navigator.languages : [navigator.language]
    for (const lang of langs) {
      const region = lang?.split('-')[1]?.toUpperCase()
      if (region && CALLING_CODES[region]) return region
    }
  } catch {
    /* no navigator */
  }
  return ''
}

/**
 * API twin of `normalizeWhatsapp`: a wa.me link, spaces, dashes, dots and
 * brackets, and a leading `00` all reduce to the E.164 form. A number with
 * no country code keeps no `+`, so the pattern refuses it.
 */
export function normaliseWhatsapp(raw: string): string {
  let v = raw.trim()
  const link = /^(?:https?:\/\/)?(?:api\.)?wa\.me\//i
  if (link.test(v)) v = '+' + v.replace(link, '')
  v = v.replace(/[\s\-.() ]/g, '')
  return v.replace(/^00/, '+')
}

/** The picker's country + the typed number → what is sent ('' when nothing is typed). */
export function composeWhatsapp(iso: string, national: string): string {
  const typed = national.trim()
  if (!typed) return ''
  // Typed with its own international prefix (or pasted as a link): it wins.
  if (/^(\+|00|(https?:\/\/)?(api\.)?wa\.me\/)/i.test(typed)) return normaliseWhatsapp(typed)
  const code = callingCode(iso)
  let digits = typed.replace(/\D/g, '')
  if (!code) return digits // no country: refused by the pattern, with the hint
  if (!KEEPS_LEADING_ZERO.has(code)) digits = digits.replace(/^0+/, '')
  return digits ? `+${code}${digits}` : ''
}

/**
 * A stored number back into picker + national part — longest calling code
 * first; a shared code reads as `prefer` when that country has it.
 */
export function splitWhatsapp(e164: string, prefer = ''): { iso: string; national: string } {
  const v = normaliseWhatsapp(e164)
  if (!v.startsWith('+')) return { iso: prefer, national: v }
  const digits = v.slice(1)
  for (let len = 3; len >= 1; len--) {
    const code = digits.slice(0, len)
    const holders = Object.keys(CALLING_CODES).filter((iso) => CALLING_CODES[iso] === code)
    if (!holders.length) continue
    const iso = holders.includes(prefer) ? prefer : (PRIMARY[code] ?? holders[0])
    return { iso, national: digits.slice(len) }
  }
  return { iso: prefer, national: v }
}

/** `+66812345678` → `+66 812345678`, for reading. */
export function formatWhatsapp(e164: string): string {
  const { iso, national } = splitWhatsapp(e164)
  const code = callingCode(iso)
  return code && national ? `+${code} ${national}` : e164
}

/** `https://wa.me/66812345678` — opens a chat with that number. */
export function whatsappUrl(e164: string): string {
  return `https://wa.me/${e164.replace(/\D/g, '')}`
}
