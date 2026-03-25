import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { EstimatorService, EstimationInputs, EstimationResult, FormulaWeights, EffortBreakdown } from './estimator.service';

@Component({
  selector: 'app-estimator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="estimator-container">
      <div class="header-section">
        <h1>Estimator App</h1>
        <p>Formula-based automatic project estimation breakdown.</p>
        <div class="header-actions">
          <button class="btn-secondary" (click)="toggleConfig()">
            <span class="icon">⚙️</span> {{ showConfig ? 'Hide Formula Settings' : 'Configure Formulas' }}
          </button>
          <button class="btn-primary" (click)="exportReport()" *ngIf="(history$ | async) as h">
            <span class="icon" *ngIf="h && h.length > 0">📥</span> Download Excel Report
          </button>
        </div>
      </div>

      <!-- Formula Configuration View -->
      <div class="glass-card config-section" *ngIf="showConfig">
        <h2>Formula Configuration</h2>
        <p class="config-desc">Set the base hours required for UI, API, and Testing for each feature parameter.</p>
        
        <div class="config-grid">
          <ng-container *ngFor="let key of getWeightKeys()">
            <div class="config-item">
              <label>{{ formatCamelCase(key) }}</label>
              <div class="inputs-row">
                <input type="number" [(ngModel)]="$any(currentWeights)[key].ui" placeholder="UI (hrs)" title="UI Hours">
                <input type="number" [(ngModel)]="$any(currentWeights)[key].api" placeholder="API (hrs)" title="API Hours">
                <input type="number" [(ngModel)]="$any(currentWeights)[key].testing" placeholder="Test (hrs)" title="Testing Hours">
              </div>
            </div>
          </ng-container>
        </div>

        <div class="config-actions">
          <button class="btn-primary" (click)="saveWeights()">Save Formulas</button>
          <button class="btn-outline" (click)="resetWeights()">Reset to Defaults</button>
        </div>
      </div>

      <!-- Main Estimation View -->
      <div class="main-content">
        
        <!-- Left Column: inputs -->
        <div class="glass-card input-section">
          <h2>Feature Details</h2>
          <form (ngSubmit)="calculate()" #estForm="ngForm" class="form-grid">
            
            <div class="form-group full-width">
              <label>Feature Name</label>
              <input type="text" name="featureName" [(ngModel)]="inputs.featureName" required placeholder="e.g. User Dashboard">
            </div>

            <div class="form-group">
              <label>UI Complexity</label>
              <select name="uiComplexity" [(ngModel)]="inputs.uiComplexity">
                <option value="Simple">Simple</option>
                <option value="Medium">Medium</option>
                <option value="Complex">Complex</option>
              </select>
            </div>

            <div class="form-group">
              <label>Number of Screens</label>
              <select name="screens" [(ngModel)]="inputs.screens">
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="5">5</option>
              </select>
            </div>

            <div class="form-group">
              <label>API Count</label>
              <select name="apiCount" [(ngModel)]="inputs.apiCount">
                <option value="1-5">1–5</option>
                <option value="6-10">6–10</option>
                <option value="10+">10+</option>
              </select>
            </div>

            <div class="form-group">
              <label>Business Logic</label>
              <select name="businessLogic" [(ngModel)]="inputs.businessLogic">
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>

            <div class="form-group">
              <label>Reusability Requirements</label>
              <select name="reusability" [(ngModel)]="inputs.reusability">
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>

            <div class="form-group">
              <label>Data Handling</label>
              <select name="dataHandling" [(ngModel)]="inputs.dataHandling">
                <option value="Simple">Simple</option>
                <option value="Table">Table</option>
                <option value="Complex Forms">Complex Forms</option>
              </select>
            </div>

            <div class="form-group">
              <label>Third-party Integration</label>
              <select name="thirdParty" [(ngModel)]="inputs.thirdParty">
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>

            <div class="form-group">
              <label>File Upload</label>
              <select name="fileUpload" [(ngModel)]="inputs.fileUpload">
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>

            <div class="form-group">
              <label>Role-based Access</label>
              <select name="rbac" [(ngModel)]="inputs.rbac">
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>

            <div class="form-group">
              <label>Validation Complexity</label>
              <select name="validation" [(ngModel)]="inputs.validation">
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>

            <div class="form-group">
              <label>Performance Requirements</label>
              <select name="performance" [(ngModel)]="inputs.performance">
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>

            <div class="form-group">
              <label>Security Level</label>
              <select name="security" [(ngModel)]="inputs.security">
                <option value="Yes">High</option>
                <option value="No">Normal</option>
              </select>
            </div>

            <div class="form-actions full-width">
              <button type="submit" class="btn-primary" [disabled]="!estForm.form.valid">Calculate Effort</button>
            </div>
          </form>
        </div>

        <!-- Right Column: Results & History -->
        <div class="results-column">
          <div class="glass-card result-section" *ngIf="currentResult">
            <h2>Estimation Result</h2>
            <h3 class="feature-title">{{ currentResult.inputs.featureName }}</h3>
            
            <div class="total-metrics">
              <div class="metric-box ui-brand">
                <span class="label">UI Hours</span>
                <span class="value">{{ currentResult.breakdown.ui }}h</span>
              </div>
              <div class="metric-box api-brand">
                <span class="label">API Hours</span>
                <span class="value">{{ currentResult.breakdown.api }}h</span>
              </div>
              <div class="metric-box test-brand">
                <span class="label">Test Hours</span>
                <span class="value">{{ currentResult.breakdown.testing }}h</span>
              </div>
            </div>

            <div class="grand-total">
              <div class="stat">
                <h3>Total Hours</h3>
                <p>{{ currentResult.totalHours }} hrs</p>
              </div>
              <div class="stat">
                <h3>Total Days <small>(8h/day)</small></h3>
                <p>{{ currentResult.totalDays }} days</p>
              </div>
            </div>

            <!-- Breakdown Bar -->
            <div class="breakdown-chart">
              <div class="bar-segment ui-bg" [style.width.%]="getPercent(currentResult.breakdown.ui, currentResult.totalHours)" title="UI">
                {{ getPercentText(currentResult.breakdown.ui, currentResult.totalHours) }}
              </div>
              <div class="bar-segment api-bg" [style.width.%]="getPercent(currentResult.breakdown.api, currentResult.totalHours)" title="API">
                {{ getPercentText(currentResult.breakdown.api, currentResult.totalHours) }}
              </div>
              <div class="bar-segment test-bg" [style.width.%]="getPercent(currentResult.breakdown.testing, currentResult.totalHours)" title="Testing">
                {{ getPercentText(currentResult.breakdown.testing, currentResult.totalHours) }}
              </div>
            </div>

            <div class="legend">
              <span><span class="dot ui-bg"></span> UI</span>
              <span><span class="dot api-bg"></span> API</span>
              <span><span class="dot test-bg"></span> Testing</span>
            </div>
          </div>

          <div class="glass-card history-section" *ngIf="(history$ | async) as hist">
            <h2>Recent Estimations ({{ hist.length }})</h2>
            <ul class="history-list">
              <li *ngIf="hist.length === 0" class="empty-state">No estimations generated yet.</li>
              <li *ngFor="let item of hist.slice().reverse().slice(0, 5)" class="history-item" (click)="loadResult(item)">
                <div class="hist-main">
                  <strong>{{ item.inputs.featureName }}</strong>
                  <span class="hist-days">{{ item.totalDays }} Days</span>
                </div>
                <div class="hist-sub">
                  UI {{ item.breakdown.ui }}h | API {{ item.breakdown.api }}h | QA {{ item.breakdown.testing }}h
                </div>
              </li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .estimator-container {
      padding: 2rem;
      min-height: 100vh;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      font-family: 'Inter', 'Segoe UI', sans-serif;
    }

    .header-section {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(10px);
      padding: 1.5rem 2rem;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(31, 38, 135, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.18);
    }
    .header-section h1 {
      margin: 0;
      color: #2c3e50;
    }
    .header-section p {
      margin: 0.5rem 0 0 0;
      color: #718096;
    }
    .header-actions {
      display: flex;
      gap: 1rem;
    }

    .glass-card {
      background: rgba(255, 255, 255, 0.5);
      backdrop-filter: blur(12px);
      border-radius: 20px;
      padding: 2rem;
      border: 1px solid rgba(255, 255, 255, 0.4);
      box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.1);
    }

    h2 {
      margin-top: 0;
      color: #1a202c;
      border-bottom: 2px solid rgba(0,0,0,0.05);
      padding-bottom: 1rem;
      margin-bottom: 1.5rem;
    }

    .main-content {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 2rem;
    }

    /* Forms */
    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .full-width {
      grid-column: 1 / -1;
    }
    .form-group label {
      font-size: 0.85rem;
      font-weight: 600;
      color: #4a5568;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .form-group input, .form-group select {
      padding: 0.8rem 1rem;
      border-radius: 10px;
      border: 2px solid transparent;
      background: rgba(255, 255, 255, 0.8);
      font-size: 1rem;
      color: #2d3748;
      outline: none;
      transition: all 0.3s;
      box-shadow: 0 2px 5px rgba(0,0,0,0.02);
    }
    .form-group input:focus, .form-group select:focus {
      border-color: #4facfe;
      background: #fff;
      box-shadow: 0 4px 12px rgba(79, 172, 254, 0.2);
    }
    .form-actions {
      margin-top: 1rem;
    }

    /* Buttons */
    .btn-primary, .btn-secondary, .btn-outline {
      padding: 0.8rem 1.5rem;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 1rem;
    }
    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      box-shadow: 0 4px 15px rgba(118, 75, 162, 0.3);
    }
    .btn-primary:hover:not([disabled]) {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(118, 75, 162, 0.4);
    }
    .btn-primary[disabled] {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.8);
      color: #4a5568;
      box-shadow: 0 4px 10px rgba(0,0,0,0.05);
    }
    .btn-secondary:hover {
      background: #fff;
      transform: translateY(-2px);
    }
    .btn-outline {
      background: transparent;
      border: 2px solid #e2e8f0;
      color: #718096;
    }
    .btn-outline:hover {
      border-color: #cbd5e0;
      color: #4a5568;
    }

    /* Configuration */
    .config-section {
      margin-bottom: 2rem;
      animation: slideDown 0.3s ease-out;
    }
    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .config-desc {
      color: #718096;
      margin-bottom: 1.5rem;
    }
    .config-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    .config-item {
      background: rgba(255,255,255,0.4);
      padding: 1rem;
      border-radius: 12px;
      border: 1px solid rgba(0,0,0,0.05);
    }
    .config-item label {
      display: block;
      font-weight: 600;
      color: #2d3748;
      margin-bottom: 0.5rem;
      font-size: 0.9rem;
    }
    .inputs-row {
      display: flex;
      gap: 0.5rem;
    }
    .inputs-row input {
      width: 100%;
      padding: 0.5rem;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      font-size: 0.9rem;
    }

    /* Results */
    .results-column {
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }
    .feature-title {
      color: #4facfe;
      margin-bottom: 1.5rem;
      font-size: 1.3rem;
    }
    .total-metrics {
      display: flex;
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .metric-box {
      flex: 1;
      padding: 1rem;
      border-radius: 12px;
      text-align: center;
      color: white;
      box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    }
    .metric-box .label {
      display: block;
      font-size: 0.8rem;
      text-transform: uppercase;
      opacity: 0.9;
      margin-bottom: 0.3rem;
    }
    .metric-box .value {
      font-size: 1.6rem;
      font-weight: 700;
    }
    
    .ui-bg { background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); }
    .api-bg { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
    .test-bg { background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); }
    
    .ui-brand { background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); }
    .api-brand { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
    .test-brand { background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); }

    .grand-total {
      display: flex;
      justify-content: space-around;
      background: rgba(255,255,255,0.8);
      padding: 1.5rem;
      border-radius: 16px;
      margin-bottom: 2rem;
      border: 1px solid rgba(0,0,0,0.05);
    }
    .grand-total .stat {
      text-align: center;
    }
    .grand-total .stat h3 {
      font-size: 0.9rem;
      color: #718096;
      border: none;
      padding: 0;
      margin: 0 0 0.5rem 0;
      text-transform: uppercase;
    }
    .grand-total .stat p {
      font-size: 2rem;
      font-weight: 800;
      color: #2d3748;
      margin: 0;
    }

    .breakdown-chart {
      display: flex;
      height: 24px;
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 1rem;
      box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
    }
    .bar-segment {
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 0.75rem;
      font-weight: bold;
      transition: width 0.5s ease-out;
      overflow: hidden;
      white-space: nowrap;
    }
    .legend {
      display: flex;
      justify-content: center;
      gap: 1.5rem;
      font-size: 0.85rem;
      color: #4a5568;
    }
    .dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 0.4rem;
    }

    /* History */
    .history-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
    }
    .history-item {
      background: rgba(255,255,255,0.6);
      padding: 1rem;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s;
      border: 1px solid transparent;
    }
    .history-item:hover {
      background: #fff;
      transform: translateX(5px);
      border-color: #4facfe;
    }
    .hist-main {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.3rem;
    }
    .hist-main strong {
      color: #2d3748;
    }
    .hist-days {
      font-weight: 700;
      color: #4facfe;
    }
    .hist-sub {
      font-size: 0.85rem;
      color: #718096;
    }
    
    @media (max-width: 900px) {
      .main-content { grid-template-columns: 1fr; }
    }
  `]
})
export class EstimatorComponent implements OnInit {
  estimatorService = inject(EstimatorService);
  
  history$!: Observable<EstimationResult[]>;

  showConfig = false;
  currentWeights!: any;

  inputs: EstimationInputs = {
    featureName: '',
    uiComplexity: 'Medium',
    screens: '1',
    apiCount: '1-5',
    businessLogic: 'Low',
    reusability: 'No',
    dataHandling: 'Simple',
    thirdParty: 'No',
    fileUpload: 'No',
    rbac: 'No',
    validation: 'Low',
    performance: 'No',
    security: 'No'
  };

  currentResult: EstimationResult | null = null;

  ngOnInit() {
    this.history$ = this.estimatorService.history$;
    this.estimatorService.weights$.subscribe(w => {
      // Create a deep copy for the configuration form
      this.currentWeights = JSON.parse(JSON.stringify(w));
    });
  }

  toggleConfig() {
    this.showConfig = !this.showConfig;
  }

  getWeightKeys(): string[] {
    return this.currentWeights ? Object.keys(this.currentWeights) : [];
  }

  formatCamelCase(str: string): string {
    const result = str.replace(/([A-Z])/g, ' $1');
    return result.charAt(0).toUpperCase() + result.slice(1);
  }

  saveWeights() {
    this.estimatorService.updateWeights(this.currentWeights);
    this.showConfig = false;
  }

  resetWeights() {
    this.estimatorService.resetWeights();
  }

  calculate() {
    this.currentResult = this.estimatorService.calculateEstimation({ ...this.inputs });
    // Reset inputs slightly except featureName
    this.inputs.featureName = '';
  }

  loadResult(result: EstimationResult) {
    this.currentResult = result;
    this.inputs = { ...result.inputs };
  }

  getPercent(part: number, total: number): number {
    if (!total) return 0;
    return (part / total) * 100;
  }

  getPercentText(part: number, total: number): string {
    const p = this.getPercent(part, total);
    return p > 10 ? Math.round(p) + '%' : '';
  }

  exportReport() {
    this.estimatorService.exportToExcel();
  }
}
