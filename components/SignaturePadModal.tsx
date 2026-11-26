import React, { useRef, useState, useEffect } from 'react';
import { X, Eraser, Check, Printer, PenTool } from 'lucide-react';
import { DeliverySignature } from '../types';

interface SignaturePadModalProps {
  ticketId: string;
  customerName: string;
  existingSignature?: DeliverySignature;
  onClose: () => void;
  onSave: (signature: DeliverySignature, shouldPrint: boolean) => void;
}

export const SignaturePadModal: React.FC<SignaturePadModalProps> = ({
  ticketId,
  customerName,
  existingSignature,
  onClose,
  onSave,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStroke, setHasStroke] = useState(false);
  const [signedByName, setSignedByName] = useState(existingSignature?.signedByName || '');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Pure white background for crisp 58mm thermal printing
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

  const handleConfirm = (shouldPrint: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStroke) return;
    const imageDataUrl = canvas.toDataURL('image/png');
    onSave(
      {
        imageDataUrl,
        signedByName: signedByName.trim() || undefined,
        signedAt: new Date().toISOString(),
      },
      shouldPrint
    );
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[160] flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-sm animate-[fadeIn_0.2s]">
      <div className="bg-white dark:bg-slate-900 rounded-t-3xl md:rounded-2xl shadow-2xl max-w-md w-full border border-slate-100 dark:border-slate-800 p-6 animate-[slideUp_0.25s_ease-out]">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <PenTool className="w-5 h-5 text-indigo-500" />
              Firma de Recibido
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Nota <strong>#{ticketId}</strong> • {customerName}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
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
            <label className="text-xs font-bold text-slate-500 uppercase">Firma aquí con el dedo o mouse</label>
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
                Firma dentro del recuadro
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={!hasStroke}
            onClick={() => handleConfirm(false)}
            className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            <Check className="w-4 h-4" /> Solo Guardar
          </button>
          <button
            type="button"
            disabled={!hasStroke}
            onClick={() => handleConfirm(true)}
            className="flex-[2] py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-lg flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            <Printer className="w-4 h-4" /> Guardar e Imprimir Ticket
          </button>
        </div>
      </div>
    </div>
  );
};
