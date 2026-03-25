import { Component, inject, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ControlsToExcelService, ColumnMetadata, ChartData } from './controls-to-excel.service';

@Component({
  selector: 'app-controls-to-excel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [DecimalPipe],
  template: `
    <div class="cte-container" [ngStyle]="getContainerStyles()">
      
      <!-- Top Settings Bar -->
      <div class="theme-toolbar glass-card">
        <div class="theme-options">
          <label>Theme:</label>
          <select [(ngModel)]="appTheme.mode">
             <option value="light">Light Mode</option>
             <option value="dark">Dark Mode</option>
          </select>
          
          <label>Accent:</label>
          <input type="color" [(ngModel)]="appTheme.accentColor">
          
          <label>Text:</label>
          <input type="color" [(ngModel)]="appTheme.textColor">
          
          <label>Font:</label>
          <select [(ngModel)]="appTheme.fontFamily">
             <option value="'Inter', sans-serif">Sans-Serif (Inter)</option>
             <option value="'Courier New', monospace">Monospace</option>
             <option value="'Georgia', serif">Serif (Georgia)</option>
          </select>
          
          <label>Font Size:</label>
          <input type="range" min="12" max="24" [(ngModel)]="appTheme.fontSize">
          <span>{{ appTheme.fontSize }}px</span>
        </div>
      </div>

      <div class="header-section">
        <div class="header-titles">
          <h1>Controls to Excel Dashboard</h1>
          <p>Dynamically manage, edit, filter, and visualize your spreadsheet data.</p>
        </div>
        
        <div class="header-actions">
          <input type="file" id="excelUpload" accept=".xlsx, .xls, .csv" (change)="uploadData($event)" #fileInput hidden>
          <button class="btn-primary" (click)="fileInput.click()">
            <span class="icon">📤</span> Upload Excel
          </button>
          <button class="btn-secondary" *ngIf="hasData" (click)="exportData()">
            <span class="icon">📥</span> Export Updated Excel
          </button>
        </div>
      </div>

      <div class="main-content" *ngIf="hasData">
        
        <!-- Top Toolbar -->
        <div class="toolbar glass-card">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input type="text" [(ngModel)]="globalSearch" (ngModelChange)="applySearchAndFilters()" placeholder="Global Search everywhere...">
          </div>
          
          <div class="chart-toggles">
            <button class="btn-outline" (click)="addNewRow()">
              <span class="icon">➕</span> Add New Row
            </button>
            <button class="btn-outline" (click)="toggleDashboard()">
              <span class="icon">📊</span> {{ showDashboard ? 'Hide Dashboard' : 'Show Dashboard' }}
            </button>
          </div>
        </div>

        <!-- Dashboard / Charts area -->
        <div class="dashboard-section glass-card" *ngIf="showDashboard">
          <h3>Dynamic Data Visualization</h3>
          <div class="chart-controls">
            <div class="form-group">
              <label>Category (X-Axis)</label>
              <select [(ngModel)]="chartConfig.categoryCol" (change)="updateChart()">
                <option *ngFor="let col of getCategoricalColumns()" [value]="col.key">{{ col.key }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>Value (Y-Axis / Optional)</label>
              <select [(ngModel)]="chartConfig.valueCol" (change)="updateChart()">
                <option value="">Count Occurrences</option>
                <option *ngFor="let col of getNumericColumns()" [value]="col.key">Sum of {{ col.key }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>Chart Type</label>
              <div class="type-selectors">
                <button [class.active]="chartConfig.type === 'bar'" (click)="setChartType('bar')">Bar</button>
                <button [class.active]="chartConfig.type === 'pie'" (click)="setChartType('pie')">Pie</button>
                <button [class.active]="chartConfig.type === 'line'" (click)="setChartType('line')">Line</button>
              </div>
            </div>
          </div>

          <!-- Dynamic Pure CSS Chart Rendering -->
          <div class="chart-display">
            <!-- BAR CHART -->
            <div class="css-chart-bar" *ngIf="chartConfig.type === 'bar'">
              <div class="bar-item" *ngFor="let data of chartData" [title]="data.label + ': ' + data.value">
                <div class="bar-fill" [style.height.%]="getPercentage(data.value)">
                  <span class="bar-value">{{ formatVal(data.value) }}</span>
                </div>
                <div class="bar-label">{{ data.label }}</div>
              </div>
            </div>

            <!-- PIE CHART -->
            <div class="css-chart-pie-container" *ngIf="chartConfig.type === 'pie'">
              <div class="css-pie" [ngStyle]="getPieGradient()"></div>
              <div class="pie-legend">
                <div class="legend-item" *ngFor="let data of chartData; let i = index">
                  <span class="color-box" [style.backgroundColor]="getChartColor(i)"></span>
                  <span class="label">{{ data.label }} ({{ getPercentage(data.value) | number:'1.0-1' }}%)</span>
                </div>
              </div>
            </div>

            <!-- LINE CHART -->
            <div class="css-chart-line" *ngIf="chartConfig.type === 'line'">
               <svg class="line-svg" viewBox="0 0 1000 300" preserveAspectRatio="none">
                 <line x1="0" y1="50" x2="1000" y2="50" stroke="#e2e8f0" stroke-width="1"/>
                 <line x1="0" y1="150" x2="1000" y2="150" stroke="#e2e8f0" stroke-width="1"/>
                 <line x1="0" y1="250" x2="1000" y2="250" stroke="#e2e8f0" stroke-width="1"/>
                 <polyline [attr.points]="getLinePoints()" fill="none" stroke="var(--accent-color)" stroke-width="4" />
                 <circle *ngFor="let pt of getLineCoordinates()" [attr.cx]="pt.x" [attr.cy]="pt.y" r="6" fill="#764ba2">
                   <title>{{ pt.label }}: {{ pt.value }}</title>
                 </circle>
               </svg>
               <div class="line-labels">
                 <div *ngFor="let pt of getLineCoordinates()" class="l-label" [style.left.%]="pt.xPercent">{{ pt.label }}</div>
               </div>
            </div>
            <p *ngIf="!chartData.length" class="empty-chart">No data available to plot based on selections.</p>
          </div>
        </div>

        <!-- Table Zoom Controls -->
        <div class="zoom-toolbar">
           <span>Table Zoom: </span>
           <button class="btn-icon" (click)="zoomOut()">➖</button>
           <strong>{{ (tableZoomLevel * 100) | number:'1.0-0' }}%</strong>
           <button class="btn-icon" (click)="zoomIn()">➕</button>
        </div>

        <!-- Data Area: Table & Edit Panel -->
        <div class="data-split">
          
          <div class="table-container glass-card" [class.shrink]="editingRowIndex !== null || isAddingNew">
            
            <div class="table-scroll">
              <table class="data-table" [style.transform]="'scale(' + tableZoomLevel + ')'">
                <thead>
                  <tr>
                    <th *ngFor="let col of columns" (click)="setSort(col.key)" [class.sortable]="true">
                      {{ col.key }}
                      <span class="sort-icon" *ngIf="sortColumn === col.key">
                        {{ sortAscending ? '▲' : '▼' }}
                      </span>
                      <div class="col-filter" (click)="$event.stopPropagation()">
                        <input type="text" 
                               [placeholder]="'Filter ' + col.key" 
                               (input)="updateColFilter(col.key, $event)"
                               class="filter-input">
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngIf="filteredData.length === 0">
                    <td [attr.colspan]="columns.length" class="no-data">No records match your filters.</td>
                  </tr>
                  <tr *ngFor="let row of paginatedData; let i = index" 
                      (click)="editRow(row)"
                      [class.active-row]="editingRowIndex === getActualIndex(row) && !isAddingNew">
                    <td *ngFor="let col of columns" [title]="row[col.key]">
                      <span class="cell-content">{{ row[col.key] }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div class="table-footer">
               <div class="pagination-controls">
                 <button class="btn-icon" (click)="goToPage(1)" [disabled]="currentPage === 1" title="First Page">⏮</button>
                 <button class="btn-icon" (click)="goToPage(currentPage - 1)" [disabled]="currentPage === 1" title="Previous Page">◀</button>
                 
                 <span class="page-info">
                   Page {{ currentPage }} of {{ totalPages === 0 ? 1 : totalPages }}
                 </span>
                 
                 <button class="btn-icon" (click)="goToPage(currentPage + 1)" [disabled]="currentPage >= totalPages" title="Next Page">▶</button>
                 <button class="btn-icon" (click)="goToPage(totalPages)" [disabled]="currentPage >= totalPages" title="Last Page">⏭</button>
               </div>
               
               <div class="pagination-sizes">
                 <label>Rows per page: </label>
                 <select [(ngModel)]="itemsPerPage" (change)="onItemsPerPageChange()">
                   <option [value]="10">10</option>
                   <option [value]="25">25</option>
                   <option [value]="50">50</option>
                   <option [value]="100">100</option>
                   <option [value]="200">200</option>
                 </select>
               </div>
               
               <div class="record-stats">
                 Showing {{ filteredData.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1 }} - 
                 {{ Math.min(currentPage * itemsPerPage, filteredData.length) }} of {{ filteredData.length }} records
                 <span *ngIf="filteredData.length !== rawData.length">(filtered from {{ rawData.length }})</span>
               </div>
            </div>
          </div>

          <!-- Dynamic Edit/Add Form Panel -->
          <div class="edit-panel glass-card" *ngIf="editingRowIndex !== null || isAddingNew">
            <div class="panel-header">
               <h3>{{ isAddingNew ? 'Add New Record' : 'Edit Record #' + (editingRowIndex! + 1) }}</h3>
               <button class="btn-close" (click)="closeEdit()">✖</button>
            </div>
            
            <form (ngSubmit)="saveRow()" #dynamicForm="ngForm" class="dynamic-form">
              <div class="form-group" *ngFor="let col of columns">
                <label>{{ col.key }}</label>
                
                <ng-container *ngIf="col.isCategory && col.uniqueValues.length">
                  <select [name]="col.key" [(ngModel)]="editingRecord[col.key]" required>
                    <option *ngFor="let val of col.uniqueValues" [value]="val">{{ val }}</option>
                  </select>
                </ng-container>

                <ng-container *ngIf="!col.isCategory && col.type === 'number'">
                  <input type="number" [name]="col.key" [(ngModel)]="editingRecord[col.key]" required>
                </ng-container>
                
                <ng-container *ngIf="!col.isCategory && col.type === 'date'">
                  <input type="date" [name]="col.key" [(ngModel)]="editingRecord[col.key]" required>
                </ng-container>
                
                <ng-container *ngIf="!col.isCategory && col.type === 'boolean'">
                  <select [name]="col.key" [(ngModel)]="editingRecord[col.key]" required>
                    <option [value]="true">True</option>
                    <option [value]="false">False</option>
                  </select>
                </ng-container>

                <ng-container *ngIf="!col.isCategory && col.type === 'string'">
                  <input type="text" [name]="col.key" [(ngModel)]="editingRecord[col.key]" required>
                </ng-container>
              </div>

              <div class="form-actions mt-4">
                <button type="button" class="btn-outline w-full" (click)="closeEdit()">Cancel</button>
                <button type="submit" class="btn-primary w-full" [disabled]="!dynamicForm.form.valid">
                  {{ isAddingNew ? 'Add Record' : 'Save Changes' }}
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
      
      <!-- Placeholder -->
      <div class="empty-state" *ngIf="!hasData">
         <div class="empty-icon">📂</div>
         <h2>No Data Loaded</h2>
         <p>Upload an Excel or CSV file to dynamically generate controls, tables, and dashboards.</p>
      </div>
    </div>
  `,
  styles: [`
    /* Dynamic Theme Variables bindings on root */
    .cte-container {
      padding: 1.5rem; min-height: 100vh;
      background: var(--bg-color);
      color: var(--text-color);
      font-family: var(--font-family);
      font-size: var(--font-size);
      transition: background 0.3s, color 0.3s;
    }
    
    .theme-toolbar {
      display: flex; align-items: center; justify-content: flex-end; padding: 0.8rem 1.5rem;
      margin-bottom: 1.5rem; border-radius: 8px; font-size: 0.85rem;
    }
    .theme-options { display: flex; align-items: center; gap: 0.8rem; }
    .theme-options label { font-weight: 600; color: var(--text-color); }
    .theme-options select, .theme-options input {
      background: var(--input-bg); color: var(--text-color);
      border: 1px solid var(--border-color); padding: 0.3rem 0.6rem; border-radius: 4px; outline: none;
    }
    
    .header-section {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 1.5rem; background: var(--card-bg);
      backdrop-filter: blur(10px); padding: 1.5rem; border-radius: 12px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid var(--border-color);
    }
    .header-titles h1 { margin: 0; font-size: 1.6rem; color: var(--text-color); }
    .header-titles p { margin: 0.3rem 0 0; opacity: 0.8; font-size: 0.9em; }
    .header-actions { display: flex; gap: 1rem; }

    .glass-card {
      background: var(--card-bg); backdrop-filter: blur(15px);
      border-radius: 12px; border: 1px solid var(--border-color);
      box-shadow: 0 4px 15px rgba(0,0,0,0.03);
    }

    .toolbar { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.5rem; margin-bottom: 1rem; }
    .search-box { position: relative; width: 400px; }
    .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); opacity: 0.5; }
    .search-box input {
      width: 100%; padding: 0.8rem 1rem 0.8rem 2.5rem; border-radius: 8px;
      border: 1px solid var(--border-color); background: var(--input-bg); color: var(--text-color);
      outline: none; transition: 0.2s;
    }
    .search-box input:focus { border-color: var(--accent-color); box-shadow: 0 0 0 3px var(--accent-alpha); }

    .chart-toggles { display: flex; gap: 0.8rem; }

    /* Buttons */
    .btn-primary, .btn-secondary, .btn-outline {
      padding: 0.7rem 1.2rem; border-radius: 8px; font-weight: 600; font-family: inherit; font-size: 0.9em;
      cursor: pointer; border: none; transition: 0.2s; display: inline-flex; align-items: center; gap: 0.5rem;
    }
    .btn-primary { background: var(--accent-color); color: white; }
    .btn-primary:hover { filter: brightness(1.1); transform: translateY(-2px); }
    .btn-secondary { background: var(--card-bg); color: var(--accent-color); border: 1px solid var(--accent-color); }
    .btn-secondary:hover { background: var(--accent-alpha); }
    .btn-outline { background: transparent; color: var(--text-color); border: 1px solid var(--border-color); }
    .btn-outline:hover { background: var(--hover-bg); }
    
    .btn-close { background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-color); opacity: 0.6; }
    .btn-close:hover { opacity: 1; color: #e53e3e; }
    .w-full { width: 100%; justify-content: center; }
    .mt-4 { margin-top: 1rem; }

    /* Dashboard */
    .dashboard-section { padding: 1.5rem; margin-bottom: 1.5rem; animation: slideDown 0.3s; }
    .dashboard-section h3 { margin-top: 0; }
    .chart-controls { display: flex; gap: 1.5rem; margin-bottom: 1.5rem; }
    
    .form-group { flex: 1; }
    .form-group label { display: block; font-size: 0.85em; font-weight: 600; opacity: 0.8; margin-bottom: 0.4rem; text-transform: uppercase; }
    .form-group select, .form-group input { 
      width: 100%; padding: 0.6rem; border-radius: 6px; border: 1px solid var(--border-color);
      font-family: inherit; font-size: inherit; background: var(--input-bg); color: var(--text-color);
    }
    .type-selectors button {
      padding: 0.6rem 1rem; background: var(--input-bg); border: 1px solid var(--border-color); cursor: pointer;
      font-weight: 600; color: var(--text-color); transition: 0.2s; font-family: inherit;
    }
    .type-selectors button:first-child { border-radius: 8px 0 0 8px; }
    .type-selectors button:last-child { border-radius: 0 8px 8px 0; }
    .type-selectors button.active { background: var(--accent-color); color: white; border-color: var(--accent-color); }
    
    /* Charts */
    .chart-display { 
      height: 350px; background: var(--card-bg); border-radius: 12px;
      padding: 1.5rem; position: relative; border: 1px dashed var(--border-color);
    }
    .empty-chart { text-align: center; opacity: 0.6; margin-top: 100px; }

    /* Bar */
    .css-chart-bar { display: flex; align-items: flex-end; justify-content: space-around; height: 100%; gap: 10px; padding-bottom: 25px; }
    .bar-item { display: flex; flex-direction: column; align-items: center; height: 100%; flex: 1; justify-content: flex-end; position: relative; }
    .bar-fill { 
      width: 80%; background: var(--accent-color); border-radius: 6px 6px 0 0; position: relative; min-height: 20px;
      transition: height 0.5s ease-out; box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .bar-value { position: absolute; top: -22px; width: 100%; text-align: center; font-size: 0.8em; font-weight: bold; }
    .bar-label { position: absolute; bottom: -25px; font-size: 0.7em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }

    /* Pie */
    .css-chart-pie-container { display: flex; align-items: center; justify-content: center; gap: 40px; height: 100%; }
    .css-pie { width: 250px; height: 250px; border-radius: 50%; box-shadow: 0 10px 25px rgba(0,0,0,0.15); transition: background 0.5s; }
    .pie-legend { display: flex; flex-direction: column; gap: 8px; max-height: 250px; overflow-y: auto; padding-right: 15px; }
    .legend-item { display: flex; align-items: center; gap: 8px; font-size: 0.85em; }
    .color-box { min-width: 14px; height: 14px; border-radius: 3px; }

    /* Line */
    .css-chart-line { position: relative; height: 100%; width: 100%; }
    .line-svg { width: 100%; height: 250px; overflow: visible; transition: all 0.5s; }
    .line-labels { position: relative; height: 30px; margin-top: 10px; }
    .l-label { position: absolute; font-size: 0.7em; transform: translateX(-50%); white-space: nowrap; }

    /* Zoom */
    .zoom-toolbar { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; font-size: 0.85em; }
    .btn-icon { background: var(--card-bg); border: 1px solid var(--border-color); color: var(--text-color); border-radius: 4px; padding: 0.2rem 0.5rem; cursor: pointer; }
    .btn-icon:hover { background: var(--hover-bg); }

    /* Data Table / Split view */
    .data-split { display: flex; gap: 1.5rem; align-items: flex-start; }
    .table-container { flex: 1; transition: 0.3s; overflow: hidden; display: flex; flex-direction: column; }
    .table-scroll { max-height: 60vh; overflow: auto; }
    
    .data-table { 
      width: 100%; border-collapse: collapse; text-align: left; background: var(--card-bg);
      transform-origin: top left; transition: transform 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
    }
    .data-table th { 
      position: sticky; top: 0; background: var(--header-bg); color: var(--header-text); padding: 1rem;
      font-size: 0.9em; font-weight: 700; text-transform: uppercase;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1); z-index: 10;
    }
    .data-table th.sortable { cursor: pointer; user-select: none; }
    .data-table th:hover { filter: brightness(0.95); }
    .sort-icon { color: var(--accent-color); margin-left: 5px; }
    
    .col-filter { margin-top: 8px; }
    .filter-input { width: 100%; padding: 4px 8px; font-size: 0.8em; border: 1px solid var(--border-color); background: var(--input-bg); color: var(--text-color); border-radius: 4px; font-weight: normal; }

    .data-table td { padding: 0.8rem 1rem; border-bottom: 1px solid var(--border-color); font-size: 0.9em; white-space: nowrap; max-width: 200px; overflow: hidden; text-overflow: ellipsis; cursor: pointer; }
    .data-table tbody tr { transition: 0.1s; }
    .data-table tbody tr:nth-child(even) { background-color: var(--alternate-row-bg); }
    .data-table tbody tr:hover { background-color: var(--hover-bg); }
    .data-table tbody tr.active-row { background-color: var(--accent-alpha); border-left: 3px solid var(--accent-color); }
    
    /* Pagination Footer */
    .table-footer { 
      padding: 1rem; font-size: 0.85em; background: var(--hover-bg); 
      border-top: 1px solid var(--border-color); 
      display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;
    }
    .pagination-controls { display: flex; align-items: center; gap: 0.5rem; }
    .pagination-controls button[disabled] { opacity: 0.4; cursor: not-allowed; }
    .page-info { font-weight: 600; padding: 0 0.5rem; color: var(--text-color); }
    
    .pagination-sizes select {
      padding: 0.3rem 0.5rem; border-radius: 4px; border: 1px solid var(--border-color);
      background: var(--input-bg); color: var(--text-color); font-family: inherit; font-size: 0.9em;
    }
    .record-stats { color: var(--text-color); opacity: 0.8; }

    /* Edit/Add Panel */
    .edit-panel { flex: 0 0 350px; position: sticky; top: 1.5rem; animation: slideLeft 0.3s ease-out; }
    .panel-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; margin-bottom: 1rem; }
    .panel-header h3 { margin: 0; font-size: 1.2rem; }
    .dynamic-form { max-height: calc(100vh - 12rem); overflow-y: auto; padding-right: 5px; }
    .dynamic-form::-webkit-scrollbar { width: 4px; }
    .dynamic-form::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 4px; }
    .form-group { margin-bottom: 1rem; }

    /* Empty State */
    .empty-state { text-align: center; padding: 5rem 2rem; opacity: 0.8; }
    .empty-icon { font-size: 4rem; margin-bottom: 1rem; opacity: 0.8; }

    @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes slideLeft { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
  `]
})
export class ControlsToExcelComponent implements OnInit {
  service = inject(ControlsToExcelService);
  decimalPipe = inject(DecimalPipe);

