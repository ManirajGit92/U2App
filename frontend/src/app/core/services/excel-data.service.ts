import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { BehaviorSubject } from 'rxjs';

export interface ImageData {
  uniqueName: string;
  imageUrl: string;
  voiceText: string;
}

@Injectable({
  providedIn: 'root',
})
export class ExcelDataService {
  private dataSubject = new BehaviorSubject<ImageData[]>([]);
  data$ = this.dataSubject.asObservable();

  private sampleData: ImageData[] = [
    {
      uniqueName: 'Nature',
      imageUrl: 'https://i.postimg.cc/WpWynsK7/Healthy_Cookies.png',
      voiceText: 'This is a beautiful forest with tall trees and sunlight filtering through the canopy.',
    },
    {
      uniqueName: 'Whole',
      imageUrl: 'https://img.freepik.com/free-vector/handwritten-style-creative-typography_53876-20398.jpg',
      voiceText: 'A serene beach with golden sand and crystal-clear blue water crashing gently on the shore.',
    },
    {
      uniqueName: 'Sample',
      imageUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1000&auto=format&fit=crop',
      voiceText: 'Majestic snow-capped mountains reaching for the sky under a clear blue horizon.',
    },
  ];

  constructor() {
    this.dataSubject.next(this.sampleData);
  }

  loadSampleData() {
    this.dataSubject.next(this.sampleData);
  }

  downloadSampleExcel() {
    try {
      const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(this.sampleData);
      const wb: XLSX.WorkBook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'ImageData');

      const excelBuffer: any = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

      const data: Blob = new Blob([excelBuffer], {
        type: 'application/octet-stream'
      });

      const url = window.URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'sample_image_navigation.xlsx');
      link.style.display = 'none';
      document.body.appendChild(link);

      link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));

      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 200);
    } catch (error) {
      console.error('ExcelDataService: Error in downloadSampleExcel', error);
    }
  }

  async parseExcelFile(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          const bstr: string = e.target.result;
          const wb: XLSX.WorkBook = XLSX.read(bstr, { type: 'binary' });
          const wsname: string = wb.SheetNames[0];
          const ws: XLSX.WorkSheet = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws) as any[];

          const mappedData: ImageData[] = data.map((item) => ({
            uniqueName: String(item['Unique Name'] || item['uniqueName'] || ''),
            imageUrl: String(item['Image URL'] || item['imageUrl'] || ''),
            voiceText: String(item['Voice Text'] || item['voiceText'] || ''),
          })).filter(item => item.uniqueName && item.imageUrl);

          if (mappedData.length > 0) {
            this.dataSubject.next(mappedData);
            resolve();
          } else {
            reject('No valid data found in Excel. Ensure columns "Unique Name", "Image URL", and "Voice Text" exist.');
          }
        } catch (error) {
          reject('Error parsing Excel file: ' + error);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsBinaryString(file);
    });
  }

  getCurrentData(): ImageData[] {
    return this.dataSubject.value;
  }
}
