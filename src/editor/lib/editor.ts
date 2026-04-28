import { Editor, Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { TypstRawBlock } from './typstRawBlock';
import { TypstImage } from './typstImage';
import { TypstTable, TypstTableRow, TypstTableCell, TypstTableHeader } from './typstTable';
import { TypstFootnote } from './typstFootnote';
import { TypstCitation } from './typstCitation';
import { TypstReference } from './typstReference';
import { TypstBibliography } from './typstBibliography';
import { TypstPagebreak } from './typstPagebreak';
import { CitationSuggestion } from './citationSuggestion';
import { TextColor, Highlight, Underline, Superscript, Subscript, Smallcaps } from './typstMarks';
import { TextAlign } from './typstTextAlign';
import { SlashCommands } from './slashCommands';
import { CommentDecorations } from './commentDecorations';

/**
 * Sets the spellcheck language on the ProseMirror editor element.
 * Maps Typst language codes to BCP 47 tags for browser spellcheck.
 */
export function setEditorLanguage(editor: Editor, lang: string): void {
  const langMap: Record<string, string> = {
    en: 'en', de: 'de', fr: 'fr', es: 'es', it: 'it',
    pt: 'pt', nl: 'nl', sv: 'sv', da: 'da', nb: 'nb',
    fi: 'fi', pl: 'pl', ru: 'ru',
  };
  const bcp47 = langMap[lang] || lang || 'en';
  const el = editor.view.dom;
  el.setAttribute('lang', bcp47);
}

/** Cmd+K shortcut for inserting/editing links */
const LinkShortcut = Extension.create({
  name: 'linkShortcut',
  addKeyboardShortcuts() {
    return {
      'Mod-k': () => {
        const { editor } = this;
        const previousUrl = editor.getAttributes('link').href;
        const url = window.prompt('URL:', previousUrl || 'https://');
        if (url === null) return false;
        if (url === '') {
          editor.chain().focus().extendMarkRange('link').unsetLink().run();
        } else {
          editor
            .chain()
            .focus()
            .extendMarkRange('link')
            .setLink({ href: url })
            .run();
        }
        return true;
      },
    };
  },
});

/** Handles drag & drop and paste of image files */
const ImageDropHandler = Extension.create({
  name: 'imageDropHandler',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('imageDropHandler'),
        props: {
          handleDrop(_view, event) {
            // Handle File objects (drag from OS file manager)
            const files = event.dataTransfer?.files;
            if (files && files.length > 0) {
              const imageFiles = Array.from(files).filter((f) =>
                f.type.startsWith('image/'),
              );
              if (imageFiles.length > 0) {
                event.preventDefault();
                for (const file of imageFiles) {
                  sendImageToExtension(file);
                }
                return true;
              }
            }

            // Handle URI drops (drag from VS Code file explorer)
            const uriList = event.dataTransfer?.getData('text/uri-list');
            if (uriList) {
              const imageExts = /\.(png|jpe?g|gif|svg|webp|bmp|ico)$/i;
              const uris = uriList.split('\n').map((u) => u.trim()).filter(Boolean);
              const imageUris = uris.filter((u) => imageExts.test(u));
              if (imageUris.length > 0) {
                event.preventDefault();
                for (const uri of imageUris) {
                  sendImagePathToExtension(uri);
                }
                return true;
              }
            }

            return false;
          },
          handlePaste(_view, event) {
            const files = event.clipboardData?.files;
            if (!files || files.length === 0) return false;

            const imageFiles = Array.from(files).filter((f) =>
              f.type.startsWith('image/'),
            );
            if (imageFiles.length === 0) return false;

            event.preventDefault();
            for (const file of imageFiles) {
              sendImageToExtension(file);
            }
            return true;
          },
        },
      }),
    ];
  },
});

function sendImageToExtension(file: File) {
  const reader = new FileReader();
  reader.onload = () => {
    const base64 = (reader.result as string).split(',')[1];
    const vscodeApi = (
      window as unknown as {
        vswriteApi: { postMessage(msg: unknown): void };
      }
    ).vswriteApi;
    if (vscodeApi) {
      vscodeApi.postMessage({
        type: 'dropImage',
        name: file.name || `image.${file.type.split('/')[1] || 'png'}`,
        data: base64,
      });
    }
  };
  reader.readAsDataURL(file);
}

function sendImagePathToExtension(uri: string) {
  const vscodeApi = (
    window as unknown as {
      vswriteApi: { postMessage(msg: unknown): void };
    }
  ).vswriteApi;
  if (vscodeApi) {
    vscodeApi.postMessage({
      type: 'dropImagePath',
      path: uri,
    });
  }
}

/**
 * Creates a TipTap editor instance with the vswrite schema.
 * Includes StarterKit, Link, SlashCommands, and the custom typstRawBlock node.
 */
export function createEditor(
  element: HTMLElement,
  options: {
    onTransaction?: () => void;
    onUpdate?: () => void;
  } = {},
): Editor {
  const editor = new Editor({
    element,
    editorProps: {
      attributes: {
        spellcheck: 'true',
      },
    },
    extensions: [
      StarterKit.configure({
        link: false,
      }),
      Link.configure({
        autolink: false,
        openOnClick: false,
        HTMLAttributes: { target: null, rel: null },
      }),
      LinkShortcut,
      SlashCommands,
      TypstRawBlock,
      TypstImage,
      TypstFootnote,
      TypstCitation,
      TypstReference,
      TypstBibliography,
      TypstPagebreak,
      CitationSuggestion,
      TypstTable,
      TypstTableRow,
      TypstTableCell,
      TypstTableHeader,
      TextColor,
      Highlight,
      Underline,
      Superscript,
      Subscript,
      Smallcaps,
      TextAlign,
      ImageDropHandler,
      CommentDecorations,
    ],
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
    onTransaction: options.onTransaction,
    onUpdate: options.onUpdate,
  });
  return editor;
}
