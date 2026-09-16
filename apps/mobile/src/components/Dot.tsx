import { View, type ViewStyle } from 'react-native';

export const Dot = ({ color, size = 5, style }: { color: string; size?: number; style?: ViewStyle }) => (
  <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]} />
);
