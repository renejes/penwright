import { Node } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';

/**
 * Document base URI for resolving relative image paths in the webview.
 * Set once when the extension sends the documentBaseUri message.
 */
let documentBaseUri = '';

export function setDocumentBaseUri(uri: string) {
  documentBaseUri = uri;
  // Refresh all existing images in the DOM
  refreshAllImages();
}

function refreshAllImages() {
  document.querySelectorAll('.typst-image-block img').forEach((img) => {
    const el = img as HTMLImageElement;
    const rawSrc = el.closest('.typst-image-block')?.querySelector('.typst-image-path')?.textContent || '';
    if (rawSrc && documentBaseUri) {
      el.src = resolveImageSrc(rawSrc);
    }
  });
}

export function getDocumentBaseUri(): string {
  return documentBaseUri;
}

/**
 * Resolves a relative image path to a full webview URI.
 * Absolute URLs (http/https/data) are returned as-is.
 */
function resolveImageSrc(src: string): string {
  if (!src) return '';
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
    return src;
  }
  if (documentBaseUri) {
    const fullPath = `${documentBaseUri}/${src}`;
    // Use custom protocol for Electron (avoids CORS/security issues with file://)
    if (typeof window !== 'undefined' && (window as unknown as { electronAPI?: unknown }).electronAPI) {
      return `penwright-asset://${encodeURIComponent(fullPath)}`;
    }
    // VS Code webview: use the base URI directly
    return fullPath;
  }
  return src;
}

/**
 * Tracks the currently open image dialog so we can close it
 * when another image is clicked or when clicking outside.
 */
let activeImageDialog: { close: () => void } | null = null;

/**
 * Creates and shows the image properties dialog attached to a given image node view.
 */
