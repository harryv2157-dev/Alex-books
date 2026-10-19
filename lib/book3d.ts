// Builds a 3D book (covers, spine, page block) from a book's details and cover photos. Browser-only.
import * as THREE from "three";

export type Book3DInput = {
  id: number;
  title: string;
  author: string | null;
  total_pages: number | null;
  current_page: number;
  status: "reading" | "finished";
  rating: number | null;
  has_cover: boolean;
  has_back_cover?: boolean;
  last_note?: string | null;
  review?: string | null;
  color: string;
};

export type BookObject = {
  group: THREE.Group; // origin at the bottom-centre of the book
  frontCover: THREE.Group; // hinge at the spine; rotate on y to open
  size: { t: number; h: number; d: number };
  dispose(): void;
};

const COVER = 0.0028;
const loader = new THREE.TextureLoader();

function hash(n: number, salt = 0) {
  return Math.abs(Math.sin(n * 9301 + 49297 + salt * 233)) % 1;
}

export function bookSize(b: Pick<Book3DInput, "id" | "total_pages">) {
  const pages = b.total_pages ?? 320;
  return {
    t: Math.min(0.062, Math.max(0.022, 0.012 + pages * 0.000085)),
    h: 0.205 + hash(b.id) * 0.045,
    d: 0.142 + hash(b.id, 1) * 0.022,
  };
}

export function progressOf(b: Pick<Book3DInput, "status" | "total_pages" | "current_page">) {
  if (b.status === "finished") return 1;
  return b.total_pages ? Math.min(1, b.current_page / b.total_pages) : 0;
}

function shade(hex: string, amt: number) {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amt)));
  return `#${c.getHexString()}`;
}

function canvasTexture(canvas: HTMLCanvasElement) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    } else line = test;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(" ") !== lines.join(" ")) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, "") + "…";
  }
  return lines;
}

function spineTexture(b: Book3DInput, t: number, h: number) {
  const W = 128;
  const H = Math.round((W * h) / t);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = Math.min(H, 2048);
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, shade(b.color, -0.12));
  g.addColorStop(0.35, shade(b.color, 0.06));
  g.addColorStop(1, shade(b.color, -0.14));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, c.height);
  // gilt bands
  ctx.fillStyle = "#d9a956";
  for (const y of [c.height * 0.045, c.height * 0.06, c.height * 0.94, c.height * 0.955]) ctx.fillRect(10, y, W - 20, 4);
  // author at the foot, title running down the rest of the spine
  let authorLen = 0;
  if (b.author) {
    const surname = b.author.split(" ").slice(-1)[0].toUpperCase();
    ctx.save();
    ctx.font = `500 ${Math.min(30, W * 0.24)}px Inter, system-ui, sans-serif`;
    authorLen = Math.min(ctx.measureText(surname).width, c.height * 0.3);
    ctx.translate(W / 2, c.height * 0.915);
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = "rgba(251,243,230,0.8)";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(surname, 0, 0, c.height * 0.3);
    ctx.restore();
  }
  const top = c.height * 0.09;
  const maxLen = c.height * 0.915 - top - (authorLen ? authorLen + c.height * 0.05 : 0);
  ctx.save();
  ctx.translate(W / 2, top);
  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = "#fbf3e6";
  ctx.textBaseline = "middle";
  let size = Math.min(56, W * 0.42);
  ctx.font = `600 ${size}px Fraunces, Georgia, serif`;
  while (ctx.measureText(b.title).width > maxLen && size > 30) {
    size -= 2;
    ctx.font = `600 ${size}px Fraunces, Georgia, serif`;
  }
  if (ctx.measureText(b.title).width <= maxLen) {
    ctx.fillText(b.title, 0, 0);
  } else {
    // two lines side by side for long titles
    size = Math.min(size, W * 0.3);
    ctx.font = `600 ${size}px Fraunces, Georgia, serif`;
    const lines = wrapLines(ctx, b.title, maxLen, 2);
    lines.forEach((l, i) => ctx.fillText(l, 0, (i - (lines.length - 1) / 2) * size * 1.05));
  }
  ctx.restore();
  // reading progress as a gilt line up the side of the spine
  const p = progressOf(b);
  if (p > 0) {
    ctx.fillStyle = "#e3a857";
    ctx.fillRect(0, c.height * (1 - p), 7, c.height * p);
  }
  return canvasTexture(c);
}

