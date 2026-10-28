import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { makeMatrix, type Ecc } from "./qr";
import {
  drawQr,
  renderEyeSvg,
  renderSvg,
  type EyeId,
  type QrDesign,
  type StyleId,
} from "./render";
import { DEFAULT_DESIGN, EYE_IDS, SAMPLE, STYLE_IDS, randomDesign } from "./presets";
import { dict, type Lang } from "./i18n";

const ECC_LEVELS: Ecc[] = ["L", "M", "Q", "H"];
const REPO_URL = "https://github.com/httcup/qraft";

/** 二维码指向的地址：线上用当前页面地址，本地开发时指向正式站点。 */
const SCAN_URL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(
  typeof location === "undefined" ? "" : location.hostname,
)
  ? "https://qr.139t.cn"
  : location.href.split("#")[0];

type Theme = "light" | "dark";

/** URL parameters let people share a design: ?text=…&style=dot&eye=circle&theme=dark */
const params = new URLSearchParams(typeof location === "undefined" ? "" : location.search);
const paramStyle = params.get("style") as StyleId | null;
const paramEye = params.get("eye") as EyeId | null;
const paramTheme = params.get("theme");
const paramLang = params.get("lang");
const paramEcc = params.get("ecc") as Ecc | null;

const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  },
};

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function loadImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 512;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("canvas unsupported"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error("bad image"));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

/* ---------------------------------- icons --------------------------------- */

