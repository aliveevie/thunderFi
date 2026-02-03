import { createAppKit } from '@reown/appkit/react'
import { WagmiProvider } from 'wagmi'
import { sepolia, mainnet, arbitrum, base, polygon } from 'wagmi/chains'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { QueryClient } from '@tanstack/react-query'
import type { AppKitNetwork } from '@reown/appkit/networks'

// Get project ID from environment
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID

if (!projectId) {
  console.warn('WalletConnect Project ID not found. Please set VITE_WALLETCONNECT_PROJECT_ID')
}

// Define chains for thunderFi
export const chains: [AppKitNetwork, ...AppKitNetwork[]] = [sepolia, mainnet, arbitrum, base, polygon]

// Create query client
export const queryClient = new QueryClient()

// Metadata for the app
const metadata = {
  name: 'thunderFi',
  description: 'Gasless, Privacy-Preserving USDC Trading Platform',
  url: 'https://thunderfi.xyz',
  icons: ['https://thunderfi.xyz/icon.png']
}

// Create Wagmi adapter
const wagmiAdapter = new WagmiAdapter({
  projectId: projectId || '',
  networks: chains,
})

// Export wagmi config for use in providers
export const wagmiConfig = wagmiAdapter.wagmiConfig

// Create AppKit modal
createAppKit({
  adapters: [wagmiAdapter],
  projectId: projectId || '',
  networks: chains,
  defaultNetwork: sepolia,
  metadata,
  features: {
    analytics: true,
    email: false,
    socials: false,
  },
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#f59e0b', // Thunder yellow/amber
    '--w3m-border-radius-master': '8px',
  }
})

export { WagmiProvider }
