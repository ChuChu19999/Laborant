// Полифилл для Web Crypto API (нужен для Keycloak в HTTP контексте)
// Keycloak JS 26+ требует Web Crypto API, который доступен только в HTTPS или localhost
import { Crypto } from '@peculiar/webcrypto';
import '@ant-design/v5-patch-for-react-19';
import './index.css';
import { createRoot } from 'react-dom/client';
import App from './App';

if (!window.crypto || !window.crypto.subtle) {
  const webCrypto = new Crypto();
  if (!window.crypto) {
    (window as Window & { crypto: Crypto }).crypto = webCrypto as unknown as Crypto;
  } else if (!window.crypto.subtle) {
    (window.crypto as Crypto & { subtle: SubtleCrypto }).subtle = webCrypto.subtle;
  }
}

if (!window.crypto.randomUUID) {
  window.crypto.randomUUID = function (): `${string}-${string}-${string}-${string}-${string}` {
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    return uuid as `${string}-${string}-${string}-${string}-${string}`;
  };
}

createRoot(document.getElementById('root')!).render(<App />);
