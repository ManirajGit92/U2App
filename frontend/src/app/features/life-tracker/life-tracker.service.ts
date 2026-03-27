import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import * as XLSX from 'xlsx';

export interface BaseEntry {
  id: string;
  date: string;
}

export interface RoutineEntry extends BaseEntry {
  time: string;
  task: string;
  frequency: 'Daily' | 'Weekly' | 'Monthly';
  completed: boolean;
}

export interface ExpenseEntry extends BaseEntry {
  category: string;
  description: string;
  amount: number;
}

export interface DietEntry extends BaseEntry {
  type: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
  food: string;
  calories: number;
  water: number; // glasses
}

export interface FitnessEntry extends BaseEntry {
  activity: string;
  duration: number; // mins
  steps: number;
  intensity: 'Low' | 'Medium' | 'High';
}

export interface MentalHealthEntry extends BaseEntry {
  mood: number; // 1-10
  sleep: number; // hours
  reflection: string;
}

export interface RelationshipEntry extends BaseEntry {
  name: string;
  type: 'Family' | 'Friend' | 'Partner' | 'Colleague';
  satisfaction: number; // 1-10
}

export interface InvestmentEntry extends BaseEntry {
  asset: string;
  type: 'Stock' | 'Crypto' | 'Real Estate' | 'Savings';
  amount: number;
  riskLevel: 'Low' | 'Medium' | 'High';
}

export interface Reminder {
  id: string;
  time: string;
  task: string;
  active: boolean;
}

export type CategoryType = 'Routines' | 'Expenses' | 'Diet' | 'Fitness' | 'MentalHealth' | 'Relationships' | 'Investments';

@Injectable({
  providedIn: 'root'
})
export class LifeTrackerService {
  private routinesSubject = new BehaviorSubject<RoutineEntry[]>([]);
  private expensesSubject = new BehaviorSubject<ExpenseEntry[]>([]);
  private dietSubject = new BehaviorSubject<DietEntry[]>([]);
  private fitnessSubject = new BehaviorSubject<FitnessEntry[]>([]);
  private mentalHealthSubject = new BehaviorSubject<MentalHealthEntry[]>([]);
  private relationshipsSubject = new BehaviorSubject<RelationshipEntry[]>([]);
  private investmentsSubject = new BehaviorSubject<InvestmentEntry[]>([]);
  private remindersSubject = new BehaviorSubject<Reminder[]>([]);

  public routines$ = this.routinesSubject.asObservable();
  public expenses$ = this.expensesSubject.asObservable();
  public diet$ = this.dietSubject.asObservable();
  public fitness$ = this.fitnessSubject.asObservable();
  public mentalHealth$ = this.mentalHealthSubject.asObservable();
  public relationships$ = this.relationshipsSubject.asObservable();
  public investments$ = this.investmentsSubject.asObservable();
  public reminders$ = this.remindersSubject.asObservable();

  constructor() {
    this.loadInitialData();
  }

  private loadInitialData() {
    // Default Sample Data
    const today = new Date().toISOString().split('T')[0];
    
    this.routinesSubject.next([
      { id: '1', date: today, time: '07:00', task: 'Morning Yoga', frequency: 'Daily', completed: true },
      { id: '2', date: today, time: '09:00', task: 'Deep Work Session', frequency: 'Daily', completed: false }
    ]);

    this.expensesSubject.next([
      { id: '1', date: today, category: 'Food', description: 'Grocery shopping', amount: 50 },
      { id: '2', date: today, category: 'Transport', description: 'Fuel', amount: 40 }
    ]);

    this.dietSubject.next([
      { id: '1', date: today, type: 'Breakfast', food: 'Oatmeal & Fruits', calories: 350, water: 2 }
    ]);

    this.fitnessSubject.next([
      { id: '1', date: today, activity: 'Walking', duration: 30, steps: 4000, intensity: 'Low' }
    ]);

    this.mentalHealthSubject.next([
      { id: '1', date: today, mood: 8, sleep: 7.5, reflection: 'Feeling productive and calm today.' }
    ]);

    this.relationshipsSubject.next([
      { id: '1', date: today, name: 'John Doe', type: 'Friend', satisfaction: 9 }
    ]);

    this.investmentsSubject.next([
      { id: '1', date: today, asset: 'S&P 500', type: 'Stock', amount: 1000, riskLevel: 'Medium' }
    ]);

    this.remindersSubject.next([
      { id: '1', time: '18:00', task: 'Check financial goals', active: true }
    ]);
  }

  // --- Generic CRUD ---
  addEntry(category: CategoryType, entry: any) {
    const subject = this.getSubjectForCategory(category);
    subject.next([...subject.value, { ...entry, id: Date.now().toString() }]);
  }

