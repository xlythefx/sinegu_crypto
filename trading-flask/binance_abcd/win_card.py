"""The "daily win" card — a PNG of the day's result for the Discord wins channel.

It is the admin P&L card (``src/components/admin/pnl-card/PnlShareCard.tsx``)
drawn with Pillow instead of the browser: same frame, same fixed colours, same
fonts (bundled under ``assets/fonts``, OFL), same layout. The engine has no
browser to screenshot, and a Discord embed cannot show a curve — so the card is
drawn here. Keep the two layouts in step.

Privacy is the recap's: every figure comes out of ``reports.summarize`` over
``/api/public/track-record``, which is world-readable — percentages, trade
counts and tickers only. There is no field on :class:`WinCard` that could carry
a balance, an amount or a name.

Pillow is imported lazily and every failure returns ``None``: the caller then
posts the win as a plain embed. A card that cannot be drawn must never cost the
channel its message, and a box missing Pillow must not stop the engine.
"""

from __future__ import annotations

import io
import logging
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Optional

log = logging.getLogger(__name__)

ASSETS = Path(__file__).resolve().parent / "assets"
FONTS = ASSETS / "fonts"

# Fixed colours — the PnlShareCard `C` palette, never a theme.
BG = (10, 12, 17)
PANEL = (17, 22, 30)
BORDER = (31, 39, 50)
TEXT = (231, 236, 243)
MUTED = (139, 148, 163)
FAINT = (90, 99, 114)
ACCENT = (217, 173, 85)
ACCENT_HI = (240, 205, 124)
ACCENT_LO = (185, 138, 53)
ON_ACCENT = (27, 20, 7)
GREEN = (47, 214, 122)
RED = (255, 90, 90)

# Layout is written in the web card's CSS pixels and multiplied by SCALE, so
# the numbers below can be read against the TSX side by side.
SCALE = 2.5
CARD_W = 420
CARD_H = 540


@dataclass
class WinCard:
    """What the card prints. Built by ``reports`` from the public track record."""

    date_label: str                 # "Sep 28, 2026"
    venue: str                      # "Binance"
    return_pct: float               # the day's return, after fees
    trades: int                     # trades closed today (increments)
    curve: list[float] = field(default_factory=list)   # month-to-date chained %, from 0
    green_streak: int = 0           # consecutive green trading days ending today
    month_pct: Optional[float] = None
    month_green: int = 0
    month_days: int = 0
    top_symbol: Optional[str] = None
    top_pct: Optional[float] = None


def fmt_signed_pct(value: float, dp: int = 2) -> str:
    """'+1.23%' / '−0.40%' — the web card's fmtSignedPct, true minus sign included."""
    sign = "−" if value < 0 else "+"
    return f"{sign}{abs(value):.{dp}f}%"


# --- drawing helpers ------------------------------------------------------------

def _s(v: float) -> int:
    return int(round(v * SCALE))


@lru_cache(maxsize=None)
def _font(name: str, size: float, weight: Optional[str] = None):
    from PIL import ImageFont

    font = ImageFont.truetype(str(FONTS / name), _s(size))
    if weight:
        try:
            font.set_variation_by_name(weight)
        except Exception:  # noqa: BLE001 - a static font, or no variation support
            pass
    return font


def _display(size: float):
    return _font("BricolageGrotesque.ttf", size, "ExtraBold")


def _body(size: float, weight: str = "Regular"):
    return _font("PlusJakartaSans.ttf", size, weight)


def _mono(size: float, bold: bool = True):
    return _font("IBMPlexMono-Bold.ttf" if bold else "IBMPlexMono-Medium.ttf", size)


def _text(draw, xy, text, font, fill, anchor="la", spacing: float = 0.0):
    """Draw text at CSS-pixel `xy`. `spacing` is CSS letter-spacing (only ever
    used left-aligned, on the small uppercase labels)."""
    x, y = _s(xy[0]), _s(xy[1])
    if not spacing:
        draw.text((x, y), text, font=font, fill=fill, anchor=anchor)
        return
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill, anchor=anchor)
        x += draw.textlength(ch, font=font) + _s(spacing)


