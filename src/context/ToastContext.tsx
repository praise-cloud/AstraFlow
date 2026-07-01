import { createContext, useContext, useState, useCallback, useRef, ReactNode, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  BounceInDown,
  BounceIn,
  FadeOutUp,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppColor } from '@/hooks/useAppColor';
import { useHaptic } from '@/hooks/useHaptic';
import { useSound } from '@/hooks/useSound';

type ToastType = 'success' | 'error' | 'warning' | 'caution' | 'info';

type ToastConfig = {
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
};

type ToastItem = ToastConfig & {
  id: number;
};

type ToastContextType = {
  showToast: (config: ToastConfig) => void;
};

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const ICON_MAP: Record<ToastType, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  error: 'close-circle',
  warning: 'warning',
  caution: 'alert-circle',
  info: 'information-circle',
};

const COLOR_KEY_MAP: Record<ToastType, string> = {
  success: 'trendDown',
  error: 'trendUp',
  warning: 'trendStable',
  caution: 'trendStable',
  info: 'accentPetrol',
};

const HAPTIC_MAP: Record<ToastType, keyof ReturnType<typeof useHaptic>> = {
  success: 'hapticSuccess',
  error: 'hapticError',
  warning: 'hapticWarning',
  caution: 'hapticWarning',
  info: 'hapticLight',
};

const SOUND_MAP: Record<ToastType, keyof ReturnType<typeof useSound>> = {
  success: 'playSuccess',
  error: 'playError',
  warning: 'playTap',
  caution: 'playTap',
  info: 'playTap',
};

function ProgressBar({ duration, color }: { duration: number; color: string }) {
  const width = useSharedValue(100);

  useEffect(() => {
    width.value = 100;
    width.value = withTiming(0, {
      duration,
      easing: Easing.linear,
    });
  }, [duration]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${width.value}%` as any,
  }));

  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, { backgroundColor: color }, animatedStyle]} />
    </View>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const colors = useAppColor();
  const haptics = useHaptic();
  const sounds = useSound();
  const iconName = ICON_MAP[toast.type];
  const colorKey = COLOR_KEY_MAP[toast.type] as keyof typeof colors;
  const accentColor = colors[colorKey] as string;
  const translateX = useSharedValue(0);

  useEffect(() => {
    const hapticFn = haptics[HAPTIC_MAP[toast.type]];
    if (hapticFn) (hapticFn as () => void)();
    const soundFn = sounds[SOUND_MAP[toast.type]];
    if (soundFn) (soundFn as () => Promise<void>)();
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 10 && gs.dx > 0,
      onPanResponderMove: (_, gs) => {
        translateX.value = Math.max(0, gs.dx);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > 100) {
          onDismiss();
        } else {
          translateX.value = withTiming(0, { duration: 200 });
        }
      },
    })
  ).current;

  const swipeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View style={[styles.toastCard, { backgroundColor: colors.bgCard, shadowColor: colors.shadow }, swipeStyle]} {...panResponder.panHandlers}>
      <View style={[styles.toastAccent, { backgroundColor: accentColor }]} />

      <Animated.View entering={BounceIn.duration(400).springify()}>
        <Ionicons name={iconName} size={22} color={accentColor} style={styles.toastIcon} />
      </Animated.View>

      <View style={styles.toastContent}>
        {toast.title && (
          <Text style={[styles.toastTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {toast.title}
          </Text>
        )}
        <Text style={[styles.toastMessage, { color: colors.textSecondary }]} numberOfLines={2}>
          {toast.message}
        </Text>
      </View>

      <TouchableOpacity onPress={onDismiss} style={styles.toastDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close" size={18} color={colors.textMuted} />
      </TouchableOpacity>

      <ProgressBar duration={toast.duration || 3000} color={accentColor} />
    </Animated.View>
  );
}

function ToastOverlay({ toasts, dismissToast }: { toasts: ToastItem[]; dismissToast: (id: number) => void }) {
  const insets = useSafeAreaInsets();

  if (toasts.length === 0) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
      {toasts.map((toast, index) => (
        <Animated.View
          key={toast.id}
          entering={BounceInDown.delay(index * 80).duration(400).springify()}
          exiting={FadeOutUp.duration(200)}
          style={styles.toastAnimatedWrapper}
        >
          <ToastItem toast={toast} onDismiss={() => dismissToast(toast.id)} />
        </Animated.View>
      ))}
    </View>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback((config: ToastConfig) => {
    const id = nextId.current++;
    setToasts(prev => [...prev, { ...config, id }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, config.duration || 3000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastOverlay toasts={toasts} dismissToast={dismissToast} />
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toastAnimatedWrapper: {
    marginHorizontal: 12,
    marginBottom: 8,
  },
  toastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 12,
    paddingRight: 10,
    paddingBottom: 0,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    overflow: 'hidden',
  },
  toastAccent: {
    width: 4,
    alignSelf: 'stretch',
    marginRight: 10,
  },
  toastIcon: {
    marginRight: 8,
  },
  toastContent: {
    flex: 1,
    gap: 2,
  },
  toastTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  toastMessage: {
    fontSize: 13,
    lineHeight: 18,
  },
  toastDismiss: {
    padding: 4,
    marginLeft: 4,
  },
  progressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'transparent',
  },
  progressFill: {
    height: '100%',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    opacity: 0.35,
  },
});
