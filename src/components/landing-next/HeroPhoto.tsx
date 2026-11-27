/**
 * The hero's backdrop: the classic home page's Wall Street photo, as a pixel
 * mosaic. The file is the same photo shrunk to 128 × 72 blocks and 32 colours
 * (`public/assets/hero-wallst-pixel.png`, 15 KB against the original's 3 MB);
 * the browser scales it up with `image-rendering: pixelated`, so every block
 * stays a hard-edged square at any screen size.
 *
 * Three layers keep the words readable in both themes: a wash of the page
 * colour over everything, a stronger one behind the text on the left, and a
 * fade into the page at the bottom so the next section starts clean.
 *
 * The left layer is solid for the first quarter and fades out by three
 * quarters (owner, 2026-11-27: "grey on grey, hard to read"). At half strength
 * to 65% the paragraph's worst block measured 3.6:1; now it is 8.4:1 with the
 * hero's lighter body text. The right side, where the order book sits, keeps
 * the picture as it was.
 */
export default function HeroPhoto() {
  return (
    <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
      <img
        src="/assets/hero-wallst-pixel.png"
        alt=""
        decoding="async"
        className="absolute inset-0 h-full w-full max-w-none object-cover object-[center_35%] [image-rendering:pixelated]"
      />
      <div className="absolute inset-0 bg-bg opacity-[0.72]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--bg)_0%,var(--bg)_25%,transparent_75%)] opacity-[0.85] max-[960px]:bg-[linear-gradient(180deg,var(--bg)_0%,var(--bg)_20%,transparent_60%)]" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-[linear-gradient(180deg,transparent,var(--bg))]" />
    </div>
  )
}
