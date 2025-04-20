export function formatFileSize(
  bytes: number | null | undefined,
  decimals = 1,
): string {
  if (bytes == null || isNaN(bytes) || bytes <= 0) return '0 B'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

  if (bytes <= 0) return '0 B'

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  const safeIndex = Math.max(0, Math.min(i, sizes.length - 1))
  const unit = sizes[safeIndex]
  const value = parseFloat((bytes / Math.pow(k, safeIndex)).toFixed(dm))

  if (isNaN(value) || !isFinite(value)) {
    console.warn(`formatFileSize failed for bytes: ${bytes}`)
    return `${bytes} B`
  }

  return `${value} ${unit}`
}

const RFT = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
const DIVISIONS: Array<{ amount: number; name: Intl.RelativeTimeFormatUnit }> =
  [
    { amount: 60, name: 'seconds' },
    { amount: 60, name: 'minutes' },
    { amount: 24, name: 'hours' },
    { amount: 7, name: 'days' },
    { amount: 4.34524, name: 'weeks' },
    { amount: 12, name: 'months' },
    { amount: Number.POSITIVE_INFINITY, name: 'years' },
  ]

export function formatRelativeTime(
  timestampSeconds: number | null | undefined,
): string {
  if (
    timestampSeconds == null ||
    isNaN(timestampSeconds) ||
    timestampSeconds <= 0
  ) {
    return ''
  }
  try {
    const date = new Date(timestampSeconds * 1000)
    if (isNaN(date.getTime())) {
      console.warn(
        `formatRelativeTime received invalid timestamp (seconds): ${timestampSeconds}`,
      )
      return ''
    }

    const now = new Date()
    let duration = (date.getTime() - now.getTime()) / 1000

    for (const division of DIVISIONS) {
      if (Math.abs(duration) < division.amount) {
        return RFT.format(Math.round(duration), division.name)
      }
      duration /= division.amount
    }
    return ''
  } catch (e) {
    console.error(
      'Error formatting relative time for timestamp:',
      timestampSeconds,
      e,
    )
    return ''
  }
}
