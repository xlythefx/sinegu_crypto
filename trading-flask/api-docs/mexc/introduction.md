# MEXC API — Introduction

## API key setup

Some endpoints require an API key. See MEXC’s official documentation for [API key creation](https://www.mexc.com/user/openapi).

After a key is created:

- **IP restrictions:** Set IP allowlists on the key where possible.
- **Trading pairs:** In **My API Key → Trading Pairs → Set**, limit which symbols the key may trade.
- **Renewal:** From **5 days before** key expiry, you can extend validity by **90 days** in **My API Key → Action → Renew**.

> **Danger**  
> Never share your API key or secret with anyone. If keys are exposed, **delete them immediately** and create new keys.

## API key restrictions

When creating a key, enable only the permissions your integration needs (read, trade, withdraw, etc.). Check each endpoint’s requirements in the official API reference.

## API library (SDKs)

MEXC provides SDKs in **Python, .NET, Java, JavaScript, and Go** for calling spot APIs through the SDK.

Repository: [https://github.com/mexcdevelop/mexc-api-sdk](https://github.com/mexcdevelop/mexc-api-sdk)

> **Info**  
> For SDK or API issues, use MEXC’s official feedback channels listed under [Contact](#contact).

## MEXC broker introduction

MEXC focuses on crypto infrastructure. API brokers that add value are part of that ecosystem. Brokers can receive benefits such as **trading rebates** and **marketing support**.

### Broker modes supported by MEXC

1. **API broker**  
   Copy-trading platforms, bots, quant/strategy platforms, or other asset-management services (e.g. **500+** users). Users authorize an API key to the broker; the broker sends orders (including broker ID) on the user’s behalf and may share in fees.

2. **Independent broker**  
   Wallets, market-data or aggregation platforms, brokers with their own user base, etc. MEXC can provide matching, accounts, settlement, and main/sub-account systems. Independent brokers tap MEXC liquidity and depth and may share in fees.

Partnership inquiries: **institution@mexc.com**

## Contact

| Topic | Channel |
|--------|---------|
| General API questions (not in docs) | **MEXC API Telegram Group** |
| Market making (MM) | **MEXC API Support Group** |
| Account issues (missing funds, 2FA, etc.) | **MEXC Customer Support** (website / app online support) |

---

**Related:** [General info — base URL, signing, limits, errors](general-info.md) · [ENUMs & status codes](enums.md) · [Market data (spot, public REST)](market-data-endpoints.md) · [Spot account & trade (signed)](spot-account-trade.md) · [Futures — integration guide](futures-integration-guide.md) · [Futures — market data (public)](futures-market-endpoints.md) · [Futures — account & trading (private)](futures-account-trading-endpoints.md) · [Futures — error codes](futures-error-codes.md)

**Official API reference (spot & more):** [https://mexcdevelop.github.io/apidocs/](https://mexcdevelop.github.io/apidocs/)
