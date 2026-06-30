import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppColor } from '@/hooks/useAppColor';

type StatusType = 'error' | 'warning' | 'success' | 'info' | 'caution';

interface StatusCardProps {
  type: StatusType;
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  dismissible?: boolean;
  onDismiss?: () => void;
}

const ICON_MAP: Record<StatusType, { name: keyof typeof Ionicons.glyphMap; colorKey: string }> = {
  error: { name: 'close-circle', colorKey: 'trendUp' },
  warning: { name: 'warning', colorKey: 'trendStable' },
  success: { name: 'checkmark-circle', colorKey: 'trendDown' },
  info: { name: 'information-circle', colorKey: 'accentPetrol' },
  caution: { name: 'alert-circle', colorKey: 'trendStable' },
};

const BG_MAP: Record<StatusType, string> = {
  error: 'bgDanger',
  warning: 'bgWarning',
  success: 'bgSuccess',
  info: 'bgPrimaryLight',
  caution: 'bgWarning',
};

export function StatusCard({
  type,
  title,
  message,
  actionLabel,
  onAction,
  dismissible,
  onDismiss,
}: StatusCardProps) {
  const colors = useAppColor();
  const icon = ICON_MAP[type];
  const bgKey = BG_MAP[type] as keyof typeof colors;
  const bgColor = colors[bgKey] || colors.bgCard;
  const iconColor = colors[icon.colorKey as keyof typeof colors] || colors.accentPetrol;

  return (
    <View style={[styles.card, { backgroundColor: bgColor }]}>
      <View style={styles.row}>
        <Ionicons name={icon.name} size={22} color={iconColor} style={styles.icon} />
        <View style={styles.content}>
          {title && <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>}
          <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
        </View>
        {dismissible && onDismiss && (
          <TouchableOpacity onPress={onDismiss} style={styles.dismissBtn}>
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      {actionLabel && onAction && (
        <TouchableOpacity style={[styles.actionBtn, { borderTopColor: colors.border }]} onPress={onAction}>
          <Text style={[styles.actionText, { color: iconColor }]}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function ErrorCard(props: Omit<StatusCardProps, 'type'>) {
  return <StatusCard type="error" {...props} />;
}

export function WarningCard(props: Omit<StatusCardProps, 'type'>) {
  return <StatusCard type="warning" {...props} />;
}

export function SuccessCard(props: Omit<StatusCardProps, 'type'>) {
  return <StatusCard type="success" {...props} />;
}

export function InfoCard(props: Omit<StatusCardProps, 'type'>) {
  return <StatusCard type="info" {...props} />;
}

export function CautionCard(props: Omit<StatusCardProps, 'type'>) {
  return <StatusCard type="caution" {...props} />;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    gap: 10,
  },
  icon: {
    marginTop: 1,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
  },
  dismissBtn: {
    padding: 2,
  },
  actionBtn: {
    borderTopWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'flex-start',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
