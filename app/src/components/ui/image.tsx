import type { ImageProps } from 'expo-image';
import { Image as NImage } from 'expo-image';
import { cssInterop } from 'nativewind';
import * as React from 'react';

export type ImgProps = ImageProps & {
  className?: string;
};

cssInterop(NImage, { className: 'style' });

export const Image = ({
  style,
  className,
  placeholder = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4',
  ...props
}: ImgProps) => {
  // Pass-through: do not force protocol changes; let callers normalize
  const normalizeUri = (uri?: string) => uri;

  const normalizeSource = (source: ImgProps['source']): ImgProps['source'] => {
    if (!source) return source;
    if (Array.isArray(source)) {
      return source.map((s) =>
        typeof s === 'object' && s != null && 'uri' in s
          ? { ...s, uri: normalizeUri((s as any).uri) }
          : s
      ) as any;
    }
    if (typeof source === 'object' && 'uri' in source) {
      return {
        ...(source as any),
        uri: normalizeUri((source as any).uri),
      } as any;
    }
    return source;
  };

  const finalSource = normalizeSource((props as any).source);
  return (
    <NImage
      className={className}
      placeholder={placeholder}
      style={style}
      {...props}
      source={finalSource}
    />
  );
};

export const preloadImages = (sources: string[]) => {
  NImage.prefetch(sources);
};
