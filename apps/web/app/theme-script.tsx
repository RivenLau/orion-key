/**
 * ThemeScript - 零闪屏核心
 * 
 * 在 React hydration 之前同步执行，确保首帧渲染就是正确的视觉状态
 * 
 * 职责：
 * 1. 从 localStorage 读取用户偏好
 * 2. 立即设置 DOM 属性（dark class、data-color、lang）
 * 3. 避免白屏→暗色或暗色→白屏的闪烁
 * 
 * 与 Context 的配合：
 * - ThemeScript：负责首帧 DOM 设置
 * - Context Provider：使用 lazy initializer 读取相同的 localStorage 值
 * - 用户切换：Context 的 setter 同时更新 state + localStorage + DOM
 */
export function ThemeScript() {
  const script = `
(function(){
  try {
    var d = document.documentElement;
    
    // 1. 主题模式（dark / light / system）
    var theme = localStorage.getItem('theme') || 'system';
    var isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
      d.classList.add('dark');
    } else {
      d.classList.remove('dark');
    }
    
    // 2. 颜色主题（coral / blue / emerald / pink / purple / orange）
    var colorScheme = localStorage.getItem('color-scheme') || 'coral';
    d.setAttribute('data-color', colorScheme);
    
    // 3. 语言设置（zh / en）
    var locale = localStorage.getItem('locale') || 'zh';
    d.setAttribute('lang', locale === 'en' ? 'en' : 'zh');
  } catch(e) {
    // 静默失败，使用默认值
  }
})();
`;
  return (
    <script
      dangerouslySetInnerHTML={{ __html: script }}
      suppressHydrationWarning
    />
  )
}
