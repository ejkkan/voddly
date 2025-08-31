declare module 'react-native-vector-icons/MaterialIcons' {
  import { type ComponentType } from 'react';
  import { type TextStyle } from 'react-native';
  export interface IconProps {
    name: string;
    size?: number;
    color?: string;
    style?: TextStyle;
  }
  const MaterialIcons: ComponentType<IconProps>;
  export default MaterialIcons;
}
