import { useState, useRef, useCallback } from 'react';
import Head from 'next/head';

const PLATFORMS = [
  { key: 'instagram', label: 'Instagram', icon: '📸', on: true  },
  { key: 'facebook',  label: 'Facebook',  icon: '📘', on: true  },
  { key: 'tiktok',   label: 'TikTok',    icon: '🎵', on: true  },
  { key: 'twitter',  label: 'X/Twitter', icon: '🐦', on: false },
  { key: 'linkedin', label: 'LinkedIn',  icon: '💼', on: false },
  { key: 'pinterest',label: 'Pinterest', icon: '📌', on: false },
  { key: 'youtube',  label: 'YouTube',   icon: '▶️', on: false },
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
  { key: 'facebook',  icon: '📘', label: 'Facebook'  },
  { key: 'twitter',   icon: '🐦', label: 'X/Twitter' },
  { key: 'tiktok',   icon: '🎵', label: 'TikTok'    },
  { key: 'pinterest', icon: '📌', label: 'Pinterest' },
  { key: 'haraj',    icon: '🛒', label: 'حراج'       },
  { key: 'youtube',  icon: '▶️', label: 'YouTube'    },
];

const STEPS = [
  { id: 'dl',   label: 'جلب صورة المنتج',                ms: 2500  },
  { id: 'bg',   label: 'إزالة الخلفية البيضاء',           ms: 5000  },
  { id: 'ai',   label: 'توليد شخصية مهووس (Imagen 3)',    ms: 30000 },
  { id: 'comp', label: 'تركيب الصورة النهائية (Sharp)',    ms: 3500  },
  { id: 'crop', label: 'قص 5 مقاسات للمنصات',            ms: 4000  },
  { id: 'gem',  label: 'توليد الكابشن العربي (Gemini 2)', ms: 6000  },
];

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button className="copybtn" onClick={() => {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }}>
      {copied ? '✓ نُسخ' : 'نسخ'}
    </button>
  );
}

