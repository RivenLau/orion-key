"use client"

import { useState, useEffect, useCallback, useRef, type RefObject } from "react"
import { Plus, Search, Edit, Trash2, Upload, X, AlertCircle, ChevronDown, EyeOff, Eye, KeyRound, Loader2, ImagePlus } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { cn, getCurrencySymbol } from "@/lib/utils"
import { Modal } from "@/components/ui/modal"
import { useLocale } from "@/lib/context"
import { adminProductApi, adminCategoryApi, adminCardKeyApi, currencyApi, withMockFallback } from "@/services/api"
import { mockCategories } from "@/lib/mock-data"
import type { ProductDetail, Category, ProductSpec, CurrencyItem } from "@/types"

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp", "image/svg+xml"]
const ALLOWED_IMAGE_ACCEPT = ".jpg,.jpeg,.png,.gif,.webp,.bmp,.svg"

function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "不支持的图片格式，仅支持 JPG/PNG/GIF/WebP/BMP/SVG"
  }
  if (file.size > 10 * 1024 * 1024) {
    return "图片大小不能超过 10MB"
  }
  return null
}

export default function AdminProductsPage() {
  const { t } = useLocale()
  const [products, setProducts] = useState<ProductDetail[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [currencies, setCurrencies] = useState<CurrencyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 20

  // Modal states
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductDetail | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [showImportModal, setShowImportModal] = useState<ProductDetail | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [detailUploading, setDetailUploading] = useState(false)
  const [specsEnabled, setSpecsEnabled] = useState(false)
  const detailTextareaRef = useRef<HTMLTextAreaElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const categoryRef = useRef<HTMLSelectElement>(null)
  const basePriceRef = useRef<HTMLInputElement>(null)
  const [formErrors, setFormErrors] = useState<Record<string, boolean>>({})

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    detail_md: "",
    category_id: "",
    base_price: "",
    currency: "CNY",
    cover_url: "",
    low_stock_threshold: "10",
    wholesale_enabled: false,
    is_enabled: true,
    initial_sales: "",
    sort_order: "",
    delivery_type: "AUTO",
  })
  const [formSpecs, setFormSpecs] = useState<{ id?: string; name: string; price: string }[]>([])

  // Import modal state
  const [importSpecId, setImportSpecId] = useState("")
  const [importContent, setImportContent] = useState("")
  const [importing, setImporting] = useState(false)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const data = await withMockFallback(
        () => adminProductApi.getList({
          page,
          page_size: pageSize,
          category_id: categoryFilter || undefined,
          is_enabled: statusFilter ? (statusFilter === "enabled" ? 1 : 0) : undefined,
          keyword: search || undefined,
        }),
        () => {
          // Mock fallback: build PaginatedData<ProductDetail> from mock
          const { mockProducts } = require("@/lib/mock-data")
          const { mockProductDetail } = require("@/lib/mock-data")
          let list = mockProducts.map((p: any) => mockProductDetail(p.id)).filter(Boolean)
          if (categoryFilter) list = list.filter((p: ProductDetail) => p.category_id === categoryFilter)
          if (statusFilter === "enabled") list = list.filter((p: ProductDetail) => p.is_enabled !== false)
          if (statusFilter === "disabled") list = list.filter((p: ProductDetail) => p.is_enabled === false)
          if (search) {
            const kw = search.toLowerCase()
            list = list.filter((p: ProductDetail) => p.title.toLowerCase().includes(kw))
          }
          return { list: list.slice((page - 1) * pageSize, page * pageSize), pagination: { page, page_size: pageSize, total: list.length } }
        }
      )
      setProducts(data.list)
      setTotal(data.pagination.total)
    } catch {
      setProducts([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, categoryFilter, statusFilter, search])

  useEffect(() => {
    async function fetchInitData() {
      try {
        const [cats, curs] = await Promise.all([
          withMockFallback(
            () => adminCategoryApi.getList(),
            () => [...mockCategories]
          ),
          withMockFallback(
            () => currencyApi.getList(),
            () => [
              { code: "CNY", name: "人民币", symbol: "¥" },
              { code: "USD", name: "美元", symbol: "$" },
              { code: "USDT", name: "USDT (TRC-20)", symbol: "₮" },
            ] as CurrencyItem[]
          ),
        ])
        setCategories(cats)
        setCurrencies(curs)
      } catch {
        setCategories([])
        setCurrencies([])
      }
    }
    fetchInitData()
  }, [])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || "-"

  const handleEdit = (product: ProductDetail) => {
    setEditingProduct(product)
    setFormData({
      title: product.title,
      description: product.description || "",
      detail_md: product.detail_md || "",
      category_id: product.category_id,
      base_price: String(product.base_price),
      currency: product.currency || "CNY",
      cover_url: product.cover_url || "",
      low_stock_threshold: String(product.low_stock_threshold ?? 10),
      wholesale_enabled: false,
      is_enabled: product.is_enabled !== false,
      initial_sales: String(product.initial_sales ?? ""),
      sort_order: String(product.sort_order ?? ""),
      delivery_type: product.delivery_type || "AUTO",
    })
    const specs = product.specs.map(s => ({
      id: s.id,
      name: s.name,
      price: String(s.price),
    }))
    setFormSpecs(specs)
    setSpecsEnabled(specs.length > 0)
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await withMockFallback(
        () => adminProductApi.delete(id),
        () => null
      )
      toast.success("删除成功")
      setShowDeleteConfirm(null)
      await fetchProducts()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "删除失败")
    }
  }

  const handleToggleStatus = async (product: ProductDetail) => {
    try {
      await withMockFallback(
        () => adminProductApi.update(product.id, { is_enabled: product.is_enabled === false }),
        () => null
      )
      toast.success(product.is_enabled === false ? "已上架" : "已下架")
      await fetchProducts()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "操作失败")
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

  const handleSave = async () => {
    const errors: Record<string, boolean> = {}
    if (!formData.title.trim()) errors.title = true
    if (!formData.category_id) errors.category_id = true
    if (!specsEnabled && (!formData.base_price || parseFloat(formData.base_price) <= 0)) errors.base_price = true

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      const messages: string[] = []
      if (errors.title) messages.push("商品名称")
      if (errors.category_id) messages.push("商品分类")
      if (errors.base_price) messages.push("基础售价")
      toast.error(`请填写：${messages.join("、")}`)
      focusFirstError(errors, { title: titleRef, category_id: categoryRef, base_price: basePriceRef })
      return
    }
    setFormErrors({})

    if (specsEnabled) {
      for (const spec of formSpecs) {
        if (!spec.name.trim()) { toast.error("规格名称不能为空"); return }
        if (!spec.price || parseFloat(spec.price) <= 0) { toast.error(`规格「${spec.name || "未命名"}」价格无效`); return }
      }
    }
    setSaving(true)
    try {
      // Auto-sync base_price = min(spec prices) when specs enabled
      let basePrice = parseFloat(formData.base_price) || 0
      if (specsEnabled && formSpecs.length > 0) {
        const specPrices = formSpecs.map(s => parseFloat(s.price)).filter(p => p > 0)
        if (specPrices.length > 0) {
          basePrice = Math.min(...specPrices)
        }
      }

      const payload = {
        title: formData.title,
        description: formData.description || undefined,
        detail_md: formData.detail_md || undefined,
        category_id: formData.category_id,
        base_price: basePrice,
        currency: formData.currency,
        cover_url: formData.cover_url || undefined,
        low_stock_threshold: parseInt(formData.low_stock_threshold) || 10,
        wholesale_enabled: false,
        is_enabled: formData.is_enabled,
        initial_sales: parseInt(formData.initial_sales) || 0,
        sort_order: parseInt(formData.sort_order) || undefined,
        delivery_type: formData.delivery_type,
      }

      let productId: string
      if (editingProduct) {
        await withMockFallback(
          () => adminProductApi.update(editingProduct.id, payload),
          () => null
        )
        productId = editingProduct.id
      } else {
        const created = await withMockFallback(
          () => adminProductApi.create(payload),
          () => ({ id: "mock-id" } as ProductDetail)
        )
        productId = created.id
      }

      // Sync specs
      if (productId && productId !== "mock-id") {
        const existingSpecs = editingProduct?.specs || []
        const existingIds = new Set(existingSpecs.map(s => s.id))
        const keepIds = new Set(formSpecs.filter(s => s.id).map(s => s.id!))

        if (specsEnabled) {
          // Delete removed specs
          for (const oldSpec of existingSpecs) {
            if (!keepIds.has(oldSpec.id)) {
              try { await adminProductApi.deleteSpec(productId, oldSpec.id) } catch { /* ignore */ }
            }
          }
          // Update existing + add new specs
          for (const spec of formSpecs) {
            if (spec.id && existingIds.has(spec.id)) {
              const old = existingSpecs.find(s => s.id === spec.id)
              if (old && (old.name !== spec.name || String(old.price) !== spec.price)) {
                try { await adminProductApi.updateSpec(productId, spec.id, { name: spec.name, price: parseFloat(spec.price) }) } catch { /* ignore */ }
              }
            } else {
              try { await adminProductApi.addSpec(productId, { name: spec.name, price: parseFloat(spec.price) }) } catch { /* ignore */ }
            }
          }
        } else {
          // Specs disabled — delete all existing
          for (const oldSpec of existingSpecs) {
            try { await adminProductApi.deleteSpec(productId, oldSpec.id) } catch { /* ignore */ }
          }
        }
      }

      toast.success("保存成功")
      handleCloseModal()
      await fetchProducts()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingProduct(null)
    setFormData({ title: "", description: "", detail_md: "", category_id: "", base_price: "", currency: "CNY", cover_url: "", low_stock_threshold: "10", wholesale_enabled: false, is_enabled: true, initial_sales: "", sort_order: "", delivery_type: "AUTO" })
    setFormSpecs([])
    setSpecsEnabled(false)
    setFormErrors({})
  }

  const handleImport = async () => {
    if (!showImportModal || !importContent.trim()) {
      toast.error("请输入卡密内容")
      return
    }
    setImporting(true)
    try {
      const result = await withMockFallback(
        () => adminCardKeyApi.import({
          product_id: showImportModal.id,
          spec_id: importSpecId || null,
          content: importContent,
        }),
        () => {
          const lines = importContent.trim().split("\n").filter(Boolean)
          return { id: "mock", product_id: showImportModal.id, spec_id: importSpecId || null, imported_by: "admin", total_count: lines.length, success_count: lines.length, fail_count: 0, fail_detail: null, created_at: new Date().toISOString() }
        }
      )
      toast.success(`导入成功: ${result.success_count} 条${result.fail_count > 0 ? `，失败 ${result.fail_count} 条` : ""}`)
      setShowImportModal(null)
      setImportContent("")
      setImportSpecId("")
      await fetchProducts()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "导入失败")
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("admin.products")}</h1>
          <p className="text-sm text-muted-foreground">{t("admin.manageProducts")}</p>
        </div>
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
          onClick={() => setShowModal(true)}
        >
          <Plus className="h-4 w-4" />
          {t("admin.addProduct")}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={t("admin.searchProduct")}
            className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <div className="relative">
          <select
            className="h-10 appearance-none rounded-lg border border-input bg-background pl-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1) }}
          >
            <option value="">{t("admin.allCategoriesFilter")}</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
        <div className="relative">
          <select
            className="h-10 appearance-none rounded-lg border border-input bg-background pl-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          >
            <option value="">{t("admin.allStatus")}</option>
            <option value="enabled">{t("admin.active")}</option>
            <option value="disabled">{t("admin.inactive")}</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.product")}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.category")}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.basePrice")}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.stockLabel")}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.sold")}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("admin.statusLabel")}</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t("admin.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Link href={`/product/${product.id}`} className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted hover:opacity-80 transition-opacity">
                          {product.cover_url ? (
                            <img src={product.cover_url} alt={product.title} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">N/A</div>
                          )}
                        </Link>
                        <div className="flex flex-col">
                          <Link href={`/product/${product.id}`} className="font-medium text-foreground hover:text-primary hover:underline transition-colors">
                            {product.title}
                          </Link>
                          {product.stock_available <= (product.low_stock_threshold ?? 10) && product.stock_available > 0 && (
                            <span className="text-xs text-amber-500 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              {t("admin.lowStock")}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                        {getCategoryName(product.category_id)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{getCurrencySymbol(product.currency)}{product.base_price}</td>
                    <td className="px-4 py-3">
                      <span className={cn("font-medium", product.stock_available === 0 ? "text-red-500" : product.stock_available <= (product.low_stock_threshold ?? 10) ? "text-amber-500" : "text-foreground")}>
                        {product.stock_available}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground">{product.sales_count ?? 0}</td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", product.is_enabled !== false ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground")}>
                        {product.is_enabled !== false ? t("admin.active") : t("admin.inactive")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" title="编辑" onClick={() => handleEdit(product)}>
                          <Edit className="h-4 w-4" />
                        </button>
                        <button type="button" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" title="导入卡密" onClick={() => { setShowImportModal(product); setImportSpecId(product.specs[0]?.id || "") }}>
                          <KeyRound className="h-4 w-4" />
                        </button>
                        <button type="button" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" title={product.is_enabled !== false ? "下架" : "上架"} onClick={() => handleToggleStatus(product)}>
                          {product.is_enabled !== false ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        <button type="button" className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors" title="删除" onClick={() => setShowDeleteConfirm(product.id)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">{t("admin.noProductData")}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {total > pageSize && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <span className="text-sm text-muted-foreground">共 {total} 件商品</span>
              <div className="flex items-center gap-2">
                <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground disabled:opacity-50">{t("admin.prevPage")}</button>
                <span className="text-sm text-muted-foreground">{page} / {Math.ceil(total / pageSize)}</span>
                <button type="button" disabled={page >= Math.ceil(total / pageSize)} onClick={() => setPage(p => p + 1)} className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground disabled:opacity-50">{t("admin.nextPage")}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Product Modal */}
      <Modal open={showModal} onClose={handleCloseModal} className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="border-b border-border px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                {editingProduct ? t("admin.editProduct") : t("admin.addProduct")}
              </h2>
              <button type="button" onClick={handleCloseModal} className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-col gap-5 p-6">
              {/* 商品名称 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">{t("admin.productNameReq")}</label>
                <input ref={titleRef} type="text" className={cn("h-10 rounded-lg border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2", formErrors.title ? "border-destructive ring-destructive/20" : "border-input focus:ring-ring")} placeholder="请输入商品名称" value={formData.title} onChange={(e) => { setFormData({ ...formData, title: e.target.value }); setFormErrors(prev => ({ ...prev, title: false })) }} />
              </div>
              {/* 商品简介 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">{t("admin.productBrief")}</label>
                <input type="text" className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="简短描述商品特点" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
              </div>
              {/* 分类 + 货币类型 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">{t("admin.categoryReq")}</label>
                  <select ref={categoryRef} className={cn("h-10 rounded-lg border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2", formErrors.category_id ? "border-destructive ring-destructive/20" : "border-input focus:ring-ring")} value={formData.category_id} onChange={(e) => { setFormData({ ...formData, category_id: e.target.value }); setFormErrors(prev => ({ ...prev, category_id: false })) }}>
                    <option value="">请选择分类</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">货币类型</label>
                  <select
                    className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  >
                    {currencies.map(c => (
                      <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                    ))}
                    {currencies.length === 0 && <option value="CNY">CNY - 人民币</option>}
                  </select>
                </div>
              </div>
              {/* 基础售价 + 封面图片 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">{t("admin.basePriceReq")}</label>
                  <input ref={basePriceRef} type="number" step="0.01" className={cn("h-10 rounded-lg border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2", formErrors.base_price ? "border-destructive ring-destructive/20" : "border-input focus:ring-ring")} placeholder="0.00" value={formData.base_price} onChange={(e) => { setFormData({ ...formData, base_price: e.target.value }); setFormErrors(prev => ({ ...prev, base_price: false })) }} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">{t("admin.coverUrl")}</label>
                  <div className="flex gap-2">
                    <input type="text" className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="https://..." value={formData.cover_url} onChange={(e) => setFormData({ ...formData, cover_url: e.target.value })} />
                    <label className={cn("flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-input bg-background px-3 text-sm font-medium text-foreground hover:bg-accent transition-colors", uploading && "pointer-events-none opacity-50")}>
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      上传
                      <input
                        type="file"
                        accept={ALLOWED_IMAGE_ACCEPT}
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          const err = validateImageFile(file)
                          if (err) { toast.error(err); e.target.value = ""; return }
                          setUploading(true)
                          try {
                            const result = await adminProductApi.uploadImage(file)
                            setFormData(prev => ({ ...prev, cover_url: result.url }))
                            toast.success("上传成功")
                          } catch (err: unknown) {
                            toast.error(err instanceof Error ? err.message : "上传失败")
                          } finally {
                            setUploading(false)
                            e.target.value = ""
                          }
                        }}
                      />
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground">建议 1:1 正方形图片，支持 JPG/PNG/GIF/WebP，用于商品卡和详情页展示</p>
                </div>
              </div>
              {/* 排序权重 + 低库存预警 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">排序权重</label>
                  <input type="number" className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="0" value={formData.sort_order} onChange={(e) => setFormData({ ...formData, sort_order: e.target.value })} />
                  <p className="text-xs text-muted-foreground">数字越小越靠前，默认为 0</p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">{t("admin.lowStockAlert")}</label>
                  <input type="number" className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="10" value={formData.low_stock_threshold} onChange={(e) => setFormData({ ...formData, low_stock_threshold: e.target.value })} />
                </div>
              </div>
              {/* 上架状态 + 初始销量 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">{t("admin.listingStatus")}</label>
                  <div className="flex h-10 items-center gap-2">
                    <button type="button" className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", formData.is_enabled ? "bg-primary" : "bg-muted")} onClick={() => setFormData({ ...formData, is_enabled: !formData.is_enabled })}>
                      <span className={cn("absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", formData.is_enabled && "translate-x-5")} />
                    </button>
                    <span className="text-sm text-muted-foreground">{formData.is_enabled ? "已上架" : "已下架"}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">初始销量</label>
                  <input type="number" className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="0" value={formData.initial_sales} onChange={(e) => setFormData({ ...formData, initial_sales: e.target.value })} />
                  <p className="text-xs text-muted-foreground">前台显示销量 = 真实销量 + 初始销量</p>
                </div>
              </div>
              {/* 发货方式 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">发货方式</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      formData.delivery_type === "AUTO"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-input text-foreground hover:border-primary/30"
                    )}
                    onClick={() => setFormData({ ...formData, delivery_type: "AUTO" })}
                  >
                    自动发货
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      formData.delivery_type === "MANUAL"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-input text-foreground hover:border-primary/30"
                    )}
                    onClick={() => setFormData({ ...formData, delivery_type: "MANUAL" })}
                  >
                    手动发货
                  </button>
                </div>
              </div>
              {/* 商品规格 */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground">商品规格</label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">启用多规格</span>
                    <button type="button" className={cn("relative h-6 w-11 rounded-full transition-colors", specsEnabled ? "bg-primary" : "bg-muted")} onClick={() => {
                      if (specsEnabled) { setSpecsEnabled(false) } else { setSpecsEnabled(true); if (formSpecs.length === 0) setFormSpecs([{ name: "", price: "" }]) }
                    }}>
                      <span className={cn("absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", specsEnabled && "translate-x-5")} />
                    </button>
                  </div>
                </div>
                {specsEnabled && (
                  <div className="rounded-lg border border-border bg-muted/20 p-3 flex flex-col gap-2">
                    {formSpecs.map((spec, idx) => (
                      <div key={spec.id || idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          className="h-9 flex-1 rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          placeholder="规格名称（如：1个月、6个月）"
                          value={spec.name}
                          onChange={(e) => {
                            const next = [...formSpecs]
                            next[idx] = { ...next[idx], name: e.target.value }
                            setFormSpecs(next)
                          }}
                        />
                        <input
                          type="number"
                          step="0.01"
                          className="h-9 w-32 rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          placeholder="价格"
                          value={spec.price}
                          onChange={(e) => {
                            const next = [...formSpecs]
                            next[idx] = { ...next[idx], price: e.target.value }
                            setFormSpecs(next)
                          }}
                        />
                        <button
                          type="button"
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                          onClick={() => setFormSpecs(prev => prev.filter((_, i) => i !== idx))}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="flex h-9 w-full items-center justify-center gap-1 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                      onClick={() => setFormSpecs(prev => [...prev, { name: "", price: "" }])}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      添加规格
                    </button>
                  </div>
                )}
              </div>
              {/* 详细说明（放在最底部） */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground">{t("admin.detailMd")}</label>
                  <label className={cn("flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors", detailUploading && "pointer-events-none opacity-50")}>
                    {detailUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                    插入图片
                    <input
                      type="file"
                      accept={ALLOWED_IMAGE_ACCEPT}
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        const err = validateImageFile(file)
                        if (err) { toast.error(err); e.target.value = ""; return }
                        setDetailUploading(true)
                        try {
                          const result = await adminProductApi.uploadImage(file)
                          const textarea = detailTextareaRef.current
                          const mdImage = `![${file.name}](${result.url})`
                          if (textarea) {
                            const start = textarea.selectionStart
                            const end = textarea.selectionEnd
                            const text = formData.detail_md
                            const before = text.substring(0, start)
                            const after = text.substring(end)
                            const newText = before + (before.length > 0 && !before.endsWith("\n") ? "\n" : "") + mdImage + "\n" + after
                            setFormData(prev => ({ ...prev, detail_md: newText }))
                            requestAnimationFrame(() => {
                              const newPos = before.length + (before.length > 0 && !before.endsWith("\n") ? 1 : 0) + mdImage.length + 1
                              textarea.selectionStart = textarea.selectionEnd = newPos
                              textarea.focus()
                            })
                          } else {
                            setFormData(prev => ({ ...prev, detail_md: prev.detail_md + (prev.detail_md ? "\n" : "") + mdImage + "\n" }))
                          }
                          toast.success("图片已插入")
                        } catch (err: unknown) {
                          toast.error(err instanceof Error ? err.message : "上传失败")
                        } finally {
                          setDetailUploading(false)
                          e.target.value = ""
                        }
                      }}
                    />
                  </label>
                </div>
                <textarea
                  ref={detailTextareaRef}
                  className="min-h-32 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder={"支持 Markdown 格式编辑\n# 标题  ## 二级标题  ### 三级标题\n**粗体**  *斜体*  空一行为段落换行\n![图片描述](图片URL) — 可点击上方「插入图片」自动生成"}
                  value={formData.detail_md}
                  onChange={(e) => setFormData({ ...formData, detail_md: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
              <button type="button" className="rounded-lg border border-input bg-transparent px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors" onClick={handleCloseModal}>{t("admin.cancel")}</button>
              <button type="button" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50" onClick={handleSave} disabled={saving}>{saving ? t("admin.saving") : t("admin.save")}</button>
            </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal open={showDeleteConfirm !== null} onClose={() => setShowDeleteConfirm(null)} className="max-w-md">
            <div className="flex flex-col gap-4 p-6">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-destructive/10 p-2"><AlertCircle className="h-5 w-5 text-destructive" /></div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-foreground">{t("admin.deleteConfirm")}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{t("admin.deleteProductMsg")}</p>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" className="rounded-lg border border-input bg-transparent px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors" onClick={() => setShowDeleteConfirm(null)}>{t("admin.cancel")}</button>
                <button type="button" className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors" onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}>{t("admin.delete")}</button>
              </div>
            </div>
      </Modal>

      {/* Import Card Keys Modal */}
      <Modal open={showImportModal !== null} onClose={() => setShowImportModal(null)} className="max-w-2xl">
            <div className="border-b border-border px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">{t("admin.importKeys")} — {showImportModal?.title}</h2>
              <button type="button" onClick={() => setShowImportModal(null)} className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-col gap-5 p-6">
              {showImportModal && showImportModal.specs.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">{t("admin.selectSpec")}</label>
                  <select className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" value={importSpecId} onChange={(e) => setImportSpecId(e.target.value)}>
                    {showImportModal.specs.map((spec) => (
                      <option key={spec.id} value={spec.id}>{spec.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">{t("admin.importContent")}</label>
                <textarea className="min-h-48 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-ring" placeholder={"请输入卡密，每行一个\n例如：\nXXXX-YYYY-ZZZZ-AAAA\nBBBB-CCCC-DDDD-EEEE"} value={importContent} onChange={(e) => setImportContent(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground">提示：支持批量导入，每行一个卡密。导入后会自动增加对应的库存数量。</p>
            </div>
            <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
              <button type="button" className="rounded-lg border border-input bg-transparent px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors" onClick={() => setShowImportModal(null)}>{t("admin.cancel")}</button>
              <button type="button" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50" onClick={handleImport} disabled={importing}>{importing ? t("admin.saving") : t("admin.import")}</button>
            </div>
      </Modal>
    </div>
  )
}
