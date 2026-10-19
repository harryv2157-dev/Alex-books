"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { buildBook, bookSize, type Book3DInput, type BookObject } from "@/lib/book3d";

// Ornaments made in Higgsfield. The first few go one per shelf; the rest fill any spare shelf space.
const PROPS = [
  { url: "/models/strelitzia.glb", height: 0.24, width: 0.11 },
  { url: "/models/lamp.glb", height: 0.22, width: 0.12, light: true },
  { url: "/models/plant.glb", height: 0.19, width: 0.13 },
  { url: "/models/candle.glb", height: 0.1, width: 0.1 },
  { url: "/models/mug.glb", height: 0.09, width: 0.1 },
];

const ROW_H = 0.3;
const BOARD = 0.024;
const SIDE = 0.03;
const DEPTH = 0.21;
const GAP = 0.0025;
const PROP_PAD = 0.035;

type Row = { books: { book: Book3DInput; x: number }[]; props: { prop: number; x: number }[]; gap: [number, number] };
type Layout = { rows: Row[]; innerW: number; height: number; pin: { row: number; x: number } };

function layout(books: Book3DInput[], innerW: number): Layout {
  const rows: Row[] = [];
  let i = 0;
  let nextProp = 0;
  const left = -innerW / 2 + 0.012;
  const right = innerW / 2 - 0.012;
  while (i < books.length || rows.length < 2) {
    const r = rows.length;
    const row: Row = { books: [], props: [], gap: [0, 0] };
    // one ornament per shelf, alternating ends
    let start = left;
    let end = right;
    if (nextProp < PROPS.length) {
      const w = PROPS[nextProp].width + PROP_PAD;
      if (r % 2 === 1) {
        row.props.push({ prop: nextProp, x: left + w / 2 });
        start += w;
      } else {
        row.props.push({ prop: nextProp, x: right - w / 2 });
        end -= w;
      }
      nextProp++;
    }
    let x = start;
    while (i < books.length) {
      const { t } = bookSize(books[i]);
      if (x + t > end && row.books.length > 0) break;
      row.books.push({ book: books[i], x: x + t / 2 });
      x += t + GAP;
      i++;
    }
    row.gap = [x + 0.02, end];
    rows.push(row);
  }
  // Leftover ornaments go wherever there's the most free shelf, spread out rather than piled up.
  const free = (r: Row) => r.gap[1] - r.gap[0];
  while (nextProp < PROPS.length) {
    const w = PROPS[nextProp].width + PROP_PAD;
    const row = rows.reduce((a, b) => (free(b) > free(a) ? b : a));
    if (free(row) < w) break;
    const third = Math.min(free(row) / 3, w * 2);
    row.props.push({ prop: nextProp, x: row.gap[0] + Math.max(w / 2, third / 2) });
    row.gap[0] += Math.max(w, third);
    nextProp++;
  }
  // The pin goes on the back wall in the biggest clear space.
  let best = 0;
  rows.forEach((r, k) => free(r) > free(rows[best]) && (best = k));
  const pin =
    free(rows[best]) > 0.09
      ? { row: best, x: (rows[best].gap[0] + rows[best].gap[1]) / 2 }
      : { row: 0, x: rows[0].props[0]?.x ?? 0 };
  return { rows, innerW, height: rows.length * (ROW_H + BOARD) + BOARD, pin };
}

function woodTexture(repeatX: number, repeatY: number) {
  const tex = new THREE.TextureLoader().load("/textures/walnut.jpg");
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 8;
  return tex;
}

