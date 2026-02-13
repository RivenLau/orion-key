"use client"

import Link from "next/link"
import { useLocale } from "@/lib/context"

export default function NotFound() {
  const { t } = useLocale()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="text-center">
        <p className="text-8xl font-bold text-primary">404</p>
        <h1 className="mt-4 text-2xl font-bold text-foreground">{t("notFound.title")}</h1>
        <p className="mt-2 text-muted-foreground">
          {t("notFound.desc")}
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {t("notFound.goHome")}
        </Link>
      </div>
    </div>
  )
}
