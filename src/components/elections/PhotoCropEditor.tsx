import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Crop, ImagePlus, Loader2, Minus, Move, Plus, RotateCcw, Save, X } from 'lucide-react';
import { prepareCandidatePhoto, type EditedPhoto, type PhotoCrop } from '../../lib/generalElections';

// Candidate photo editor: circular crop, drag to move, pinch / wheel / slider to zoom, live
// preview, save / cancel / change photo. Produces an 800×800 JPEG (the displayed photo), the
// original (only when a new picture was chosen) and the crop position to edit it again later.

const NAVY = '#29244C';
const PINK = '#F6B4A6';
const OUT = 800;
const MAX_ZOOM = 5;

type Source = { kind: 'file'; file: File } | { kind: 'url'; url: string };

interface Loaded { img: HTMLImageElement; w: number; h: number; original: Blob | null; objectUrl: string | null }

const loadUrl = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = 'anonymous'; // the canvas must stay exportable
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('LOAD'));
  // A distinct URL: never reuse a copy cached without CORS.
  img.src = `${url}${url.includes('?') ? '&' : '?'}edit=${Date.now()}`;
});

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Keeps the crop circle fully inside the picture. */
const clampCrop = (c: PhotoCrop, w: number, h: number): PhotoCrop => {
  const zoom = clamp(c.zoom, 1, MAX_ZOOM);
  const side = Math.min(w, h) / zoom; // visible square, in original pixels
  const hx = side / 2 / w;
  const hy = side / 2 / h;
  return { zoom, x: clamp(c.x, hx, 1 - hx), y: clamp(c.y, hy, 1 - hy) };
};

/** Picture placement inside a square of `size` px for a crop position. */
const placement = (c: PhotoCrop, w: number, h: number, size: number) => {
  const scale = (size / Math.min(w, h)) * c.zoom;
  return { width: w * scale, height: h * scale, left: size / 2 - c.x * w * scale, top: size / 2 - c.y * h * scale, scale };
};

