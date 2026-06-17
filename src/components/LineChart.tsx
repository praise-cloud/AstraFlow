import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Line, Circle, G, Text as SvgText } from 'react-native-svg';

type DataPoint = { label: string; value: number };

interface LineChartProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  color?: string;
  fillColor?: string;
  showLabels?: boolean;
  showGrid?: boolean;
}

export function LineChart({
  data,
  width = 340,
  height = 200,
  color = '#003087',
  fillColor = 'rgba(0,48,135,0.08)',
  showLabels = true,
  showGrid = true,
}: LineChartProps) {
  if (data.length === 0) return null;

  const padding = { top: 20, right: 16, bottom: 32, left: 48 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const values = data.map(d => d.value);
  const min = Math.min(...values) * 0.98;
  const max = Math.max(...values) * 1.02;
  const range = max - min || 1;

  const xStep = chartW / (data.length - 1);

  const toX = (i: number) => padding.left + i * xStep;
  const toY = (v: number) => padding.top + chartH - ((v - min) / range) * chartH;

  const linePoints = data.map((d, i) => `${toX(i)},${toY(d.value)}`).join(' ');
  const areaPoints = `${toX(0)},${padding.top + chartH} ${linePoints} ${toX(data.length - 1)},${padding.top + chartH}`;

  const gridLines = showGrid
    ? [0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
        const y = padding.top + chartH * (1 - pct);
        const label = (min + range * pct).toFixed(2);
        return (
          <G key={i}>
            <Line x1={padding.left} y1={y} x2={padding.left + chartW} y2={y} stroke="#e2e2e5" strokeWidth={1} />
            <SvgText x={padding.left - 8} y={y + 4} fill="#747683" fontSize={10} textAnchor="end">
              {label}
            </SvgText>
          </G>
        );
      })
    : null;

  return (
    <View style={styles.container}>
      <Svg width={width} height={height}>
        {gridLines}
        <Path d={`M${areaPoints}Z`} fill={fillColor} />
        <Path d={`M${linePoints}`} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d, i) => (
          <Circle key={i} cx={toX(i)} cy={toY(d.value)} r={3} fill={color} />
        ))}
        {showLabels &&
          data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 6)) === 0 || i === data.length - 1).map((d, i) => {
            const idx = data.indexOf(d);
            return (
              <SvgText
                key={i}
                x={toX(idx)}
                y={height - 8}
                fill="#747683"
                fontSize={10}
                textAnchor="middle"
              >
                {d.label}
              </SvgText>
            );
          })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
});