def _rrect(draw, box, radius, fill=None, outline=None, width=1):
    x0, y0, x1, y1 = box
    draw.rounded_rectangle(
        (_s(x0), _s(y0), _s(x1) - 1, _s(y1) - 1),
        radius=_s(radius), fill=fill, outline=outline, width=width,
    )


def _mask_rrect(size, box, radius):
    from PIL import Image, ImageDraw

    mask = Image.new("L", size, 0)
    _rrect(ImageDraw.Draw(mask), box, radius, fill=255)
    return mask


def _frame_gradient(size):
    """The frame's 160° gold: ACCENT_HI top-left → ACCENT at 45% → ACCENT_LO
    bottom-right. Computed on a small grid and upscaled — it is smooth anyway."""
    from PIL import Image

    gw, gh = 42, 54
    small = Image.new("RGB", (gw, gh))
    for y in range(gh):
        for x in range(gw):
            t = 0.35 * x / (gw - 1) + 0.65 * y / (gh - 1)
            if t < 0.45:
                a, b, k = ACCENT_HI, ACCENT, t / 0.45
            else:
                a, b, k = ACCENT, ACCENT_LO, (t - 0.45) / 0.55
            small.putpixel((x, y), tuple(int(a[i] + (b[i] - a[i]) * k) for i in range(3)))
    return small.resize(size, Image.BICUBIC)


def _glow(base, centre, radius, colour, alpha):
    """A soft radial wash of `colour`, strongest at `centre` (CSS px): a filled
    circle blurred into a falloff, the CSS radial-gradient's stand-in."""
    from PIL import Image, ImageDraw, ImageFilter

    layer = Image.new("RGBA", base.size, colour + (0,))
    cx, cy, r = _s(centre[0]), _s(centre[1]), _s(radius) * 0.55
    ImageDraw.Draw(layer).ellipse((cx - r, cy - r, cx + r, cy + r), fill=colour + (int(255 * alpha),))
    base.alpha_composite(layer.filter(ImageFilter.GaussianBlur(_s(radius) * 0.4)))


def _sparkline(base, box, curve, colour):
    """The web card's Sparkline: dot grid, dashed zero line, gradient fill,
    the path, and a haloed end dot."""
    from PIL import Image, ImageDraw

    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    pts = curve if len(curve) > 1 else [0.0, 0.0]
    lo, hi = min(0.0, *pts), max(0.0, *pts)
    span = (hi - lo) or 1.0

    def px(i):
        return x0 + 6 + i / (len(pts) - 1) * (w - 12)

    def py(v):
        return y1 - 10 - (v - lo) / span * (h - 20)

    draw = ImageDraw.Draw(base)
    step = 14
    for gy in range(int(y0) + 1, int(y1), step):
        for gx in range(int(x0) + 1, int(x1), step):
            r = 0.9 * SCALE
            draw.ellipse((_s(gx) - r, _s(gy) - r, _s(gx) + r, _s(gy) + r), fill=BORDER)

    zero = py(0)
    gx = x0
    while gx < x1:
        draw.line((_s(gx), _s(zero), _s(min(gx + 3, x1)), _s(zero)), fill=FAINT, width=max(1, _s(1)))
        gx += 8

    line = [(_s(px(i)), _s(py(v))) for i, v in enumerate(pts)]

    # Gradient fill under the path: a vertical alpha ramp masked to the area.
    size = base.size
    area = Image.new("L", size, 0)
    ImageDraw.Draw(area).polygon(line + [(line[-1][0], _s(y1)), (line[0][0], _s(y1))], fill=255)
    top, bottom = _s(min(py(v) for v in pts)), _s(y1)
    ramp = Image.new("L", size, 0)
    ramp_draw = ImageDraw.Draw(ramp)
    for yy in range(top, bottom):
        ramp_draw.line((0, yy, size[0], yy), fill=int(82 * (1 - (yy - top) / max(1, bottom - top))))
    from PIL import ImageChops

    fill = Image.new("RGBA", size, colour + (0,))
    fill.putalpha(ImageChops.multiply(area, ramp))
    base.alpha_composite(fill)

    draw = ImageDraw.Draw(base)
    draw.line(line, fill=colour, width=_s(2.5), joint="curve")
    lw = _s(2.5) / 2
    for x, y in (line[0], line[-1]):
        draw.ellipse((x - lw, y - lw, x + lw, y + lw), fill=colour)
    if len(pts) <= 24:
        for x, y in line[1:-1]:
            r = _s(2.2)
            draw.ellipse((x - r, y - r, x + r, y + r), fill=BG, outline=colour, width=max(1, _s(1.5)))

    ex, ey = line[-1]
    halo = Image.new("RGBA", size, (0, 0, 0, 0))
    r = _s(9)
    ImageDraw.Draw(halo).ellipse((ex - r, ey - r, ex + r, ey + r), fill=colour + (46,))
    base.alpha_composite(halo)
    draw = ImageDraw.Draw(base)
    r = _s(6.5)
    draw.ellipse((ex - r, ey - r, ex + r, ey + r), fill=BG)
    r = _s(4.5)
    draw.ellipse((ex - r, ey - r, ex + r, ey + r), fill=colour)


