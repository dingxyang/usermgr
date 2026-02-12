/// <reference types="vite/client" />

declare global {
  interface Window {
    L?: unknown;
    __TAURI__?: unknown;
  }
}

export {};
