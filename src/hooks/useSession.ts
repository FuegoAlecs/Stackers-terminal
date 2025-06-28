import { useEffect, useState } from 'react'
import { sessionManager, type SessionData } from '../lib/SessionManager'

export const useSession = () => {
  const [session, setSession] = useState<SessionData>(sessionManager.getSession())

  useEffect(() => {
    // Set up a listener for session changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'terminal-session') {
        setSession(sessionManager.getSession())
      }
    }

    window.addEventListener('storage', handleStorageChange)
    
    // Also listen for direct session updates
    const interval = setInterval(() => {
      setSession(sessionManager.getSession())
    }, 1000) // Check every second for updates

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(interval)
    }
  }, [])

  const updateWallet = (walletInfo: Partial<SessionData['wallet']>) => {
    sessionManager.updateWallet(walletInfo)
    setSession(sessionManager.getSession())
  }

  const updateSmartWallet = (smartWalletInfo: Partial<SessionData['smartWallet']>) => {
    sessionManager.updateSmartWallet(smartWalletInfo)
    setSession(sessionManager.getSession())
  }

  const addToHistory = (command: string) => {
    sessionManager.addToHistory(command)
    setSession(sessionManager.getSession())
  }

  const setAlias = (name: string, command: string) => {
    sessionManager.setAlias(name, command)
    setSession(sessionManager.getSession())
  }

  const removeAlias = (name: string) => {
    const removed = sessionManager.removeAlias(name)
    if (removed) {
      setSession(sessionManager.getSession())
    }
    return removed
  }

  const saveScript = (name: string, commands: string[]) => {
    const saved = sessionManager.saveScript(name, commands)
    if (saved) {
      setSession(sessionManager.getSession())
    }
    return saved
  }

  const removeScript = (name: string) => {
    const removed = sessionManager.removeScript(name)
    if (removed) {
      setSession(sessionManager.getSession())
    }
    return removed
  }

  return {
    session,
    updateWallet,
    updateSmartWallet,
    addToHistory,
    setAlias,
    removeAlias,
    saveScript,
    removeScript,
    getStats: () => sessionManager.getStats(),
    export: () => sessionManager.export(),
    import: (data: string) => {
      const result = sessionManager.import(data)
      if (result.success) {
        setSession(sessionManager.getSession())
      }
      return result
    },
    reset: () => {
      sessionManager.reset()
      setSession(sessionManager.getSession())
    }
  }
}