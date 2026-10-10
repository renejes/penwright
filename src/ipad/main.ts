/**
 * iPad entry. Installs the Tauri host, then loads the same Svelte app the
 * Mac builds. The dynamic import is required: a static import would construct
 * the IPC adapter before the bridge exists.
 */

import { installIpadHost } from './bridge';
import '../editor/style.css';

installIpadHost();
document.body.classList.add('pw-ipad');

const viewport = window.visualViewport;
if (viewport) {
  const applyInset = () => {
    const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
    document.documentElement.style.setProperty('--pw-keyboard-inset', `${inset}px`);
  };
  viewport.addEventListener('resize', applyInset);
  viewport.addEventListener('scroll', applyInset);
  applyInset();
}

void import('../renderer/main');
