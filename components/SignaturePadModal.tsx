import React, { useRef, useState, useEffect } from 'react';
import { X, Eraser, Check, Printer, PenTool, ShieldCheck } from 'lucide-react';
import { DeliverySignature } from '../types';

interface SignaturePadModalProps {
  ticketId: string;
  customerName: string;
  totalAmount: number;
  existingSignature?: DeliverySignature;
  onClose: () => void;
  onSave: (signature: DeliverySignature, shouldPrint: boolean) => void;
}

const computeSealHash = async (payload: string): Promise<string> => {
  try {
    const bytes = new TextEncoder().encode(payload);
    const digest = await window.crypto.subtle.digest('SHA-256', bytes);
    const hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
    return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
  } catch {
    return `SEAL-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  }
};

export const SignaturePadModal: React.FC<SignaturePadModalProps> = ({
  ticketId,
  customerName,
  totalAmount,
  existingSignature,
  onClose,
  onSave,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStroke, setHasStroke] = useState(false);
  const [signedByName, setSignedByName] = useState(existingSignature?.signedByName || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(e.pointerId);
    const { x, y } = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasStroke(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPoint(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handlePointerUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
  };

  const handleConfirm = async (shouldPrint: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStroke || saving) return;
    setSaving(true);
    try {
      const signedAt = new Date().toISOString();
      const shortDate = new Date(signedAt).toLocaleDateString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      });

      // Stamp non-removable anti-reuse watermark directly onto a copy of the canvas
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = canvas.width;
      exportCanvas.height = canvas.height;
      const eCtx = exportCanvas.getContext('2d');
      if (eCtx) {
        eCtx.drawImage(canvas, 0, 0);
        eCtx.save();
        eCtx.font = 'bold 13px monospace';
        eCtx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        eCtx.textAlign = 'center';
        eCtx.fillText(
          `SOLO ACUSE ENTREGA #${ticketId} • ${shortDate} • $${totalAmount.toFixed(2)}`,
          exportCanvas.width / 2,
          exportCanvas.height - 10
        );
        eCtx.restore();
      }

      const imageDataUrl = exportCanvas.toDataURL('image/png');
      const verificationHash = await computeSealHash(
        `${ticketId}|${totalAmount.toFixed(2)}|${signedByName.trim()}|${signedAt}|${imageDataUrl.slice(0, 128)}`
      );

      onSave(
        {
          imageDataUrl,
          signedByName: signedByName.trim() || undefined,
          signedAt,
          verificationHash,
        },
        shouldPrint
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[160] flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-sm animate-[fadeIn_0.2s]">
      <div className="bg-white dark:bg-slate-900 rounded-t-3xl md:rounded-2xl shadow-2xl max-w-md w-full border border-slate-100 dark:border-slate-800 p-6 animate-[slideUp_0.25s_ease-out]">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <PenTool className="w-5 h-5 text-indigo-500" />
              Firma de Recibido
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Nota <strong>#{ticketId}</strong> • {customerName} • <strong>${totalAmount.toFixed(2)}</strong>
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Consent & Anti-Misuse Notice */}
        <div className="mb-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/80 dark:border-emerald-800/60 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-emerald-800 dark:text-emerald-200 leading-snug">
            <strong>Acuse exclusivo de entrega:</strong> Confirmo recibir la mercancía de la Nota <strong>#{ticketId}</strong> por <strong>${totalAmount.toFixed(2)}</strong>. La firma lleva marca de agua con este folio y sello único; puede usar iniciales o rúbrica corta.
          </p>
        </div>

        <div className="mb-3">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
            Nombre de quien recibe (Opcional)
          </label>
          <input
            type="text"
            value={signedByName}
            onChange={(e) => setSignedByName(e.target.value)}
            placeholder="Ej. Encargado Juan Pérez"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="mb-4">
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Firma / Rúbrica aquí</label>
            <button
              type="button"
              onClick={handleClear}
              className="text-xs font-bold text-slate-500 hover:text-red-500 flex items-center gap-1"
            >
              <Eraser className="w-3.5 h-3.5" /> Limpiar
            </button>
          </div>
          <div className="rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-white overflow-hidden relative">
            <canvas
              ref={canvasRef}
              width={480}
              height={200}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              className="w-full h-44 cursor-crosshair block"
              style={{ touchAction: 'none' }}
            />
            {!hasStroke && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-slate-300 text-xs font-medium">
                Firma o pon tus iniciales aquí
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={!hasStroke || saving}
            onClick={() => handleConfirm(false)}
            className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            <Check className="w-4 h-4" /> Solo Guardar
          </button>
          <button
            type="button"
            disabled={!hasStroke || saving}
            onClick={() => handleConfirm(true)}
            className="flex-[2] py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-lg flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            <Printer className="w-4 h-4" /> {saving ? 'Sellando...' : 'Sellar e Imprimir Ticket'}
          </button>
        </div>
      </div>
    </div>
  );
};
