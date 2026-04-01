import { Injectable } from '@angular/core';
import * as Diff from 'diff';

export interface DiffLine {
  value: string;
  type: 'match' | 'added' | 'removed';
}

export interface CompareResult {
  diffs: DiffLine[];
  matchPercentage: number;
  mismatches: string[];
}

export interface BeautifyJsonResult {
  formatted: string | null;
  error: string | null;
}

@Injectable({ providedIn: 'root' })
export class CompareService {

  beautifyJSON(content: string): BeautifyJsonResult {
    const trimmedContent = content.trim();

    if (!trimmedContent) {
      return {
        formatted: '',
        error: null,
      };
    }

    try {
      return {
        formatted: JSON.stringify(JSON.parse(trimmedContent), null, 2),
        error: null,
      };
    } catch {
      const repairedContent = this.repairMalformedJson(trimmedContent);

      try {
        return {
          formatted: JSON.stringify(JSON.parse(repairedContent), null, 2),
          error: null,
        };
      } catch {
        return {
          formatted: null,
          error: 'Unable to auto-correct this JSON. Please fix the structure and try again.',
        };
      }
    }
  }

  private repairMalformedJson(content: string): string {
    let repaired = content;

    repaired = repaired.replace(/([{,]\s*)([A-Za-z_$][\w$-]*)(\s*:)/g, '$1"$2"$3');
    repaired = repaired.replace(/:\s*([A-Za-z_$][\w$-]*)(\s*[,}])/g, (_match, value: string, suffix: string) => {
      if (this.isJsonKeyword(value)) {
        return `: ${value}${suffix}`;
      }

      return `: "${value}"${suffix}`;
    });

    repaired = repaired.replace(/,\s*([}\]])/g, '$1');

    return repaired;
  }

  private isJsonKeyword(value: string): boolean {
    return value === 'true' || value === 'false' || value === 'null';
  }

  compareText(content1: string, content2: string): CompareResult {
    const changes = Diff.diffLines(content1, content2);
    const diffs: DiffLine[] = [];
    const mismatches: string[] = [];
    let totalChars = 0;
    let matchedChars = 0;

    for (const part of changes) {
      const lines = part.value.split('\n').filter((l, i, arr) => i < arr.length - 1 || l !== '');

      for (const line of lines) {
        totalChars += line.length || 1;

        if (part.added) {
          diffs.push({ value: line, type: 'added' });
          mismatches.push(`+ ${line}`);
        } else if (part.removed) {
          diffs.push({ value: line, type: 'removed' });
          mismatches.push(`- ${line}`);
        } else {
          diffs.push({ value: line, type: 'match' });
          matchedChars += line.length || 1;
        }
      }
    }

    const matchPercentage = totalChars > 0 ? Math.round((matchedChars / totalChars) * 100) : 100;

    return { diffs, matchPercentage, mismatches };
  }

  compareJSON(content1: string, content2: string): CompareResult {
    let obj1: unknown;
    let obj2: unknown;

    try {
      obj1 = JSON.parse(content1);
    } catch {
      return {
        diffs: [{ value: '❌ Content 1 is not valid JSON', type: 'removed' }],
        matchPercentage: 0,
        mismatches: ['Content 1: Invalid JSON'],
      };
    }

    try {
      obj2 = JSON.parse(content2);
    } catch {
      return {
        diffs: [{ value: '❌ Content 2 is not valid JSON', type: 'removed' }],
        matchPercentage: 0,
        mismatches: ['Content 2: Invalid JSON'],
      };
    }

    const formatted1 = JSON.stringify(obj1, null, 2);
    const formatted2 = JSON.stringify(obj2, null, 2);

    return this.compareText(formatted1, formatted2);
  }

  compareMultiple(contents: string[], mode: 'text' | 'json'): CompareResult[] {
    const results: CompareResult[] = [];
    for (let i = 1; i < contents.length; i++) {
      const result = mode === 'json'
        ? this.compareJSON(contents[0], contents[i])
        : this.compareText(contents[0], contents[i]);
      results.push(result);
    }
    return results;
  }
}