const Icon = ({ d, size = 16 }: { d: string; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={d} />
  </svg>
);

const ICON = {
  download: "M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2",
  shuffle: "M16 3h5v5M21 3l-7 7M8 21H3v-5M3 21l7-7M21 16v5h-5M14 14l7 7M3 8V3h5M10 10 3 3",
  upload: "M12 17V5m0 0-4 4m4-4 4 4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2",
  close: "M6 6l12 12M18 6 6 18",
  sun: "M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66 1.41-1.41M4.93 19.07l1.41-1.41m11.32 0 1.41 1.41M4.93 4.93l1.41 1.41M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  moon: "M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z",
  github:
    "M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21",
  lock: "M5 11h14v10H5V11Zm3 0V7a4 4 0 0 1 8 0v4",
  qr: "M4 4h6v6H4V4Zm1.5 1.5v3h3v-3h-3ZM14 4h6v6h-6V4Zm1.5 1.5v3h3v-3h-3ZM4 14h6v6H4v-6Zm1.5 1.5v3h3v-3h-3ZM14 14h2v2h-2v-2Zm4 0h2v2h-2v-2Zm-4 4h2v2h-2v-2Zm4 0h2v2h-2v-2Z",
} as const;

const Mark = () => (
  <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
    <rect width="26" height="26" rx="7" fill="currentColor" />
    <g fill="var(--panel)">
      <rect x="5" y="5" width="6" height="6" rx="1.6" />
      <rect x="15" y="5" width="6" height="6" rx="1.6" />
      <rect x="5" y="15" width="6" height="6" rx="1.6" />
      <rect x="15" y="15" width="2.6" height="2.6" rx="0.9" />
      <rect x="18.4" y="18.4" width="2.6" height="2.6" rx="0.9" />
    </g>
  </svg>
);

/* ---------------------------------- app ---------------------------------- */

export default function App() {
  const [lang, setLang] = useState<Lang>(() =>
    paramLang === "zh" || paramLang === "en" ? paramLang : store.get<Lang>("qraft.lang", "zh"),
  );
  const [theme, setTheme] = useState<Theme>(() =>
    paramTheme === "dark" || paramTheme === "light"
      ? paramTheme
      : store.get<Theme>("qraft.theme", "light"),
  );
  const [text, setText] = useState(() =>
    params.get("text") ?? store.get<string>("qraft.text", "https://xhxh.vip/"),
  );
  const [ecc, setEcc] = useState<Ecc>(() =>
    paramEcc && ECC_LEVELS.includes(paramEcc) ? paramEcc : store.get<Ecc>("qraft.ecc", "M"),
  );
  const [design, setDesign] = useState<QrDesign>(() => {
    const base = store.get<QrDesign>("qraft.design", DEFAULT_DESIGN);
    return {
      ...base,
      ...(paramStyle && STYLE_IDS.includes(paramStyle) ? { style: paramStyle } : {}),
      ...(paramEye && EYE_IDS.includes(paramEye) ? { eye: paramEye } : {}),
    };
  });
  const [exportSize, setExportSize] = useState(() => store.get<number>("qraft.size", 1024));
  const [scanOpen, setScanOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const logoImage = useRef<HTMLImageElement | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const t = dict[lang];

  const { matrix, error } = useMemo(() => {
    const value = text.trim();
    if (!value) return { matrix: null as boolean[][] | null, error: t.errorEmpty };
    try {
      return { matrix: makeMatrix(value, ecc), error: null as string | null };
    } catch {
      return { matrix: null as boolean[][] | null, error: t.errorTooLong };
    }
  }, [text, ecc, t.errorEmpty, t.errorTooLong]);

  const previewSvg = useMemo(
    () => (matrix ? renderSvg(matrix, design, 1024) : ""),
    [matrix, design],
  );

  const sampleMatrix = useMemo(() => {
    try {
      return makeMatrix(SAMPLE, "M");
    } catch {
      return null;
    }
  }, []);

  const thumbColor = theme === "dark" ? "#f4f4f5" : "#111111";
  const thumbnails = useMemo(() => {
    const map = {} as Record<StyleId, string>;
    if (!sampleMatrix) return map;
    for (const id of STYLE_IDS) {
      map[id] = renderSvg(
        sampleMatrix,
        {
          ...design,
          style: id,
          fg: thumbColor,
          fg2: thumbColor,
          gradient: false,
          bg: "#ffffff",
          transparent: true,
          margin: 1,
          logo: null,
        },
        160,
      );
    }
    return map;
  }, [sampleMatrix, design, thumbColor]);

  const eyeThumbs = useMemo(() => {
    const map = {} as Record<EyeId, string>;
    for (const id of EYE_IDS) map[id] = renderEyeSvg(id, thumbColor, 56);
    return map;
  }, [thumbColor]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    store.set("qraft.theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    document.documentElement.dataset.lang = lang;
    store.set("qraft.lang", lang);
  }, [lang]);

  useEffect(() => store.set("qraft.text", text), [text]);
  useEffect(() => store.set("qraft.ecc", ecc), [ecc]);
  useEffect(() => store.set("qraft.design", design), [design]);
  useEffect(() => store.set("qraft.size", exportSize), [exportSize]);

  useEffect(() => {
    if (!scanOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setScanOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [scanOpen]);

  const scanMatrix = useMemo(() => {
    try {
      return makeMatrix(SCAN_URL, "M");
    } catch {
      return null;
    }
  }, []);

  const scanSvg = useMemo(
    () =>
      scanMatrix
        ? renderSvg(
            scanMatrix,
            {
              ...DEFAULT_DESIGN,
              fg: "#111111",
              fg2: "#111111",
              gradient: false,
              bg: "#ffffff",
              transparent: false,
              margin: 2,
              logo: null,
            },
            480,
          )
        : "",
    [scanMatrix],
  );

  useEffect(() => {
    if (!design.logo) {
      logoImage.current = null;
      return;
    }
    const img = new Image();
    img.onload = () => {
      logoImage.current = img;
    };
    img.src = design.logo;
  }, [design.logo]);

  const patch = useCallback((next: Partial<QrDesign>) => {
    setDesign((prev) => ({ ...prev, ...next }));
  }, []);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0];
      if (!file || !file.type.startsWith("image/")) return;
      try {
        const dataUrl = await loadImageFile(file);
        setDesign((prev) => ({ ...prev, logo: dataUrl }));
        if (ecc !== "H") setEcc("H");
      } catch {
        /* ignore */
      }
    },
    [ecc],
  );

  const exportPng = useCallback(() => {
    if (!matrix) return;
    const canvas = document.createElement("canvas");
    canvas.width = exportSize;
    canvas.height = exportSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawQr(ctx, matrix, design, exportSize, logoImage.current);
    canvas.toBlob((blob) => blob && download(blob, `qraft-${Date.now()}.png`), "image/png");
  }, [matrix, design, exportSize]);

  const exportSvg = useCallback(() => {
    if (!matrix) return;
    const svg = renderSvg(matrix, design, exportSize);
    download(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), `qraft-${Date.now()}.svg`);
  }, [matrix, design, exportSize]);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragging(false);
      void handleFiles(event.dataTransfer.files);
    },
    [handleFiles],
  );

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Mark />
          </span>
          <div className="brand-text">
            <strong>QRAFT</strong>
            <span>{t.tagline}</span>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="btn ghost" onClick={() => setLang(lang === "zh" ? "en" : "zh")}>
            {lang === "zh" ? "EN" : "中文"}
          </button>
          <button
            className="btn ghost icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="theme"
          >
            <Icon d={theme === "dark" ? ICON.sun : ICON.moon} />
          </button>
          <button
            className="btn ghost scan-btn"
            onClick={() => setScanOpen(true)}
            title={t.scanTitle}
          >
            <Icon d={ICON.qr} />
            <span>{t.scan}</span>
          </button>
        </div>
      </header>

      <main>
        <section className="stage">
          <div className="preview-card">
            <div
              className={`preview${dragging ? " dragging" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              {matrix ? (
                <div className="qr" dangerouslySetInnerHTML={{ __html: previewSvg }} />
              ) : (
                <div className="preview-empty">{error}</div>
              )}
            </div>
            <div className="preview-foot">
              <span className="meta">
                <Icon d={ICON.lock} size={14} />
                {t.localOnly}
                {matrix && <em>· {matrix.length}×{matrix.length}</em>}
              </span>
              <div className="actions">
                <button className="btn primary" onClick={exportPng} disabled={!matrix}>
                  <Icon d={ICON.download} />
                  {t.downloadPng}
                </button>
                <button className="btn" onClick={exportSvg} disabled={!matrix}>
                  SVG
                </button>
                <button className="btn" onClick={() => setDesign(randomDesign(design))}>
                  <Icon d={ICON.shuffle} />
                  {t.randomize}
                </button>
              </div>
            </div>
          </div>

          <div className="gallery">
            <h2 className="group-title">{t.style}</h2>
            <div className="styles">
              {STYLE_IDS.map((id) => (
                <button
                  key={id}
                  className={`style-card${design.style === id ? " active" : ""}`}
                  onClick={() => patch({ style: id })}
                >
                  <span
                    className="style-thumb"
                    dangerouslySetInnerHTML={{ __html: thumbnails[id] ?? "" }}
                  />
                  <span className="style-name">{t.styles[id]}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside className="panel">
          <div className="group">
            <h2 className="group-title">{t.content}</h2>
            <textarea
              value={text}
              spellCheck={false}
              placeholder={t.contentPlaceholder}
              onChange={(e) => setText(e.target.value)}
            />
            {error && <p className="field-error">{error}</p>}
            <div className="field">
              <div className="field-head">
                <label>{t.ecc}</label>
              </div>
              <div className="seg">
                {ECC_LEVELS.map((level) => (
                  <button
                    key={level}
                    className={ecc === level ? "on" : ""}
                    onClick={() => setEcc(level)}
                  >
                    {level}
                  </button>
                ))}
              </div>
              <p className="hint">{t.eccHint}</p>
            </div>
          </div>

          <div className="group">
            <h2 className="group-title">{t.eyes}</h2>
            <div className="eyes">
              {EYE_IDS.map((id) => (
                <button
                  key={id}
                  className={`eye-card${design.eye === id ? " active" : ""}`}
                  onClick={() => patch({ eye: id })}
                  title={t.eyesNames[id]}
                >
                  <span dangerouslySetInnerHTML={{ __html: eyeThumbs[id] }} />
                  <span className="eye-name">{t.eyesNames[id]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="group">
            <h2 className="group-title">{t.color}</h2>
            <div className="color-row">
              <label>{t.foreground}</label>
              <div className="swatch" style={{ background: design.fg }}>
                <input
                  type="color"
                  value={design.fg}
                  onChange={(e) => patch({ fg: e.target.value })}
                  aria-label={t.foreground}
                />
              </div>
            </div>
            <div className="color-row">
              <label>{design.gradient ? `${t.foreground} 2` : t.background}</label>
              <div
                className="swatch"
                style={{ background: design.gradient ? design.fg2 : design.bg }}
              >
                <input
                  type="color"
                  value={design.gradient ? design.fg2 : design.bg}
                  onChange={(e) =>
                    patch(design.gradient ? { fg2: e.target.value } : { bg: e.target.value })
                  }
                  aria-label={design.gradient ? `${t.foreground} 2` : t.background}
                />
              </div>
            </div>
            <div className="toggle-row">
              <label>{t.gradient}</label>
              <button
                className={`switch${design.gradient ? " on" : ""}`}
                onClick={() => patch({ gradient: !design.gradient })}
                aria-pressed={design.gradient}
              >
                <span className="sr-only">{t.gradient}</span>
              </button>
            </div>
            {design.gradient && (
              <div className="slider-block">
                <div className="field-head">
                  <label>{t.angle}</label>
                  <span className="value">{design.angle}°</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={5}
                  value={design.angle}
                  onChange={(e) => patch({ angle: Number(e.target.value) })}
                />
              </div>
            )}
            <div className="toggle-row">
              <label>{t.transparent}</label>
              <button
                className={`switch${design.transparent ? " on" : ""}`}
                onClick={() => patch({ transparent: !design.transparent })}
                aria-pressed={design.transparent}
              >
                <span className="sr-only">{t.transparent}</span>
              </button>
            </div>
          </div>

          <div className="group">
            <h2 className="group-title">{t.logo}</h2>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => void handleFiles(e.target.files)}
            />
            {design.logo ? (
              <>
                <div className="logo-row">
                  <img src={design.logo} alt="" className="logo-thumb" />
                  <button className="btn ghost" onClick={() => patch({ logo: null })}>
                    <Icon d={ICON.close} size={14} />
                    {t.remove}
                  </button>
                </div>
                <div className="slider-block">
                  <div className="field-head">
                    <label>{t.logoSize}</label>
                    <span className="value">{Math.round(design.logoScale * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={32}
                    step={1}
                    value={Math.round(design.logoScale * 100)}
                    onChange={(e) => patch({ logoScale: Number(e.target.value) / 100 })}
                  />
                </div>
              </>
            ) : (
              <button className="btn block" onClick={() => fileInput.current?.click()}>
                <Icon d={ICON.upload} />
                {t.uploadLogo}
              </button>
            )}
            <p className="hint">{design.logo ? t.eccHint : t.dropLogo}</p>
          </div>

          <div className="group">
            <h2 className="group-title">{t.advanced}</h2>
            <div className="slider-block">
              <div className="field-head">
                <label>{t.exportSize}</label>
                <span className="value">{exportSize}px</span>
              </div>
              <input
                type="range"
                min={256}
                max={4096}
                step={256}
                value={exportSize}
                onChange={(e) => setExportSize(Number(e.target.value))}
              />
            </div>
            <div className="slider-block">
              <div className="field-head">
                <label>{t.margin}</label>
                <span className="value">{design.margin}</span>
              </div>
              <input
                type="range"
                min={0}
                max={8}
                step={1}
                value={design.margin}
                onChange={(e) => patch({ margin: Number(e.target.value) })}
              />
              <p className="hint">{t.marginHint}</p>
            </div>
          </div>
        </aside>
      </main>

      <footer>
        <div className="footer-links">
          <a href="https://qrbtf.com" target="_blank" rel="noreferrer">
            QRBTF
          </a>
          <span>·</span>
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            Source
          </a>
        </div>
        <p>{t.credit}</p>
        <p className="footer-note">{t.footerNote}</p>
      </footer>

      {scanOpen && (
        <div className="scan-backdrop" onClick={() => setScanOpen(false)}>
          <div
            className="scan-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="scan-close"
              aria-label={t.close}
              onClick={() => setScanOpen(false)}
            >
              ×
            </button>
            <h3>{t.scanTitle}</h3>
            <div className="scan-qr" dangerouslySetInnerHTML={{ __html: scanSvg }} />
            <p>{t.scanHint}</p>
            <code className="scan-url">{SCAN_URL}</code>
            <a className="scan-link" href={SCAN_URL} target="_blank" rel="noreferrer">
              {t.scanOpenHere}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