export const PhotoCropEditor = ({ source: initialSource, initialCrop, title = 'تعديل الصورة الشخصية', onCancel, onSave }: {
  source: File | string;
  initialCrop?: PhotoCrop | null;
  title?: string;
  onCancel: () => void;
  onSave: (photo: EditedPhoto) => Promise<void> | void;
}) => {
  const [source, setSource] = useState<Source>(() => (typeof initialSource === 'string' ? { kind: 'url', url: initialSource } : { kind: 'file', file: initialSource }));
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState('');
  const [crop, setCrop] = useState<PhotoCrop>({ x: 0.5, y: 0.5, zoom: 1 });
  const [stage, setStage] = useState(320);
  const [saving, setSaving] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const firstLoad = useRef(true);

  // Load / decode the picture (new file: converted to a JPEG original of at most 2000 px).
  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;
    setLoaded(null); setError('');
    (async () => {
      try {
        let img: HTMLImageElement; let original: Blob | null = null;
        if (source.kind === 'file') {
          original = await prepareCandidatePhoto(source.file);
          objectUrl = URL.createObjectURL(original);
          img = await loadUrl(objectUrl).catch(async () => {
            const i = new Image(); i.src = objectUrl!; await i.decode(); return i;
          });
        } else {
          img = await loadUrl(source.url);
        }
        if (!alive) return;
        const w = img.naturalWidth, h = img.naturalHeight;
        if (!w || !h) throw new Error('EMPTY');
        setLoaded({ img, w, h, original, objectUrl });
        const start = firstLoad.current && initialCrop ? initialCrop : { x: 0.5, y: 0.5, zoom: 1 };
        firstLoad.current = false;
        setCrop(clampCrop(start, w, h));
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error && err.message.length > 12 ? err.message
          : source.kind === 'url' ? 'تعذّر تحميل الصورة الحالية. اختر صورة جديدة.' : 'تعذّرت قراءة هذه الصورة. اختر صورة أخرى بصيغة JPG أو PNG.');
      }
    })();
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [source]); // eslint-disable-line react-hooks/exhaustive-deps -- initialCrop only applies to the first picture

  // Square stage that follows the available width (phone / computer).
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setStage(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape' && !saving) onCancel(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onCancel, saving]);

  const update = useCallback((fn: (c: PhotoCrop) => PhotoCrop) => {
    setCrop(c => (loaded ? clampCrop(fn(c), loaded.w, loaded.h) : c));
  }, [loaded]);

  const setZoom = (z: number) => update(c => ({ ...c, zoom: z }));

  // Drag with one finger / the mouse; pinch with two fingers.
  const onPointerDown = (ev: React.PointerEvent) => {
    if (!loaded) return;
    try { (ev.currentTarget as Element).setPointerCapture(ev.pointerId); } catch { /* pointer already gone */ }
    pointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: crop.zoom };
    }
  };
  const onPointerMove = (ev: React.PointerEvent) => {
    const prev = pointers.current.get(ev.pointerId);
    if (!prev || !loaded) return;
    const next = { x: ev.clientX, y: ev.clientY };
    pointers.current.set(ev.pointerId, next);
    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current.dist > 0) setZoom(pinch.current.zoom * (dist / pinch.current.dist));
      return;
    }
    const { scale } = placement(crop, loaded.w, loaded.h, stage);
    const dx = next.x - prev.x, dy = next.y - prev.y;
    update(c => ({ ...c, x: c.x - dx / (loaded.w * scale), y: c.y - dy / (loaded.h * scale) }));
  };
  const onPointerUp = (ev: React.PointerEvent) => {
    pointers.current.delete(ev.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };
  const onWheel = (ev: React.WheelEvent) => { ev.preventDefault(); setZoom(crop.zoom * Math.exp(-ev.deltaY * 0.0015)); };
  const onKeyDown = (ev: React.KeyboardEvent) => {
    const step = 0.02 / crop.zoom;
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (moves[ev.key]) { ev.preventDefault(); update(c => ({ ...c, x: c.x + moves[ev.key][0], y: c.y + moves[ev.key][1] })); }
    if (ev.key === '+' || ev.key === '=') setZoom(crop.zoom * 1.1);
    if (ev.key === '-') setZoom(crop.zoom / 1.1);
  };

  const save = async () => {
    if (!loaded || saving) return;
    setSaving(true); setError('');
    try {
      const c = clampCrop(crop, loaded.w, loaded.h);
      const side = Math.min(loaded.w, loaded.h) / c.zoom;
      const canvas = document.createElement('canvas');
      canvas.width = OUT; canvas.height = OUT;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('CANVAS');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, OUT, OUT);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(loaded.img, c.x * loaded.w - side / 2, c.y * loaded.h - side / 2, side, side, 0, 0, OUT, OUT);
      const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.85));
      if (!blob) throw new Error('EXPORT');
      await onSave({ crop: blob, original: loaded.original, params: { x: +c.x.toFixed(4), y: +c.y.toFixed(4), zoom: +c.zoom.toFixed(3) } });
    } catch (err) {
      setError(err instanceof Error && err.message.length > 12 ? err.message : 'تعذّر حفظ الصورة. أعد المحاولة.');
    } finally {
      setSaving(false);
    }
  };

  const view = (size: number) => {
    if (!loaded) return null;
    const p = placement(crop, loaded.w, loaded.h, size);
    return <img src={loaded.img.src} alt="" draggable={false} className="absolute max-w-none select-none pointer-events-none"
      style={{ width: p.width, height: p.height, left: p.left, top: p.top }} />;
  };

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm" dir="rtl" onClick={() => !saving && onCancel()}>
      <div onClick={ev => ev.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}
        className="w-full sm:max-w-[440px] max-h-[96dvh] overflow-y-auto bg-white dark:bg-slate-900 rounded-t-[28px] sm:rounded-[28px] shadow-2xl">
        <div className="px-5 py-4 flex items-center justify-between text-white rounded-t-[28px]" style={{ background: NAVY }}>
          <h3 className="font-black text-lg flex items-center gap-2"><Crop className="w-5 h-5" style={{ color: PINK }} /> {title}</h3>
          <button onClick={onCancel} disabled={saving} aria-label="إغلاق" className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* Stage: picture under a circular window */}
          <div ref={stageRef} tabIndex={0} onKeyDown={onKeyDown} aria-label="منطقة القص: اسحب لتحريك الصورة، واستعمل إصبعين أو عجلة الفأرة للتكبير"
            className="relative w-full aspect-square rounded-3xl overflow-hidden touch-none select-none cursor-grab active:cursor-grabbing outline-none focus-visible:ring-4"
            style={{ background: NAVY }}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel}>
            {view(stage)}
            {loaded && (
              <div className="absolute inset-0 rounded-full pointer-events-none" style={{ boxShadow: `0 0 0 9999px rgba(41,36,76,0.72)`, border: `3px solid ${PINK}` }} />
            )}
            {!loaded && !error && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/80 text-sm font-bold"><Loader2 className="w-8 h-8 animate-spin" style={{ color: PINK }} /> جارٍ تجهيز الصورة…</div>}
            {error && !loaded && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white text-sm font-bold text-center px-6"><AlertCircle className="w-8 h-8" style={{ color: PINK }} /> {error}</div>}
            {loaded && <span className="absolute bottom-2 inset-x-0 mx-auto w-fit px-3 py-1 rounded-full bg-black/40 text-white text-xs font-bold flex items-center gap-1 pointer-events-none"><Move className="w-3.5 h-3.5" /> اسحب لتحريك الصورة</span>}
          </div>

          {/* Zoom */}
          <div className="flex items-center gap-3" dir="ltr">
            <button onClick={() => setZoom(crop.zoom / 1.15)} disabled={!loaded || crop.zoom <= 1} aria-label="تصغير" className="w-10 h-10 shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center disabled:opacity-40"><Minus className="w-5 h-5" /></button>
            <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={crop.zoom} disabled={!loaded} onChange={ev => setZoom(Number(ev.target.value))}
              aria-label="التكبير" className="flex-1 h-2" style={{ accentColor: NAVY }} />
            <button onClick={() => setZoom(crop.zoom * 1.15)} disabled={!loaded || crop.zoom >= MAX_ZOOM} aria-label="تكبير" className="w-10 h-10 shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center disabled:opacity-40"><Plus className="w-5 h-5" /></button>
          </div>

          {/* Live preview */}
          <div className="flex items-center justify-between gap-3 p-3 rounded-2xl" style={{ background: '#FDF0EC' }}>
            <div className="flex items-center gap-3">
              {[72, 44].map(size => (
                <span key={size} className="relative shrink-0 rounded-full overflow-hidden bg-white" style={{ width: size, height: size, boxShadow: `0 0 0 3px ${PINK}` }}>
                  {view(size)}
                </span>
              ))}
              <span className="text-xs font-bold leading-relaxed" style={{ color: NAVY }}>معاينة مباشرة<br /><span className="font-medium opacity-70">كما ستظهر في البطاقات</span></span>
            </div>
            <button onClick={() => setCrop(c => (loaded ? clampCrop({ x: 0.5, y: 0.5, zoom: 1 }, loaded.w, loaded.h) : c))} disabled={!loaded}
              className="px-3 py-2 rounded-xl bg-white text-xs font-black flex items-center gap-1 disabled:opacity-40" style={{ color: NAVY }}>
              <RotateCcw className="w-3.5 h-3.5" /> توسيط
            </button>
          </div>

          {error && loaded && <p className="text-sm font-bold text-red-600 flex items-start gap-1.5"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}</p>}

          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={ev => {
            const f = ev.target.files?.[0]; ev.target.value = '';
            if (f) setSource({ kind: 'file', file: f });
          }} />
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => fileRef.current?.click()} disabled={saving}
              className="py-3 rounded-2xl font-black text-sm bg-slate-100 dark:bg-slate-800 text-[#29244C] dark:text-white flex items-center justify-center gap-1.5 disabled:opacity-50">
              <ImagePlus className="w-4 h-4" /> تغيير الصورة
            </button>
            <button onClick={onCancel} disabled={saving}
              className="py-3 rounded-2xl font-bold text-sm bg-slate-100 dark:bg-slate-800 disabled:opacity-50">إلغاء</button>
            <button onClick={() => void save()} disabled={!loaded || saving}
              className="col-span-2 py-3.5 rounded-2xl font-black text-white flex items-center justify-center gap-2 disabled:opacity-50" style={{ background: NAVY }}>
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" style={{ color: PINK }} />} {saving ? 'جارٍ الحفظ…' : 'حفظ الصورة'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