def _bar(draw, box, share, colour):
    x0, y0, x1, y1 = box
    _rrect(draw, box, 2, fill=BORDER)
    filled = x0 + (x1 - x0) * max(0.0, min(1.0, share))
    if filled - x0 >= 2:
        _rrect(draw, (x0, y0, filled, y1), 2, fill=colour)


def _tile(draw, box, label, value, value_fill, sub=None, sub_fill=FAINT, bar=None):
    x0, y0, x1, _ = box
    _rrect(draw, box, 12, fill=PANEL, outline=BORDER, width=max(1, _s(1)))
    _text(draw, (x0 + 12, y0 + 10), label.upper(), _mono(9.5, bold=False), MUTED, spacing=1.2)
    _text(draw, (x0 + 12, y0 + 26), value, _mono(17), value_fill)
    if bar is not None:
        _bar(draw, (x0 + 12, y0 + 57, x1 - 12, y0 + 61), bar, GREEN)
    elif sub:
        _text(draw, (x0 + 12, y0 + 55), sub, _body(10.5), sub_fill)


# --- the card -----------------------------------------------------------------------

def render(card: WinCard) -> Optional[bytes]:
    """The card as PNG bytes, or None when it cannot be drawn (no Pillow, a
    missing font) — the caller posts a plain embed instead."""
    try:
        return _render(card)
    except Exception:  # noqa: BLE001 - a card must never cost the channel its message
        log.exception("[win-card] render failed — posting without the image")
        return None


