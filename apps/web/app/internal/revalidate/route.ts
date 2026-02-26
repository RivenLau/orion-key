import { revalidatePath } from "next/cache"
import { NextRequest, NextResponse } from "next/server"

/**
 * 按需缓存失效 API
 *
 * 管理后台在执行写操作（新增/修改/删除商品、分类、站点配置等）后
 * 调用此接口清除对应的 ISR 缓存，使首页等 SSR 页面立即获取最新数据。
 *
 * POST /internal/revalidate
 * Body: { "paths": ["/", "/product/xxx"] }
 *
 * paths 为空时默认刷新首页
 */
export async function POST(request: NextRequest) {
  try {
    const { paths } = await request.json()

    const targetPaths: string[] =
      Array.isArray(paths) && paths.length > 0
        ? paths.filter((p: unknown) => typeof p === "string")
        : ["/"]

    for (const p of targetPaths) {
      revalidatePath(p)
    }

    return NextResponse.json({ revalidated: targetPaths })
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
