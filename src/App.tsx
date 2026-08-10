import { useState, useRef, useEffect, useCallback } from 'react'
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react'

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

// ── Indonesia background (light mode) ─────────────────────────────────────
function IndonesiaCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    let raf: number
    let t = 0
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)

    // Islands: orbit around a center point with sinusoidal bob
    const islands = [
      { cx: 0.15, cy: 0.25, r: 110, speed: 0.00018, phase: 0,    bobAmp: 18, bobFreq: 0.0007 },
      { cx: 0.72, cy: 0.15, r: 80,  speed: 0.00022, phase: 1.2,  bobAmp: 12, bobFreq: 0.0009 },
      { cx: 0.85, cy: 0.65, r: 95,  speed: 0.00015, phase: 2.4,  bobAmp: 20, bobFreq: 0.0006 },
      { cx: 0.35, cy: 0.80, r: 70,  speed: 0.00025, phase: 3.8,  bobAmp: 10, bobFreq: 0.001  },
      { cx: 0.55, cy: 0.45, r: 60,  speed: 0.0003,  phase: 5.0,  bobAmp: 8,  bobFreq: 0.0012 },
    ]

    // Wave lines flowing across screen
    const waves = Array.from({ length: 5 }, (_, i) => ({
      yRatio: 0.15 + i * 0.18,
      speed: 0.0008 + i * 0.0003,
      amp: 18 + i * 8,
      freq: 0.008 - i * 0.001,
      phase: i * 1.3,
      red: i % 2 === 0,
    }))

    // Flag ribbon particles (sinusoidal flutter)
    const flags = Array.from({ length: 8 }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      vx: 0.00008 + Math.random() * 0.00006,
      vy: (Math.random() - 0.5) * 0.00004,
      w: 80 + Math.random() * 60,
      phase: Math.random() * Math.PI * 2,
      alpha: 0.07 + Math.random() * 0.06,
      red: i % 2 === 0,
    }))

    const drawIsland = (x: number, y: number, s: number, shape: number) => {
      ctx.beginPath()
      if (shape === 0) {
        // Sumatra — long diagonal
        ctx.moveTo(x - s * 0.5, y + s * 0.05)
        ctx.bezierCurveTo(x - s * 0.2, y - s * 0.18, x + s * 0.2, y - s * 0.14, x + s * 0.5, y - s * 0.05)
        ctx.bezierCurveTo(x + s * 0.38, y + s * 0.16, x + s * 0.05, y + s * 0.2, x - s * 0.3, y + s * 0.14)
        ctx.closePath()
      } else if (shape === 1) {
        // Java — compact narrow
        ctx.moveTo(x - s * 0.48, y)
        ctx.bezierCurveTo(x - s * 0.3, y - s * 0.1, x + s * 0.1, y - s * 0.12, x + s * 0.48, y - s * 0.02)
        ctx.bezierCurveTo(x + s * 0.4, y + s * 0.1, x + s * 0.1, y + s * 0.12, x - s * 0.3, y + s * 0.08)
        ctx.closePath()
      } else if (shape === 2) {
        // Kalimantan — chunky blob
        ctx.moveTo(x, y - s * 0.45)
        ctx.bezierCurveTo(x + s * 0.38, y - s * 0.32, x + s * 0.48, y + s * 0.1, x + s * 0.3, y + s * 0.42)
        ctx.bezierCurveTo(x + s * 0.05, y + s * 0.5, x - s * 0.25, y + s * 0.42, x - s * 0.38, y + s * 0.1)
        ctx.bezierCurveTo(x - s * 0.45, y - s * 0.18, x - s * 0.22, y - s * 0.4, x, y - s * 0.45)
        ctx.closePath()
      } else if (shape === 3) {
        // Sulawesi — star-like irregular
        ctx.moveTo(x, y - s * 0.4)
        ctx.bezierCurveTo(x + s * 0.15, y - s * 0.1, x + s * 0.45, y - s * 0.05, x + s * 0.4, y + s * 0.2)
        ctx.bezierCurveTo(x + s * 0.2, y + s * 0.45, x - s * 0.1, y + s * 0.3, x - s * 0.35, y + s * 0.1)
        ctx.bezierCurveTo(x - s * 0.45, y - s * 0.15, x - s * 0.15, y - s * 0.35, x, y - s * 0.4)
        ctx.closePath()
      } else {
        // Papua — rough blob
        ctx.moveTo(x - s * 0.45, y - s * 0.05)
        ctx.bezierCurveTo(x - s * 0.1, y - s * 0.3, x + s * 0.3, y - s * 0.25, x + s * 0.48, y)
        ctx.bezierCurveTo(x + s * 0.35, y + s * 0.28, x + s * 0.0, y + s * 0.35, x - s * 0.35, y + s * 0.2)
        ctx.bezierCurveTo(x - s * 0.5, y + s * 0.1, x - s * 0.52, y + s * 0.02, x - s * 0.45, y - s * 0.05)
        ctx.closePath()
      }
    }

    const draw = () => {
      t++
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const W = canvas.width, H = canvas.height

      // ── Wave lines ──
      waves.forEach((w) => {
        ctx.beginPath()
        ctx.moveTo(0, H * w.yRatio)
        for (let x = 0; x <= W; x += 4) {
          const y = H * w.yRatio + Math.sin(x * w.freq + t * w.speed + w.phase) * w.amp
          ctx.lineTo(x, y)
        }
        ctx.strokeStyle = w.red ? 'rgba(206,17,38,0.12)' : 'rgba(180,195,215,0.18)'
        ctx.lineWidth = 1.5
        ctx.stroke()
      })

      // ── Flag ribbons ──
      flags.forEach((f) => {
        f.x += f.vx; f.y += f.vy
        if (f.x > 1.15) f.x = -0.1
        if (f.y < -0.1) f.y = 1.1
        if (f.y > 1.1) f.y = -0.1
        const fx = f.x * W, fy = f.y * H
        const segments = 12
        const segW = f.w / segments
        ctx.save()
        ctx.globalAlpha = f.alpha
        for (let i = 0; i < segments; i++) {
          const waveY = Math.sin(i * 0.7 + t * 0.04 + f.phase) * 5
          const sx = fx + i * segW
          // Red stripe
          ctx.fillStyle = '#CE1126'
          ctx.beginPath()
          ctx.rect(sx, fy + waveY - 6, segW + 0.5, 6)
          ctx.fill()
          // White stripe
          ctx.fillStyle = '#d0dae8'
          ctx.beginPath()
          ctx.rect(sx, fy + waveY, segW + 0.5, 6)
          ctx.fill()
        }
        ctx.restore()
      })

      // ── Island silhouettes ──
      islands.forEach((isl, idx) => {
        const angle = t * isl.speed + isl.phase
        const bob = Math.sin(t * isl.bobFreq) * isl.bobAmp
        const x = isl.cx * W + Math.cos(angle) * isl.r
        const y = isl.cy * H + Math.sin(angle * 0.7) * (isl.r * 0.4) + bob
        ctx.save()
        ctx.globalAlpha = 0.07 + Math.abs(Math.sin(t * 0.0005 + idx)) * 0.04
        ctx.rotate(Math.sin(t * 0.0002 + idx) * 0.15)
        const sz = 40 + Math.sin(t * 0.0003 + idx * 1.5) * 8
        drawIsland(x, y, sz, idx % 5)
        // Soft glow fill
        const grad = ctx.createRadialGradient(x, y, 0, x, y, sz * 1.2)
        grad.addColorStop(0, 'rgba(180,200,220,0.9)')
        grad.addColorStop(1, 'rgba(180,200,220,0)')
        ctx.fillStyle = grad
        ctx.fill()
        ctx.restore()
      })

      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])

  return <canvas ref={ref} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }} />
}

