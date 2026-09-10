/**
 * The address a customer allow-lists when they restrict a Binance key by IP.
 *
 * The authoritative value comes from the API (`server_ip`, sourced from
 * `config('services.engine.public_ip')`) — never hardcode it on a screen that
 * has a session to read it from. This constant is the fallback for the two
 * places that cannot: a response that arrived without the field, and the
 * PUBLIC Binance guide, which is read by visitors who have no session at all.
 */
export const FALLBACK_SERVER_IP = '2.24.139.176'
