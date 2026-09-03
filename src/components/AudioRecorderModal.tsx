import React, { useState, useRef, useEffect } from 'react';
import { toast } from '../stores/toastStore';
import { Mic, Square, Play, Pause, Check } from 'lucide-react';
import { Modal } from './Modal';
import { SampleItem } from '../types/sample';
import { audioEngine } from '../services/audioEngine';
import { useAudition } from '../stores/transportStore';
import {
  calculateAudioMetrics,
  classifySample,
  detectAutoSlices,
  detectBpm,
  detectPitchAndKey,
  detectLoopVsOneShot,
  classifyGenre,
  assignEp133Slot,
} from '../services/audioAnalyzer';
import { audioBufferToWavBlob } from '../services/audioConverter';

interface AudioRecorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveRecordedSample: (newSample: SampleItem) => void;
}

export const AudioRecorderModal: React.FC<AudioRecorderModalProps> = ({
  isOpen,
  onClose,
  onSaveRecordedSample,
}) => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordedBuffer, setRecordedBuffer] = useState<AudioBuffer | null>(null);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [sampleName, setSampleName] = useState<string>('Mic_Recording_01');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopRecording();
      setRecordedBuffer(null);
      setRecordingDuration(0);
    }
  }, [isOpen]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = audioEngine.getAudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const arrayBuf = await audioBlob.arrayBuffer();
        try {
          const decoded = await ctx.decodeAudioData(arrayBuf);
          setRecordedBuffer(decoded);
        } catch (err) {
          console.error('Error decoding recorded audio:', err);
        }
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current.start(100);
      setIsRecording(true);
      setRecordingDuration(0);

      const startTime = Date.now();
      timerRef.current = window.setInterval(() => {
        setRecordingDuration((Date.now() - startTime) / 1000);
      }, 100);

      // Start live visualizer
      drawLiveScope();
    } catch (err) {
      console.error('Microphone access error:', err);
      toast.error("Impossible d'accéder au microphone. Vérifiez les permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    }
  };

  const drawLiveScope = () => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animationFrameRef.current = requestAnimationFrame(render);
      analyser.getByteTimeDomainData(dataArray);

      ctx.fillStyle = '#0A0A0B';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 2;
      ctx.strokeStyle = '#00F0FF';
      ctx.beginPath();

      const sliceWidth = (canvas.width * 1.0) / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };

    render();
  };

  const handlePlayPreview = () => {
    if (!recordedBuffer) return;
    if (isPlaying) {
      audioEngine.stop();
      setIsPlaying(false);
    } else {
      audioEngine.play(recordedBuffer, 'rec-preview');
      setIsPlaying(true);
      setTimeout(() => setIsPlaying(false), recordedBuffer.duration * 1000);
    }
  };

  // Space previews the take; while recording it does nothing, so a stray press
  // cannot cut a take short.
  useAudition('Enregistrement', handlePlayPreview, isOpen && !isRecording);

  const handleSaveToLibrary = () => {
    if (!recordedBuffer) return;

    const metrics = calculateAudioMetrics(recordedBuffer);
    const pitchKey = detectPitchAndKey(recordedBuffer);
    const loopAnalysis = detectLoopVsOneShot(recordedBuffer);
    const bpm = loopAnalysis.bpm || detectBpm(recordedBuffer);
    const slices = detectAutoSlices(recordedBuffer, { sensitivity: 0.5 });
    const classification = classifySample(recordedBuffer, sampleName, metrics, slices.length);
    const genre = classifyGenre(sampleName, bpm, loopAnalysis.isLoop, classification.type);
    const ep133Slot = assignEp133Slot(classification.type, loopAnalysis.isLoop, Math.floor(Math.random() * 80) + 1);

    const targetLufs = -14.0;
    const loudnessGainDb = Math.max(-12, Math.min(12, targetLufs - metrics.lufs));

    const wavBlob = audioBufferToWavBlob(recordedBuffer, {
      bitDepth: 24,
      normalize: true,
      targetPeakDb: -0.2,
      removeDc: true,
    });

    const newSample: SampleItem = {
      id: `rec-${Date.now().toString(36)}`,
      name: sampleName,
      originalFileName: `${sampleName}.wav`,
      format: 'wav',
      size: wavBlob.size,
      duration: recordedBuffer.duration,
      sampleRate: recordedBuffer.sampleRate,
      bitDepth: 24,
      channels: recordedBuffer.numberOfChannels,
      bpm,
      key: pitchKey?.keyString,
      musicalMode: pitchKey?.mode,
      confidence: pitchKey?.confidence,
      pitchHz: pitchKey?.pitchHz,
      type: classification.type,
      category: loopAnalysis.isLoop ? 'loop' : 'one-shot',
      genre,
      isLoop: loopAnalysis.isLoop,
      loopBars: loopAnalysis.estimatedBars,
      lufs: metrics.lufs,
      loudnessGainDb,
      ep133Slot,
      tags: [...classification.tags, 'recorded', 'mic', genre.split(' ')[0]],
      folderId: 'f-drums',
      folderPath: '/Recorded Samples',
      favorite: false,
      rating: 4,
      spectralCentroid: metrics.spectralCentroid,
      dynamicRangeDb: metrics.dynamicRangeDb,
      peakDb: -0.2,
      rmsDb: metrics.rmsDb,
      zeroCrossingRate: metrics.zeroCrossingRate,
      slices,
      blobUrl: URL.createObjectURL(wavBlob),
      audioBuffer: recordedBuffer,
      dateAdded: Date.now(),
      isMultiSound: classification.isMultiSound,
    };

    onSaveRecordedSample(newSample);
    onClose();
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="sm"
      accent="#EF4444"
      icon={<Mic className="h-5 w-5" />}
      title="Enregistreur micro & studio line-in"
      subtitle="Capture directe avec auto-triage et découpe automatique"
    >
        {/* Body */}
        <div className="space-y-5 text-center">
          {/* Waveform / Live Canvas */}
          <div className="relative w-full h-32 bg-[#0A0A0B] rounded-lg border border-[#26262B] overflow-hidden flex items-center justify-center">
            <canvas ref={canvasRef} width={400} height={128} className="w-full h-full block" />
            {isRecording && (
              <div className="absolute top-3 right-3 flex items-center gap-2 bg-[#1C1215] border border-[#EF4444]/50 px-2.5 py-1 rounded-full text-xs font-mono text-[#EF4444]">
                <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-ping" />
                <span>REC {recordingDuration.toFixed(1)}s</span>
              </div>
            )}
          </div>

          {/* Record / Stop Button */}
          <div className="flex items-center justify-center gap-4">
            {!isRecording ? (
              <button
                id="start-recording-btn"
                onClick={startRecording}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#EF4444] hover:bg-[#DC2626] text-white font-bold text-xs shadow-md transition font-mono active:scale-95"
              >
                <Mic className="w-4 h-4" />
                <span>Démarrer l'Enregistrement</span>
              </button>
            ) : (
              <button
                id="stop-recording-btn"
                onClick={stopRecording}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#F59E0B] hover:bg-[#D97706] text-[#0A0A0B] font-bold text-xs shadow-md transition font-mono active:scale-95 animate-pulse"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>Arrêter ({recordingDuration.toFixed(1)}s)</span>
              </button>
            )}

            {recordedBuffer && !isRecording && (
              <button
                id="preview-recording-btn"
                onClick={handlePlayPreview}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#18181D] hover:bg-[#222228] text-[#EDEDEE] border border-[#26262B] font-semibold text-xs transition font-mono"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>Écouter</span>
              </button>
            )}
          </div>

          {/* Sample Naming */}
          {recordedBuffer && (
            <div className="text-left space-y-1.5 pt-2 border-t border-[#222226] animate-in fade-in">
              <label className="block text-xs font-semibold text-[#EDEDEE] font-mono">
                Nom du Sample Enregistré
              </label>
              <input
                type="text"
                value={sampleName}
                onChange={(e) => setSampleName(e.target.value)}
                className="w-full bg-[#111114] border border-[#222226] rounded-lg px-3 py-2 text-xs font-mono text-[#00F0FF] focus:outline-none focus:border-[#00F0FF]"
              />
            </div>
          )}
        </div>

        {/* Footer action */}
        <div className="mt-6 flex items-center justify-end border-t border-[#222226] pt-4">
          <button
            id="save-recording-to-lib-btn"
            onClick={handleSaveToLibrary}
            disabled={!recordedBuffer || isRecording}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-[#00F0FF] hover:bg-[#38BDF8] text-[#0A0A0B] font-bold text-xs shadow-md transition disabled:opacity-40 font-mono"
          >
            <Check className="w-4 h-4" />
            <span>Ajouter à la Bibliothèque</span>
          </button>
        </div>
    </Modal>
  );
};
