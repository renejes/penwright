/**
 * Auto-import citations from source files.
 * Scans sources/ folder, extracts DOIs from PDFs, queries CrossRef API,
 * and generates .bib entries.
 *
 * Shared module — no VS Code dependencies.
 */

import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import { type BibEntry, serializeBibFile, parseBibFile } from './bibParser';

export interface SourceFile {
  filename: string;
  path: string;
  type: 'pdf' | 'docx' | 'txt' | 'md' | 'unknown';
  status: 'pending' | 'processing' | 'imported' | 'manual' | 'error';
  doi?: string;
  bibEntry?: BibEntry;
  error?: string;
}

/**
 * Scans the sources/ folder in the workspace, extracts metadata from files,
 * queries CrossRef for DOIs, and generates/updates a .bib file.
 */
export class SourceImporter {
  constructor(private readonly workspaceRoot: string) {}

  /** Scans sources/ folder and returns list of source files */
  async scanSources(): Promise<SourceFile[]> {
    const sourcesDir = path.join(this.workspaceRoot, 'sources');
    if (!fs.existsSync(sourcesDir)) return [];

    const files = fs.readdirSync(sourcesDir);
    return files
      .filter((f) => !f.startsWith('.'))
      .map((f) => ({
        filename: f,
        path: path.join(sourcesDir, f),
        type: this.getFileType(f),
        status: 'pending' as const,
      }));
  }

  /** Processes a single source file: extract DOI → query CrossRef → generate BibEntry */
  async processFile(file: SourceFile): Promise<BibEntry | null> {
    file.status = 'processing';

    try {
      // 1. Try DOI extraction
      let doi: string | null = null;

      if (file.type === 'pdf') {
        doi = await this.extractDOIFromPDF(file.path);
      } else if (file.type === 'txt' || file.type === 'md') {
        const text = fs.readFileSync(file.path, 'utf-8').slice(0, 2000);
        doi = this.extractDOIFromText(text);
      }

      // 2. If DOI found, query CrossRef
      if (doi) {
        file.doi = doi;
        const entry = await this.queryBibFromDOI(doi);
        if (entry) {
          file.bibEntry = entry;
          file.status = 'imported';
          return entry;
        }
      }

      // 3. If PDF, try metadata fallback
      if (file.type === 'pdf') {
        const meta = await this.extractPDFMetadata(file.path);
        if (meta && meta.title) {
          const entry = this.metadataToEntry(meta, file.filename);
          file.bibEntry = entry;
          file.status = 'imported';
          return entry;
        }
      }

      // 4. No metadata found — needs manual entry
      file.status = 'manual';
      return null;
    } catch (err) {
      file.status = 'error';
      file.error = (err as Error).message;
      return null;
    }
  }