  // Theme configuration
  appTheme = {
    mode: 'light',
    accentColor: '#4facfe',
    textColor: '#2d3748',
    fontFamily: "'Inter', sans-serif",
    fontSize: 14
  };

  rawData: any[] = [];
  filteredData: any[] = [];
  columns: ColumnMetadata[] = [];
  hasData = false;
  
  // Table state
  globalSearch = '';
  colFilters: { [key: string]: string } = {};
  sortColumn = '';
  sortAscending = true;
  tableZoomLevel = 1.0;

  // Pagination state
  currentPage = 1;
  itemsPerPage = 10;
  Math = Math; // Template access

  // Editing / Adding state
  editingRowIndex: number | null = null;
  isAddingNew = false;
  editingRecord: any = {};

  // Dashboard state
  showDashboard = false;
  chartConfig = { categoryCol: '', valueCol: '', type: 'bar' };
  chartData: ChartData[] = [];
  chartColors = ['#4facfe', '#00f2fe', '#f093fb', '#f5576c', '#43e97b', '#38f9d7', '#fa709a', '#fee140', '#cfd9df', '#e2ebf0'];

  ngOnInit() {
    this.service.rawData$.subscribe(data => {
      this.rawData = data;
      this.hasData = data.length > 0;
      this.applySearchAndFilters();
      if (this.showDashboard) this.updateChart();
    });

    this.service.columns$.subscribe(cols => {
      this.columns = cols;
      if (cols.length > 0 && !this.chartConfig.categoryCol) {
        const catCol = cols.find(c => c.isCategory);
        this.chartConfig.categoryCol = catCol ? catCol.key : cols[0].key;
      }
    });

    // Dark mode fallback reset initially
    this.appTheme.textColor = this.appTheme.mode === 'dark' ? '#f7fafc' : '#2d3748';
  }

