import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Eraser } from 'lucide-react';

// A canvas the user signs on with a mouse, finger or stylus. The canvas is
// backed at 2x the CSS size so the exported PNG stays crisp when the PDF scales
// it down into the signatory box.
const SCALE = 2;

export const SignaturePad = forwardRef(function SignaturePad({ onChange, height = 180 }, ref) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const lastPoint = useRef(null);
  const [hasInk, setHasInk] = useState(false);

  // Size the backing store to the element's real width. Done on mount and on
  // resize, since a container that changes width would otherwise stretch the
  // strokes already drawn.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const { width } = canvas.getBoundingClientRect();
      if (!width) return;
      canvas.width = width * SCALE;
      canvas.height = height * SCALE;
      const ctx = canvas.getContext('2d');
      ctx.scale(SCALE, SCALE);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0f172a';
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [height]);

  const pointFrom = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e) => {
    e.preventDefault();
    canvasRef.current.setPointerCapture(e.pointerId);
    drawing.current = true;
    lastPoint.current = pointFrom(e);
  };

  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const point = pointFrom(e);
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPoint.current = point;
    if (!hasInk) setHasInk(true);
  };

  const end = (e) => {
    if (!drawing.current) return;
    drawing.current = false;
    lastPoint.current = null;
    // A single tap leaves a dot but never fires move — mark it as ink so the
    // pad is not reported empty.
    if (!hasInk) setHasInk(true);
    onChange?.();
  };

  const clear = () => {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    onChange?.();
  };

  useImperativeHandle(ref, () => ({
    isEmpty: () => !hasInk,
    clear,
    // Trims the transparent margin so the saved mark is the signature itself,
    // not a mostly-empty rectangle that the PDF would then shrink to nothing.
    toDataUrl: () => {
      const canvas = canvasRef.current;
      if (!canvas || !hasInk) return '';

      const ctx = canvas.getContext('2d');
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;

      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          if (data[(y * canvas.width + x) * 4 + 3] > 0) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX < 0) return '';

      const pad = 8;
      minX = Math.max(minX - pad, 0);
      minY = Math.max(minY - pad, 0);
      maxX = Math.min(maxX + pad, canvas.width - 1);
      maxY = Math.min(maxY + pad, canvas.height - 1);

      const out = document.createElement('canvas');
      out.width = maxX - minX + 1;
      out.height = maxY - minY + 1;
      out.getContext('2d').drawImage(
        canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height
      );
      return out.toDataURL('image/png');
    }
  }), [hasInk]);

  return (
    <div>
      <div className="relative rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 overflow-hidden">
        <canvas
          ref={canvasRef}
          style={{ height: `${height}px` }}
          className="w-full block touch-none cursor-crosshair"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          onPointerCancel={end}
        />
        {!hasInk && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-sm text-slate-400">Sign here using your mouse or finger</span>
          </div>
        )}
        {/* The ruled line signatures are normally written on. */}
        <div className="absolute left-8 right-8 border-b border-slate-300 pointer-events-none"
          style={{ bottom: '28px' }} />
      </div>
      <div className="flex justify-end mt-2">
        <button
          type="button"
          onClick={clear}
          disabled={!hasInk}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Eraser className="w-3.5 h-3.5" />
          Clear
        </button>
      </div>
    </div>
  );
});
