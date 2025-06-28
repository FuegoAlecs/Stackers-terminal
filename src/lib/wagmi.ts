import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { mainnet, polygon, optimism, arbitrum, base, baseSepolia } from 'wagmi/chains'

const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'demo_project_id'
const ENVIRONMENT = import.meta.env.VITE_ENVIRONMENT || 'development'

// Configure chains based on environment
const chains = ENVIRONMENT === 'production' 
  ? [mainnet, base, polygon, optimism, arbitrum] as const
  : [baseSepolia, mainnet, base] as const

export const config = getDefaultConfig({
  appName: 'Terminal Wallet App',
  projectId: WALLETCONNECT_PROJECT_ID,
  chains,
  ssr: false, // If your dApp uses server side rendering (SSR)
})