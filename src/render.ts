/**
 * Geometry engine for parametric QR codes.
 *
 * Everything is expressed in "module units": the matrix occupies [0, n] x [0, n].
 * Shapes are plain SVG path strings so the exact same geometry can be painted
 * to an <svg> element or to a <canvas> via Path2D — one source of truth.
 */

export type StyleId =
  | "classic"
  | "rounded"
  | "dot"
  | "liquid"
  | "line"
  | "vline"
  | "diamond"
  | "leaf";

export type EyeId = "square" | "rounded" | "circle" | "leaf";

export interface QrDesign {
  style: StyleId;
  eye: EyeId;
  fg: string;
  fg2: string;
  gradient: boolean;
  angle: number;
  bg: string;
  transparent: boolean;
  margin: number;
  logo: string | null;
  logoScale: number;
}

export interface Shape {
  d: string;
  rule?: "nonzero" | "evenodd";
}

const num = (v: number): string => {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? "0" : String(r);
};

/** Rounded rectangle with independent corner radii (top-left, top-right, bottom-right, bottom-left). */
function rr(
  x: number,
  y: number,
  w: number,
  h: number,
  tl: number,
  tr: number,
  br: number,
  bl: number,
): string {
  const lim = Math.min(w, h) / 2;
  tl = Math.min(tl, lim);
  tr = Math.min(tr, lim);
  br = Math.min(br, lim);
  bl = Math.min(bl, lim);
  let d = `M${num(x + tl)} ${num(y)}H${num(x + w - tr)}`;
  if (tr > 0) d += `A${num(tr)} ${num(tr)} 0 0 1 ${num(x + w)} ${num(y + tr)}`;
  d += `V${num(y + h - br)}`;
  if (br > 0) d += `A${num(br)} ${num(br)} 0 0 1 ${num(x + w - br)} ${num(y + h)}`;
  d += `H${num(x + bl)}`;
  if (bl > 0) d += `A${num(bl)} ${num(bl)} 0 0 1 ${num(x)} ${num(y + h - bl)}`;
  d += `V${num(y + tl)}`;
  if (tl > 0) d += `A${num(tl)} ${num(tl)} 0 0 1 ${num(x + tl)} ${num(y)}`;
  return `${d}Z`;
}

function circle(cx: number, cy: number, r: number): string {
  return `M${num(cx - r)} ${num(cy)}a${num(r)} ${num(r)} 0 1 0 ${num(2 * r)} 0a${num(r)} ${num(
    r,
  )} 0 1 0 ${num(-2 * r)} 0Z`;
}

function diamond(x: number, y: number, s: number): string {
  return `M${num(x + s / 2)} ${num(y)}L${num(x + s)} ${num(y + s / 2)}L${num(x + s / 2)} ${num(
    y + s,
  )}L${num(x)} ${num(y + s / 2)}Z`;
}

/** True when (r,c) falls inside one of the three 7x7 finder patterns. */
function isFinder(r: number, c: number, n: number): boolean {
  const inside = (r0: number, c0: number) => r >= r0 && r < r0 + 7 && c >= c0 && c < c0 + 7;
  return inside(0, 0) || inside(0, n - 7) || inside(n - 7, 0);
}

/** Locate 5x5 alignment patterns by their ring signature (dark / light / dark). */
export function findAlignmentCenters(matrix: boolean[][]): [number, number][] {
  const n = matrix.length;
  const out: [number, number][] = [];
  for (let r = 2; r < n - 2; r++) {
    for (let c = 2; c < n - 2; c++) {
      if (!matrix[r][c]) continue;
      if (isFinder(r - 2, c - 2, n)) continue;
      let ok = true;
      for (let dr = -1; dr <= 1 && ok; dr++) {
        for (let dc = -1; dc <= 1 && ok; dc++) {
          if ((dr || dc) && matrix[r + dr][c + dc]) ok = false;
        }
      }
      if (!ok) continue;
      for (let dr = -2; dr <= 2 && ok; dr++) {
        for (let dc = -2; dc <= 2 && ok; dc++) {
          const ring = Math.abs(dr) === 2 || Math.abs(dc) === 2;
          if (ring && !matrix[r + dr][c + dc]) ok = false;
        }
      }
      if (ok) out.push([r, c]);
    }
  }
  return out;
}