  getContainerStyles() {
    const isDark = this.appTheme.mode === 'dark';
    
    // Dynamically toggle primary text color if it wasn't modified by user, but since it's two-way bound we use value
    // To ensure legibility, we can define root robustly
    return {
      '--bg-color': isDark ? '#1a202c' : '#f5f7fa',
      '--card-bg': isDark ? 'rgba(45, 55, 72, 0.85)' : 'rgba(255, 255, 255, 0.85)',
      '--input-bg': isDark ? '#2d3748' : '#ffffff',
      '--text-color': this.appTheme.textColor,
      '--hover-bg': isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
      '--alternate-row-bg': isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
      '--border-color': isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      '--header-bg': isDark ? '#1a202c' : '#ffffff',
      '--header-text': isDark ? '#e2e8f0' : '#2d3748',
      '--accent-color': this.appTheme.accentColor,
      '--accent-alpha': this.appTheme.accentColor + '33', // 20% opacity hex
      '--font-family': this.appTheme.fontFamily,
      '--font-size': this.appTheme.fontSize + 'px',
    };
  }

  // --- Zoom logic ---
  zoomIn() { this.tableZoomLevel = Math.min(2.0, this.tableZoomLevel + 0.1); }
  zoomOut() { this.tableZoomLevel = Math.max(0.5, this.tableZoomLevel - 0.1); }

