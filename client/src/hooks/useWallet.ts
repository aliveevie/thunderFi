import { useAppKit, useAppKitAccount, useAppKitNetwork } from '@reown/appkit/react'
import { useDisconnect } from 'wagmi'

export function useWallet() {
  const { open } = useAppKit()
  const { address, isConnected, status } = useAppKitAccount()
  const { chainId } = useAppKitNetwork()
  const { disconnect: wagmiDisconnect } = useDisconnect()

  const connect = () => {
    open({ view: 'Connect' })
  }

  const disconnect = () => {
    wagmiDisconnect()
  }

  const openAccount = () => {
    open({ view: 'Account' })
  }

  const openNetworks = () => {
    open({ view: 'Networks' })
  }

  return {
    address: address as `0x${string}` | undefined,
    isConnected,
    isConnecting: status === 'connecting',
    chainId,
    connect,
    disconnect,
    openAccount,
    openNetworks,
  }
}