/** 5x5 alignment pattern drawn in the same visual language as the finder eyes. */
export function miniEye(eye: EyeId, r0: number, c0: number): Shape[] {
  const cy = r0 + 2.5;
  const cx = c0 + 2.5;
  let ring = "";
  let core = "";
  switch (eye) {
    case "circle":
      ring = `${circle(cx, cy, 2.5)}${circle(cx, cy, 1.5)}`;
      core = circle(cx, cy, 0.5);
      break;
    case "leaf":
      ring = `${rr(c0, r0, 5, 5, 0, 2.5, 0, 2.5)}${rr(c0 + 1, r0 + 1, 3, 3, 0, 1.5, 0, 1.5)}`;
      core = rr(c0 + 2, r0 + 2, 1, 1, 0, 0.5, 0, 0.5);
      break;
    case "square":
      ring = `${rr(c0, r0, 5, 5, 0, 0, 0, 0)}${rr(c0 + 1, r0 + 1, 3, 3, 0, 0, 0, 0)}`;
      core = rr(c0 + 2, r0 + 2, 1, 1, 0, 0, 0, 0);
      break;
    default:
      ring = `${rr(c0, r0, 5, 5, 1.5, 1.5, 1.5, 1.5)}${rr(
        c0 + 1,
        r0 + 1,
        3,
        3,
        1,
        1,
        1,
        1,
      )}`;
      core = rr(c0 + 2, r0 + 2, 1, 1, 0.34, 0.34, 0.34, 0.34);
      break;
  }
  return [
    { d: ring, rule: "evenodd" },
    { d: core },
  ];
}

export function buildBody(matrix: boolean[][], style: StyleId, eye: EyeId): Shape[] {
  const n = matrix.length;
  const draw: boolean[][] = matrix.map((row, r) =>
    row.map((v, c) => v && !isFinder(r, c, n)),
  );
  const on = (r: number, c: number) => r >= 0 && r < n && c >= 0 && c < n && draw[r][c];
  const out: Shape[] = [];

  // Stylised modules make the 5x5 alignment patterns unreadable for some
  // decoders, so those cells get a dedicated treatment instead.
  const solid = new Set<string>();
  const covered = new Set<string>();
  const aligns = style === "diamond" || style === "dot" || style === "liquid"
    ? findAlignmentCenters(matrix)
    : [];
  for (const [ar, ac] of aligns) {
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const key = `${ar + dr},${ac + dc}`;
        covered.add(key);
        if (style === "diamond") solid.add(key);
      }
    }
  }

  if (style === "line" || style === "vline") {
    const horizontal = style === "line";
    for (let a = 0; a < n; a++) {
      let b = 0;
      while (b < n) {
        const value = horizontal ? draw[a][b] : draw[b][a];
        if (!value) {
          b++;
          continue;
        }
        const start = b;
        while (b < n && (horizontal ? draw[a][b] : draw[b][a])) b++;
        const len = b - start;
        const r = Math.min(0.46, len / 2);
        out.push({
          d: horizontal
            ? rr(start, a + 0.04, len, 0.92, r, r, r, r)
            : rr(a + 0.04, start, 0.92, len, r, r, r, r),
        });
      }
    }
    return out;
  }

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!draw[r][c]) continue;
      if (style !== "diamond" && covered.has(`${r},${c}`)) continue;
      switch (style) {
        case "classic":
          out.push({ d: rr(c, r, 1, 1, 0, 0, 0, 0) });
          break;
        case "rounded":
          out.push({ d: rr(c + 0.015, r + 0.015, 0.97, 0.97, 0.34, 0.34, 0.34, 0.34) });
          break;
        case "dot":
          out.push({ d: circle(c + 0.5, r + 0.5, 0.5) });
          break;
        case "liquid": {
          out.push({ d: circle(c + 0.5, r + 0.5, 0.5) });
          if (on(r, c + 1)) out.push({ d: rr(c + 0.5, r + 0.16, 1, 0.68, 0.34, 0.34, 0.34, 0.34) });
          if (on(r + 1, c)) out.push({ d: rr(c + 0.16, r + 0.5, 0.68, 1, 0.34, 0.34, 0.34, 0.34) });
          if (on(r + 1, c + 1) && !on(r, c + 1) && !on(r + 1, c))
            out.push({ d: circle(c + 1, r + 1, 0.24) });
          break;
        }
        case "diamond":
          out.push(
            solid.has(`${r},${c}`)
              ? { d: rr(c, r, 1, 1, 0.24, 0.24, 0.24, 0.24) }
              : { d: diamond(c - 0.12, r - 0.12, 1.24) },
          );
          break;
        case "leaf":
          out.push({ d: rr(c, r, 1, 1, 0, 0.5, 0, 0.5) });
          break;
      }
    }
  }

  if (style === "dot" || style === "liquid") {
    for (const [ar, ac] of aligns) out.push(...miniEye(eye, ar - 2, ac - 2));
  }
  return out;
}

