import React, { useEffect, useState } from 'react';
import { Save, Loader2, Cpu, Disc, Sliders } from 'lucide-react';
import { toast } from '../stores/toastStore';
import { readLibraryAudioFile, writeFileAt } from '../services/localLibrary';
import {
  readOp1PatchInfo,
  writeOp1PatchMetadata,
  padIsUsed,
  type Op1PatchInfo,
} from '../services/op1PatchFile';
import { OP1_KEY_NAMES } from '../services/op1PatchEncoder';
import { OP1_PLAYMODE, OP1_REVERSE } from '../services/hardware/op1og';
import { Op1FillGauge } from './Op1FillGauge';
import type { SampleItem } from '../types/sample';

interface Op1PatchEditorProps {
  sample: SampleItem | null;
}

/** The eight FX the OG firmware knows, as they name themselves in a patch. */
const FX_TYPES = ['delay', 'spring', 'punch', 'nitro', 'grid', 'cwo', 'filter', 'phone'];
const LFO_TYPES = ['tremolo', 'value', 'element', 'random', 'bend', 'crank'];

const KIND_LABEL: Record<string, string> = {
  drum: 'kit de batterie · 24 pads',
  sampler: 'patch sampler · un son au clavier',
  engine: 'patch moteur · réglages, pas de son',
};

/**
 * What an OP-1 patch says about itself, laid open and editable.
 *
 * It appears under the wave whenever the sound being looked at turns out to be
 * a patch, and nowhere else: a patch is read from the file, not guessed from a
 * name, so a `.aif` that is only a sample shows nothing here.
 *
 * Saving rewrites the settings and **not the audio** — `writeOp1PatchMetadata`
 * copies every other chunk across byte for byte. Renaming a kit has no
 * business re-encoding what it plays.
 */