// ── Particle canvas background ─────────────────────────────────────────────
function ParticleCanvas({ teal, isDark }: { teal: string; isDark: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const tealRef = useRef(teal)
  tealRef.current = teal
  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    let raf: number
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)
    const N = 55
    const pts = Array.from({ length: N }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 1.8 + 0.4,
    }))
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const color = tealRef.current
      pts.forEach((p) => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0
      })
      pts.forEach((a, i) => {
        pts.slice(i + 1).forEach((b) => {
          const dx = a.x - b.x, dy = a.y - b.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 120) {
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.strokeStyle = color + Math.floor((1 - dist / 120) * 50).toString(16).padStart(2, '0')
            ctx.lineWidth = 0.7
            ctx.stroke()
          }
        })
        ctx.beginPath()
        ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2)
        ctx.fillStyle = color + '66'
        ctx.fill()
      })
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={ref} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, opacity: isDark ? 1 : 0.6 }} />
}

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
          style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '999px', border: 'none', background: mode === o.val ? t.teal : 'transparent', color: mode === o.val ? (t === DARK ? '#0a0f0d' : '#fff') : t.muted, fontSize: '12px', fontWeight: 600, fontFamily: 'Outfit, sans-serif', cursor: 'pointer', transition: 'all 0.25s', whiteSpace: 'nowrap' }}>
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
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy}
      style={{ background: copied ? t.teal : t.tealDim, border: `1px solid ${copied ? t.teal : t.teal + '55'}`, color: copied ? (isDarkColor(t.teal) ? '#fff' : '#fff') : t.teal, borderRadius: '7px', padding: '5px 12px', fontSize: '12px', fontFamily: 'Outfit, sans-serif', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '5px' }}>
      {copied
        ? <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Tersalin!</>
        : <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>Salin</>}
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
    setTimeout(() => setCopied(false), 2500)
  }
  return (
    <button onClick={copy}
      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', background: copied ? t.teal : `linear-gradient(135deg,${t.tealDim},${t.tealFaint})`, border: `1.5px solid ${copied ? t.teal : t.teal + '55'}`, borderRadius: '10px', color: copied ? '#fff' : t.teal, fontSize: '13px', fontWeight: 700, fontFamily: 'Outfit, sans-serif', cursor: 'pointer', transition: 'all 0.25s', letterSpacing: '-0.01em', boxShadow: copied ? `0 4px 20px ${t.teal}44` : 'none' }}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <span style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.muted }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '13px', color: t.text, wordBreak: 'break-all', flex: 1 }}>{value}</span>
        <CopyButton text={value} t={t} />
      </div>
    </div>
  )
}

