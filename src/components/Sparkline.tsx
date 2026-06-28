import Svg, { Path } from 'react-native-svg';
import { useAppColor } from '@/hooks/useAppColor';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
}

export function Sparkline({
  data,
  width = 60,
  height = 28,
  color,
  strokeWidth = 2,
}: SparklineProps) {
  const colors = useAppColor();
  const lineColor = color || colors.accentPetrol;
  if (data.length < 2) return null;

  const min = Math.min(...data) * 0.98;
  const max = Math.max(...data) * 1.02;
  const range = max - min || 1;

  const xStep = width / (data.length - 1);
  const toY = (v: number) => height - ((v - min) / range) * height;

  const points = data.map((v, i) => `${i * xStep},${toY(v)}`).join(' ');

  return (
    <Svg width={width} height={height}>
      <Path d={`M${points}`} fill="none" stroke={lineColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
