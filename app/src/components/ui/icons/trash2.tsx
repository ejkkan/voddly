import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface Trash2Props {
  size?: number;
  color?: string;
}

export const Trash2 = ({ size = 24, color = '#000000' }: Trash2Props) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c0-1 1-2 2-2v2m-6 5v6m4-6v6"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
