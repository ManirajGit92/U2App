import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import * as XLSX from 'xlsx';

export interface EffortBreakdown {
  ui: number;
  api: number;
  testing: number;
}

// Flat dictionary for all options to their weights
export interface FormulaWeights {
  // UI Complexity
  uiSimple: EffortBreakdown;
  uiMedium: EffortBreakdown;
  uiComplex: EffortBreakdown;

  // Screens
  screens1: EffortBreakdown;
  screens2: EffortBreakdown;
  screens5: EffortBreakdown;

  // API Count
  api1_5: EffortBreakdown;
  api6_10: EffortBreakdown;
  api10Plus: EffortBreakdown;

  // Business Logic
  logicLow: EffortBreakdown;
  logicMedium: EffortBreakdown;
  logicHigh: EffortBreakdown;

  // Reusability
  reusabilityYes: EffortBreakdown;

  // Data Handling
  dataSimple: EffortBreakdown;
  dataTable: EffortBreakdown;
  dataComplex: EffortBreakdown;

  // Third Party
  thirdPartyYes: EffortBreakdown;

  // File Upload
  fileUploadYes: EffortBreakdown;

  // RBAC
  rbacYes: EffortBreakdown;

  // Validation
  valLow: EffortBreakdown;
  valMedium: EffortBreakdown;
  valHigh: EffortBreakdown;

  // Performance
  perfYes: EffortBreakdown;

  // Security
  secYes: EffortBreakdown;
}

export interface EstimationInputs {
  featureName: string;
  uiComplexity: 'Simple' | 'Medium' | 'Complex';
  screens: '1' | '2' | '5';
  apiCount: '1-5' | '6-10' | '10+';
  businessLogic: 'Low' | 'Medium' | 'High';
  reusability: 'Yes' | 'No';
  dataHandling: 'Simple' | 'Table' | 'Complex Forms';
  thirdParty: 'Yes' | 'No';
  fileUpload: 'Yes' | 'No';
  rbac: 'Yes' | 'No';
  validation: 'Low' | 'Medium' | 'High';
  performance: 'Yes' | 'No';
  security: 'Yes' | 'No';
}

export interface EstimationResult {
  inputs: EstimationInputs;
  breakdown: EffortBreakdown;
  totalHours: number;
  totalDays: number; // assuming 8 hours / day
}

@Injectable({
  providedIn: 'root'
})
export class EstimatorService {
  private defaultWeights: FormulaWeights = {
    uiSimple: { ui: 4, api: 0, testing: 1 },
    uiMedium: { ui: 12, api: 0, testing: 3 },
    uiComplex: { ui: 24, api: 0, testing: 6 },

    screens1: { ui: 4, api: 0, testing: 1 },
    screens2: { ui: 8, api: 0, testing: 2 },
    screens5: { ui: 20, api: 0, testing: 5 },

    api1_5: { ui: 2, api: 16, testing: 6 },
    api6_10: { ui: 4, api: 32, testing: 12 },
    api10Plus: { ui: 8, api: 64, testing: 20 },

    logicLow: { ui: 0, api: 8, testing: 2 },
    logicMedium: { ui: 0, api: 24, testing: 6 },
    logicHigh: { ui: 0, api: 48, testing: 12 },

    reusabilityYes: { ui: 8, api: 8, testing: 4 },

    dataSimple: { ui: 2, api: 2, testing: 1 },
    dataTable: { ui: 8, api: 6, testing: 4 },
    dataComplex: { ui: 16, api: 12, testing: 8 },

    thirdPartyYes: { ui: 4, api: 24, testing: 8 },

    fileUploadYes: { ui: 6, api: 8, testing: 4 },

    rbacYes: { ui: 8, api: 16, testing: 8 },

    valLow: { ui: 2, api: 2, testing: 2 },
    valMedium: { ui: 6, api: 6, testing: 4 },
    valHigh: { ui: 12, api: 12, testing: 8 },

    perfYes: { ui: 4, api: 16, testing: 8 },
    secYes: { ui: 2, api: 24, testing: 12 }
  };