function plainCoverTexture(b: Book3DInput, d: number, h: number) {
  const W = 512;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = Math.round((W * h) / d);
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, W, c.height);
  g.addColorStop(0, shade(b.color, 0.06));
  g.addColorStop(1, shade(b.color, -0.1));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, c.height);
  ctx.strokeStyle = "rgba(217,169,86,0.75)";
  ctx.lineWidth = 6;
  ctx.strokeRect(28, 28, W - 56, c.height - 56);
  ctx.fillStyle = "#fbf3e6";
  ctx.textAlign = "center";
  ctx.font = "600 52px Fraunces, Georgia, serif";
  const lines = wrapLines(ctx, b.title, W - 120, 4);
  lines.forEach((l, i) => ctx.fillText(l, W / 2, c.height * 0.38 + i * 62));
  if (b.author) {
    ctx.font = "500 26px Inter, system-ui, sans-serif";
    ctx.fillStyle = "rgba(251,243,230,0.8)";
    ctx.fillText(b.author.toUpperCase(), W / 2, c.height * 0.82);
  }
  return canvasTexture(c);
}

// The first page inside the front cover: progress, or the verdict once finished.
function insidePageTexture(b: Book3DInput, d: number, h: number) {
  const W = 512;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = Math.round((W * h) / d);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#f8f1e4";
  ctx.fillRect(0, 0, W, c.height);
  const pad = 44;
  let y = 90;
  ctx.fillStyle = "#2c241c";
  ctx.font = "600 44px Fraunces, Georgia, serif";
  for (const l of wrapLines(ctx, b.title, W - pad * 2, 3)) {
    ctx.fillText(l, pad, y);
    y += 52;
  }
  if (b.author) {
    ctx.fillStyle = "#7a6a58";
    ctx.font = "400 26px Inter, system-ui, sans-serif";
    ctx.fillText(b.author, pad, y + 4);
    y += 40;
  }
  y += 30;
  if (b.status === "finished") {
    ctx.fillStyle = "#a8661c";
    ctx.font = "600 28px Inter, system-ui, sans-serif";
    ctx.fillText("Finished", pad, y);
    y += 50;
    if (b.rating) {
      ctx.font = "44px serif";
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = i < b.rating ? "#e3a857" : "#d8c9b0";
        ctx.fillText("★", pad + i * 48, y);
      }
      y += 50;
    }
  } else {
    const p = progressOf(b);
    ctx.fillStyle = "#e6d8c0";
    ctx.beginPath();
    ctx.roundRect(pad, y, W - pad * 2, 18, 9);
    ctx.fill();
    ctx.fillStyle = "#d4923f";
    ctx.beginPath();
    ctx.roundRect(pad, y, Math.max(18, (W - pad * 2) * p), 18, 9);
    ctx.fill();
    y += 58;
    ctx.fillStyle = "#5c4d3c";
    ctx.font = "500 28px Inter, system-ui, sans-serif";
    ctx.fillText(
      b.total_pages ? `Page ${b.current_page} of ${b.total_pages} · ${Math.round(p * 100)}%` : `Page ${b.current_page}`,
      pad,
      y,
    );
    y += 40;
  }
  const quote = b.status === "finished" ? b.review : b.last_note;
  if (quote) {
    y += 24;
    ctx.fillStyle = "#4a3d30";
    ctx.font = "italic 400 30px Fraunces, Georgia, serif";
    for (const l of wrapLines(ctx, `“${quote}”`, W - pad * 2, 7)) {
      ctx.fillText(l, pad, y);
      y += 42;
    }
  }
  return canvasTexture(c);
}

