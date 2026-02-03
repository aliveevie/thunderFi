import { useAppKit, useAppKitAccount } from '@reown/appkit/react'
import { Button } from '@/components/ui/Button'
import { Wallet, ChevronDown } from 'lucide-react'
import { formatAddress } from '@/lib/utils'

export function ConnectButton() {
  const { open } = useAppKit()
  const { address, isConnected } = useAppKitAccount()

  if (isConnected && address) {
    return (
      <Button
        variant="secondary"
        onClick={() => open({ view: 'Account' })}
        className="flex items-center gap-2"
      >
        <div className="w-2 h-2 rounded-full bg-green-500" />
        <span>{formatAddress(address)}</span>
        <ChevronDown className="w-4 h-4" />
      </Button>
    )
  }

  return (
    <Button
      variant="primary"
      onClick={() => open({ view: 'Connect' })}
      className="flex items-center gap-2"
    >
      <Wallet className="w-4 h-4" />
      <span>Connect Wallet</span>
    </Button>
  )
}