export function eyeShapes(eye: EyeId, r0: number, c0: number): Shape[] {
  const outer: Shape = { d: "", rule: "evenodd" };
  let innerD = "";
  switch (eye) {
    case "square":
      outer.d = `${rr(c0, r0, 7, 7, 0, 0, 0, 0)}${rr(c0 + 1, r0 + 1, 5, 5, 0, 0, 0, 0)}`;
      innerD = rr(c0 + 2, r0 + 2, 3, 3, 0, 0, 0, 0);
      break;
    case "rounded":
      outer.d = `${rr(c0, r0, 7, 7, 2, 2, 2, 2)}${rr(c0 + 1, r0 + 1, 5, 5, 1.4, 1.4, 1.4, 1.4)}`;
      innerD = rr(c0 + 2, r0 + 2, 3, 3, 0.95, 0.95, 0.95, 0.95);
      break;
    case "circle":
      outer.d = `${circle(c0 + 3.5, r0 + 3.5, 3.5)}${circle(c0 + 3.5, r0 + 3.5, 2.5)}`;
      innerD = circle(c0 + 3.5, r0 + 3.5, 1.62);
      break;
    case "leaf":
      outer.d = `${rr(c0, r0, 7, 7, 0, 3.5, 0, 3.5)}${rr(c0 + 1, r0 + 1, 5, 5, 0, 2.4, 0, 2.4)}`;
      innerD = rr(c0 + 2, r0 + 2, 3, 3, 0, 1.5, 0, 1.5);
      break;
  }
  return [outer, { d: innerD }];
}

export function buildEyes(matrix: boolean[][], eye: EyeId): Shape[] {
  const n = matrix.length;
  const origins: [number, number][] = [
    [0, 0],
    [0, n - 7],
    [n - 7, 0],
  ];
  return origins.flatMap(([r0, c0]) => eyeShapes(eye, r0, c0));
}

