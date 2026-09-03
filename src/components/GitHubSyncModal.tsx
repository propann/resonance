import React, { useState, useEffect, useRef } from 'react';
import {
  Github,
  CheckCircle2,
  AlertCircle,
  Download,
  UploadCloud,
  Terminal,
  FolderTree,
  ExternalLink,
  Copy,
  Check,
  Lock,
  RefreshCw,
  Sparkles,
  Layers,
  Music,
  FileCode,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { Modal } from './Modal';
import { SampleItem } from '../types/sample';
import {
  GitHubSyncConfig,
  DEFAULT_GITHUB_CONFIG,
  SyncProgressUpdate,
  buildRepositoryZip,
  pushToGitHubDirect,
  generatePushScript,
} from '../services/gitHubSync';
import { triggerFileDownload } from '../services/audioConverter';
import { isDesktop, desktopFS } from '../services/desktopBridge';

const PAT_KEY = 'resonance_github_pat';

/** Load the GitHub PAT: encrypted OS store on desktop, sessionStorage otherwise. */
async function loadStoredPat(): Promise<string> {
  if (isDesktop()) {
    try {
      return (await desktopFS().getSecret(PAT_KEY)) ?? '';
    } catch {
      return '';
    }
  }
  try {
    return sessionStorage.getItem(PAT_KEY) ?? '';
  } catch {
    return '';
  }
}

function storePat(token: string): void {
  if (isDesktop()) {
    void desktopFS().setSecret(PAT_KEY, token || null);
    return;
  }
  try {
    if (token) sessionStorage.setItem(PAT_KEY, token);
    else sessionStorage.removeItem(PAT_KEY);
  } catch {
    /* storage unavailable */
  }
}

interface GitHubSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  samples: SampleItem[];
}

type TabType = 'push' | 'zip' | 'cli' | 'tree';

