import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { SlideInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppColor } from '@/hooks/useAppColor';

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

const BG_KEY_MAP: Record<ToastType, string> = {
  success: 'bgSuccess',
  error: 'bgDanger',
  warning: 'bgWarning',
  caution: 'bgWarning',
  info: 'bgPrimaryLight',
};

function ToastItem({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const colors = useAppColor();
  const iconName = ICON_MAP[toast.type];
  const colorKey = COLOR_KEY_MAP[toast.type] as keyof typeof colors;
  const bgKey = BG_KEY_MAP[toast.type] as keyof typeof colors;

  return (
    <View style={[styles.toastCard, { backgroundColor: colors.bgCard, shadowColor: colors.shadow }]}>
      <View style={[styles.toastAccent, { backgroundColor: colors[colorKey] as string }]} />
      <Ionicons name={iconName} size={22} color={colors[colorKey] as string} style={styles.toastIcon} />
      <View style={styles.toastContent}>
        {toast.title && <Text style={[styles.toastTitle, { color: colors.textPrimary }]} numberOfLines={1}>{toast.title}</Text>}
        <Text style={[styles.toastMessage, { color: colors.textSecondary }]} numberOfLines={2}>{toast.message}</Text>
      </View>
      <TouchableOpacity onPress={onDismiss} style={styles.toastDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close" size={18} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

function ToastOverlay({ toasts, dismissToast }: { toasts: ToastItem[]; dismissToast: (id: number) => void }) {
  const insets = useSafeAreaInsets();
  const colors = useAppColor();

  if (toasts.length === 0) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
      {toasts.map(toast => (
        <Animated.View
          key={toast.id}
          entering={SlideInUp.duration(300).springify()}
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
});
