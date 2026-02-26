import { useState, useRef, useCallback } from 'react';
import Head from 'next/head';

const PLATFORMS = [
  { key: 'instagram', label: 'Instagram', icon: '📸', on: true },
  { key: 'facebook',  label: 'Facebook',  icon: '📘', on: true },
  { key: 'tiktok',   label: 'TikTok',    icon: '🎵', on: true },
  { key: 'twitter',  label: 'X/Twitter', icon: '🐦', on: false },
  { key: 'linkedin', label: 'LinkedIn',  icon: '💼', on: false },
  { key: 'pinterest',label: 'Pinterest', icon: '📌', on: false },
  { key: 'youtube',  label: 'YouTube',   icon: '▶️',  on: false },
  { key: 'whatsapp', label: 'WhatsApp',  icon: '💬', on: false },
];

const SIZES = [
  { key: 'story_9x16',     label: 'Story',     dims: '1080×1920' },
  { key: 'vertical_4x5',  label: 'Vertical',  dims: '1080×1350' },
  { key: 'square_1x1',    label: 'Square',    dims: '1080×1080' },
  { key: 'landscape_16x9',label: 'Landscape', dims: '1920×1080' },
  { key: 'pinterest_2x3', label: 'Pinterest', dims: '1000×1500' },
];

const CAPTIONS = [
  { key: 'instagram', icon: '📸', label: 'Instagram' },
  { key: 'facebook',  icon: '📘', label: 'Facebook' },
  { key: 'twitter',   icon: '🐦', label: 'X/Twitter' },
  { key: 'tiktok',   icon: '🎵', label: 'TikTok' },
  { key: 'pinterest', icon: '📌', label: 'Pinterest' },
  { key: 'haraj',    icon: '🛒', label: 'حراج' },
  { key: 'youtube',  icon: '▶️',  label: 'YouTube' },
];

const STEPS = [
  { id: 'dl',   label: 'جلب صورة المنتج',          ms: 2000 },
  { id: 'bg',   label: 'إزالة الخلفية',              ms: 5000 },
  { id: 'ai',   label: 'توليد شخصية مهووس (Imagen 3)', ms: 28000 },
  { id: 'comp', label: 'تركيب الصورة (Sharp)',       ms: 3000 },
  { id: 'crop', label: 'قص 5 مقاسات',               ms: 3000 },
  { id: 'gem',  label: 'توليد الكابشن (Gemini)',      ms: 6000 },
];

