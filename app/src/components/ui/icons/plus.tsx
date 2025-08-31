import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface PlusProps {
  size?: number;
  color?: string;
}

export const Plus = ({ size = 24, color = '#000000' }: PlusProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 5v14m-7-7h14"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
