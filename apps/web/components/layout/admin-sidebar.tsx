"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Package,
  FolderTree,
  KeyRound,
  ShoppingCart,
  Users,
  CreditCard,
  Settings,
  ScrollText,
  ShieldAlert,
  LogOut,
  ChevronLeft,
  Menu,
  Sun,
  Moon,
  Globe,
  Palette,
} from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { useTheme, useLocale, useAuth, useColorScheme, useSiteConfig, COLOR_SCHEMES } from "@/lib/context"
import type { TranslationKey } from "@/lib/i18n"

const navItems: { labelKey: TranslationKey; href: string; icon: typeof LayoutDashboard }[] = [
  { labelKey: "admin.dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { labelKey: "admin.products", href: "/admin/products", icon: Package },
  { labelKey: "admin.categories", href: "/admin/categories", icon: FolderTree },
  { labelKey: "admin.cardKeys", href: "/admin/card-keys", icon: KeyRound },
  { labelKey: "admin.orders", href: "/admin/orders", icon: ShoppingCart },
  { labelKey: "admin.users", href: "/admin/users", icon: Users },
  { labelKey: "admin.payment", href: "/admin/payment-channels", icon: CreditCard },
  { labelKey: "admin.siteConfig", href: "/admin/site-config", icon: Settings },
  { labelKey: "admin.logs", href: "/admin/operation-logs", icon: ScrollText },
  { labelKey: "admin.risk", href: "/admin/risk", icon: ShieldAlert },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [colorPickerOpen, setColorPickerOpen] = useState(false)

  const { setTheme, resolvedTheme } = useTheme()
  const { locale, setLocale, t } = useLocale()
  const { logout } = useAuth()
  const { colorScheme, setColorScheme } = useColorScheme()
  const { config: siteConfig } = useSiteConfig()

  const toggleTheme = () => setTheme(resolvedTheme === "dark" ? "light" : "dark")
  const toggleLocale = () => setLocale(locale === "zh" ? "en" : "zh")

  const handleLogout = () => {
    logout()
    router.push("/")
  }

  return (
    <>
      {/* Mobile overlay */}
      <div className="md:hidden fixed top-0 left-0 z-40 p-3">
        <button
          type="button"
          className="rounded-lg border border-border bg-background p-2 text-muted-foreground shadow-sm hover:text-foreground"
          onClick={() => setCollapsed(!collapsed)}
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex flex-col border-r border-border bg-card transition-all duration-200",
          collapsed ? "w-16" : "w-60",
          "max-md:translate-x-[-100%] md:translate-x-0",
          !collapsed && "max-md:translate-x-0 max-md:w-60 max-md:shadow-2xl"
        )}
      >
        {/* Logo area */}
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          {!collapsed && (
            <Link href="/" className="flex items-center gap-2" title={t("admin.backToSite")}>
              <Package className="h-6 w-6 text-primary" />
              <span className="font-semibold text-foreground">{siteConfig?.site_name}</span>
            </Link>
          )}
          <button
            type="button"
            className={cn(
              "rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors",
              collapsed && "mx-auto"
            )}
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronLeft
              className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")}
            />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          <ul className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
              const label = t(item.labelKey)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      collapsed && "justify-center px-2"
                    )}
                    title={collapsed ? label : undefined}
                  >
                    <item.icon className="h-4.5 w-4.5 shrink-0" />
                    {!collapsed && <span>{label}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Bottom section */}
        <div className="border-t border-border p-2">
          {!collapsed && (
            <div className="flex items-center gap-1 mb-2 px-1">
              {/* Theme Toggle */}
              <button
                type="button"
                onClick={toggleTheme}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                title={resolvedTheme === "dark" ? t("admin.switchToLight") : t("admin.switchToDark")}
              >
                <Sun className="h-4 w-4 dark:hidden" />
                <Moon className="h-4 w-4 hidden dark:block" />
              </button>

              {/* Language Toggle */}
              <button
                type="button"
                onClick={toggleLocale}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                title={locale === "zh" ? t("admin.switchToEnglish") : t("admin.switchToChinese")}
              >
                <Globe className="h-4 w-4" />
              </button>

              {/* Color Scheme Picker */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setColorPickerOpen(!colorPickerOpen)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  title={t("admin.colorTheme")}
                >
                  <Palette className="h-4 w-4" />
                </button>

                {colorPickerOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setColorPickerOpen(false)}
                    />
                    <div className="absolute bottom-full left-0 mb-2 z-20 rounded-lg border border-border bg-popover p-2 shadow-lg">
                      <div className="flex gap-1.5">
                        {COLOR_SCHEMES.map((scheme) => (
                          <button
                            key={scheme.key}
                            type="button"
                            className={cn(
                              "h-7 w-7 rounded-md border-2 transition-all hover:scale-110",
                              colorScheme === scheme.key
                                ? "border-foreground ring-2 ring-ring ring-offset-2 ring-offset-background"
                                : "border-transparent"
                            )}
                            style={{ backgroundColor: scheme.color }}
                            onClick={() => {
                              setColorScheme(scheme.key)
                              setColorPickerOpen(false)
                            }}
                            title={scheme.label}
                          />
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors",
              collapsed && "justify-center px-2"
            )}
          >
            <LogOut className="h-4.5 w-4.5 shrink-0" />
            {!collapsed && <span>{t("admin.logout")}</span>}
          </button>
        </div>
      </aside>
    </>
  )
}