  // --- Pagination Logic ---
  get totalPages(): number {
    return Math.ceil(this.filteredData.length / this.itemsPerPage) || 1;
  }

  get paginatedData(): any[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredData.slice(start, start + this.itemsPerPage);
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  onItemsPerPageChange() {
    this.currentPage = 1; // Reset to page 1 on resize
  }

  // --- File ---
  uploadData(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.service.loadExcel(file).catch(err => alert('Failed to parse file.'));
      event.target.value = '';
    }
  }

  exportData() { this.service.exportExcel(); }

  // --- Filtering & Sorting ---
  updateColFilter(colKey: string, event: Event) {
    this.colFilters[colKey] = (event.target as HTMLInputElement).value.toLowerCase();
    this.applySearchAndFilters();
  }

  setSort(colKey: string) {
    if (this.sortColumn === colKey) this.sortAscending = !this.sortAscending;
    else { this.sortColumn = colKey; this.sortAscending = true; }
    this.applySearchAndFilters();
  }

  applySearchAndFilters() {
    if (!this.rawData.length) { this.filteredData = []; return; }
    let result = [...this.rawData];

    if (this.globalSearch.trim()) {
      const term = this.globalSearch.toLowerCase().trim();
      result = result.filter(row => Object.values(row).some(val => String(val).toLowerCase().includes(term)));
    }

    for (const key of Object.keys(this.colFilters)) {
      const term = this.colFilters[key];
      if (term) result = result.filter(row => String(row[key] || '').toLowerCase().includes(term));
    }

    if (this.sortColumn) {
      const asc = this.sortAscending ? 1 : -1;
      result.sort((a, b) => {
        const valA = a[this.sortColumn] ?? '';
        const valB = b[this.sortColumn] ?? '';
        if (typeof valA === 'number' && typeof valB === 'number') return (valA - valB) * asc;
        return String(valA).localeCompare(String(valB)) * asc;
      });
    }

    this.filteredData = result;
    this.currentPage = 1; // Reset to first page when filters/sort changes
  }

