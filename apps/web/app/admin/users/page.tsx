"use client"

import { useState, useEffect } from "react"
import { Search, UserCheck, UserX, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLocale } from "@/lib/context"
import { toast } from "sonner"
import { adminUserApi, withMockFallback } from "@/services/api"
import { mockAdminUserList } from "@/lib/mock-data"
import type { AdminUserItem } from "@/types"

const ITEMS_PER_PAGE = 20

export default function AdminUsersPage() {
  const { t } = useLocale()
  const [users, setUsers] = useState<AdminUserItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [currentPage, setCurrentPage] = useState(1)

  const [debouncedSearch, setDebouncedSearch] = useState("")

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const data = await withMockFallback(
        () => adminUserApi.getList({
          page: currentPage,
          page_size: ITEMS_PER_PAGE,
          keyword: debouncedSearch || undefined,
        }),
        () => mockAdminUserList({
          keyword: debouncedSearch || undefined,
          page: currentPage,
          page_size: ITEMS_PER_PAGE,
        })
      )
      setUsers(data.list)
      setTotal(data.pagination.total)
    } catch {
      setUsers([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  // Debounce search input → reset page + commit debounced value
  useEffect(() => {
    if (search === debouncedSearch) return
    const timer = setTimeout(() => {
      setCurrentPage(1)
      setDebouncedSearch(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Single fetch effect for all dependencies
  useEffect(() => { fetchUsers() }, [currentPage, debouncedSearch])

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE)

  const handleToggleStatus = async (user: AdminUserItem) => {
    const newStatus: 0 | 1 = user.is_deleted === 0 ? 1 : 0
    try {
      await withMockFallback(
        () => adminUserApi.toggleStatus(user.id, newStatus),
        () => null
      )
      toast.success(newStatus === 1 ? "已禁用" : "已启用")
      await fetchUsers()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "操作失败")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("admin.users")}</h1>
        <p className="text-sm text-muted-foreground">{t("admin.usersDesc")}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={t("admin.searchUser")}
            className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.usernameLabel")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.emailLabel")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.role")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.pointsLabel")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.statusLabel")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.registeredAt")}</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t("admin.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12">
                    <div className="flex items-center justify-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">{t("admin.noUserData")}</td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{user.username}</td>
                    <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                    <td className="px-4 py-3 text-foreground">{user.role}</td>
                    <td className="px-4 py-3 text-foreground">{user.points}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-medium",
                          user.is_deleted === 0
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-red-500/10 text-red-500"
                        )}
                      >
                        {user.is_deleted === 0 ? t("admin.normal") : t("admin.banned")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          className={cn(
                            "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                            user.is_deleted === 0
                              ? "text-red-500 hover:bg-red-500/10"
                              : "text-emerald-600 hover:bg-emerald-500/10"
                          )}
                          onClick={() => handleToggleStatus(user)}
                        >
                          {user.is_deleted === 0 ? (
                            <>
                              <UserX className="h-3.5 w-3.5" />
                              {t("admin.ban")}
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-3.5 w-3.5" />
                              {t("admin.unban")}
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <span className="text-sm text-muted-foreground">{t("admin.totalRecords")} {total} {t("admin.totalUsers")}</span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-input text-muted-foreground hover:bg-accent disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium",
                    currentPage === page
                      ? "bg-primary text-primary-foreground"
                      : "border border-input text-foreground hover:bg-accent"
                  )}
                >
                  {page}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-input text-muted-foreground hover:bg-accent disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
