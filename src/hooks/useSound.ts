import { useRef, useCallback, useEffect, useState } from 'react';
import { Audio, AVPlaybackSource } from 'expo-av';

const SOURCES: Record<string, AVPlaybackSource> = {
  tap: require('../../assets/sounds/tap.wav'),
  success: require('../../assets/sounds/success.wav'),
  error: require('../../assets/sounds/error.wav'),
  whoosh: require('../../assets/sounds/whoosh.wav'),
  refresh: require('../../assets/sounds/refresh.wav'),
};

export function useSound() {
  const soundRefs = useRef<Record<string, Audio.Sound | null>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => {});
    return () => {
      Object.values(soundRefs.current).forEach((s) => s?.unloadAsync().catch(() => {}));
    };
  }, []);

  const ensureLoaded = useCallback(async (name: string) => {
    if (!soundRefs.current[name]) {
      const source = SOURCES[name];
      if (!source) return;
      const { sound } = await Audio.Sound.createAsync(source, { volume: 0.5 });
      soundRefs.current[name] = sound;
    }
    return soundRefs.current[name];
  }, []);

  const playTap = useCallback(async () => {
    const sound = await ensureLoaded('tap');
    if (sound) sound.replayAsync().catch(() => {});
  }, [ensureLoaded]);

  const playSuccess = useCallback(async () => {
    const sound = await ensureLoaded('success');
    if (sound) sound.replayAsync().catch(() => {});
  }, [ensureLoaded]);

  const playError = useCallback(async () => {
    const sound = await ensureLoaded('error');
    if (sound) sound.replayAsync().catch(() => {});
  }, [ensureLoaded]);

  const playWhoosh = useCallback(async () => {
    const sound = await ensureLoaded('whoosh');
    if (sound) sound.replayAsync().catch(() => {});
  }, [ensureLoaded]);

  const playRefresh = useCallback(async () => {
    const sound = await ensureLoaded('refresh');
    if (sound) sound.replayAsync().catch(() => {});
  }, [ensureLoaded]);

  const playByName = useCallback(
    async (name: string) => {
      const sound = await ensureLoaded(name);
      if (sound) sound.replayAsync().catch(() => {});
    },
    [ensureLoaded]
  );

  return { playTap, playSuccess, playError, playWhoosh, playRefresh, playByName, loaded };
}
