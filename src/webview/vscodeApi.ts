import type {
  ExtensionToWebviewMessage,
  WebviewToExtensionMessage,
} from '../types';

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

let api: VsCodeApi | undefined;

function getApi(): VsCodeApi {
  if (!api) {
    api = acquireVsCodeApi();
  }
  return api;
}

export function sendMessage(message: WebviewToExtensionMessage): void {
  getApi().postMessage(message);
}

export function onMessage(
  handler: (message: ExtensionToWebviewMessage) => void
): () => void {
  const listener = (event: MessageEvent) => {
    handler(event.data as ExtensionToWebviewMessage);
  };
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}

let requestIdCounter = 0;

export function generateRequestId(): string {
  return `req-${Date.now()}-${++requestIdCounter}`;
}
