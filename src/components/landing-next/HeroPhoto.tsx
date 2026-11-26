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
      <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--bg)_0%,transparent_65%)] opacity-50 max-[960px]:bg-[linear-gradient(180deg,var(--bg)_0%,transparent_55%)]" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-[linear-gradient(180deg,transparent,var(--bg))]" />
    </div>
  )
}
