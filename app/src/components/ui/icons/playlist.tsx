import type { SvgProps } from 'react-native-svg';
import Svg, { Path } from 'react-native-svg';

interface PlaylistProps extends SvgProps {
  filled?: boolean;
}

export const Playlist = ({
  filled = false,
  color = '#000',
  ...props
}: PlaylistProps) => {
  if (filled) {
    return (
      <Svg width={24} height={24} fill="none" viewBox="0 0 24 24" {...props}>
        <Path
          fill={color}
          d="M3 5h10v2H3V5zm0 4h10v2H3V9zm0 4h7v2H3v-2zm16-8v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V7h3V5h-5z"
        />
      </Svg>
    );
  }

  return (
    <Svg width={24} height={24} fill="none" viewBox="0 0 24 24" {...props}>
      <Path
        fill={color}
        d="M3 5h10v2H3V5zm0 4h10v2H3V9zm0 4h7v2H3v-2zm16-8v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V7h3V5h-5z"
      />
    </Svg>
  );
};
