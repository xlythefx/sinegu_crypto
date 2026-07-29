# Bybit API — Introduction

This folder is for **Bybit** REST/WebSocket notes used alongside this trading API project.

## API key setup

- Create keys in the Bybit account **API** section; use **read-only** keys where possible and **trade** only when required.
- Restrict by **IP** and **permissions** (spot, linear, inverse, options, etc.) to match your product.
- Rotate keys if they are ever exposed; never share secrets or commit them to source control.

> **Danger**  
> Treat API secrets like passwords. Revoke and recreate keys immediately if they leak.

## API key restrictions

Match key permissions to the product (e.g. **Contract trade** vs **Spot**). Confirm each endpoint’s required scope in the official docs.

## Official documentation & SDKs

- **V5 API reference:** [https://bybit-exchange.github.io/docs/v5/intro](https://bybit-exchange.github.io/docs/v5/intro)
- **Integration guide (auth, hosts, signing):** [v5-integration-guide.md](v5-integration-guide.md) (from [Integration Guidance](https://bybit-exchange.github.io/docs/v5/guide))
- **Futures / perps REST overview:** [futures-trading-v5.md](futures-trading-v5.md)
- **Place order (`POST /v5/order/create`):** [place-order-v5.md](place-order-v5.md)
- **Set leverage (`POST /v5/position/set-leverage`):** [set-leverage-v5.md](set-leverage-v5.md)
- **Wallet balance (`GET /v5/account/wallet-balance`):** [wallet-balance-v5.md](wallet-balance-v5.md)
- **Account info (`GET /v5/account/info`):** [account-info-v5.md](account-info-v5.md)
- **Demo trading (api-demo, funds, demo member):** [demo-trading-v5.md](demo-trading-v5.md) · [Official demo doc](https://bybit-exchange.github.io/docs/v5/demo)
- **GitHub (examples & community):** [https://github.com/bybit-exchange](https://github.com/bybit-exchange)

## Broker / institutional programs

Bybit runs partner and institutional programs (rebates, APIs, onboarding). Details change over time—use **Bybit**’s current **Institutional** or **Affiliate** pages from their site for the latest terms and contacts.

## Contact

Use **Bybit Help Center** and in-app support for account and security issues; developer questions are usually handled via official docs and [Bybit API Telegram](https://t.me/BybitAPI) (verify current links on Bybit’s site).
