import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { useConnectModal } from '@rainbow-me/rainbowkit'

export const useWallet = () => {
  const { address, isConnected, isConnecting } = useAccount()
  const { disconnect } = useDisconnect()
  const { openConnectModal } = useConnectModal()

  const connectWallet = () => {
    if (openConnectModal) {
      openConnectModal()
    }
  }

  const disconnectWallet = () => {
    disconnect()
  }

  const formatAddress = (addr: string | undefined) => {
    if (!addr) return ''
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  return {
    address,
    isConnected,
    isConnecting,
    connectWallet,
    disconnectWallet,
    formatAddress,
  }
}