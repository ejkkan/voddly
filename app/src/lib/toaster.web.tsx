/* eslint-disable */
import React from 'react';
import { Toaster } from 'sonner';

export function AppToasterHost() {
  return (
    <Toaster
      position="bottom-right"
      richColors
      closeButton
      expand
      toastOptions={{
        duration: 4000,
      }}
    />
  );
}
