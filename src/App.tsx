import { useState, useRef, useEffect, useCallback } from 'react'
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react'
import { supabase, type Profile, type EsimCode } from './lib/supabase'
// v2
void QRCodeSVG

// ── types ──────────────────────────────────────────────────────────────────
type ESim = { lpa: string; smdp: string; activationCode: string; iosUrl: string; androidUrl: string }
type ThemeMode = 'dark' | 'light'

// ── theme tokens ───────────────────────────────────────────────────────────
const DARK = {
  bg: '#0a0f0d',
  surface: '#111916',
  card: 'linear-gradient(160deg,#131e19 0%,#0e1812 100%)',
  border: '#1f2e27',
  borderSub: 'rgba(255,255,255,0.04)',
  text: '#e8f0ec',
  muted: '#6b8878',
  dim: '#3d5448',
  teal: '#2dd4a0',
  tealDim: 'rgba(45,212,160,0.12)',
  tealFaint: 'rgba(45,212,160,0.06)',
  tealGlow: 'rgba(45,212,160,0.25)',
  error: '#e05252',
  gridLine: 'rgba(45,212,160,0.025)',
  shadow: '0 20px 60px rgba(0,0,0,0.5)',
  inputBg: 'rgba(0,0,0,0.3)',
  infoBg: 'rgba(0,0,0,0.2)',
}
const LIGHT = {
  bg: '#eef2f7',
  surface: '#ffffff',
  card: '#ffffff',
  border: '#d0d9e4',
  borderSub: 'rgba(0,0,0,0.07)',
  text: '#0d1117',
  muted: '#4a5568',
  dim: '#8a97a6',
  teal: '#0969da',
  tealDim: 'rgba(9,105,218,0.12)',
  tealFaint: 'rgba(9,105,218,0.06)',
  tealGlow: 'rgba(9,105,218,0.25)',
  error: '#cf222e',
  gridLine: 'rgba(9,105,218,0.05)',
  shadow: '0 2px 16px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
  inputBg: '#f6f8fa',
  infoBg: '#f6f8fa',
}

// ── URL helpers (v3) ───────────────────────────────────────────────────────
function regionToCode(region: string): string {
  const chars = [...region]
  const cp0 = chars[0]?.codePointAt(0) ?? 0
  const cp1 = chars[1]?.codePointAt(0) ?? 0
  if (cp0 >= 0x1F1E6 && cp0 <= 0x1F1FF && cp1 >= 0x1F1E6 && cp1 <= 0x1F1FF)
    return (String.fromCharCode(cp0 - 0x1F1A5) + String.fromCharCode(cp1 - 0x1F1A5)).toUpperCase()
  return encodeURIComponent(region)
}
function codeToRegion(code: string): string {
  if (/^[A-Z]{2}$/.test(code)) {
    const cp0 = code.charCodeAt(0) + 0x1F1A5
    const cp1 = code.charCodeAt(1) + 0x1F1A5
    const emoji = String.fromCodePoint(cp0) + String.fromCodePoint(cp1)
    const found = REGION_OPTIONS.find(r => [...r][0]?.codePointAt(0) === cp0 && [...r][1]?.codePointAt(0) === cp1)
    return found || emoji + ' ' + code
  }
  return decodeURIComponent(code)
}

function encodeLogoForUrl(logo: string): string {
  const imgurMatch = logo.match(/i\.imgur\.com\/([^/?#]+)/)
  if (imgurMatch) return imgurMatch[1]
  const imgbbMatch = logo.match(/i\.ibb\.co\/([^/?#]+\/[^/?#]+)/)
  if (imgbbMatch) return 'bb:' + imgbbMatch[1]
  return encodeURIComponent(logo)
}

function decodeLogoFromUrl(val: string): string {
  if (!val.startsWith('http') && !val.startsWith('bb:')) return `https://i.imgur.com/${val}`
  if (val.startsWith('bb:')) return `https://i.ibb.co/${val.slice(3)}`
  return decodeURIComponent(val)
}

function buildShareUrl(lpa: string, customDomain?: string, theme?: string, pkg?: { data?: string; duration?: string; region?: string }, userId?: string): string {
  const base = customDomain
    ? `https://${customDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')}`
    : window.location.origin + window.location.pathname
  let url = `${base}?lpa=${lpa.trim().replace(/ /g, '+')}`
  if (pkg?.data) url += `&d=${pkg.data.replace('GB','')}`
  if (pkg?.duration) url += `&t=${pkg.duration.replace(/\s*Hari/i,'')}`
  if (pkg?.region) url += `&r=${regionToCode(pkg.region)}`
  if (userId) url += `&u=${userId}`
  return url
}

function getLPAFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get('lpa')
}

function getLogoFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search)
  const lg = params.get('lg') || params.get('logo')
  if (!lg) return null
  return decodeLogoFromUrl(lg)
}

function getThemeFromUrl(): ThemeMode | null {
  const params = new URLSearchParams(window.location.search)
  const t = params.get('theme')
  return t === 'light' || t === 'dark' ? t : null
}

function getPkgFromUrl() {
  const params = new URLSearchParams(window.location.search)
  const d = params.get('d') || ''
  const t = params.get('t') || ''
  const r = params.get('r') || ''
  return {
    data: d ? (d.includes('GB') ? d : d + 'GB') : '',
    duration: t ? (t.toLowerCase().includes('hari') ? t : t + ' Hari') : '',
    region: r ? codeToRegion(r) : '',
  }
}

// ── helpers ────────────────────────────────────────────────────────────────
function parseLPA(raw: string): ESim | null {
  let str = raw.trim()

  // Extract LPA from iOS/Android eSIM setup URLs
  const carddata = str.match(/[?&]carddata=([^&]+)/i)
  if (carddata) str = decodeURIComponent(carddata[1])

  // Strip prefix
  const inner = str.startsWith('LPA:1$') ? str.slice(6) : str
  const parts = inner.split('$')
  if (parts.length < 2 || !parts[0] || !parts[1]) return null
  const [smdp, activationCode] = parts
  return {
    lpa: `LPA:1$${smdp}$${activationCode}`,
    smdp,
    activationCode,
    iosUrl: `https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=LPA:1$${smdp}$${activationCode}`,
    androidUrl: `https://esimsetup.android.com/esim_qrcode_provisioning?carddata=LPA:1$${smdp}$${activationCode}`,
  }
}

function extractLPAsFromText(text: string): string[] {
  // Match LPA:1$... anywhere in text (greedy until whitespace or end)
  const lpaRegex = /LPA:1\$[^\s$]+\$[^\s]+/gi
  const fromLPA = text.match(lpaRegex) || []

  // Match "Activation Code String:" followed by LPA on same/next line
  const acsRegex = /Activation Code String:\s*(LPA:1\$[^\s$]+\$[^\s]+)/gi
  const fromACS: string[] = []
  let m
  while ((m = acsRegex.exec(text)) !== null) fromACS.push(m[1])

  // Match "carddata=LPA:1$..." in URLs
  const urlRegex = /carddata=(LPA:1[^&\s]+)/gi
  const fromURL: string[] = []
  while ((m = urlRegex.exec(text)) !== null) fromURL.push(decodeURIComponent(m[1]))

  // Deduplicate by LPA string
  const seen = new Set<string>()
  const all = [...fromLPA, ...fromACS, ...fromURL]
  return all.filter(s => { const k = s.toUpperCase(); if (seen.has(k)) return false; seen.add(k); return true })
}

function parseAll(text: string): { results: ESim[]; skipped: number } {
  // First try extracting LPAs embedded anywhere in text
  const embedded = extractLPAsFromText(text)
  if (embedded.length > 0) {
    const results = embedded.map(s => parseLPA(s)).filter(Boolean) as ESim[]
    return { results, skipped: 0 }
  }

  // Fallback: line-by-line (original behavior)
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const results: ESim[] = []
  let skipped = 0
  for (const line of lines) {
    const r = parseLPA(line)
    if (r) results.push(r)
    else skipped++
  }
  return { results, skipped }
}

// ── Particle canvas background ─────────────────────────────────────────────


// ── Theme toggle pill ──────────────────────────────────────────────────────
function ThemeToggle({ mode, setMode, t }: { mode: ThemeMode; setMode: (m: ThemeMode) => void; t: typeof DARK }) {
  const opts: { val: ThemeMode; label: string; icon: string }[] = [
    { val: 'light', label: 'Terang', icon: '☀️' },
    { val: 'dark', label: 'Gelap', icon: '🌙' },
  ]
  return (
    <div style={{ display: 'inline-flex', background: t.surface, border: `1.5px solid ${t.border}`, borderRadius: '999px', padding: '3px', gap: '2px', boxShadow: t.shadow }}>
      {opts.map((o) => (
        <button key={o.val} onClick={() => setMode(o.val)}
          style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '999px', border: 'none', background: mode === o.val ? t.teal : 'transparent', color: mode === o.val ? (t === DARK ? '#0a0f0d' : '#fff') : t.muted, fontSize: '12px', fontWeight: 600, fontFamily: 'Plus Jakarta Sans, sans-serif', cursor: 'pointer', transition: 'all 0.25s', whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: '13px' }}>{o.icon}</span>
          <span style={{ display: 'none' }} className="theme-label">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

// ── Copy button ────────────────────────────────────────────────────────────
function copyText(text: string) {
  const fallback = () => {
    const el = document.createElement('textarea')
    el.value = text; el.style.cssText = 'position:fixed;opacity:0;top:0;left:0'
    document.body.appendChild(el); el.focus(); el.select()
    document.execCommand('copy'); document.body.removeChild(el)
  }
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(fallback)
  } else {
    fallback()
  }
}

function CopyButton({ text, t }: { text: string; t: typeof DARK }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    copyText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 500)
  }
  return (
    <button onClick={copy}
      style={{ background: copied ? `${t.teal}20` : 'transparent', borderStyle: 'solid', borderColor: t.borderSub, borderTopWidth: '0', borderRightWidth: '0', borderBottomWidth: '0', borderLeftWidth: '1px', outline: 'none', color: copied ? t.teal : t.muted, borderRadius: '0 9px 9px 0', padding: '0 14px', fontSize: '11px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '5px', alignSelf: 'stretch', letterSpacing: '0.03em' }}>
      {copied
        ? <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>✓</>
        : <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>Salin</>}
    </button>
  )
}

function isDarkColor(hex: string) { return hex.startsWith('#0') || hex.startsWith('#1') }

function CopyAllButton({ esim, t }: { esim: ESim; t: typeof DARK }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    const text = `SM-DP+ SERVER : ${esim.smdp}\nKODE AKTIVASI : ${esim.activationCode}`
    copyText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 500)
  }
  return (
    <button onClick={copy}
      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', background: copied ? t.teal : `linear-gradient(135deg,${t.tealDim},${t.tealFaint})`, borderStyle: 'solid', borderWidth: '1.5px', borderColor: copied ? t.teal : t.teal + '55', outline: 'none', borderRadius: '10px', color: copied ? '#fff' : t.teal, fontSize: '13px', fontWeight: 700, fontFamily: 'Plus Jakarta Sans, sans-serif', cursor: 'pointer', transition: 'all 0.25s', letterSpacing: '-0.01em', boxShadow: copied ? `0 4px 20px ${t.teal}44` : 'none' }}
      onMouseEnter={(e) => { if (!copied) { const b = e.currentTarget as HTMLButtonElement; b.style.background = t.tealDim; b.style.borderColor = t.teal } }}
      onMouseLeave={(e) => { if (!copied) { const b = e.currentTarget as HTMLButtonElement; b.style.background = `linear-gradient(135deg,${t.tealDim},${t.tealFaint})`; b.style.borderColor = t.teal + '55' } }}>
      {copied
        ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Semua detail tersalin!</>
        : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>Salin Semua Detail</>}
    </button>
  )
}

// ── Info row ───────────────────────────────────────────────────────────────
function InfoRow({ label, value, t }: { label: string; value: string; t: typeof DARK }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: t.muted, paddingLeft: '2px' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0', background: t.infoBg, borderRadius: '10px', border: `1px solid ${t.borderSub}`, overflow: 'hidden' }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12.5px', color: t.text, wordBreak: 'break-all', flex: 1, padding: '10px 12px', lineHeight: 1.4 }}>{value}</span>
        <CopyButton text={value} t={t} />
      </div>
    </div>
  )
}

const AppleIcon = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
  </svg>
)

const AndroidIcon = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M17.523 15.341a.95.95 0 01-.95.95.95.95 0 01-.95-.95.95.95 0 01.95-.95.95.95 0 01.95.95m-9.096 0a.95.95 0 01-.95.95.95.95 0 01-.95-.95.95.95 0 01.95-.95.95.95 0 01.95.95M17.78 10l1.745-3.022a.363.363 0 00-.133-.496.364.364 0 00-.496.133L17.1 9.67A10.81 10.81 0 0012 8.545c-1.832 0-3.56.455-5.1 1.124L5.104 6.615a.363.363 0 00-.496-.133.363.363 0 00-.133.496L6.22 10C3.845 11.348 2.25 13.788 2 16.636h20c-.25-2.848-1.845-5.288-4.22-6.636"/>
  </svg>
)

function InstallButton({ platform, url, isIos, t }: { platform: string; url: string; isIos: boolean; t: typeof DARK }) {
  const [hov, setHov] = useState(false)
  const accentColor = isIos ? (t === DARK ? '#a8b8ff' : '#5856d6') : (t === DARK ? '#7ddc8a' : '#34a853')
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      onClick={(e) => { e.preventDefault(); window.open(url, '_blank', 'noopener,noreferrer') }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '13px 18px', background: hov ? `${accentColor}18` : `${accentColor}0c`, border: `1.5px solid ${hov ? accentColor + '88' : accentColor + '33'}`, borderRadius: '14px', textDecoration: 'none', color: t.text, transition: 'all 0.25s', cursor: 'pointer', transform: hov ? 'translateY(-2px)' : 'translateY(0)', boxShadow: hov ? `0 6px 24px ${accentColor}22` : 'none' }}>
      <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${accentColor}18`, border: `1px solid ${accentColor}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: accentColor, transition: 'all 0.25s', transform: hov ? 'scale(1.08)' : 'scale(1)' }}>
        {isIos ? <AppleIcon size={20} color={accentColor} /> : <AndroidIcon size={20} color={accentColor} />}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span style={{ fontSize: '10px', color: t.muted, fontWeight: 500, letterSpacing: '0.04em' }}>Pasang langsung di</span>
        <span style={{ fontSize: '14px', fontWeight: 700, color: t.text }}>{platform}</span>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px', color: accentColor, opacity: hov ? 1 : 0.5, transition: 'all 0.25s', transform: hov ? 'translateX(3px)' : 'translateX(0)' }}>
        <span style={{ fontSize: '11px', fontWeight: 600 }}>{hov ? 'Buka' : ''}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </div>
    </a>
  )
}

