import { useState, useRef, useEffect, useCallback } from 'react'
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react'
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
  bg: '#f4f6f8',
  surface: '#ffffff',
  card: 'linear-gradient(160deg,#ffffff 0%,#f8fafc 100%)',
  border: '#dde3ea',
  borderSub: 'rgba(0,0,0,0.06)',
  text: '#0d1117',
  muted: '#556070',
  dim: '#8a97a6',
  teal: '#0969da',
  tealDim: 'rgba(9,105,218,0.1)',
  tealFaint: 'rgba(9,105,218,0.05)',
  tealGlow: 'rgba(9,105,218,0.3)',
  error: '#cf222e',
  gridLine: 'rgba(9,105,218,0.05)',
  shadow: '0 4px 24px rgba(0,0,0,0.08)',
  inputBg: '#ffffff',
  infoBg: '#f6f8fa',
}

// ── URL helpers (v3) ───────────────────────────────────────────────────────
function buildShareUrl(lpa: string, customDomain?: string): string {
  const base = customDomain
    ? `https://${customDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')}`
    : window.location.origin + window.location.pathname
  return `${base}?lpa=${lpa.replace(/ /g, '+')}`
}

function getLPAFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get('lpa')
}

function getLogoFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get('logo')
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

function parseAll(text: string): { results: ESim[]; skipped: number } {
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

function ESIMCard({ esim, logoUrl, index, total, t, customDomain, logoShareUrl }: { esim: ESim; logoUrl: string | null; index: number; total: number; t: typeof DARK; customDomain?: string; logoShareUrl?: string }) {
  const [mounted, setMounted] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'done' | 'fail'>('idle')
  const [linkCopied, setLinkCopied] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)

  const handleCopyLink = () => {
    copyText(buildShareUrl(esim.lpa, customDomain))
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

      {/* animated gradient border top */}
      <div style={{ height: '2px', background: `linear-gradient(90deg, transparent, ${t.teal}, transparent)`, animation: 'borderShimmer 3s ease-in-out infinite' }} />

      {/* QR area */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 28px 20px', position: 'relative', overflow: 'hidden' }}>
        {/* layered aurora backdrop */}
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${t.teal}18 0%, transparent 70%)`, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 60% 80% at 20% 100%, ${t.teal}10 0%, transparent 60%)`, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 50% 70% at 80% 80%, ${t.teal}08 0%, transparent 60%)`, pointerEvents: 'none' }} />
        {/* subtle grid texture */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(${t.teal}08 1px,transparent 1px),linear-gradient(90deg,${t.teal}08 1px,transparent 1px)`, backgroundSize: '20px 20px', pointerEvents: 'none' }} />
        {/* floating ambient dots */}
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{ position: 'absolute', width: i % 2 === 0 ? '5px' : '3px', height: i % 2 === 0 ? '5px' : '3px', borderRadius: '50%', background: t.teal, opacity: 0.2 + (i * 0.05), left: `${10 + i * 14}%`, top: `${15 + (i % 3) * 25}%`, animation: `ambientDot${i % 3} ${3 + i * 0.7}s ease-in-out infinite`, pointerEvents: 'none' }} />
        ))}
        {total > 1 && (
          <div style={{ position: 'absolute', top: '14px', right: '16px', background: t.tealDim, border: `1px solid ${t.teal}44`, borderRadius: '999px', padding: '3px 10px', fontSize: '11px', color: t.teal, fontWeight: 600, zIndex: 2 }}>
            #{index + 1} / {total}
          </div>
        )}
        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* prismatic halo */}
          <div style={{ position: 'absolute', inset: '-20px', borderRadius: '28px', background: `conic-gradient(from 0deg, ${t.teal}30, ${t.teal}08, ${t.teal}30, ${t.teal}08, ${t.teal}30)`, animation: 'spinSlow 8s linear infinite', filter: 'blur(8px)', pointerEvents: 'none' }} />
          {/* pulsing outer glow */}
          <div style={{ position: 'absolute', inset: '-16px', borderRadius: '26px', background: `radial-gradient(circle,${t.teal}28 0%,transparent 70%)`, animation: 'qrGlow 3s ease-in-out infinite', pointerEvents: 'none' }} />
          {/* rotating dashed ring */}
          <div style={{ position: 'absolute', inset: '-10px', borderRadius: '22px', border: `1.5px dashed ${t.teal}44`, animation: 'spinSlow 12s linear infinite', pointerEvents: 'none' }} />
          {/* counter-rotating ring */}
          <div style={{ position: 'absolute', inset: '-18px', borderRadius: '28px', border: `1px dashed ${t.teal}30`, animation: 'spinSlow 18s linear infinite reverse', pointerEvents: 'none' }} />
          {/* corner brackets */}
          {[['0','0','auto','auto'],['0','auto','auto','0'],['auto','0','0','auto'],['auto','auto','0','0']].map(([t2,r2,b2,l2], i) => (
            <div key={i} style={{ position: 'absolute', top: t2 === '0' ? '-12px' : 'auto', right: r2 === '0' ? '-12px' : 'auto', bottom: b2 === '0' ? '-12px' : 'auto', left: l2 === '0' ? '-12px' : 'auto', width: '18px', height: '18px', borderTop: i < 2 ? `2.5px solid ${t.teal}` : 'none', borderBottom: i >= 2 ? `2.5px solid ${t.teal}` : 'none', borderLeft: (i === 1 || i === 3) ? `2.5px solid ${t.teal}` : 'none', borderRight: (i === 0 || i === 2) ? `2.5px solid ${t.teal}` : 'none', pointerEvents: 'none', animation: 'qrGlow 3s ease-in-out infinite' }} />
          ))}
          <div ref={canvasRef} style={{ background: '#ffffff', borderRadius: '16px', padding: '14px', boxShadow: `0 0 0 1.5px ${t.tealGlow}, 0 20px 60px rgba(0,0,0,0.35), 0 0 40px ${t.teal}18`, position: 'relative', display: 'inline-block' }}>
            <QRCodeCanvas value={esim.lpa} size={180} level="H" imageSettings={logoUrl ? { src: logoUrl, width: 48, height: 48, excavate: true } : undefined} />
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

// ── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  const [input, setInput] = useState('')
  const [esims, setEsims] = useState<ESim[]>(() => {
    const lpa = getLPAFromUrl()
    if (lpa) { const r = parseLPA(lpa); return r ? [r] : [] }
    return []
  })
  const [skipped, setSkipped] = useState(0)
  const [error, setError] = useState('')
  const DEFAULT_LOGO = 'https://i.imgur.com/dr0MjeS.jpeg'
  const [logoUrl, setLogoUrl] = useState<string | null>(() => getLogoFromUrl() || localStorage.getItem('esim_logo') || DEFAULT_LOGO)
  const [logoShareUrl, setLogoShareUrl] = useState<string>(() => localStorage.getItem('esim_logo_url') || DEFAULT_LOGO)
  const [customDomain, setCustomDomain] = useState<string>(() => localStorage.getItem('esim_domain') || '')
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
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => (localStorage.getItem('esim_theme') as ThemeMode) || 'dark')
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

  return (
    <div style={{ minHeight: '100vh', background: t.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', fontFamily: 'Plus Jakarta Sans, sans-serif', transition: 'background 0.4s, color 0.4s', color: t.text, position: 'relative' }}>

      {/* backgrounds */}

      {/* grid */}
      <div style={{ position: 'fixed', inset: 0, backgroundImage: `linear-gradient(${t.gridLine} 1px,transparent 1px),linear-gradient(90deg,${t.gridLine} 1px,transparent 1px)`, backgroundSize: '40px 40px', pointerEvents: 'none', zIndex: 0 }} />

      {/* orbs */}
      <div style={{ position: 'fixed', top: '-10%', left: '-5%', width: '500px', height: '500px', borderRadius: '50%', background: `radial-gradient(circle,${t.teal}0f 0%,transparent 70%)`, pointerEvents: 'none', animation: 'orbFloat1 12s ease-in-out infinite', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: '-10%', right: '-5%', width: '400px', height: '400px', borderRadius: '50%', background: `radial-gradient(circle,${t.teal}0a 0%,transparent 70%)`, pointerEvents: 'none', animation: 'orbFloat2 16s ease-in-out infinite', zIndex: 0 }} />

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

            <ESIMCard key={activeIndex} esim={esims[activeIndex]} logoUrl={logoUrl} index={activeIndex} total={esims.length} t={t} customDomain={customDomain} logoShareUrl={logoShareUrl || undefined} />

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

            <button onClick={handleReset}
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
        @keyframes spinSlow { to{transform:rotate(360deg);} }
        @keyframes ambientDot0 { 0%,100%{transform:translate(0,0);opacity:.35;}50%{transform:translate(6px,-8px);opacity:.65;} }
        @keyframes ambientDot1 { 0%,100%{transform:translate(0,0);opacity:.4;}50%{transform:translate(-8px,5px);opacity:.7;} }
        @keyframes ambientDot2 { 0%,100%{transform:translate(0,0);opacity:.3;}50%{transform:translate(5px,8px);opacity:.6;} }
        @keyframes orbFloat1 { 0%,100%{transform:translate(0,0);}33%{transform:translate(30px,-20px);}66%{transform:translate(-20px,30px);} }
        @keyframes orbFloat2 { 0%,100%{transform:translate(0,0);}50%{transform:translate(-40px,-30px);} }
        @keyframes iconBounce { 0%,100%{transform:translateY(0);}50%{transform:translateY(-8px);} }
        @keyframes fadeDown { from{opacity:0;transform:translateY(-10px);}to{opacity:1;transform:translateY(0);} }
        @keyframes shake { 0%,100%{transform:translateX(0);}25%{transform:translateX(-6px);}75%{transform:translateX(6px);} }
        @keyframes spin { to{transform:rotate(360deg);} }
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