  getActualIndex(row: any): number { return this.rawData.indexOf(row); }

  // --- Edit & Adding ---
  editRow(row: any) {
    const actIndex = this.getActualIndex(row);
    if (actIndex > -1) {
      this.isAddingNew = false;
      this.editingRowIndex = actIndex;
      this.editingRecord = { ...this.rawData[actIndex] };
    }
  }

  addNewRow() {
    this.editingRowIndex = null;
    this.isAddingNew = true;
    this.editingRecord = {};
    // Pre-fill fields with empty but correct type defaults
    this.columns.forEach(col => {
       if (col.type === 'number') this.editingRecord[col.key] = 0;
       else if (col.type === 'boolean') this.editingRecord[col.key] = false;
       else if (col.isCategory && col.uniqueValues.length) this.editingRecord[col.key] = col.uniqueValues[0];
       else this.editingRecord[col.key] = '';
    });
  }

  closeEdit() {
    this.editingRowIndex = null;
    this.isAddingNew = false;
    this.editingRecord = {};
  }

  saveRow() {
    const finalizedRecord = { ...this.editingRecord };
    // Coerce data types
    this.columns.forEach(col => {
      if (col.type === 'number' && typeof finalizedRecord[col.key] === 'string') {
        finalizedRecord[col.key] = Number(finalizedRecord[col.key]) || 0;
      } else if (col.type === 'boolean' && typeof finalizedRecord[col.key] === 'string') {
        finalizedRecord[col.key] = finalizedRecord[col.key] === 'true';
      }
    });

    if (this.isAddingNew) {
      this.service.addRecord(finalizedRecord);
    } else if (this.editingRowIndex !== null) {
      this.service.updateRecord(this.editingRowIndex, finalizedRecord);
    }
    this.closeEdit();
  }