function showImageDialog(
  dom: HTMLElement,
  img: HTMLImageElement,
  node: { attrs: Record<string, any>; type: { name: string } },
  getPos: (() => number | undefined) | boolean,
  editor: any
) {
  // Close any existing dialog first
  if (activeImageDialog) {
    activeImageDialog.close();
    activeImageDialog = null;
  }

  const dialog = document.createElement('div');
  dialog.classList.add('typst-image-dialog');

  // --- Width presets row ---
  const widthPresetsRow = document.createElement('div');
  widthPresetsRow.classList.add('typst-image-dialog-row');

  const widthLabel = document.createElement('span');
  widthLabel.classList.add('typst-image-dialog-label');
  widthLabel.textContent = 'Width';
  widthPresetsRow.appendChild(widthLabel);

  const presetsWrap = document.createElement('div');
  presetsWrap.classList.add('typst-image-dialog-presets');

  const presets = ['25%', '50%', '75%', '100%'];
  const currentWidth = node.attrs.width || '';

  for (const preset of presets) {
    const btn = document.createElement('button');
    btn.classList.add('typst-image-dialog-preset');
    if (currentWidth === preset) {
      btn.classList.add('active');
    }
    btn.textContent = preset;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      applyAttrs({ width: preset });
      // Update active state on all preset buttons
      presetsWrap.querySelectorAll('.typst-image-dialog-preset').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      customInput.value = preset;
    });
    presetsWrap.appendChild(btn);
  }

  widthPresetsRow.appendChild(presetsWrap);
  dialog.appendChild(widthPresetsRow);

  // --- Custom width input row ---
  const customRow = document.createElement('div');
  customRow.classList.add('typst-image-dialog-row');

  const customLabel = document.createElement('span');
  customLabel.classList.add('typst-image-dialog-label');
  customLabel.textContent = 'Custom';
  customRow.appendChild(customLabel);

  const customInput = document.createElement('input');
  customInput.classList.add('typst-image-dialog-input');
  customInput.type = 'text';
  customInput.placeholder = 'e.g. 60%, 8cm, auto';
  customInput.value = currentWidth;
  customInput.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      const val = customInput.value.trim();
      applyAttrs({ width: val || null });
      presetsWrap.querySelectorAll('.typst-image-dialog-preset').forEach((b) => b.classList.remove('active'));
      if (presets.includes(val)) {
        presetsWrap.querySelectorAll('.typst-image-dialog-preset').forEach((b) => {
          if (b.textContent === val) b.classList.add('active');
        });
      }
    } else if (e.key === 'Escape') {
      closeDialog();
    }
  });
  customInput.addEventListener('change', () => {
    const val = customInput.value.trim();
    applyAttrs({ width: val || null });
    presetsWrap.querySelectorAll('.typst-image-dialog-preset').forEach((b) => b.classList.remove('active'));
    if (presets.includes(val)) {
      presetsWrap.querySelectorAll('.typst-image-dialog-preset').forEach((b) => {
        if (b.textContent === val) b.classList.add('active');
      });
    }
  });
  customRow.appendChild(customInput);
  dialog.appendChild(customRow);

  // --- Alt text input row ---
  const altRow = document.createElement('div');
  altRow.classList.add('typst-image-dialog-row');

  const altLabel = document.createElement('span');
  altLabel.classList.add('typst-image-dialog-label');
  altLabel.textContent = 'Alt text';
  altRow.appendChild(altLabel);

  const altInput = document.createElement('input');
  altInput.classList.add('typst-image-dialog-input');
  altInput.type = 'text';
  altInput.placeholder = 'Image description';
  altInput.value = node.attrs.alt || '';
  altInput.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      applyAttrs({ alt: altInput.value.trim() || null });
    } else if (e.key === 'Escape') {
      closeDialog();
    }
  });
  altInput.addEventListener('change', () => {
    applyAttrs({ alt: altInput.value.trim() || null });
  });
  altRow.appendChild(altInput);
  dialog.appendChild(altRow);

  // --- Alignment presets row ---
  const alignRow = document.createElement('div');
  alignRow.classList.add('typst-image-dialog-row');

  const alignLabel = document.createElement('span');
  alignLabel.classList.add('typst-image-dialog-label');
  alignLabel.textContent = 'Align';
  alignRow.appendChild(alignLabel);

  const alignPresetsWrap = document.createElement('div');
  alignPresetsWrap.classList.add('typst-image-dialog-presets');

  const alignOptions: { label: string; value: string; icon: string }[] = [
    { label: 'Left', value: '', icon: '\u2590' },
    { label: 'Center', value: 'center', icon: '\u2501' },
    { label: 'Right', value: 'right', icon: '\u258C' },
  ];
  const currentAlign = node.attrs.align || '';

  for (const opt of alignOptions) {
    const btn = document.createElement('button');
    btn.classList.add('typst-image-dialog-preset');
    if (currentAlign === opt.value) {
      btn.classList.add('active');
    }
    btn.textContent = opt.label;
    btn.title = `Align ${opt.label}`;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      applyAttrs({ align: opt.value || null });
      alignPresetsWrap.querySelectorAll('.typst-image-dialog-preset').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
    alignPresetsWrap.appendChild(btn);
  }

  alignRow.appendChild(alignPresetsWrap);
  dialog.appendChild(alignRow);

  // --- Backdrop for clicking outside ---
  const backdrop = document.createElement('div');
  backdrop.classList.add('typst-image-dialog-backdrop');
  backdrop.addEventListener('mousedown', (e) => {
    e.preventDefault();
    closeDialog();
  });

  // Insert backdrop and dialog
  dom.appendChild(backdrop);
  dom.appendChild(dialog);

  /**
   * Apply attribute changes to the ProseMirror node.
   */
  function applyAttrs(newAttrs: Record<string, any>) {
    const pos = typeof getPos === 'function' ? getPos() : null;
    if (pos == null) return;
    const { tr } = editor.view.state;
    const currentNode = tr.doc.nodeAt(pos);
    if (!currentNode) return;
    tr.setNodeMarkup(pos, undefined, { ...currentNode.attrs, ...newAttrs });
    editor.view.dispatch(tr);
  }

  function closeDialog() {
    backdrop.remove();
    dialog.remove();
    if (activeImageDialog?.close === closeDialog) {
      activeImageDialog = null;
    }
  }

  activeImageDialog = { close: closeDialog };

  // Global Escape listener
  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      closeDialog();
      document.removeEventListener('keydown', onKeydown);
    }
  }
  document.addEventListener('keydown', onKeydown);

  // Clean up Escape listener when dialog is removed
  const origClose = closeDialog;
  const wrappedClose = () => {
    document.removeEventListener('keydown', onKeydown);
    origClose();
  };
  activeImageDialog = { close: wrappedClose };

  return wrappedClose;
}

/**
 * Custom TipTap node for Typst images.
 * Stores the relative path in `src` attribute (for roundtrip serialization)
 * and resolves to a full webview URI for display.
 */
