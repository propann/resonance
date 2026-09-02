import React from 'react';
import type { ParamSpec, ParamValue, ParamValues, RackModuleDef } from './types';

interface RackModulePanelProps {
  def: RackModuleDef;
  params: ParamValues;
  enabled: boolean;
  onParam: (key: string, value: ParamValue) => void;
  onToggle: () => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}

interface ParamRowProps {
  spec: ParamSpec;
  value: ParamValue;
  onChange: (value: ParamValue) => void;
}

const ParamRow: React.FC<ParamRowProps> = ({ spec, value, onChange }) => {
  if (spec.type === 'bool') {
    return (
      <label className="flex items-center gap-2 text-[11px] text-[#A9A9B8]">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>{spec.label}</span>
      </label>
    );
  }

  if (spec.type === 'enum') {
    return (
      <label className="flex items-center gap-2 text-[11px] text-[#A9A9B8]">
        <span className="w-16">{spec.label}</span>
        <select
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-[#161724] border border-[#343449] rounded px-1 py-1 text-[11px]"
        >
          {spec.options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>
    );
  }

  const num = typeof value === 'number' ? value : Number(value);
  return (
    <label className="flex items-center gap-2 text-[11px] text-[#A9A9B8]">
      <span className="w-16">{spec.label}</span>
      <input
        type="range"
        min={spec.min}
        max={spec.max}
        step={spec.step ?? (spec.type === 'int' ? 1 : 'any')}
        value={num}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1"
      />
      <span className="w-14 text-right tabular-nums">
        {spec.type === 'int' ? num : num.toFixed(2)}
        {spec.unit ? ` ${spec.unit}` : ''}
      </span>
    </label>
  );
};

/**
 * Renders one rack module's controls straight from its ParamSpec[]. Modules
 * only need a custom component when a slider grid isn't enough.
 */
export const RackModulePanel: React.FC<RackModulePanelProps> = ({
  def,
  params,
  enabled,
  onParam,
  onToggle,
  onRemove,
  onMove,
}) => {
  return (
    <section
      className={`rounded-lg border p-3 ${
        enabled ? 'border-[#00F0FF]/50 bg-[#00F0FF]/5' : 'border-[#242432] bg-[#0D0E14]'
      }`}
    >
      <header className="mb-2 flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs font-bold">
          <input type="checkbox" checked={enabled} onChange={onToggle} />
          {def.label}
          <span className="text-[10px] font-normal text-[#00F0FF]">{def.family}</span>
        </label>
        <div className="flex items-center gap-1 text-[10px]">
          <button onClick={() => onMove(-1)} className="px-1.5 py-0.5 border border-[#343449] rounded" title="Monter">
            ↑
          </button>
          <button onClick={() => onMove(1)} className="px-1.5 py-0.5 border border-[#343449] rounded" title="Descendre">
            ↓
          </button>
          <button
            onClick={onRemove}
            className="px-1.5 py-0.5 border border-[#5A2A2A] text-[#EF6B6B] rounded"
            title="Retirer"
          >
            ✕
          </button>
        </div>
      </header>
      <div className="space-y-1.5">
        {def.params.map((spec) => (
          <ParamRow
            key={spec.key}
            spec={spec}
            value={params[spec.key] ?? spec.default}
            onChange={(v) => onParam(spec.key, v)}
          />
        ))}
      </div>
    </section>
  );
};
