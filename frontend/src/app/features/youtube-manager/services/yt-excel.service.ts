import { Injectable, inject } from '@angular/core';
import * as XLSX from 'xlsx';
import { YouTubeVideoData, SliceTiming, Bookmark, CustomFieldInstance, CustomFieldDefinition } from '../models/youtube.models';
import { YouTubeStateService } from './yt-state.service';

@Injectable({
  providedIn: 'root'
})
export class YouTubeExcelService {
  private state = inject(YouTubeStateService);

  generateTemplate() {
    const wb = XLSX.utils.book_new();

    // 1. Videos Sheet
    const videoHeaders = [
      'Video Name', 'YouTube URL', 'Category', 'Subcategory', 'Tags', 'SliceTiming', 'LoopCount', 'Lyrics',
      'Song Name', 'Singer', 'Composer', 'Song Type', 'Actor', 'Actress', 'Lyricist', 'Movie', 'Director', 'Release Year'
    ];
    
    const videoSample = [
      {
        'Video Name': 'Sample Lo-Fi Chill',
        'YouTube URL': 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
        'Category': 'Music',
        'Subcategory': 'Chill',
        'Tags': 'lofi, focus, study',
        'SliceTiming': '10-20, 30-40',
        'LoopCount': 2,
        'Lyrics': 'Instrumental only.',
        'Song Name': 'Lofi Study Chill',
        'Singer': 'Lofi Beats',
        'Composer': 'Lofi Producer',
        'Song Type': 'Energetic',
        'Actor': 'N/A',
        'Actress': 'N/A',
        'Lyricist': 'None',
        'Movie': 'Study Session 1',
        'Director': 'Director A',
        'Release Year': 2023
      }
    ];
    const wsVideos = XLSX.utils.json_to_sheet(videoSample, { header: videoHeaders });
    XLSX.utils.book_append_sheet(wb, wsVideos, 'Videos');

    // 2. CustomFieldDefinitions Sheet
    const defHeaders = ['Field ID', 'Field Label', 'Field Type', 'Dropdown Options'];
    const defSample = [
      {
        'Field ID': 'custom_mood',
        'Field Label': 'Mood',
        'Field Type': 'dropdown',
        'Dropdown Options': 'Happy, Relaxed, Focused'
      },
      {
        'Field ID': 'custom_rating',
        'Field Label': 'My Rating',
        'Field Type': 'text',
        'Dropdown Options': ''
      }
    ];
    const wsDefs = XLSX.utils.json_to_sheet(defSample, { header: defHeaders });
    XLSX.utils.book_append_sheet(wb, wsDefs, 'CustomFieldDefinitions');

    // 3. CustomFields Sheet
    const fieldHeaders = ['YouTube URL', 'Field ID', 'Field Label', 'Value'];
    const fieldSample = [
      {
        'YouTube URL': 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
        'Field ID': 'custom_mood',
        'Field Label': 'Mood',
        'Value': 'Relaxed'
      }
    ];
    const wsFields = XLSX.utils.json_to_sheet(fieldSample, { header: fieldHeaders });
    XLSX.utils.book_append_sheet(wb, wsFields, 'CustomFields');

    // 4. Bookmarks Sheet
    const bookmarkHeaders = ['YouTube URL', 'Bookmark Label', 'Timestamp (seconds)'];
    const bookmarkSample = [
      {
        'YouTube URL': 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
        'Bookmark Label': 'Nice Intro Beat',
        'Timestamp (seconds)': 12.5
      }
    ];
    const wsBookmarks = XLSX.utils.json_to_sheet(bookmarkSample, { header: bookmarkHeaders });
    XLSX.utils.book_append_sheet(wb, wsBookmarks, 'Bookmarks');

    XLSX.writeFile(wb, 'YouTubeManager_Template.xlsx');
  }

