// Type definitions for Lordicon JSON assets
declare module '*.json' {
  const value: any;
  export default value;
}

// Lordicon specific types
export interface LordIconData {
  v: string;
  fr: number;
  ip: number;
  op: number;
  w: number;
  h: number;
  nm: string;
  ddd: number;
  assets: any[];
  layers: any[];
  markers?: any[];
  props?: any;
}
