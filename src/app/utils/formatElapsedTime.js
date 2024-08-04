export function formatElapsedTime(ms) {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  const minutesText =
    minutes > 0 ? `${minutes} min${minutes !== 1 ? 's' : ''}` : ''
  const secondsText =
    seconds > 0 ? `${seconds} sec${seconds !== 1 ? 's' : ''}` : ''

  return minutes > 0
    ? seconds > 0
      ? `${minutesText} ${secondsText}`
      : minutesText
    : secondsText
}