  exportData(videos: YouTubeVideoData[]) {
    const wb = XLSX.utils.book_new();

    // 1. Videos Sheet
    const videosData = videos.map(v => ({
      'Video Name': v.videoName,
      'YouTube URL': v.youtubeUrl,
      'Category': v.category,
      'Subcategory': v.subcategory,
      'Tags': v.tags.join(', '),
      'SliceTiming': this.formatSliceTiming(v.sliceTimings),
      'LoopCount': v.loopCount,
      'Lyrics': v.lyrics,
      'Song Name': v.songName,
      'Singer': v.singerName,
      'Composer': v.musicianName,
      'Song Type': v.songType,
      'Actor': v.actor,
      'Actress': v.actress,
      'Lyricist': v.songWriter,
      'Movie': v.movieName,
      'Director': v.directorName,
      'Release Year': v.releaseYear
    }));
    const wsVideos = XLSX.utils.json_to_sheet(videosData);
    XLSX.utils.book_append_sheet(wb, wsVideos, 'Videos');

    // 2. CustomFieldDefinitions Sheet
    const defsData = this.state.customFieldDefs.map(d => ({
      'Field ID': d.id,
      'Field Label': d.label,
      'Field Type': d.type,
      'Dropdown Options': d.dropdownOptions ? d.dropdownOptions.join(', ') : ''
    }));
    const wsDefs = XLSX.utils.json_to_sheet(defsData);
    XLSX.utils.book_append_sheet(wb, wsDefs, 'CustomFieldDefinitions');

    // 3. CustomFields Sheet
    const fieldsData: any[] = [];
    videos.forEach(v => {
      if (v.customFields) {
        v.customFields.forEach(cf => {
          const def = this.state.customFieldDefs.find(d => d.id === cf.fieldId);
          fieldsData.push({
            'YouTube URL': v.youtubeUrl,
            'Field ID': cf.fieldId,
            'Field Label': def ? def.label : cf.fieldId,
            'Value': cf.value
          });
        });
      }
    });
    const wsFields = XLSX.utils.json_to_sheet(fieldsData);
    XLSX.utils.book_append_sheet(wb, wsFields, 'CustomFields');

    // 4. Bookmarks Sheet
    const bookmarksData: any[] = [];
    videos.forEach(v => {
      if (v.bookmarks) {
        v.bookmarks.forEach(bm => {
          bookmarksData.push({
            'YouTube URL': v.youtubeUrl,
            'Bookmark Label': bm.label,
            'Timestamp (seconds)': bm.timestamp
          });
        });
      }
    });
    const wsBookmarks = XLSX.utils.json_to_sheet(bookmarksData);
    XLSX.utils.book_append_sheet(wb, wsBookmarks, 'Bookmarks');

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

          // Parse Custom Field Definitions if present
          if (workbook.SheetNames.includes('CustomFieldDefinitions')) {
            const wsDefs = workbook.Sheets['CustomFieldDefinitions'];
            const rawDefs: any[] = XLSX.utils.sheet_to_json(wsDefs);
            
            rawDefs.forEach(row => {
              const id = row['Field ID'] || '';
              const label = row['Field Label'] || '';
              const type = (row['Field Type'] || 'text').toLowerCase() === 'dropdown' ? 'dropdown' : 'text';
              const optsStr = row['Dropdown Options'] || '';
              const dropdownOptions = optsStr ? String(optsStr).split(',').map((o: string) => o.trim()).filter(Boolean) : [];

              if (id && label) {
                const existing = this.state.customFieldDefs.find(d => d.id === id);
                if (!existing) {
                  this.state.addCustomFieldDef({ id, label, type, dropdownOptions });
                }
              }
            });
          }

          // Parse main videos
          const wsVideos = workbook.Sheets[workbook.SheetNames[0]]; // Assume first sheet is Videos
          const rawVideos: any[] = XLSX.utils.sheet_to_json(wsVideos);

          const parsedVideos: YouTubeVideoData[] = rawVideos.map((row, index) => {
            const url = row['YouTube URL'] || '';
            const ytid = this.extractVideoId(url);

            return {
              id: 'YT-' + Date.now() + '-' + index + '-' + Math.random().toString(36).substring(2, 5),
              videoName: row['Video Name'] || 'Unknown Video',
              youtubeUrl: url,
              youtubeVideoId: ytid,
              category: row['Category'] || 'Uncategorized',
              subcategory: row['Subcategory'] || 'General',
              tags: row['Tags'] ? String(row['Tags']).split(',').map((t: string) => t.trim()).filter(Boolean) : [],
              sliceTimings: this.parseSliceTiming(row['SliceTiming']),
              loopCount: parseInt(row['LoopCount'], 10) || 0,
              lyrics: row['Lyrics'] || '',

              // New Default Fields
              songName: row['Song Name'] || '',
              singerName: row['Singer'] || '',
              musicianName: row['Composer'] || '',
              songType: row['Song Type'] || '',
              actor: row['Actor'] || '',
              actress: row['Actress'] || '',
              songWriter: row['Lyricist'] || '',
              movieName: row['Movie'] || '',
              directorName: row['Director'] || '',
              releaseYear: row['Release Year'] ? parseInt(row['Release Year'], 10) || null : null,

              customFields: [],
              bookmarks: []
            };
          });

          // Parse Custom Field values if present
          if (workbook.SheetNames.includes('CustomFields')) {
            const wsFields = workbook.Sheets['CustomFields'];
            const rawFields: any[] = XLSX.utils.sheet_to_json(wsFields);

            rawFields.forEach(row => {
              const url = row['YouTube URL'] || '';
              const fieldId = row['Field ID'] || '';
              const val = row['Value'] || '';

              if (url && fieldId && val) {
                const video = parsedVideos.find(v => v.youtubeUrl === url);
                if (video) {
                  video.customFields = video.customFields || [];
                  video.customFields.push({ fieldId, value: String(val) });
                }
              }
            });
          }

          // Parse Bookmarks if present
          if (workbook.SheetNames.includes('Bookmarks')) {
            const wsBookmarks = workbook.Sheets['Bookmarks'];
            const rawBookmarks: any[] = XLSX.utils.sheet_to_json(wsBookmarks);

            rawBookmarks.forEach((row, bIdx) => {
              const url = row['YouTube URL'] || '';
              const label = row['Bookmark Label'] || `Bookmark ${bIdx + 1}`;
              const time = parseFloat(row['Timestamp (seconds)']);

              if (url && !isNaN(time)) {
                const video = parsedVideos.find(v => v.youtubeUrl === url);
                if (video) {
                  video.bookmarks = video.bookmarks || [];
                  video.bookmarks.push({
                    id: 'BM-' + Date.now() + '-' + bIdx + '-' + Math.random().toString(36).substring(2, 5),
                    label,
                    timestamp: time,
                    createdAt: Date.now()
                  });
                }
              }
            });
          }

          // Merge any imported categories to state
          const importedCats = new Set<string>();
          parsedVideos.forEach(v => {
            if (v.category) {
              importedCats.add(v.category);
            }
          });
          importedCats.forEach(c => this.state.addCategory(c));

          resolve(parsedVideos);
        } catch (err) {
          console.error(err);
          reject('Failed to parse Excel file. Ensure you use the provided template format.');
        }
      };

      reader.onerror = () => reject('Error reading file');
      reader.readAsArrayBuffer(file);
    });
  }

  // Parses formats like "10-20, 30-40"
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
