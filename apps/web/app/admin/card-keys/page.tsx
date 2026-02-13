"use client"

import { useState, useEffect } from "react"
import {
  Upload,
  Eye,
  Ban,
  Package,
  KeyRound,
  AlertCircle,
  X,
  FileText,
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useLocale } from "@/lib/context"
import { toast } from "sonner"
import { adminCardKeyApi, adminProductApi, withMockFallback } from "@/services/api"
import {
  mockCardKeyStockList,
  mockImportBatchList,
  mockProducts,
} from "@/lib/mock-data"
import type { CardKeyStockSummary, CardImportBatch, ProductCard } from "@/types"

export default function AdminCardKeysPage() {
  const { t } = useLocale()
  const [tab, setTab] = useState<"stock" | "import">("stock")
  const [showImportModal, setShowImportModal] = useState(false)
  const [stockList, setStockList] = useState<CardKeyStockSummary[]>([])
  const [importBatches, setImportBatches] = useState<CardImportBatch[]>([])
  const [importTotal, setImportTotal] = useState(0)
  const [importPage, setImportPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<ProductCard[]>([])
  const [filterProductId, setFilterProductId] = useState("")

  // Import form state
  const [importProductId, setImportProductId] = useState("")
  const [importSpecId, setImportSpecId] = useState("")
  const [importContent, setImportContent] = useState("")
  const [importing, setImporting] = useState(false)

  const fetchStock = async () => {
    try {
      const data = await withMockFallback(
        () => adminCardKeyApi.getStock(filterProductId ? { product_id: filterProductId } : undefined),
        () => mockCardKeyStockList(filterProductId ? { product_id: filterProductId } : undefined)
      )
      setStockList(data)
    } catch {
      setStockList([])
    }
  }

  const fetchImportBatches = async () => {
    try {
      const data = await withMockFallback(
        () => adminCardKeyApi.getImportBatches({ page: importPage, page_size: 20 }),
        () => mockImportBatchList({ page: importPage, page_size: 20 })
      )
      setImportBatches(data.list)
      setImportTotal(data.pagination.total)
    } catch {
      setImportBatches([])
    }
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      try {
        const prods = await withMockFallback(
          () => adminProductApi.getList({ page: 1, page_size: 100 }),
          () => ({ list: mockProducts, pagination: { page: 1, page_size: 100, total: mockProducts.length } })
        )
        setProducts(prods.list)
      } catch {
        setProducts([])
      }
      await Promise.all([fetchStock(), fetchImportBatches()])
      setLoading(false)
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { fetchStock() }, [filterProductId])
  useEffect(() => { fetchImportBatches() }, [importPage])

  // Computed stats from stockList
  const totalKeys = stockList.reduce((s, r) => s + r.total, 0)
  const totalAvailable = stockList.reduce((s, r) => s + r.available, 0)
  const totalSold = stockList.reduce((s, r) => s + r.sold, 0)
  const totalInvalid = stockList.reduce((s, r) => s + r.invalid, 0)

  const handleImport = async () => {
    if (!importProductId) {
      toast.error("请选择商品")
      return
    }
    if (!importContent.trim()) {
      toast.error("请输入卡密内容")
      return
    }
    setImporting(true)
    try {
      const result = await withMockFallback(
        () => adminCardKeyApi.import({
          product_id: importProductId,
          spec_id: importSpecId || null,
          content: importContent,
        }),
        () => ({
          id: "mock-batch-" + Date.now(),
          product_id: importProductId,
          spec_id: importSpecId || null,
          imported_by: "admin",
          total_count: importContent.trim().split("\n").length,
          success_count: importContent.trim().split("\n").length,
          fail_count: 0,
          fail_detail: null,
          created_at: new Date().toISOString(),
        })
      )
      toast.success(`导入成功：${result.success_count} 条${result.fail_count > 0 ? `，失败 ${result.fail_count} 条` : ""}`)
      setShowImportModal(false)
      setImportContent("")
      setImportProductId("")
      setImportSpecId("")
      await Promise.all([fetchStock(), fetchImportBatches()])
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "导入失败")
    } finally {
      setImporting(false)
    }
  }

  const handleInvalidate = async (id: string) => {
    try {
      await withMockFallback(
        () => adminCardKeyApi.invalidate(id),
        () => null
      )
      toast.success("作废成功")
      await fetchStock()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "作废失败")
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("admin.cardKeys")}</h1>
          <p className="text-sm text-muted-foreground">{t("admin.cardKeysDesc")}</p>
        </div>
        <div className="flex items-center justify-center py-24">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("admin.cardKeys")}</h1>
          <p className="text-sm text-muted-foreground">{t("admin.cardKeysDesc")}</p>
        </div>
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
          onClick={() => setShowImportModal(true)}
        >
          <Upload className="h-4 w-4" />
          {t("admin.batchImport")}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: t("admin.totalKeys"), value: String(totalKeys), icon: KeyRound, color: "text-blue-500" },
          { label: t("admin.availableStock"), value: String(totalAvailable), icon: Package, color: "text-emerald-500" },
          { label: t("admin.soldOut"), value: String(totalSold), icon: FileText, color: "text-muted-foreground" },
          { label: t("admin.invalidKeys"), value: String(totalInvalid), icon: AlertCircle, color: "text-red-500" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <stat.icon className={cn("h-4 w-4", stat.color)} />
              <span className="text-sm text-muted-foreground">{stat.label}</span>
            </div>
            <p className="mt-1 text-2xl font-bold text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {[
          { key: "stock" as const, label: t("admin.stockOverview") },
          { key: "import" as const, label: t("admin.importRecords") },
        ].map((tabItem) => (
          <button
            key={tabItem.key}
            type="button"
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              tab === tabItem.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setTab(tabItem.key)}
          >
            {tabItem.label}
          </button>
        ))}
      </div>

      {/* Stock Overview Tab */}
      {tab === "stock" && (
        <>
          {/* Product filter */}
          <div className="relative w-fit">
            <select
              className="h-10 appearance-none rounded-lg border border-input bg-background pl-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              value={filterProductId}
              onChange={(e) => setFilterProductId(e.target.value)}
            >
              <option value="">{t("admin.allProducts")}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.productName2")}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.specLabel")}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.totalKeys")}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.soldKeys")}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.availableKeys")}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.invalidKeys")}</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t("admin.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {stockList.map((item, idx) => (
                    <tr key={`${item.product_id}-${item.spec_id}-${idx}`} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{item.product_title}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.spec_name || "-"}</td>
                      <td className="px-4 py-3 text-foreground">{item.total}</td>
                      <td className="px-4 py-3 text-foreground">{item.sold}</td>
                      <td className="px-4 py-3">
                        <span className={cn("font-medium", item.available <= 5 ? "text-amber-500" : "text-foreground")}>
                          {item.available}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(item.invalid > 0 ? "text-red-500" : "text-foreground")}>
                          {item.invalid}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" title={t("admin.viewDetail")}>
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                            title={t("admin.batchInvalidate")}
                            onClick={() => handleInvalidate(item.product_id)}
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {stockList.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">{t("admin.noStockData")}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Import Records Tab */}
      {tab === "import" && (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.batchId")}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.importCount")}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.successCount")}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.failCount")}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.time")}</th>
                </tr>
              </thead>
              <tbody>
                {importBatches.map((batch) => (
                  <tr key={batch.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-foreground">
                      {batch.id.length > 16 ? `${batch.id.slice(0, 8)}...` : batch.id}
                    </td>
                    <td className="px-4 py-3 text-foreground">{batch.total_count}</td>
                    <td className="px-4 py-3 text-emerald-600">{batch.success_count}</td>
                    <td className="px-4 py-3">
                      <span className={cn(batch.fail_count > 0 ? "text-red-500" : "text-foreground")}>
                        {batch.fail_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(batch.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {importBatches.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">{t("admin.noImportData")}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <span className="text-sm text-muted-foreground">{t("admin.totalRecords")} {importTotal} {t("admin.records")}</span>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowImportModal(false)}>
          <div className="w-full max-w-lg rounded-xl bg-card border border-border shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-border px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">{t("admin.batchImportKeys")}</h2>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-col gap-4 p-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">{t("admin.selectProductReq")}</label>
                <select
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  value={importProductId}
                  onChange={(e) => { setImportProductId(e.target.value); setImportSpecId("") }}
                >
                  <option value="">{t("admin.selectProductPlaceholder")}</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">{t("admin.specOptional")}</label>
                <input
                  type="text"
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder={t("admin.specIdPlaceholder")}
                  value={importSpecId}
                  onChange={(e) => setImportSpecId(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">{t("admin.cardKeyContentReq")}</label>
                <textarea
                  className="min-h-32 rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder={t("admin.cardKeyContentPlaceholder")}
                  value={importContent}
                  onChange={(e) => setImportContent(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t("admin.cardKeyContentHint")} {importContent.trim() ? importContent.trim().split("\n").length : 0} {t("admin.cardKeyContentUnit")}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
              <button
                type="button"
                className="rounded-lg border border-input bg-transparent px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
                onClick={() => setShowImportModal(false)}
              >
                {t("admin.cancel")}
              </button>
              <button
                type="button"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                onClick={handleImport}
                disabled={importing}
              >
                {importing ? t("admin.importing") : t("admin.import")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
