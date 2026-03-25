import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import * as XLSX from 'xlsx';

export interface ColumnMetadata {
  key: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  isCategory: boolean;
  uniqueValues: any[];
}

export interface ChartData {
  label: string;
  value: number;
}

@Injectable({
  providedIn: 'root'
})
export class ControlsToExcelService {
  private rawDataSubject = new BehaviorSubject<any[]>([]);
  public rawData$ = this.rawDataSubject.asObservable();

  private columnsSubject = new BehaviorSubject<ColumnMetadata[]>([]);
  public columns$ = this.columnsSubject.asObservable();

  constructor() {}

  async loadExcel(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const ws = workbook.Sheets[workbook.SheetNames[0]];
          const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
          
          if (json.length > 0) {
            this.processData(json);
          } else {
            this.processData([]);
          }
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  }

  private processData(data: any[]) {
    if (!data.length) {
      this.rawDataSubject.next([]);
      this.columnsSubject.next([]);
      return;
    }

    const firstRow = data[0];
    const columns: ColumnMetadata[] = Object.keys(firstRow).map(key => {
      // Analyze unique values
      const values = data.map(row => row[key]).filter(v => v !== null && v !== undefined && v !== '');
      const unique = [...new Set(values)];
      
      // Determine type crudely
      let type: 'string' | 'number' | 'date' | 'boolean' = 'string';
      const sample = unique.find(v => v !== '');
      if (typeof sample === 'number') {
        type = 'number';
      } else if (typeof sample === 'boolean' || sample === 'true' || sample === 'false') {
        type = 'boolean';
      } else if (!isNaN(Date.parse(sample as string)) && isNaN(Number(sample))) {
        type = 'date';
      }

      // If unique values are relatively small compared to dataset, it's a category
      const isCategory = unique.length <= Math.max(10, data.length * 0.2);

      return {
        key,
        type,
        isCategory,
        uniqueValues: isCategory ? unique.sort() : []
      };
    });

    this.rawDataSubject.next(data);
    this.columnsSubject.next(columns);
  }

  updateRecord(index: number, updatedRecord: any) {
    const currentData = [...this.rawDataSubject.value];
    if (index >= 0 && index < currentData.length) {
      currentData[index] = { ...updatedRecord };
      this.rawDataSubject.next(currentData);
    }
  }

  addRecord(newRecord: any) {
    const currentData = [...this.rawDataSubject.value];
    currentData.push({ ...newRecord });
    this.rawDataSubject.next(currentData);
  }

  exportExcel(fileName = 'Updated_Controls_Data.xlsx') {
    const data = this.rawDataSubject.value;
    if (data.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, fileName);
  }

  getAggregation(categoryColumn: string, valueColumn?: string): ChartData[] {
    const data = this.rawDataSubject.value;
    const map = new Map<string, number>();

    data.forEach(row => {
      const cat = String(row[categoryColumn] || 'Unknown');
      let val = 1;
      if (valueColumn) {
        val = Number(row[valueColumn]) || 0;
      }
      map.set(cat, (map.get(cat) || 0) + val);
    });

    // Convert map to grouped array
    const sortedCategories = Array.from(map.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    return sortedCategories;
  }
}