  /** Processes all source files and updates the .bib file */
  async importAll(
    onProgress?: (file: SourceFile) => void,
  ): Promise<{ imported: BibEntry[]; manual: SourceFile[] }> {
    const sources = await this.scanSources();
    const bibPath = path.join(this.workspaceRoot, 'references.bib');
    const existingEntries = fs.existsSync(bibPath)
      ? parseBibFile(fs.readFileSync(bibPath, 'utf-8'))
      : [];
    const existingKeys = new Set(existingEntries.map((e) => e.citekey));

    const imported: BibEntry[] = [];
    const manual: SourceFile[] = [];

    for (const source of sources) {
      onProgress?.(source);

      const entry = await this.processFile(source);
      if (entry && !existingKeys.has(entry.citekey)) {
        imported.push(entry);
        existingKeys.add(entry.citekey);
      } else if (!entry && source.status === 'manual') {
        manual.push(source);
      }

      // Polite rate limiting for CrossRef API
      if (source.doi) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    // Write updated .bib file
    if (imported.length > 0) {
      const allEntries = [...existingEntries, ...imported];
      fs.writeFileSync(bibPath, serializeBibFile(allEntries), 'utf-8');
    }

    return { imported, manual };
  }

  /** Creates a manual BibEntry from user input */
  createManualEntry(data: {
    title: string;
    author: string;
    year: string;
    type?: string;
  }): BibEntry {
    const citekey = this.generateCitekey(data.author, data.year);
    const fields: Record<string, string> = {
      title: data.title,
      author: data.author,
      year: data.year,
    };
    return {
      type: data.type || 'misc',
      citekey,
      fields,
      author: data.author,
      title: data.title,
      year: data.year,
    };
  }

  /** Adds an entry to the .bib file */
  addEntryToBib(entry: BibEntry): void {
    const bibPath = path.join(this.workspaceRoot, 'references.bib');
    const existing = fs.existsSync(bibPath)
      ? parseBibFile(fs.readFileSync(bibPath, 'utf-8'))
      : [];

    if (existing.some((e) => e.citekey === entry.citekey)) return;

    existing.push(entry);
    fs.writeFileSync(bibPath, serializeBibFile(existing), 'utf-8');
  }

  // ─── DOI Extraction ────────────────────────────────────────

  private async extractDOIFromPDF(pdfPath: string): Promise<string | null> {
    try {
      const { PDFParse } = require('pdf-parse');
      const buffer = fs.readFileSync(pdfPath);
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText({ maxPages: 3 });
      await parser.destroy();
      return this.extractDOIFromText(result.text);
    } catch {
      // pdf-parse not available or failed
    }

    return null;
  }

  private extractDOIFromText(text: string): string | null {
    // DOI regex: 10.XXXX/... (standard DOI format)
    const match = text.match(/10\.\d{4,9}\/[^\s"'<>,;)}\]]+/i);
    if (match) {
      // Clean trailing punctuation
      return match[0].replace(/[.,:;]$/, '');
    }
    return null;
  }

  private async extractPDFMetadata(
    pdfPath: string,
  ): Promise<{ title?: string; author?: string; year?: string } | null> {
    try {
      const { PDFParse } = require('pdf-parse');
      const buffer = fs.readFileSync(pdfPath);
      const parser = new PDFParse({ data: buffer });
      const infoResult = await parser.getInfo();
      await parser.destroy();
      const info = (infoResult.info || {}) as Record<string, string>;
      if (info.Title || info.Author) {
        return {
          title: info.Title,
          author: info.Author,
          year: info.CreationDate
            ? this.extractYearFromPdfDate(info.CreationDate)
            : undefined,
        };
      }
    } catch {
      // Ignore
    }
    return null;
  }

  private extractYearFromPdfDate(dateStr: string): string | undefined {
    // PDF date format: D:YYYYMMDDHHmmSS or just YYYY
    const match = dateStr.match(/(\d{4})/);
    return match?.[1];
  }

  // ─── CrossRef API ──────────────────────────────────────────

  private async queryBibFromDOI(doi: string): Promise<BibEntry | null> {
    try {
      const data = await this.fetchJSON(
        `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
      );
      if (!data?.message) return null;
      return this.crossRefToEntry(data.message);
    } catch {
      return null;
    }
  }

  private crossRefToEntry(msg: Record<string, unknown>): BibEntry {
    const titleArr = msg.title as string[] | undefined;
    const title = titleArr?.[0] || 'Untitled';

    const authorArr = msg.author as Array<{ family?: string; given?: string }> | undefined;
    const authorStr = authorArr
      ? authorArr.map((a) => `${a.family || ''}, ${a.given || ''}`).join(' and ')
      : 'Unknown';

    const published = msg.published as { 'date-parts'?: number[][] } | undefined;
    const year = published?.['date-parts']?.[0]?.[0]?.toString() || '';

    const containerArr = msg['container-title'] as string[] | undefined;
    const journal = containerArr?.[0] || '';

    const doi = msg.DOI as string || '';

    const crType = msg.type as string || 'article';
    const bibType = crType.includes('book') ? 'book' : 'article';

    const citekey = this.generateCitekey(authorStr, year);

    const fields: Record<string, string> = {
      title,
      author: authorStr,
      year,
      doi,
    };
    if (journal) fields.journal = journal;

    return {
      type: bibType,
      citekey,
      fields,
      author: title ? authorStr.replace(/\{|\}/g, '') : 'Unknown',
      title: title.replace(/\{|\}/g, ''),
      year,
    };
  }

  // ─── Helpers ───────────────────────────────────────────────

  private generateCitekey(author: string, year: string): string {
    // Extract first author's last name
    const lastName = author.split(',')[0].split(' and ')[0].trim()
      .replace(/[^a-zA-Z]/g, '')
      .toLowerCase();
    return `${lastName || 'unknown'}${year || 'nd'}`;
  }

  private metadataToEntry(
    meta: { title?: string; author?: string; year?: string },
    filename: string,
  ): BibEntry {
    const title = meta.title || filename.replace(/\.[^.]+$/, '');
    const author = meta.author || 'Unknown';
    const year = meta.year || '';
    const citekey = this.generateCitekey(author, year);

    return {
      type: 'misc',
      citekey,
      fields: { title, author, year },
      author,
      title,
      year,
    };
  }

  private getFileType(filename: string): SourceFile['type'] {
    const ext = path.extname(filename).toLowerCase();
    switch (ext) {
      case '.pdf': return 'pdf';
      case '.docx': return 'docx';
      case '.txt': return 'txt';
      case '.md': return 'md';
      default: return 'unknown';
    }
  }

  private fetchJSON(url: string): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      https.get(url, {
        headers: {
          'User-Agent': 'vswrite/0.1 (VS Code Typst Editor)',
          'Accept': 'application/json',
        },
      }, (res) => {
        // Follow redirects
        if (res.statusCode === 301 || res.statusCode === 302) {
          const location = res.headers.location;
          if (location) {
            this.fetchJSON(location).then(resolve, reject);
            return;
          }
        }

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      }).on('error', reject);
    });
  }
}
