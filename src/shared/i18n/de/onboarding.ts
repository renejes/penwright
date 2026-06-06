import type { OnboardingMessages } from '../en/onboarding';

export const onboarding: OnboardingMessages = {
  ariaLabel: 'Penwright — Einführung',
  stepAria: (n: number) => `Schritt ${n}`,
  openSample: 'Beispiel-Projekt öffnen',

  steps: {
    welcome: {
      title: 'Willkommen bei Penwright',
      body: 'Schreib schöne Dokumente — wissenschaftlich, editorial, magazinartig — komplett <strong>ohne Code</strong>. Penwright ist ein WYSIWYG-Editor über Typst. Alles ist gebündelt: einfach loslegen, nichts zu installieren.',
    },
    project: {
      title: 'Alles im Projektordner',
      body: 'Jedes Dokument lebt in einem eigenen <strong>Projekt</strong>. Versionen, Auto-Backups und Einstellungen liegen mit drin — kopierst du den Ordner, nimmst du den ganzen Stand mit.',
    },
    writing: {
      title: 'Schreiben wie gewohnt',
      body: 'Formatiere über die Leiste oben — Fett, Kursiv, Überschriften, Listen. Die Typst-Quelle bleibt dabei immer sauber.',
    },
    insert: {
      title: 'Alles einfügen — der ＋-Button',
      body: 'Klick links in der Leiste auf <strong>＋</strong>, um Überschriften, Listen, Bilder, Tabellen, Formeln, Fußnoten, Zitate, Seitenumbrüche oder rohe Typst-Blöcke einzufügen. Dasselbe Menü öffnet sich, wenn du im Text <code>/</code> tippst — und <code>@</code> springt direkt zu Zitaten &amp; Querverweisen.',
    },
    design: {
      title: 'Design — getrennt vom Schreiben',
      body: 'Erst schreiben, dann gestalten. Im <strong>Design-Tab</strong> gibt es drei Wege:',
      bullets: [
        '<strong>Direkte Formatierung</strong> — die Buttons oben in der Leiste, wie in Word.',
        '<strong>Design with AI</strong> — Text markieren → Rechtsklick → die KI gestaltet genau diese Stelle.',
        '<strong>Globale &amp; Section Styles</strong> — Look fürs ganze Dokument oder einzelne Kapitel.',
      ],
    },
    claude: {
      title: 'Mit Claude Desktop verbinden',
      body: 'Optional: Verbinde Penwright mit Claude Desktop und lass die KI beim Schreiben und Gestalten helfen. Den Assistenten dafür findest du jederzeit unter <strong>Hilfe → Mit Claude Desktop verbinden</strong>.',
    },
    ready: {
      title: 'Bereit loszulegen?',
      body: 'Am besten startest du mit dem <strong>Beispiel-Projekt</strong> — es zeigt Kapitel, Kommentare, Zitate und Design an echtem Material. Oder leg direkt ein neues Projekt an.',
    },
  },
};
