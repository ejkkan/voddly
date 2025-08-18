import { Platform } from 'react-native';

// Platform-specific input components
export const Input = Platform.isTV 
  ? require('./Input.tvos').Input
  : require('./Input.native').Input;

// Re-export controlled input
export const ControlledInput = Platform.isTV
  ? require('./Input.tvos').ControlledInput  
  : require('./Input.native').ControlledInput;
