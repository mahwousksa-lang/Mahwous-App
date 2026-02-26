import { useState, useRef, useCallback } from 'react';
import Head from 'next/head';

// ─────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────
const PLATFORMS = [
  { key: 'instagram', label: 'Instagram', icon: '📸', defaultOn: true },
  { key: 'facebook',  label: 'Facebook',  icon: '📘', defaultOn: true },
  { key: 'tiktok',   label: 'TikTok',    icon: '🎵', defaultOn: true },
  { key: 'twitter',  label: 'X / Twitter',icon: '🐦', defaultOn: false },
  { key: 'linkedin', label: 'LinkedIn',  icon: '💼', defaultOn: false },
  { key: 'pinterest',label: 'Pinterest', icon: '📌', defaultOn: false },
  { key: 'youtube',  label: 'YouTube',   icon: '▶️',  defaultOn: false },
  { key: 'whatsapp', label: 'WhatsApp',  icon: '💬', defaultOn: false },
];

const GALLERY_SIZES = [
  { key: 'story_9x16',     label: 'Story',        dims: '1080×1920', icon: '📱' },
  { key: 'vertical_4x5',  label: 'Feed Vertical', dims: '1080×1350', icon: '🖼' },
  { key: 'square_1x1',    label: 'Square',        dims: '1080×1080', icon: '⬜' },
  { key: 'landscape_16x9',label: 'Landscape',     dims: '1920×1080', icon: '🖥' },
  { key: 'pinterest_2x3', label: 'Pinterest',     dims: '1000×1500', icon: '📌' },
];

const CAPTION_CARDS = [
  { key: 'instagram', icon: '📸', label: 'Instagram' },
  { key: 'facebook',  icon: '📘', label: 'Facebook' },
  { key: 'twitter',   icon: '🐦', label: 'X / Twitter' },
  { key: 'tiktok',   icon: '🎵', label: 'TikTok' },
  { key: 'pinterest', icon: '📌', label: 'Pinterest' },
  { key: 'haraj',    icon: '🛒', label: 'حراج' },
  { key: 'youtube',  icon: '▶️',  label: 'YouTube' },
];

const PIPELINE_STEPS = [
  { id: 'download',  label: 'جلب صورة المنتج' },
  { id: 'removebg',  label: 'إزالة خلفية الصورة' },
  { id: 'imagen',    label: 'توليد شخصية مهووس (Vertex AI)' },
  { id: 'composite', label: 'تركيب الصورة النهائية (Sharp)' },
  { id: 'crops',     label: 'قص 5 مقاسات للمنصات' },
  { id: 'captions',  label: 'توليد الكابشن (Gemini AI)' },
];

// Realistic timing estimates per step (ms)
const STEP_DURATIONS = { download: 2000, removebg: 4000, imagen: 25000, composite: 3000, crops: 3000, captions: 5000 };

// ─────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────
function useToast() {
  const [toast, setToast] = useState(null);
  const show = useCallback((message, type = 'success', duration = 4000) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), duration);
  }, []);
  return { toast, show };
}

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return <button className="caption-copy-btn" onClick={handle}>{copied ? '✓ نُسخ' : 'نسخ'}</button>;
}