function dlDataUrl(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export default function Home() {
  const [url,        setUrl]        = useState('');
  const [product,    setProduct]    = useState(null);
  const [scraping,   setScraping]   = useState(false);
  const [imgB64,     setImgB64]     = useState(null);
  const [imgPrev,    setImgPrev]    = useState(null);
  const [pipe,       setPipe]       = useState({ running: false, cur: null, done: [] });
  const [campaign,   setCampaign]   = useState(null);
  const [error,      setError]      = useState(null);
  const [lightbox,   setLightbox]   = useState(null);
  const [plats,      setPlats]      = useState(Object.fromEntries(PLATFORMS.map(p => [p.key, p.on])));
  const [sched,      setSched]      = useState('');
  const [publishing, setPublishing] = useState(false);
  const [toast,      setToast]      = useState(null);
  const timerRef = useRef(null);
  const abortRef = useRef(null);

  const showToast = useCallback((msg, type = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  /* ── SCRAPE ─────────────────────────────────────────────── */
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
      showToast('✓ تم استخراج بيانات المنتج');
    } catch (e) { setError(e.message); }
    finally { setScraping(false); }
  }

  /* ── FILE UPLOAD ─────────────────────────────────────────── */
  function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => { setImgB64(ev.target.result); setImgPrev(ev.target.result); };
    r.readAsDataURL(f);
  }

  /* ── PROGRESS ANIMATION ──────────────────────────────────── */
  function startAnim() {
    let i = 0; const done = [];
    const tick = () => {
      if (i >= STEPS.length) return;
      setPipe({ running: true, cur: STEPS[i].id, done: [...done] });
      timerRef.current = setTimeout(() => { done.push(STEPS[i].id); i++; tick(); }, STEPS[i].ms);
    };
    tick();
  }
  function stopAnim() { clearTimeout(timerRef.current); }

  /* ── GENERATE ────────────────────────────────────────────── */
  async function generate() {
    if (!product && !imgB64) { setError('أدخل رابط منتج أو ارفع صورة أولاً'); return; }
    setError(null); setCampaign(null);
    startAnim();
    try {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const r = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          product:            product || { name: 'Luxury Perfume', brand: 'Mahwous', price: '', description: '', url: '' },
          productImageBase64: imgB64  || undefined,
          productImageUrl:    product?.imageUrl || undefined,
        }),
      });
      stopAnim();

      const ct = r.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        const txt = await r.text();
        throw new Error(`خطأ الخادم (${r.status}): ${txt.slice(0, 300)}`);
      }
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || `خطأ (${r.status})`);

      setPipe({ running: false, cur: null, done: STEPS.map(s => s.id) });
      setCampaign(d);
      showToast('🎉 تم توليد الحملة بنجاح!');
      setTimeout(() => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' }), 300);
    } catch (e) {
      stopAnim();
      setPipe({ running: false, cur: null, done: [] });
      if (e.name !== 'AbortError') setError(e.message);
    }
  }

  /* ── PUBLISH ─────────────────────────────────────────────── */
  async function publish() {
    if (!campaign) return;
    setPublishing(true);
    try {
      const r = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignData:      { product: product || {}, content: campaign.content, imageUrls: campaign.imageUrls },
          publishingOptions: { ...plats, scheduledTime: sched },
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      showToast('🚀 تم الإرسال إلى Make.com بنجاح!');
    } catch (e) { showToast(`❌ ${e.message}`, 'bad'); }
    finally { setPublishing(false); }
  }

  /* ── DOWNLOAD ZIP ────────────────────────────────────────── */
  async function downloadZip() {
    if (!campaign?.imageUrls) return;
    showToast('⏳ جاري تجهيز الملفات...');
    try {
      const JSZip = (await import('jszip')).default;
      const zip   = new JSZip();
      const folder = zip.folder('mahwous_campaign');

      for (const s of SIZES) {
        const dataUrl = campaign.imageUrls[s.key];
        if (!dataUrl) continue;
        const base64 = dataUrl.split(',')[1];
        if (base64) folder.file(`${s.label}_${s.dims}.jpg`, base64, { base64: true });
      }

      if (campaign.content?.captions) {
        let txt = `مهووس — حملة تسويقية\n${product?.name || ''}\n${'═'.repeat(40)}\n\n`;
        for (const [k, v] of Object.entries(campaign.content.captions)) {
          txt += `=== ${k.toUpperCase()} ===\n${v}\n\n`;
        }
        if (campaign.content.brand_story) {
          txt += `=== BRAND STORY ===\n${campaign.content.brand_story}\n`;
        }
        folder.file('captions.txt', txt);
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `mahwous_${campaign.campaignId}.zip`;
      a.click();
      showToast('✓ بدأ التحميل...');
    } catch (e) { showToast(`❌ ${e.message}`, 'bad'); }
  }

  /* ── RENDER ──────────────────────────────────────────────── */
  return (
    <>
      <Head>
        <title>مهووس — مدير حملات AI</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="أتمتة حملات التسويق للعطور الفاخرة" />
      </Head>

      <div className="wrap">

        {/* ══ HEADER ══════════════════════════════════════════ */}
        <header className="hdr">
          <span className="hdr-tag">MAHWOUS × AI CAMPAIGN DIRECTOR</span>
          <h1 className="hdr-title">مدير حملات <em>مهووس</em> الذكي</h1>
          <p className="hdr-sub">LUXURY PERFUME MARKETING AUTOMATION</p>
        </header>

        {/* ══ CARD 1 — URL ════════════════════════════════════ */}
        <div className="card">
          <div className="card-hdr">
            <div className="card-num">١</div>
            <h2 className="card-title">رابط المنتج</h2>
            <div className="card-line" />
          </div>
          <span className="lbl">أدخل رابط صفحة المنتج</span>
          <div className="row">
            <input
              className="inp" type="url"
              placeholder="https://mahwous.com/products/..."
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && scrape()}
              disabled={scraping || pipe.running}
            />
            <button
              className="btn btn-gold"
              onClick={scrape}
              disabled={scraping || pipe.running || !url.trim()}
            >
              {scraping ? '⏳ جاري...' : '🔍 استخراج'}
            </button>
          </div>

          {product && (
            <div className="pprev">
              {product.imageUrl && (
                <img
                  src={product.imageUrl}
                  className="pimg"
                  alt={product.name}
                  onError={e => { e.target.style.display = 'none'; }}
                />
              )}
              <div className="pgrid">
                <div className="pff">
                  <div className="pfl">المنتج</div>
                  <div className="pfv" style={{ color: 'var(--goldL)', fontSize: 15 }}>{product.name}</div>
                </div>
                <div>
                  <div className="pfl">السعر</div>
                  <div className="pfv">{product.price}</div>
                </div>
                <div>
                  <div className="pfl">البراند</div>
                  <div className="pfv">{product.brand}</div>
                </div>
                {product.description && (
                  <div className="pff">
                    <div className="pfl">الوصف</div>
                    <div className="pfv" style={{ fontSize: 12, color: 'var(--textM)', lineHeight: 1.5 }}>
                      {product.description.slice(0, 220)}{product.description.length > 220 ? '...' : ''}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ══ CARD 2 — UPLOAD ═════════════════════════════════ */}
        <div className="card">
          <div className="card-hdr">
            <div className="card-num">٢</div>
            <h2 className="card-title">رفع صورة المنتج (اختياري)</h2>
            <div className="card-line" />
          </div>
          <p style={{ fontSize: 12, color: 'var(--textM)', marginBottom: 14 }}>
            إذا لم تُجلب الصورة تلقائياً، ارفع صورة المنتج هنا — سيُزال الخلفية الأبيض تلقائياً.
          </p>
          <div
            className="uzone"
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) { const r = new FileReader(); r.onload = ev => { setImgB64(ev.target.result); setImgPrev(ev.target.result); }; r.readAsDataURL(f); }
            }}
          >
            <input type="file" accept="image/*" onChange={handleFile} />
            {imgPrev
              ? <div className="uprev">
                  <img src={imgPrev} alt="product" />
                  <div>
                    <div style={{ color: 'var(--gold)', fontSize: 13 }}>✓ تم الرفع</div>
                    <div style={{ fontSize: 11, color: 'var(--textM)', marginTop: 3 }}>انقر لتغيير الصورة</div>
                  </div>
                </div>
              : <>
                  <div style={{ fontSize: 28, marginBottom: 7 }}>📦</div>
                  <div style={{ fontSize: 13, color: 'var(--textS)' }}>اسحب وأفلت أو انقر للاختيار</div>
                  <div style={{ fontSize: 11, color: 'var(--textM)', marginTop: 5 }}>PNG · JPG · WEBP — الحد الأقصى 10MB</div>
                </>
            }
          </div>
        </div>

        {/* ══ GENERATE BUTTON ═════════════════════════════════ */}
        {(product || imgB64) && !pipe.running && !campaign && (
          <div className="btn-ctr">
            <button
              className="btn btn-gold btn-full"
              style={{ maxWidth: 400, padding: '16px 0', fontSize: 13, letterSpacing: 3 }}
              onClick={generate}
            >
              ✨ توليد الحملة الكاملة
            </button>
            <div style={{ fontSize: 11, color: 'var(--textM)', marginTop: 10 }}>
              ⏱ يستغرق التوليد من 60 إلى 90 ثانية — يُرجى الانتظار
            </div>
          </div>
        )}

        {/* ══ ERROR ═══════════════════════════════════════════ */}
        {error && (
          <div className="err">
            <strong>⚠️ خطأ: </strong>{error}
          </div>
        )}

        {/* ══ PROGRESS ════════════════════════════════════════ */}
        {pipe.running && (
          <div className="card">
            <div className="pbox">
              <div className="ptitle">🎨 جاري توليد الحملة...</div>
              <div className="pnote">يُرجى الانتظار — من 60 إلى 90 ثانية</div>
              <ul className="steps">
                {STEPS.map(s => {
                  const done   = pipe.done.includes(s.id);
                  const active = pipe.cur === s.id;
                  return (
                    <li key={s.id} className={`step${active ? ' active' : ''}${done ? ' done' : ''}`}>
                      <div className={`sdot${active ? ' spin' : ''}`}>
                        {done ? '✓' : active ? '◌' : '○'}
                      </div>
                      {s.label}
                    </li>
                  );
                })}
              </ul>
              <button
                className="btn btn-ghost"
                style={{ marginTop: 22, fontSize: 10, letterSpacing: 2 }}
                onClick={() => {
                  stopAnim();
                  abortRef.current?.abort();
                  setPipe({ running: false, cur: null, done: [] });
                  setError('تم إلغاء العملية');
                }}
              >✕ إلغاء</button>
            </div>
          </div>
        )}

        {/* ══ RESULTS ═════════════════════════════════════════ */}
        {campaign && (
          <div id="results">

            {/* Campaign badges */}
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <span className="badge">🎭 {campaign.meta?.outfit === 'thobe' ? 'ثوب سعودي + بشت' : 'بدلة سوداء فاخرة'}</span>
              <span className="badge">🏛 {campaign.meta?.sceneKey}</span>
              <span className="badge">🆔 {campaign.campaignId}</span>
            </div>

            {/* ── GALLERY ─────────────────────────────────── */}
            <div className="card">
              <div className="card-hdr">
                <div className="card-num">٣</div>
                <h2 className="card-title">معرض الصور — 5 مقاسات جاهزة</h2>
                <div className="card-line" />
              </div>
              <div className="gallery">
                {SIZES.map(s => {
                  const u = campaign.imageUrls[s.key];
                  if (!u) return null;
                  return (
                    <div key={s.key} className="gitem" onClick={() => setLightbox(u)}>
                      <img src={u} alt={s.label} loading="lazy" />
                      <div className="glabel">
                        {s.label}
                        <span className="gdims">{s.dims}</span>
                      </div>
                      <div
                        className="gdl"
                        onClick={e => { e.stopPropagation(); dlDataUrl(u, `mahwous_${s.label}_${s.dims}.jpg`); }}
                      >⬇</div>
                    </div>
                  );
                })}
              </div>

              {/* Transparent bottle preview */}
              {campaign.imageUrls.transparent && (
                <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: 'var(--textM)', letterSpacing: 1, fontFamily: 'Montserrat' }}>
                    زجاجة المنتج الشفافة:
                  </span>
                  <img
                    src={campaign.imageUrls.transparent}
                    style={{
                      height: 56, objectFit: 'contain', cursor: 'pointer', borderRadius: 2, padding: 3,
                      background: 'repeating-conic-gradient(#333 0% 25%,#444 0% 50%) 0 0/12px 12px',
                    }}
                    alt="transparent"
                    title="انقر للتحميل"
                    onClick={() => dlDataUrl(campaign.imageUrls.transparent, 'product_transparent.png')}
                  />
                </div>
              )}
            </div>

            {/* ── BRAND STORY ─────────────────────────────── */}
            {campaign.content?.brand_story && (
              <div className="card">
                <div className="card-hdr">
                  <div className="card-num">٤</div>
                  <h2 className="card-title">قصة العلامة التجارية</h2>
                  <div className="card-line" />
                </div>
                <div className="scard">
                  <div className="stext">{campaign.content.brand_story}</div>
                  <div className="sdiv" />
                  <div style={{ fontSize: 10, color: 'var(--textM)', letterSpacing: 2, fontFamily: 'Montserrat' }}>
                    MAHWOUS × {product?.brand?.toUpperCase() || 'LUXURY PERFUMES'}
                  </div>
                </div>
              </div>
            )}

            {/* ── CAPTIONS ────────────────────────────────── */}
            {campaign.content?.captions && (
              <div className="card">
                <div className="card-hdr">
                  <div className="card-num">٥</div>
                  <h2 className="card-title">كابشن المنصات</h2>
                  <div className="card-line" />
                </div>
                {campaign.content.gemini_error && (
                  <div style={{ fontSize: 11, color: 'var(--gold)', background: 'rgba(212,160,23,.07)', border: '1px solid var(--border)', borderRadius: 2, padding: '7px 13px', marginBottom: 13 }}>
                    ℹ️ استُخدم كابشن احتياطي — أضف GEMINI_API_KEY للكابشن المُخصَّص
                  </div>
                )}
                <div className="cgrid">
                  {CAPTIONS.map(({ key, icon, label }) => {
                    const text = campaign.content.captions[key];
                    if (!text) return null;
                    return (
                      <div key={key} className="ccard">
                        <CopyBtn text={text} />
                        <div className="cplat">
                          <span style={{ fontSize: 15 }}>{icon}</span>
                          <span className="cpname">{label}</span>
                        </div>
                        <div className="ctext">{text}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── PUBLISH ─────────────────────────────────── */}
            <div className="card">
              <div className="card-hdr">
                <div className="card-num">٦</div>
                <h2 className="card-title">النشر على المنصات</h2>
                <div className="card-line" />
              </div>

              <span className="lbl" style={{ marginBottom: 10 }}>اختر المنصات للنشر عبر Make.com</span>
              <div className="pgrd">
                {PLATFORMS.map(p => (
                  <label
                    key={p.key}
                    className={`pchk${plats[p.key] ? ' on' : ''}`}
                    onClick={() => setPlats(prev => ({ ...prev, [p.key]: !prev[p.key] }))}
                  >
                    <input type="checkbox" readOnly checked={!!plats[p.key]} />
                    <span style={{ fontSize: 14 }}>{p.icon}</span>
                    {p.label}
                    {plats[p.key] && <span style={{ marginRight: 'auto', fontSize: 10 }}>✓</span>}
                  </label>
                ))}
              </div>

              <div className="sch-row">
                <span style={{ fontSize: 11, color: 'var(--textM)', letterSpacing: 1, fontFamily: 'Montserrat' }}>
                  📅 جدولة النشر:
                </span>
                <input
                  type="datetime-local"
                  className="sch-inp"
                  value={sched}
                  onChange={e => setSched(e.target.value)}
                />
              </div>

              <div className="divider" />

              <div className="acts">
                <button className="btn btn-pub" onClick={publish} disabled={publishing}>
                  {publishing ? '⏳ جاري الإرسال...' : '🚀 نشر عبر Make.com'}
                </button>
                <button className="btn btn-out" onClick={downloadZip}>
                  ⬇️ تحميل كل الأصول (ZIP)
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => { setCampaign(null); setError(null); setPipe({ running: false, cur: null, done: [] }); }}
                >
                  ♻️ حملة جديدة
                </button>
              </div>
            </div>

          </div>
        )}

        {/* ══ FOOTER ══════════════════════════════════════════ */}
        <footer className="ftr">
          <div style={{ fontFamily: 'Cormorant Garamond', fontSize: 13, color: 'var(--textM)', letterSpacing: 3 }}>
            MAHWOUS AI CAMPAIGN DIRECTOR
          </div>
          <div style={{ fontSize: 10, color: 'var(--textM)', marginTop: 5, opacity: .5, letterSpacing: 1 }}>
            Vertex AI Imagen 3 · Gemini 2.0 Flash · Sharp · Make.com
          </div>
        </footer>
      </div>

      {/* ══ LIGHTBOX ════════════════════════════════════════ */}
      {lightbox && (
        <div className="lb" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="full size" onClick={e => e.stopPropagation()} />
          <div className="lb-btns">
            <button
              className="lb-btn"
              title="تحميل"
              onClick={e => { e.stopPropagation(); dlDataUrl(lightbox, 'mahwous_image.jpg'); }}
            >⬇</button>
            <button
              className="lb-btn"
              onClick={() => setLightbox(null)}
            >✕</button>
          </div>
        </div>
      )}

      {/* ══ TOAST ════════════════════════════════════════════ */}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  );
}
