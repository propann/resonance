import React from 'react';
import {
  Flame,
  Binary,
  Compass,
  Sparkles,
  Scissors,
  Activity,
  Sliders,
  Waves,
  Zap,
  Radio,
  SlidersHorizontal,
  Disc,
  RotateCcw,
  Wind,
  Plus,
} from 'lucide-react';
import { DspRackConfig } from '../../services/dspEffectsEngine';
import { EffectModuleKey } from './dspTypes';

interface DspControlsCardsProps {
  config: DspRackConfig;
  onChangeConfig: (newConfig: DspRackConfig) => void;
  activeFocus: EffectModuleKey | 'all';
}

export const DspControlsCards: React.FC<DspControlsCardsProps> = ({
  config,
  onChangeConfig,
  activeFocus,
}) => {
  const shouldShow = (key: EffectModuleKey) => {
    if (activeFocus !== 'all' && activeFocus !== key) return false;
    return true;
  };

  return (
    <div className="space-y-4">
      {/* ======================================================== */}
      {/* 1. SUB & DEEP BASS ENHANCER MODULE                       */}
      {/* ======================================================== */}
      {config.subBass.enabled && shouldShow('subBass') && (
        <div className="p-4 bg-[#0B0B16] border border-[#00F0FF]/40 shadow-lg rounded space-y-3">
          <div className="flex items-center justify-between border-b border-[#00F0FF]/20 pb-2">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-[#00F0FF]" />
              <h4 className="text-xs font-pixel font-bold text-[#00F0FF]">
                1. BASSES PROFONDES 808 & SUB-HARMONIQUES
              </h4>
            </div>
            <span className="text-[10px] font-mono text-[#00F0FF] bg-[#00F0FF]/15 px-2 py-0.5 rounded border border-[#00F0FF]/30">
              ACTIF
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Boost Sub (dB)</span>
                <span className="text-[#00F0FF] font-bold">+{config.subBass.boostDb} dB</span>
              </div>
              <input
                type="range"
                min="0"
                max="24"
                step="0.5"
                value={config.subBass.boostDb}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    subBass: { ...config.subBass, boostDb: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#00F0FF]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Fréquence Sub</span>
                <span className="text-[#00F0FF] font-bold">{config.subBass.frequency} Hz</span>
              </div>
              <input
                type="range"
                min="30"
                max="140"
                value={config.subBass.frequency}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    subBass: { ...config.subBass, frequency: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#00F0FF]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Sub-Harmonique (-12st)</span>
                <span className="text-[#00F0FF] font-bold">{config.subBass.subHarmonics}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={config.subBass.subHarmonics}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    subBass: { ...config.subBass, subHarmonics: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#00F0FF]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Saturation 808 Drive</span>
                <span className="text-[#00F0FF] font-bold">{config.subBass.subDrive}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={config.subBass.subDrive}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    subBass: { ...config.subBass, subDrive: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#00F0FF]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Mono Sub Crossover</span>
                <span className="text-[#00F0FF] font-bold">{config.subBass.monoSubCutoff} Hz</span>
              </div>
              <input
                type="range"
                min="40"
                max="250"
                value={config.subBass.monoSubCutoff}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    subBass: { ...config.subBass, monoSubCutoff: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#00F0FF]"
              />
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. SATURATION, OVERDRIVE & 12-BIT LO-FI                  */}
      {/* ======================================================== */}
      {config.distortion.enabled && shouldShow('distortion') && (
        <div className="p-4 bg-[#0B0B16] border border-[#EF4444]/40 shadow-lg rounded space-y-3">
          <div className="flex items-center justify-between border-b border-[#EF4444]/20 pb-2">
            <div className="flex items-center gap-2">
              <Binary className="w-4 h-4 text-[#EF4444]" />
              <h4 className="text-xs font-pixel font-bold text-[#EF4444]">
                2. SATURATION ANALOGIQUE, WAVEFOLDER & BITCRUSHER 12-BIT
              </h4>
            </div>
            <span className="text-[10px] font-mono text-[#EF4444] bg-[#EF4444]/15 px-2 py-0.5 rounded border border-[#EF4444]/30">
              ACTIF
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <span className="text-[#8E8E98]">Type de Circuit</span>
              <select
                value={config.distortion.driveType}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    distortion: {
                      ...config.distortion,
                      driveType: e.target.value as any,
                    },
                  })
                }
                className="w-full bg-[#1A1A2E] text-[#EF4444] border border-[#303046] px-2 py-1 text-xs rounded outline-none"
              >
                <option value="tube-warmth">Lampes Chaudes (Tube Warmth)</option>
                <option value="tape-sat">Bande Magnétique (Tape Saturation)</option>
                <option value="hard-clip">Écrêtage Dur (Hard-Clip Modern)</option>
                <option value="wavefolder">Wavefolder (Repliement Harmonique)</option>
                <option value="germanium-fuzz">Fuzz Germanium Vintage</option>
              </select>
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Drive / Gain (dB)</span>
                <span className="text-[#EF4444] font-bold">+{config.distortion.gainDb} dB</span>
              </div>
              <input
                type="range"
                min="0"
                max="36"
                step="0.5"
                value={config.distortion.gainDb}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    distortion: { ...config.distortion, gainDb: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#EF4444]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Bitcrusher (Résolution)</span>
                <span className="text-[#EF4444] font-bold">
                  {config.distortion.bitDepth === 16 ? '16 bits (Clean)' : `${config.distortion.bitDepth} bits`}
                </span>
              </div>
              <input
                type="range"
                min="2"
                max="16"
                step="1"
                value={config.distortion.bitDepth}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    distortion: { ...config.distortion, bitDepth: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#EF4444]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Downsampler (Fréquence SP-1200)</span>
                <span className="text-[#EF4444] font-bold">{config.distortion.downsample}x</span>
              </div>
              <input
                type="range"
                min="1"
                max="16"
                step="1"
                value={config.distortion.downsample}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    distortion: { ...config.distortion, downsample: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#EF4444]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Souffle Bande (Noise Floor)</span>
                <span className="text-[#EF4444] font-bold">{config.distortion.noiseHiss}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={config.distortion.noiseHiss}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    distortion: { ...config.distortion, noiseHiss: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#EF4444]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Mix Distorsion</span>
                <span className="text-[#EF4444] font-bold">{config.distortion.mix}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={config.distortion.mix}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    distortion: { ...config.distortion, mix: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#EF4444]"
              />
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. VINYL & CASSETTE NOSTALGIA ENGINE                     */}
      {/* ======================================================== */}
      {config.vinylTape.enabled && shouldShow('vinylTape') && (
        <div className="p-4 bg-[#0B0B16] border border-[#EAB308]/40 shadow-lg rounded space-y-3">
          <div className="flex items-center justify-between border-b border-[#EAB308]/20 pb-2">
            <div className="flex items-center gap-2">
              <Disc className="w-4 h-4 text-[#EAB308]" />
              <h4 className="text-xs font-pixel font-bold text-[#EAB308]">
                3. CRAQUEMENTS VINYLE, POUSSIÈRE & PLEURAGE CASSETTE
              </h4>
            </div>
            <span className="text-[10px] font-mono text-[#EAB308] bg-[#EAB308]/15 px-2 py-0.5 rounded border border-[#EAB308]/30">
              ACTIF
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <span className="text-[#8E8E98]">Courbe Vintage EQ</span>
              <select
                value={config.vinylTape.vintageCurve}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    vinylTape: { ...config.vinylTape, vintageCurve: e.target.value as any },
                  })
                }
                className="w-full bg-[#1A1A2E] text-[#EAB308] border border-[#303046] px-2 py-1 text-xs rounded outline-none"
              >
                <option value="flat">Neutre (Sans filtrage)</option>
                <option value="1970-cassette">Cassette Audio 1970s</option>
                <option value="1980-walkman">Walkman Cassette 1980s</option>
                <option value="1950-radio">Poste Radio TSF 1950</option>
                <option value="1920-gramophone">Gramophone 78 Tours 1920</option>
              </select>
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Craquements & Poussières</span>
                <span className="text-[#EAB308] font-bold">{config.vinylTape.crackleAmount}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={config.vinylTape.crackleAmount}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    vinylTape: { ...config.vinylTape, crackleAmount: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#EAB308]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Pops & Clics Vinyle</span>
                <span className="text-[#EAB308] font-bold">{config.vinylTape.vinylDustPops}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={config.vinylTape.vinylDustPops}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    vinylTape: { ...config.vinylTape, vinylDustPops: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#EAB308]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Pleurage Moteur (Flutter)</span>
                <span className="text-[#EAB308] font-bold">{config.vinylTape.tapeFlutterDepth}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={config.vinylTape.tapeFlutterDepth}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    vinylTape: { ...config.vinylTape, tapeFlutterDepth: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#EAB308]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Mix Vinyle & Bande</span>
                <span className="text-[#EAB308] font-bold">{config.vinylTape.mix}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={config.vinylTape.mix}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    vinylTape: { ...config.vinylTape, mix: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#EAB308]"
              />
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. STEREO PING-PONG & TAPE DELAY                         */}
      {/* ======================================================== */}
      {config.delay.enabled && shouldShow('delay') && (
        <div className="p-4 bg-[#0B0B16] border border-[#38BDF8]/40 shadow-lg rounded space-y-3">
          <div className="flex items-center justify-between border-b border-[#38BDF8]/20 pb-2">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-[#38BDF8]" />
              <h4 className="text-xs font-pixel font-bold text-[#38BDF8]">
                4. STEREO PING-PONG & TAPE DELAY SYNCHRONISÉ
              </h4>
            </div>
            <span className="text-[10px] font-mono text-[#38BDF8] bg-[#38BDF8]/15 px-2 py-0.5 rounded border border-[#38BDF8]/30">
              ACTIF
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <span className="text-[#8E8E98]">Division Rythmique</span>
              <select
                value={config.delay.syncDivision}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    delay: { ...config.delay, syncDivision: e.target.value as any },
                  })
                }
                className="w-full bg-[#1A1A2E] text-[#38BDF8] border border-[#303046] px-2 py-1 text-xs rounded outline-none"
              >
                <option value="free">Temps Libre (Secondes)</option>
                <option value="1/16">1/16 (Double-croche)</option>
                <option value="1/8">1/8 (Croche)</option>
                <option value="1/8D">1/8D (Croche Pointée)</option>
                <option value="1/4">1/4 (Noire)</option>
                <option value="1/2">1/2 (Blanche)</option>
              </select>
            </div>

            {config.delay.syncDivision === 'free' && (
              <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#8E8E98]">Temps de Retard</span>
                  <span className="text-[#38BDF8] font-bold">{config.delay.timeSec} s</span>
                </div>
                <input
                  type="range"
                  min="0.02"
                  max="1.5"
                  step="0.01"
                  value={config.delay.timeSec}
                  onChange={(e) =>
                    onChangeConfig({
                      ...config,
                      delay: { ...config.delay, timeSec: Number(e.target.value) },
                    })
                  }
                  className="w-full accent-[#38BDF8]"
                />
              </div>
            )}

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Feedback (Répétitions)</span>
                <span className="text-[#38BDF8] font-bold">{config.delay.feedback}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="95"
                value={config.delay.feedback}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    delay: { ...config.delay, feedback: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#38BDF8]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Amortissement Aigus</span>
                <span className="text-[#38BDF8] font-bold">{config.delay.dampingHz} Hz</span>
              </div>
              <input
                type="range"
                min="1000"
                max="18000"
                step="100"
                value={config.delay.dampingHz}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    delay: { ...config.delay, dampingHz: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#38BDF8]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Wow & Flutter (Dérive Bande)</span>
                <span className="text-[#38BDF8] font-bold">{config.delay.wowFlutter}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={config.delay.wowFlutter}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    delay: { ...config.delay, wowFlutter: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#38BDF8]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Mix Wet/Dry</span>
                <span className="text-[#38BDF8] font-bold">{config.delay.mix}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={config.delay.mix}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    delay: { ...config.delay, mix: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#38BDF8]"
              />
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. SHIMMER REVERB & COSMIC SPACE                         */}
      {/* ======================================================== */}
      {config.reverb.enabled && shouldShow('reverb') && (
        <div className="p-4 bg-[#0B0B16] border border-[#A855F7]/40 shadow-lg rounded space-y-3">
          <div className="flex items-center justify-between border-b border-[#A855F7]/20 pb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#A855F7]" />
              <h4 className="text-xs font-pixel font-bold text-[#A855F7]">
                5. SHIMMER REVERB & ESPACE CÉLESTE (+12st)
              </h4>
            </div>
            <span className="text-[10px] font-mono text-[#A855F7] bg-[#A855F7]/15 px-2 py-0.5 rounded border border-[#A855F7]/30">
              ACTIF
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <span className="text-[#8E8E98]">Type d'Espace</span>
              <select
                value={config.reverb.roomSize}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    reverb: { ...config.reverb, roomSize: e.target.value as any },
                  })
                }
                className="w-full bg-[#1A1A2E] text-[#A855F7] border border-[#303046] px-2 py-1 text-xs rounded outline-none"
              >
                <option value="small-room">Petite Pièce Studio (Small Room)</option>
                <option value="studio-plate">Plaque Métallique EMT (Studio Plate)</option>
                <option value="concert-hall">Salle Symphonique (Concert Hall)</option>
                <option value="cathedral">Cathédrale Abyssale (Cathedral)</option>
                <option value="cosmic-void">Vide Cosmique Infini (Cosmic Void)</option>
              </select>
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Déclin (Decay)</span>
                <span className="text-[#A855F7] font-bold">{config.reverb.decaySec} s</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="15"
                step="0.1"
                value={config.reverb.decaySec}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    reverb: { ...config.reverb, decaySec: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#A855F7]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Octave Shimmer (+12st)</span>
                <span className="text-[#A855F7] font-bold">{config.reverb.shimmer}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={config.reverb.shimmer}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    reverb: { ...config.reverb, shimmer: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#A855F7]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Pré-Délai</span>
                <span className="text-[#A855F7] font-bold">{config.reverb.preDelayMs} ms</span>
              </div>
              <input
                type="range"
                min="0"
                max="200"
                value={config.reverb.preDelayMs}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    reverb: { ...config.reverb, preDelayMs: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#A855F7]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Mix Réverbération</span>
                <span className="text-[#A855F7] font-bold">{config.reverb.mix}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={config.reverb.mix}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    reverb: { ...config.reverb, mix: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#A855F7]"
              />
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. RHYTHMIC STUTTER & TRANCE GATE                        */}
      {/* ======================================================== */}
      {config.stutter.enabled && shouldShow('stutter') && (
        <div className="p-4 bg-[#0B0B16] border border-[#FFE600]/40 shadow-lg rounded space-y-3">
          <div className="flex items-center justify-between border-b border-[#FFE600]/20 pb-2">
            <div className="flex items-center gap-2">
              <Scissors className="w-4 h-4 text-[#FFE600]" />
              <h4 className="text-xs font-pixel font-bold text-[#FFE600]">
                6. SACCADES RYTHMIQUES, TRANCE GATE & GLITCH
              </h4>
            </div>
            <span className="text-[10px] font-mono text-[#FFE600] bg-[#FFE600]/15 px-2 py-0.5 rounded border border-[#FFE600]/30">
              ACTIF
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <span className="text-[#8E8E98]">Division Temporelle</span>
              <select
                value={config.stutter.division}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    stutter: { ...config.stutter, division: e.target.value as any },
                  })
                }
                className="w-full bg-[#1A1A2E] text-[#FFE600] border border-[#303046] px-2 py-1 text-xs rounded outline-none"
              >
                <option value="1/4">1/4 (Noire)</option>
                <option value="1/8">1/8 (Croche)</option>
                <option value="1/16">1/16 (Double croche standard)</option>
                <option value="1/32">1/32 (Quadruple croche ultra-rapide)</option>
                <option value="1/64">1/64 (Drill roll hyper-saccadé)</option>
                <option value="1/8T">1/8 Triolet</option>
                <option value="1/16T">1/16 Triolet</option>
              </select>
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <span className="text-[#8E8E98]">Forme du Hachoir</span>
              <select
                value={config.stutter.shape}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    stutter: { ...config.stutter, shape: e.target.value as any },
                  })
                }
                className="w-full bg-[#1A1A2E] text-[#FFE600] border border-[#303046] px-2 py-1 text-xs rounded outline-none"
              >
                <option value="hard-gate">Hard Gate (Tranche nette)</option>
                <option value="smooth-tremolo">Smooth Sine (Trémolo fluide)</option>
                <option value="random-glitch">Random Glitch (Micro-découpes aléatoires)</option>
              </select>
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Rapport Cyclique (Duty)</span>
                <span className="text-[#FFE600] font-bold">{config.stutter.dutyCycle}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="90"
                value={config.stutter.dutyCycle}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    stutter: { ...config.stutter, dutyCycle: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#FFE600]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Tempo BPM</span>
                <span className="text-[#FFE600] font-bold">{config.stutter.bpm} BPM</span>
              </div>
              <input
                type="range"
                min="40"
                max="220"
                value={config.stutter.bpm}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    stutter: { ...config.stutter, bpm: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#FFE600]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Mix Hachoir</span>
                <span className="text-[#FFE600] font-bold">{config.stutter.mix}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={config.stutter.mix}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    stutter: { ...config.stutter, mix: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#FFE600]"
              />
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 7. DYNAMIC AUTO-WAH & ENVELOPE FOLLOWER                  */}
      {/* ======================================================== */}
      {config.autoWah.enabled && shouldShow('autoWah') && (
        <div className="p-4 bg-[#0B0B16] border border-[#84CC16]/40 shadow-lg rounded space-y-3">
          <div className="flex items-center justify-between border-b border-[#84CC16]/20 pb-2">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#84CC16]" />
              <h4 className="text-xs font-pixel font-bold text-[#84CC16]">
                7. DYNAMIC AUTO-WAH & ENVELOPE FOLLOWER FUNK
              </h4>
            </div>
            <span className="text-[10px] font-mono text-[#84CC16] bg-[#84CC16]/15 px-2 py-0.5 rounded border border-[#84CC16]/30">
              ACTIF
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Sensibilité Dynamique</span>
                <span className="text-[#84CC16] font-bold">{config.autoWah.sensitivity}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={config.autoWah.sensitivity}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    autoWah: { ...config.autoWah, sensitivity: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#84CC16]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Fréquence de Base</span>
                <span className="text-[#84CC16] font-bold">{config.autoWah.baseCutoffHz} Hz</span>
              </div>
              <input
                type="range"
                min="100"
                max="3500"
                value={config.autoWah.baseCutoffHz}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    autoWah: { ...config.autoWah, baseCutoffHz: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#84CC16]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Balayage Wah (Plage)</span>
                <span className="text-[#84CC16] font-bold">{config.autoWah.sweepRangeHz} Hz</span>
              </div>
              <input
                type="range"
                min="200"
                max="7000"
                value={config.autoWah.sweepRangeHz}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    autoWah: { ...config.autoWah, sweepRangeHz: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#84CC16]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Résonance (Q)</span>
                <span className="text-[#84CC16] font-bold">Q {config.autoWah.resonance}</span>
              </div>
              <input
                type="range"
                min="1"
                max="18"
                step="0.5"
                value={config.autoWah.resonance}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    autoWah: { ...config.autoWah, resonance: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#84CC16]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <span className="text-[#8E8E98]">Direction du Balayage</span>
              <select
                value={config.autoWah.direction}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    autoWah: { ...config.autoWah, direction: e.target.value as any },
                  })
                }
                className="w-full bg-[#1A1A2E] text-[#84CC16] border border-[#303046] px-2 py-1 text-xs rounded outline-none"
              >
                <option value="up">Vers le haut (Ouverture brillante)</option>
                <option value="down">Vers le bas (Fermeture sombre)</option>
              </select>
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Mix Auto-Wah</span>
                <span className="text-[#84CC16] font-bold">{config.autoWah.mix}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={config.autoWah.mix}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    autoWah: { ...config.autoWah, mix: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#84CC16]"
              />
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 8. HARMONIC EXCITER & AIR PRESENCE (APHEX SHIMMER)       */}
      {/* ======================================================== */}
      {config.exciter.enabled && shouldShow('exciter') && (
        <div className="p-4 bg-[#0B0B16] border border-[#F43F5E]/40 shadow-lg rounded space-y-3">
          <div className="flex items-center justify-between border-b border-[#F43F5E]/20 pb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#F43F5E]" />
              <h4 className="text-xs font-pixel font-bold text-[#F43F5E]">
                8. HARMONIC EXCITER & AIR SHIMMER (12kHz PRESENCE)
              </h4>
            </div>
            <span className="text-[10px] font-mono text-[#F43F5E] bg-[#F43F5E]/15 px-2 py-0.5 rounded border border-[#F43F5E]/30">
              ACTIF
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <span className="text-[#8E8E98]">Génération Harmonique</span>
              <select
                value={config.exciter.curve}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    exciter: { ...config.exciter, curve: e.target.value as any },
                  })
                }
                className="w-full bg-[#1A1A2E] text-[#F43F5E] border border-[#303046] px-2 py-1 text-xs rounded outline-none"
              >
                <option value="tube-even">Harmoniques Pairs (Chaleur & Velouté)</option>
                <option value="tape-odd">Harmoniques Impairs (Bande Magnétique)</option>
                <option value="silicon-sparkle">Silicon Sparkle (Brillance Cristalline)</option>
              </select>
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Fréquence Charnière (Air)</span>
                <span className="text-[#F43F5E] font-bold">{config.exciter.frequencyHz} Hz</span>
              </div>
              <input
                type="range"
                min="4000"
                max="16000"
                step="500"
                value={config.exciter.frequencyHz}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    exciter: { ...config.exciter, frequencyHz: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#F43F5E]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Harmonics Drive</span>
                <span className="text-[#F43F5E] font-bold">{config.exciter.harmonicsDrive}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={config.exciter.harmonicsDrive}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    exciter: { ...config.exciter, harmonicsDrive: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#F43F5E]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Air Boost (dB)</span>
                <span className="text-[#F43F5E] font-bold">+{config.exciter.airBoostDb} dB</span>
              </div>
              <input
                type="range"
                min="0"
                max="18"
                step="0.5"
                value={config.exciter.airBoostDb}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    exciter: { ...config.exciter, airBoostDb: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#F43F5E]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Mix Exciter</span>
                <span className="text-[#F43F5E] font-bold">{config.exciter.mix}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={config.exciter.mix}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    exciter: { ...config.exciter, mix: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#F43F5E]"
              />
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 9. BODE FREQUENCY SHIFTER & ALIEN TEXTURES               */}
      {/* ======================================================== */}
      {config.freqShifter.enabled && shouldShow('freqShifter') && (
        <div className="p-4 bg-[#0B0B16] border border-[#06B6D4]/40 shadow-lg rounded space-y-3">
          <div className="flex items-center justify-between border-b border-[#06B6D4]/20 pb-2">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-[#06B6D4]" />
              <h4 className="text-xs font-pixel font-bold text-[#06B6D4]">
                9. BODE FREQUENCY SHIFTER & CLOCHES MÉTALLIQUES
              </h4>
            </div>
            <span className="text-[10px] font-mono text-[#06B6D4] bg-[#06B6D4]/15 px-2 py-0.5 rounded border border-[#06B6D4]/30">
              ACTIF
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Décalage Fréquentiel (Hz)</span>
                <span className="text-[#06B6D4] font-bold">
                  {config.freqShifter.shiftHz > 0 ? `+${config.freqShifter.shiftHz}` : config.freqShifter.shiftHz} Hz
                </span>
              </div>
              <input
                type="range"
                min="-600"
                max="600"
                step="5"
                value={config.freqShifter.shiftHz}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    freqShifter: { ...config.freqShifter, shiftHz: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#06B6D4]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Phase Quadrature</span>
                <span className="text-[#06B6D4] font-bold">{config.freqShifter.quadraturePhase}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="360"
                step="15"
                value={config.freqShifter.quadraturePhase}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    freqShifter: { ...config.freqShifter, quadraturePhase: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#06B6D4]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Mix Freq Shifter</span>
                <span className="text-[#06B6D4] font-bold">{config.freqShifter.mix}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={config.freqShifter.mix}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    freqShifter: { ...config.freqShifter, mix: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#06B6D4]"
              />
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 10. COMB RESONATOR & KARPLUS-STRONG MATRIX              */}
      {/* ======================================================== */}
      {config.combResonator.enabled && shouldShow('combResonator') && (
        <div className="p-4 bg-[#0B0B16] border border-[#3B82F6]/40 shadow-lg rounded space-y-3">
          <div className="flex items-center justify-between border-b border-[#3B82F6]/20 pb-2">
            <div className="flex items-center gap-2">
              <Wind className="w-4 h-4 text-[#3B82F6]" />
              <h4 className="text-xs font-pixel font-bold text-[#3B82F6]">
                10. COMB FILTER & RÉSONATEUR PHYSIQUE (KARPLUS-STRONG)
              </h4>
            </div>
            <span className="text-[10px] font-mono text-[#3B82F6] bg-[#3B82F6]/15 px-2 py-0.5 rounded border border-[#3B82F6]/30">
              ACTIF
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Fréquence d'Accord (Note)</span>
                <span className="text-[#3B82F6] font-bold">{config.combResonator.tuneFreqHz} Hz</span>
              </div>
              <input
                type="range"
                min="40"
                max="1200"
                value={config.combResonator.tuneFreqHz}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    combResonator: { ...config.combResonator, tuneFreqHz: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#3B82F6]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Résonance Feedback</span>
                <span className="text-[#3B82F6] font-bold">{config.combResonator.feedbackDecay}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="98"
                value={config.combResonator.feedbackDecay}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    combResonator: { ...config.combResonator, feedbackDecay: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#3B82F6]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Amortissement (Damping)</span>
                <span className="text-[#3B82F6] font-bold">{config.combResonator.dampingHz} Hz</span>
              </div>
              <input
                type="range"
                min="1000"
                max="16000"
                step="500"
                value={config.combResonator.dampingHz}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    combResonator: { ...config.combResonator, dampingHz: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#3B82F6]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Mix Résonateur</span>
                <span className="text-[#3B82F6] font-bold">{config.combResonator.mix}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={config.combResonator.mix}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    combResonator: { ...config.combResonator, mix: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#3B82F6]"
              />
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 11. RESONANT ACID 303 FILTER & LFO                       */}
      {/* ======================================================== */}
      {config.filter.enabled && shouldShow('filter') && (
        <div className="p-4 bg-[#0B0B16] border border-[#10B981]/40 shadow-lg rounded space-y-3">
          <div className="flex items-center justify-between border-b border-[#10B981]/20 pb-2">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#10B981]" />
              <h4 className="text-xs font-pixel font-bold text-[#10B981]">
                11. FILTRE RÉSONANT ACID 303 & BALAYAGE LFO
              </h4>
            </div>
            <span className="text-[10px] font-mono text-[#10B981] bg-[#10B981]/15 px-2 py-0.5 rounded border border-[#10B981]/30">
              ACTIF
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <span className="text-[#8E8E98]">Type de Filtre</span>
              <select
                value={config.filter.type}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    filter: { ...config.filter, type: e.target.value as any },
                  })
                }
                className="w-full bg-[#1A1A2E] text-[#10B981] border border-[#303046] px-2 py-1 text-xs rounded outline-none"
              >
                <option value="lowpass">Passe-Bas 24dB (Lowpass Standard)</option>
                <option value="acid-303">Acid 303 Resonant Screamer</option>
                <option value="highpass">Passe-Haut (Highpass)</option>
                <option value="bandpass">Passe-Bande (Bandpass)</option>
                <option value="notch">Filtre Réjecteur (Notch)</option>
              </select>
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Fréquence de Coupure</span>
                <span className="text-[#10B981] font-bold">{config.filter.cutoffHz} Hz</span>
              </div>
              <input
                type="range"
                min="40"
                max="18000"
                step="50"
                value={config.filter.cutoffHz}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    filter: { ...config.filter, cutoffHz: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#10B981]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Résonance (Q / Sifflement)</span>
                <span className="text-[#10B981] font-bold">Q {config.filter.resonance}</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="24"
                step="0.5"
                value={config.filter.resonance}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    filter: { ...config.filter, resonance: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#10B981]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Modulation LFO Depth</span>
                <span className="text-[#10B981] font-bold">{config.filter.lfoDepth}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={config.filter.lfoDepth}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    filter: { ...config.filter, lfoDepth: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#10B981]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Vitesse LFO (Hz)</span>
                <span className="text-[#10B981] font-bold">{config.filter.lfoRateHz} Hz</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="15"
                step="0.1"
                value={config.filter.lfoRateHz}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    filter: { ...config.filter, lfoRateHz: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#10B981]"
              />
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 12. STUDIO COMPRESSOR & DYNAMICS                         */}
      {/* ======================================================== */}
      {config.compressor.enabled && shouldShow('compressor') && (
        <div className="p-4 bg-[#0B0B16] border border-[#F59E0B]/40 shadow-lg rounded space-y-3">
          <div className="flex items-center justify-between border-b border-[#F59E0B]/20 pb-2">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#F59E0B]" />
              <h4 className="text-xs font-pixel font-bold text-[#F59E0B]">
                12. COMPRESSEUR STUDIO, LIMITEUR & CONTRÔLE DE DYNAMIQUE
              </h4>
            </div>
            <span className="text-[10px] font-mono text-[#F59E0B] bg-[#F59E0B]/15 px-2 py-0.5 rounded border border-[#F59E0B]/30">
              ACTIF
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Seuil (Threshold)</span>
                <span className="text-[#F59E0B] font-bold">{config.compressor.thresholdDb} dB</span>
              </div>
              <input
                type="range"
                min="-60"
                max="0"
                step="1"
                value={config.compressor.thresholdDb}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    compressor: { ...config.compressor, thresholdDb: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#F59E0B]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Ratio</span>
                <span className="text-[#F59E0B] font-bold">{config.compressor.ratio}:1</span>
              </div>
              <input
                type="range"
                min="1"
                max="20"
                step="0.5"
                value={config.compressor.ratio}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    compressor: { ...config.compressor, ratio: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#F59E0B]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Attaque</span>
                <span className="text-[#F59E0B] font-bold">{config.compressor.attackMs} ms</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="100"
                step="1"
                value={config.compressor.attackMs}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    compressor: { ...config.compressor, attackMs: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#F59E0B]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Relâchement (Release)</span>
                <span className="text-[#F59E0B] font-bold">{config.compressor.releaseMs} ms</span>
              </div>
              <input
                type="range"
                min="10"
                max="800"
                step="10"
                value={config.compressor.releaseMs}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    compressor: { ...config.compressor, releaseMs: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#F59E0B]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Gain de Sortie (Make-up)</span>
                <span className="text-[#F59E0B] font-bold">+{config.compressor.makeupGainDb} dB</span>
              </div>
              <input
                type="range"
                min="0"
                max="24"
                step="0.5"
                value={config.compressor.makeupGainDb}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    compressor: { ...config.compressor, makeupGainDb: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#F59E0B]"
              />
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 13. CHORUS, FLANGER & HAAS 3D SPATIAL                    */}
      {/* ======================================================== */}
      {config.modulation.enabled && shouldShow('modulation') && (
        <div className="p-4 bg-[#0B0B16] border border-[#EC4899]/40 shadow-lg rounded space-y-3">
          <div className="flex items-center justify-between border-b border-[#EC4899]/20 pb-2">
            <div className="flex items-center gap-2">
              <Waves className="w-4 h-4 text-[#EC4899]" />
              <h4 className="text-xs font-pixel font-bold text-[#EC4899]">
                13. CHORUS DIMENSION-D, FLANGER & ÉPAISSISSEMENT HAAS 3D
              </h4>
            </div>
            <span className="text-[10px] font-mono text-[#EC4899] bg-[#EC4899]/15 px-2 py-0.5 rounded border border-[#EC4899]/30">
              ACTIF
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <span className="text-[#8E8E98]">Algorithme Spatial</span>
              <select
                value={config.modulation.type}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    modulation: { ...config.modulation, type: e.target.value as any },
                  })
                }
                className="w-full bg-[#1A1A2E] text-[#EC4899] border border-[#303046] px-2 py-1 text-xs rounded outline-none"
              >
                <option value="chorus">Chorus Doux Studio</option>
                <option value="dimension-d">Dimension-D (Élargissement Stéréo Célèbre)</option>
                <option value="flanger">Flanger à Réaction Jet-Engine</option>
                <option value="haas-widener">Haas Psychoacoustique 3D Widener</option>
              </select>
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Profondeur (Depth)</span>
                <span className="text-[#EC4899] font-bold">{config.modulation.depth}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={config.modulation.depth}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    modulation: { ...config.modulation, depth: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#EC4899]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Vitesse Modulation</span>
                <span className="text-[#EC4899] font-bold">{config.modulation.rateHz} Hz</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="10"
                step="0.1"
                value={config.modulation.rateHz}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    modulation: { ...config.modulation, rateHz: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#EC4899]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Délai Haas (ms)</span>
                <span className="text-[#EC4899] font-bold">{config.modulation.haasDelayMs} ms</span>
              </div>
              <input
                type="range"
                min="0"
                max="35"
                value={config.modulation.haasDelayMs}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    modulation: { ...config.modulation, haasDelayMs: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#EC4899]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Mix Modulation</span>
                <span className="text-[#EC4899] font-bold">{config.modulation.mix}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={config.modulation.mix}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    modulation: { ...config.modulation, mix: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#EC4899]"
              />
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 14. TRANSIENT SHAPER (PUNCH & SUSTAIN)                   */}
      {/* ======================================================== */}
      {config.transient.enabled && shouldShow('transient') && (
        <div className="p-4 bg-[#0B0B16] border border-[#14B8A6]/40 shadow-lg rounded space-y-3">
          <div className="flex items-center justify-between border-b border-[#14B8A6]/20 pb-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#14B8A6]" />
              <h4 className="text-xs font-pixel font-bold text-[#14B8A6]">
                14. TRANSIENT SHAPER (ATTAQUE, IMPACT & SUSTAIN)
              </h4>
            </div>
            <span className="text-[10px] font-mono text-[#14B8A6] bg-[#14B8A6]/15 px-2 py-0.5 rounded border border-[#14B8A6]/30">
              ACTIF
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Attaque / Punch</span>
                <span className="text-[#14B8A6] font-bold">
                  {config.transient.attackDb > 0 ? `+${config.transient.attackDb}` : config.transient.attackDb} dB
                </span>
              </div>
              <input
                type="range"
                min="-12"
                max="12"
                step="0.5"
                value={config.transient.attackDb}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    transient: { ...config.transient, attackDb: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#14B8A6]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Sustain / Résonance</span>
                <span className="text-[#14B8A6] font-bold">
                  {config.transient.sustainDb > 0 ? `+${config.transient.sustainDb}` : config.transient.sustainDb} dB
                </span>
              </div>
              <input
                type="range"
                min="-18"
                max="12"
                step="0.5"
                value={config.transient.sustainDb}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    transient: { ...config.transient, sustainDb: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#14B8A6]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Rapidité Punch (ms)</span>
                <span className="text-[#14B8A6] font-bold">{config.transient.punchSpeedMs} ms</span>
              </div>
              <input
                type="range"
                min="5"
                max="60"
                value={config.transient.punchSpeedMs}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    transient: { ...config.transient, punchSpeedMs: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#14B8A6]"
              />
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 15. PITCH SHIFT & MUSICAL NOTE TUNER                     */}
      {/* ======================================================== */}
      {config.pitchRing.enabled && shouldShow('pitchRing') && (
        <div className="p-4 bg-[#0B0B16] border border-[#818CF8]/40 shadow-lg rounded space-y-3">
          <div className="flex items-center justify-between border-b border-[#818CF8]/20 pb-2">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-[#818CF8]" />
              <h4 className="text-xs font-pixel font-bold text-[#818CF8]">
                15. TRANSPOSITION MUSICALE & ACCORDAGE DE NOTE (NOTE PITCH TUNER)
              </h4>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-[#818CF8] bg-[#818CF8]/15 px-2 py-0.5 rounded border border-[#818CF8]/30">
                {config.pitchRing.algorithm === 'hq-resample'
                  ? '⚡ HQ RESAMPLE (RE-PITCH)'
                  : config.pitchRing.algorithm === 'sola-time-preserve'
                  ? '⏱️ WSOLA (TEMPS FIXE)'
                  : '✨ GRANULAR'}
              </span>
            </div>
          </div>

          {/* Quick Musical Note Transposition Bar */}
          <div className="p-2.5 bg-[#141428] border border-[#818CF8]/30 rounded space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
              <span className="text-[#8E8E98] flex items-center gap-1.5">
                🎵 <strong className="text-white">Note Cible / Transposition :</strong>
              </span>
              <div className="flex items-center gap-1 flex-wrap">
                {(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const).map((note) => {
                  const isSelected = config.pitchRing.targetNote === note;
                  return (
                    <button
                      key={note}
                      type="button"
                      onClick={() => {
                        const noteMap: Record<string, number> = {
                          C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5,
                          'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11,
                        };
                        const targetSemis = noteMap[note] ?? 0;
                        onChangeConfig({
                          ...config,
                          pitchRing: {
                            ...config.pitchRing,
                            targetNote: note,
                            pitchSemitones: targetSemis,
                          },
                        });
                      }}
                      className={`px-2 py-0.5 text-[11px] font-bold rounded transition-colors ${
                        isSelected
                          ? 'bg-[#818CF8] text-black shadow-md shadow-[#818CF8]/30'
                          : 'bg-[#1D1D36] text-[#A5B4FC] hover:bg-[#28284C]'
                      }`}
                    >
                      {note}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick action buttons */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-[#818CF8]/15">
              <button
                type="button"
                onClick={() =>
                  onChangeConfig({
                    ...config,
                    pitchRing: {
                      ...config.pitchRing,
                      pitchSemitones: Math.max(-24, config.pitchRing.pitchSemitones - 12),
                    },
                  })
                }
                className="px-2 py-1 text-[10px] font-mono bg-[#1C1C36] hover:bg-[#28284E] text-[#818CF8] border border-[#818CF8]/30 rounded transition-colors"
              >
                -12 st (-1 Oct)
              </button>
              <button
                type="button"
                onClick={() =>
                  onChangeConfig({
                    ...config,
                    pitchRing: {
                      ...config.pitchRing,
                      pitchSemitones: Math.max(-24, config.pitchRing.pitchSemitones - 1),
                    },
                  })
                }
                className="px-2 py-1 text-[10px] font-mono bg-[#1C1C36] hover:bg-[#28284E] text-[#818CF8] border border-[#818CF8]/30 rounded transition-colors"
              >
                -1 st
              </button>
              <button
                type="button"
                onClick={() =>
                  onChangeConfig({
                    ...config,
                    pitchRing: {
                      ...config.pitchRing,
                      pitchSemitones: 0,
                      pitchCents: 0,
                      targetNote: 'C',
                    },
                  })
                }
                className="px-2 py-1 text-[10px] font-mono bg-[#1C1C36] hover:bg-[#28284E] text-white border border-[#818CF8]/30 rounded transition-colors"
              >
                Reset (0 st)
              </button>
              <button
                type="button"
                onClick={() =>
                  onChangeConfig({
                    ...config,
                    pitchRing: {
                      ...config.pitchRing,
                      pitchSemitones: Math.min(24, config.pitchRing.pitchSemitones + 1),
                    },
                  })
                }
                className="px-2 py-1 text-[10px] font-mono bg-[#1C1C36] hover:bg-[#28284E] text-[#818CF8] border border-[#818CF8]/30 rounded transition-colors"
              >
                +1 st
              </button>
              <button
                type="button"
                onClick={() =>
                  onChangeConfig({
                    ...config,
                    pitchRing: {
                      ...config.pitchRing,
                      pitchSemitones: Math.min(24, config.pitchRing.pitchSemitones + 12),
                    },
                  })
                }
                className="px-2 py-1 text-[10px] font-mono bg-[#1C1C36] hover:bg-[#28284E] text-[#818CF8] border border-[#818CF8]/30 rounded transition-colors"
              >
                +12 st (+1 Oct)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <span className="text-[#8E8E98]">Algorithme de Pitch</span>
              <select
                value={config.pitchRing.algorithm || 'hq-resample'}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    pitchRing: {
                      ...config.pitchRing,
                      algorithm: e.target.value as any,
                    },
                  })
                }
                className="w-full bg-[#1A1A2E] text-[#818CF8] border border-[#303046] px-2 py-1 text-xs rounded outline-none"
              >
                <option value="hq-resample">HQ Spline Resample (808 / Kick / Stab)</option>
                <option value="sola-time-preserve">WSOLA Time-Preserve (Mélodie / Voix)</option>
                <option value="granular">Granular Crossfade (FX Créatif)</option>
              </select>
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Demi-Tons (Semitones)</span>
                <span className="text-[#818CF8] font-bold">
                  {config.pitchRing.pitchSemitones > 0 ? `+${config.pitchRing.pitchSemitones}` : config.pitchRing.pitchSemitones} st
                </span>
              </div>
              <input
                type="range"
                min="-24"
                max="24"
                step="1"
                value={config.pitchRing.pitchSemitones}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    pitchRing: { ...config.pitchRing, pitchSemitones: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#818CF8]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Accord Fin (Cents)</span>
                <span className="text-[#818CF8] font-bold">
                  {config.pitchRing.pitchCents > 0 ? `+${config.pitchRing.pitchCents}` : config.pitchRing.pitchCents} ¢
                </span>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                step="1"
                value={config.pitchRing.pitchCents || 0}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    pitchRing: { ...config.pitchRing, pitchCents: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#818CF8]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Porteuse Ring Mod</span>
                <span className="text-[#818CF8] font-bold">{config.pitchRing.ringModFreqHz} Hz</span>
              </div>
              <input
                type="range"
                min="0"
                max="1500"
                step="10"
                value={config.pitchRing.ringModFreqHz}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    pitchRing: { ...config.pitchRing, ringModFreqHz: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#818CF8]"
              />
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 16. STEREO IMAGER, AUTOPAN & TREMOLO                     */}
      {/* ======================================================== */}
      {config.imager.enabled && shouldShow('imager') && (
        <div className="p-4 bg-[#0B0B16] border border-[#6366F1]/40 shadow-lg rounded space-y-3">
          <div className="flex items-center justify-between border-b border-[#6366F1]/20 pb-2">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-[#6366F1]" />
              <h4 className="text-xs font-pixel font-bold text-[#6366F1]">
                16. ÉLARGISSEUR STÉRÉO MID/SIDE (0-200%), AUTOPAN & TRÉMOLO
              </h4>
            </div>
            <span className="text-[10px] font-mono text-[#6366F1] bg-[#6366F1]/15 px-2 py-0.5 rounded border border-[#6366F1]/30">
              ACTIF
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Largeur Stéréo (Width)</span>
                <span className="text-[#6366F1] font-bold">
                  {config.imager.widthPercent === 0 ? 'Mono (0%)' : `${config.imager.widthPercent}%`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="200"
                value={config.imager.widthPercent}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    imager: { ...config.imager, widthPercent: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#6366F1]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Vitesse Auto-Pan (Hz)</span>
                <span className="text-[#6366F1] font-bold">{config.imager.autopanRateHz} Hz</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="0.1"
                value={config.imager.autopanRateHz}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    imager: { ...config.imager, autopanRateHz: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#6366F1]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Profondeur Pan</span>
                <span className="text-[#6366F1] font-bold">{config.imager.autopanDepth}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={config.imager.autopanDepth}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    imager: { ...config.imager, autopanDepth: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#6366F1]"
              />
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 17. VOCAL FORMANT & ROBOT TALKBOX                        */}
      {/* ======================================================== */}
      {config.formant.enabled && shouldShow('formant') && (
        <div className="p-4 bg-[#0B0B16] border border-[#D946EF]/40 shadow-lg rounded space-y-3">
          <div className="flex items-center justify-between border-b border-[#D946EF]/20 pb-2">
            <div className="flex items-center gap-2">
              <Disc className="w-4 h-4 text-[#D946EF]" />
              <h4 className="text-xs font-pixel font-bold text-[#D946EF]">
                17. FILTRE VOCAL FORMANTS ROBOT (A-E-I-O-U) & TALKBOX
              </h4>
            </div>
            <span className="text-[10px] font-mono text-[#D946EF] bg-[#D946EF]/15 px-2 py-0.5 rounded border border-[#D946EF]/30">
              ACTIF
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <span className="text-[#8E8E98]">Voyelle Résonante</span>
              <select
                value={config.formant.vowel}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    formant: { ...config.formant, vowel: e.target.value as any },
                  })
                }
                className="w-full bg-[#1A1A2E] text-[#D946EF] border border-[#303046] px-2 py-1 text-xs rounded outline-none"
              >
                <option value="a">Voyelle [A] (Grave ouvert)</option>
                <option value="e">Voyelle [E] (Médium brillant)</option>
                <option value="i">Voyelle [I] (Aigu perçant)</option>
                <option value="o">Voyelle [O] (Creux profond)</option>
                <option value="u">Voyelle [U] (Guttural sombre)</option>
                <option value="auto-morph">Morphing Continu Automatique LFO</option>
              </select>
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Décalage Formants (Shift)</span>
                <span className="text-[#D946EF] font-bold">
                  {config.formant.formantShift > 0 ? `+${config.formant.formantShift}` : config.formant.formantShift} st
                </span>
              </div>
              <input
                type="range"
                min="-12"
                max="12"
                value={config.formant.formantShift}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    formant: { ...config.formant, formantShift: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#D946EF]"
              />
            </div>

            <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-[#8E8E98]">Mix Formants</span>
                <span className="text-[#D946EF] font-bold">{config.formant.mix}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={config.formant.mix}
                onChange={(e) =>
                  onChangeConfig({
                    ...config,
                    formant: { ...config.formant, mix: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#D946EF]"
              />
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 18. SURGICAL TOOLS & TAPE STOP                           */}
      {/* ======================================================== */}
      {(config.surgical.reverse ||
        config.surgical.tapeStopBrakeSec > 0 ||
        config.surgical.fadeInSec > 0 ||
        config.surgical.fadeOutSec > 0 ||
        config.surgical.normalizePeak) &&
        shouldShow('surgical') && (
          <div className="p-4 bg-[#0B0B16] border border-[#F97316]/40 shadow-lg rounded space-y-3">
            <div className="flex items-center justify-between border-b border-[#F97316]/20 pb-2">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-[#F97316]" />
                <h4 className="text-xs font-pixel font-bold text-[#F97316]">
                  18. TAPE STOP VINYL BRAKE & OUTILS CHIRURGIE AUDIO
                </h4>
              </div>
              <span className="text-[10px] font-mono text-[#F97316] bg-[#F97316]/15 px-2 py-0.5 rounded border border-[#F97316]/30">
                ACTIF
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs font-mono">
              <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#8E8E98]">Frein Vinyle (Tape Stop)</span>
                  <span className="text-[#F97316] font-bold">
                    {config.surgical.tapeStopBrakeSec === 0 ? 'Désactivé' : `${config.surgical.tapeStopBrakeSec} s`}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2.5"
                  step="0.05"
                  value={config.surgical.tapeStopBrakeSec}
                  onChange={(e) =>
                    onChangeConfig({
                      ...config,
                      surgical: {
                        ...config.surgical,
                        tapeStopBrakeSec: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full accent-[#F97316]"
                />
              </div>

              <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#8E8E98]">Fondu Entrée (Fade In)</span>
                  <span className="text-[#38BDF8] font-bold">{config.surgical.fadeInSec} s</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.05"
                  value={config.surgical.fadeInSec}
                  onChange={(e) =>
                    onChangeConfig({
                      ...config,
                      surgical: { ...config.surgical, fadeInSec: Number(e.target.value) },
                    })
                  }
                  className="w-full accent-[#38BDF8]"
                />
              </div>

              <div className="p-2 bg-[#121222] border border-[#202036] rounded space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#8E8E98]">Fondu Sortie (Fade Out)</span>
                  <span className="text-[#38BDF8] font-bold">{config.surgical.fadeOutSec} s</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.05"
                  value={config.surgical.fadeOutSec}
                  onChange={(e) =>
                    onChangeConfig({
                      ...config,
                      surgical: { ...config.surgical, fadeOutSec: Number(e.target.value) },
                    })
                  }
                  className="w-full accent-[#38BDF8]"
                />
              </div>

              <div className="col-span-full p-2 bg-[#121222] border border-[#202036] rounded flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 cursor-pointer text-[#8E8E98] hover:text-white">
                  <input
                    type="checkbox"
                    checked={config.surgical.reverse}
                    onChange={(e) =>
                      onChangeConfig({
                        ...config,
                        surgical: { ...config.surgical, reverse: e.target.checked },
                      })
                    }
                    className="accent-[#F97316]"
                  />
                  <span>Lecture Inversée (Reverse Audio)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-[#8E8E98] hover:text-white">
                  <input
                    type="checkbox"
                    checked={config.surgical.normalizePeak}
                    onChange={(e) =>
                      onChangeConfig({
                        ...config,
                        surgical: { ...config.surgical, normalizePeak: e.target.checked },
                      })
                    }
                    className="accent-[#10B981]"
                  />
                  <span>Normaliser la Crête (-0.3 dBFS)</span>
                </label>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};
