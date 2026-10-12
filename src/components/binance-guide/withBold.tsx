/** Renders `**bold**` spans; nothing else in the guide copy is parsed. */
export function withBold(text: string) {
  return text
    .split('**')
    .map((part, i) =>
      i % 2 === 1 ? (
        <strong key={i} className="font-bold text-text">
          {part}
        </strong>
      ) : (
        part
      ),
    )
}
