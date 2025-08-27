"use client";
import { useEffect, useRef, useState } from "react";

export default function Home() {
  const [preview, setPreview] = useState(null);
  const [palette, setPalette] = useState([]);
  const [hoverColor, setHoverColor] = useState(null);
  const [pickedColors, setPickedColors] = useState([]);
  const [loadingPalette, setLoadingPalette] = useState(false);
  const [copiedColor, setCopiedColor] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const imgRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function safeName(hex) {
    return getColorName(hex);
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      return;
    }

    const url = URL.createObjectURL(file);
    setPreview(url);
    setPalette([]);
    setHoverColor(null);
    setPickedColors([]);
    setLoadingPalette(true);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      setPalette([]);
      setHoverColor(null);
      setPickedColors([]);
      setLoadingPalette(true);
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    setIsDragging(false);
  }

  async function onImageLoad() {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);

    try {
      // Extract actual dominant colors from the image
      const dominantColors = await extractDominantColors(canvas);
      setPalette(dominantColors);
      setLoadingPalette(false);
    } catch (err) {
      console.error("Palette extraction error", err);
      setLoadingPalette(false);
    }
  }

  async function extractDominantColors(canvas) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Sample pixels (every 10th pixel to improve performance)
    const colorCounts = {};
    const sampleRate = 10;
    
    for (let i = 0; i < data.length; i += 4 * sampleRate) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const alpha = data[i + 3];
      
      // Skip transparent pixels
      if (alpha < 128) continue;
      
      // Reduce color precision for better grouping (divide by 16 and multiply back)
      const reducedR = Math.floor(r / 16) * 16;
      const reducedG = Math.floor(g / 16) * 16;
      const reducedB = Math.floor(b / 16) * 16;
      
      const colorKey = `${reducedR},${reducedG},${reducedB}`;
      colorCounts[colorKey] = (colorCounts[colorKey] || 0) + 1;
    }
    
    // Sort colors by frequency and get top 8
    const sortedColors = Object.entries(colorCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 8);
    
    // Convert to our color format
    return sortedColors.map(([colorKey, count], index) => {
      const [r, g, b] = colorKey.split(',').map(Number);
      const hex = rgbaToHex(r, g, b);
      return {
        key: `dominant-${index}`,
        hex,
        population: count,
        name: getColorName(hex)
      };
    });
  }

  function getColorName(hex) {
    // Enhanced color naming system
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    
    // Calculate HSL for better color classification
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    const lightness = (max + min) / 2;
    
    // Classify by lightness first
    if (lightness < 30) return 'Dark Shade';
    if (lightness > 225) return 'Light Shade';
    
    // Then by dominant color
    if (diff < 30) {
      // Grayscale
      if (lightness < 85) return 'Dark Gray';
      if (lightness < 170) return 'Medium Gray';
      return 'Light Gray';
    }
    
    // Color classification
    if (r > g && r > b) {
      if (g > b * 1.5) return 'Orange Tone';
      if (b > g * 1.5) return 'Magenta Tone';
      return 'Red Tone';
    }
    
    if (g > r && g > b) {
      if (r > b * 1.2) return 'Yellow Tone';
      if (b > r * 1.2) return 'Cyan Tone';
      return 'Green Tone';
    }
    
    if (b > r && b > g) {
      if (r > g * 1.2) return 'Purple Tone';
      if (g > r * 1.2) return 'Teal Tone';
      return 'Blue Tone';
    }
    
    return 'Mixed Tone';
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
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return null;
    
    try {
      const d = ctx.getImageData(x, y, 1, 1).data;
      const hex = rgbaToHex(d[0], d[1], d[2]);
      const name = safeName(hex);
      return { hex, name, rgb: `rgb(${d[0]}, ${d[1]}, ${d[2]})` };
    } catch {
      return null;
    }
  }

  function onMove(e) {
    if (!preview) return;
    const { x, y } = posToCanvas(e);
    const color = readPixel(x, y);
    if (color) setHoverColor(color);
  }

  function onClick(e) {
    if (!preview) return;
    const { x, y } = posToCanvas(e);
    const color = readPixel(x, y);
    if (color) {
      // Check if color already exists in picked colors
      const exists = pickedColors.find(c => c.hex === color.hex);
      if (!exists && pickedColors.length < 4) {
        setPickedColors([...pickedColors, { ...color, id: Date.now() }]);
      }
    }
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedColor(text);
      setTimeout(() => setCopiedColor(null), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopiedColor(text);
      setTimeout(() => setCopiedColor(null), 2000);
    }
  }

  async function useSystemEyeDropper() {
    if (typeof window === "undefined" || !("EyeDropper" in window)) {
      alert("System EyeDropper not supported in this browser.");
      return;
    }
    try {
      const eye = new window.EyeDropper();
      const res = await eye.open();
      const hex = res.sRGBHex.toUpperCase();
      const color = { hex, name: safeName(hex), rgb: hex };
      const exists = pickedColors.find(c => c.hex === color.hex);
      if (!exists && pickedColors.length < 4) {
        setPickedColors([...pickedColors, { ...color, id: Date.now() }]);
      }
    } catch {
      // user canceled or error
    }
  }

  function addPaletteColor(color) {
    const exists = pickedColors.find(c => c.hex === color.hex);
    if (!exists && pickedColors.length < 4) {
      setPickedColors([...pickedColors, { ...color, id: Date.now() }]);
    }
  }

  function removePaletteColor(id) {
    setPickedColors(pickedColors.filter(c => c.id !== id));
  }

  function resetAll() {
    setPreview(null);
    setPalette([]);
    setHoverColor(null);
    setPickedColors([]);
    setLoadingPalette(false);
  }

  return (
    <div className="min-h-screen bg-slate-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Compact Header */}
        <header className="text-center mb-6">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
              <span className="text-2xl">🎨</span>
            </div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Smart Color Analyzer
            </h1>
          </div>
          <p className="text-slate-400 text-sm">Upload an image, hover for preview, click to pick colors</p>
        </header>

        {/* Main Layout - Single Row */}
        <div className="grid grid-cols-12 gap-4 h-[calc(100vh-200px)]">
          
          {/* Upload & Controls - Compact */}
          <div className="col-span-12 lg:col-span-3">
            <div 
              className={`bg-slate-800/60 backdrop-blur-xl border ${isDragging ? 'border-purple-400' : 'border-white/10'} rounded-xl p-4 h-full flex flex-col`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              {/* Upload Button */}
              <label className="cursor-pointer block mb-3">
                <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 py-3 rounded-lg font-medium transition-all duration-300 text-center flex items-center justify-center gap-2">
                  <span className="text-lg">📁</span>
                  Choose Image
                </div>
              </label>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {typeof window !== "undefined" && "EyeDropper" in window && (
                  <button 
                    onClick={useSystemEyeDropper}
                    className="bg-slate-700/60 hover:bg-slate-600/60 text-slate-200 px-3 py-2 rounded-lg text-sm transition-all duration-300 border border-white/10 flex items-center justify-center gap-1"
                  >
                    <span>👁️</span>
                    Eyedropper
                  </button>
                )}
                <button 
                  onClick={resetAll}
                  className="bg-slate-700/60 hover:bg-slate-600/60 text-slate-200 px-3 py-2 rounded-lg text-sm transition-all duration-300 border border-white/10 flex items-center justify-center gap-1"
                >
                  <span>🔄</span>
                  Reset
                </button>
              </div>

              {/* Palette Section */}
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                  <span className="text-lg">🎨</span>
                  Dominant Colors
                </h3>
                
                {loadingPalette ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                      Extracting...
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[...Array(8)].map((_, i) => (
                        <div key={i} className="animate-pulse bg-slate-700/50 rounded-lg h-12"></div>
                      ))}
                    </div>
                  </div>
                ) : palette.length === 0 ? (
                  <div className="text-center py-6 text-slate-400">
                    <span className="text-3xl block mb-2">⚡</span>
                    <p className="text-sm">Upload to see colors</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    {palette.map((p, i) => (
                      <div key={i} className="group bg-slate-700/30 rounded-lg overflow-hidden border border-white/5 hover:border-white/20 transition-all duration-300">
                        <div className="h-6" style={{ backgroundColor: p.hex }} />
                        <div className="p-1">
                          <div className="font-medium text-white text-xs truncate">{p.name}</div>
                          <div className="text-slate-300 text-xs font-mono mb-1">{p.hex}</div>
                          <button 
                            className="text-xs px-1 py-0.5 bg-white/10 hover:bg-white/20 rounded transition-colors duration-200 flex items-center gap-1 w-full justify-center"
                            onClick={() => addPaletteColor(p)}
                            disabled={pickedColors.length >= 4 || pickedColors.some(c => c.hex === p.hex)}
                          >
                            <span className="text-xs">➕</span>
                            <span className="text-xs">{pickedColors.some(c => c.hex === p.hex) ? 'Added' : pickedColors.length >= 4 ? 'Full' : 'Add'}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Image Preview - Large */}
          <div className="col-span-12 lg:col-span-6">
            <div className="bg-slate-800/60 backdrop-blur-xl border border-white/10 rounded-xl p-4 h-full">
              <canvas ref={canvasRef} className="hidden" />
              {preview ? (
                <div className="relative h-full">
                  <img
                    ref={imgRef}
                    src={preview}
                    alt="Color analysis preview"
                    onLoad={onImageLoad}
                    onMouseMove={onMove}
                    onClick={onClick}
                    className="w-full h-full object-contain rounded-lg select-none cursor-crosshair"
                  />
                  <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md rounded-lg px-3 py-1 text-white text-xs">
                    Click to pick • {pickedColors.length}/4 selected
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 border-dashed border-2 border-white/10 rounded-lg">
                  <span className="text-6xl mb-4 opacity-50">📷</span>
                  <p className="text-xl font-medium mb-2">No image selected</p>
                  <p className="text-sm text-center">Drag & drop or choose a file<br />Supports JPG, PNG, WebP</p>
                </div>
              )}
            </div>
          </div>

          {/* Color Info Panel - Compact */}
          <div className="col-span-12 lg:col-span-3">
            <div className="bg-slate-800/60 backdrop-blur-xl border border-white/10 rounded-xl p-4 h-full flex flex-col gap-4">
              
              {/* Hover Preview */}
              {hoverColor && (
                <div className="bg-slate-700/40 rounded-lg p-3">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-lg border-2 border-white/20 flex-shrink-0" style={{ backgroundColor: hoverColor.hex }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">👁️</span>
                        <span className="font-bold text-white text-sm">Hover</span>
                      </div>
                      <div className="text-slate-200 text-sm font-medium truncate">{hoverColor.name}</div>
                      <div className="text-slate-400 text-xs font-mono">{hoverColor.hex}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      className="text-xs px-2 py-1 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-300 rounded transition-colors duration-200 flex items-center justify-center gap-1"
                      onClick={() => copyText(hoverColor.hex)}
                    >
                      <span className="text-xs">📋</span>
                      HEX
                    </button>
                    <button 
                      className="text-xs px-2 py-1 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-300 rounded transition-colors duration-200 flex items-center justify-center gap-1"
                      onClick={() => copyText(hoverColor.rgb)}
                    >
                      <span className="text-xs">📋</span>
                      RGB
                    </button>
                  </div>
                </div>
              )}

              {/* Picked Colors */}
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                  <span className="text-lg">📌</span>
                  Picked ({pickedColors.length}/4)
                </h3>
                
                {pickedColors.length === 0 ? (
                  <div className="text-center py-6 text-slate-400">
                    <div className="w-12 h-12 bg-slate-600/50 rounded-full flex items-center justify-center mx-auto mb-3">
                      <span className="text-2xl">👁️</span>
                    </div>
                    <p className="text-sm">Click on image or add from palette</p>
                    <p className="text-xs mt-1">Maximum 4 colors</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pickedColors.map((color) => (
                      <div key={color.id} className="bg-slate-700/40 rounded-lg p-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg border-2 border-white/20 flex-shrink-0" style={{ backgroundColor: color.hex }} />
                          <div className="flex-1 min-w-0">
                            <div className="text-slate-200 text-sm font-medium truncate">{color.name}</div>
                            <div className="text-slate-400 text-xs font-mono">{color.hex}</div>
                          </div>
                          <button 
                            className="text-red-400 hover:text-red-300 p-1"
                            onClick={() => removePaletteColor(color.id)}
                          >
                            <span className="text-sm">✕</span>
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <button 
                            className="text-xs px-2 py-1 bg-pink-600/20 hover:bg-pink-600/30 text-pink-300 rounded transition-colors duration-200 flex items-center justify-center gap-1"
                            onClick={() => copyText(color.hex)}
                          >
                            <span className="text-xs">📋</span>
                            HEX
                          </button>
                          <button 
                            className="text-xs px-2 py-1 bg-pink-600/20 hover:bg-pink-600/30 text-pink-300 rounded transition-colors duration-200 flex items-center justify-center gap-1"
                            onClick={() => copyText(color.rgb)}
                          >
                            <span className="text-xs">📋</span>
                            RGB
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Copy Notification */}
        {copiedColor && (
          <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm">
            <span>📋</span>
            <span>Copied {copiedColor}!</span>
          </div>
        )}

        {/* Compact Footer */}
        <footer className="text-center text-slate-500 mt-4 text-xs">
          Built with Next.js • Tailwind • All client-side processing
        </footer>
      </div>
    </div>
  );
}