export const GitHubSyncModal: React.FC<GitHubSyncModalProps> = ({
  isOpen,
  onClose,
  samples,
}) => {
  const [config, setConfig] = useState<GitHubSyncConfig>(() => ({ ...DEFAULT_GITHUB_CONFIG }));

  const [activeTab, setActiveTab] = useState<TabType>('push');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<SyncProgressUpdate | null>(null);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [commitResult, setCommitResult] = useState<{ success: boolean; commitUrl?: string; error?: string } | null>(null);
  const [copiedCli, setCopiedCli] = useState<boolean>(false);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);

  // Load any previously stored token once.
  useEffect(() => {
    let cancelled = false;
    void loadStoredPat().then((token) => {
      if (!cancelled && token) setConfig((prev) => ({ ...prev, token }));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist the token only after the user has actually touched it — never on
  // the initial empty mount (that write raced config persistence on startup).
  const tokenTouched = useRef(false);
  useEffect(() => {
    if (!tokenTouched.current) {
      if (!config.token) return; // still empty / not yet loaded — nothing to store
      tokenTouched.current = true;
    }
    storePat(config.token || '');
  }, [config.token]);

  const handlePushDirect = async () => {
    setIsProcessing(true);
    setCommitResult(null);
    setConsoleLogs([
      `[${new Date().toLocaleTimeString()}] 🚀 Démarrage de la synchronisation vers ${config.owner}/${config.repo}...`,
      `[${new Date().toLocaleTimeString()}] 📦 Traitement de ${samples.length} samples du studio...`,
    ]);

    const result = await pushToGitHubDirect(samples, config, (p) => {
      setProgress(p);
      setConsoleLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] ${p.message}${p.currentFile ? ` (${p.currentFile})` : ''}`,
      ]);
    });

    setIsProcessing(false);
    setCommitResult(result);
  };

  const handleDownloadZip = async () => {
    setIsProcessing(true);
    setConsoleLogs([
      `[${new Date().toLocaleTimeString()}] 📦 Construction du package Git-Ready complet pour ${config.owner}/${config.repo}...`,
    ]);

    try {
      const zipBlob = await buildRepositoryZip(samples, config, (p) => {
        setProgress(p);
        setConsoleLogs((prev) => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] ${p.message}`,
        ]);
      });

      triggerFileDownload(zipBlob, `az-sample-repo-main_${Date.now().toString(36)}.zip`);
    } catch (err: any) {
      setConsoleLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] ❌ Erreur: ${err.message || String(err)}`,
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const cliSnippet = `git clone ${config.repoUrl}
cd ${config.repo}
# Décompressez ou exportez votre archive studio dans ce dossier
git add .
git commit -m "${config.commitMessage}"
git push origin ${config.branch}`;

  const copyToClipboard = (text: string, type: 'cli' | 'url') => {
    navigator.clipboard.writeText(text);
    if (type === 'cli') {
      setCopiedCli(true);
      setTimeout(() => setCopiedCli(false), 2000);
    } else {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="lg"
      accent="#00F0FF"
      icon={<Github className="h-5 w-5" />}
      title="GitHub Hub · propann / az-sample"
      subtitle={`Cible : ${config.repoUrl}`}
      bodyClassName="flex flex-col overflow-hidden"
      headerRight={
        <a
          href="https://github.com/propann/az-sample"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1F1F2E] hover:bg-[#2A2A3E] text-[#E2E8F0] border border-[#2E2E42] text-xs font-medium transition"
          title="Ouvrir le dépôt sur GitHub"
        >
          <span>Voir sur GitHub</span>
          <ExternalLink className="w-3.5 h-3.5 text-[#8A8A9E]" />
        </a>
      }
    >
        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 border-b border-[#2A2A3C] bg-[#14141E]">
          <button
            onClick={() => setActiveTab('push')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition ${
              activeTab === 'push'
                ? 'text-[#00F0FF] border-[#00F0FF] bg-[#00F0FF]/5'
                : 'text-[#8A8A9E] border-transparent hover:text-white hover:bg-[#1E1E2E]'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>Push Direct (GitHub API)</span>
          </button>

          <button
            onClick={() => setActiveTab('zip')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition ${
              activeTab === 'zip'
                ? 'text-[#A855F7] border-[#A855F7] bg-[#A855F7]/5'
                : 'text-[#8A8A9E] border-transparent hover:text-white hover:bg-[#1E1E2E]'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Export Archive Git-Ready (.ZIP)</span>
          </button>

          <button
            onClick={() => setActiveTab('cli')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition ${
              activeTab === 'cli'
                ? 'text-[#10B981] border-[#10B981] bg-[#10B981]/5'
                : 'text-[#8A8A9E] border-transparent hover:text-white hover:bg-[#1E1E2E]'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Commandes CLI Git</span>
          </button>

          <button
            onClick={() => setActiveTab('tree')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition ${
              activeTab === 'tree'
                ? 'text-[#FF7A00] border-[#FF7A00] bg-[#FF7A00]/5'
                : 'text-[#8A8A9E] border-transparent hover:text-white hover:bg-[#1E1E2E]'
            }`}
          >
            <FolderTree className="w-4 h-4" />
            <span>Arborescence Cible</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Status Quick Banner */}
          <div className="p-3.5 rounded-xl bg-[#1A1A28] border border-[#2E2E44] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-pulse" />
              <div>
                <span className="text-white font-semibold">Bibliothèque prête : </span>
                <span className="text-[#A855F7] font-mono font-bold">{samples.length} samples</span>
                <span className="text-[#8A8A9E]"> • Kits OP-1 AIFF • EP-133 Banks • Manifeste JSON</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => copyToClipboard(config.repoUrl, 'url')}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#252536] hover:bg-[#2E2E44] text-[#E2E8F0] border border-[#333348] text-[11px] transition"
              >
                {copiedUrl ? <Check className="w-3 h-3 text-[#10B981]" /> : <Copy className="w-3 h-3 text-[#8A8A9E]" />}
                <span>Copier URL</span>
              </button>
            </div>
          </div>

          {/* TAB 1: PUSH DIRECT */}
          {activeTab === 'push' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Repo Info */}
                <div className="space-y-3 p-4 rounded-xl bg-[#161622] border border-[#242436]">
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#00F0FF]" /> Configuration GitHub
                  </h3>

                  <div>
                    <label className="block text-[11px] text-[#8A8A9E] mb-1">Dépôt cible</label>
                    <input
                      type="text"
                      value={`${config.owner}/${config.repo}`}
                      disabled
                      className="w-full px-3 py-2 rounded-lg bg-[#0E0E14] border border-[#2A2A3C] text-xs text-white font-mono opacity-80"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-[#8A8A9E] mb-1">Branche cible</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={config.branch}
                        onChange={(e) => setConfig({ ...config, branch: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-[#0E0E14] border border-[#2A2A3C] text-xs text-white font-mono focus:border-[#00F0FF] outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-[#8A8A9E] mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Lock className="w-3 h-3 text-[#EAB308]" /> Personal Access Token (PAT)
                      </span>
                      <a
                        href="https://github.com/settings/tokens/new?scopes=repo&description=Engineering_Studio_az_sample"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-[#00F0FF] hover:underline flex items-center gap-0.5"
                      >
                        Générer un token (scope 'repo') <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </label>
                    <input
                      type="password"
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxx"
                      value={config.token || ''}
                      onChange={(e) => setConfig({ ...config, token: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-[#0E0E14] border border-[#2A2A3C] text-xs text-white font-mono focus:border-[#00F0FF] outline-none placeholder:text-[#4A4A5E]"
                    />
                    <p className="text-[10px] text-[#8A8A9E] mt-1">
                      Version bureau : le token est chiffré via le trousseau du système. Version
                      navigateur : conservé uniquement le temps de la session.
                    </p>
                  </div>
                </div>

                {/* Commit & Options */}
                <div className="space-y-3 p-4 rounded-xl bg-[#161622] border border-[#242436]">
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <FileCode className="w-4 h-4 text-[#A855F7]" /> Message de Commit & Options
                  </h3>

                  <div>
                    <label className="block text-[11px] text-[#8A8A9E] mb-1">Message de Commit</label>
                    <textarea
                      rows={2}
                      value={config.commitMessage}
                      onChange={(e) => setConfig({ ...config, commitMessage: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-[#0E0E14] border border-[#2A2A3C] text-xs text-white focus:border-[#00F0FF] outline-none resize-none"
                    />
                  </div>

                  <div className="space-y-2 pt-1">
                    <label className="flex items-center gap-2 text-xs text-[#E2E8F0] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.includeOp1Kits}
                        onChange={(e) => setConfig({ ...config, includeOp1Kits: e.target.checked })}
                        className="rounded border-[#2A2A3C] text-[#00F0FF] focus:ring-0"
                      />
                      <span>Inclure les kits OP-1 OG / Field (<code className="text-[#FF7A00]">op1_kits/*.aif</code>)</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs text-[#E2E8F0] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.includeEp133Pack}
                        onChange={(e) => setConfig({ ...config, includeEp133Pack: e.target.checked })}
                        className="rounded border-[#2A2A3C] text-[#00F0FF] focus:ring-0"
                      />
                      <span>Inclure la banque EP-133 (<code className="text-[#00F0FF]">ep133_packs/sound_*.wav</code>)</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs text-[#E2E8F0] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.normalizeLufs}
                        onChange={(e) => setConfig({ ...config, normalizeLufs: e.target.checked })}
                        className="rounded border-[#2A2A3C] text-[#00F0FF] focus:ring-0"
                      />
                      <span>Normalisation EBU R128 (-14 LUFS, Peak -0.5 dBFS)</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <div className="text-xs text-[#8A8A9E]">
                  {!config.token ? (
                    <span className="text-[#EAB308] flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> Entrez votre Token GitHub pour activer le push direct
                    </span>
                  ) : (
                    <span className="text-[#10B981] flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Prêt à pousser vers https://github.com/propann/az-sample
                    </span>
                  )}
                </div>

                <button
                  disabled={isProcessing || !config.token || samples.length === 0}
                  onClick={handlePushDirect}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#00F0FF] to-[#0099FF] text-black font-bold text-xs hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 shadow-lg shadow-[#00F0FF]/15"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Synchronisation en cours...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      <span>Pousser vers propann/az-sample (main)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Success Banner */}
              {commitResult?.success && (
                <div className="p-4 rounded-xl bg-[#10B981]/15 border border-[#10B981]/40 flex items-center justify-between gap-3 animate-fadeIn">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-[#10B981] shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-white">Synchronisation GitHub réussie !</h4>
                      <p className="text-[11px] text-[#A7F3D0]">
                        Les fichiers, kits OP-1, sons EP-133 et manifestes sont en ligne sur <code className="font-mono">propann/az-sample</code>.
                      </p>
                    </div>
                  </div>
                  {commitResult.commitUrl && (
                    <a
                      href={commitResult.commitUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-[#10B981] text-black text-xs font-bold hover:brightness-110 flex items-center gap-1 shrink-0 transition"
                    >
                      <span>Voir le commit</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              )}

              {/* Error Banner */}
              {commitResult?.error && (
                <div className="p-4 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/40 flex items-center gap-3 animate-fadeIn">
                  <AlertCircle className="w-5 h-5 text-[#EF4444] shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-white">Erreur lors de la synchronisation</h4>
                    <p className="text-[11px] text-[#FCA5A5]">{commitResult.error}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ZIP EXPORT */}
          {activeTab === 'zip' && (
            <div className="space-y-4">
              <div className="p-5 rounded-xl bg-[#161622] border border-[#242436] space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#A855F7]/10 border border-[#A855F7]/30 flex items-center justify-center text-[#A855F7]">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">Archive Complète Pré-Configurée (Git-Ready)</h3>
                    <p className="text-[11px] text-[#8A8A9E]">
                      Générez une archive ZIP structurée avec <code className="text-[#00F0FF]">README.md</code>, <code className="text-[#00F0FF]">manifest.json</code>, <code className="text-[#00F0FF]">.gitattributes</code> et script <code className="text-[#00F0FF]">push_to_az_sample.sh</code>.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-3 rounded-lg bg-[#0E0E14] border border-[#2A2A3C]">
                    <span className="text-[10px] text-[#8A8A9E] uppercase font-bold">Samples Master</span>
                    <p className="text-sm font-bold text-white mt-0.5">{samples.length} WAVs (24-bit)</p>
                  </div>
                  <div className="p-3 rounded-lg bg-[#0E0E14] border border-[#2A2A3C]">
                    <span className="text-[10px] text-[#8A8A9E] uppercase font-bold">Kits OP-1 OG</span>
                    <p className="text-sm font-bold text-[#FF7A00] mt-0.5">Automatiques (.AIF)</p>
                  </div>
                  <div className="p-3 rounded-lg bg-[#0E0E14] border border-[#2A2A3C]">
                    <span className="text-[10px] text-[#8A8A9E] uppercase font-bold">EP-133 Banks</span>
                    <p className="text-sm font-bold text-[#00F0FF] mt-0.5">Pads 001-099</p>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    disabled={isProcessing || samples.length === 0}
                    onClick={handleDownloadZip}
                    className="px-6 py-2.5 rounded-xl bg-[#A855F7] text-white font-bold text-xs hover:bg-[#9333EA] disabled:opacity-40 transition flex items-center gap-2 shadow-lg shadow-[#A855F7]/20"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Création du ZIP en cours...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Télécharger le Package Repository (.ZIP)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CLI COMMANDS */}
          {activeTab === 'cli' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#161622] border border-[#242436] space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Terminal className="w-4 h-4 text-[#10B981]" /> Instructions Git Terminal
                  </h3>
                  <button
                    onClick={() => copyToClipboard(cliSnippet, 'cli')}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#252536] hover:bg-[#2E2E44] text-[#E2E8F0] border border-[#333348] text-xs transition"
                  >
                    {copiedCli ? <Check className="w-3.5 h-3.5 text-[#10B981]" /> : <Copy className="w-3.5 h-3.5 text-[#8A8A9E]" />}
                    <span>{copiedCli ? 'Copié !' : 'Copier les commandes'}</span>
                  </button>
                </div>

                <pre className="p-4 rounded-xl bg-[#09090D] border border-[#202030] text-[#10B981] font-mono text-xs overflow-x-auto leading-relaxed">
                  {cliSnippet}
                </pre>

                <div className="text-[11px] text-[#8A8A9E] space-y-1">
                  <p>• Le dépôt est hébergé sur : <code className="text-white">https://github.com/propann/az-sample.git</code></p>
                  <p>• Les fichiers audio volumineux utilisent automatiquement Git LFS via la configuration <code className="text-white">.gitattributes</code>.</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TREE PREVIEW */}
          {activeTab === 'tree' && (
            <div className="p-4 rounded-xl bg-[#161622] border border-[#242436] space-y-3">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <FolderTree className="w-4 h-4 text-[#FF7A00]" /> Structure finale du dépôt az-sample
              </h3>

              <div className="p-4 rounded-xl bg-[#09090D] border border-[#202030] font-mono text-xs text-[#E2E8F0] space-y-1.5 overflow-x-auto">
                <div className="text-[#00F0FF] font-bold">propann/az-sample/</div>
                <div className="pl-4 text-[#8A8A9E]">├── <span className="text-[#E2E8F0]">README.md</span> <span className="text-[#555]">(Documentation et index des sons)</span></div>
                <div className="pl-4 text-[#8A8A9E]">├── <span className="text-[#E2E8F0]">manifest.json</span> <span className="text-[#555]">(BPM, tonalités, LUFS, transitoires)</span></div>
                <div className="pl-4 text-[#8A8A9E]">├── <span className="text-[#E2E8F0]">.gitattributes</span> <span className="text-[#555]">(Règles Git LFS Audio)</span></div>
                <div className="pl-4 text-[#8A8A9E]">├── <span className="text-[#FF7A00] font-bold">op1_kits/</span> <span className="text-[#555]">(Patches AIFF 24 pads OP-1 OG)</span></div>
                <div className="pl-8 text-[#8A8A9E]">├── az_sample_OP1_Kit_01.aif</div>
                <div className="pl-8 text-[#8A8A9E]">└── az_sample_OP1_Kit_02.aif</div>
                <div className="pl-4 text-[#8A8A9E]">├── <span className="text-[#00F0FF] font-bold">ep133_packs/</span> <span className="text-[#555]">(Banque Teenage Engineering 001-099)</span></div>
                <div className="pl-8 text-[#8A8A9E]">├── sound_001_Kick_*.wav</div>
                <div className="pl-8 text-[#8A8A9E]">└── sound_099_FX_*.wav</div>
                <div className="pl-4 text-[#8A8A9E]">├── <span className="text-[#10B981] font-bold">samples/</span> <span className="text-[#555]">(Master WAVs 24-bit triés)</span></div>
                <div className="pl-8 text-[#8A8A9E]">├── kicks/</div>
                <div className="pl-8 text-[#8A8A9E]">├── snares/</div>
                <div className="pl-8 text-[#8A8A9E]">├── claps/</div>
                <div className="pl-8 text-[#8A8A9E]">├── hihats/</div>
                <div className="pl-8 text-[#8A8A9E]">├── bass_808/</div>
                <div className="pl-8 text-[#8A8A9E]">├── leads/</div>
                <div className="pl-8 text-[#8A8A9E]">├── pads_chords/</div>
                <div className="pl-8 text-[#8A8A9E]">└── fx_textures/</div>
                <div className="pl-4 text-[#8A8A9E]">└── <span className="text-[#A855F7] font-bold">scripts/</span></div>
                <div className="pl-8 text-[#8A8A9E]">└── push_to_az_sample.sh</div>
              </div>
            </div>
          )}

          {/* Live Progress & Console Log */}
          {(isProcessing || consoleLogs.length > 0) && (
            <div className="p-4 rounded-xl bg-[#0D0D14] border border-[#202030] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#8A8A9E] font-semibold flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-[#00F0FF]" /> Console de Synchronisation
                </span>
                {progress && (
                  <span className="text-[#00F0FF] font-mono font-bold">{progress.progressPercent}%</span>
                )}
              </div>

              {progress && (
                <div className="w-full h-1.5 rounded-full bg-[#1F1F2E] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#00F0FF] via-[#A855F7] to-[#10B981] transition-all duration-300"
                    style={{ width: `${progress.progressPercent}%` }}
                  />
                </div>
              )}

              <div className="max-h-32 overflow-y-auto space-y-1 font-mono text-[11px] text-[#A0A0B2] pt-1">
                {consoleLogs.map((log, i) => (
                  <div key={i} className="leading-tight">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#2A2A3C] bg-[#14141E] flex items-center justify-between text-xs text-[#8A8A9E]">
          <span>
            Dépôt officiel : <strong className="text-white">https://github.com/propann/az-sample</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#252536] hover:bg-[#2E2E44] text-white font-medium transition"
          >
            Fermer
          </button>
        </div>
    </Modal>
  );
};