/** Standalone 7x7 finder-pattern preview used for the eye picker. */
export function renderEyeSvg(eye: EyeId, color: string, px = 56): string {
  const shapes = eyeShapes(eye, 0, 0);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 7 7" fill="${color}">${shapes
    .map((s) => `<path d="${s.d}"${s.rule ? ` fill-rule="${s.rule}"` : ""}/>`)
    .join("")}</svg>`;
}

export function logoBox(n: number, scale: number) {
  const size = Math.max(0.001, n * scale);
  const center = n / 2;
  const pad = size * 0.11;
  return { size, x: center - size / 2, y: center - size / 2, pad };
}

const angleToVector = (angle: number) => {
  const rad = (angle * Math.PI) / 180;
  return { dx: Math.cos(rad), dy: Math.sin(rad) };
};

export function renderSvg(matrix: boolean[][], d: QrDesign, px: number): string {
  const n = matrix.length;
  const m = d.margin;
  const W = n + 2 * m;
  const shapes = [...buildBody(matrix, d.style, d.eye), ...buildEyes(matrix, d.eye)];
  const fill = d.gradient ? "url(#qraft-g)" : d.fg;

  const { dx, dy } = angleToVector(d.angle);
  const half = (n * Math.SQRT2) / 2;
  const cx = n / 2;
  const cy = n / 2;

  const plate = logoBox(n, d.logoScale);

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${px}" height="${px}" viewBox="${num(
      -m,
    )} ${num(-m)} ${num(W)} ${num(W)}" shape-rendering="geometricPrecision">`,
  );
  if (d.gradient) {
    parts.push(
      `<defs><linearGradient id="qraft-g" gradientUnits="userSpaceOnUse" x1="${num(
        cx - dx * half,
      )}" y1="${num(cy - dy * half)}" x2="${num(cx + dx * half)}" y2="${num(
        cy + dy * half,
      )}"><stop offset="0" stop-color="${d.fg}"/><stop offset="1" stop-color="${
        d.fg2
      }"/></linearGradient></defs>`,
    );
  }
  if (!d.transparent) {
    parts.push(`<rect x="${num(-m)}" y="${num(-m)}" width="${num(W)}" height="${num(
      W,
    )}" fill="${d.bg}"/>`);
  }
  parts.push(`<g fill="${fill}">`);
  for (const s of shapes) {
    parts.push(`<path d="${s.d}"${s.rule ? ` fill-rule="${s.rule}"` : ""}/>`);
  }
  parts.push(`</g>`);

  if (d.logo) {
    parts.push(
      `<rect x="${num(plate.x - plate.pad)}" y="${num(plate.y - plate.pad)}" width="${num(
        plate.size + plate.pad * 2,
      )}" height="${num(plate.size + plate.pad * 2)}" rx="${num(
        (plate.size + plate.pad * 2) * 0.24,
      )}" fill="${d.transparent ? "#ffffff" : d.bg}"/>`,
    );
    parts.push(
      `<image href="${d.logo}" xlink:href="${d.logo}" x="${num(plate.x)}" y="${num(
        plate.y,
      )}" width="${num(plate.size)}" height="${num(plate.size)}" preserveAspectRatio="xMidYMid meet"/>`,
    );
  }
  parts.push("</svg>");
  return parts.join("");
}

function gradientPaint(ctx: CanvasRenderingContext2D, d: QrDesign, n: number): CanvasGradient {
  const { dx, dy } = angleToVector(d.angle);
  const half = (n * Math.SQRT2) / 2;
  const g = ctx.createLinearGradient(
    n / 2 - dx * half,
    n / 2 - dy * half,
    n / 2 + dx * half,
    n / 2 + dy * half,
  );
  g.addColorStop(0, d.fg);
  g.addColorStop(1, d.fg2);
  return g;
}

export function drawQr(
  ctx: CanvasRenderingContext2D,
  matrix: boolean[][],
  d: QrDesign,
  px: number,
  logoImage?: HTMLImageElement | null,
): void {
  const n = matrix.length;
  const m = d.margin;
  const W = n + 2 * m;
  const scale = px / W;

  ctx.clearRect(0, 0, px, px);
  if (!d.transparent) {
    ctx.fillStyle = d.bg;
    ctx.fillRect(0, 0, px, px);
  }

  ctx.save();
  ctx.translate(m * scale, m * scale);
  ctx.scale(scale, scale);
  ctx.fillStyle = d.gradient ? gradientPaint(ctx, d, n) : d.fg;
  const shapes = [...buildBody(matrix, d.style, d.eye), ...buildEyes(matrix, d.eye)];
  for (const s of shapes) {
    ctx.fill(new Path2D(s.d), s.rule ?? "nonzero");
  }

  if (logoImage && d.logo) {
    const plate = logoBox(n, d.logoScale);
    const boxW = plate.size + plate.pad * 2;
    ctx.fillStyle = d.transparent ? "#ffffff" : d.bg;
    const radius = boxW * 0.24;
    const platePath = new Path2D(
      rr(plate.x - plate.pad, plate.y - plate.pad, boxW, boxW, radius, radius, radius, radius),
    );
    ctx.fill(platePath);
    const ar = logoImage.width / logoImage.height || 1;
    let w = plate.size;
    let h = plate.size;
    if (ar > 1) h = plate.size / ar;
    else w = plate.size * ar;
    ctx.drawImage(
      logoImage,
      plate.x + (plate.size - w) / 2,
      plate.y + (plate.size - h) / 2,
      w,
      h,
    );
  }
  ctx.restore();
}