export const TypstImage = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: '' },
      alt: { default: null },
      width: { default: null },
      align: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'img[src]',
        getAttrs(dom) {
          const el = dom as HTMLElement;
          return {
            src: el.getAttribute('data-src') || el.getAttribute('src') || '',
            alt: el.getAttribute('alt'),
            width: el.getAttribute('width'),
          };
        },
      },
    ];
  },

  renderHTML({ node }) {
    return [
      'img',
      {
        src: resolveImageSrc(node.attrs.src),
        'data-src': node.attrs.src,
        alt: node.attrs.alt,
        width: node.attrs.width,
      },
    ];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      // Track the latest node attrs so the dialog can read current values
      let currentNode = node;

      const dom = document.createElement('div');
      dom.classList.add('typst-image-block');
      if (node.attrs.align) {
        dom.style.textAlign = node.attrs.align;
      }

      const img = document.createElement('img');
      img.src = resolveImageSrc(node.attrs.src);
      img.alt = node.attrs.alt || '';
      if (node.attrs.width) {
        img.style.width = node.attrs.width;
      }
      if (node.attrs.align === 'center' || node.attrs.align === 'right') {
        img.style.display = 'inline-block';
      }
      img.draggable = false;

      // Click handler to show image dialog
      img.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Remove any existing dialog in this node first
        const existingDialog = dom.querySelector('.typst-image-dialog');
        const existingBackdrop = dom.querySelector('.typst-image-dialog-backdrop');
        if (existingDialog || existingBackdrop) {
          // Dialog already open on this image — close it
          if (activeImageDialog) {
            activeImageDialog.close();
            activeImageDialog = null;
          }
          return;
        }
        showImageDialog(dom, img, currentNode, getPos, editor);
      });

      // Error placeholder
      img.addEventListener('error', () => {
        img.style.display = 'none';
        placeholder.style.display = '';
      });

      img.addEventListener('load', () => {
        img.style.display = '';
        placeholder.style.display = 'none';
      });

      const placeholder = document.createElement('div');
      placeholder.classList.add('typst-image-placeholder');
      placeholder.textContent = node.attrs.src || 'No image';
      placeholder.style.display = 'none';

      // Path label
      const pathLabel = document.createElement('div');
      pathLabel.classList.add('typst-image-path');
      pathLabel.textContent = node.attrs.src;

      dom.appendChild(img);
      dom.appendChild(placeholder);
      dom.appendChild(pathLabel);

      // "Done" button to exit the block and create a new line below
      const doneBtn = document.createElement('button');
      doneBtn.classList.add('typst-raw-done');
      doneBtn.textContent = '\u2713 Done';
      doneBtn.title = 'Exit block and add new line below';
      doneBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (typeof getPos === 'function') {
          const pos = getPos();
          if (pos !== undefined) {
            const endPos = pos + currentNode.nodeSize;
            const tr = editor.view.state.tr.insert(
              endPos,
              editor.view.state.schema.nodes.paragraph.create(),
            );
            tr.setSelection(
              TextSelection.near(
                tr.doc.resolve(endPos),
              ),
            );
            editor.view.dispatch(tr);
            editor.view.focus();
          }
        }
      });
      dom.appendChild(doneBtn);

      return {
        dom,
        stopEvent: (event: Event) => {
          // Let events inside the dialog and button clicks be handled natively, not by ProseMirror
          const target = event.target as HTMLElement;
          if (target?.tagName === 'BUTTON') {
            return true;
          }
          if (target && (
            target.closest('.typst-image-dialog') ||
            target.closest('.typst-image-dialog-backdrop')
          )) {
            return true;
          }
          return false;
        },
        ignoreMutation: () => true,
        update(updatedNode) {
          if (updatedNode.type.name !== 'image') return false;
          currentNode = updatedNode;
          img.src = resolveImageSrc(updatedNode.attrs.src);
          img.alt = updatedNode.attrs.alt || '';
          if (updatedNode.attrs.width) {
            img.style.width = updatedNode.attrs.width;
          } else {
            img.style.width = '';
          }
          if (updatedNode.attrs.align) {
            dom.style.textAlign = updatedNode.attrs.align;
            img.style.display = (updatedNode.attrs.align === 'center' || updatedNode.attrs.align === 'right') ? 'inline-block' : '';
          } else {
            dom.style.textAlign = '';
            img.style.display = '';
          }
          pathLabel.textContent = updatedNode.attrs.src;
          placeholder.textContent = updatedNode.attrs.src || 'No image';
          return true;
        },
      };
    };
  },
});
