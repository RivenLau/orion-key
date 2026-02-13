"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Search, Edit, Trash2, Upload, X, AlertCircle, ChevronDown, EyeOff, Eye, KeyRound } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useLocale } from "@/lib/context"
import { adminProductApi, adminCategoryApi, adminCardKeyApi, withMockFallback } from "@/services/api"
import { mockCategories } from "@/lib/mock-data"
import type { ProductDetail, Category, ProductSpec } from "@/types"

export default function AdminProductsPage() {
  const { t } = useLocale()
  const [products, setProducts] = useState<ProductDetail[]>([])
  const [categories, setCategories] = useState<Category[]>([])
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

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    detail_md: "",
    category_id: "",
    base_price: "",
    cover_url: "",
    low_stock_threshold: "10",
    wholesale_enabled: false,
    is_enabled: true,
    sort_order: "",
  })
  const [formSpecs, setFormSpecs] = useState<{ id?: string; name: string; price: string; stock_available: string }[]>([])

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
    async function fetchCategories() {
      try {
        const cats = await withMockFallback(
          () => adminCategoryApi.getList(),
          () => [...mockCategories]
        )
        setCategories(cats)
      } catch {
        setCategories([])
      }
    }
    fetchCategories()
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
      cover_url: product.cover_url || "",
      low_stock_threshold: String(product.low_stock_threshold ?? 10),
      wholesale_enabled: product.wholesale_enabled,
      is_enabled: product.is_enabled !== false,
      sort_order: String(product.sort_order ?? ""),
    })
    setFormSpecs(product.specs.map(s => ({
      id: s.id,
      name: s.name,
      price: String(s.price),
      stock_available: String(s.stock_available),
    })))
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

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error("请输入商品名称")
      return
    }
    setSaving(true)
    try {
      const payload = {
        title: formData.title,
        description: formData.description || undefined,
        detail_md: formData.detail_md || undefined,
        category_id: formData.category_id,
        base_price: parseFloat(formData.base_price) || 0,
        cover_url: formData.cover_url || undefined,
        low_stock_threshold: parseInt(formData.low_stock_threshold) || 10,
        wholesale_enabled: formData.wholesale_enabled,
        is_enabled: formData.is_enabled,
        sort_order: parseInt(formData.sort_order) || undefined,
      }

      if (editingProduct) {
        await withMockFallback(
          () => adminProductApi.update(editingProduct.id, payload),
          () => null
        )
      } else {
        await withMockFallback(
          () => adminProductApi.create(payload),
          () => ({} as ProductDetail)
        )
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
    setFormData({ title: "", description: "", detail_md: "", category_id: "", base_price: "", cover_url: "", low_stock_threshold: "10", wholesale_enabled: false, is_enabled: true, sort_order: "" })
    setFormSpecs([])
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
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                          {product.cover_url ? (
                            <img src={product.cover_url} alt={product.title} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">N/A</div>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{product.title}</span>
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
                    <td className="px-4 py-3 font-medium text-foreground">¥{product.base_price}</td>
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
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={handleCloseModal}>
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl bg-card border border-border shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-border px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                {editingProduct ? t("admin.editProduct") : t("admin.addProduct")}
              </h2>
              <button type="button" onClick={handleCloseModal} className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-col gap-5 p-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">{t("admin.productNameReq")}</label>
                <input type="text" className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="请输入商品名称" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">{t("admin.productBrief")}</label>
                <input type="text" className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="简短描述商品特点" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">{t("admin.categoryReq")}</label>
                  <select className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" value={formData.category_id} onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}>
                    <option value="">请选择分类</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">{t("admin.basePriceReq")}</label>
                  <input type="number" step="0.01" className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="0.00" value={formData.base_price} onChange={(e) => setFormData({ ...formData, base_price: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">{t("admin.coverUrl")}</label>
                  <input type="text" className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="https://..." value={formData.cover_url} onChange={(e) => setFormData({ ...formData, cover_url: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">{t("admin.lowStockAlert")}</label>
                  <input type="number" className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="10" value={formData.low_stock_threshold} onChange={(e) => setFormData({ ...formData, low_stock_threshold: e.target.value })} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">{t("admin.detailMd")}</label>
                <textarea className="min-h-24 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" placeholder="使用 Markdown 编写商品详细说明" value={formData.detail_md} onChange={(e) => setFormData({ ...formData, detail_md: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground">{t("admin.enableWholesale")}</label>
                  <button type="button" className={cn("relative h-6 w-11 rounded-full transition-colors", formData.wholesale_enabled ? "bg-primary" : "bg-muted")} onClick={() => setFormData({ ...formData, wholesale_enabled: !formData.wholesale_enabled })}>
                    <span className={cn("absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", formData.wholesale_enabled && "translate-x-5")} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground">{t("admin.listingStatus")}</label>
                  <button type="button" className={cn("relative h-6 w-11 rounded-full transition-colors", formData.is_enabled ? "bg-primary" : "bg-muted")} onClick={() => setFormData({ ...formData, is_enabled: !formData.is_enabled })}>
                    <span className={cn("absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", formData.is_enabled && "translate-x-5")} />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
              <button type="button" className="rounded-lg border border-input bg-transparent px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors" onClick={handleCloseModal}>{t("admin.cancel")}</button>
              <button type="button" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50" onClick={handleSave} disabled={saving}>{saving ? t("admin.saving") : t("admin.save")}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowDeleteConfirm(null)}>
          <div className="w-full max-w-md rounded-xl bg-card border border-border shadow-xl" onClick={(e) => e.stopPropagation()}>
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
                <button type="button" className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors" onClick={() => handleDelete(showDeleteConfirm)}>{t("admin.delete")}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Card Keys Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowImportModal(null)}>
          <div className="w-full max-w-2xl rounded-xl bg-card border border-border shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-border px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">{t("admin.importKeys")} — {showImportModal.title}</h2>
              <button type="button" onClick={() => setShowImportModal(null)} className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-col gap-5 p-6">
              {showImportModal.specs.length > 0 && (
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
          </div>
        </div>
      )}
    </div>
  )
}