export default function Shelf3D({ books, onOpen }: { books: Book3DInput[]; onOpen: (b: Book3DInput) => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  useEffect(() => {
    const el = wrap.current!;
    let last = 0;
    const ro = new ResizeObserver(() => {
      const w = Math.round(el.clientWidth / 40) * 40; // rebuild only on meaningful resizes
      if (w !== last) setWidth((last = w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = wrap.current;
    if (!el || !width) return;

    const innerW = width < 640 ? 0.74 : width < 1000 ? 1.1 : 1.35;
    const L = layout(books, innerW);
    const caseW = innerW + SIDE * 2;
    const caseH = 0.03 + L.height;
    const pxHeight = Math.round(Math.min(width * (caseH / caseW) * 1.12, 2400));
    el.style.height = `${pxHeight}px`;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, pxHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, el.clientWidth / pxHeight, 0.05, 20);
    const halfFov = THREE.MathUtils.degToRad(14);
    const dist = Math.max((caseW * 1.06) / 2 / (Math.tan(halfFov) * camera.aspect), (caseH * 1.06) / 2 / Math.tan(halfFov)) + DEPTH / 2;
    const centre = new THREE.Vector3(0, caseH / 2, 0);
    camera.position.set(0, caseH / 2 + 0.04, dist);
    camera.lookAt(centre);

    // Lighting: warm room light, a key light for shadows, and a soft fill.
    scene.add(new THREE.HemisphereLight("#ffe7c4", "#3a2614", 1.6));
    const key = new THREE.DirectionalLight("#ffd9a3", 2.4);
    key.position.set(caseW * 0.6, caseH + 1.2, 1.8);
    key.target.position.copy(centre);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.01;
    Object.assign(key.shadow.camera, { left: -caseW, right: caseW, top: caseH, bottom: -caseH, near: 0.5, far: 6 });
    scene.add(key, key.target);
    const fill = new THREE.DirectionalLight("#ffe2c0", 0.9);
    fill.position.set(-1.5, caseH * 0.6, 2.5);
    fill.target.position.copy(centre);
    scene.add(fill, fill.target);

    const disposables: { dispose(): void }[] = [];
    const track = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);

    // The bookcase
    const wood = track(new THREE.MeshStandardMaterial({ map: track(woodTexture(caseW / 0.6, 1)), roughness: 0.55, metalness: 0.05 }));
    const woodV = track(new THREE.MeshStandardMaterial({ map: track(woodTexture(caseH / 0.6, 1)), roughness: 0.55, metalness: 0.05 }));
    (woodV.map as THREE.Texture).rotation = Math.PI / 2;
    const backTex = track(new THREE.TextureLoader().load("/textures/backpanel.jpg"));
    backTex.colorSpace = THREE.SRGBColorSpace;
    backTex.wrapS = backTex.wrapT = THREE.RepeatWrapping;
    backTex.repeat.set(caseW / 0.35, caseH / 0.35);
    const backMat = track(new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.95, color: "#9fb59f" }));
    const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(track(new THREE.BoxGeometry(w, h, d)), mat);
      m.position.set(x, y, z);
      m.castShadow = m.receiveShadow = true;
      scene.add(m);
      return m;
    };
    box(caseW, caseH, 0.012, backMat, 0, caseH / 2, -DEPTH / 2).receiveShadow = false;
    box(SIDE, caseH, DEPTH + 0.02, woodV, -caseW / 2 + SIDE / 2, caseH / 2, 0.01);
    box(SIDE, caseH, DEPTH + 0.02, woodV, caseW / 2 - SIDE / 2, caseH / 2, 0.01);
    box(caseW + 0.04, 0.035, DEPTH + 0.05, wood, 0, caseH + 0.0175, 0.02); // crown
    const glow = track(new THREE.MeshBasicMaterial({ color: "#ffcf87", transparent: true, opacity: 0.55 }));
    for (let r = 0; r <= L.rows.length; r++) {
      const y = 0.03 + r * (ROW_H + BOARD) + BOARD / 2;
      box(innerW, BOARD, DEPTH, wood, 0, y, 0);
      box(innerW, 0.012, 0.012, wood, 0, y + 0.006, DEPTH / 2 + 0.004); // lip
      if (r > 0) {
        // a warm strip light tucked under each shelf
        const strip = new THREE.Mesh(track(new THREE.PlaneGeometry(innerW * 0.94, 0.006)), glow);
        strip.rotation.x = Math.PI / 2;
        strip.position.set(0, y - BOARD / 2 - 0.001, DEPTH / 2 - 0.03);
        scene.add(strip);
      }
    }
    box(caseW, 0.03, DEPTH + 0.02, wood, 0, 0.015, 0.01); // plinth

    // Books
    const shelfY = (r: number) => 0.03 + BOARD + (L.rows.length - 1 - r) * (ROW_H + BOARD);
    const objects: { obj: BookObject; book: Book3DInput; base: THREE.Vector3 }[] = [];
    L.rows.forEach((row, r) => {
      for (const { book, x } of row.books) {
        const obj = buildBook(book);
        const { d } = obj.size;
        const base = new THREE.Vector3(x, shelfY(r), DEPTH / 2 - d / 2 - 0.012);
        obj.group.position.copy(base);
        scene.add(obj.group);
        objects.push({ obj, book, base });
      }
    });

    // Ornaments
    const gltf = new GLTFLoader();
    L.rows.forEach((row, r) => {
      row.props.forEach(({ prop, x: px }, k) => {
        const spec = PROPS[prop];
        gltf.load(
          spec.url,
          (g) => {
            const model = g.scene;
            const bounds = new THREE.Box3().setFromObject(model);
            const size = bounds.getSize(new THREE.Vector3());
            const s = Math.min(spec.height / size.y, spec.width / Math.max(size.x, size.z));
            model.scale.setScalar(s);
            bounds.setFromObject(model);
            const c = bounds.getCenter(new THREE.Vector3());
            model.position.set(px - c.x, shelfY(r) - bounds.min.y, -c.z);
            model.rotation.y = (r + k) % 2 ? 0.5 : -0.5;
            model.traverse((o) => {
              if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true;
            });
            scene.add(model);
            if (spec.light) {
              const lamp = new THREE.PointLight("#ffb860", 0.6, 0.9, 2);
              lamp.position.set(px, shelfY(r) + spec.height * 0.8, 0.04);
              scene.add(lamp);
            }
          },
          undefined,
          () => {}, // an ornament failing to load just leaves the space empty
        );
      });
    });

    // A Madeira flag enamel pin, pinned to the linen at the back of the top shelf.
    new THREE.TextureLoader().load("/models/madeira-pin.png", (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      track(tex);
      const pw = 0.07;
      const ph = (pw * tex.image.height) / tex.image.width;
      const wavy = (geo: THREE.PlaneGeometry) => {
        const pos = geo.attributes.position;
        for (let v = 0; v < pos.count; v++) pos.setZ(v, Math.sin((pos.getX(v) / pw) * Math.PI * 1.6) * 0.0025);
        geo.computeVertexNormals();
        return track(geo);
      };
      const pin = new THREE.Group();
      const face = new THREE.Mesh(
        wavy(new THREE.PlaneGeometry(pw, ph, 24, 1)),
        track(new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, roughness: 0.18, metalness: 0.25 })),
      );
      const back = new THREE.Mesh(
        wavy(new THREE.PlaneGeometry(pw, ph, 24, 1)),
        track(new THREE.MeshStandardMaterial({ color: "#c9a14a", alphaMap: tex, alphaTest: 0.5, metalness: 0.9, roughness: 0.3 })),
      );
      back.position.z = -0.0025;
      back.scale.setScalar(1.025);
      face.castShadow = back.castShadow = true;
      pin.add(back, face);
      pin.position.set(L.pin.x, shelfY(L.pin.row) + ROW_H * 0.68, -DEPTH / 2 + 0.01);
      pin.rotation.z = -0.1;
      scene.add(pin);
    });

    // Interaction: books lean out when hovered or touched; a click picks one off the shelf.
    const ray = new THREE.Raycaster();
    const pointer = new THREE.Vector2(10, 10);
    let hovered: number | null = null;
    let parallax = { x: 0, y: 0 };
    const pick = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObjects(objects.map((o) => o.obj.group), true)[0];
      return (hit?.object.userData.bookId as number | undefined) ?? null;
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "mouse") {
        hovered = pick(e);
        renderer.domElement.style.cursor = hovered ? "pointer" : "default";
        const rect = renderer.domElement.getBoundingClientRect();
        parallax = { x: ((e.clientX - rect.left) / rect.width - 0.5) * 2, y: ((e.clientY - rect.top) / rect.height - 0.5) * 2 };
      }
    };
    let downAt = { x: 0, y: 0 };
    const onDown = (e: PointerEvent) => (downAt = { x: e.clientX, y: e.clientY });
    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 8) return; // a scroll, not a tap
      const id = pick(e);
      if (!id) return;
      hovered = id;
      const book = objects.find((o) => o.book.id === id)!.book;
      setTimeout(() => onOpenRef.current(book), e.pointerType === "mouse" ? 0 : 260);
    };
    const onLeave = () => {
      hovered = null;
      parallax = { x: 0, y: 0 };
    };
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointerleave", onLeave);
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      parallax = { x: THREE.MathUtils.clamp(e.gamma / 25, -1, 1), y: THREE.MathUtils.clamp((e.beta - 45) / 30, -1, 1) };
    };
    window.addEventListener("deviceorientation", onTilt);

    let raf = 0;
    const clock = new THREE.Clock();
    const cam = { x: 0, y: 0 };
    const tick = () => {
      const dt = Math.min(clock.getDelta(), 0.05);
      const k = 1 - Math.exp(-dt * 10);
      for (const { obj, book, base } of objects) {
        const on = book.id === hovered;
        const g = obj.group;
        g.position.z += (base.z + (on ? 0.055 : 0) - g.position.z) * k;
        g.position.y += (base.y + (on ? 0.012 : 0) - g.position.y) * k;
        g.rotation.x += ((on ? 0.16 : 0) - g.rotation.x) * k;
      }
      cam.x += (parallax.x * caseW * 0.07 - cam.x) * k * 0.4;
      cam.y += (-parallax.y * caseH * 0.04 - cam.y) * k * 0.4;
      camera.position.set(cam.x, caseH / 2 + 0.04 + cam.y, dist);
      camera.lookAt(centre);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("deviceorientation", onTilt);
      objects.forEach((o) => o.obj.dispose());
      disposables.forEach((d) => d.dispose());
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.geometry.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [books, width]);

  return <div ref={wrap} className="shelf3d" />;
}
