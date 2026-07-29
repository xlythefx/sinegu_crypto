# Binance API — Introduction

This folder is for **Binance** (spot, futures, etc.) API notes aligned with this project’s Binance integration.

## API key setup

- Create API keys from **Binance** → **API Management** (exact UI varies by product: spot vs futures vs US).
- Enable **IP access restrictions** and the **minimal permissions** needed (read, trade, futures, etc.).
- For testnet/paper, use Binance’s **testnet** key flows where applicable.

> **Danger**  
> Never share API keys or secrets. If compromised, **delete** the key and create a new one.

## API key restrictions

Enable only the permissions your application needs. Futures and spot often use **separate** key types or product toggles—check the endpoint’s product line in the official docs.

## Official documentation & SDKs

- **Binance Developers:** [https://developers.binance.com/docs](https://developers.binance.com/docs)
- **Community connectors:** Search Binance’s GitHub org for official and maintained client libraries.

## Broker / ecosystem

Binance offers institutional and broker programs; terms and application paths are published on Binance’s main site. Use official channels for partnerships.

## Contact

Account, KYC, and security issues: **Binance Support** via the website or app. API-specific documentation and announcements: **Binance Developers** portal above.