// ── eSIM card ──────────────────────────────────────────────────────────────
function ExpandSection({ title, children, t }: { title: string; children: React.ReactNode; t: typeof DARK }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ border: `1px solid ${t.border}`, borderRadius: '12px', overflow: 'hidden', transition: 'all 0.2s' }}>
      <button onClick={() => setOpen(v => !v)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: open ? t.tealFaint : 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', transition: 'background 0.2s' }}
        onMouseEnter={(e) => { if (!open) (e.currentTarget as HTMLButtonElement).style.background = t.tealFaint }}
        onMouseLeave={(e) => { if (!open) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: t.text }}>{title}</span>
        <span style={{ fontSize: '11px', color: t.teal, transition: 'transform 0.25s', display: 'inline-block', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
      </button>
      {open && (
        <div style={{ padding: '4px 16px 16px', animation: 'fadeDown 0.2s ease' }}>
          {children}
        </div>
      )}
    </div>
  )
}

function ESIMCard({ esim, logoUrl, index, total, t, customDomain, userId, themeMode, pkgData, pkgDuration, pkgRegion }: { esim: ESim; logoUrl: string | null; index: number; total: number; t: typeof DARK; customDomain?: string; userId?: string; themeMode?: string; pkgData?: string; pkgDuration?: string; pkgRegion?: string }) {
  const [mounted, setMounted] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'done' | 'fail'>('idle')
  const [linkCopied, setLinkCopied] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)
  const isDark = themeMode !== 'light'

  const handleCopyLink = () => {
    const theme = (themeMode as string) || localStorage.getItem('esim_theme') || 'dark'
    copyText(buildShareUrl(esim.lpa, customDomain, theme, { data: pkgData, duration: pkgDuration, region: pkgRegion }, userId))
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 500)
  }

  useEffect(() => { const id = setTimeout(() => setMounted(true), 30); return () => clearTimeout(id) }, [esim.lpa])

  const getCanvas = () => canvasRef.current?.querySelector('canvas') as HTMLCanvasElement | null

  const buildOut = (canvas: HTMLCanvasElement) => {
    const pad = 28
    const out = document.createElement('canvas')
    out.width = canvas.width + pad * 2; out.height = canvas.height + pad * 2
    const ctx = out.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.roundRect(0, 0, out.width, out.height, 18); ctx.fill()
    ctx.drawImage(canvas, pad, pad)
    return out
  }

  const handleDownload = () => {
    const c = getCanvas(); if (!c) return
    const out = buildOut(c)
    const a = document.createElement('a')
    a.download = `esim-${index + 1}.png`; a.href = out.toDataURL('image/png'); a.click()
  }

  const handleCopyImage = async () => {
    const c = getCanvas(); if (!c) return
    setCopyStatus('copying')
    const out = buildOut(c)
    try {
      await new Promise<void>((res, rej) => out.toBlob(async (blob) => {
        if (!blob) return rej()
        try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); res() }
        catch { rej() }
      }, 'image/png'))
      setCopyStatus('done')
    } catch {
      const a = document.createElement('a')
      a.download = `esim-${index + 1}.png`; a.href = out.toDataURL('image/png'); a.click()
      setCopyStatus('done')
    }
    setTimeout(() => setCopyStatus('idle'), 2500)
  }

  return (
    <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: '22px', overflow: 'hidden', boxShadow: t.shadow, transition: 'opacity 0.4s, transform 0.4s', opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.98)', position: 'relative' }}>
      <style>{`
        @keyframes spinSlow{to{transform:rotate(360deg)}}
        @keyframes qrGlow{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:1;transform:scale(1.05)}}
        @keyframes qrBlobMain{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:1;transform:scale(1.2)}}
        @keyframes qrBlobA{0%,100%{transform:translate(0,0) scale(1);opacity:.7}50%{transform:translate(18px,12px) scale(1.3);opacity:1}}
        @keyframes qrBlobB{0%,100%{transform:translate(0,0) scale(1);opacity:.6}50%{transform:translate(-14px,-18px) scale(1.25);opacity:.9}}
        @keyframes qrSweep{0%{background-position:150% center}100%{background-position:-150% center}}
        @keyframes scanLine{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
        @keyframes ambientDot0{0%,100%{transform:translate(0,0);opacity:.35}50%{transform:translate(6px,-8px);opacity:.7}}
        @keyframes ambientDot1{0%,100%{transform:translate(0,0);opacity:.4}50%{transform:translate(-8px,5px);opacity:.75}}
        @keyframes ambientDot2{0%,100%{transform:translate(0,0);opacity:.3}50%{transform:translate(5px,8px);opacity:.65}}
        @keyframes borderShimmer{0%{background-position:-200% center}100%{background-position:200% center}}
        @keyframes pulseGlow{0%,100%{opacity:1}50%{opacity:.4}}
      `}</style>

      {/* animated gradient border top */}
      <div style={{ height: '2px', background: `linear-gradient(90deg, transparent, ${t.teal}, transparent)`, animation: 'borderShimmer 3s ease-in-out infinite' }} />

      {/* QR area */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 28px 20px', position: 'relative', overflow: 'hidden', background: isDark ? `linear-gradient(160deg,#0c1610,#0d1814,#0c1318)` : `linear-gradient(160deg,#f0f4ff,#e8f0fe,#f3f0ff)` }}>
        {/* sweep */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(105deg,transparent 35%,${t.teal}${isDark?'06':'07'} 50%,transparent 65%)`, backgroundSize: '200% 100%', animation: 'qrSweep 4s ease-in-out infinite', pointerEvents: 'none' }} />
        {/* rotating conic */}
        <div style={{ position: 'absolute', inset: 0, background: `conic-gradient(from 0deg at 50% 50%,transparent,${t.teal}${isDark?'05':'06'} 20%,transparent 40%,#a78bfa${isDark?'04':'05'} 60%,transparent 80%)`, animation: 'spinSlow 12s linear infinite', pointerEvents: 'none' }} />
        {/* breathing glow */}
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 60% 70% at 50% 50%,${t.teal}${isDark?'07':'09'} 0%,transparent 65%)`, animation: 'qrBlobMain 5s ease-in-out infinite', pointerEvents: 'none' }} />
        {/* corner blobs */}
        <div style={{ position: 'absolute', width: '80px', height: '80px', borderRadius: '50%', background: `radial-gradient(circle,#a78bfa${isDark?'09':'0c'} 0%,transparent 70%)`, top: '-8px', left: '-8px', filter: 'blur(18px)', animation: 'qrBlobA 6s ease-in-out infinite', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: '70px', height: '70px', borderRadius: '50%', background: `radial-gradient(circle,#38bdf8${isDark?'08':'0a'} 0%,transparent 70%)`, bottom: '-8px', right: '-8px', filter: 'blur(16px)', animation: 'qrBlobB 7s ease-in-out infinite', pointerEvents: 'none' }} />
        {/* grid */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(${t.teal}04 1px,transparent 1px),linear-gradient(90deg,${t.teal}04 1px,transparent 1px)`, backgroundSize: '24px 24px', pointerEvents: 'none' }} />
        {/* dots */}
        {[...Array(5)].map((_, i) => (
          <div key={i} style={{ position: 'absolute', width: '3px', height: '3px', borderRadius: '50%', background: i%3===0?t.teal:i%3===1?'#a78bfa':'#38bdf8', opacity: isDark?0.1+(i*0.02):0.13+(i*0.02), left: `${10+i*18}%`, top: `${18+(i%3)*26}%`, animation: `ambientDot${i%3} ${4+i*0.8}s ease-in-out infinite`, pointerEvents: 'none' }} />
        ))}
        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* prismatic halo */}
          <div style={{ position: 'absolute', inset: '-24px', borderRadius: '32px', background: `conic-gradient(from 0deg,${t.teal}${isDark?'1e':'28'},#a78bfa${isDark?'0f':'1e'},${t.teal}${isDark?'18':'22'},#38bdf8${isDark?'0c':'18'},${t.teal}${isDark?'1e':'28'})`, animation: 'spinSlow 8s linear infinite', filter: `blur(${isDark?'10px':'6px'})`, pointerEvents: 'none' }} />
          {/* pulsing outer glow */}
          <div style={{ position: 'absolute', inset: '-18px', borderRadius: '28px', background: `radial-gradient(circle,${t.teal}${isDark?'18':'22'} 0%,transparent 70%)`, animation: 'qrGlow 3s ease-in-out infinite', pointerEvents: 'none' }} />
          {/* rotating dashed ring */}
          <div style={{ position: 'absolute', inset: '-12px', borderRadius: '24px', border: `1.5px dashed ${t.teal}${isDark?'33':'44'}`, animation: 'spinSlow 10s linear infinite', pointerEvents: 'none' }} />
          {/* counter-rotating ring */}
          <div style={{ position: 'absolute', inset: '-20px', borderRadius: '30px', border: `1px dashed ${isDark?'#a78bfa':'#818cf8'}${isDark?'28':'44'}`, animation: 'spinSlow 16s linear infinite reverse', pointerEvents: 'none' }} />
          {/* third ring — solid thin */}
          <div style={{ position: 'absolute', inset: '-28px', borderRadius: '36px', border: `1px solid ${t.teal}${isDark?'0e':'14'}`, animation: 'spinSlow 24s linear infinite', pointerEvents: 'none' }} />
          {/* corner brackets */}
          {[['0','0','auto','auto'],['0','auto','auto','0'],['auto','0','0','auto'],['auto','auto','0','0']].map(([t2,r2,b2,l2], i) => (
            <div key={i} style={{ position: 'absolute', top: t2 === '0' ? '-14px' : 'auto', right: r2 === '0' ? '-14px' : 'auto', bottom: b2 === '0' ? '-14px' : 'auto', left: l2 === '0' ? '-14px' : 'auto', width: '22px', height: '22px', borderTop: i < 2 ? `3px solid ${t.teal}` : 'none', borderBottom: i >= 2 ? `3px solid ${t.teal}` : 'none', borderLeft: (i === 1 || i === 3) ? `3px solid ${t.teal}` : 'none', borderRight: (i === 0 || i === 2) ? `3px solid ${t.teal}` : 'none', pointerEvents: 'none', animation: `qrGlow ${2.5 + i * 0.4}s ease-in-out infinite`, filter: `drop-shadow(0 0 4px ${t.teal})` }} />
          ))}
          <div ref={canvasRef} style={{ background: '#ffffff', borderRadius: '16px', padding: '14px', boxShadow: isDark ? `0 0 0 1.5px ${t.tealGlow},0 20px 60px rgba(0,0,0,0.4),0 0 50px ${t.teal}22` : `0 0 0 2px ${t.teal}44,0 12px 40px rgba(9,105,218,0.18),0 0 30px ${t.teal}22`, position: 'relative', display: 'inline-block' }}>
            <QRCodeCanvas value={esim.lpa} size={180} level="H" />
            {logoUrl && (
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '52px', height: '52px', borderRadius: '50%', background: '#fff', boxShadow: '0 0 0 3px #fff,0 2px 12px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', pointerEvents: 'none' }}>
                <img src={logoUrl} alt="logo" style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: '50%' }} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scan line */}
      <div style={{ position: 'relative', height: '2px', margin: '0 28px', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg,transparent,${t.teal}aa,transparent)`, animation: 'scanLine 2.8s ease-in-out infinite' }} />
      </div>

      {/* Share link */}
      <div style={{ padding: '14px 24px 0' }}>
        <button onClick={handleCopyLink}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '11px', background: linkCopied ? t.teal : t.tealFaint, borderStyle: 'solid', borderWidth: '1.5px', borderColor: linkCopied ? t.teal : t.teal + '44', outline: 'none', borderRadius: '10px', color: linkCopied ? '#fff' : t.teal, fontSize: '13px', fontWeight: 700, fontFamily: 'Plus Jakarta Sans, sans-serif', cursor: 'pointer', transition: 'all 0.25s' }}
          onMouseEnter={(e) => { if (!linkCopied) { (e.currentTarget as HTMLButtonElement).style.background = t.tealDim; (e.currentTarget as HTMLButtonElement).style.borderColor = t.teal } }}
          onMouseLeave={(e) => { if (!linkCopied) { (e.currentTarget as HTMLButtonElement).style.background = t.tealFaint; (e.currentTarget as HTMLButtonElement).style.borderColor = t.teal + '44' } }}>
          {linkCopied
            ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Link tersalin!</>
            : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>Salin Link eSIM ini</>}
        </button>
      </div>

      {/* Download / Copy */}
      <div style={{ display: 'flex', gap: '8px', padding: '4px 24px 4px' }}>
        {[
          { label: 'Download', status: null, onClick: handleDownload, icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg> },
          { label: copyStatus === 'done' ? 'Tersalin!' : copyStatus === 'copying' ? '...' : 'Copy Gambar', status: copyStatus, onClick: handleCopyImage, icon: copyStatus === 'done' ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> },
        ].map(({ label, onClick, icon }, i) => (
          <ActionBtn key={i} label={label} onClick={onClick} icon={icon} t={t} />
        ))}
      </div>

      {/* Details */}
      <div style={{ padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* Package info */}
        {(pkgData || pkgDuration || pkgRegion) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
            {pkgData && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`, borderRadius: '8px', padding: '6px 12px' }}>
                <span style={{ fontSize: '8px', fontWeight: 700, color: t.teal, letterSpacing: '0.1em', textTransform: 'uppercase', lineHeight: 1 }}>Kuota</span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: t.text, lineHeight: 1.2 }}>{pkgData}</span>
              </div>
            )}
            {pkgDuration && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`, borderRadius: '8px', padding: '6px 12px' }}>
                <span style={{ fontSize: '8px', fontWeight: 700, color: t.teal, letterSpacing: '0.1em', textTransform: 'uppercase', lineHeight: 1 }}>Durasi</span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: t.text, lineHeight: 1.2 }}>{pkgDuration}</span>
              </div>
            )}
            {pkgRegion && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`, borderRadius: '8px', padding: '6px 12px' }}>
                <span style={{ fontSize: '8px', fontWeight: 700, color: t.teal, letterSpacing: '0.1em', textTransform: 'uppercase', lineHeight: 1 }}>Region</span>
                {(() => { const f = getFlagImg(pkgRegion); return f ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <img src={f.src} alt="" style={{ width: '18px', height: '13px', objectFit: 'cover', borderRadius: '2px', flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', fontWeight: 800, color: t.text, lineHeight: 1.2 }}>{f.label}</span>
                  </span>
                ) : <span style={{ fontSize: '13px', fontWeight: 800, color: t.text, lineHeight: 1.2 }}>{pkgRegion}</span> })()}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <InfoRow label="SM-DP+ Server" value={esim.smdp} t={t} />
          <InfoRow label="Kode Aktivasi" value={esim.activationCode} t={t} />
        </div>
        <CopyAllButton esim={esim} t={t} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ flex: 1, height: '1px', background: `linear-gradient(90deg,transparent,${t.border})` }} />
          <span style={{ fontSize: '11px', color: t.dim, fontWeight: 500 }}>atau pasang tanpa scan</span>
          <div style={{ flex: 1, height: '1px', background: `linear-gradient(90deg,${t.border},transparent)` }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <InstallButton platform="iPhone / iPad" url={esim.iosUrl} isIos={true} t={t} />
          <InstallButton platform="Android" url={esim.androidUrl} isIos={false} t={t} />
        </div>

        {/* Cara Aktivasi */}
        <ExpandSection title="📋 Cara Aktivasi eSIM" t={t}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { step: '1', text: 'Pastikan perangkat kamu support eSIM dan tidak di-lock carrier.' },
              { step: '2', text: 'Buka Pengaturan → Seluler / Mobile Data → Tambah Paket Data.' },
              { step: '3', text: 'Pilih "Scan QR Code" lalu scan barcode di atas, atau klik tombol Install langsung.' },
              { step: '4', text: 'Ikuti instruksi di layar. eSIM akan aktif dalam beberapa menit.' },
              { step: '5', text: 'Aktifkan roaming data jika dibutuhkan di pengaturan SIM.' },
            ].map(({ step, text }) => (
              <div key={step} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ flexShrink: 0, width: '24px', height: '24px', borderRadius: '50%', background: t.tealDim, border: `1px solid ${t.teal}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: t.teal }}>{step}</div>
                <span style={{ fontSize: '12.5px', color: t.muted, lineHeight: 1.6, paddingTop: '3px' }}>{text}</span>
              </div>
            ))}
          </div>
        </ExpandSection>

        {/* Perangkat Kompatibel */}
        <ExpandSection title="📱 Perangkat Kompatibel" t={t}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: t.teal, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>🍎 iPhone</div>
              <div style={{ fontSize: '12px', color: t.muted, lineHeight: 1.8 }}>iPhone XS, XS Max, XR · iPhone 11 series · iPhone 12 series · iPhone 13 series · iPhone 14 series · iPhone 15 series · iPhone 16 series</div>
            </div>
            <div style={{ height: '1px', backgroundImage: `linear-gradient(90deg,transparent,${t.border},transparent)` }} />
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: t.teal, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>🤖 Android</div>
              <div style={{ fontSize: '12px', color: t.muted, lineHeight: 1.8 }}>Samsung Galaxy S20+ ke atas · Google Pixel 3 ke atas · Huawei P40 series · Oppo Find X3+ · Sony Xperia 10 III+ · dan perangkat Android lain yang support eSIM</div>
            </div>
            <div style={{ height: '1px', backgroundImage: `linear-gradient(90deg,transparent,${t.border},transparent)` }} />
            <div style={{ fontSize: '11px', color: t.dim, display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
              <span>⚠️</span>
              <span>Perangkat harus unlocked (tidak terkunci ke satu operator). Verifikasi kompatibilitas di website operator sebelum aktivasi.</span>
            </div>
          </div>
        </ExpandSection>

      </div>
    </div>
  )
}

function ActionBtn({ label, onClick, icon, t }: { label: string; onClick: () => void; icon: React.ReactNode; t: typeof DARK }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '9px', background: hov ? t.tealDim : t.tealFaint, border: `1px solid ${hov ? t.teal + '55' : t.teal + '33'}`, borderRadius: '10px', color: t.teal, fontSize: '12px', fontWeight: 600, fontFamily: 'Plus Jakarta Sans, sans-serif', cursor: 'pointer', transition: 'all 0.2s', transform: hov ? 'translateY(-1px)' : 'translateY(0)', boxShadow: hov ? `0 4px 14px ${t.teal}22` : 'none' }}>
      {icon}{label}
    </button>
  )
}

// ── Login Page ─────────────────────────────────────────────────────────────
const ADMIN_WA = '6283135085392'

function LoginPage({ t, isDark, themeMode, setThemeMode, onLogin }: { t: typeof DARK; isDark: boolean; themeMode: ThemeMode; setThemeMode: (m: ThemeMode) => void; onLogin: (p: Profile) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [registered, setRegistered] = useState('')

  const fakeEmail = (u: string) => `${u.toLowerCase().trim().replace(/[^a-z0-9]/g, '')}@esimapp.com`

  const handle = async () => {
    if (!username.trim() || !password) return
    setLoading(true); setError('')

    if (mode === 'register') {
      if (username.trim().length < 3) { setError('Username minimal 3 karakter'); setLoading(false); return }
      const { data, error: e } = await supabase.auth.signUp({ email: fakeEmail(username), password, options: { data: { username: username.trim() } } })
      if (e) { setError(e.message.includes('already') ? 'Username sudah dipakai' : e.message); setLoading(false); return }
      if (data.user) {
        await supabase.from('profiles').update({ username: username.trim() }).eq('id', data.user.id)
      }
      setRegistered(username.trim())
      setLoading(false); return
    }

    const { data, error: e } = await supabase.auth.signInWithPassword({ email: fakeEmail(username), password })
    if (e) { setError('Username atau password salah'); setLoading(false); return }
    if (data.user) {
      const { data: profile, error: pe } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
      if (pe || !profile) {
        // Profil belum ada — buat dulu
        const { data: newProfile } = await supabase.from('profiles').upsert({ id: data.user.id, email: data.user.email, role: 'member', is_premium: false }).select().single()
        if (newProfile) { onLogin(newProfile as Profile); setLoading(false); return }
        setError('Gagal memuat profil, coba lagi'); setLoading(false); return
      }
      onLogin(profile as Profile)
    }
    setLoading(false)
  }

  const waMsg = encodeURIComponent(`Halo admin ToleeSim, saya sudah daftar dengan username: *${registered}*. Mohon konfirmasi akun saya. Terima kasih 🙏`)
  const waUrl = `https://wa.me/${ADMIN_WA}?text=${waMsg}`

  const inputStyle = { background: isDark ? 'rgba(0,0,0,0.3)' : '#f8fafc', border: `1.5px solid ${t.border}`, borderRadius: '10px', padding: '11px 14px', color: t.text, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '13px', outline: 'none', transition: 'border-color 0.2s', width: '100%' }

  return (
    <div style={{ minHeight: '100vh', background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', fontFamily: 'Plus Jakarta Sans, sans-serif', color: t.text, position: 'relative' }}>
      <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
        <ThemeToggle mode={themeMode} setMode={m => { setThemeMode(m); localStorage.setItem('esim_theme', m) }} t={t} />
      </div>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '18px', background: isDark ? 'linear-gradient(145deg,#1a2e25,#0e1c16)' : 'linear-gradient(145deg,#e8f4ff,#dbeafe)', border: `1.5px solid ${t.teal}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', margin: '0 auto 14px' }}>📶</div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 4px', fontFamily: 'Space Grotesk, sans-serif' }}>
            <span style={{ backgroundImage: `linear-gradient(135deg,${t.teal},${isDark ? '#6ee7c7' : '#0891b2'})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>ToleeSim</span>
          </h1>
          <p style={{ fontSize: '13px', color: t.muted, margin: 0 }}>{mode === 'login' ? 'Masuk ke akunmu' : 'Buat akun baru'}</p>
        </div>

        <div style={{ background: isDark ? 'rgba(13,22,18,0.92)' : '#fff', border: `1px solid ${t.border}`, borderRadius: '20px', padding: '28px', boxShadow: t.shadow }}>
          <div style={{ height: '3px', background: `linear-gradient(90deg,transparent,${t.teal},transparent)`, borderRadius: '2px', marginBottom: '24px' }} />

          {registered ? (
            /* ── Setelah daftar ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '40px' }}>✅</div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: t.text, marginBottom: '6px' }}>Akun <span style={{ color: t.teal }}>@{registered}</span> berhasil dibuat!</div>
                <div style={{ fontSize: '12px', color: t.muted, lineHeight: 1.6 }}>Sekarang konfirmasi ke admin via WhatsApp agar akunmu diaktifkan.</div>
              </div>
              <a href={waUrl} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '14px', background: 'linear-gradient(135deg,#25d366,#128c7e)', color: '#fff', borderRadius: '12px', textDecoration: 'none', fontSize: '14px', fontWeight: 700, boxShadow: '0 4px 16px rgba(37,211,102,0.4)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Konfirmasi ke Admin WhatsApp
              </a>
              <button onClick={() => { setRegistered(''); setMode('login') }}
                style={{ background: 'none', border: 'none', color: t.muted, fontSize: '12px', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                Sudah konfirmasi? Masuk sekarang
              </button>
            </div>
          ) : (
            /* ── Form login/daftar ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: t.teal, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Username</label>
                <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username"
                  autoComplete="off"
                  style={inputStyle}
                  onFocus={e => e.currentTarget.style.borderColor = t.teal}
                  onBlur={e => e.currentTarget.style.borderColor = t.border} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: t.teal, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input value={password} onChange={e => setPassword(e.target.value)} type={showPw ? 'text' : 'password'} placeholder="Password" autoComplete="new-password"
                    style={{ ...inputStyle, paddingRight: '44px' }}
                    onFocus={e => e.currentTarget.style.borderColor = t.teal}
                    onBlur={e => e.currentTarget.style.borderColor = t.border}
                    onKeyDown={e => e.key === 'Enter' && handle()} />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: t.muted, padding: '2px', display: 'flex', alignItems: 'center' }}>
                    {showPw
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </div>

              {error && <div style={{ fontSize: '12px', color: t.error, background: `${t.error}15`, border: `1px solid ${t.error}33`, borderRadius: '8px', padding: '8px 12px' }}>⚠ {error}</div>}

              <button onClick={handle} disabled={loading || !username.trim() || !password}
                style={{ padding: '13px', background: (loading || !username.trim() || !password) ? t.tealDim : `linear-gradient(135deg,${t.teal},${isDark ? '#1fa876' : '#0550ae'})`, color: (loading || !username.trim() || !password) ? t.dim : '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 700, fontFamily: 'Plus Jakarta Sans, sans-serif', cursor: (loading || !username.trim() || !password) ? 'not-allowed' : 'pointer', transition: 'all 0.2s', boxShadow: (loading || !username.trim() || !password) ? 'none' : `0 4px 16px ${t.teal}44` }}>
                {loading ? '...' : mode === 'login' ? 'Masuk' : 'Daftar'}
              </button>

              {mode === 'register' && (
                <div style={{ fontSize: '11px', color: t.dim, background: t.tealFaint, border: `1px solid ${t.teal}22`, borderRadius: '8px', padding: '10px 12px', lineHeight: 1.6 }}>
                  💡 Setelah daftar, kamu perlu konfirmasi ke admin via WhatsApp untuk aktivasi akun.
                </div>
              )}

              <button onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError('') }}
                style={{ background: 'none', border: 'none', color: t.muted, fontSize: '12px', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', padding: '4px' }}>
                {mode === 'login' ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Package Selector ───────────────────────────────────────────────────────
const DATA_OPTIONS = ['1GB', '2GB', '3GB', '5GB', '10GB', '20GB', '50GB']
const DURATION_OPTIONS = ['7 Hari', '15 Hari', '30 Hari']
const REGION_OPTIONS = [
  '🌍 Afrika', '🌎 Amerika', '🌏 Asia', '🌐 Global', '🌍 Eropa', '🌏 Timur Tengah',
  '🇦🇫 Afghanistan', '🇿🇦 Afrika Selatan', '🇦🇱 Albania', '🇩🇿 Aljazair', '🇩🇪 Jerman',
  '🇦🇩 Andorra', '🇦🇴 Angola', '🇦🇬 Antigua dan Barbuda', '🇸🇦 Arab Saudi',
  '🇦🇷 Argentina', '🇦🇲 Armenia', '🇦🇺 Australia', '🇦🇹 Austria', '🇦🇿 Azerbaijan',
  '🇧🇸 Bahama', '🇧🇭 Bahrain', '🇧🇩 Bangladesh', '🇧🇧 Barbados', '🇧🇾 Belarus',
  '🇧🇪 Belgia', '🇧🇿 Belize', '🇧🇯 Benin', '🇧🇹 Bhutan', '🇧🇴 Bolivia',
  '🇧🇦 Bosnia Herzegovina', '🇧🇼 Botswana', '🇧🇷 Brasil', '🇧🇳 Brunei',
  '🇧🇬 Bulgaria', '🇧🇫 Burkina Faso', '🇧🇮 Burundi', '🇨🇻 Cabo Verde',
  '🇨🇱 Chile', '🇨🇳 China', '🇨🇮 Pantai Gading', '🇩🇰 Denmark', '🇩🇯 Djibouti',
  '🇩🇲 Dominika', '🇪🇨 Ekuador', '🇪🇬 Mesir', '🇸🇻 El Salvador',
  '🇬🇶 Guinea Khatulistiwa', '🇪🇷 Eritrea', '🇪🇪 Estonia', '🇸🇿 Eswatini',
  '🇪🇹 Etiopia', '🇫🇯 Fiji', '🇵🇭 Filipina', '🇫🇮 Finlandia', '🇫🇷 Prancis',
  '🇬🇦 Gabon', '🇬🇲 Gambia', '🇬🇪 Georgia', '🇬🇭 Ghana', '🇬🇩 Grenada',
  '🇬🇹 Guatemala', '🇬🇳 Guinea', '🇬🇼 Guinea-Bissau', '🇬🇾 Guyana',
  '🇭🇹 Haiti', '🇭🇳 Honduras', '🇭🇺 Hungaria', '🇮🇸 Islandia', '🇮🇳 India',
  '🇮🇩 Indonesia', '🇮🇶 Irak', '🇮🇷 Iran', '🇮🇪 Irlandia', '🇮🇱 Israel',
  '🇮🇹 Italia', '🇯🇲 Jamaika', '🇯🇵 Jepang', '🇾🇪 Yaman', '🇯🇴 Yordania',
  '🇰🇿 Kazakhstan', '🇰🇪 Kenya', '🇰🇮 Kiribati', '🇰🇼 Kuwait', '🇰🇬 Kirgistan',
  '🇱🇦 Laos', '🇱🇻 Latvia', '🇱🇧 Lebanon', '🇱🇸 Lesotho', '🇱🇷 Liberia',
  '🇱🇾 Libya', '🇱🇮 Liechtenstein', '🇱🇹 Lithuania', '🇱🇺 Luksemburg',
  '🇲🇬 Madagaskar', '🇲🇼 Malawi', '🇲🇾 Malaysia', '🇲🇻 Maladewa', '🇲🇱 Mali',
  '🇲🇹 Malta', '🇲🇭 Kepulauan Marshall', '🇲🇷 Mauritania', '🇲🇺 Mauritius',
  '🇲🇽 Meksiko', '🇫🇲 Mikronesia', '🇲🇩 Moldova', '🇲🇨 Monako', '🇲🇳 Mongolia',
  '🇲🇪 Montenegro', '🇲🇦 Maroko', '🇲🇿 Mozambik', '🇲🇲 Myanmar', '🇳🇦 Namibia',
  '🇳🇷 Nauru', '🇳🇵 Nepal', '🇳🇱 Belanda', '🇳🇿 Selandia Baru', '🇳🇮 Nikaragua',
  '🇳🇪 Niger', '🇳🇬 Nigeria', '🇲🇰 Makedonia Utara', '🇳🇴 Norwegia', '🇴🇲 Oman',
  '🇵🇰 Pakistan', '🇵🇼 Palau', '🇵🇸 Palestina', '🇵🇦 Panama', '🇵🇬 Papua Nugini',
  '🇵🇾 Paraguay', '🇵🇪 Peru', '🇵🇱 Polandia', '🇵🇹 Portugal', '🇶🇦 Qatar',
  '🇨🇬 Kongo', '🇨🇩 DR Kongo', '🇷🇴 Rumania', '🇷🇺 Rusia', '🇷🇼 Rwanda',
  '🇰🇳 Saint Kitts dan Nevis', '🇱🇨 Saint Lucia', '🇻🇨 Saint Vincent',
  '🇼🇸 Samoa', '🇸🇲 San Marino', '🇸🇹 Sao Tome dan Principe', '🇸🇳 Senegal',
  '🇷🇸 Serbia', '🇸🇨 Seychelles', '🇸🇱 Sierra Leone', '🇸🇬 Singapura',
  '🇸🇰 Slovakia', '🇸🇮 Slovenia', '🇸🇧 Kepulauan Solomon', '🇸🇴 Somalia',
  '🇪🇸 Spanyol', '🇱🇰 Sri Lanka', '🇸🇩 Sudan', '🇸🇸 Sudan Selatan',
  '🇸🇷 Suriname', '🇸🇪 Swedia', '🇨🇭 Swiss', '🇸🇾 Suriah', '🇹🇼 Taiwan',
  '🇹🇯 Tajikistan', '🇹🇿 Tanzania', '🇹🇭 Thailand', '🇹🇱 Timor Leste',
  '🇹🇬 Togo', '🇹🇴 Tonga', '🇹🇹 Trinidad dan Tobago', '🇹🇳 Tunisia',
  '🇹🇷 Turki', '🇹🇲 Turkmenistan', '🇹🇻 Tuvalu', '🇦🇪 UAE', '🇺🇬 Uganda',
  '🇺🇦 Ukraina', '🇬🇧 Inggris', '🇺🇸 Amerika Serikat', '🇺🇾 Uruguay',
  '🇺🇿 Uzbekistan', '🇻🇺 Vanuatu', '🇻🇪 Venezuela', '🇻🇳 Vietnam',
  '🇿🇲 Zambia', '🇿🇼 Zimbabwe', '🇭🇰 Hong Kong', '🇰🇷 Korea Selatan',
  '🇰🇵 Korea Utara', '🇨🇦 Kanada', '🇨🇴 Kolombia', '🇨🇲 Kamerun',
  '🇨🇫 Rep. Afrika Tengah', '🇹🇩 Chad', '🇰🇭 Kamboja', '🇨🇿 Ceko',
  '🇭🇷 Kroasia', '🇨🇺 Kuba', '🇨🇾 Siprus', '🇩🇴 Rep. Dominika',
]

function getFlagImg(option: string): { src: string; label: string } | null {
  const chars = [...option]
  const cp0 = chars[0]?.codePointAt(0) ?? 0
  const cp1 = chars[1]?.codePointAt(0) ?? 0
  if (cp0 < 0x1F1E6 || cp0 > 0x1F1FF || cp1 < 0x1F1E6 || cp1 > 0x1F1FF) return null
  const code = (String.fromCharCode(cp0 - 0x1F1A5) + String.fromCharCode(cp1 - 0x1F1A5)).toLowerCase()
  const label = chars.slice(2).join('').trim()
  return { src: `https://flagcdn.com/w20/${code}.png`, label }
}

function PackageSelector({ data, setData, duration, setDuration, region, setRegion, t, isDark }: {
  data: string; setData: (v: string) => void
  duration: string; setDuration: (v: string) => void
  region: string; setRegion: (v: string) => void
  t: typeof DARK; isDark: boolean
}) {
  const [regionOpen, setRegionOpen] = useState(false)
  const [regionSearch, setRegionSearch] = useState('')

  const ChipGroup = ({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label style={{ fontSize: '11px', fontWeight: 700, color: t.teal, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
        {label}
        <em style={{ fontStyle: 'italic', fontWeight: 400, fontSize: '10px', color: t.dim, letterSpacing: 0, textTransform: 'none' }}>opsional</em>
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {options.map(o => (
          <button key={o} onClick={() => onChange(value === o ? '' : o)}
            style={{ padding: '6px 14px', borderRadius: '999px', border: `1.5px solid ${value === o ? t.teal : t.border}`, background: value === o ? t.tealDim : 'transparent', color: value === o ? t.teal : t.muted, fontSize: '12px', fontWeight: 600, fontFamily: 'Plus Jakarta Sans, sans-serif', cursor: 'pointer', transition: 'all 0.2s', boxShadow: value === o ? `0 0 12px ${t.teal}44,inset 0 0 8px ${t.teal}11` : 'none', transform: value === o ? 'scale(1.05)' : 'scale(1)', display: 'flex', alignItems: 'center', gap: '0' }}>
            {o}
            {value === o && <><span style={{ display: 'inline-block', width: '1px', height: '12px', background: `${t.teal}55`, margin: '0 8px', borderRadius: '1px' }} /><span style={{ fontSize: '10px', lineHeight: 1 }}>✕</span></>}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px', background: isDark ? 'rgba(0,0,0,0.2)' : '#f8fafc', borderRadius: '12px', border: `1px solid ${t.borderSub}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: t.teal, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Info Paket</span>
      </div>
      <ChipGroup label="Kuota Data" options={DATA_OPTIONS} value={data} onChange={setData} />
      <ChipGroup label="Durasi" options={DURATION_OPTIONS} value={duration} onChange={setDuration} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '11px', fontWeight: 700, color: t.teal, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
          Region / Negara
          <em style={{ fontStyle: 'italic', fontWeight: 400, fontSize: '10px', color: t.dim, letterSpacing: 0, textTransform: 'none' }}>opsional</em>
        </label>
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button type="button" onClick={() => setRegionOpen(v => !v)}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isDark ? 'rgba(0,0,0,0.3)' : '#fff', border: `1.5px solid ${region ? t.teal + '66' : t.border}`, borderRadius: '10px', padding: '10px 14px', color: region ? t.text : t.dim, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '13px', cursor: 'pointer', transition: 'border-color 0.2s', textAlign: 'left' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {region ? (() => { const f = getFlagImg(region); return f ? <img src={f.src} alt="" style={{ width: '20px', height: '14px', objectFit: 'cover', borderRadius: '2px', flexShrink: 0 }} /> : <span style={{ fontSize: '16px' }}>{[...region][0]}</span> })() : null}
                <span>{region ? (getFlagImg(region)?.label ?? region) : '-- Pilih region/negara --'}</span>
              </span>
              <span style={{ fontSize: '10px', color: t.dim, transition: 'transform 0.2s', display: 'inline-block', transform: regionOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
            </button>
            {region && (
              <button type="button" onClick={() => { setRegion(''); setRegionSearch(''); setRegionOpen(false) }}
                style={{ flexShrink: 0, width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDark ? 'rgba(207,34,46,0.1)' : 'rgba(207,34,46,0.08)', border: '1.5px solid rgba(207,34,46,0.3)', borderRadius: '8px', color: '#cf222e', fontSize: '14px', cursor: 'pointer', lineHeight: 1 }}
                title="Hapus pilihan negara">✕</button>
            )}
          </div>
          {regionOpen && (
            <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: region ? '38px' : '0', background: isDark ? '#0e1812' : '#fff', border: `1.5px solid ${t.border}`, borderRadius: '10px', zIndex: 50, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '8px 10px', borderBottom: `1px solid ${t.border}` }}>
                <input autoFocus value={regionSearch} onChange={e => setRegionSearch(e.target.value)}
                  placeholder="Cari negara..."
                  style={{ width: '100%', background: isDark ? 'rgba(0,0,0,0.3)' : '#f3f4f6', border: `1px solid ${t.border}`, borderRadius: '7px', padding: '7px 10px', color: t.text, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '12px', outline: 'none' }} />
              </div>
              <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                {regionSearch === '' && (() => {
                  const indonesia = '🇮🇩 Indonesia'
                  const isSelected = region === indonesia
                  const f = getFlagImg(indonesia)
                  return (
                    <div key="pin-indonesia" style={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid ${t.border}` }}>
                      <button type="button" onClick={() => { setRegion(isSelected ? '' : indonesia); setRegionOpen(false); setRegionSearch('') }}
                        style={{ flex: 1, padding: '9px 14px', background: isSelected ? t.tealDim : 'none', border: 'none', textAlign: 'left', color: isSelected ? t.teal : t.text, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {f ? <img src={f.src} alt="" style={{ width: '20px', height: '14px', objectFit: 'cover', borderRadius: '2px', flexShrink: 0 }} /> : null}
                        <span style={{ flex: 1 }}>Indonesia</span>
                        {isSelected && <span style={{ fontSize: '10px', color: t.teal, fontWeight: 700 }}>✓</span>}
                      </button>
                      {isSelected && (
                        <button type="button" onClick={() => { setRegion(''); setRegionOpen(false) }}
                          style={{ padding: '9px 10px', background: 'none', border: 'none', color: '#cf222e', fontSize: '13px', cursor: 'pointer' }}>✕</button>
                      )}
                    </div>
                  )
                })()}
                {region && region !== '🇮🇩 Indonesia' && regionSearch === '' && (() => {
                  const f = getFlagImg(region)
                  return (
                    <button key="selected-top" type="button" onClick={() => { setRegionOpen(false); setRegionSearch('') }}
                      style={{ width: '100%', padding: '9px 14px', background: t.tealDim, border: 'none', textAlign: 'left', color: t.teal, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: `1px solid ${t.border}` }}>
                      {f ? <img src={f.src} alt="" style={{ width: '20px', height: '14px', objectFit: 'cover', borderRadius: '2px', flexShrink: 0 }} /> : <span style={{ fontSize: '16px', lineHeight: 1 }}>{[...region][0]}</span>}
                      <span style={{ flex: 1 }}>{f ? f.label : region.replace(/^\S+\s*/, '')}</span>
                      <span style={{ fontSize: '10px', color: t.teal, fontWeight: 700 }}>✓</span>
                    </button>
                  )
                })()}
                {regionSearch === '' && (
                  <button type="button" onClick={() => { setRegion(''); setRegionOpen(false); setRegionSearch('') }}
                    style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', textAlign: 'left', color: t.dim, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '13px', cursor: 'pointer' }}>
                    -- Pilih region/negara --
                  </button>
                )}
                {REGION_OPTIONS.filter(r => {
                  const f = getFlagImg(r); const label = f ? f.label : r.replace(/^\S+\s*/, '')
                  return label.toLowerCase().includes(regionSearch.toLowerCase())
                }).map(r => {
                  const f = getFlagImg(r)
                  return (
                    <button key={r} type="button" onClick={() => { setRegion(r); setRegionOpen(false); setRegionSearch('') }}
                      style={{ width: '100%', padding: '9px 14px', background: 'none', border: 'none', textAlign: 'left', color: region === r ? t.teal : t.text, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '13px', cursor: 'pointer', transition: 'background 0.15s', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {f ? <img src={f.src} alt="" style={{ width: '20px', height: '14px', objectFit: 'cover', borderRadius: '2px', flexShrink: 0 }} /> : <span style={{ fontSize: '16px', lineHeight: 1 }}>{[...r][0]}</span>}
                      <span>{f ? f.label : r.replace(/^\S+\s*/, '')}</span>
                    </button>
                  )
                })}
                {REGION_OPTIONS.filter(r => { const f = getFlagImg(r); const label = f ? f.label : r.replace(/^\S+\s*/, ''); return label.toLowerCase().includes(regionSearch.toLowerCase()) }).length === 0 && (
                  <div style={{ padding: '14px', textAlign: 'center', color: t.dim, fontSize: '12px' }}>Tidak ditemukan</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Logo Link Saver ────────────────────────────────────────────────────────
const TOLEESIM_DEFAULT = 'https://i.imgur.com/dr0MjeS.jpeg'

function LogoLinkSaver({ logoShareUrl, setLogoShareUrl, setLogoUrl, userId, t, isDark }: {
  logoShareUrl: string; setLogoShareUrl: (v: string) => void; setLogoUrl: (v: string) => void; userId?: string; t: typeof DARK; isDark: boolean
}) {
  const [draft, setDraft] = useState(logoShareUrl === TOLEESIM_DEFAULT ? '' : logoShareUrl)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const canSave = !!draft && draft !== TOLEESIM_DEFAULT

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    setLogoShareUrl(draft); setLogoUrl(draft); localStorage.setItem('esim_logo_url', draft)
    if (userId) await supabase.from('profiles').update({ logo_url: draft }).eq('id', userId)
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  const previewUrl = draft && draft !== TOLEESIM_DEFAULT ? draft : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px 16px', background: isDark ? 'rgba(45,212,160,0.04)' : 'rgba(45,212,160,0.06)', border: `1.5px solid ${saved ? t.teal : previewUrl ? t.teal + '55' : t.border}`, borderRadius: '12px', transition: 'border-color 0.3s' }}>
      <label style={{ fontSize: '11px', fontWeight: 700, color: t.teal, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Link Logo Toko</label>
      {previewUrl && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: isDark ? 'rgba(0,0,0,0.2)' : '#fff', borderRadius: '8px', border: `1px solid ${t.border}` }}>
          <img src={previewUrl} alt="preview" style={{ width: '36px', height: '36px', objectFit: 'contain', borderRadius: '6px', background: '#fff' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
          <span style={{ fontSize: '11px', color: t.muted, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{previewUrl}</span>
          {saved && <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700, flexShrink: 0 }}>✓ Tersimpan!</span>}
        </div>
      )}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input value={draft} onChange={(e) => { setDraft(e.target.value); setSaved(false) }}
          placeholder="https://i.imgur.com/logomu.png"
          style={{ flex: 1, background: isDark ? 'rgba(0,0,0,0.35)' : '#fff', border: `1.5px solid ${canSave ? t.teal + '88' : t.border}`, borderRadius: '10px', padding: '10px 14px', color: t.text, fontFamily: 'JetBrains Mono, monospace', fontSize: '11.5px', outline: 'none', transition: 'border-color 0.2s' }}
          onFocus={(e) => { e.currentTarget.style.borderColor = t.teal }}
          onBlur={(e) => { e.currentTarget.style.borderColor = canSave ? t.teal + '88' : t.border }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
        />
        <button onClick={handleSave} disabled={!canSave}
          style={{ flexShrink: 0, padding: '10px 18px', borderRadius: '10px', border: 'none', background: saved ? '#16a34a' : canSave ? t.teal : t.tealDim, color: '#fff', fontSize: '12px', fontWeight: 700, fontFamily: 'Plus Jakarta Sans, sans-serif', cursor: canSave ? 'pointer' : 'not-allowed', transition: 'all 0.2s', opacity: canSave || saved ? 1 : 0.45 }}>
          {saved ? '✓ Disimpan' : saving ? '...' : 'Simpan'}
        </button>
      </div>
      <span style={{ fontSize: '10.5px', color: t.dim }}>💡 Upload ke <strong style={{ color: t.muted }}>imgur.com</strong> atau <strong style={{ color: t.muted }}>imgbb.com</strong> → copy "Direct link" → paste → klik <strong style={{ color: t.teal }}>Simpan</strong></span>
    </div>
  )
}

// ── Shared LPA Input View ──────────────────────────────────────────────────
function LPAInputView({ t, isDark, themeMode, setThemeMode, onLogout, username, userId, isAdmin = false, onSwitchToMembers }: {
  t: typeof DARK; isDark: boolean; themeMode: ThemeMode; setThemeMode: (m: ThemeMode) => void; onLogout: () => void; username: string; userId?: string; isAdmin?: boolean; onSwitchToMembers?: () => void
}) {
  const DEFAULT_LOGO = 'https://i.imgur.com/dr0MjeS.jpeg'
  const [input, setInput] = useState('')
  const [esims, setEsims] = useState<ESim[]>([])
  const [skipped, setSkipped] = useState(0)
  const [error, setError] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [inputMounted, setInputMounted] = useState(false)
  const [pkgData, setPkgData] = useState('')
  const [pkgDuration, setPkgDuration] = useState('')
  const [pkgRegion, setPkgRegion] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [clock, setClock] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(() => { const v = localStorage.getItem('esim_logo'); return v && v !== TOLEESIM_DEFAULT ? v : null })
  const [logoShareUrl, setLogoShareUrl] = useState<string>(() => { const v = localStorage.getItem('esim_logo_url'); return v && v !== TOLEESIM_DEFAULT ? v : '' })
  const [customDomain, setCustomDomain] = useState<string>(() => localStorage.getItem('esim_domain') || '')
  const [showDomain, setShowDomain] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!userId) return
    supabase.from('profiles').select('logo_url').eq('id', userId).single().then(({ data }) => {
      if (data?.logo_url && data.logo_url !== TOLEESIM_DEFAULT) {
        setLogoShareUrl(data.logo_url); setLogoUrl(data.logo_url); localStorage.setItem('esim_logo_url', data.logo_url)
      }
    })
  }, [userId])

  const showToast = (msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 1400)
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => { const url = ev.target?.result as string; setLogoUrl(url); localStorage.setItem('esim_logo', url) }
    reader.readAsDataURL(file)
  }
  const handleRemoveLogo = (e: React.MouseEvent) => {
    e.stopPropagation(); setLogoUrl(null); localStorage.removeItem('esim_logo')
  }

  useEffect(() => { setTimeout(() => setInputMounted(true), 50) }, [])

  useEffect(() => {
    const tick = () => {
      const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }))
      const hh = String(now.getHours()).padStart(2, '0')
      const mm = String(now.getMinutes()).padStart(2, '0')
      const ss = String(now.getSeconds()).padStart(2, '0')
      setClock(`${hh}:${mm}:${ss}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const handleGenerate = () => {
    const { results, skipped: sk } = parseAll(input)
    if (results.length === 0) { setError('Tidak ada LPA yang valid.'); return }
    setError(''); setSkipped(sk); setEsims(results); setActiveIndex(0)
  }
  const handleReset = () => { setEsims([]); setInput(''); setError(''); setSkipped(0); setActiveIndex(0) }
  const isResult = esims.length > 0

  const pkgLabel = [pkgData, pkgDuration, pkgRegion].filter(Boolean).join(' · ')

  return (
    <div style={{ minHeight: '100vh', background: t.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${isAdmin ? 116 : 80}px 16px 24px`, fontFamily: 'Plus Jakarta Sans, sans-serif', color: t.text, position: 'relative' }}>


      {/* Fixed header */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10, background: isDark ? 'rgba(10,15,13,0.9)' : 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${t.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>📶</span>
            <span style={{ fontWeight: 800, fontSize: '14px', fontFamily: 'Space Grotesk, sans-serif', backgroundImage: `linear-gradient(135deg,${t.teal},${isDark ? '#6ee7c7' : '#0891b2'})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>ToleeSim</span>
            <span style={{ fontSize: '10px', background: isAdmin ? `${t.error}20` : t.tealDim, border: `1px solid ${isAdmin ? t.error + '44' : t.teal + '44'}`, color: isAdmin ? t.error : t.teal, padding: '2px 8px', borderRadius: '999px', fontWeight: 600 }}>{isAdmin ? '👑 Admin' : '⭐ Premium'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ThemeToggle mode={themeMode} setMode={m => { setThemeMode(m); localStorage.setItem('esim_theme', m) }} t={t} />
            <span style={{ fontSize: '11px', color: t.dim }}>@{username}</span>
            <button onClick={onLogout} style={{ background: 'rgba(207,34,46,0.08)', border: `1px solid rgba(207,34,46,0.35)`, borderRadius: '8px', padding: '5px 10px', color: '#cf222e', fontSize: '11px', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600 }}>Keluar</button>
          </div>
        </div>
        {isAdmin && onSwitchToMembers && (
          <div style={{ display: 'flex', gap: '0', borderTop: `1px solid ${t.border}` }}>
            <button style={{ flex: 1, padding: '8px', background: 'transparent', border: 'none', borderBottom: `2px solid ${t.teal}`, color: t.teal, fontSize: '12px', fontWeight: 700, fontFamily: 'Plus Jakarta Sans, sans-serif', cursor: 'default' }}>
              🔧 Generator
            </button>
            <button onClick={onSwitchToMembers} style={{ flex: 1, padding: '8px', background: 'transparent', border: 'none', borderBottom: '2px solid transparent', color: t.muted, fontSize: '12px', fontWeight: 700, fontFamily: 'Plus Jakarta Sans, sans-serif', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.color = t.teal; e.currentTarget.style.borderBottomColor = t.teal + '66' }}
              onMouseLeave={e => { e.currentTarget.style.color = t.muted; e.currentTarget.style.borderBottomColor = 'transparent' }}>
              👥 Member
            </button>
          </div>
        )}
      </div>

      <div style={{ position: 'fixed', inset: 0, backgroundImage: `linear-gradient(${t.gridLine} 1px,transparent 1px),linear-gradient(90deg,${t.gridLine} 1px,transparent 1px)`, backgroundSize: '40px 40px', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', top: '-10%', left: '-5%', width: '500px', height: '500px', borderRadius: '50%', background: `radial-gradient(circle,${t.teal}0f 0%,transparent 70%)`, pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ width: '100%', maxWidth: '460px', position: 'relative', zIndex: 1 }}>
        {!isResult ? (
          <div style={{ transition: 'opacity 0.5s,transform 0.5s', opacity: inputMounted ? 1 : 0, transform: inputMounted ? 'translateY(0)' : 'translateY(28px)' }}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <h1 style={{ fontSize: '28px', fontWeight: 800, color: t.text, margin: '0 0 4px', letterSpacing: '-0.02em', fontFamily: 'Space Grotesk, sans-serif' }}>
                <span style={{ backgroundImage: `linear-gradient(135deg,${t.teal},${isDark ? '#6ee7c7' : '#0891b2'})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>eSIM</span>{' '}
                <span style={{ color: t.text }}>Roaming Kamu</span>
              </h1>
              {clock && <div style={{ fontSize: '14px', fontWeight: 700, color: t.teal, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.12em', margin: '2px 0 6px', textShadow: isDark?`0 0 12px ${t.teal}99,0 0 24px ${t.teal}44`:`0 0 8px ${t.teal}66`, animation: 'clockPulse 1s ease-in-out infinite' }}>{clock}</div>}
              <p style={{ fontSize: '13px', color: t.muted, margin: 0 }}>Satu atau banyak sekaligus — satu LPA per baris</p>
            </div>

            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', inset: '-1.5px', borderRadius: '23px', background: `linear-gradient(135deg,${t.teal}55,#a78bfa44,${t.teal}33,transparent)`, zIndex: 0, animation: 'borderRotate 6s linear infinite' }} />
              <div style={{ position: 'relative', zIndex: 1, background: isDark ? 'rgba(10,17,14,0.88)' : 'rgba(255,255,255,0.82)', backdropFilter: 'blur(28px)', border: `1px solid ${isDark?'rgba(255,255,255,0.06)':'rgba(255,255,255,0.9)'}`, borderRadius: '22px', overflow: 'hidden', boxShadow: isDark?`0 24px 80px rgba(0,0,0,0.5),0 0 0 1px ${t.teal}15,inset 0 1px 0 rgba(255,255,255,0.05)`:`0 8px 40px rgba(0,0,0,0.1),0 0 0 1px rgba(255,255,255,0.8),inset 0 1px 0 rgba(255,255,255,1)` }}>
                <div style={{ height: '2px', background: `linear-gradient(90deg,transparent,${t.teal},#a78bfa,${t.teal},transparent)`, animation: 'shimmerSlide 3s ease-in-out infinite' }} />
                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* LPA Input */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: t.teal, letterSpacing: '0.1em', textTransform: 'uppercase' }}>String LPA</label>
                      <span style={{ fontSize: '10px', color: t.dim, background: t.tealDim, padding: '2px 8px', borderRadius: '20px' }}>satu per baris untuk bulk</span>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <textarea value={input} onChange={e => {
                        const raw = e.target.value
                        const lines = raw.split('\n').map(line => { const m = line.match(/[?&]carddata=([^&]+)/i); return m ? decodeURIComponent(m[1]) : line })
                        setInput(lines.join('\n')); setError('')
                      }} onPaste={e => {
                        e.preventDefault()
                        const pasted = e.clipboardData.getData('text')
                        const found = extractLPAsFromText(pasted)
                        if (found.length > 0) {
                          const prev = input.trim()
                          const merged = prev ? prev + '\n' + found.join('\n') : found.join('\n')
                          setInput(merged); setError('')
                          showToast(`Total ${found.length} LPA terdeteksi`)
                        } else {
                          const lines = pasted.split('\n').map(line => { const m = line.match(/[?&]carddata=([^&]+)/i); return m ? decodeURIComponent(m[1]) : line })
                          const prev = input.trim()
                          setInput(prev ? prev + '\n' + lines.join('\n') : lines.join('\n')); setError('')
                        }
                      }} placeholder={'LPA:1$smdp.io$K2-33LG3J-Y9AJW\nLPA:1$smdp.io$K2-33LG3I-HYN5ZJ'} rows={4}
                        style={{ background: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(248,250,252,0.8)', border: `1.5px solid ${error ? t.error : t.border}`, borderRadius: '12px', padding: '14px 14px 14px 42px', color: t.text, fontFamily: 'JetBrains Mono, monospace', fontSize: '11.5px', resize: 'vertical', outline: 'none', width: '100%', lineHeight: 2, transition: 'border-color 0.25s' }}
                        onFocus={e => { e.currentTarget.style.borderColor = t.teal; e.currentTarget.style.boxShadow = `0 0 0 3px ${t.teal}20` }}
                        onBlur={e => { e.currentTarget.style.borderColor = error ? t.error : t.border; e.currentTarget.style.boxShadow = 'none' }} />
                      <div style={{ position: 'absolute', left: '14px', top: '14px', bottom: '14px', width: '2px', borderRadius: '1px', background: `linear-gradient(180deg,${t.teal}88,${t.teal}22)`, pointerEvents: 'none' }} />
                      {toast && (
                        <div style={{ position: 'absolute', bottom: '10px', right: '10px', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: isDark ? 'rgba(10,20,15,0.94)' : 'rgba(255,255,255,0.96)', border: `1.5px solid ${t.teal}88`, borderRadius: '999px', boxShadow: `0 4px 20px rgba(0,0,0,0.2),0 0 14px ${t.teal}44`, backdropFilter: 'blur(12px)', pointerEvents: 'none', animation: 'toastPop 0.2s cubic-bezier(0.34,1.56,0.64,1)', whiteSpace: 'nowrap', zIndex: 10 }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={t.teal} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: t.teal }}>{toast}</span>
                        </div>
                      )}
                    </div>
                    {error && <span style={{ fontSize: '12px', color: t.error }}>⚠ {error}</span>}
                  </div>

                  {/* Package Selector */}
                  <PackageSelector data={pkgData} setData={setPkgData} duration={pkgDuration} setDuration={setPkgDuration} region={pkgRegion} setRegion={setPkgRegion} t={t} isDark={isDark} />

                  <div style={{ height: '1px', background: `linear-gradient(90deg,transparent,${t.border},transparent)` }} />

                  {/* Logo QR */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: t.teal, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      Logo QR <span style={{ color: t.dim, fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: '10px' }}>opsional · tersimpan otomatis</span>
                    </label>
                    <div onClick={() => fileRef.current?.click()}
                      style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '13px 16px', background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(248,250,252,0.6)', border: `1.5px dashed ${t.border}`, borderRadius: '12px', cursor: 'pointer', transition: 'all 0.25s' }}
                      onMouseEnter={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = t.teal; el.style.background = t.tealFaint }}
                      onMouseLeave={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = t.border; el.style.background = isDark ? 'rgba(0,0,0,0.2)' : 'rgba(248,250,252,0.6)' }}>
                      {logoUrl ? (
                        <>
                          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', flexShrink: 0 }}>
                            <img src={logoUrl} alt="logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
                          </div>
                          <span style={{ fontSize: '13px', color: t.text, flex: 1, fontWeight: 500 }}>Logo terpilih — klik untuk ganti</span>
                          <button onClick={handleRemoveLogo} style={{ background: isDark ? 'rgba(224,82,82,0.15)' : 'rgba(207,34,46,0.1)', border: `1px solid ${t.error}33`, color: t.error, cursor: 'pointer', fontSize: '13px', fontWeight: 600, padding: '4px 10px', borderRadius: '8px', transition: 'all 0.2s', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Hapus</button>
                        </>
                      ) : (
                        <>
                          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: t.tealDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>🖼️</div>
                          <div>
                            <div style={{ fontSize: '13px', color: t.text, fontWeight: 500, marginBottom: '2px' }}>Upload logo toko</div>
                            <div style={{ fontSize: '11px', color: t.dim }}>PNG, JPG — akan muncul di tengah QR code</div>
                          </div>
                        </>
                      )}
                    </div>
                    <input ref={fileRef} type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                    <LogoLinkSaver logoShareUrl={logoShareUrl} setLogoShareUrl={setLogoShareUrl} setLogoUrl={setLogoUrl} userId={userId} t={t} isDark={isDark} />
                  </div>

                  {/* Domain share link */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button type="button" onClick={() => setShowDomain(v => !v)}
                      style={{ background: showDomain ? t.tealDim : 'none', border: `1px solid ${showDomain ? t.teal + '44' : 'transparent'}`, padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', width: 'fit-content', transition: 'all 0.2s', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                      <span style={{ fontSize: '14px' }}>⚙️</span>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: showDomain ? t.teal : t.muted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Domain share link</span>
                      <span style={{ fontSize: '10px', color: showDomain ? t.teal : t.dim, display: 'inline-block', transform: showDomain ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
                    </button>
                    {showDomain && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', animation: 'fadeDown 0.2s ease' }}>
                        <input value={customDomain} onChange={(e) => { setCustomDomain(e.target.value); localStorage.setItem('esim_domain', e.target.value) }}
                          placeholder="esimbarcode.netlify.app"
                          style={{ background: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(248,250,252,0.8)', border: `1.5px solid ${t.border}`, borderRadius: '12px', padding: '11px 14px', color: t.text, fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', outline: 'none', width: '100%', transition: 'border-color 0.2s' }}
                          onFocus={(e) => { e.currentTarget.style.borderColor = t.teal }}
                          onBlur={(e) => { e.currentTarget.style.borderColor = t.border }} />
                        <span style={{ fontSize: '11px', color: t.dim }}>💾 Tersimpan otomatis · kosongkan untuk pakai URL saat ini</span>
                      </div>
                    )}
                  </div>

                  <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '12px' }}>
                    <button onClick={handleGenerate} disabled={!input.trim()}
                      style={{ width: '100%', padding: '15px', background: input.trim() ? `linear-gradient(135deg,${t.teal},${isDark?'#1fa876':'#0550ae'},#7c3aed)` : t.tealDim, color: input.trim() ? '#fff' : t.dim, border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 700, fontFamily: 'Plus Jakarta Sans, sans-serif', cursor: input.trim() ? 'pointer' : 'not-allowed', transition: 'all 0.3s', boxShadow: input.trim() ? `0 6px 28px ${t.teal}55,0 0 0 1px ${t.teal}33` : 'none', position: 'relative', letterSpacing: '-0.01em' }}>
                      {input.trim() && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(105deg,transparent 40%,rgba(255,255,255,0.25) 50%,transparent 60%)', animation: 'btnShimmer 2.5s ease-in-out infinite', borderRadius: '12px', pointerEvents: 'none' }} />}
                      <span style={{ position: 'relative', zIndex: 1 }}>Buat Kartu eSIM →</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <h1 style={{ fontSize: '26px', fontWeight: 800, color: t.text, margin: '0 0 4px', fontFamily: 'Space Grotesk, sans-serif' }}>
                <span style={{ backgroundImage: `linear-gradient(135deg,${t.teal},${isDark ? '#6ee7c7' : '#0891b2'})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>eSIM</span>{' '}
                <span>Roaming Kamu</span>
              </h1>
              {clock && <div style={{ fontSize: '14px', fontWeight: 700, color: t.teal, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.12em', margin: '2px 0 4px', textShadow: isDark?`0 0 12px ${t.teal}99,0 0 24px ${t.teal}44`:`0 0 8px ${t.teal}66`, animation: 'clockPulse 1s ease-in-out infinite' }}>{clock}</div>}
              {skipped > 0 && <p style={{ fontSize: '12px', color: '#e08a52', margin: '4px 0 0' }}>{skipped} baris dilewati</p>}
            </div>
            {esims.length > 1 && (
              <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', overflowX: 'auto' }}>
                {esims.map((_, i) => (
                  <button key={i} onClick={() => setActiveIndex(i)}
                    style={{ flexShrink: 0, padding: '6px 14px', borderRadius: '999px', border: `1px solid ${activeIndex === i ? t.teal + '88' : t.border}`, background: activeIndex === i ? t.tealDim : 'transparent', color: activeIndex === i ? t.teal : t.muted, fontSize: '13px', fontWeight: 600, fontFamily: 'Plus Jakarta Sans, sans-serif', cursor: 'pointer', transition: 'all 0.2s' }}>
                    eSIM #{i + 1}
                  </button>
                ))}
              </div>
            )}
            <ESIMCard key={activeIndex} esim={esims[activeIndex]} logoUrl={logoUrl} index={activeIndex} total={esims.length} t={t} themeMode={themeMode} customDomain={customDomain} userId={userId} pkgData={pkgData} pkgDuration={pkgDuration} pkgRegion={pkgRegion} />
            {esims.length > 1 && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                {(['← Sebelumnya', 'Berikutnya →'] as const).map((label, i) => {
                  const disabled = i === 0 ? activeIndex === 0 : activeIndex === esims.length - 1
                  return (
                    <button key={i} onClick={() => setActiveIndex(idx => i === 0 ? Math.max(0, idx - 1) : Math.min(esims.length - 1, idx + 1))} disabled={disabled}
                      style={{ flex: 1, padding: '10px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '10px', color: disabled ? t.dim : t.muted, fontSize: '13px', fontFamily: 'Plus Jakarta Sans, sans-serif', cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}>
                      {label}
                    </button>
                  )
                })}
              </div>
            )}
            <button onClick={handleReset}
              style={{ width: '100%', marginTop: '10px', padding: '10px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '10px', color: t.muted, fontSize: '13px', fontFamily: 'Plus Jakarta Sans, sans-serif', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = t.teal; (e.currentTarget as HTMLButtonElement).style.color = t.teal }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = t.border; (e.currentTarget as HTMLButtonElement).style.color = t.muted }}>
              ← Input eSIM baru
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Admin Panel ─────────────────────────────────────────────────────────────
function AdminPanel({ t, isDark, profile, onLogout, themeMode, setThemeMode }: { t: typeof DARK; isDark: boolean; profile: Profile; onLogout: () => void; themeMode: ThemeMode; setThemeMode: (m: ThemeMode) => void }) {
  const [tab, setTab] = useState<'generator' | 'members'>('generator')
  const [members, setMembers] = useState<Profile[]>([])

  const loadData = async () => {
    const { data: mems } = await supabase.from('profiles').select('*').eq('role', 'member').order('created_at', { ascending: false })
    if (mems) setMembers(mems as Profile[])
  }

  useEffect(() => { loadData() }, [])

  const togglePremium = async (memberId: string, current: boolean) => {
    await supabase.from('profiles').update({ is_premium: !current }).eq('id', memberId)
    loadData()
  }

  const deleteMember = async (memberId: string) => {
    if (!confirm('Hapus member ini? Aksi ini tidak bisa dibatalkan.')) return
    await supabase.from('profiles').delete().eq('id', memberId)
    await supabase.auth.admin?.deleteUser?.(memberId)
    loadData()
  }

  const cardStyle = { background: isDark ? 'rgba(13,22,18,0.92)' : '#fff', border: `1px solid ${t.border}`, borderRadius: '16px', padding: '20px', boxShadow: t.shadow }

  if (tab === 'generator') {
    return (
      <LPAInputView t={t} isDark={isDark} themeMode={themeMode} setThemeMode={setThemeMode} onLogout={onLogout} username={(profile as any).username || profile.email.split('@')[0]} userId={profile.id} isAdmin={true} onSwitchToMembers={() => setTab('members')} />
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: t.bg, fontFamily: 'Plus Jakarta Sans, sans-serif', color: t.text }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${t.border}`, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isDark ? 'rgba(10,15,13,0.95)' : '#fff', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>📶</span>
          <span style={{ fontWeight: 800, fontSize: '16px', fontFamily: 'Space Grotesk, sans-serif' }}>ToleeSim <span style={{ color: t.teal }}>Admin</span></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ThemeToggle mode={themeMode} setMode={m => { setThemeMode(m); localStorage.setItem('esim_theme', m) }} t={t} />
          <span style={{ fontSize: '12px', color: t.muted }}>{(profile as any).username || profile.email.split('@')[0]}</span>
          <button onClick={onLogout} style={{ background: 'rgba(207,34,46,0.08)', border: `1px solid rgba(207,34,46,0.35)`, borderRadius: '8px', padding: '6px 12px', color: '#cf222e', fontSize: '12px', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600 }}>Keluar</button>
        </div>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', background: isDark ? 'rgba(0,0,0,0.3)' : '#f1f5f9', borderRadius: '12px', padding: '4px' }}>
          {(['generator', 'members'] as const).map(tb => (
            <button key={tb} onClick={() => setTab(tb)}
              style={{ flex: 1, padding: '9px', borderRadius: '8px', border: 'none', background: tab === tb ? t.teal : 'transparent', color: tab === tb ? '#fff' : t.muted, fontSize: '12px', fontWeight: 700, fontFamily: 'Plus Jakarta Sans, sans-serif', cursor: 'pointer', transition: 'all 0.2s' }}>
              {tb === 'generator' ? '🔧 Generator' : '👥 Member'}
            </button>
          ))}
        </div>


        {tab === 'members' && (() => {
          const pending = members.filter(m => !m.is_premium)
          const premium = members.filter(m => m.is_premium)
          const MemberRow = ({ m }: { m: Profile }) => (
            <div style={{ background: isDark ? 'rgba(0,0,0,0.2)' : '#f8fafc', border: `1px solid ${m.is_premium ? t.teal + '33' : t.borderSub}`, borderRadius: '12px', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: t.text }}>@{(m as any).username || m.email.split('@')[0]}</span>
                  <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '999px', background: m.is_premium ? `${t.teal}20` : `${t.dim}20`, color: m.is_premium ? t.teal : t.dim, fontWeight: 600 }}>{m.is_premium ? '⭐ Premium' : '⏳ Menunggu'}</span>
                </div>
                <div style={{ fontSize: '11px', color: t.dim }}>Daftar: {new Date(m.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                {!m.is_premium && (
                  <button onClick={() => togglePremium(m.id, false)}
                    style={{ background: `${t.teal}20`, border: `1.5px solid ${t.teal}55`, color: t.teal, borderRadius: '8px', padding: '7px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', transition: 'all 0.2s' }}>
                    ✓ ACC
                  </button>
                )}
                {m.is_premium && (
                  <button onClick={() => togglePremium(m.id, true)}
                    style={{ background: `${t.error}15`, border: `1px solid ${t.error}33`, color: t.error, borderRadius: '8px', padding: '7px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', transition: 'all 0.2s' }}>
                    Cabut
                  </button>
                )}
                <button onClick={() => deleteMember(m.id)}
                  style={{ background: 'rgba(207,34,46,0.08)', border: `1px solid rgba(207,34,46,0.3)`, color: '#cf222e', borderRadius: '8px', padding: '7px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', transition: 'all 0.2s' }}>
                  🗑
                </button>
              </div>
            </div>
          )
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Menunggu ACC */}
              <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: t.error, textTransform: 'uppercase', letterSpacing: '0.08em' }}>⏳ Menunggu ACC ({pending.length})</h3>
                </div>
                {pending.length === 0
                  ? <p style={{ color: t.dim, fontSize: '13px', margin: 0 }}>Tidak ada yang menunggu.</p>
                  : <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{pending.map(m => <MemberRow key={m.id} m={m} />)}</div>}
              </div>
              {/* Sudah Premium */}
              <div style={cardStyle}>
                <h3 style={{ margin: '0 0 14px', fontSize: '13px', fontWeight: 700, color: t.teal, textTransform: 'uppercase', letterSpacing: '0.08em' }}>⭐ Sudah Premium ({premium.length})</h3>
                {premium.length === 0
                  ? <p style={{ color: t.dim, fontSize: '13px', margin: 0 }}>Belum ada member premium.</p>
                  : <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{premium.map(m => <MemberRow key={m.id} m={m} />)}</div>}
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}

// ── Member Dashboard ────────────────────────────────────────────────────────
function MemberDashboard({ t, isDark, profile, onLogout, themeMode, setThemeMode }: { t: typeof DARK; isDark: boolean; profile: Profile; onLogout: () => void; themeMode: ThemeMode; setThemeMode: (m: ThemeMode) => void }) {
  if (!profile.is_premium) return (
    <div style={{ minHeight: '100vh', background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      <div style={{ textAlign: 'center', padding: '48px 32px', background: isDark ? 'rgba(13,22,18,0.9)' : '#fff', border: `1px solid ${t.border}`, borderRadius: '20px', boxShadow: t.shadow, maxWidth: '380px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
        <h2 style={{ fontSize: '20px', fontWeight: 800, color: t.text, margin: '0 0 10px', fontFamily: 'Space Grotesk, sans-serif' }}>Akses Premium Diperlukan</h2>
        <p style={{ fontSize: '13px', color: t.muted, margin: '0 0 20px', lineHeight: 1.6 }}>Akunmu belum diaktifkan. Hubungi admin ToleeSim via WhatsApp.</p>
        <a href={`https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(`Halo admin, akun saya @${(profile as any).username || profile.email.split('@')[0]} belum diaktifkan.`)}`} target="_blank" rel="noopener noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 20px', background: 'linear-gradient(135deg,#25d366,#128c7e)', color: '#fff', borderRadius: '10px', textDecoration: 'none', fontSize: '13px', fontWeight: 700 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          Hubungi Admin
        </a>
        <button onClick={onLogout} style={{ display: 'block', margin: '12px auto 0', background: 'none', border: 'none', color: t.dim, fontSize: '12px', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Keluar</button>
      </div>
    </div>
  )
  return <LPAInputView t={t} isDark={isDark} themeMode={themeMode} setThemeMode={setThemeMode} onLogout={onLogout} username={(profile as any).username || profile.email.split('@')[0]} userId={profile.id} />
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [showLogin, setShowLogin] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) {
        const { data: p } = await supabase.from('profiles').select('*').eq('id', data.session.user.id).single()
        if (p) setProfile(p as Profile)
      }
      setAuthChecked(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') { setProfile(null); return }
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
        const { data: p } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
        if (p) setProfile(p as Profile)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setShowLogin(false)
  }

  const [input, setInput] = useState('')
  const [esims, setEsims] = useState<ESim[]>(() => {
    const lpa = getLPAFromUrl()
    if (lpa) { const r = parseLPA(lpa); return r ? [r] : [] }
    return []
  })
  const [skipped, setSkipped] = useState(0)
  const [error, setError] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(() => getLogoFromUrl() || null)
  const [logoShareUrl, setLogoShareUrl] = useState<string>(() => localStorage.getItem('esim_logo_url') || '')
  const [customDomain, setCustomDomain] = useState<string>(() => localStorage.getItem('esim_domain') || '')

  useEffect(() => {
    const uid = new URLSearchParams(window.location.search).get('u')
    if (!uid || logoUrl) return
    supabase.from('profiles').select('logo_url').eq('id', uid).single().then(({ data }) => {
      if (data?.logo_url) setLogoUrl(data.logo_url)
    })
  }, [])
  const urlPkg = getPkgFromUrl()
  const [showDomain, setShowDomain] = useState<boolean>(() => !!localStorage.getItem('esim_domain'))
  const [activeIndex, setActiveIndex] = useState(0)
  const [wibTime, setWibTime] = useState('')
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      // WIB = UTC+7
      const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000)
      const hh = String(wib.getUTCHours()).padStart(2, '0')
      const mm = String(wib.getUTCMinutes()).padStart(2, '0')
      const ss = String(wib.getUTCSeconds()).padStart(2, '0')
      setWibTime(`${hh}:${mm}:${ss}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  const [inputMounted, setInputMounted] = useState(false)
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (getLPAFromUrl()) return 'light'
    return getThemeFromUrl() || (localStorage.getItem('esim_theme') as ThemeMode) || 'dark'
  })
  const fileRef = useRef<HTMLInputElement>(null)

  // resolve actual theme
  const isDark = themeMode === 'dark'
  const t = isDark ? DARK : LIGHT

  const saveTheme = (m: ThemeMode) => { setThemeMode(m); localStorage.setItem('esim_theme', m) }

  useEffect(() => { const id = setTimeout(() => setInputMounted(true), 50); return () => clearTimeout(id) }, [])

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => { const url = ev.target?.result as string; setLogoUrl(url); localStorage.setItem('esim_logo', url) }
    reader.readAsDataURL(file)
  }

  const handleRemoveLogo = (e: React.MouseEvent) => {
    e.stopPropagation(); setLogoUrl(null); localStorage.removeItem('esim_logo')
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleGenerate = () => {
    const { results, skipped: sk } = parseAll(input)
    if (results.length === 0) { setError('Tidak ada LPA yang valid. Contoh: LPA:1$smdp.io$KODEMU'); return }
    setError(''); setSkipped(sk); setEsims(results); setActiveIndex(0)
  }

  const handleReset = useCallback(() => {
    setEsims([]); setInput(''); setError(''); setSkipped(0); setActiveIndex(0)
    setInputMounted(false); setTimeout(() => setInputMounted(true), 50)
  }, [])

  const isResult = esims.length > 0

  const hasLpaInUrl = !!getLPAFromUrl()

  if (!authChecked) return (
    <div style={{ minHeight: '100vh', background: '#0a0f0d', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2dd4a0', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '14px' }}>Memuat...</div>
  )

  // Link publik (ada LPA di URL) → selalu tampilkan public view, meski sudah login
  // Tidak ada LPA di URL → cek role
  if (!hasLpaInUrl) {
    if (profile?.role === 'admin') return <AdminPanel t={t} isDark={isDark} profile={profile} onLogout={handleLogout} themeMode={themeMode} setThemeMode={saveTheme} />
    if (profile?.role === 'member') return <MemberDashboard t={t} isDark={isDark} profile={profile} onLogout={handleLogout} themeMode={themeMode} setThemeMode={setThemeMode} />
  }

  // Tidak ada LPA di URL & belum login → wajib login
  if (!hasLpaInUrl) {
    return <LoginPage t={t} isDark={isDark} themeMode={themeMode} setThemeMode={saveTheme} onLogin={(p) => setProfile(p)} />
  }

  // Ada LPA di URL tapi belum login, dan user klik "Input baru" → tampilkan login
  if (showLogin) {
    return <LoginPage t={t} isDark={isDark} themeMode={themeMode} setThemeMode={saveTheme} onLogin={(p) => setProfile(p)} />
  }

  return (
    <div style={{ minHeight: '100vh', background: t.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', fontFamily: 'Plus Jakarta Sans, sans-serif', transition: 'background 0.4s, color 0.4s', color: t.text, position: 'relative' }}>

      {/* backgrounds */}

      {/* grid */}
      <div style={{ position: 'fixed', inset: 0, backgroundImage: `linear-gradient(${t.gridLine} 1px,transparent 1px),linear-gradient(90deg,${t.gridLine} 1px,transparent 1px)`, backgroundSize: '40px 40px', pointerEvents: 'none', zIndex: 0 }} />

      {/* aurora orbs */}
      <div style={{ position: 'fixed', top: '-15%', left: '-10%', width: '600px', height: '600px', borderRadius: '50%', background: `radial-gradient(circle,${t.teal}${isDark?'22':'18'} 0%,transparent 65%)`, pointerEvents: 'none', animation: 'orbFloat1 14s ease-in-out infinite', zIndex: 0, filter: 'blur(40px)' }} />
      <div style={{ position: 'fixed', bottom: '-15%', right: '-10%', width: '520px', height: '520px', borderRadius: '50%', background: `radial-gradient(circle,${isDark?'#7c3aed':'#818cf8'}${isDark?'18':'14'} 0%,transparent 65%)`, pointerEvents: 'none', animation: 'orbFloat2 18s ease-in-out infinite', zIndex: 0, filter: 'blur(40px)' }} />
      <div style={{ position: 'fixed', top: '40%', right: '-5%', width: '320px', height: '320px', borderRadius: '50%', background: `radial-gradient(circle,${t.teal}${isDark?'14':'0e'} 0%,transparent 65%)`, pointerEvents: 'none', animation: 'orbFloat3 22s ease-in-out infinite', zIndex: 0, filter: 'blur(32px)' }} />

      {/* floating particles */}
      {[...Array(12)].map((_,i) => (
        <div key={i} style={{ position: 'fixed', width: i%3===0?'3px':i%3===1?'2px':'4px', height: i%3===0?'3px':i%3===1?'2px':'4px', borderRadius: '50%', background: i%4===0?t.teal:i%4===1?'#a78bfa':i%4===2?'#38bdf8':'#34d399', opacity: isDark?0.35:0.2, left: `${5+i*8}%`, top: `${10+(i*13)%80}%`, pointerEvents: 'none', zIndex: 0, animation: `particle${i%4} ${5+i*1.3}s ease-in-out infinite` }} />
      ))}

      {/* theme toggle — top right */}
      <div style={{ position: 'fixed', top: '16px', right: '16px', zIndex: 10 }}>
        <ThemeToggle mode={themeMode} setMode={saveTheme} t={t} />
      </div>


      <div style={{ width: '100%', maxWidth: '460px', position: 'relative', zIndex: 1 }}>
        {!isResult ? (
          /* ── INPUT ── */
          <div style={{ transition: 'opacity 0.5s, transform 0.5s', opacity: inputMounted ? 1 : 0, transform: inputMounted ? 'translateY(0)' : 'translateY(28px)' }}>

            {/* Hero header */}
            <div style={{ textAlign: 'center', marginBottom: '32px', position: 'relative' }}>
              {/* Glow ring behind icon */}
              <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                <div style={{ position: 'absolute', width: '80px', height: '80px', borderRadius: '50%', background: `radial-gradient(circle,${t.teal}33 0%,transparent 70%)`, animation: 'pulse 2.5s ease-in-out infinite' }} />
                <div style={{ width: '64px', height: '64px', borderRadius: '18px', background: isDark ? 'linear-gradient(145deg,#1a2e25,#0e1c16)' : 'linear-gradient(145deg,#e8f4ff,#dbeafe)', border: `1.5px solid ${t.teal}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', boxShadow: `0 8px 32px ${t.teal}22, 0 0 0 1px ${t.teal}11`, animation: 'iconBounce 4s ease-in-out infinite', position: 'relative' }}>
                  📶
                </div>
              </div>
              <h1 style={{ fontSize: '30px', fontWeight: 800, color: t.text, margin: '0 0 8px', letterSpacing: '-0.02em', lineHeight: 1.2, fontFamily: 'Space Grotesk, sans-serif' }}>
                <span style={{ backgroundImage: `linear-gradient(135deg,${t.teal} 0%,${isDark ? '#6ee7c7' : '#0891b2'} 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>eSIM</span>
                {' '}
                <span style={{ color: t.text }}>Roaming Kamu</span>
              </h1>
              <p style={{ fontSize: '13px', color: t.muted, margin: '0 0 10px', letterSpacing: '0.01em' }}>Satu atau banyak sekaligus — satu LPA per baris</p>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: t.tealDim, border: `1px solid ${t.border}`, borderRadius: '20px', padding: '4px 14px', marginBottom: '4px' }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '15px', fontWeight: 500, color: t.teal, letterSpacing: '0.04em' }}>{wibTime}</span>
              </div>
              {/* Decorative dots */}
              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '14px' }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: i === 1 ? t.teal : t.border, opacity: i === 1 ? 1 : 0.5, animation: `dotPulse ${1.2 + i * 0.4}s ease-in-out infinite` }} />
                ))}
              </div>
            </div>

            {/* Card */}
            <div style={{ position: 'relative' }}>
              {/* outer glow */}
              <div style={{ position: 'absolute', inset: '-1px', borderRadius: '22px', background: `linear-gradient(135deg,${t.teal}22,transparent 50%,${t.teal}11)`, zIndex: 0 }} />
              <div style={{ position: 'relative', zIndex: 1, background: isDark ? 'rgba(13,22,18,0.92)' : 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', border: `1px solid ${t.border}`, borderRadius: '22px', overflow: 'hidden', boxShadow: isDark ? '0 24px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)' : '0 8px 40px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.8)' }}>

                {/* animated top bar */}
                <div style={{ height: '3px', backgroundImage: `linear-gradient(90deg,transparent 0%,${t.teal} 40%,${isDark ? '#6ee7c7' : '#0550ae'} 60%,transparent 100%)` }} />

                <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                  {/* LPA textarea */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: t.teal, letterSpacing: '0.1em', textTransform: 'uppercase' }}>String LPA</label>
                      <span style={{ fontSize: '10px', color: t.dim, background: t.tealDim, padding: '2px 8px', borderRadius: '20px', letterSpacing: '0.03em' }}>satu per baris untuk bulk</span>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <textarea value={input} onChange={(e) => {
                          const lines = e.target.value.split('\n').map(line => {
                            const m = line.match(/[?&]carddata=([^&]+)/i)
                            return m ? decodeURIComponent(m[1]) : line
                          })
                          setInput(lines.join('\n'))
                          setError('')
                        }}
                        placeholder={'LPA:1$smdp.io$K2-33LG3J-Y9AJW\nLPA:1$smdp.io$K2-33LG3I-HYN5ZJ\nLPA:1$smdp.io$K2-33LG3D-1CKO1EH'}
                        rows={5}
                        style={{ background: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(248,250,252,0.8)', border: `1.5px solid ${error ? t.error : t.border}`, borderRadius: '12px', padding: '14px 14px 14px 42px', color: t.text, fontFamily: 'JetBrains Mono, monospace', fontSize: '11.5px', resize: 'vertical', outline: 'none', width: '100%', lineHeight: 2, transition: 'border-color 0.25s,box-shadow 0.25s', whiteSpace: 'pre', overflowX: 'auto', wordBreak: 'normal', overflowWrap: 'normal' }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = t.teal; e.currentTarget.style.boxShadow = `0 0 0 3px ${t.teal}20, 0 4px 16px ${t.teal}10` }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = error ? t.error : t.border; e.currentTarget.style.boxShadow = 'none' }} />
                      {/* line accent */}
                      <div style={{ position: 'absolute', left: '14px', top: '14px', bottom: '14px', width: '2px', borderRadius: '1px', background: `linear-gradient(180deg,${t.teal}88,${t.teal}22)`, pointerEvents: 'none' }} />
                    </div>
                    {error && <span style={{ fontSize: '12px', color: t.error, animation: 'shake 0.3s ease', display: 'flex', alignItems: 'center', gap: '5px' }}>⚠ {error}</span>}
                  </div>

                  {/* Divider */}
                  <div style={{ height: '1px', background: `linear-gradient(90deg,transparent,${t.border},transparent)` }} />

                  {/* Logo */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: t.teal, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      Logo QR <span style={{ color: t.dim, fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: '10px' }}>opsional · tersimpan otomatis</span>
                    </label>
                    <div onClick={() => fileRef.current?.click()}
                      style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '13px 16px', background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(248,250,252,0.6)', border: `1.5px dashed ${t.border}`, borderRadius: '12px', cursor: 'pointer', transition: 'all 0.25s', position: 'relative', overflow: 'hidden' }}
                      onMouseEnter={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = t.teal; el.style.background = t.tealFaint; el.style.transform = 'scale(1.01)' }}
                      onMouseLeave={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = t.border; el.style.background = isDark ? 'rgba(0,0,0,0.2)' : 'rgba(248,250,252,0.6)'; el.style.transform = 'scale(1)' }}>
                      {logoUrl ? (
                        <>
                          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', flexShrink: 0 }}>
                            <img src={logoUrl} alt="logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
                          </div>
                          <span style={{ fontSize: '13px', color: t.text, flex: 1, fontWeight: 500 }}>Logo terpilih — klik untuk ganti</span>
                          <button onClick={handleRemoveLogo} style={{ background: isDark ? 'rgba(224,82,82,0.15)' : 'rgba(207,34,46,0.1)', border: `1px solid ${t.error}33`, color: t.error, cursor: 'pointer', fontSize: '13px', fontWeight: 600, padding: '4px 10px', borderRadius: '8px', transition: 'all 0.2s', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? 'rgba(224,82,82,0.25)' : 'rgba(207,34,46,0.2)' }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = isDark ? 'rgba(224,82,82,0.15)' : 'rgba(207,34,46,0.1)' }}>Hapus</button>
                        </>
                      ) : (
                        <>
                          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: t.tealDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>🖼️</div>
                          <div>
                            <div style={{ fontSize: '13px', color: t.text, fontWeight: 500, marginBottom: '2px' }}>Upload logo toko</div>
                            <div style={{ fontSize: '11px', color: t.dim }}>PNG, JPG — akan muncul di tengah QR code</div>
                          </div>
                        </>
                      )}
                    </div>
                    <input ref={fileRef} type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />

                    {/* Logo URL for sharing */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '10px', fontWeight: 600, color: t.dim, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        Link logo publik <span style={{ color: t.teal, fontWeight: 700 }}>← wajib diisi agar logo muncul saat link dibagikan</span>
                      </label>
                      <input
                        value={logoShareUrl}
                        onChange={(e) => { setLogoShareUrl(e.target.value); localStorage.setItem('esim_logo_url', e.target.value); if (e.target.value) setLogoUrl(e.target.value) }}
                        placeholder="https://i.imgur.com/logomu.png"
                        style={{ background: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(248,250,252,0.8)', border: `1.5px solid ${logoShareUrl ? t.teal + '66' : t.border}`, borderRadius: '10px', padding: '10px 14px', color: t.text, fontFamily: 'JetBrains Mono, monospace', fontSize: '11.5px', outline: 'none', width: '100%', transition: 'border-color 0.2s,box-shadow 0.2s' }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = t.teal; e.currentTarget.style.boxShadow = `0 0 0 3px ${t.teal}18` }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = logoShareUrl ? t.teal + '66' : t.border; e.currentTarget.style.boxShadow = 'none' }}
                      />
                      <span style={{ fontSize: '10.5px', color: t.dim }}>💡 Upload logo ke <strong style={{ color: t.muted }}>imgur.com</strong> atau <strong style={{ color: t.muted }}>imgbb.com</strong> → copy "Direct link" → paste di sini</span>
                    </div>
                  </div>

                  {/* Domain collapsible */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button type="button" onClick={() => setShowDomain((v) => !v)}
                      style={{ background: showDomain ? t.tealDim : 'none', border: `1px solid ${showDomain ? t.teal + '44' : 'transparent'}`, padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', width: 'fit-content', transition: 'all 0.2s' }}>
                      <span style={{ fontSize: '14px' }}>⚙️</span>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: showDomain ? t.teal : t.muted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Domain share link</span>
                      <span style={{ fontSize: '10px', color: showDomain ? t.teal : t.dim, transition: 'transform 0.2s', display: 'inline-block', transform: showDomain ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                    </button>
                    {showDomain && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', animation: 'fadeDown 0.2s ease' }}>
                        <input
                          value={customDomain}
                          onChange={(e) => { setCustomDomain(e.target.value); localStorage.setItem('esim_domain', e.target.value) }}
                          placeholder="esimbarcode.netlify.app"
                          style={{ background: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(248,250,252,0.8)', border: `1.5px solid ${t.border}`, borderRadius: '12px', padding: '11px 14px', color: t.text, fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', outline: 'none', width: '100%', transition: 'border-color 0.2s,box-shadow 0.2s' }}
                          onFocus={(e) => { e.currentTarget.style.borderColor = t.teal; e.currentTarget.style.boxShadow = `0 0 0 3px ${t.teal}18` }}
                          onBlur={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.boxShadow = 'none' }}
                        />
                        <span style={{ fontSize: '11px', color: t.dim }}>💾 Tersimpan otomatis · kosongkan untuk pakai URL saat ini</span>
                      </div>
                    )}
                  </div>

                  {/* Generate button */}
                  <button onClick={handleGenerate} disabled={!input.trim()}
                    style={{ position: 'relative', padding: '15px', background: input.trim() ? `linear-gradient(135deg,${t.teal} 0%,${isDark ? '#1fa876' : '#0550ae'} 100%)` : t.tealDim, color: input.trim() ? '#ffffff' : t.dim, border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 700, fontFamily: 'Plus Jakarta Sans, sans-serif', cursor: input.trim() ? 'pointer' : 'not-allowed', transition: 'all 0.25s', boxShadow: input.trim() ? `0 6px 24px ${t.teal}44` : 'none', overflow: 'hidden', letterSpacing: '0.01em' }}
                    onMouseEnter={(e) => { if (input.trim()) { const b = e.currentTarget as HTMLButtonElement; b.style.transform = 'translateY(-2px)'; b.style.boxShadow = `0 12px 36px ${t.teal}55` } }}
                    onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.transform = 'translateY(0)'; b.style.boxShadow = input.trim() ? `0 6px 24px ${t.teal}44` : 'none' }}>
                    {input.trim() && <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.15) 50%,transparent 100%)', opacity: 0.8 }} />}
                    <span style={{ position: 'relative', zIndex: 1 }}>Buat Kartu eSIM →</span>
                  </button>

                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ── RESULT ── */
          <>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <h1 style={{ fontSize: '30px', fontWeight: 800, color: t.text, margin: '0 0 10px', letterSpacing: '-0.02em', lineHeight: 1.2, fontFamily: 'Space Grotesk, sans-serif', animation: 'fadeDown 0.4s ease 0.05s both' }}>
                <span style={{ backgroundImage: `linear-gradient(135deg,${t.teal} 0%,${isDark ? '#6ee7c7' : '#0891b2'} 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>eSIM</span>
                {' '}
                <span style={{ color: t.text }}>Roaming Kamu</span>
              </h1>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: t.tealDim, border: `1px solid ${t.border}`, borderRadius: '20px', padding: '4px 14px', marginBottom: skipped > 0 ? '6px' : '0' }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '15px', fontWeight: 500, color: t.teal, letterSpacing: '0.04em' }}>{wibTime}</span>
              </div>
              {skipped > 0 && <p style={{ fontSize: '12px', color: '#e08a52', margin: '4px 0 0' }}>{skipped} baris dilewati (format tidak valid)</p>}
            </div>

            {esims.length > 1 && (
              <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
                {esims.map((_, i) => (
                  <button key={i} onClick={() => setActiveIndex(i)}
                    style={{ flexShrink: 0, padding: '6px 14px', borderRadius: '999px', border: `1px solid ${activeIndex === i ? t.teal + '88' : t.border}`, background: activeIndex === i ? t.tealDim : 'transparent', color: activeIndex === i ? t.teal : t.muted, fontSize: '13px', fontWeight: 600, fontFamily: 'Plus Jakarta Sans, sans-serif', cursor: 'pointer', transition: 'all 0.2s', boxShadow: activeIndex === i ? `0 0 14px ${t.teal}22` : 'none' }}>
                    eSIM #{i + 1}
                  </button>
                ))}
              </div>
            )}

            <ESIMCard key={activeIndex} esim={esims[activeIndex]} logoUrl={logoUrl} index={activeIndex} total={esims.length} t={t} customDomain={customDomain} themeMode={themeMode} pkgData={urlPkg.data} pkgDuration={urlPkg.duration} pkgRegion={urlPkg.region} />

            {esims.length > 1 && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                {(['← Sebelumnya', 'Berikutnya →'] as const).map((label, i) => {
                  const disabled = i === 0 ? activeIndex === 0 : activeIndex === esims.length - 1
                  return (
                    <button key={i} onClick={() => setActiveIndex((idx) => i === 0 ? Math.max(0, idx - 1) : Math.min(esims.length - 1, idx + 1))} disabled={disabled}
                      style={{ flex: 1, padding: '10px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '10px', color: disabled ? t.dim : t.muted, fontSize: '13px', fontFamily: 'Plus Jakarta Sans, sans-serif', cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
                      onMouseEnter={(e) => { if (!disabled) { (e.currentTarget as HTMLButtonElement).style.borderColor = t.teal; (e.currentTarget as HTMLButtonElement).style.color = t.teal } }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = t.border; (e.currentTarget as HTMLButtonElement).style.color = disabled ? t.dim : t.muted }}>
                      {label}
                    </button>
                  )
                })}
              </div>
            )}

            <button onClick={() => { if (profile) { setShowLogin(false); setProfile(profile) } else { setShowLogin(true) } }}
              style={{ width: '100%', marginTop: '10px', padding: '10px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '10px', color: t.muted, fontSize: '13px', fontFamily: 'Plus Jakarta Sans, sans-serif', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = t.teal; (e.currentTarget as HTMLButtonElement).style.color = t.teal }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = t.border; (e.currentTarget as HTMLButtonElement).style.color = t.muted }}>
              ← Input eSIM baru
            </button>

            <p style={{ textAlign: 'center', fontSize: '12px', color: t.dim, marginTop: '16px' }}>
              eSIM hanya bisa digunakan sekali. Jangan bagikan ke orang lain.
            </p>
          </>
        )}
      </div>

      <style>{`
        @keyframes pulseGlow { 0%,100%{opacity:1;box-shadow:0 0 8px currentColor;}50%{opacity:.4;box-shadow:0 0 3px currentColor;} }
        @keyframes qrGlow { 0%,100%{opacity:.6;transform:scale(1);}50%{opacity:1;transform:scale(1.05);} }
        @keyframes scanLine { 0%{transform:translateX(-100%);}100%{transform:translateX(100%);} }
        @keyframes borderShimmer { 0%{background-position:-200% center;}100%{background-position:200% center;} }
        @keyframes shimmerSlide { 0%{transform:translateX(-100%);}60%,100%{transform:translateX(200%);} }
        @keyframes spinSlow { to{transform:rotate(360deg);} }
        @keyframes borderRotate { to{filter:hue-rotate(360deg);} }
        @keyframes ambientDot0 { 0%,100%{transform:translate(0,0);opacity:.35;}50%{transform:translate(6px,-8px);opacity:.65;} }
        @keyframes ambientDot1 { 0%,100%{transform:translate(0,0);opacity:.4;}50%{transform:translate(-8px,5px);opacity:.7;} }
        @keyframes ambientDot2 { 0%,100%{transform:translate(0,0);opacity:.3;}50%{transform:translate(5px,8px);opacity:.6;} }
        @keyframes orbFloat1 { 0%,100%{transform:translate(0,0);}33%{transform:translate(40px,-30px);}66%{transform:translate(-30px,40px);} }
        @keyframes orbFloat2 { 0%,100%{transform:translate(0,0);}50%{transform:translate(-50px,-40px);} }
        @keyframes orbFloat3 { 0%,100%{transform:translate(0,0);}40%{transform:translate(30px,50px);}80%{transform:translate(-20px,-30px);} }
        @keyframes particle0 { 0%,100%{transform:translate(0,0) scale(1);opacity:.35;}50%{transform:translate(10px,-15px) scale(1.4);opacity:.65;} }
        @keyframes particle1 { 0%,100%{transform:translate(0,0) scale(1);opacity:.3;}50%{transform:translate(-12px,10px) scale(1.2);opacity:.55;} }
        @keyframes particle2 { 0%,100%{transform:translate(0,0) scale(1);opacity:.4;}50%{transform:translate(8px,14px) scale(1.5);opacity:.7;} }
        @keyframes particle3 { 0%,100%{transform:translate(0,0);opacity:.25;}50%{transform:translate(-8px,-12px);opacity:.5;} }
        @keyframes iconBounce { 0%,100%{transform:translateY(0);}50%{transform:translateY(-8px);} }
        @keyframes fadeDown { from{opacity:0;transform:translateY(-10px);}to{opacity:1;transform:translateY(0);} }
        @keyframes fadeIn { from{opacity:0;transform:translateX(-50%) translateY(-4px);}to{opacity:1;transform:translateX(-50%) translateY(0);} }
        @keyframes shake { 0%,100%{transform:translateX(0);}25%{transform:translateX(-6px);}75%{transform:translateX(6px);} }
        @keyframes spin { to{transform:rotate(360deg);} }
        @keyframes btnShimmer { 0%{transform:translateX(-100%);}60%,100%{transform:translateX(200%);} }
        @keyframes clockPulse { 0%,100%{opacity:1;}50%{opacity:0.75;} }
        @keyframes pulse { 0%,100%{transform:scale(1);opacity:.6;}50%{transform:scale(1.15);opacity:1;} }
        @keyframes dotPulse { 0%,100%{transform:scale(1);opacity:.5;}50%{transform:scale(1.4);opacity:1;} }
        @keyframes toastPop { 0%{opacity:0;transform:scale(0.7) translateY(4px);}100%{opacity:1;transform:scale(1) translateY(0);} }
        @keyframes qrBlobMain { 0%,100%{opacity:.6;transform:scale(1);}50%{opacity:1;transform:scale(1.15);} }
        @keyframes qrSweep { 0%{background-position:200% center;}100%{background-position:-200% center;} }
        @keyframes qrBlobA { 0%,100%{transform:translate(0,0) scale(1);opacity:.7;}50%{transform:translate(20px,15px) scale(1.3);opacity:1;} }
        @keyframes qrBlobB { 0%,100%{transform:translate(0,0) scale(1);opacity:.6;}50%{transform:translate(-15px,-20px) scale(1.2);opacity:.9;} }
        @keyframes ripple { 0%{transform:translate(-50%,-50%) scale(1);opacity:.5;}100%{transform:translate(-50%,-50%) scale(7);opacity:0;} }
        textarea::placeholder { color: ${t.dim}; }
        ::-webkit-scrollbar{height:4px;width:4px;}
        ::-webkit-scrollbar-thumb{background:${t.border};border-radius:4px;}
        ::-webkit-scrollbar-track{background:transparent;}
      `}</style>
    </div>
  )
}

// keep QRCodeSVG imported to avoid tree-shake warning
void QRCodeSVG