// ─────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────
export default function Home() {
  const [url, setUrl] = useState('');
  const [product, setProduct] = useState(null);
  const [scraping, setScraping] = useState(false);
  const [uploadedImageBase64, setUploadedImageBase64] = useState(null);
  const [uploadedImagePreview, setUploadedImagePreview] = useState(null);
  const [pipeline, setPipeline] = useState({ running: false, currentStep: null, completedSteps: [] });
  const [campaign, setCampaign] = useState(null);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [platforms, setPlatforms] = useState(Object.fromEntries(PLATFORMS.map(p => [p.key, p.defaultOn])));
  const [scheduledTime, setScheduledTime] = useState('');
  const [publishing, setPublishing] = useState(false);
  const { toast, show: showToast } = useToast();
  const stepTimerRef = useRef(null);

  // ── SCRAPE ─────────────────────────────────────────────
  const handleScrape = async () => {
    if (!url.trim()) return;
    setError(null);
    setProduct(null);
    setCampaign(null);
    setScraping(true);

    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل الاستخراج');
      setProduct(data.product);
      showToast('✓ تم استخراج بيانات المنتج بنجاح');
    } catch (err) {
      setError(`خطأ الاستخراج: ${err.message}`);
    } finally {
      setScraping(false);
    }
  };

  // ── FILE UPLOAD ────────────────────────────────────────
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setUploadedImageBase64(ev.target.result);
      setUploadedImagePreview(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  // ── STEP ANIMATION (visual only, doesn't block API) ────
  const runStepAnimation = useCallback(() => {
    const steps = PIPELINE_STEPS.map(s => s.id);
    let idx = 0;
    let elapsed = 0;
    const completedSteps = [];

    const tick = () => {
      if (idx >= steps.length) return;
      const stepId = steps[idx];
      const duration = STEP_DURATIONS[stepId] || 3000;
      setPipeline({ running: true, currentStep: stepId, completedSteps: [...completedSteps] });
      stepTimerRef.current = setTimeout(() => {
        completedSteps.push(stepId);
        idx++;
        tick();
      }, duration);
    };
    tick();
  }, []);

  // ── GENERATE ───────────────────────────────────────────
  const handleGenerate = async () => {
    if (!product && !uploadedImageBase64) {
      setError('يرجى إدخال رابط المنتج أولاً أو رفع صورة المنتج');
      return;
    }

    setError(null);
    setCampaign(null);

    // Start visual animation
    runStepAnimation();

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: product || { name: 'Luxury Perfume', brand: 'Mahwous', price: '', description: '', url: '' },
          productImageBase64: uploadedImageBase64 || undefined,
          productImageUrl: product?.imageUrl || undefined,
        }),
      });

      // Stop animation
      if (stepTimerRef.current) clearTimeout(stepTimerRef.current);

      // The critical fix: handle non-JSON responses gracefully
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const rawText = await res.text();
        throw new Error(`الخادم أرجع استجابة غير متوقعة (${res.status}): ${rawText.substring(0, 200)}`);
      }

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || `خطأ غير متوقع (${res.status})`);
      }

      setPipeline({ running: false, currentStep: null, completedSteps: PIPELINE_STEPS.map(s => s.id) });
      setCampaign(data);
      showToast('🎉 تم توليد الحملة بنجاح!');
      setTimeout(() => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' }), 300);

    } catch (err) {
      if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
      setPipeline({ running: false, currentStep: null, completedSteps: [] });
      setError(err.message || 'فشل توليد الحملة — تحقق من إعدادات الـ API');
    }
  };

  // ── PUBLISH ─────────────────────────────────────────────
  const handlePublish = async () => {
    if (!campaign) return;
    setPublishing(true);
    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignData: {
            product: product || {},
            content: campaign.content,
            imageUrls: campaign.imageUrls,
          },
          publishingOptions: { ...platforms, scheduledTime },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast('🚀 تم الإرسال إلى Make.com بنجاح!');
    } catch (err) {
      showToast(`❌ ${err.message}`, 'error');
    } finally {
      setPublishing(false);
    }
  };

  // ── DOWNLOAD ZIP ───────────────────────────────────────
  const handleDownloadZip = async () => {
    if (!campaign?.imageUrls) return;
    try {
      showToast('⏳ جاري تجهيز الملفات...');
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const folder = zip.folder(`mahwous_campaign_${campaign.campaignId}`);

      for (const sizeInfo of GALLERY_SIZES) {
        const imageUrl = campaign.imageUrls[sizeInfo.key];
        if (!imageUrl) continue;
        try {
          const response = await fetch(imageUrl);
          const arrayBuffer = await response.arrayBuffer();
          folder.file(`${sizeInfo.label}_${sizeInfo.dims}.jpg`, arrayBuffer);
        } catch { /* skip failed images */ }
      }

      if (campaign.content?.captions) {
        let txt = `مهووس — حملة تسويقية\nالمنتج: ${product?.name || ''}\n\n`;
        for (const [k, v] of Object.entries(campaign.content.captions)) {
          txt += `━━━ ${k.toUpperCase()} ━━━\n${v}\n\n`;
        }
        folder.file('captions_arabic.txt', txt);
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `mahwous_${campaign.campaignId}.zip`;
      a.click();
      showToast('✓ جاري التحميل...');
    } catch (err) {
      showToast(`❌ فشل التحميل: ${err.message}`, 'error');
    }
  };

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <>
      <Head>
        <title>مهووس — مدير حملات AI</title>
        <meta name="description" content="أداة أتمتة التسويق الفاخر للعطور" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="app-container">

        {/* ── HEADER ───────────────────────────────────── */}
        <header className="app-header">
          <div className="logo-glyph">MAHWOUS × AI DIRECTOR</div>
          <h1 className="app-title">مدير حملات <span>مهووس</span> الذكي</h1>
          <p className="app-subtitle">LUXURY PERFUME MARKETING AUTOMATION</p>
        </header>

        {/* ── SECTION 1: URL INPUT ─────────────────────── */}
        <section className="section">
          <div className="section-label">
            <div className="section-num">١</div>
            <h2 className="section-title">رابط المنتج</h2>
            <div className="section-line" />
          </div>

          <label className="input-label">رابط صفحة المنتج</label>
          <div className="url-input-row">
            <input
              type="url"
              className="luxury-input"
              placeholder="https://mahwous.com/products/..."
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleScrape()}
              disabled={scraping || pipeline.running}
            />
            <button
              className="btn btn-primary"
              onClick={handleScrape}
              disabled={scraping || pipeline.running || !url.trim()}
            >
              {scraping ? '⏳ جاري...' : '🔍 استخراج'}
            </button>
          </div>

          {/* Product Preview */}
          {product && (
            <div className="product-preview">
              {product.imageUrl && (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="product-preview-img"
                  onError={e => { e.target.style.display = 'none'; }}
                />
              )}
              <div className="product-info-grid">
                <div className="product-field full">
                  <div className="product-field-label">اسم المنتج</div>
                  <div className="product-field-value" style={{ fontSize: '15px', color: 'var(--gold-light)' }}>{product.name}</div>
                </div>
                <div className="product-field">
                  <div className="product-field-label">السعر</div>
                  <div className="product-field-value">{product.price}</div>
                </div>
                <div className="product-field">
                  <div className="product-field-label">البراند</div>
                  <div className="product-field-value">{product.brand}</div>
                </div>
                {product.description && (
                  <div className="product-field full">
                    <div className="product-field-label">الوصف</div>
                    <div className="product-field-value" style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                      {product.description.substring(0, 200)}{product.description.length > 200 ? '...' : ''}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ── SECTION 2: UPLOAD OVERRIDE ──────────────── */}
        <section className="section">
          <div className="section-label">
            <div className="section-num">٢</div>
            <h2 className="section-title">رفع صورة المنتج (اختياري)</h2>
            <div className="section-line" />
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
            إذا لم تُجلب الصورة تلقائياً، ارفعها هنا. سيُزال الخلفية الأبيض تلقائياً.
          </p>
          <div
            className="upload-area"
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = ev => { setUploadedImageBase64(ev.target.result); setUploadedImagePreview(ev.target.result); };
                reader.readAsDataURL(file);
              }
            }}
          >
            <input type="file" accept="image/*" onChange={handleFileUpload} />
            {uploadedImagePreview ? (
              <div className="upload-preview">
                <img src={uploadedImagePreview} alt="Product" />
                <div>
                  <div style={{ color: 'var(--gold)', fontSize: '13px', marginBottom: '4px' }}>✓ تم رفع الصورة</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>انقر لتغيير الصورة</div>
                </div>
              </div>
            ) : (
              <>
                <span className="upload-icon">📦</span>
                <div className="upload-text">اسحب وأفلت صورة المنتج هنا، أو انقر للاختيار</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>PNG, JPG, WEBP — الحد الأقصى 10MB</div>
              </>
            )}
          </div>
        </section>

        {/* ── GENERATE BUTTON ──────────────────────────── */}
        {(product || uploadedImageBase64) && !pipeline.running && !campaign && (
          <div style={{ textAlign: 'center', margin: '4px 0 20px' }}>
            <button
              className="btn btn-primary"
              style={{ padding: '16px 52px', fontSize: '13px', letterSpacing: '3px' }}
              onClick={handleGenerate}
            >
              ✨ توليد الحملة الكاملة
            </button>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px' }}>
              ⏱ التوليد قد يستغرق 45-60 ثانية — يُرجى الانتظار
            </div>
          </div>
        )}

        {/* ── ERROR BOX ────────────────────────────────── */}
        {error && (
          <div className="error-box">
            <strong>⚠️ </strong>{error}
          </div>
        )}

        {/* ── PIPELINE PROGRESS ────────────────────────── */}
        {pipeline.running && (
          <section className="section">
            <div className="pipeline-progress">
              <div className="progress-title">🎨 جاري توليد الحملة...</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '24px' }}>
                يُرجى الانتظار — قد يستغرق التوليد من 45 إلى 90 ثانية
              </div>
              <ul className="progress-steps">
                {PIPELINE_STEPS.map(step => {
                  const isDone = pipeline.completedSteps.includes(step.id);
                  const isActive = pipeline.currentStep === step.id;
                  return (
                    <li key={step.id} className={`progress-step ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}>
                      <div className={`step-icon ${isActive ? 'spinning' : ''}`}>
                        {isDone ? '✓' : isActive ? '◌' : '○'}
                      </div>
                      {step.label}
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        )}

        {/* ── RESULTS ──────────────────────────────────── */}
        {campaign && (
          <div id="results">

            {/* Meta */}
            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
              <span className="meta-badge">🎭 {campaign.meta?.outfit === 'thobe' ? 'ثوب + بشت' : 'بدلة سوداء'}</span>
              <span className="meta-badge">🏛 {campaign.meta?.sceneKey}</span>
              <span className="meta-badge">📸 {campaign.campaignId}</span>
            </div>

            {/* ── GALLERY ────────────────────────────── */}
            <section className="section">
              <div className="section-label">
                <div className="section-num">٣</div>
                <h2 className="section-title">معرض الصور — 5 مقاسات</h2>
                <div className="section-line" />
              </div>
              <div className="gallery-grid">
                {GALLERY_SIZES.map(size => {
                  const imgUrl = campaign.imageUrls[size.key];
                  if (!imgUrl) return null;
                  return (
                    <div key={size.key} className="gallery-item" onClick={() => setSelectedImage(imgUrl)}>
                      <img src={imgUrl} alt={size.label} loading="lazy" />
                      <div className="gallery-item-label">
                        {size.icon} {size.label}
                        <span className="gallery-dims">{size.dims}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {campaign.imageUrls.transparent && (
                <div style={{ marginTop: '14px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '1px', fontFamily: 'Montserrat' }}>المنتج الشفاف:</div>
                  <img
                    src={campaign.imageUrls.transparent}
                    alt="Transparent product"
                    style={{ height: '56px', objectFit: 'contain', background: 'repeating-conic-gradient(#333 0% 25%, #444 0% 50%) 0 0 / 12px 12px', borderRadius: '2px', padding: '4px' }}
                  />
                </div>
              )}
            </section>

            {/* ── BRAND STORY ────────────────────────── */}
            {campaign.content?.brand_story && (
              <section className="section">
                <div className="section-label">
                  <div className="section-num">٤</div>
                  <h2 className="section-title">قصة العلامة التجارية</h2>
                  <div className="section-line" />
                </div>
                <div className="brand-story-card">
                  <div className="brand-story-text">{campaign.content.brand_story}</div>
                  <div className="brand-story-divider" />
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '2px', fontFamily: 'Montserrat' }}>
                    MAHWOUS × {product?.brand?.toUpperCase() || 'LUXURY'}
                  </div>
                </div>
              </section>
            )}

            {/* ── CAPTIONS ───────────────────────────── */}
            {campaign.content?.captions && (
              <section className="section">
                <div className="section-label">
                  <div className="section-num">٥</div>
                  <h2 className="section-title">كابشن المنصات</h2>
                  <div className="section-line" />
                </div>
                {campaign.content.gemini_error && (
                  <div style={{ fontSize: '11px', color: 'var(--gold)', background: 'rgba(212,160,23,0.08)', border: '1px solid var(--border)', borderRadius: '2px', padding: '8px 14px', marginBottom: '14px' }}>
                    ℹ️ Gemini استخدم كابشن احتياطي — تحقق من GEMINI_API_KEY
                  </div>
                )}
                <div className="captions-grid">
                  {CAPTION_CARDS.map(({ key, icon, label }) => {
                    const text = campaign.content.captions[key];
                    if (!text) return null;
                    return (
                      <div key={key} className="caption-card">
                        <CopyBtn text={text} />
                        <div className="caption-platform">
                          <span className="platform-icon">{icon}</span>
                          <span className="platform-name">{label}</span>
                        </div>
                        <div className="caption-text">{text}</div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── PUBLISH ────────────────────────────── */}
            <section className="section">
              <div className="section-label">
                <div className="section-num">٦</div>
                <h2 className="section-title">النشر على المنصات</h2>
                <div className="section-line" />
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                اختر المنصات التي تريد النشر عليها عبر Make.com:
              </div>

              <div className="platform-grid">
                {PLATFORMS.map(p => (
                  <label
                    key={p.key}
                    className={`platform-checkbox ${platforms[p.key] ? 'checked' : ''}`}
                    onClick={() => setPlatforms(prev => ({ ...prev, [p.key]: !prev[p.key] }))}
                  >
                    <input type="checkbox" readOnly checked={!!platforms[p.key]} />
                    <span className="platform-check-icon">{p.icon}</span>
                    {p.label}
                    {platforms[p.key] && <span style={{ marginRight: 'auto', fontSize: '10px' }}>✓</span>}
                  </label>
                ))}
              </div>

              <div className="schedule-row">
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '1px', fontFamily: 'Montserrat' }}>📅 جدولة:</span>
                <input
                  type="datetime-local"
                  className="schedule-input"
                  value={scheduledTime}
                  onChange={e => setScheduledTime(e.target.value)}
                />
              </div>

              <div className="gold-divider" style={{ margin: '18px 0' }} />

              <div className="actions-row">
                <button className="btn btn-publish" onClick={handlePublish} disabled={publishing}>
                  {publishing ? '⏳ جاري الإرسال...' : '🚀 نشر عبر Make.com'}
                </button>
                <button className="btn btn-outline" onClick={handleDownloadZip}>
                  ⬇️ تحميل كل الأصول (ZIP)
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => { setCampaign(null); setError(null); setPipeline({ running: false, currentStep: null, completedSteps: [] }); }}
                >
                  ♻️ حملة جديدة
                </button>
              </div>
            </section>

          </div>
        )}

        {/* FOOTER */}
        <footer style={{ textAlign: 'center', padding: '36px 0 44px', borderTop: '1px solid var(--border)', marginTop: '28px' }}>
          <div style={{ fontFamily: 'Cormorant Garamond', fontSize: '14px', color: 'var(--text-muted)', letterSpacing: '3px' }}>
            MAHWOUS AI CAMPAIGN DIRECTOR
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px', opacity: 0.5, letterSpacing: '1px' }}>
            Vertex AI Imagen 3 · Gemini 2.0 · Sharp · Make.com
          </div>
        </footer>
      </div>

      {/* LIGHTBOX */}
      {selectedImage && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.93)', zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out', padding: '20px' }}
          onClick={() => setSelectedImage(null)}
        >
          <img
            src={selectedImage}
            alt="Full size"
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' }}
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setSelectedImage(null)}
            style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', width: '38px', height: '38px', borderRadius: '50%', cursor: 'pointer', fontSize: '18px' }}
          >×</button>
        </div>
      )}

      {/* TOAST */}
      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}
    </>
  );
}
