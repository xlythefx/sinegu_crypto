# Data model — Referrals

Backend: `C:\wamp64\www\sinegutrade-api`. New migrations go in `database/migrations`, models in
`app/Models`. Match existing conventions (see `create_user_credentials_table` and the generalized
`invoices` table). Canonical behaviour source: [affiliate-rebuild-spec.md](./affiliate-rebuild-spec.md)
(the mother-system spec) — this doc is its adaptation to our stack.

## Existing columns we build on (do NOT recreate)

- **`user_credentials`** — PK is `uni_id` (UUID string, 36). Already has:
  - `affiliate_percentage decimal(5,2) default 20.00` ← **the flat commission rate**
  - `realized_percentage` / `unrealized_percentage`, `status enum(pending|active|suspended)`,
    `name`, `email`, `user_profile`, `user_banner`.
- **`invoices`** (unified, exchange-agnostic) — already has: `id`, `user_id` (FK
  `user_credentials.uni_id`), `account_id`, `exchange enum(binance|bybit|mexc)`, `month_year` (YYYY-MM),
  `realized_pnl`, `unrealized_pnl`, `fee_realized`, `fee_unrealized`, **`total_fee`**,
  `status enum(pending|paid|failed|overdue)`, `due_date`, timestamps.
  → Commission is derived from `total_fee` of **paid** invoices belonging to referred users.

## The five owned tables (spec §1, adapted)

Adaptations vs the mother spec: `broker` → **`exchange enum(binance,bybit,mexc)`**; uni_id columns are
`varchar(36)` (real UUIDs, FK-compatible); Laravel `id` PKs + timestamps; two extra unique keys (below).

### 1. `referral_codes` — one code per referrer
```
id            BIGINT PK
user_uni_id   VARCHAR(36)  UNIQUE  (FK → user_credentials.uni_id, cascade)
code          VARCHAR(50)  UNIQUE
created_at / updated_at
```
`UNIQUE(user_uni_id)` enforces one-code-per-referrer (the spec implies it but never constrains it).

### 2. `referral_tracking` — the network edge (one row per referred user)
```
id                    BIGINT PK
referral_code         VARCHAR(50)
referrer_uni_id       VARCHAR(36)  (FK → user_credentials, cascade, INDEX)
referred_user_uni_id  VARCHAR(36)  (FK → user_credentials, cascade)
created_at                                                   // "referred at"
UNIQUE (referral_code, referred_user_uni_id)                 // spec key: re-binding is a no-op
UNIQUE (referred_user_uni_id)                                // hardening: one network per user, ever
```
The second unique key closes a double-pay hole in the mother spec: without it a user could sit in two
networks and both referrers could release commission on the same invoice (the payout-items key includes
the referrer, so it would not stop that).

**Removal** = delete the tracking row only. Payout history is intentionally untouched.

### 3. `referrer_payouts` — one envelope per admin release action
```
id               BIGINT PK
referrer_uni_id  VARCHAR(36)  (INDEX — deliberately NO FK: audit history survives user deletion)
month_year       CHAR(7) NULL                               // NULL = envelope spans months
total_amount     DECIMAL(12,2)                              // USD released (audit figure)
payout_address   VARCHAR(255)                               // crypto address or bank label
tx_hash          VARCHAR(255) NULL                          // blockchain proof (crypto)
paid_at          DATETIME
status           ENUM('pending','paid','rejected') DEFAULT 'paid'
payment_method   ENUM('crypto','bank_wire') DEFAULT 'crypto'
proof_file       VARCHAR(500) NULL                          // private-disk path (bank wire)
created_at / updated_at
```

### 4. `referrer_payout_items` — the released lines inside an envelope. **The release-state mechanism.**
```
id                    BIGINT PK
payout_id             BIGINT  (FK → referrer_payouts.id, ON DELETE CASCADE)
referrer_uni_id       VARCHAR(36)   (no FK)
referred_user_uni_id  VARCHAR(36)   (no FK)
exchange              ENUM('binance','bybit','mexc')
month_year            CHAR(7)                               // YYYY-MM
fee_paid              DECIMAL(20,8)                         // the invoice total_fee behind this line
commission            DECIMAL(20,8)                         // fee_paid × pct/100, FROZEN at release
released_at / created_at
UNIQUE (referrer_uni_id, referred_user_uni_id, exchange, month_year)   // uq_payout_items_line
```
- **There is deliberately NO `invoice_id` column and NO FK to `invoices`** (spec §6.10): invoice tables
  get cleared and regenerated during resets; payout history must survive that without enabling
  double-pays. The (referrer, user, exchange, month) key is the guard. Release items travel through the
  API as **triples** `{referred_user_uni_id, exchange, month_year}`, never invoice ids.
- **Releasable** line = a `paid` invoice of a tracked user with **no** row here.
- **Released** = has a row here. Undo = delete the envelope (items cascade) → releasable again.

### 5. `community_details` — optional public profile, 1:1 with the code
```
id              BIGINT PK
referral_id     BIGINT  UNIQUE  (FK → referral_codes.id, ON DELETE CASCADE)
community_name  VARCHAR(255)
bio             TEXT
profile_banner  VARCHAR(500) NULL      // columns exist per spec; NO upload endpoints/UI (deliberate)
profile_image   VARCHAR(500) NULL
created_at / updated_at
```

## Payout-method tables (prerequisite, owned by settings — not affiliate-owned)

### `crypto_wallets`
```
id BIGINT PK · uni_id VARCHAR(36) (FK cascade) · network VARCHAR(50) · address VARCHAR(255)
name VARCHAR(100) · is_main BOOLEAN DEFAULT 0 · created_at / updated_at
```

### `bank_wire_accounts`
```
id BIGINT PK · uni_id VARCHAR(36) (FK cascade) · label · account_holder · bank_name · account_number
routing_number · iban · swift_bic · account_type · bank_address · currency VARCHAR(10)
is_main BOOLEAN DEFAULT 0 · created_at / updated_at        (detail fields nullable strings)
```
One `is_main` per (user, type); marking main pre-fills the admin release screen.

## Models (`app/Models`)

- `ReferralCode` — `belongsTo` UserCredential (`user_uni_id`), `hasOne` CommunityDetail (`referral_id`).
- `ReferralTracking` — `belongsTo` referrer / referred UserCredential.
- `ReferrerPayout` — `hasMany` ReferrerPayoutItem; `toApiArray()` handles `month_year === null`
  ("Multiple months" is a frontend label).
- `ReferrerPayoutItem` — `belongsTo` ReferrerPayout.
- `CommunityDetail` — `belongsTo` ReferralCode.
- `CryptoWallet` / `BankWireAccount` — `belongsTo` UserCredential.
- House style: complete `$fillable`; money columns **uncast** on the model, `(float)`+`round` only at
  serialization in `toApiArray()`; commission math itself is bcmath on strings (never PHP floats).

## Optional seed (for verifying phase 3/4)

Seed a small chain in `sinegu_crypto`: a referrer with a `referral_codes` row + community, 2–3
referred users registered through the code (rows in `referral_tracking`), and a few `invoices`
(mix of `paid`/`pending`/`overdue`, different `exchange`) so KPIs, network table, and releasable
totals have real data.
