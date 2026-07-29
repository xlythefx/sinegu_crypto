"""
MEXC open position rows from GET /api/v1/private/position/open_positions do not include
unrealized PnL in the official contract v1 field list — only realised, holdFee, etc.
We derive unrealized (USDT) for USDT-linear perps from fair price and contractSize.

See api-docs (mexcdevelop contract v1) — open_positions response table.
"""

from typing import Any, Dict

from mexc_src.mexc_api import MexcFuturesAPI


def _compute_linear_unrealized_usdt(
    position_type: int,
    hold_vol: float,
    hold_avg: float,
    fair: float,
    contract_size: float,
) -> float:
    """USDT-margined linear: PnL ≈ price_diff * (holdVol * contractSize) in base, valued in USDT."""
    if fair <= 0 or hold_avg <= 0 or hold_vol <= 0:
        return 0.0
    cs = float(contract_size or 1.0)
    if cs <= 0:
        cs = 1.0
    base_qty = hold_vol * cs
    if int(position_type) == 1:
        return (fair - hold_avg) * base_qty
    if int(position_type) == 2:
        return (hold_avg - fair) * base_qty
    return 0.0


def enrich_open_position_unrealized(api: MexcFuturesAPI, pos: Dict[str, Any]) -> Dict[str, Any]:
    """Return a shallow copy of ``pos`` with ``unrealized`` set (USDT) when computable."""
    out = dict(pos) if pos else {}
    raw = out.get("unrealized")
    if raw is not None:
        try:
            if abs(float(raw)) > 1e-12:
                out["unrealized"] = float(raw)
                return out
        except (TypeError, ValueError):
            pass

    symbol = (out.get("symbol") or "").strip()
    if not symbol:
        out.setdefault("unrealized", 0.0)
        return out

    try:
        fair = float(api.get_fair_price(symbol) or 0)
    except (TypeError, ValueError):
        fair = 0.0
    detail = api.get_contract_detail(symbol) or {}
    try:
        cs = float(detail.get("contractSize") or 1) or 1.0
    except (TypeError, ValueError):
        cs = 1.0

    try:
        pt = int(out.get("positionType") or 0)
        hv = float(out.get("holdVol") or 0)
        ha = float(out.get("holdAvgPrice") or out.get("openAvgPrice") or 0)
    except (TypeError, ValueError):
        out.setdefault("unrealized", 0.0)
        return out

    u = _compute_linear_unrealized_usdt(pt, hv, ha, fair, cs) if fair and ha and hv else 0.0
    out["unrealized"] = u
    return out
