import React, { useEffect, useRef, useState } from 'react';
import { useWorkspaceStore } from '../store/workspaceStore';

export function AudioVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestRef = useRef<number>(null);

  const { wavUrl, isPlaying, volume, setIsPlaying } = useWorkspaceStore();

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.crossOrigin = "anonymous";
      audioRef.current.onended = () => {
        setIsPlaying(false);
      };
    }

    if (wavUrl) {
      audioRef.current.src = wavUrl;
    }
    
    return () => {
      audioRef.current?.pause();
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [wavUrl, setIsPlaying]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (isPlaying && wavUrl) {
      // AudioContext must be created after a user gesture
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        sourceRef.current = audioContextRef.current.createMediaElementSource(audioRef.current!);
        sourceRef.current.connect(analyserRef.current);
        analyserRef.current.connect(audioContextRef.current.destination);
      }
      
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }

      audioRef.current?.play().catch(e => {
        console.error("Playback failed:", e);
        setIsPlaying(false);
      });
      draw();
    } else {
      audioRef.current?.pause();
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    }
  }, [isPlaying, wavUrl]);

  const draw = () => {
    if (!canvasRef.current || !analyserRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);

    ctx.fillStyle = 'rgb(15, 23, 42)'; // slate-900 essentially
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const barWidth = (canvas.width / bufferLength) * 2.5;
    let barHeight;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      barHeight = dataArray[i];

      // Emerald-500 equivalent for the bars
      ctx.fillStyle = `rgb(16, 185, 129)`;
      ctx.fillRect(x, canvas.height - barHeight / 2, barWidth, barHeight / 2);

      x += barWidth + 1;
    }

    requestRef.current = requestAnimationFrame(draw);
  };

  return (
    <div className="w-full bg-slate-900 border border-slate-700/50 rounded-xl overflow-hidden h-28 flex items-center justify-center relative shadow-inner">
      {!wavUrl && !isPlaying && (
        <span className="text-[10px] text-slate-500 uppercase tracking-widest absolute">No audio generated yet</span>
      )}
      <canvas
        ref={canvasRef}
        width={400}
        height={100}
        className="w-full h-full object-cover opacity-80"
      />
    </div>
  );
}