  updateEntry(category: CategoryType, id: string, updatedEntry: any) {
    const subject = this.getSubjectForCategory(category);
    const index = subject.value.findIndex(e => e.id === id);
    if (index !== -1) {
      const data = [...subject.value];
      data[index] = { ...updatedEntry, id };
      subject.next(data);
    }
  }

  removeEntry(category: CategoryType, id: string) {
    const subject = this.getSubjectForCategory(category);
    subject.next(subject.value.filter(e => e.id !== id));
  }

  private getSubjectForCategory(category: CategoryType): BehaviorSubject<any[]> {
    switch (category) {
      case 'Routines': return this.routinesSubject;
      case 'Expenses': return this.expensesSubject;
      case 'Diet': return this.dietSubject;
      case 'Fitness': return this.fitnessSubject;
      case 'MentalHealth': return this.mentalHealthSubject;
      case 'Relationships': return this.relationshipsSubject;
      case 'Investments': return this.investmentsSubject;
      default: throw new Error('Invalid category');
    }
  }

  // --- Excel Logic ---
  async importExcel(file: File) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          
          this.parseSheet(workbook, 'Routines', this.routinesSubject);
          this.parseSheet(workbook, 'Expenses', this.expensesSubject);
          this.parseSheet(workbook, 'Diet', this.dietSubject);
          this.parseSheet(workbook, 'Fitness', this.fitnessSubject);
          this.parseSheet(workbook, 'MentalHealth', this.mentalHealthSubject);
          this.parseSheet(workbook, 'Relationships', this.relationshipsSubject);
          this.parseSheet(workbook, 'Investments', this.investmentsSubject);
          
          resolve(true);
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  private parseSheet(workbook: XLSX.WorkBook, sheetName: string, subject: BehaviorSubject<any[]>) {
    if (workbook.SheetNames.includes(sheetName)) {
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet);
      subject.next(data);
    }
  }

  exportExcel() {
    const workbook = XLSX.utils.book_new();
    
    this.appendSheet(workbook, this.routinesSubject.value, 'Routines');
    this.appendSheet(workbook, this.expensesSubject.value, 'Expenses');
    this.appendSheet(workbook, this.dietSubject.value, 'Diet');
    this.appendSheet(workbook, this.fitnessSubject.value, 'Fitness');
    this.appendSheet(workbook, this.mentalHealthSubject.value, 'MentalHealth');
    this.appendSheet(workbook, this.relationshipsSubject.value, 'Relationships');
    this.appendSheet(workbook, this.investmentsSubject.value, 'Investments');
    
    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Life_Tracker_Data.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private appendSheet(workbook: XLSX.WorkBook, data: any[], sheetName: string) {
    const sheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  }

  // --- Guiding System ---
  getInsights(): string[] {
    const insights: string[] = [];
    const expenses = this.expensesSubject.value;
    const totalExpenses = expenses.reduce((acc, curr) => acc + curr.amount, 0);
    if (totalExpenses > 500) insights.push('⚠️ Your expenses are higher than average this week. Consider reviewing your budget.');

    const fitness = this.fitnessSubject.value;
    const avgSteps = fitness.reduce((acc, curr) => acc + curr.steps, 0) / (fitness.length || 1);
    if (avgSteps < 5000) insights.push('🏃 Your daily steps are low. Try a 15-minute walk today!');

    const mental = this.mentalHealthSubject.value;
    const avgSleep = mental.reduce((acc, curr) => acc + curr.sleep, 0) / (mental.length || 1);
    if (avgSleep < 7) insights.push('😴 You averaged less than 7 hours of sleep. Prioritize rest tonight for better mental health.');

    if (insights.length === 0) insights.push('✨ Great job! You are maintaining a balanced lifestyle.');
    
    return insights;
  }

  getEntriesForDate(date: string): Observable<any[]> {
    return new Observable(observer => {
      const all = [
        ...this.routinesSubject.value.map(e => ({ ...e, category: 'Routines' })),
        ...this.expensesSubject.value.map(e => ({ ...e, category: 'Expenses' })),
        ...this.dietSubject.value.map(e => ({ ...e, category: 'Diet' })),
        ...this.fitnessSubject.value.map(e => ({ ...e, category: 'Fitness' })),
        ...this.mentalHealthSubject.value.map(e => ({ ...e, category: 'MentalHealth' })),
        ...this.relationshipsSubject.value.map(e => ({ ...e, category: 'Relationships' })),
        ...this.investmentsSubject.value.map(e => ({ ...e, category: 'Investments' }))
      ].filter(e => e.date === date);
      observer.next(all);
    });
  }
}
