import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface ArrowLeftProps {
  size?: number;
  color?: string;
}

export const ArrowLeft = ({ size = 24, color = '#000000' }: ArrowLeftProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M19 12H5m7-7-7 7 7 7"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
