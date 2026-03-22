"use client"

import { cn } from "@/lib/utils"
import { PaymentIcon } from "./payment-icon"
import type { PaymentChannelItem } from "@/types"

interface PaymentSelectorProps {
  channels: PaymentChannelItem[]
  selected: string
  onSelect: (code: string) => void
}

export function PaymentSelector({ channels, selected, onSelect }: PaymentSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {channels.map((ch) => (
        <button
          key={ch.channel_code}
          onClick={() => onSelect(ch.channel_code)}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium whitespace-nowrap transition-all",
            selected === ch.channel_code
              ? "border-primary bg-primary/5 text-primary"
              : "border-border text-foreground hover:border-primary/50 hover:bg-accent"
          )}
        >
          <PaymentIcon method={ch.channel_code} className="h-5 w-5 shrink-0" />
          {ch.channel_name}
        </button>
      ))}
    </div>
  )
}
