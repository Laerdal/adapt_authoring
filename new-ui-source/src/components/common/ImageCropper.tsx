import { useState, useRef, useEffect, useCallback } from "react";

interface ImageCropperProps {
  src: string;
  aspectRatio?: number; // width / height, default 16/9
  onApply: (croppedDataUrl: string) => void;
  onCancel: () => void;
}

type Handle = "tl" | "tr" | "bl" | "br" | "t" | "b" | "l" | "r";

// Crop box in image-pixel coordinates
interface CropBox { x: number; y: number; w: number; h: number }

const MIN_CROP = 40; // minimum crop dimension in display px

export default function ImageCropper({ src, aspectRatio, onApply, onCancel }: ImageCropperProps) {
  const FRAME_W = 480;
  const FRAME_H = 270; // display frame size (always 16:9 container)

  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  // Image display: scale + offset inside the FRAME
  const [imgScale, setImgScale] = useState(1);
  const [imgOffset, setImgOffset] = useState({ x: 0, y: 0 });
  // Crop box in DISPLAY coordinates (relative to frame top-left)
  const [crop, setCrop] = useState<CropBox>({ x: 0, y: 0, w: FRAME_W, h: FRAME_H });

  const frameRef = useRef<HTMLDivElement>(null);
  const dragMode = useRef<"pan" | Handle | null>(null);
  const dragStart = useRef({ mx: 0, my: 0, crop: { x: 0, y: 0, w: 0, h: 0 }, imgOffset: { x: 0, y: 0 } });

  // Load image, fit to fill the frame, set initial full crop
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      setImgSize({ w: iw, h: ih });
      const s = Math.max(FRAME_W / iw, FRAME_H / ih);
      setImgScale(s);
      const ox = (FRAME_W - iw * s) / 2;
      const oy = (FRAME_H - ih * s) / 2;
      setImgOffset({ x: ox, y: oy });
      // Initial crop = full frame
      setCrop({ x: 0, y: 0, w: FRAME_W, h: FRAME_H });
    };
    img.src = src;
  }, [src]);

  // Clamp image offset so it always covers the crop box
  const clampImgOffset = useCallback(
    (ox: number, oy: number, s: number, cropBox: CropBox) => {
      const sw = imgSize.w * s;
      const sh = imgSize.h * s;
      // image left edge must be <= crop left edge
      const maxX = cropBox.x;
      // image right edge must be >= crop right edge
      const minX = cropBox.x + cropBox.w - sw;
      // same vertically
      const maxY = cropBox.y;
      const minY = cropBox.y + cropBox.h - sh;
      return {
        x: Math.min(maxX, Math.max(minX, ox)),
        y: Math.min(maxY, Math.max(minY, oy)),
      };
    },
    [imgSize]
  );

  // ── Pointer events ──
  function hitHandle(e: React.PointerEvent): Handle | null {
    if (!frameRef.current) return null;
    const rect = frameRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { x, y, w, h } = crop;
    const HIT = 12; // hit area radius in px

    const onL = Math.abs(mx - x) < HIT;
    const onR = Math.abs(mx - (x + w)) < HIT;
    const onT = Math.abs(my - y) < HIT;
    const onB = Math.abs(my - (y + h)) < HIT;
    const inH = mx > x - HIT && mx < x + w + HIT;
    const inV = my > y - HIT && my < y + h + HIT;

    if (onT && onL) return "tl";
    if (onT && onR) return "tr";
    if (onB && onL) return "bl";
    if (onB && onR) return "br";
    if (onT && inH) return "t";
    if (onB && inH) return "b";
    if (onL && inV) return "l";
    if (onR && inV) return "r";
    return null;
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!frameRef.current) return;
    const rect = frameRef.current.getBoundingClientRect();
    const handle = hitHandle(e);
    dragMode.current = handle ?? "pan";
    dragStart.current = {
      mx: e.clientX - rect.left,
      my: e.clientY - rect.top,
      crop: { ...crop },
      imgOffset: { ...imgOffset },
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragMode.current || !frameRef.current) return;
    const rect = frameRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const dx = mx - dragStart.current.mx;
    const dy = my - dragStart.current.my;
    const sc = dragStart.current.crop;
    const imgW = imgSize.w * imgScale;
    const imgH = imgSize.h * imgScale;

    if (dragMode.current === "pan") {
      // Pan the image under the crop box
      const newOff = clampImgOffset(
        dragStart.current.imgOffset.x + dx,
        dragStart.current.imgOffset.y + dy,
        imgScale,
        crop
      );
      setImgOffset(newOff);
      return;
    }

    // Handle resize — compute new crop in display coords, constrained to image bounds
    let { x, y, w, h } = sc;
    const imgLeft = imgOffset.x;
    const imgTop = imgOffset.y;
    const imgRight = imgOffset.x + imgW;
    const imgBottom = imgOffset.y + imgH;

    const handle = dragMode.current;

    if (handle === "tl" || handle === "l" || handle === "bl") {
      const newX = Math.min(sc.x + dx, sc.x + sc.w - MIN_CROP);
      const clampedX = Math.max(imgLeft, newX);
      w = sc.x + sc.w - clampedX;
      x = clampedX;
    }
    if (handle === "tr" || handle === "r" || handle === "br") {
      const newRight = Math.max(sc.x + sc.w + dx, sc.x + MIN_CROP);
      w = Math.min(imgRight, newRight) - x;
    }
    if (handle === "tl" || handle === "t" || handle === "tr") {
      const newY = Math.min(sc.y + dy, sc.y + sc.h - MIN_CROP);
      const clampedY = Math.max(imgTop, newY);
      h = sc.y + sc.h - clampedY;
      y = clampedY;
    }
    if (handle === "bl" || handle === "b" || handle === "br") {
      const newBottom = Math.max(sc.y + sc.h + dy, sc.y + MIN_CROP);
      h = Math.min(imgBottom, newBottom) - y;
    }

    // If aspect ratio locked, adjust to maintain ratio
    if (aspectRatio) {
      if (handle === "tl" || handle === "tr" || handle === "bl" || handle === "br") {
        // use whichever dimension changed more, lock the other
        const dw = Math.abs(w - sc.w);
        const dh = Math.abs(h - sc.h);
        if (dw >= dh) {
          h = w / aspectRatio;
          if (handle === "tl" || handle === "tr") y = sc.y + sc.h - h;
        } else {
          w = h * aspectRatio;
          if (handle === "tl" || handle === "bl") x = sc.x + sc.w - w;
        }
      }
    }

    if (w > 0 && h > 0) setCrop({ x, y, w, h });
  }

  function onPointerUp() {
    dragMode.current = null;
  }

  // Scroll to zoom image
  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    const minS = imgSize.w ? Math.max(FRAME_W / imgSize.w, FRAME_H / imgSize.h) : 1;
    setImgScale((prev) => {
      const next = Math.min(4, Math.max(minS, prev + delta));
      // zoom toward frame center, then re-clamp
      const cx = FRAME_W / 2;
      const cy = FRAME_H / 2;
      const ratio = next / prev;
      const nx = cx - ratio * (cx - imgOffset.x);
      const ny = cy - ratio * (cy - imgOffset.y);
      setImgOffset(clampImgOffset(nx, ny, next, crop));
      return next;
    });
  }

  // Cursor based on what's under pointer
  function getCursor(e: React.PointerEvent): string {
    const handle = hitHandle(e);
    if (!handle) return dragMode.current === "pan" ? "grabbing" : "grab";
    const map: Record<Handle, string> = {
      tl: "nwse-resize", br: "nwse-resize",
      tr: "nesw-resize", bl: "nesw-resize",
      t: "ns-resize", b: "ns-resize",
      l: "ew-resize", r: "ew-resize",
    };
    return map[handle];
  }

  const [cursor, setCursor] = useState("grab");

  function onPointerMoveForCursor(e: React.PointerEvent) {
    if (!dragMode.current) setCursor(getCursor(e));
    onPointerMove(e);
  }

  // Reset crop to full image
  function reset() {
    if (!imgSize.w) return;
    const s = Math.max(FRAME_W / imgSize.w, FRAME_H / imgSize.h);
    setImgScale(s);
    const ox = (FRAME_W - imgSize.w * s) / 2;
    const oy = (FRAME_H - imgSize.h * s) / 2;
    setImgOffset({ x: ox, y: oy });
    setCrop({ x: 0, y: 0, w: FRAME_W, h: FRAME_H });
  }

  // Apply: render only the cropped region to canvas
  function apply() {
    if (!imgSize.w) return;
    // Convert crop box (display px) back to image-pixel coordinates
    const sx = (crop.x - imgOffset.x) / imgScale;
    const sy = (crop.y - imgOffset.y) / imgScale;
    const sw = crop.w / imgScale;
    const sh = crop.h / imgScale;

    const outW = Math.round(sw);
    const outH = Math.round(sh);
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d")!;
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
      onApply(canvas.toDataURL("image/jpeg", 0.92));
    };
    img.src = src;
  }

  const scaledW = imgSize.w * imgScale;
  const scaledH = imgSize.h * imgScale;

  // Dim regions outside crop box using four rects
  const { x: cx, y: cy, w: cw, h: ch } = crop;

  return (
    <div className="flex flex-col gap-4">
      {/* Frame */}
      <div
        ref={frameRef}
        className="relative overflow-hidden rounded-xl select-none border border-[#d1d5db] bg-[#1a1a1a]"
        style={{ width: FRAME_W, height: FRAME_H, maxWidth: "100%", touchAction: "none", cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMoveForCursor}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onWheel={onWheel}
      >
        {/* Image */}
        {imgSize.w > 0 && (
          <img
            src={src}
            alt="crop preview"
            draggable={false}
            style={{
              position: "absolute",
              left: imgOffset.x,
              top: imgOffset.y,
              width: scaledW,
              height: scaledH,
              userSelect: "none",
              pointerEvents: "none",
            }}
          />
        )}

        {/* Dim overlay — four rectangles around the crop box */}
        {imgSize.w > 0 && (
          <svg
            className="absolute inset-0 pointer-events-none"
            width={FRAME_W}
            height={FRAME_H}
            style={{ position: "absolute", top: 0, left: 0 }}
          >
            {/* top */}
            <rect x={0} y={0} width={FRAME_W} height={cy} fill="rgba(0,0,0,0.5)" />
            {/* bottom */}
            <rect x={0} y={cy + ch} width={FRAME_W} height={FRAME_H - cy - ch} fill="rgba(0,0,0,0.5)" />
            {/* left */}
            <rect x={0} y={cy} width={cx} height={ch} fill="rgba(0,0,0,0.5)" />
            {/* right */}
            <rect x={cx + cw} y={cy} width={FRAME_W - cx - cw} height={ch} fill="rgba(0,0,0,0.5)" />

            {/* Rule-of-thirds inside crop box */}
            {[1, 2].map((n) => (
              <g key={n} stroke="rgba(255,255,255,0.3)" strokeWidth="0.5">
                <line x1={cx + (cw / 3) * n} y1={cy} x2={cx + (cw / 3) * n} y2={cy + ch} />
                <line x1={cx} y1={cy + (ch / 3) * n} x2={cx + cw} y2={cy + (ch / 3) * n} />
              </g>
            ))}

            {/* Crop border */}
            <rect x={cx} y={cy} width={cw} height={ch} fill="none" stroke="white" strokeWidth="1.5" />
          </svg>
        )}

        {/* Corner + edge handles */}
        {imgSize.w > 0 && (
          <>
            {/* Corner handles */}
            {([
              ["tl", cx,      cy,      "nwse-resize"],
              ["tr", cx + cw, cy,      "nesw-resize"],
              ["bl", cx,      cy + ch, "nesw-resize"],
              ["br", cx + cw, cy + ch, "nwse-resize"],
            ] as [Handle, number, number, string][]).map(([, hx, hy, cur]) => (
              <div
                key={`${hx}-${hy}`}
                className="absolute pointer-events-none"
                style={{
                  left: hx - 6, top: hy - 6,
                  width: 12, height: 12,
                  background: "white",
                  border: "2px solid #2d6fa8",
                  borderRadius: 3,
                  cursor: cur,
                  pointerEvents: "none",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
                }}
              />
            ))}

            {/* Edge handles */}
            {([
              ["t",  cx + cw / 2, cy,       "ns-resize"],
              ["b",  cx + cw / 2, cy + ch,   "ns-resize"],
              ["l",  cx,          cy + ch / 2, "ew-resize"],
              ["r",  cx + cw,     cy + ch / 2, "ew-resize"],
            ] as [Handle, number, number, string][]).map(([, hx, hy, cur]) => (
              <div
                key={`e-${hx}-${hy}`}
                className="absolute pointer-events-none"
                style={{
                  left: hx - 5, top: hy - 5,
                  width: 10, height: 10,
                  background: "white",
                  border: "1.5px solid #2d6fa8",
                  borderRadius: 2,
                  cursor: cur,
                  pointerEvents: "none",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
                }}
              />
            ))}
          </>
        )}

        {/* Hint */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-[10px] px-2.5 py-1 rounded-full pointer-events-none whitespace-nowrap">
          Drag handles to crop · Drag image to pan · Scroll to zoom
        </div>
      </div>

      {/* Size readout + reset */}
      <div className="flex items-center justify-between text-xs text-[#6b7280]">
        <span>
          {imgSize.w > 0
            ? `${Math.round(crop.w / imgScale)} × ${Math.round(crop.h / imgScale)} px`
            : ""}
        </span>
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e5e7eb] bg-white hover:bg-[#f3f4f6] text-[#374151] text-xs font-medium transition-colors"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
          </svg>
          Reset
        </button>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#d1d5db] rounded-lg hover:bg-[#f9fafb] transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={apply}
          className="px-4 py-2 text-sm font-medium text-white bg-[#2d6fa8] hover:bg-[#245c8f] rounded-lg transition-colors"
        >
          Apply Crop
        </button>
      </div>
    </div>
  );
}
