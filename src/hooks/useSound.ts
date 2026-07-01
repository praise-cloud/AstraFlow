import { useRef, useCallback, useEffect } from 'react';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';

const SOURCES: Record<string, string | number> = {
  tap: require('../../assets/sounds/tap.wav'),
  success: require('../../assets/sounds/success.wav'),
  error: require('../../assets/sounds/error.wav'),
  whoosh: require('../../assets/sounds/whoosh.wav'),
  refresh: require('../../assets/sounds/refresh.wav'),
};

export function useSound() {
  const playersRef = useRef<Record<string, AudioPlayer | null>>({});

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    return () => {
      Object.values(playersRef.current).forEach((p) => {
        if (p) { try { (p as any).release?.(); } catch {} }
      });
      playersRef.current = {};
    };
  }, []);

  const ensurePlayer = useCallback(async (name: string) => {
    if (!playersRef.current[name]) {
      const source = SOURCES[name];
      if (!source) return null;
      const player = createAudioPlayer(source);
      player.volume = 0.5;
      playersRef.current[name] = player;
    }
    return playersRef.current[name];
  }, []);

  const playTap = useCallback(async () => {
    const player = await ensurePlayer('tap');
    if (player) { await player.seekTo(0); player.play(); }
  }, [ensurePlayer]);

  const playSuccess = useCallback(async () => {
    const player = await ensurePlayer('success');
    if (player) { await player.seekTo(0); player.play(); }
  }, [ensurePlayer]);

  const playError = useCallback(async () => {
    const player = await ensurePlayer('error');
    if (player) { await player.seekTo(0); player.play(); }
  }, [ensurePlayer]);

  const playWhoosh = useCallback(async () => {
    const player = await ensurePlayer('whoosh');
    if (player) { await player.seekTo(0); player.play(); }
  }, [ensurePlayer]);

  const playRefresh = useCallback(async () => {
    const player = await ensurePlayer('refresh');
    if (player) { await player.seekTo(0); player.play(); }
  }, [ensurePlayer]);

  const playByName = useCallback(
    async (name: string) => {
      const player = await ensurePlayer(name);
      if (player) { await player.seekTo(0); player.play(); }
    },
    [ensurePlayer]
  );

  return { playTap, playSuccess, playError, playWhoosh, playRefresh, playByName, loaded: true };
}