function useToast() {
  const [t, setT] = useState(null);
  const show = useCallback((msg, type = 'ok', ms = 4000) => {
    setT({ msg, type });
    setTimeout(() => setT(null), ms);
  }, []);
  return { t, show };
}

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button className="copy-btn" onClick={() => {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }}>{copied ? '✓ نُسخ' : 'نسخ'}</button>
  );
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [product, setProduct] = useState(null);
  const [scraping, setScraping] = useState(false);
  const [imgB64, setImgB64] = useState(null);
  const [imgPrev, setImgPrev] = useState(null);
  const [pipeState, setPipeState] = useState({ running: false, cur: null, done: [] });
  const [campaign, setCampaign] = useState(null);
  const [error, setError] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [plats, setPlats] = useState(Object.fromEntries(PLATFORMS.map(p => [p.key, p.on])));
  const [sched, setSched] = useState('');
  const [publishing, setPublishing] = useState(false);
  const { t: toast, show } = useToast();
  const timerRef = useRef(null);

  // ── SCRAPE ─────────────────────────────────────────
  async function scrape() {
    if (!url.trim()) return;
    setError(null); setProduct(null); setCampaign(null); setScraping(true);
    try {
      const r = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'فشل الاستخراج');
      setProduct(d.product);
      show('✓ تم استخراج بيانات المنتج');
    } catch (e) { setError(e.message); }
    finally { setScraping(false); }
  }

  // ── UPLOAD ─────────────────────────────────────────
  function handleFile(e) {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => { setImgB64(ev.target.result); setImgPrev(ev.target.result); };
    reader.readAsDataURL(f);
  }

  // ── PROGRESS ANIMATION ─────────────────────────────
  function startAnim() {
    let i = 0; const done = [];
    function tick() {
      if (i >= STEPS.length) return;
      setPipeState({ running: true, cur: STEPS[i].id, done: [...done] });
      timerRef.current = setTimeout(() => {
        done.push(STEPS[i].id); i++;
        tick();
      }, STEPS[i]?.ms || 3000);
    }
    tick();
  }

  // ── GENERATE ───────────────────────────────────────
  async function generate() {
    if (!product && !imgB64) { setError('أدخل رابط منتج أو ارفع صورة أولاً'); return; }
    setError(null); setCampaign(null);
    startAnim();

    try {
      const r = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: product || { name: 'Luxury Perfume', brand: 'Mahwous', price: '', description: '', url: '' },
          productImageBase64: imgB64 || undefined,
          productImageUrl: product?.imageUrl || undefined,
        }),
      });

      clearTimeout(timerRef.current);

      // Safe JSON parse — fixes "Unexpected end of JSON" error
      const ct = r.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        const txt = await r.text();
        throw new Error(`خطأ خادم (${r.status}): ${txt.slice(0, 300)}`);
      }

      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || `خطأ (${r.status})`);

      setPipeState({ running: false, cur: null, done: STEPS.map(s => s.id) });
      setCampaign(d);
      show('🎉 تم توليد الحملة بنجاح!');
      setTimeout(() => document.getElementById('res')?.scrollIntoView({ behavior: 'smooth' }), 300);
    } catch (e) {
      clearTimeout(timerRef.current);
      setPipeState({ running: false, cur: null, done: [] });
      setError(e.message);
    }
  }

  // ── PUBLISH ────────────────────────────────────────
  async function publish() {
    if (!campaign) return; setPublishing(true);
    try {
      const r = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignData: { product: product || {}, content: campaign.content, imageUrls: campaign.imageUrls }, publishingOptions: { ...plats, scheduledTime: sched } }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      show('🚀 تم الإرسال إلى Make.com!');
    } catch (e) { show(`❌ ${e.message}`, 'err-t'); }
    finally { setPublishing(false); }
  }

  // ── DOWNLOAD ZIP ───────────────────────────────────
  async function downloadZip() {
    if (!campaign?.imageUrls) return;
    show('⏳ جاري التجهيز...');
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const folder = zip.folder('mahwous_campaign');
      for (const s of SIZES) {
        const u = campaign.imageUrls[s.key]; if (!u) continue;
        try { const ab = await (await fetch(u)).arrayBuffer(); folder.file(`${s.label}_${s.dims}.jpg`, ab); } catch {}
      }
      if (campaign.content?.captions) {
        let txt = `مهووس — حملة\n${product?.name || ''}\n\n`;
        for (const [k, v] of Object.entries(campaign.content.captions)) txt += `=== ${k.toUpperCase()} ===\n${v}\n\n`;
        folder.file('captions.txt', txt);
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `mahwous_${campaign.campaignId}.zip`;
      a.click();
      show('✓ جاري التحميل...');
    } catch (e) { show(`❌ ${e.message}`, 'err-t'); }
  }

  // ── RENDER ─────────────────────────────────────────
  return (
    <>
      <Head>
        <title>مهووس — مدير حملات AI</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="container">

        {/* HEADER */}
        <header className="header">
          <span className="logo-tag">MAHWOUS × AI DIRECTOR</span>
          <h1 className="main-title">مدير حملات <em>مهووس</em> الذكي</h1>
          <p className="subtitle">LUXURY PERFUME MARKETING AUTOMATION</p>
        </header>

        {/* CARD 1 — URL */}
        <div className="card">
          <div className="card-header">
            <div className="card-num">١</div>
            <h2 className="card-title">رابط المنتج</h2>
            <div className="card-line" />
          </div>
          <span className="lbl">رابط صفحة المنتج</span>
          <div className="input-row">
            <input className="input" type="url" placeholder="https://mahwous.com/products/..." value={url}
              onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && scrape()}
              disabled={scraping || pipeState.running} />
            <button className="btn btn-gold" onClick={scrape} disabled={scraping || pipeState.running || !url.trim()}>
              {scraping ? '⏳ جاري...' : '🔍 استخراج'}
            </button>
          </div>
          {product && (
            <div className="product-preview">
              {product.imageUrl && <img src={product.imageUrl} className="product-img" onError={e => e.target.style.display = 'none'} alt="" />}
              <div className="product-grid">
                <div className="pf-full"><div className="pf-label">المنتج</div><div className="pf-value" style={{ color: 'var(--gold-light)', fontSize: 15 }}>{product.name}</div></div>
                <div><div className="pf-label">السعر</div><div className="pf-value">{product.price}</div></div>
                <div><div className="pf-label">البراند</div><div className="pf-value">{product.brand}</div></div>
                {product.description && <div className="pf-full"><div className="pf-label">الوصف</div><div className="pf-value" style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{product.description.slice(0, 200)}{product.description.length > 200 ? '...' : ''}</div></div>}
              </div>
            </div>
          )}
        </div>

        {/* CARD 2 — UPLOAD */}
        <div className="card">
          <div className="card-header">
            <div className="card-num">٢</div>
            <h2 className="card-title">رفع صورة المنتج (اختياري)</h2>
            <div className="card-line" />
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 13 }}>
            إذا لم تُجلب الصورة تلقائياً، ارفعها هنا — سيُزال الخلفية الأبيض تلقائياً.
          </p>
          <div className="upload-zone" onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { const r = new FileReader(); r.onload = ev => { setImgB64(ev.target.result); setImgPrev(ev.target.result); }; r.readAsDataURL(f); } }}>
            <input type="file" accept="image/*" onChange={handleFile} />
            {imgPrev
              ? <div className="upload-prev"><img src={imgPrev} alt="product" /><div><div style={{ color: 'var(--gold)', fontSize: 13 }}>✓ تم الرفع</div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>انقر لتغيير</div></div></div>
              : <><div style={{ fontSize: 26, marginBottom: 6 }}>📦</div><div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>اسحب وأفلت أو انقر للاختيار</div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>PNG · JPG · WEBP — max 10MB</div></>
            }
          </div>
        </div>

        {/* GENERATE BUTTON */}
        {(product || imgB64) && !pipeState.running && !campaign && (
          <div style={{ textAlign: 'center', margin: '4px 0 20px' }}>
            <button className="btn btn-gold btn-full" style={{ maxWidth: 360, padding: '15px 0', fontSize: 13, letterSpacing: 3 }} onClick={generate}>
              ✨ توليد الحملة الكاملة
            </button>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 9 }}>⏱ يستغرق التوليد من 45 إلى 90 ثانية</div>
          </div>
        )}

        {/* ERROR */}
        {error && <div className="err"><strong>⚠️ </strong>{error}</div>}

        {/* PROGRESS */}
        {pipeState.running && (
          <div className="card">
            <div className="progress-box">
              <div className="progress-title">🎨 جاري التوليد...</div>
              <div className="progress-note">يُرجى الانتظار — من 45 إلى 90 ثانية</div>
              <ul className="steps">
                {STEPS.map(s => {
                  const done = pipeState.done.includes(s.id);
                  const active = pipeState.cur === s.id;
                  return (
                    <li key={s.id} className={`step ${active ? 'active' : ''} ${done ? 'done' : ''}`}>
                      <div className={`step-dot ${active ? 'spin' : ''}`}>{done ? '✓' : active ? '◌' : '○'}</div>
                      {s.label}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        {/* RESULTS */}
        {campaign && <div id="res">

          {/* badges */}
          <div style={{ textAlign: 'center', marginBottom: 10 }}>
            <span className="badge">🎭 {campaign.meta?.outfit === 'thobe' ? 'ثوب + بشت' : 'بدلة سوداء'}</span>
            <span className="badge">🏛 {campaign.meta?.sceneKey}</span>
          </div>

          {/* GALLERY */}
          <div className="card">
            <div className="card-header">
              <div className="card-num">٣</div>
              <h2 className="card-title">معرض الصور — 5 مقاسات</h2>
              <div className="card-line" />
            </div>
            <div className="gallery">
              {SIZES.map(s => {
                const u = campaign.imageUrls[s.key]; if (!u) return null;
                return (
                  <div key={s.key} className="gitem" onClick={() => setLightbox(u)}>
                    <img src={u} alt={s.label} loading="lazy" />
                    <div className="glabel">{s.label}<span className="gdims">{s.dims}</span></div>
                  </div>
                );
              })}
            </div>
            {campaign.imageUrls.transparent && (
              <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1, fontFamily: 'Montserrat' }}>الزجاجة الشفافة:</span>
                <img src={campaign.imageUrls.transparent} style={{ height: 52, objectFit: 'contain', background: 'repeating-conic-gradient(#333 0% 25%,#444 0% 50%) 0 0/12px 12px', borderRadius: 2, padding: 3 }} alt="transparent" />
              </div>
            )}
          </div>

          {/* BRAND STORY */}
          {campaign.content?.brand_story && (
            <div className="card">
              <div className="card-header">
                <div className="card-num">٤</div>
                <h2 className="card-title">قصة العلامة التجارية</h2>
                <div className="card-line" />
              </div>
              <div className="story-card">
                <div className="story-text">{campaign.content.brand_story}</div>
                <div className="story-div" />
                <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 2, fontFamily: 'Montserrat' }}>
                  MAHWOUS × {product?.brand?.toUpperCase() || 'LUXURY'}
                </div>
              </div>
            </div>
          )}

          {/* CAPTIONS */}
          {campaign.content?.captions && (
            <div className="card">
              <div className="card-header">
                <div className="card-num">٥</div>
                <h2 className="card-title">كابشن المنصات</h2>
                <div className="card-line" />
              </div>
              {campaign.content.gemini_error && (
                <div style={{ fontSize: 11, color: 'var(--gold)', background: 'rgba(212,160,23,.07)', border: '1px solid var(--border)', borderRadius: 2, padding: '7px 13px', marginBottom: 13 }}>
                  ℹ️ تحقق من GEMINI_API_KEY
                </div>
              )}
              <div className="captions">
                {CAPTIONS.map(({ key, icon, label }) => {
                  const text = campaign.content.captions[key]; if (!text) return null;
                  return (
                    <div key={key} className="ccard">
                      <CopyBtn text={text} />
                      <div className="cplat"><span className="picon">{icon}</span><span className="pname">{label}</span></div>
                      <div className="ctext">{text}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* PUBLISH */}
          <div className="card">
            <div className="card-header">
              <div className="card-num">٦</div>
              <h2 className="card-title">النشر على المنصات</h2>
              <div className="card-line" />
            </div>
            <div className="plat-grid">
              {PLATFORMS.map(p => (
                <label key={p.key} className={`pchk ${plats[p.key] ? 'on' : ''}`} onClick={() => setPlats(prev => ({ ...prev, [p.key]: !prev[p.key] }))}>
                  <input type="checkbox" readOnly checked={!!plats[p.key]} />
                  <span>{p.icon}</span>{p.label}
                  {plats[p.key] && <span style={{ marginRight: 'auto', fontSize: 10 }}>✓</span>}
                </label>
              ))}
            </div>
            <div className="sch-row">
              <span style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 1, fontFamily: 'Montserrat' }}>📅 جدولة:</span>
              <input type="datetime-local" className="sch-input" value={sched} onChange={e => setSched(e.target.value)} />
            </div>
            <div className="divider" />
            <div className="actions">
              <button className="btn btn-publish" onClick={publish} disabled={publishing}>
                {publishing ? '⏳ جاري...' : '🚀 نشر عبر Make.com'}
              </button>
              <button className="btn btn-outline" onClick={downloadZip}>⬇️ تحميل ZIP</button>
              <button className="btn btn-ghost" onClick={() => { setCampaign(null); setError(null); setPipeState({ running: false, cur: null, done: [] }); }}>
                ♻️ حملة جديدة
              </button>
            </div>
          </div>

        </div>}

        <footer className="footer">
          <div style={{ fontFamily: 'Cormorant Garamond', fontSize: 13, color: 'var(--text-muted)', letterSpacing: 3 }}>MAHWOUS AI CAMPAIGN DIRECTOR</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 5, opacity: .5, letterSpacing: 1 }}>Vertex AI Imagen 3 · Gemini 2.0 · Sharp · Make.com</div>
        </footer>
      </div>

      {/* LIGHTBOX */}
      {lightbox && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.93)', zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out', padding: 20 }} onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="full" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' }} onClick={e => e.stopPropagation()} />
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 20, right: 20, background: 'transparent', border: '1px solid rgba(255,255,255,.3)', color: '#fff', width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>
      )}

      {/* TOAST */}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  );
}
