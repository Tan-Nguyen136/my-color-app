"use client";

import { useEffect, useRef, useState } from "react";
import Vibrant from "node-vibrant";
import namer from "color-namer";

export default function Home() {
  const [preview, setPreview] = useState(null);
  const [palette, setPalette] = useState([]); // {key, hex, name, population}
  const [hoverColor, setHoverColor] = useState(null); // {hex, name, rgb}
  const [pickedColor, setPickedColor] = useState(null); // {hex, name, rgb}
  const [loadingPalette, setLoadingPalette] = useState(false);
  const imgRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    // cleanup object URLs when unmount or new preview
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function safeName(hex) {
    try {
      return namer(hex).basic?.[0]?.name || "Custom Color";
    } catch {
      return "Custom Color";
    }
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    setPalette([]);
    setHoverColor(null);
    setPickedColor(null);
    setLoadingPalette(true);
    // palette extraction will happen in onImageLoad after drawing to canvas
  }

  async function onImageLoad() {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    // draw at natural size for accurate pixel reading
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);

    // prepare downscaled image for Vibrant for speed
    const max = 800;
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    let srcForVibrant = preview;
    if (scale < 1) {
      const off = document.createElement("canvas");
      off.width = Math.round(img.naturalWidth * scale);
      off.height = Math.round(img.naturalHeight * scale);
      const octx = off.getContext("2d");
      octx.drawImage(img, 0, 0, off.width, off.height);
      srcForVibrant = off.toDataURL("image/jpeg", 0.9);
    }

    try {
      const pal = await Vibrant.from(srcForVibrant).maxColorCount(8).getPalette();
      const items = Object.entries(pal)
        .filter(([, v]) => v)
        .map(([key, sw]) => ({
          key,
          hex: sw.getHex(),
          population: sw.getPopulation?.() ?? 0,
          name: safeName(sw.getHex())
        }))
        .sort((a, b) => b.population - a.population);
      setPalette(items);
    } catch (err) {
      console.error("Vibrant error", err);
    } finally {
      setLoadingPalette(false);
    }
  }

  function posToCanvas(e) {
    const img = imgRef.current;
    const rect = img.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * img.naturalWidth);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * img.naturalHeight);
    return { x, y };
  }

  function rgbaToHex(r, g, b) {
    return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
  }

  function readPixel(x, y) {
    const ctx = canvasRef.current.getContext("2d");
    const d = ctx.getImageData(x, y, 1, 1).data;
    const hex = rgbaToHex(d[0], d[1], d[2]);
    const name = safeName(hex);
    return { hex, name, rgb: `rgb(${d[0]}, ${d[1]}, ${d[2]})` };
  }

  function onMove(e) {
    if (!preview) return;
    const { x, y } = posToCanvas(e);
    try {
      setHoverColor(readPixel(x, y));
    } catch {
      // ignore out-of-bounds or security errors
    }
  }

  function onClick(e) {
    if (!preview) return;
    const { x, y } = posToCanvas(e);
    try {
      setPickedColor(readPixel(x, y));
    } catch {}
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      // small feedback
      alert("Copied: " + text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      alert("Copied: " + text);
    }
  }

  // Optional System EyeDropper (Chrome/Edge)
  async function useSystemEyeDropper() {
    if (typeof window === "undefined" || !("EyeDropper" in window)) {
      alert("System EyeDropper not supported in this browser.");
      return;
    }
    try {
      const eye = new window.EyeDropper();
      const res = await eye.open();
      const hex = res.sRGBHex.toUpperCase();
      setPickedColor({ hex, name: safeName(hex), rgb: hex });
    } catch {
      // user canceled or error
    }
  }

  return (
    <div className="min-h-screen p-6 container mx-auto">
      <header className="text-center mb-6">
        <h1 className="text-3xl font-extrabold">🎯 Smart Color Analyzer</h1>
        <p className="text-slate-400 mt-1">Upload an image, hover to preview pixel color, click to lock it.</p>
      </header>

      <section className="mb-6 flex flex-col md:flex-row gap-6">
        <div className="flex-1 card p-4 rounded-2xl bg-slate-800/60 border border-white/5">
          <label className="inline-flex items-center gap-3 cursor-pointer">
            <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
            <span className="btn bg-slate-700/40 px-4 py-2 rounded-lg border border-white/10">📁 Choose Image</span>
          </label>

          <div className="mt-3 flex gap-2">
            {typeof window !== "undefined" && "EyeDropper" in window && (
              <button onClick={useSystemEyeDropper} className="btn">🩸 System Eyedropper</button>
            )}
            <button onClick={() => { setPreview(null); setPalette([]); setHoverColor(null); setPickedColor(null); }} className="btn">Reset</button>
          </div>

          <p className="text-sm text-slate-400 mt-3">Files: JPG / PNG / WebP. Everything runs client-side (no upload to server).</p>
        </div>

        <div className="w-full md:w-2/5 card p-4 rounded-2xl bg-slate-800/60 border border-white/5">
          <h3 className="font-semibold mb-2">Palette</h3>
          {loadingPalette ? (
            <p className="text-sm text-slate-400">Extracting palette…</p>
          ) : palette.length === 0 ? (
            <p className="text-sm text-slate-400">No palette yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {palette.map((p, i) => (
                <div key={i} className="rounded-lg overflow-hidden border border-white/5">
                  <div className="h-20" style={{ backgroundColor: p.hex }} />
                  <div className="p-2">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-slate-300 flex items-center justify-between">
                      <code>{p.hex}</code>
                      <button className="text-xs underline" onClick={() => copyText(p.hex)}>Copy</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Main area */}
      <section className="grid md:grid-cols-2 gap-6">
        <div className="card p-4 rounded-2xl bg-slate-800/60 border border-white/5">
          <div className="relative">
            <canvas ref={canvasRef} className="hidden" />
            {preview ? (
              <img
                ref={imgRef}
                src={preview}
                alt="preview"
                onLoad={onImageLoad}
                onMouseMove={onMove}
                onClick={onClick}
                className="w-full h-auto rounded-lg select-none cursor-crosshair"
              />
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-400 border-dashed border-2 border-white/5 rounded-lg">
                Chưa có ảnh — chọn 1 file để bắt đầu
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {hoverColor && (
            <div className="card p-4 rounded-2xl bg-slate-800/60 border border-white/5">
              <div className="flex items-start gap-4">
                <div className="w-20 h-20 rounded-lg border border-white/5" style={{ backgroundColor: hoverColor.hex }} />
                <div>
                  <div className="font-semibold">👁️ Hover</div>
                  <div className="text-slate-300">{hoverColor.name}</div>
                  <div className="text-slate-400 text-sm">{hoverColor.hex} • {hoverColor.rgb}</div>
                  <div className="mt-2 space-x-2">
                    <button className="btn" onClick={() => copyText(hoverColor.hex)}>Copy HEX</button>
                    <button className="btn" onClick={() => copyText(hoverColor.rgb)}>Copy RGB</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {pickedColor && (
            <div className="card p-4 rounded-2xl bg-slate-800/60 border border-white/5">
              <div className="flex items-start gap-4">
                <div className="w-20 h-20 rounded-lg border border-white/5" style={{ backgroundColor: pickedColor.hex }} />
                <div>
                  <div className="font-semibold">📌 Picked</div>
                  <div className="text-slate-300">{pickedColor.name}</div>
                  <div className="text-slate-400 text-sm">{pickedColor.hex} • {pickedColor.rgb}</div>
                  <div className="mt-2 space-x-2">
                    <button className="btn" onClick={() => copyText(pickedColor.hex)}>Copy HEX</button>
                    <button className="btn" onClick={() => copyText(pickedColor.rgb)}>Copy RGB</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!hoverColor && !pickedColor && (
            <div className="card p-4 rounded-2xl bg-slate-800/60 border border-white/5 text-slate-400">
              Hover trên ảnh để xem màu, click để chọn màu.
            </div>
          )}
        </div>
      </section>

      <footer className="text-center text-xs text-slate-500 mt-8">Built with Next.js + Tailwind + node-vibrant + color-namer. Everything client-side.</footer>
    </div>
  );
}
