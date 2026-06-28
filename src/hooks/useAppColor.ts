import { LightColors, DarkColors } from '@/theme/appColors';
import { useTheme } from '@/context/ThemeContext';

export type AppColors = typeof LightColors;

export function useAppColor(): AppColors {
  const { theme } = useTheme();
  return theme === 'dark' ? (DarkColors as AppColors) : LightColors;
}
