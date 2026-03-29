"use client"

import { useState, useEffect, useRef, type RefObject } from "react"
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
  ChevronLeft,
  ChevronRight,
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
import { Modal } from "@/components/ui/modal"
import type { CardKeyStockSummary, CardKeyListItem, CardImportBatch, ProductCard, ProductSpec } from "@/types"

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

  // Detail modal state
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [detailItem, setDetailItem] = useState<CardKeyStockSummary | null>(null)
  const [detailKeys, setDetailKeys] = useState<CardKeyListItem[]>([])
  const [detailTotal, setDetailTotal] = useState(0)
  const [detailPage, setDetailPage] = useState(1)
  const [detailLoading, setDetailLoading] = useState(false)

  // Import form state
  const [importProductId, setImportProductId] = useState("")
  const [importSpecId, setImportSpecId] = useState("")
  const [importContent, setImportContent] = useState("")
  const [importing, setImporting] = useState(false)
  const [importSpecs, setImportSpecs] = useState<ProductSpec[]>([])
  const [loadingSpecs, setLoadingSpecs] = useState(false)
  const [importErrors, setImportErrors] = useState<Record<string, boolean>>({})
  const importProductRef = useRef<HTMLSelectElement>(null)
  const importContentRef = useRef<HTMLTextAreaElement>(null)

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

  const handleProductChange = async (productId: string) => {
    setImportProductId(productId)
    setImportSpecId("")
    setImportSpecs([])
    if (!productId) return
    setLoadingSpecs(true)
    try {
      const specs = await withMockFallback(
        () => adminProductApi.getSpecs(productId),
        () => []
      )
      setImportSpecs(specs)
    } catch {
      setImportSpecs([])
    } finally {
      setLoadingSpecs(false)
    }
  }

  const focusFirstError = (errors: Record<string, boolean>, refMap: Record<string, RefObject<HTMLElement | null>>) => {
    for (const key of Object.keys(errors)) {
      if (errors[key] && refMap[key]?.current) {
        refMap[key].current!.focus()
        refMap[key].current!.scrollIntoView({ behavior: "smooth", block: "center" })
        break
      }
    }
  }

  const handleImport = async () => {
    const errors: Record<string, boolean> = {}
    if (!importProductId) errors.product = true
    if (!importContent.trim()) errors.content = true
    if (Object.keys(errors).length > 0) {
      setImportErrors(errors)
      const messages: string[] = []
      if (errors.product) messages.push("商品")
      if (errors.content) messages.push("卡密内容")
      toast.error(`请填写：${messages.join("、")}`)
      focusFirstError(errors, { product: importProductRef, content: importContentRef })
      return
    }
    setImportErrors({})
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
      setImportErrors({})
      await Promise.all([fetchStock(), fetchImportBatches()])
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "导入失败")
    } finally {
      setImporting(false)
    }
  }

  const fetchDetailKeys = async (item: CardKeyStockSummary, page: number) => {
    setDetailLoading(true)
    try {
      const data = await withMockFallback(
        () => adminCardKeyApi.getList({
          product_id: item.product_id,
          spec_id: item.spec_id,
          page,
          page_size: 20,
        }),
        () => ({ list: [], pagination: { page, page_size: 20, total: 0 } })
      )
      setDetailKeys(data.list)
      setDetailTotal(data.pagination.total)
    } catch {
      setDetailKeys([])
      setDetailTotal(0)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleViewDetail = (item: CardKeyStockSummary) => {
    setDetailItem(item)
    setDetailPage(1)
    setShowDetailModal(true)
    fetchDetailKeys(item, 1)
  }

  const handleDetailPageChange = (page: number) => {
    setDetailPage(page)
    if (detailItem) fetchDetailKeys(detailItem, page)
  }

  // Batch invalidate confirmation state
  const [showInvalidateConfirm, setShowInvalidateConfirm] = useState<CardKeyStockSummary | null>(null)
  const [invalidating, setInvalidating] = useState(false)

  // Single invalidate confirmation state
  const [singleInvalidateTarget, setSingleInvalidateTarget] = useState<CardKeyListItem | null>(null)
  const [singleInvalidating, setSingleInvalidating] = useState(false)

  const handleBatchInvalidate = async () => {
    if (!showInvalidateConfirm) return
    setInvalidating(true)
    try {
      const result = await withMockFallback(
        () => adminCardKeyApi.batchInvalidate({
          product_id: showInvalidateConfirm.product_id,
          spec_id: showInvalidateConfirm.spec_id,
        }),
        () => ({ invalidated_count: showInvalidateConfirm.available })
      )
      toast.success(`已作废 ${result.invalidated_count} 条可用卡密`)
      setShowInvalidateConfirm(null)
      await fetchStock()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "作废失败")
    } finally {
      setInvalidating(false)
    }
  }

  const handleSingleInvalidate = async () => {
    if (!singleInvalidateTarget) return
    setSingleInvalidating(true)
    try {
      await withMockFallback(
        () => adminCardKeyApi.invalidate(singleInvalidateTarget.id),
        () => null
      )
      toast.success("卡密已作废")
      setSingleInvalidateTarget(null)
      if (detailItem) fetchDetailKeys(detailItem, detailPage)
      await fetchStock()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "作废失败")
    } finally {
      setSingleInvalidating(false)
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
                      <td className="px-4 py-3 text-muted-foreground">
                        {item.spec_name
                          ? <>{item.spec_name}{item.spec_enabled === false && <span className="ml-1 text-xs text-amber-500">(已停用)</span>}</>
                          : "-"
                        }
                      </td>
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
                          <button
                            type="button"
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                            title={t("admin.viewDetail")}
                            onClick={() => handleViewDetail(item)}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                            title={t("admin.batchInvalidate")}
                            onClick={() => setShowInvalidateConfirm(item)}
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
      <Modal open={showImportModal} onClose={() => { setShowImportModal(false); setImportErrors({}) }} className="max-w-lg">
            <div className="border-b border-border px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">{t("admin.batchImportKeys")}</h2>
              <button
                type="button"
                onClick={() => { setShowImportModal(false); setImportErrors({}) }}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-col gap-4 p-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">{t("admin.selectProductReq")}</label>
                <select
                  ref={importProductRef}
                  className={cn("h-10 rounded-lg border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2", importErrors.product ? "border-destructive ring-destructive/20" : "border-input focus:ring-ring")}
                  value={importProductId}
                  onChange={(e) => { handleProductChange(e.target.value); setImportErrors(prev => ({ ...prev, product: false })) }}
                >
                  <option value="">{t("admin.selectProductPlaceholder")}</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>
              {importProductId && (loadingSpecs ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  加载规格...
                </div>
              ) : importSpecs.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">{t("admin.selectSpec")}</label>
                  <select
                    className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={importSpecId}
                    onChange={(e) => setImportSpecId(e.target.value)}
                  >
                    <option value="">默认规格</option>
                    {importSpecs.map((spec) => (
                      <option key={spec.id} value={spec.id}>{spec.name} — {spec.stock_available} 件库存</option>
                    ))}
                  </select>
                </div>
              ) : null)}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">{t("admin.cardKeyContentReq")}</label>
                <textarea
                  ref={importContentRef}
                  className={cn("min-h-32 rounded-lg border bg-background px-3 py-2 text-sm font-mono text-foreground break-all focus:outline-none focus:ring-2", importErrors.content ? "border-destructive ring-destructive/20" : "border-input focus:ring-ring")}
                  placeholder={t("admin.cardKeyContentPlaceholder")}
                  value={importContent}
                  onChange={(e) => { setImportContent(e.target.value); setImportErrors(prev => ({ ...prev, content: false })) }}
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
      </Modal>

      {/* Detail Modal */}
      <Modal open={showDetailModal} onClose={() => setShowDetailModal(false)} className="max-w-[90vw] w-[1100px]">
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">卡密详情</h2>
            {detailItem && (
              <p className="text-sm text-muted-foreground">
                {detailItem.product_title}
                {detailItem.spec_name ? <>{` — ${detailItem.spec_name}`}{detailItem.spec_enabled === false && <span className="ml-1 text-amber-500">(已停用)</span>}</> : ""}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowDetailModal(false)}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">
          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : detailKeys.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">暂无卡密数据</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-fixed">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="w-[36%] px-3 py-2 text-left font-medium text-muted-foreground">卡密内容</th>
                    <th className="w-[8%] px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">状态</th>
                    <th className="w-[16%] px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">创建时间</th>
                    <th className="w-[16%] px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">订单号</th>
                    <th className="w-[16%] px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">售出时间</th>
                    <th className="w-[8%] px-3 py-2 text-right font-medium text-muted-foreground whitespace-nowrap">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {detailKeys.map((key) => (
                    <tr key={key.id} className="border-b border-border/50 last:border-0">
                      <td className="px-3 py-2 font-mono text-xs text-foreground break-all">{key.content}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          key.status === "AVAILABLE" && "bg-emerald-500/10 text-emerald-600",
                          key.status === "SOLD" && "bg-blue-500/10 text-blue-600",
                          key.status === "LOCKED" && "bg-amber-500/10 text-amber-600",
                          key.status === "INVALID" && "bg-red-500/10 text-red-600",
                        )}>
                          {key.status === "AVAILABLE" ? "可用" : key.status === "SOLD" ? "已售" : key.status === "LOCKED" ? "锁定" : "已作废"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(key.created_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {key.order_id ? key.order_id.slice(0, 8) + "..." : "-"}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                        {key.sold_at ? new Date(key.sold_at).toLocaleString() : "-"}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {(key.status === "AVAILABLE" || key.status === "LOCKED") && (
                          <button
                            type="button"
                            className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                            title="作废此卡密"
                            onClick={() => setSingleInvalidateTarget(key)}
                          >
                            <Ban className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {detailTotal > 20 && (
          <div className="flex items-center justify-between border-t border-border px-6 py-3">
            <span className="text-sm text-muted-foreground">共 {detailTotal} 条</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-50"
                disabled={detailPage <= 1}
                onClick={() => handleDetailPageChange(detailPage - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 text-sm text-foreground">{detailPage} / {Math.ceil(detailTotal / 20)}</span>
              <button
                type="button"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-50"
                disabled={detailPage >= Math.ceil(detailTotal / 20)}
                onClick={() => handleDetailPageChange(detailPage + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Single Invalidate Confirmation */}
      <Modal open={singleInvalidateTarget !== null} onClose={() => setSingleInvalidateTarget(null)} className="max-w-md">
        <div className="flex flex-col gap-4 p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-destructive/10 p-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-foreground">确认作废卡密</h3>
              {singleInvalidateTarget && (
                <p className="mt-1 text-sm text-muted-foreground">
                  确定要作废以下卡密吗？此操作不可撤销。
                  <br />
                  <code className="mt-1 inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground break-all">
                    {singleInvalidateTarget.content}
                  </code>
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="rounded-lg border border-input bg-transparent px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              onClick={() => setSingleInvalidateTarget(null)}
            >
              取消
            </button>
            <button
              type="button"
              className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
              onClick={handleSingleInvalidate}
              disabled={singleInvalidating}
            >
              {singleInvalidating ? "作废中..." : "确认作废"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Batch Invalidate Confirmation */}
      <Modal open={showInvalidateConfirm !== null} onClose={() => setShowInvalidateConfirm(null)} className="max-w-md">
        <div className="flex flex-col gap-4 p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-destructive/10 p-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-foreground">确认批量作废</h3>
              {showInvalidateConfirm && (
                <p className="mt-1 text-sm text-muted-foreground">
                  确定要将「{showInvalidateConfirm.product_title}
                  {showInvalidateConfirm.spec_name ? ` — ${showInvalidateConfirm.spec_name}` : ""}」
                  的 <span className="font-medium text-foreground">{showInvalidateConfirm.available}</span> 条可用卡密全部作废吗？此操作不可撤销。
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="rounded-lg border border-input bg-transparent px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              onClick={() => setShowInvalidateConfirm(null)}
            >
              取消
            </button>
            <button
              type="button"
              className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
              onClick={handleBatchInvalidate}
              disabled={invalidating}
            >
              {invalidating ? "作废中..." : "确认作废"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