def _render(card: WinCard) -> bytes:
    from PIL import Image, ImageDraw, ImageFilter

    size = (_s(CARD_W), _s(CARD_H))
    tone = GREEN if card.return_pct >= 0 else RED

    # Gold frame (the outer 4px border and the brand band beneath the panel).
    frame = _frame_gradient(size).convert("RGBA")
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    img.paste(frame, (0, 0), _mask_rrect(size, (0, 0, CARD_W, CARD_H), 24))

    # The dark panel, with its two washes, clipped to its rounded corners.
    panel_box = (4, 4, CARD_W - 4, 488)
    panel = Image.new("RGBA", size, BG + (255,))
    _glow(panel, (CARD_W, 0), 260, tone, 0.22)
    _glow(panel, (0, 488), 220, ACCENT, 0.08)
    img.paste(panel, (0, 0), _mask_rrect(size, panel_box, 20))

    draw = ImageDraw.Draw(img)

    # Header: logo, name, period pill; date + venue on the right.
    try:
        logo = Image.open(ASSETS / "logo.png").convert("RGBA").resize((_s(38), _s(38)), Image.LANCZOS)
        img.paste(logo, (_s(22), _s(22)), _mask_rrect(logo.size, (0, 0, 38, 38), 10))
        # A solid mix, not an alpha: ImageDraw REPLACES pixels on RGBA, so a
        # translucent outline would punch a hole through the card.
        _rrect(draw, (22, 22, 60, 60), 10, outline=(95, 77, 42), width=max(1, _s(1)))
    except Exception:  # noqa: BLE001 - the card still reads without the mark
        log.warning("[win-card] logo unavailable")
    _text(draw, (70, 22), "Pixel Alpha", _display(17), TEXT)
    pill_font = _body(10.5, "Bold")
    pill_w = draw.textlength("Today", font=pill_font) / SCALE + 18
    _rrect(draw, (70, 44, 70 + pill_w, 62), 9, fill=(43, 36, 22), outline=(95, 77, 42), width=max(1, _s(1)))
    _text(draw, (70 + pill_w / 2, 53), "Today", pill_font, ACCENT, anchor="mm")
    _text(draw, (398, 26), card.date_label, _body(11, "SemiBold"), TEXT, anchor="ra")
    _text(draw, (398, 43), card.venue, _body(11), MUTED, anchor="ra")

    # Hero figure, with its glow drawn on a blurred layer beneath it.
    _text(draw, (22, 82), "RETURN", _mono(10, bold=False), MUTED, spacing=1.6)
    # Three decimals, like the recap posted beside it — the two must read alike.
    figure = fmt_signed_pct(card.return_pct, 3)
    glow = Image.new("RGBA", size, (0, 0, 0, 0))
    _text(ImageDraw.Draw(glow), (22, 94), figure, _mono(50), tone + (150,))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(_s(12))))
    draw = ImageDraw.Draw(img)
    _text(draw, (22, 94), figure, _mono(50), tone)
    trades = f"{card.trades} trade{'s' if card.trades != 1 else ''} closed today"
    _text(draw, (22, 158), trades, _body(12), MUTED)

    # Month-to-date curve.
    _sparkline(img, (18, 184, 402, 294), card.curve or [0.0, card.return_pct], tone)
    draw = ImageDraw.Draw(img)
    _text(draw, (26, 186), "MONTH TO DATE", _mono(9, bold=False), FAINT, spacing=1.2)

    # 2 × 2 stats, the web card's grid.
    left, right, gap = (22, 205), (215, 398), 10
    row1, row2 = (304, 382), (392, 470)
    _tile(draw, (left[0], row1[0], left[1], row1[1]), "Trades", str(card.trades), TEXT, sub="closed today")
    streak = card.green_streak
    _tile(
        draw, (right[0], row1[0], right[1], row1[1]), "Green streak",
        f"{streak} day{'s' if streak != 1 else ''}", ACCENT if streak > 1 else TEXT,
        sub="in profit in a row",
    )
    if card.month_pct is None:
        _tile(draw, (left[0], row2[0], left[1], row2[1]), "Month to date", "—", TEXT)
    else:
        _tile(
            draw, (left[0], row2[0], left[1], row2[1]), "Month to date",
            fmt_signed_pct(card.month_pct), GREEN if card.month_pct >= 0 else RED,
            sub=f"{card.month_green} of {card.month_days} days green",
        )
    if card.top_symbol and card.top_pct is not None:
        _tile(
            draw, (right[0], row2[0], right[1], row2[1]), "Top asset", card.top_symbol, TEXT,
            sub=fmt_signed_pct(card.top_pct), sub_fill=GREEN if card.top_pct >= 0 else RED,
        )
    else:
        _tile(draw, (right[0], row2[0], right[1], row2[1]), "Top asset", "—", TEXT)

    # Brand band on the gold — the site only; the owner dropped the wordmark
    # (2026-09-28), the header already names Pixel Alpha.
    _text(draw, (400, 497), "Automated crypto trading", _body(11), ON_ACCENT, anchor="ra")
    _text(draw, (400, 512), "pixel-alpha.com", _body(11, "ExtraBold"), ON_ACCENT, anchor="ra")

    out = io.BytesIO()
    img.save(out, format="PNG", optimize=True)
    return out.getvalue()