// ── Install button ─────────────────────────────────────────────────────────
function InstallButton({ platform, url, icon, t }: { platform: string; url: string; icon: string; t: typeof DARK }) {
  const [hov, setHov] = useState(false)
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: hov ? t.tealDim : t.tealFaint, border: `1px solid ${hov ? t.teal + '66' : t.teal + '33'}`, borderRadius: '12px', textDecoration: 'none', color: t.text, transition: 'all 0.25s', cursor: 'pointer', transform: hov ? 'translateY(-2px)' : 'translateY(0)', boxShadow: hov ? `0 6px 20px ${t.teal}22` : 'none' }}>
      <span style={{ fontSize: '20px', lineHeight: 1 }}>{icon}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
        <span style={{ fontSize: '11px', color: t.muted, fontWeight: 400 }}>Pasang langsung di</span>
        <span style={{ fontSize: '14px', fontWeight: 600 }}>{platform}</span>
      </div>
      <svg style={{ marginLeft: 'auto', color: t.teal, opacity: hov ? 1 : 0.5, transition: 'all 0.25s', transform: hov ? 'translateX(3px)' : 'translateX(0)' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    </a>
  )
}

// ── eSIM card ──────────────────────────────────────────────────────────────
function ESIMCard({ esim, logoUrl, index, total, t, customDomain }: { esim: ESim; logoUrl: string | null; index: number; total: number; t: typeof DARK; customDomain?: string }) {
  const [mounted, setMounted] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'done' | 'fail'>('idle')
  const [linkCopied, setLinkCopied] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)

  const handleCopyLink = () => {
    copyText(buildShareUrl(esim.lpa, customDomain))
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2500)
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
      <div style={{ display: 'flex', justifyContent: 'center', padding: '28px 28px 16px', background: `linear-gradient(180deg,${t.teal}0d 0%,transparent 100%)`, position: 'relative' }}>
        {total > 1 && (
          <div style={{ position: 'absolute', top: '14px', right: '16px', background: t.tealDim, border: `1px solid ${t.teal}44`, borderRadius: '999px', padding: '3px 10px', fontSize: '11px', color: t.teal, fontWeight: 600 }}>
            #{index + 1} / {total}
          </div>
        )}
        <div style={{ position: 'relative' }}>
          {/* outer glow ring */}
          <div style={{ position: 'absolute', inset: '-14px', borderRadius: '24px', background: `radial-gradient(circle,${t.teal}22 0%,transparent 70%)`, animation: 'qrGlow 3s ease-in-out infinite', pointerEvents: 'none' }} />
          {/* rotating dashed ring */}
          <div style={{ position: 'absolute', inset: '-8px', borderRadius: '20px', border: `1.5px dashed ${t.teal}33`, animation: 'spinSlow 12s linear infinite', pointerEvents: 'none' }} />
          <div ref={canvasRef} style={{ background: '#ffffff', borderRadius: '16px', padding: '14px', boxShadow: `0 0 0 1.5px ${t.tealGlow}, 0 16px 48px rgba(0,0,0,0.3)`, position: 'relative', display: 'inline-block' }}>
            <QRCodeCanvas value={esim.lpa} size={180} level="H" imageSettings={logoUrl ? { src: logoUrl, width: 48, height: 48, excavate: true } : undefined} />
            {logoUrl && (
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '48px', height: '48px', borderRadius: '10px', background: '#fff', boxShadow: '0 0 0 3px #fff,0 2px 12px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', pointerEvents: 'none' }}>
                <img src={logoUrl} alt="logo" style={{ width: '38px', height: '38px', objectFit: 'contain' }} />
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
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '11px', background: linkCopied ? '#7c3aed' : 'rgba(124,58,237,0.08)', border: `1.5px solid ${linkCopied ? '#7c3aed' : 'rgba(124,58,237,0.3)'}`, borderRadius: '10px', color: linkCopied ? '#fff' : '#7c3aed', fontSize: '13px', fontWeight: 700, fontFamily: 'Outfit, sans-serif', cursor: 'pointer', transition: 'all 0.25s' }}
          onMouseEnter={(e) => { if (!linkCopied) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(124,58,237,0.14)' }}
          onMouseLeave={(e) => { if (!linkCopied) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(124,58,237,0.08)' }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px', background: t.infoBg, borderRadius: '12px', border: `1px solid ${t.borderSub}` }}>
          <InfoRow label="SM-DP+ Server" value={esim.smdp} t={t} />
          <div style={{ height: '1px', background: `linear-gradient(90deg,transparent,${t.border},transparent)` }} />
          <InfoRow label="Kode Aktivasi" value={esim.activationCode} t={t} />
        </div>
        <CopyAllButton esim={esim} t={t} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ flex: 1, height: '1px', background: `linear-gradient(90deg,transparent,${t.border})` }} />
          <span style={{ fontSize: '11px', color: t.dim, fontWeight: 500 }}>atau pasang tanpa scan</span>
          <div style={{ flex: 1, height: '1px', background: `linear-gradient(90deg,${t.border},transparent)` }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <InstallButton platform="iPhone / iPad" url={esim.iosUrl} icon="🍎" t={t} />
          <InstallButton platform="Android" url={esim.androidUrl} icon="🤖" t={t} />
        </div>
      </div>
    </div>
  )
}

