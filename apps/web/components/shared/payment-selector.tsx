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
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
      {channels.map((ch) => (
        <button
          key={ch.channel_code}
          onClick={() => onSelect(ch.channel_code)}
          className={cn(
            "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all",
            selected === ch.channel_code
              ? "border-primary bg-primary/5 text-primary"
              : "border-border text-foreground hover:border-primary/50 hover:bg-accent"
          )}
        >
          <PaymentIcon method={ch.channel_code} className="h-5 w-5 shrink-0" />
          <span className="truncate">{ch.channel_name}</span>
        </button>
      ))}
    </div>
  )
}
