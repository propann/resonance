import React from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { op1Fill, type Op1PatchKind } from '../services/op1PatchFile';

interface Op1FillGaugeProps {
  kind: Op1PatchKind;
  /** Seconds of audio the patch currently holds. */
  usedSec: number;
  /** Pads that hold a sound. Drum kits only. */
  padsUsed?: number;
  /** Average seconds per pad so far, for the "room for about N more" line. */
  averagePadSec?: number;
  className?: string;
}

/** Comfortable, close to the edge, or past it. */
function toneFor(ratio: number): { bar: string; text: string; border: string } {
  if (ratio > 1) return { bar: 'bg-[#EF4444]', text: 'text-[#F87171]', border: 'border-[#EF4444]/40' };
  if (ratio > 0.85) return { bar: 'bg-[#F59E0B]', text: 'text-[#FBBF24]', border: 'border-[#F59E0B]/40' };
  return { bar: 'bg-[#10B981]', text: 'text-[#34D399]', border: 'border-[#10B981]/40' };
}

/**
 * How full a patch is, and whether another sound will fit.
 *
 * The machine's limits differ by patch kind and there is no warning on the
 * device — it simply truncates. A kit has 12 seconds across 24 pads, a sampler
 * patch has 6 for a single sound, and an engine patch has no audio at all: it
 * carries settings, so asking how full it is means nothing and the gauge says
 * so rather than drawing an empty bar.
 */
export const Op1FillGauge: React.FC<Op1FillGaugeProps> = ({
  kind,
  usedSec,
  padsUsed = 0,
  averagePadSec,
  className = '',
}) => {
  const fill = op1Fill(kind, usedSec, padsUsed);

  if (fill.budgetSec === 0) {
    return (
      <div className={`flex items-center gap-2 text-[10px] font-mono text-[#8A8F9E] ${className}`}>
        <span className="px-2 py-0.5 rounded border border-[#3A3F52] bg-[#14161F]">
          patch moteur — réglages, pas de son
        </span>
      </div>
    );
  }

  const tone = toneFor(fill.ratio);
  const percent = Math.min(100, Math.max(0, fill.ratio * 100));
  const over = fill.remainingSec < 0;

  // "Room for about N more" is only honest once something is in there to
  // average over; a kit of one 4-second loop does not predict the next pad.
  const perPad = averagePadSec && averagePadSec > 0 ? averagePadSec : padsUsed > 0 ? usedSec / padsUsed : 0;
  const roomFor =
    kind === 'drum' && perPad > 0 && !over
      ? Math.min(fill.padsFree, Math.floor(fill.remainingSec / perPad))
      : null;

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center justify-between gap-3 text-[10px] font-mono">
        <span className={`flex items-center gap-1.5 font-bold ${tone.text}`}>
          {over ? <AlertTriangle className="w-3 h-3" /> : <Check className="w-3 h-3" />}
          {usedSec.toFixed(2)}s / {fill.budgetSec.toFixed(2)}s
        </span>
        <span className="text-[#8A8F9E]">
          {over ? (
            <span className="text-[#F87171] font-bold">
              {Math.abs(fill.remainingSec).toFixed(2)}s de trop — l&apos;OP-1 coupera
            </span>
          ) : (
            <>
              {fill.remainingSec.toFixed(2)}s libres
              {kind === 'drum' && (
                <>
                  {' · '}
                  {fill.padsFree} pad{fill.padsFree === 1 ? '' : 's'}
                  {roomFor !== null && roomFor > 0 && ` · place pour ~${roomFor} son${roomFor === 1 ? '' : 's'}`}
                  {roomFor === 0 && ' · plus la place'}
                </>
              )}
            </>
          )}
        </span>
      </div>

      <div className={`h-2 rounded-full bg-[#14161F] border ${tone.border} overflow-hidden`}>
        <div
          className={`h-full ${tone.bar} transition-[width] duration-200`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};
