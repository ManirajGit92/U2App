import { Injectable, inject } from '@angular/core';
import * as XLSX from 'xlsx';
import { FirebaseSyncService } from '../../core/services/firebase-sync.service';

const APP_NAME = 'performance-playground';

export interface PerformancePlaygroundState {
  sheets: { [sheetName: string]: any[] };
  sheetNames: string[];
  activeSheet: string;
}

@Injectable({
  providedIn: 'root',
})
export class AngularPerformancePlaygroundService {
  private syncService = inject(FirebaseSyncService);

  // Local cache for search responses
  private searchCache = new Map<string, any[]>();

  // API Calls count tracker
  public apiCallsCount = 0;

  // Search API execution count tracker
  public searchApiCallsCount = 0;

  /** Clear all local metrics and cache */
  resetMetrics() {
    this.apiCallsCount = 0;
    this.searchApiCallsCount = 0;
    this.searchCache.clear();
  }

  /** Eager parser: parses all sheets immediately */
  parseExcelEagerly(file: File): Promise<PerformancePlaygroundState> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetNames = workbook.SheetNames;
          const sheets: { [name: string]: any[] } = {};

          sheetNames.forEach((name) => {
            const worksheet = workbook.Sheets[name];
            sheets[name] = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) || [];
          });

          resolve({
            sheets,
            sheetNames,
            activeSheet: sheetNames[0] || '',
          });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  }

  /** Lazy parser: extracts sheet names but defers loading row data */
  parseExcelLazily(file: File): Promise<{ arrayBuffer: ArrayBuffer; sheetNames: string[]; activeSheet: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          const arrayBuffer = e.target.result;
          const data = new Uint8Array(arrayBuffer);
          const workbook = XLSX.read(data, { type: 'array', bookSheets: true });
          const sheetNames = workbook.SheetNames;
          resolve({
            arrayBuffer,
            sheetNames,
            activeSheet: sheetNames[0] || '',
          });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  }

  parseSingleSheet(arrayBuffer: ArrayBuffer, sheetName: string): any[] {
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: 'array' });
    const ws = workbook.Sheets[sheetName];
    if (!ws) return [];
    return XLSX.utils.sheet_to_json(ws, { defval: '' });
  }

  /** Sync data to Firebase (Max 1000 items as safety sample to respect free quotas) */
  async saveToFirebase(data: any[]): Promise<void> {
    this.apiCallsCount++;
    const sampleData = data.slice(0, 1000);
    await this.syncService.pushToFirestore(APP_NAME, 'sheetData', sampleData);
  }

  /** Clear Firebase data */
  async clearFirebase(): Promise<void> {
    this.apiCallsCount++;
    await this.syncService.pushToFirestore(APP_NAME, 'sheetData', []);
  }

  /** Filter logic (simulating database query / API search) */
  searchRows(
    rows: any[],
    queryText: string,
    filters: { [col: string]: string },
    useCache: boolean
  ): any[] {
    const cacheKey = JSON.stringify({
      queryText,
      filters,
      rowsLength: rows.length,
    });

    if (useCache && this.searchCache.has(cacheKey)) {
      return this.searchCache.get(cacheKey)!;
    }

    // Increment search execution metric
    this.searchApiCallsCount++;

    const lowerQuery = queryText.toLowerCase().trim();
    const result = rows.filter((row) => {
      // 1. Column filters check
      for (const col of Object.keys(filters)) {
        const filterVal = filters[col];
        if (filterVal) {
          const cellVal = String(row[col] ?? '').toLowerCase();
          if (cellVal !== filterVal.toLowerCase()) {
            return false;
          }
        }
      }

      // 2. Global search check
      if (lowerQuery) {
        let match = false;
        for (const key of Object.keys(row)) {
          if (String(row[key] ?? '').toLowerCase().includes(lowerQuery)) {
            match = true;
            break;
          }
        }
        if (!match) return false;
      }

      return true;
    });

    if (useCache) {
      this.searchCache.set(cacheKey, result);
    }

    return result;
  }
}