function photoTexture(url: string, onLoad?: () => void) {
  const tex = loader.load(url, onLoad);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

let pagesTex: THREE.Texture | null = null;
function pageEdgeTexture() {
  if (!pagesTex) {
    pagesTex = photoTexture("/textures/pages.jpg");
    pagesTex.center.set(0.5, 0.5);
    pagesTex.rotation = Math.PI / 2;
  }
  return pagesTex;
}

// "This book belongs to…" plate on the inside of the front cover.
function bookplateTexture(owner: string, color: string, d: number, h: number) {
  const W = 512;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = Math.round((W * h) / d);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#efe3cc";
  ctx.fillRect(0, 0, W, c.height);
  // marbled endpaper hint
  ctx.globalAlpha = 0.07;
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2 + (i % 5);
    ctx.beginPath();
    const y = (i / 40) * c.height;
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(W * 0.3, y + 40, W * 0.6, y - 40, W, y + 10);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const pw = W * 0.62;
  const ph = pw * 0.72;
  const px = (W - pw) / 2;
  const py = c.height * 0.36;
  ctx.fillStyle = "#fbf6ec";
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.strokeRect(px + 12, py + 12, pw - 24, ph - 24);
  ctx.textAlign = "center";
  ctx.fillStyle = color;
  ctx.font = "italic 400 26px Fraunces, Georgia, serif";
  ctx.fillText("Ex Libris", W / 2, py + 62);
  ctx.font = "600 44px Fraunces, Georgia, serif";
  ctx.fillText(owner, W / 2, py + ph / 2 + 22, pw - 50);
  ctx.font = "30px serif";
  ctx.fillStyle = "#c0473a";
  ctx.fillText("♥", W / 2, py + ph - 36);
  return canvasTexture(c);
}

export function buildBook(b: Book3DInput, opts: { inside?: boolean; owner?: string | null; onTexture?: () => void } = {}): BookObject {
  const { t, h, d } = bookSize(b);
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);

  const clothColor = new THREE.Color(b.color);
  const cloth = track(new THREE.MeshStandardMaterial({ color: clothColor, roughness: 0.7, metalness: 0.02 }));
  const endpaper = track(new THREE.MeshStandardMaterial({ color: "#efe3cc", roughness: 0.9 }));
  const pageSide = track(new THREE.MeshStandardMaterial({ color: "#f3ead8", roughness: 0.95 }));
  const pageEdge = track(new THREE.MeshStandardMaterial({ map: pageEdgeTexture(), color: "#fff6e6", roughness: 0.95 }));
  const front = track(
    new THREE.MeshStandardMaterial({
      map: track(b.has_cover ? photoTexture(`/api/cover/${b.id}`, opts.onTexture) : plainCoverTexture(b, d, h)),
      roughness: 0.55,
    }),
  );
  const back = b.has_back_cover
    ? track(new THREE.MeshStandardMaterial({ map: track(photoTexture(`/api/cover/${b.id}?side=back`, opts.onTexture)), roughness: 0.55 }))
    : cloth;
  const spine = track(new THREE.MeshStandardMaterial({ map: track(spineTexture(b, t, h)), roughness: 0.6 }));

  const group = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, mats: THREE.Material | THREE.Material[], x: number, y: number, z: number, parent: THREE.Object3D = group) => {
    const m = new THREE.Mesh(track(geo), mats);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData.bookId = b.id;
    parent.add(m);
    return m;
  };

  // Box faces: +x, -x, +y, -y, +z (spine side), -z (fore-edge)
  const inside = opts.inside ? track(new THREE.MeshStandardMaterial({ map: track(insidePageTexture(b, d, h)), roughness: 0.9 })) : pageSide;
  add(new THREE.BoxGeometry(t - COVER * 2, h - 0.008, d - COVER - 0.004), [inside, pageSide, pageEdge, pageEdge, pageSide, pageEdge], 0, h / 2, -0.002 - COVER / 2);
  add(new THREE.BoxGeometry(COVER, h, d), [endpaper, back, cloth, cloth, cloth, cloth], -t / 2 + COVER / 2, h / 2, 0);
  add(new THREE.BoxGeometry(t, h, COVER), [cloth, cloth, cloth, cloth, spine, cloth], 0, h / 2, d / 2 - COVER / 2);

  const frontCover = new THREE.Group();
  frontCover.position.set(t / 2 - COVER / 2, h / 2, d / 2);
  group.add(frontCover);
  const plate = opts.inside && opts.owner
    ? track(new THREE.MeshStandardMaterial({ map: track(bookplateTexture(opts.owner, shade(b.color, -0.05), d, h)), roughness: 0.9 }))
    : endpaper;
  add(new THREE.BoxGeometry(COVER, h, d), [front, plate, cloth, cloth, cloth, cloth], 0, 0, -d / 2, frontCover);

  return {
    group,
    frontCover,
    size: { t, h, d },
    dispose: () => disposables.forEach((x) => x.dispose()),
  };
}

export function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}