  // --- Dashboard Logic ---
  toggleDashboard() {
    this.showDashboard = !this.showDashboard;
    if (this.showDashboard) this.updateChart();
  }

  setChartType(type: 'bar' | 'pie' | 'line') { this.chartConfig.type = type; }
  getCategoricalColumns() { return this.columns.filter(c => c.isCategory); }
  getNumericColumns() { return this.columns.filter(c => c.type === 'number'); }

  updateChart() {
    if (!this.chartConfig.categoryCol) return;
    const agg = this.service.getAggregation(this.chartConfig.categoryCol, this.chartConfig.valueCol);
    if (agg.length > 20) {
       this.chartData = agg.slice(0, 19);
       const othersVal = agg.slice(19).reduce((sum, item) => sum + item.value, 0);
       this.chartData.push({ label: 'Others', value: othersVal });
    } else {
       this.chartData = agg;
    }
  }

  getMaxValue(): number { return !this.chartData.length ? 1 : Math.max(...this.chartData.map(d => d.value)); }
  getTotalValue(): number { return this.chartData.reduce((s, d) => s + d.value, 0); }

  getPercentage(val: number): number {
    const max = this.getMaxValue();
    if (!max) return 0;
    if (this.chartConfig.type === 'pie') return (val / this.getTotalValue()) * 100;
    return (val / max) * 100;
  }

