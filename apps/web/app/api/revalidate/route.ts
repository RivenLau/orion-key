import { revalidateTag } from "next/cache"
import { NextRequest, NextResponse } from "next/server"

/**
 * 按需缓存失效 API
 *
 * 管理后台在执行写操作（新增/修改/删除商品、分类、站点配置等）后
 * 调用此接口清除对应的 ISR 缓存，使首页等 SSR 页面立即获取最新数据。
 *
 * POST /api/revalidate
 * Body: { "tags": ["products"] }
 */
export async function POST(request: NextRequest) {
  try {
    const { tags } = await request.json()

    if (!Array.isArray(tags) || tags.length === 0) {
      return NextResponse.json({ error: "tags array is required" }, { status: 400 })
    }

    for (const tag of tags) {
      if (typeof tag === "string") {
        revalidateTag(tag, "default")
      }
    }

    return NextResponse.json({ revalidated: tags })
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
