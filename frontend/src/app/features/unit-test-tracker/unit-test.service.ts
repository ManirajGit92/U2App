import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import * as XLSX from 'xlsx';

export interface TestCase {
  id: string;
  module: string;
  title: string;
  steps: string;
  expectedResult: string;
  priority: 'High' | 'Medium' | 'Low';
}

export interface TestExecution {
  id: string; // references TestCase.id
  status: 'Pass' | 'Fail' | 'Pending';
  testerName: string;
  comments: string;
  executionDate: string;
}

export interface Bug {
  id: string; // auto-generated e.g., BUG-001
  testCaseId: string; // references TestCase.id
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  assignedTo: string;
}

export interface UnitTestState {
  testCases: TestCase[];
  executions: TestExecution[];
  bugs: Bug[];
}

@Injectable({
  providedIn: 'root'
})
export class UnitTestService {
  private initialState: UnitTestState = {
    testCases: [
      { id: 'TC-001', module: 'Authentication', title: 'User Login valid credentials', steps: '1. Enter valid email\\n2. Enter valid password\\n3. Click Login', expectedResult: 'User accesses dashboard', priority: 'High' },
      { id: 'TC-002', module: 'Authentication', title: 'User Login invalid password', steps: '1. Enter valid email\\n2. Enter invalid password\\n3. Click Login', expectedResult: 'Error message shown', priority: 'High' },
      { id: 'TC-003', module: 'Cart', title: 'Add item to cart', steps: '1. Go to details page\\n2. Click Add to Cart', expectedResult: 'Item should increment in cart badge', priority: 'Medium' }
    ],
    executions: [
      { id: 'TC-001', status: 'Pass', testerName: 'Alice', comments: 'Worked smoothly', executionDate: new Date().toISOString().split('T')[0] },
      { id: 'TC-002', status: 'Fail', testerName: 'Alice', comments: 'No error message displayed', executionDate: new Date().toISOString().split('T')[0] },
      { id: 'TC-003', status: 'Pending', testerName: '', comments: '', executionDate: '' }
    ],
    bugs: [
      { id: 'BUG-001', testCaseId: 'TC-002', severity: 'High', status: 'Open', assignedTo: 'DevTeam Alpha' }
    ]
  };

  private stateSubject = new BehaviorSubject<UnitTestState>(this.initialState);
  public state$: Observable<UnitTestState> = this.stateSubject.asObservable();

  constructor() {}

  // ─── CRUD OPERATIONS ──────────────────────────────────────────

  updateState(partial: Partial<UnitTestState>) {
    this.stateSubject.next({ ...this.stateSubject.value, ...partial });
  }

  // --- Test Cases ---
  addTestCase(tc: TestCase) {
    const currentState = this.stateSubject.value;
    const testCases = [...currentState.testCases, tc];
    // Also create a "Pending" execution slot
    const executions = [...currentState.executions, { id: tc.id, status: 'Pending', testerName: '', comments: '', executionDate: '' } as TestExecution];
    this.updateState({ testCases, executions });
  }

  updateTestCase(tc: TestCase) {
    const currentState = this.stateSubject.value;
    const testCases = currentState.testCases.map(t => t.id === tc.id ? tc : t);
    this.updateState({ testCases });
  }

  deleteTestCase(id: string) {
    const currentState = this.stateSubject.value;
    const testCases = currentState.testCases.filter(t => t.id !== id);
    const executions = currentState.executions.filter(e => e.id !== id);
    const bugs = currentState.bugs.filter(b => b.testCaseId !== id);
    this.updateState({ testCases, executions, bugs });
  }

  // --- Executions ---
  updateExecution(exec: TestExecution) {
    const currentState = this.stateSubject.value;
    const executions = currentState.executions.map(e => e.id === exec.id ? exec : e);
    this.updateState({ executions });
  }

  // --- Bugs ---
  addBug(bug: Bug) {
    const bugs = [...this.stateSubject.value.bugs, bug];
    this.updateState({ bugs });
  }

  updateBug(bug: Bug) {
    const bugs = this.stateSubject.value.bugs.map(b => b.id === bug.id ? bug : b);
    this.updateState({ bugs });
  }

  // ─── EXCEL INTEGRATION ───────────────────────────────────────

  exportToExcel() {
    const { testCases, executions, bugs } = this.stateSubject.value;

    const tcSheet = XLSX.utils.json_to_sheet(testCases);
    const execSheet = XLSX.utils.json_to_sheet(executions);
    const bugSheet = XLSX.utils.json_to_sheet(bugs);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, tcSheet, 'TestCases');
    XLSX.utils.book_append_sheet(wb, execSheet, 'Executions');
    XLSX.utils.book_append_sheet(wb, bugSheet, 'Bugs');

    XLSX.writeFile(wb, 'UnitTestTracker_DB.xlsx');
  }

  parseExcelFile(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });

          const testCases = this.getSheetData<TestCase>(workbook, 'TestCases') || [];
          const executions = this.getSheetData<TestExecution>(workbook, 'Executions') || [];
          const bugs = this.getSheetData<Bug>(workbook, 'Bugs') || [];

          // Only update if sheets exist
          if (workbook.SheetNames.includes('TestCases')) {
            this.updateState({ testCases, executions, bugs });
          }
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = error => reject(error);
      reader.readAsArrayBuffer(file);
    });
  }

  private getSheetData<T>(workbook: XLSX.WorkBook, sheetName: string): T[] | null {
    if (!workbook.Sheets[sheetName]) return null;
    return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]) as T[];
  }
}
