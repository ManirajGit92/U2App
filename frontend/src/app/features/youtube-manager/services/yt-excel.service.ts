import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { YouTubeVideoData, SliceTiming } from '../models/youtube.models';

@Injectable({
  providedIn: 'root'
})
export class YouTubeExcelService {

  generateTemplate() {
    const wb = XLSX.utils.book_new();
    const headers = ['Video Name', 'YouTube URL', 'Category', 'Subcategory', 'Tags', 'SliceTiming', 'LoopCount', 'Lyrics'];
    
    const data = [
      {
        'Video Name': 'Sample Lo-Fi',
        'YouTube URL': 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
        'Category': 'Music',
        'Subcategory': 'Chill',
        'Tags': 'lofi, focus, study',
        'SliceTiming': '10-20, 30-40',
        'LoopCount': 2,
        'Lyrics': 'Instrumental only.'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(data, { header: headers });
    XLSX.utils.book_append_sheet(wb, ws, 'Videos');
    XLSX.writeFile(wb, 'YouTubeManager_Template.xlsx');
  }

  exportData(videos: YouTubeVideoData[]) {
    const data = videos.map(v => ({
      'Video Name': v.videoName,
      'YouTube URL': v.youtubeUrl,
      'Category': v.category,
      'Subcategory': v.subcategory,
      'Tags': v.tags.join(', '),
      'SliceTiming': this.formatSliceTiming(v.sliceTimings),
      'LoopCount': v.loopCount,
      'Lyrics': v.lyrics
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Videos');

    const d = new Date();
    const ts = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    XLSX.writeFile(wb, `YouTubeManager_Export_${ts}.xlsx`);
  }

  async parseExcelFile(file: File): Promise<YouTubeVideoData[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e: any) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const ws = workbook.Sheets[workbook.SheetNames[0]]; // Assume first sheet
          const rawData: any[] = XLSX.utils.sheet_to_json(ws);

          const parsedVideos: YouTubeVideoData[] = rawData.map((row, index) => {
            const url = row['YouTube URL'] || '';
            const ytid = this.extractVideoId(url);

            return {
              id: 'YT-' + Date.now() + '-' + index,
              videoName: row['Video Name'] || 'Unknown Video',
              youtubeUrl: url,
              youtubeVideoId: ytid,
              category: row['Category'] || 'Uncategorized',
              subcategory: row['Subcategory'] || 'General',
              tags: row['Tags'] ? String(row['Tags']).split(',').map(t => t.trim()).filter(Boolean) : [],
              sliceTimings: this.parseSliceTiming(row['SliceTiming']),
              loopCount: parseInt(row['LoopCount'], 10) || 0,
              lyrics: row['Lyrics'] || ''
            };
          });

          resolve(parsedVideos);
        } catch (err) {
          reject('Failed to parse Excel file. Ensure you use the provided template format.');
        }
      };

      reader.onerror = () => reject('Error reading file');
      reader.readAsArrayBuffer(file);
    });
  }

  // Parses formats like "10-20, 30-40" (seconds assumed)
  // E.g "10.5-20, 0-100"
  private parseSliceTiming(timingStr: any): SliceTiming[] {
    if (!timingStr) return [];
    const str = String(timingStr);
    const intervals = str.split(',').map(s => s.trim());
    
    const slices: SliceTiming[] = [];
    for (const val of intervals) {
      if (val.includes('-')) {
        const parts = val.split('-');
        const start = parseFloat(parts[0]);
        const end = parseFloat(parts[1]);
        if (!isNaN(start) && !isNaN(end) && start < end) {
          slices.push({ start, end });
        }
      }
    }
    return slices;
  }

  private formatSliceTiming(slices: SliceTiming[]): string {
    if (!slices || slices.length === 0) return '';
    return slices.map(s => `${s.start}-${s.end}`).join(', ');
  }

  private extractVideoId(url: string): string {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : '';
  }
}
