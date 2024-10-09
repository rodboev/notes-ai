export const getWsUrl = () => {
  if (typeof window === 'undefined') return 'ws://localhost/api/ws'

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host // This includes the port if it's not the default
  return `${protocol}//${host}/api/ws`
}

export const ConnectionIndicator = ({ url, wsStatus }) => {
  const isAvailable = !wsStatus.includes('Unable') && !wsStatus.includes('Error')

  return (
    <>
      <div className={`flex items-center ${isAvailable ? 'text-green-500' : 'text-red-500'}`}>
        {isAvailable ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
      </div>
      <div>{[url, wsStatus].join(': ')}</div>
    </>
  )
}
