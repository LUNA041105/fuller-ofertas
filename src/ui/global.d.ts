import type { FullerApi } from '../../electron/preload/index';

declare global {
  interface Window {
    fuller: FullerApi;
  }
}

export {};
