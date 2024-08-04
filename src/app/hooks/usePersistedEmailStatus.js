import { useEffect } from 'react'
import { useEmailStatus } from '../contexts/EmailStatusContext'

export function usePersistedEmailStatus(fingerprint) {
  const [emailStatus, setEmailStatus, isLoading] = useEmailStatus(fingerprint)

  useEffect(() => {
    if (!isLoading && emailStatus) {
      localStorage.setItem(`emailStatus_${fingerprint}`, emailStatus)
    }
  }, [fingerprint, emailStatus, isLoading])

  const updateEmailStatus = (newStatus) => {
    setEmailStatus(newStatus)
    localStorage.setItem(`emailStatus_${fingerprint}`, newStatus)
  }

  return [emailStatus, updateEmailStatus, isLoading]
}
