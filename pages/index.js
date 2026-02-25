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
  { key: 'story_9x16',     label: 'Story',       dims: '1080×1920', icon: '📱' },
  { key: 'vertical_4x5',  label: 'Feed Vertical',dims: '1080×1350', icon: '🖼' },
  { key: 'square_1x1',    label: 'Square',       dims: '1080×1080', icon: '⬜' },
  { key: 'landscape_16x9',label: 'Landscape',    dims: '1920×1080', icon: '🖥' },
  { key: 'pinterest_2x3', label: 'Pinterest',    dims: '1000×1500', icon: '📌' },
];

const CAPTION_CARDS = [
  { key: 'instagram',icon: '📸', label: 'Instagram' },
  { key: 'facebook', icon: '📘', label: 'Facebook' },
  { key: 'twitter',  icon: '🐦', label: 'X / Twitter' },
  { key: 'tiktok',  icon: '🎵', label: 'TikTok' },
  { key: 'pinterest',icon: '📌', label: 'Pinterest' },
  { key: 'haraj',   icon: '🛒', label: 'حراج' },
  { key: 'youtube', icon: '▶️',  label: 'YouTube' },
];

const PIPELINE_STEPS = [
  { id: 'scrape',    label: 'استخراج بيانات المنتج' },
  { id: 'removebg',  label: 'إزالة خلفية الصورة' },
  { id: 'imagen',   label: 'توليد شخصية مهووس (Vertex AI)' },
  { id: 'composite',label: 'تركيب الصورة النهائية (Sharp)' },
  { id: 'crops',    label: 'قص 5 مقاسات للمنصات' },
  { id: 'captions', label: 'توليد الكابشن (Gemini AI)' },
];

