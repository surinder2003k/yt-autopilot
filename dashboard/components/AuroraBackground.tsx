"use client";

import { useEffect, useRef } from "react";

export function AuroraBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const blobs = [
      { x: 0.2, y: 0.3, r: 0.5, c: [0, 240, 255], sx: 0.00021, sy: 0.00017 },
      { x: 0.8, y: 0.7, r: 0.45, c: [120, 80, 255], sx: 0.00015, sy: 0.00023 },
      { x: 0.5, y: 0.1, r: 0.4, c: [0, 200, 220], sx: 0.00019, sy: 0.00013 },
    ];

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#06090c";
      ctx.fillRect(0, 0, w, h);
      for (const b of blobs) {
        const cx = (b.x + Math.sin(t * b.sx) * 0.12) * w;
        const cy = (b.y + Math.cos(t * b.sy) * 0.12) * h;
        const rad = b.r * Math.max(w, h);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        g.addColorStop(0, `rgba(${b.c[0]},${b.c[1]},${b.c[2]},0.16)`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full opacity-70"
      aria-hidden
    />
  );
}