function ActionBtn({ label, onClick, icon, t }: { label: string; onClick: () => void; icon: React.ReactNode; t: typeof DARK }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '9px', background: hov ? t.tealDim : t.tealFaint, border: `1px solid ${hov ? t.teal + '55' : t.teal + '33'}`, borderRadius: '10px', color: t.teal, fontSize: '12px', fontWeight: 600, fontFamily: 'Outfit, sans-serif', cursor: 'pointer', transition: 'all 0.2s', transform: hov ? 'translateY(-1px)' : 'translateY(0)', boxShadow: hov ? `0 4px 14px ${t.teal}22` : 'none' }}>
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
  const [logoUrl, setLogoUrl] = useState<string | null>(() => localStorage.getItem('esim_logo'))
  const [customDomain, setCustomDomain] = useState<string>(() => localStorage.getItem('esim_domain') || '')
  const [activeIndex, setActiveIndex] = useState(0)
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
    <div style={{ minHeight: '100vh', background: t.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', fontFamily: 'Outfit, sans-serif', transition: 'background 0.4s, color 0.4s', color: t.text, position: 'relative' }}>

      {/* backgrounds */}
      {isDark
        ? <ParticleCanvas key="dark" teal={t.teal} isDark={true} />
        : <IndonesiaCanvas key="light" />
      }

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
          <div style={{ transition: 'opacity 0.4s, transform 0.4s', opacity: inputMounted ? 1 : 0, transform: inputMounted ? 'translateY(0)' : 'translateY(20px)' }}>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{ fontSize: '42px', marginBottom: '12px', animation: 'iconBounce 3s ease-in-out infinite', display: 'inline-block' }}>📶</div>
              <h1 style={{ fontSize: '26px', fontWeight: 700, color: t.text, margin: '0 0 6px', letterSpacing: '-0.02em' }}>Buat Halaman eSIM</h1>
              <p style={{ fontSize: '14px', color: t.muted, margin: 0 }}>Satu atau banyak sekaligus — satu LPA per baris</p>
            </div>

            <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: '20px', overflow: 'hidden', boxShadow: t.shadow }}>
              <div style={{ height: '2px', background: `linear-gradient(90deg,transparent,${t.teal},transparent)`, animation: 'borderShimmer 3s ease-in-out infinite' }} />
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '12px', fontWeight: 500, color: t.muted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>String LPA</label>
                    <span style={{ fontSize: '11px', color: t.dim }}>satu per baris untuk bulk</span>
                  </div>
                  <textarea value={input} onChange={(e) => { setInput(e.target.value); setError('') }}
                    placeholder={'LPA:1$smdp.io$K2-33LG3J-Y9AJW\nLPA:1$smdp.io$K2-33LG3I-HYN5ZJ\nLPA:1$smdp.io$K2-33LG3D-1CKO1EH'}
                    rows={5}
                    style={{ background: t.inputBg, border: `1px solid ${error ? t.error : t.border}`, borderRadius: '10px', padding: '14px', color: t.text, fontFamily: 'DM Mono, monospace', fontSize: '12px', resize: 'vertical', outline: 'none', width: '100%', lineHeight: 1.9, transition: 'border-color 0.25s,box-shadow 0.25s', whiteSpace: 'pre', overflowX: 'auto', wordBreak: 'normal', overflowWrap: 'normal' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = t.teal; e.currentTarget.style.boxShadow = `0 0 0 3px ${t.teal}18` }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = error ? t.error : t.border; e.currentTarget.style.boxShadow = 'none' }} />
                  {error && <span style={{ fontSize: '12px', color: t.error, animation: 'shake 0.3s ease' }}>{error}</span>}
                </div>

                {/* Logo */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 500, color: t.muted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Logo QR <span style={{ color: t.dim, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opsional · tersimpan otomatis)</span>
                  </label>
                  <div onClick={() => fileRef.current?.click()}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', background: t.inputBg, border: `1px dashed ${t.border}`, borderRadius: '10px', cursor: 'pointer', transition: 'all 0.25s' }}
                    onMouseEnter={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = t.teal; el.style.background = t.tealFaint }}
                    onMouseLeave={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = t.border; el.style.background = t.inputBg }}>
                    {logoUrl ? (
                      <>
                        <img src={logoUrl} alt="logo" style={{ width: '36px', height: '36px', objectFit: 'contain', borderRadius: '6px', background: '#fff', padding: '2px' }} />
                        <span style={{ fontSize: '13px', color: t.text, flex: 1 }}>Logo terpilih — klik untuk ganti</span>
                        <button onClick={handleRemoveLogo} style={{ background: 'none', border: 'none', color: t.muted, cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: 0, transition: 'color 0.2s' }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = t.error)}
                          onMouseLeave={(e) => (e.currentTarget.style.color = t.muted)}>×</button>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: '22px' }}>🖼️</span>
                        <span style={{ fontSize: '13px', color: t.dim }}>Klik untuk upload logo toko</span>
                      </>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                </div>

                {/* Domain */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 500, color: t.muted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Domain <span style={{ color: t.dim, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(untuk link share · tersimpan otomatis)</span>
                  </label>
                  <input
                    value={customDomain}
                    onChange={(e) => { setCustomDomain(e.target.value); localStorage.setItem('esim_domain', e.target.value) }}
                    placeholder="esimbarcode.netlify.app"
                    style={{ background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: '10px', padding: '10px 14px', color: t.text, fontFamily: 'DM Mono, monospace', fontSize: '13px', outline: 'none', width: '100%', transition: 'border-color 0.2s' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = t.teal }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = t.border }}
                  />
                </div>

                <button onClick={handleGenerate} disabled={!input.trim()}
                  style={{ padding: '14px', background: input.trim() ? `linear-gradient(135deg,${t.teal},${isDark ? '#1fa876' : '#0550ae'})` : t.tealDim, color: input.trim() ? '#ffffff' : t.dim, border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 700, fontFamily: 'Outfit, sans-serif', cursor: input.trim() ? 'pointer' : 'not-allowed', transition: 'all 0.25s', boxShadow: input.trim() ? `0 4px 20px ${t.teal}44` : 'none' }}
                  onMouseEnter={(e) => { if (input.trim()) { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 8px 28px ${t.teal}55` } }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = input.trim() ? `0 4px 20px ${t.teal}44` : 'none' }}>
                  Buat Kartu eSIM →
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ── RESULT ── */
          <>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <h1 style={{ fontSize: '26px', fontWeight: 700, color: t.text, margin: '0 0 4px', letterSpacing: '-0.02em', animation: 'fadeDown 0.4s ease 0.05s both' }}>
                {esims.length === 1 ? 'Kartu eSIM Kamu' : `${esims.length} Kartu eSIM`}
              </h1>
              {skipped > 0 && <p style={{ fontSize: '12px', color: '#e08a52', margin: '4px 0 0' }}>{skipped} baris dilewati (format tidak valid)</p>}
            </div>

            {esims.length > 1 && (
              <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
                {esims.map((_, i) => (
                  <button key={i} onClick={() => setActiveIndex(i)}
                    style={{ flexShrink: 0, padding: '6px 14px', borderRadius: '999px', border: `1px solid ${activeIndex === i ? t.teal + '88' : t.border}`, background: activeIndex === i ? t.tealDim : 'transparent', color: activeIndex === i ? t.teal : t.muted, fontSize: '13px', fontWeight: 600, fontFamily: 'Outfit, sans-serif', cursor: 'pointer', transition: 'all 0.2s', boxShadow: activeIndex === i ? `0 0 14px ${t.teal}22` : 'none' }}>
                    eSIM #{i + 1}
                  </button>
                ))}
              </div>
            )}

            <ESIMCard key={activeIndex} esim={esims[activeIndex]} logoUrl={logoUrl} index={activeIndex} total={esims.length} t={t} customDomain={customDomain} />

            {esims.length > 1 && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                {(['← Sebelumnya', 'Berikutnya →'] as const).map((label, i) => {
                  const disabled = i === 0 ? activeIndex === 0 : activeIndex === esims.length - 1
                  return (
                    <button key={i} onClick={() => setActiveIndex((idx) => i === 0 ? Math.max(0, idx - 1) : Math.min(esims.length - 1, idx + 1))} disabled={disabled}
                      style={{ flex: 1, padding: '10px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '10px', color: disabled ? t.dim : t.muted, fontSize: '13px', fontFamily: 'Outfit, sans-serif', cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
                      onMouseEnter={(e) => { if (!disabled) { (e.currentTarget as HTMLButtonElement).style.borderColor = t.teal; (e.currentTarget as HTMLButtonElement).style.color = t.teal } }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = t.border; (e.currentTarget as HTMLButtonElement).style.color = disabled ? t.dim : t.muted }}>
                      {label}
                    </button>
                  )
                })}
              </div>
            )}

            <button onClick={handleReset}
              style={{ width: '100%', marginTop: '10px', padding: '10px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '10px', color: t.muted, fontSize: '13px', fontFamily: 'Outfit, sans-serif', cursor: 'pointer', transition: 'all 0.2s' }}
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