// ─────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────
function useToast() {
  const [toast, setToast] = useState(null);
  const show = useCallback((message, type = 'success', duration = 3500) => {
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
  // ── State ──────────────────────────────────────────────
  const [url, setUrl] = useState('');
  const [product, setProduct] = useState(null);
  const [uploadedImageBase64, setUploadedImageBase64] = useState(null);
  const [uploadedImagePreview, setUploadedImagePreview] = useState(null);
  const [pipeline, setPipeline] = useState({ running: false, step: null, done: [] });
  const [campaign, setCampaign] = useState(null);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [platforms, setPlatforms] = useState(
    Object.fromEntries(PLATFORMS.map(p => [p.key, p.defaultOn]))
  );
  const [scheduledTime, setScheduledTime] = useState('');
  const [publishing, setPublishing] = useState(false);
  const { toast, show: showToast } = useToast();

  const fileInputRef = useRef();

  // ── Scrape ─────────────────────────────────────────────
  const handleScrape = async () => {
    if (!url.trim()) return;
    setError(null);
    setProduct(null);
    setCampaign(null);
    setPipeline({ running: true, step: 'scrape', done: [] });

    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProduct(data.product);
      setPipeline({ running: false, step: null, done: [] });
      showToast('✓ تم استخراج بيانات المنتج بنجاح');
    } catch (err) {
      setError(err.message);
      setPipeline({ running: false, step: null, done: [] });
    }
  };

  // ── File upload ────────────────────────────────────────
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

  // ── Generate Campaign ──────────────────────────────────
  const handleGenerate = async () => {
    if (!product && !uploadedImageBase64) {
      setError('يرجى إدخال رابط المنتج أو رفع صورة المنتج');
      return;
    }
    setError(null);
    setCampaign(null);

    const steps = ['removebg', 'imagen', 'composite', 'crops', 'captions'];
    let doneSteps = [];

    // Simulate step progression
    const advanceStep = (stepId) => {
      setPipeline({ running: true, step: stepId, done: [...doneSteps] });
    };
    const completeStep = (stepId) => {
      doneSteps = [...doneSteps, stepId];
      setPipeline({ running: true, step: null, done: doneSteps });
    };

    setPipeline({ running: true, step: 'removebg', done: [] });

    try {
      // We call the single /api/generate endpoint
      // It handles all steps internally
      // We simulate step progression on the frontend with timeouts
      const stepTimer = (delay, stepId) =>
        new Promise((resolve) => setTimeout(() => { advanceStep(stepId); resolve(); }, delay));

      // Start generation (non-blocking)
      const genPromise = fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: product || { name: 'Product', price: '', description: '', imageUrl: null },
          productImageBase64: uploadedImageBase64 || undefined,
          productImageUrl: product?.imageUrl || undefined,
        }),
      });

      // Simulate steps with visual progression
      await stepTimer(2000, 'imagen');
      completeStep('removebg');
      await stepTimer(4000, 'composite');
      completeStep('imagen');
      await stepTimer(2500, 'crops');
      completeStep('composite');
      await stepTimer(1500, 'captions');
      completeStep('crops');

      // Wait for actual API response
      const res = await genPromise;
      completeStep('captions');
      doneSteps = steps;
      setPipeline({ running: false, step: null, done: steps });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setCampaign(data);
      showToast('🎉 تم توليد الحملة بنجاح!');

      // Scroll to results
      setTimeout(() => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' }), 300);
    } catch (err) {
      setError(err.message || 'فشل توليد الحملة');
      setPipeline({ running: false, step: null, done: [] });
    }
  };

  // ── Publish to Make.com ────────────────────────────────
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

  // ── Download ZIP ───────────────────────────────────────
  const handleDownloadZip = async () => {
    if (!campaign?.imageUrls) return;
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const folder = zip.folder(`mahwous_campaign_${campaign.campaignId}`);

      // Download each image and add to zip
      for (const sizeInfo of GALLERY_SIZES) {
        const imageUrl = campaign.imageUrls[sizeInfo.key];
        if (!imageUrl) continue;
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        folder.file(`${sizeInfo.label}_${sizeInfo.dims}.jpg`, arrayBuffer);
      }

      // Add captions as text file
      if (campaign.content?.captions) {
        let captionText = `مهووس — حملة تسويقية\nالمنتج: ${product?.name || ''}\n\n`;
        for (const [platform, caption] of Object.entries(campaign.content.captions)) {
          captionText += `━━━ ${platform.toUpperCase()} ━━━\n${caption}\n\n`;
        }
        folder.file('captions.txt', captionText);
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(content);
      a.download = `mahwous_campaign_${Date.now()}.zip`;
      a.click();
      showToast('⬇️ جاري تحميل الملفات...');
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
        <meta name="description" content="أداة أتمتة التسويق الفاخر للعطور — Mahwous AI Campaign Director" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌟</text></svg>" />
      </Head>

      <div className="app-container">

        {/* ── HEADER ───────────────────────────────────── */}
        <header className="app-header">
          <div className="logo-glyph">MAHWOUS × AI DIRECTOR</div>
          <h1 className="app-title">
            مدير حملات <span>مهووس</span> الذكي
          </h1>
          <p className="app-subtitle">LUXURY PERFUME MARKETING AUTOMATION</p>
        </header>

        {/* ── SECTION 1: URL SCRAPER ───────────────────── */}
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
              placeholder="https://mahwousstore.com/product/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleScrape()}
              disabled={pipeline.running}
            />
            <button
              className="btn btn-primary"
              onClick={handleScrape}
              disabled={pipeline.running || !url.trim()}
            >
              {pipeline.step === 'scrape' ? '⏳ جاري...' : '🔍 استخراج'}
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
                  onError={(e) => { e.target.style.display = 'none'; }}
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
                <div className="product-field full">
                  <div className="product-field-label">الوصف</div>
                  <div className="product-field-value" style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                    {product.description?.substring(0, 200)}{product.description?.length > 200 ? '...' : ''}
                  </div>
                </div>
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

          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            إذا فشل الاستخراج التلقائي، ارفع صورة المنتج مباشرة. سيتم إزالة الخلفية البيضاء تلقائياً.
          </p>

          <div
            className="upload-area"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
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
          <div style={{ textAlign: 'center', margin: '8px 0 24px' }}>
            <button className="btn btn-primary" style={{ padding: '16px 48px', fontSize: '13px', letterSpacing: '3px' }} onClick={handleGenerate}>
              ✨ توليد الحملة الكاملة
            </button>
          </div>
        )}

        {/* ── ERROR BOX ────────────────────────────────── */}
        {error && (
          <div className="error-box">
            <strong>⚠️ خطأ: </strong>{error}
          </div>
        )}

        {/* ── PIPELINE PROGRESS ────────────────────────── */}
        {pipeline.running && (
          <section className="section">
            <div className="pipeline-progress">
              <div className="progress-title">🎨 جاري توليد الحملة...</div>
              <ul className="progress-steps">
                {PIPELINE_STEPS.map((step) => {
                  const isDone = pipeline.done.includes(step.id);
                  const isActive = pipeline.step === step.id;
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

            {/* Meta badges */}
            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
              <span className="meta-badge">🎭 {campaign.meta?.outfit === 'thobe' ? 'ثوب سعودي + بشت' : 'بدلة سوداء + ربطة عنق ذهبية'}</span>
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
                {GALLERY_SIZES.map((size) => {
                  const imgUrl = campaign.imageUrls[size.key];
                  if (!imgUrl) return null;
                  return (
                    <div
                      key={size.key}
                      className="gallery-item"
                      onClick={() => setSelectedImage(imgUrl)}
                    >
                      <img src={imgUrl} alt={size.label} loading="lazy" />
                      <div className="gallery-item-label">
                        {size.icon} {size.label}
                        <span className="gallery-dims">{size.dims}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Transparent product PNG preview */}
              {campaign.imageUrls.transparent && (
                <div style={{ marginTop: '16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '1px' }}>المنتج الشفاف:</div>
                  <img
                    src={campaign.imageUrls.transparent}
                    alt="Transparent product"
                    style={{ height: '60px', objectFit: 'contain', background: 'repeating-conic-gradient(#333 0% 25%, #444 0% 50%) 0 0 / 12px 12px', borderRadius: '2px' }}
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
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '2px', fontFamily: 'Montserrat' }}>
                    MAHWOUS × {product?.brand?.toUpperCase()}
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

            {/* ── PUBLISH SECTION ────────────────────── */}
            <section className="section">
              <div className="section-label">
                <div className="section-num">٦</div>
                <h2 className="section-title">النشر على المنصات</h2>
                <div className="section-line" />
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                اختر المنصات التي تريد النشر عليها:
              </div>

              <div className="platform-grid">
                {PLATFORMS.map((p) => (
                  <label
                    key={p.key}
                    className={`platform-checkbox ${platforms[p.key] ? 'checked' : ''}`}
                    onClick={() => setPlatforms(prev => ({ ...prev, [p.key]: !prev[p.key] }))}
                  >
                    <input type="checkbox" readOnly checked={!!platforms[p.key]} />
                    <span className="platform-check-icon">{p.icon}</span>
                    {p.label}
                    {platforms[p.key] && <span style={{ marginRight: 'auto', fontSize: '11px' }}>✓</span>}
                  </label>
                ))}
              </div>

              <div className="schedule-row">
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '1px', fontFamily: 'Montserrat' }}>
                  📅 جدولة النشر:
                </span>
                <input
                  type="datetime-local"
                  className="schedule-input"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  (اتركه فارغاً للنشر الفوري)
                </span>
              </div>

              <div className="gold-divider" style={{ margin: '20px 0' }} />

              <div className="actions-row">
                <button
                  className="btn btn-publish"
                  onClick={handlePublish}
                  disabled={publishing}
                >
                  {publishing ? '⏳ جاري الإرسال...' : '🚀 نشر عبر Make.com'}
                </button>

                <button
                  className="btn btn-outline"
                  onClick={handleDownloadZip}
                >
                  ⬇️ تحميل كل الأصول (ZIP)
                </button>

                <button
                  className="btn btn-ghost"
                  onClick={() => { setCampaign(null); setPipeline({ running: false, step: null, done: [] }); }}
                >
                  ♻️ حملة جديدة
                </button>
              </div>
            </section>

          </div>
        )}

        {/* ── FOOTER ───────────────────────────────────── */}
        <footer style={{ textAlign: 'center', padding: '40px 0 48px', borderTop: '1px solid var(--border)', marginTop: '32px' }}>
          <div style={{ fontFamily: 'Cormorant Garamond', fontSize: '15px', color: 'var(--text-muted)', letterSpacing: '3px' }}>
            MAHWOUS AI CAMPAIGN DIRECTOR
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', opacity: 0.5, letterSpacing: '1px' }}>
            Powered by Vertex AI Imagen 3 · Gemini 2.0 · Sharp · Make.com
          </div>
        </footer>
      </div>

      {/* ── LIGHTBOX ─────────────────────────────────────── */}
      {selectedImage && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 900,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out', padding: '20px',
          }}
          onClick={() => setSelectedImage(null)}
        >
          <img
            src={selectedImage}
            alt="Full size"
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '2px', boxShadow: '0 0 60px rgba(0,0,0,0.8)' }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setSelectedImage(null)}
            style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', fontSize: '20px' }}
          >
            ×
          </button>
        </div>
      )}

      {/* ── TOAST ────────────────────────────────────────── */}
      {toast && (
        <div className={`toast ${toast.type}`}>{toast.message}</div>
      )}
    </>
  );
}
