"use client";

import { useEffect, useRef, useState } from "react";

interface VuMeterProps {
  stream: MediaStream | null;
  bars?: number;
}

export function VuMeter({ stream, bars = 15 }: VuMeterProps) {
  const [levels, setLevels] = useState<number[]>(new Array(bars).fill(0));
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    if (!stream) return;

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);
    analyserRef.current = analyser;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    function update() {
      if (!analyserRef.current) return;
      analyserRef.current.getByteFrequencyData(dataArray);

      const step = Math.floor(dataArray.length / bars);
      const newLevels = Array.from({ length: bars }, (_, i) => {
        const value = dataArray[i * step] || 0;
        return value / 255;
      });

      setLevels(newLevels);
      animFrameRef.current = requestAnimationFrame(update);
    }

    animFrameRef.current = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      analyserRef.current = null;
      audioContext.close();
    };
  }, [stream, bars]);

  return (
    <div className="mt-3 pt-3 border-t border-border/50">
      <div className="text-xs text-muted-foreground mb-1.5">Niveau audio</div>
      <div className="flex items-end gap-0.5 h-8 bg-black/20 dark:bg-black/40 rounded px-2 py-1">
        {levels.map((level, i) => (
          <div
            key={i}
            className="w-1 rounded-sm transition-[height] duration-75"
            style={{
              height: `${Math.max(8, level * 100)}%`,
              backgroundColor: level > 0.8 ? "#facc15" : "#4ade80",
            }}
          />
        ))}
      </div>
    </div>
  );
}
