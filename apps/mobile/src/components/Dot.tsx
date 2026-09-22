import { View, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
  color: string;
  /** Diameter in pt. Default 6 (status dots in the v4 artboards). */
  size?: number;
  /** `hollow` draws a 1px ring (e.g. open marks on the record strip). */
  hollow?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Small status dot — Chartreuse (`highlight`) for live/landed, Oxblood for record marks. */
export const Dot = ({ color, size = 6, hollow = false, style }: Props) => (
  <View
    style={[
      { width: size, height: size, borderRadius: size / 2 },
      hollow ? { borderWidth: 1, borderColor: color } : { backgroundColor: color },
      style,
    ]}
  />
);