  formatVal(val: number): string { return val > 1000 ? (val/1000).toFixed(1) + 'k' : String(Math.round(val)); }
  getChartColor(index: number): string { return this.chartColors[index % this.chartColors.length]; }

  getPieGradient(): any {
    if (!this.chartData.length) return { 'background': '#e2e8f0' };
    let gradients: string[] = [];
    let currentDegree = 0;
    const total = this.getTotalValue();
    this.chartData.forEach((d, i) => {
      const percentage = (d.value / total) * 100;
      const degrees = (percentage / 100) * 360;
      const color = this.getChartColor(i);
      gradients.push(`${color} ${currentDegree}deg ${currentDegree + degrees}deg`);
      currentDegree += degrees;
    });
    return { 'background': `conic-gradient(${gradients.join(', ')})` };
  }

  getLineCoordinates(): {x: number, y: number, xPercent: number, label: string, value: number}[] {
    if (this.chartData.length < 2) return [];
    const maxVal = this.getMaxValue() || 1;
    const stepX = 1000 / (this.chartData.length - 1);
    return this.chartData.map((d, i) => {
       const x = i * stepX;
       const y = 250 - ((d.value / maxVal) * 200); 
       return { x, y, xPercent: (i / (this.chartData.length - 1)) * 100, label: d.label, value: d.value };
    });
  }

  getLinePoints(): string { return this.getLineCoordinates().map(p => `${p.x},${p.y}`).join(' '); }
}
