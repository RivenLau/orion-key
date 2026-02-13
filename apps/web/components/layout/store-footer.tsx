"use client"

import { useLocale, useSiteConfig } from "@/lib/context"

export function StoreFooter() {
  const { t } = useLocale()
  const { config } = useSiteConfig()

  return (
    <footer className="border-t border-border bg-muted/40">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-center gap-4 px-4 lg:px-6">
        <p className="text-sm text-muted-foreground">
          {config?.footer_text || t("footer.powered")}
        </p>
        {config?.contact_email && (
          <a href={`mailto:${config.contact_email}`} className="text-xs text-muted-foreground hover:text-foreground">
            {config.contact_email}
          </a>
        )}
      </div>
    </footer>
  )
}
