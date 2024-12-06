import { Check, X } from 'lucide-react'

export const getWsUrl = () => {
  if (typeof window === 'undefined') return 'ws://localhost/api/ws'

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host =
    process.env.NODE_ENV === 'production'
      ? window.location.host // Uses Heroku domain without port
      : `${window.location.hostname}:${process.env.PORT || 3000}`

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
