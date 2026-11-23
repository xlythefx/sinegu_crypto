/**
 * A filter change replays the region's children one after another (60 ms
 * apart) instead of a hard cut — the strategy list and each strategy's page.
 * Put it on a container keyed on the filters, and only AFTER the first
 * render (the first reveal belongs to AOS). `both` holds each child on its
 * end frame, so one AOS has not revealed yet can never be left invisible.
 */
export const STAGGER_REVEAL =
  '[&>*]:animate-[fadeup_0.45s_cubic-bezier(0.22,1,0.36,1)_both] [&>*:nth-child(2)]:[animation-delay:60ms] [&>*:nth-child(3)]:[animation-delay:120ms] [&>*:nth-child(4)]:[animation-delay:180ms] [&>*:nth-child(5)]:[animation-delay:240ms] [&>*:nth-child(6)]:[animation-delay:300ms] [&>*:nth-child(n+7)]:[animation-delay:360ms]'
