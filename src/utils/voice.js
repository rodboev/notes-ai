export const getWsUrl = () => {
  if (typeof window === 'undefined') return 'ws://localhost/api/ws'

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host // This includes the port if it's not the default
  return `${protocol}//${host}/api/ws`
}
