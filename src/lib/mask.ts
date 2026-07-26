/**
 * Mask a sensitive key for display: "AbCd •••• •••• WxYz".
 * Pass visible=true to show the full value (eye toggle).
 */
export function maskSecret(
  value: string,
  visible: boolean,
  head = 4,
  tail = 4,
): string {
  if (visible) return value
  if (value.length <= head + tail + 1) return '•'.repeat(Math.max(value.length, 6))
  return `${value.slice(0, head)} •••• •••• ${value.slice(-tail)}`
}
