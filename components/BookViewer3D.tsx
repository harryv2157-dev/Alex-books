"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { buildBook, type Book3DInput } from "@/lib/book3d";

const OPEN_ANGLE = -3.0;

function shadowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, "rgba(0,0,0,0.55)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/**
 * A single book floating in space. Drag to spin it; tap to open or close the cover.
 * `open` controls whether it starts open (showing progress on the first page).
 */
export default function BookViewer3D({
  book,
  open = false,
  owner,
  className,
}: {
  book: Book3DInput;
  open?: boolean;
  owner?: string | null;
  className?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    const el = wrap.current!;
    const w = el.clientWidth;
    const h = el.clientHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight("#fff1dc", "#3a2616", 1.3));
    const key = new THREE.DirectionalLight("#ffe0b0", 2.2);
    key.position.set(0.6, 1.2, 1.4);
    scene.add(key);
    const rim = new THREE.DirectionalLight("#9fb7ff", 0.8);
    rim.position.set(-1.2, 0.6, -1);
    scene.add(rim);

    const obj = buildBook(book, { inside: true, owner });
    const { h: bh, d } = obj.size;
    const pivot = new THREE.Group(); // spins around the book's centre
    obj.group.position.set(0, -bh / 2, 0);
    pivot.add(obj.group);
    scene.add(pivot);

    const shadowTex = shadowTexture();
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(d * 2.4, d * 1.1),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -bh / 2 - 0.05;
    scene.add(shadow);

    const camera = new THREE.PerspectiveCamera(20, w / h, 0.01, 10);
    const half = THREE.MathUtils.degToRad(10);
    const fit = Math.max((d * 2.25) / 2 / (Math.tan(half) * camera.aspect), (bh * 1.35) / 2 / Math.tan(half));
    camera.position.set(0, 0.02, fit);
    camera.lookAt(0, -0.005, 0);

    // Drag to spin, with a little momentum.
    let spin = 0.35;
    let velocity = 0;
    let dragging = false;
    let lastX = 0;
    let moved = 0;
    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      moved = 0;
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      moved += Math.abs(dx);
      velocity = (dx / w) * 7;
      spin += velocity;
      if (openRef.current && moved > 6) openRef.current = false; // spinning closes the book
    };
    const onUp = () => {
      if (dragging && moved < 6) openRef.current = !openRef.current; // a tap toggles the cover
      dragging = false;
    };
    const el2 = renderer.domElement;
    el2.style.touchAction = "pan-y";
    el2.style.cursor = "grab";
    el2.addEventListener("pointerdown", onDown);
    el2.addEventListener("pointermove", onMove);
    el2.addEventListener("pointerup", onUp);
    el2.addEventListener("pointercancel", onUp);

    let raf = 0;
    const clock = new THREE.Clock();
    let cover = 0;
    let shift = 0;
    const tick = () => {
      const dt = Math.min(clock.getDelta(), 0.05);
      const time = clock.elapsedTime;
      const k = 1 - Math.exp(-dt * 6);
      const isOpen = openRef.current;
      if (!dragging) {
        velocity *= Math.exp(-dt * 3);
        spin += velocity;
        if (Math.abs(velocity) < 0.01) {
          // settle facing forward (gently swaying when closed) so the cover or page can be seen
          const front = Math.round(spin / (Math.PI * 2)) * Math.PI * 2;
          const target = front + (isOpen ? 0 : Math.sin(time * 0.6) * 0.45);
          spin += (target - spin) * k * 0.5;
        }
      }
      cover += ((isOpen ? OPEN_ANGLE : 0) - cover) * k;
      shift += ((isOpen ? d / 2 : 0) - shift) * k;
      obj.frontCover.rotation.y = cover;
      pivot.rotation.y = -Math.PI / 2 + spin;
      pivot.position.x = shift * Math.cos(spin);
      const bob = Math.sin(time * 1.6) * 0.006;
      pivot.position.y = bob;
      pivot.rotation.z = Math.sin(time * 1.1) * 0.025;
      shadow.scale.setScalar(1 - bob * 8);
      (shadow.material as THREE.MeshBasicMaterial).opacity = 0.8 - bob * 10;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    const ro = new ResizeObserver(() => {
      const nw = el.clientWidth;
      const nh = el.clientHeight;
      renderer.setSize(nw, nh);
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
    });
    ro.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      obj.dispose();
      shadowTex.dispose();
      shadow.geometry.dispose();
      (shadow.material as THREE.Material).dispose();
      renderer.dispose();
      el2.remove();
    };
  }, [book, owner]);

  return <div ref={wrap} className={className} style={{ position: "relative" }} />;
}