  private weightsSubject = new BehaviorSubject<FormulaWeights>(this.defaultWeights);
  public weights$ = this.weightsSubject.asObservable();

  private historySubject = new BehaviorSubject<EstimationResult[]>([]);
  public history$ = this.historySubject.asObservable();

  constructor() {}

  updateWeights(newWeights: FormulaWeights) {
    this.weightsSubject.next({ ...newWeights });
  }

  resetWeights() {
    this.weightsSubject.next({ ...this.defaultWeights });
  }

  calculateEstimation(inputs: EstimationInputs): EstimationResult {
    const w = this.weightsSubject.value;
    
    let ui = 0;
    let api = 0;
    let testing = 0;

    const add = (b: EffortBreakdown) => {
      ui += b.ui;
      api += b.api;
      testing += b.testing;
    };

    // UI Complexity
    if (inputs.uiComplexity === 'Simple') add(w.uiSimple);
    else if (inputs.uiComplexity === 'Medium') add(w.uiMedium);
    else if (inputs.uiComplexity === 'Complex') add(w.uiComplex);

    // Screens
    if (inputs.screens === '1') add(w.screens1);
    else if (inputs.screens === '2') add(w.screens2);
    else if (inputs.screens === '5') add(w.screens5);

    // API
    if (inputs.apiCount === '1-5') add(w.api1_5);
    else if (inputs.apiCount === '6-10') add(w.api6_10);
    else if (inputs.apiCount === '10+') add(w.api10Plus);

    // Business Logic
    if (inputs.businessLogic === 'Low') add(w.logicLow);
    else if (inputs.businessLogic === 'Medium') add(w.logicMedium);
    else if (inputs.businessLogic === 'High') add(w.logicHigh);

    // Booleans and Options
    if (inputs.reusability === 'Yes') add(w.reusabilityYes);
    
    if (inputs.dataHandling === 'Simple') add(w.dataSimple);
    else if (inputs.dataHandling === 'Table') add(w.dataTable);
    else if (inputs.dataHandling === 'Complex Forms') add(w.dataComplex);

    if (inputs.thirdParty === 'Yes') add(w.thirdPartyYes);
    if (inputs.fileUpload === 'Yes') add(w.fileUploadYes);
    if (inputs.rbac === 'Yes') add(w.rbacYes);

    if (inputs.validation === 'Low') add(w.valLow);
    else if (inputs.validation === 'Medium') add(w.valMedium);
    else if (inputs.validation === 'High') add(w.valHigh);

    if (inputs.performance === 'Yes') add(w.perfYes);
    if (inputs.security === 'Yes') add(w.secYes);

    const totalHours = ui + api + testing;
    const totalDays = parseFloat((totalHours / 8).toFixed(1));

    const result: EstimationResult = {
      inputs,
      breakdown: { ui, api, testing },
      totalHours,
      totalDays
    };

    // Save to history
    this.historySubject.next([...this.historySubject.value, result]);

    return result;
  }

  exportToExcel() {
    const history = this.historySubject.value;
    if (history.length === 0) return;

    const sheetData = history.map(row => ({
      'Feature Name': row.inputs.featureName,
      'UI Complexity': row.inputs.uiComplexity,
      'Screens': row.inputs.screens,
      'API Count': row.inputs.apiCount,
      'Business Logic': row.inputs.businessLogic,
      'Reusability': row.inputs.reusability,
      'Data Handling': row.inputs.dataHandling,
      'Third Party': row.inputs.thirdParty,
      'File Upload': row.inputs.fileUpload,
      'RBAC': row.inputs.rbac,
      'Validation': row.inputs.validation,
      'Performance': row.inputs.performance,
      'Security': row.inputs.security,
      'UI Hours': row.breakdown.ui,
      'API Hours': row.breakdown.api,
      'Testing Hours': row.breakdown.testing,
      'Total Hours': row.totalHours,
      'Total Days': row.totalDays
    }));

    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Estimations');

    XLSX.writeFile(wb, 'Estimation_Report.xlsx');
  }
}
