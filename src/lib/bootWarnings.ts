import { getSupabaseConfigStatus } from './supabase'

let mounted = false

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&#39;'
    }
  })
}

function overlay(title: string, detail: string) {
  if (mounted) return
  mounted = true
  const cfg = getSupabaseConfigStatus()
  const cfgText =
    cfg.url === 'ok' && cfg.key === 'ok'
      ? 'إعدادات Supabase سليمة (الرابط والمفتاح موجودان وصالحان).'
      : `مشكلة في إعدادات Supabase: الرابط=${cfg.url === 'ok' ? 'موجود' : cfg.url === 'missing' ? 'غير مضبوط' : 'غير صالح'}، المفتاح=${cfg.key === 'ok' ? 'موجود' : 'غير مضبوط'}. تأكد من ضبط VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في بيئة البناء (Netlify).`

  const el = document.createElement('div')
  el.id = 'fatal-error-box'
  el.style.cssText =
    'position:fixed;inset:0;z-index:99999;display:flex;align-items:flex-start;justify-content:center;background:#fff;font-family:system-ui,sans-serif;direction:rtl;text-align:right;overflow:auto;padding:24px'
  const box = document.createElement('div')
  box.style.cssText = 'max-width:640px;width:100%;margin-top:6vh'
  box.innerHTML = `
    <h2 style="font-size:18px;margin:0 0 10px;color:#0f172a">${escapeHtml(title)}</h2>
    <pre style="white-space:pre-wrap;background:#f1f5f9;padding:14px;border-radius:10px;font-size:13px;color:#334155">${escapeHtml(detail)}</pre>
    <p style="font-size:12px;color:#64748b;margin:12px 0 0">${escapeHtml(cfgText)}</p>
    <button style="margin-top:14px;padding:9px 18px;border-radius:10px;border:0;background:#7c3aed;color:#fff;cursor:pointer;font-size:14px">إعادة تحميل</button>
  `
  box.querySelector('button')?.addEventListener('click', () => location.reload())
  el.appendChild(box)
  document.body.appendChild(el)
}

export function installBootWarnings(): void {
  window.addEventListener('error', (e) => {
    const msg = e.message || (e.error instanceof Error ? e.error.message : '') || 'خطأ غير معروف'
    overlay('حدث خطأ غير متوقع أثناء تشغيل الموقع', msg)
  })
  window.addEventListener('unhandledrejection', (e) => {
    const detail = e.reason instanceof Error ? `${e.reason.message}\n${e.reason.stack ?? ''}` : String(e.reason)
    overlay('حدث خطأ غير معالج في العملية (Promise)', detail)
  })
  window.addEventListener('vite:preloadError', () => {
    overlay('تعذر تحميل جزء من التطبيق', 'انقر «إعادة تحميل» للمحاولة من جديد، أو أعد نشر النسخة الأحدث.')
  })
}