export const Op1PatchEditor: React.FC<Op1PatchEditorProps> = ({ sample }) => {
  const [info, setInfo] = useState<Op1PatchInfo | null>(null);
  const [meta, setMeta] = useState<Record<string, unknown> | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const diskPath = sample?.diskPath;

  useEffect(() => {
    setInfo(null);
    setMeta(null);
    setDirty(false);
    if (!diskPath || !/\.aiff?$/i.test(diskPath)) return;

    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const file = await readLibraryAudioFile('', diskPath);
        const read = readOp1PatchInfo(await file.arrayBuffer());
        if (cancelled) return;
        // `audio` means a plain AIFF sitting among the patches: nothing to edit.
        if (read && read.kind !== 'audio' && read.raw) {
          setInfo(read);
          setMeta({ ...read.raw });
        }
      } catch (error) {
        console.error('Lecture du patch OP-1 impossible', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [diskPath]);

  if (loading && !info) {
    return (
      <div className="flex items-center gap-2 border border-[#272A38] bg-[#0C0E15] px-3 py-2 font-mono text-[10px] text-[#8A8F9E]">
        <Loader2 className="h-3 w-3 animate-spin" />
        Lecture du patch…
      </div>
    );
  }
  if (!info || !meta) return null;

  const set = (key: string, value: unknown) => {
    setMeta((current) => ({ ...(current ?? {}), [key]: value }));
    setDirty(true);
  };

  const setInArray = (key: string, index: number, value: number) => {
    setMeta((current) => {
      const source = Array.isArray(current?.[key]) ? [...(current[key] as number[])] : [];
      source[index] = value;
      return { ...(current ?? {}), [key]: source };
    });
    setDirty(true);
  };

  const save = async () => {
    if (!diskPath) return;
    setSaving(true);
    try {
      const file = await readLibraryAudioFile('', diskPath);
      const out = writeOp1PatchMetadata(await file.arrayBuffer(), meta);
      if (!out) throw new Error('fichier illisible');
      await writeFileAt(diskPath, new Blob([out]));
      const reread = readOp1PatchInfo(out);
      if (reread) setInfo(reread);
      setDirty(false);
      toast.success('Patch enregistré — son audio est inchangé.');
    } catch (error) {
      console.error('Écriture du patch OP-1 impossible', error);
      toast.error("Le patch n'a pas pu être réécrit dans le dossier de travail.");
    } finally {
      setSaving(false);
    }
  };

  const pads = info.pads ?? [];
  const padsUsed = pads.filter(padIsUsed).length;
  const numbers = (key: string): number[] =>
    Array.isArray(meta[key]) ? (meta[key] as number[]) : [];

  return (
    <div className="flex flex-col gap-2 border border-[#272A38] bg-[#0C0E15] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-pixel text-[10px] tracking-tight text-[#FF7A00]">
          {info.kind === 'drum' ? <Disc className="h-3 w-3" /> : <Cpu className="h-3 w-3" />}
          PATCH OP-1 · {KIND_LABEL[info.kind] ?? info.kind}
          {info.engine && info.kind === 'engine' && (
            <span className="border border-[#FFB000]/40 bg-[#FFB000]/10 px-1.5 text-[#FFB000]">
              {info.engine}
            </span>
          )}
        </span>
        <button
          onClick={() => void save()}
          disabled={!dirty || saving}
          className="flex items-center gap-1.5 border border-[#FF7A00] bg-[#FF7A00]/15 px-2.5 py-1 font-pixel text-[9px] text-[#FF7A00] transition hover:bg-[#FF7A00]/30 disabled:opacity-30"
        >
          {saving ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Save className="h-2.5 w-2.5" />}
          {saving ? 'ÉCRITURE…' : dirty ? 'ENREGISTRER' : 'À JOUR'}
        </button>
      </div>

      {info.budgetSec > 0 && (
        <Op1FillGauge kind={info.kind} usedSec={info.durationSec} padsUsed={padsUsed} />
      )}

      {/* ----------------------------------------------------- réglages généraux */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="flex flex-col gap-0.5 text-[9px] font-mono text-[#8A8F9E]">
          NOM (affiché sur la machine)
          <input
            value={typeof meta.name === 'string' ? meta.name : ''}
            onChange={(e) => set('name', e.target.value)}
            maxLength={24}
            className="border border-[#272A38] bg-[#08090E] px-1.5 py-1 font-mono text-[11px] text-white outline-none focus:border-[#FF7A00]"
          />
        </label>
        <label className="flex flex-col gap-0.5 text-[9px] font-mono text-[#8A8F9E]">
          OCTAVE ({typeof meta.octave === 'number' ? meta.octave : 0})
          <input
            type="range"
            min={-2}
            max={2}
            step={1}
            value={typeof meta.octave === 'number' ? meta.octave : 0}
            onChange={(e) => set('octave', Number(e.target.value))}
            className="accent-[#FF7A00]"
          />
        </label>
        <label className="flex flex-col gap-0.5 text-[9px] font-mono text-[#8A8F9E]">
          EFFET
          <select
            value={typeof meta.fx_type === 'string' ? meta.fx_type : 'delay'}
            onChange={(e) => set('fx_type', e.target.value)}
            className="border border-[#272A38] bg-[#08090E] px-1.5 py-1 font-mono text-[11px] text-white outline-none focus:border-[#FF7A00]"
          >
            {FX_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5 text-[9px] font-mono text-[#8A8F9E]">
          LFO
          <select
            value={typeof meta.lfo_type === 'string' ? meta.lfo_type : 'tremolo'}
            onChange={(e) => set('lfo_type', e.target.value)}
            className="border border-[#272A38] bg-[#08090E] px-1.5 py-1 font-mono text-[11px] text-white outline-none focus:border-[#FF7A00]"
          >
            {LFO_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[9px] font-mono text-[#8A8F9E]">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={meta.fx_active === true}
            onChange={(e) => set('fx_active', e.target.checked)}
            className="accent-[#FF7A00]"
          />
          effet actif
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={meta.lfo_active === true}
            onChange={(e) => set('lfo_active', e.target.checked)}
            className="accent-[#FF7A00]"
          />
          LFO actif
        </label>
        <span className="text-[#55556A]">
          {info.sampleRate} Hz · {info.channels === 1 ? 'mono' : 'stéréo'} ·{' '}
          {info.durationSec.toFixed(2)} s
        </span>
      </div>

      {/* -------------------------------------- enveloppe et boutons du moteur */}
      {(numbers('adsr').length > 0 || numbers('knobs').length > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {numbers('adsr').length > 0 && (
            <ParamRow
              label="ENVELOPPE (adsr)"
              values={numbers('adsr').slice(0, 4)}
              names={['attaque', 'déclin', 'tenue', 'relâche']}
              onChange={(i, v) => setInArray('adsr', i, v)}
            />
          )}
          {numbers('knobs').length > 0 && (
            <ParamRow
              label="BOUTONS DU MOTEUR"
              values={numbers('knobs').slice(0, 4)}
              names={['bleu', 'vert', 'blanc', 'orange']}
              onChange={(i, v) => setInArray('knobs', i, v)}
            />
          )}
        </div>
      )}

      {/* ------------------------------------------------------------ les 24 pads */}
      {info.kind === 'drum' && pads.length === 24 && (
        <details className="border border-[#1E1E28] bg-[#08090E]">
          <summary className="cursor-pointer px-2 py-1 font-pixel text-[9px] text-[#8A8F9E]">
            <Sliders className="mr-1 inline h-2.5 w-2.5" />
            LES 24 PADS · {padsUsed} occupé{padsUsed === 1 ? '' : 's'}
          </summary>
          <div className="max-h-56 overflow-y-auto p-1.5 custom-scrollbar">
            <table className="w-full font-mono text-[9px]">
              <thead className="text-[#55556A]">
                <tr>
                  <th className="px-1 text-left">touche</th>
                  <th className="px-1 text-right">début</th>
                  <th className="px-1 text-right">fin</th>
                  <th className="px-1 text-right">hauteur</th>
                  <th className="px-1 text-right">volume</th>
                  <th className="px-1 text-center">inversé</th>
                  <th className="px-1 text-center">boucle</th>
                </tr>
              </thead>
              <tbody>
                {pads.map((pad) => {
                  const used = padIsUsed(pad);
                  return (
                    <tr
                      key={pad.index}
                      className={used ? 'text-[#EDEDEE]' : 'text-[#3A3F52]'}
                    >
                      <td className="px-1">{OP1_KEY_NAMES[pad.index]}</td>
                      <td className="px-1 text-right">{pad.startSec.toFixed(2)}</td>
                      <td className="px-1 text-right">{pad.endSec.toFixed(2)}</td>
                      <td className="px-1 text-right">
                        <input
                          type="number"
                          value={numbers('pitch')[pad.index] ?? 0}
                          onChange={(e) => setInArray('pitch', pad.index, Number(e.target.value))}
                          disabled={!used}
                          className="w-14 border border-[#272A38] bg-[#0C0E15] px-1 text-right text-[9px] text-white outline-none focus:border-[#FF7A00] disabled:opacity-40"
                        />
                      </td>
                      <td className="px-1 text-right">
                        <input
                          type="number"
                          min={0}
                          max={32767}
                          value={numbers('volume')[pad.index] ?? 8192}
                          onChange={(e) => setInArray('volume', pad.index, Number(e.target.value))}
                          disabled={!used}
                          className="w-16 border border-[#272A38] bg-[#0C0E15] px-1 text-right text-[9px] text-white outline-none focus:border-[#FF7A00] disabled:opacity-40"
                        />
                      </td>
                      <td className="px-1 text-center">
                        <input
                          type="checkbox"
                          checked={(numbers('reverse')[pad.index] ?? OP1_REVERSE.forward) > OP1_REVERSE.forward}
                          onChange={(e) =>
                            setInArray(
                              'reverse',
                              pad.index,
                              e.target.checked ? OP1_REVERSE.reversed : OP1_REVERSE.forward
                            )
                          }
                          disabled={!used}
                          className="accent-[#FF7A00]"
                        />
                      </td>
                      <td className="px-1 text-center">
                        <input
                          type="checkbox"
                          checked={(numbers('playmode')[pad.index] ?? OP1_PLAYMODE.oneshot) === OP1_PLAYMODE.loop}
                          onChange={(e) =>
                            setInArray(
                              'playmode',
                              pad.index,
                              e.target.checked ? OP1_PLAYMODE.loop : OP1_PLAYMODE.oneshot
                            )
                          }
                          disabled={!used}
                          className="accent-[#FF7A00]"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
};

/** Four sliders over the OP-1's 0–32767 range, which is how it stores them. */
const ParamRow: React.FC<{
  label: string;
  values: number[];
  names: string[];
  onChange: (index: number, value: number) => void;
}> = ({ label, values, names, onChange }) => (
  <div className="space-y-1">
    <div className="font-mono text-[9px] text-[#8A8F9E]">{label}</div>
    {values.map((value, i) => (
      <label key={i} className="flex items-center gap-1.5 font-mono text-[9px] text-[#55556A]">
        <span className="w-14 shrink-0">{names[i] ?? i}</span>
        <input
          type="range"
          min={0}
          max={32767}
          value={value}
          onChange={(e) => onChange(i, Number(e.target.value))}
          className="flex-1 accent-[#FF7A00]"
        />
        <span className="w-12 shrink-0 text-right text-[#8A8F9E]">{value}</span>
      </label>
    ))}
  </div>
);
