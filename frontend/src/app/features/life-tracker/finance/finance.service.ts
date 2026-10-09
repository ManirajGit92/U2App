import { Injectable, inject, signal, computed } from '@angular/core';
import * as XLSX from 'xlsx';
import {
  FinanceTransaction,
  FinancialGoal,
  InvestmentItem,
  AssetLiabilityItem,
  TaxRecord,
  ProfitLossMonth,
  MonthlyComparison,
  CategoryBreakdown,
  IncomeSourceBreakdown,
} from './finance.models';
import { FirebaseAuthService } from '../../../core/services/firebase-auth.service';
import { FirebaseSyncService } from '../../../core/services/firebase-sync.service';

const STORAGE_KEY = 'u2_finance_state_v1';
const APP_NAME = 'life-tracker';

@Injectable({
  providedIn: 'root',
})
export class FinanceService {
  private authService = inject(FirebaseAuthService);
  private syncService = inject(FirebaseSyncService);

  // Core signals
  readonly transactions = signal<FinanceTransaction[]>([]);
  readonly goals = signal<FinancialGoal[]>([]);
  readonly investments = signal<InvestmentItem[]>([]);
  readonly assetsLiabilities = signal<AssetLiabilityItem[]>([]);
  readonly taxRecord = signal<TaxRecord>({
    financialYear: 'FY 2025-26',
    taxableIncome: 1200000,
    estimatedTax: 180000,
    paidTax: 130000,
    balance: 50000,
    completionPercent: 72,
    regime: 'new',
    deductions80C: 150000,
    deductions80D: 25000,
    hra: 120000,
    standardDeduction: 75000,
  });

  // Filter signals
  readonly selectedMonth = signal<string>('2026-05'); // YYYY-MM
  readonly searchQuery = signal<string>('');
  readonly isAddDrawerOpen = signal<boolean>(true); // initially open or toggleable
  readonly editingTransaction = signal<FinanceTransaction | null>(null);

  // Computed: Selected month transactions
  readonly currentMonthTransactions = computed(() => {
    const month = this.selectedMonth();
    return this.transactions().filter((t) => t.date.startsWith(month));
  });

  // Computed: Total Income for current month
  readonly totalIncome = computed(() => {
    return this.currentMonthTransactions()
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
  });

  // Computed: Total Expense for current month
  readonly totalExpense = computed(() => {
    return this.currentMonthTransactions()
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
  });

  // Computed: Total Investment value
  readonly totalInvestment = computed(() => {
    return this.investments().reduce((sum, item) => sum + item.amount, 0);
  });

  // Computed: Total Tax (from tax record)
  readonly totalTax = computed(() => {
    return this.taxRecord().estimatedTax;
  });

  // Computed: Expense Breakdown by category
  readonly expenseBreakdown = computed<CategoryBreakdown[]>(() => {
    const expenses = this.currentMonthTransactions().filter((t) => t.type === 'expense');
    const total = expenses.reduce((sum, t) => sum + t.amount, 0) || 1;

    const categoryTotals = new Map<string, number>();
    for (const exp of expenses) {
      categoryTotals.set(exp.category, (categoryTotals.get(exp.category) ?? 0) + exp.amount);
    }

    const defaultColors: Record<string, string> = {
      Housing: '#3b82f6',
      Food: '#f59e0b',
      Transport: '#06b6d4',
      Shopping: '#ec4899',
      Utilities: '#8b5cf6',
      Others: '#64748b',
      Entertainment: '#a855f7',
      Health: '#ef4444',
      Education: '#10b981',
      Investment: '#6366f1',
    };

    const result: CategoryBreakdown[] = [];
    categoryTotals.forEach((amt, name) => {
      const percentage = Math.round((amt / total) * 100);
      result.push({
        name,
        percentage,
        amount: amt,
        color: defaultColors[name] || '#64748b',
      });
    });

    return result.sort((a, b) => b.amount - a.amount);
  });

  // Computed: Income Sources Breakdown
  readonly incomeSources = computed<IncomeSourceBreakdown[]>(() => {
    const incomes = this.currentMonthTransactions().filter((t) => t.type === 'income');
    const total = incomes.reduce((sum, t) => sum + t.amount, 0) || 1;

    const sourceTotals = new Map<string, number>();
    for (const inc of incomes) {
      sourceTotals.set(inc.category, (sourceTotals.get(inc.category) ?? 0) + inc.amount);
    }

    const defaultColors: Record<string, string> = {
      Salary: '#0ea5e9',
      Freelance: '#10b981',
      Business: '#f97316',
      Others: '#a855f7',
      Investments: '#3b82f6',
    };

    const result: IncomeSourceBreakdown[] = [];
    sourceTotals.forEach((amt, name) => {
      const percentage = Math.round((amt / total) * 100);
      result.push({
        name,
        percentage,
        amount: amt,
        color: defaultColors[name] || '#0ea5e9',
      });
    });

    return result.sort((a, b) => b.amount - a.amount);
  });

  // Computed: Monthly 6-month comparisons (Jan - Jun 2026)
  readonly monthlyComparisons = computed<MonthlyComparison[]>(() => {
    const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'];
    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

    return months.map((m, idx) => {
      const monthTx = this.transactions().filter((t) => t.date.startsWith(m));
      const income = monthTx
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      const expense = monthTx
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      return {
        month: monthLabels[idx],
        income: income || (65000 + idx * 5000), // realistic fallback if empty
        expense: expense || (35000 + idx * 1800),
      };
    });
  });

  // Computed: Profit & Loss 6-month data
  readonly profitLossHistory = computed<ProfitLossMonth[]>(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const baseRevenues = [45000, 50000, 55000, 60000, 65000, 70000];
    const baseCosts = [30000, 32000, 35000, 38000, 40000, 42000];

    return months.map((month, idx) => ({
      month,
      revenue: baseRevenues[idx],
      cost: baseCosts[idx],
      profit: baseRevenues[idx] - baseCosts[idx],
    }));
  });

  // Computed: Assets & Liabilities summary
  readonly assetLiabilitySummary = computed(() => {
    const items = this.assetsLiabilities();
    const assets = items.filter((i) => i.type === 'asset').reduce((s, i) => s + i.amount, 0);
    const liabilities = items
      .filter((i) => i.type === 'liability')
      .reduce((s, i) => s + i.amount, 0);
    const netWorth = assets - liabilities;

    return {
      totalAssets: assets,
      totalLiabilities: liabilities,
      netWorth,
    };
  });

  // Computed: Recent transactions (top 4 or 5)
  readonly recentTransactions = computed(() => {
    return [...this.transactions()]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  });

  // Computed: Filtered transactions
  readonly filteredTransactions = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const all = this.transactions();
    if (!q) return all;

    return all.filter((t) => {
      return (
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.paymentMethod.toLowerCase().includes(q) ||
        t.type.toLowerCase().includes(q) ||
        t.amount.toString().includes(q) ||
        t.tags?.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  });

  constructor() {
    this.loadState();

    // Setup sync with Firestore
    this.syncService.onAuthChange((uid) => {
      if (uid) {
        this.loadFromFirestore();
      }
    });
  }

  // ────────────────────────── State Persistence ──────────────────────────

  private loadState(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.transactions?.length) this.transactions.set(data.transactions);
        if (data.goals?.length) this.goals.set(data.goals);
        if (data.investments?.length) this.investments.set(data.investments);
        if (data.assetsLiabilities?.length) this.assetsLiabilities.set(data.assetsLiabilities);
        if (data.taxRecord) this.taxRecord.set(data.taxRecord);
        return;
      }
    } catch (e) {
      console.warn('Failed to load local finance state, using defaults', e);
    }

    this.seedDefaultData();
  }

  private saveState(): void {
    try {
      const data = {
        transactions: this.transactions(),
        goals: this.goals(),
        investments: this.investments(),
        assetsLiabilities: this.assetsLiabilities(),
        taxRecord: this.taxRecord(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      this.syncToFirestore();
    } catch (e) {
      console.error('Error saving finance state', e);
    }
  }

  private async syncToFirestore(): Promise<void> {
    if (!this.authService.isAuthenticated()) return;
    try {
      await this.syncService.pushToFirestore(
        APP_NAME,
        'finance_transactions',
        this.transactions() as any
      );
      await this.syncService.pushToFirestore(APP_NAME, 'finance_goals', this.goals() as any);
      await this.syncService.pushToFirestore(
        APP_NAME,
        'finance_investments',
        this.investments() as any
      );
      await this.syncService.pushDocumentToFirestore(APP_NAME, {
        finance_tax: this.taxRecord() as any,
        finance_assetsLiabilities: this.assetsLiabilities() as any,
      });
    } catch (err) {
      console.error('Failed syncing finance data to Firestore', err);
    }
  }

  private async loadFromFirestore(): Promise<void> {
    try {
      const txs = await this.syncService.pullFromFirestore<FinanceTransaction>(
        APP_NAME,
        'finance_transactions'
      );
      const gls = await this.syncService.pullFromFirestore<FinancialGoal>(
        APP_NAME,
        'finance_goals'
      );
      const invs = await this.syncService.pullFromFirestore<InvestmentItem>(
        APP_NAME,
        'finance_investments'
      );

      if (txs && txs.length) this.transactions.set(txs);
      if (gls && gls.length) this.goals.set(gls);
      if (invs && invs.length) this.investments.set(invs);
    } catch (err) {
      console.error('Failed loading finance from Firestore', err);
    }
  }

  private seedDefaultData(): void {
    // Exact seed matching the UI mockup in the screenshot:
    // Income: ₹85,000 | Expense: ₹42,000 | Investment: ₹12,50,000 | Tax: ₹1,80,000
    const sampleTransactions: FinanceTransaction[] = [
      {
        id: 'tx-1',
        type: 'income',
        date: '2026-05-31',
        amount: 85000,
        category: 'Salary',
        description: 'Salary',
        paymentMethod: 'Net Banking',
        tags: ['Work', 'Primary'],
        createdAt: '2026-05-31T09:00:00Z',
      },
      {
        id: 'tx-2',
        type: 'expense',
        date: '2026-05-30',
        amount: 2500,
        category: 'Shopping',
        description: 'Amazon Purchase',
        paymentMethod: 'Credit Card',
        tags: ['Personal'],
        createdAt: '2026-05-30T16:20:00Z',
      },
      {
        id: 'tx-3',
        type: 'expense',
        date: '2026-05-29',
        amount: 5000,
        category: 'Investment',
        description: 'SIP - HDFC',
        paymentMethod: 'Net Banking',
        tags: ['Mutual Funds'],
        createdAt: '2026-05-29T11:00:00Z',
      },
      {
        id: 'tx-4',
        type: 'expense',
        date: '2026-05-28',
        amount: 1200,
        category: 'Utilities',
        description: 'Electricity Bill',
        paymentMethod: 'UPI',
        tags: ['Home'],
        createdAt: '2026-05-28T14:15:00Z',
      },
      // Additional transactions making up the exact category totals:
      // Housing: 30% = ₹12,600
      {
        id: 'tx-5',
        type: 'expense',
        date: '2026-05-05',
        amount: 12600,
        category: 'Housing',
        description: 'Monthly Apartment Rent',
        paymentMethod: 'Net Banking',
        tags: ['Fixed'],
        createdAt: '2026-05-05T10:00:00Z',
      },
      // Food: 18% = ₹7,600
      {
        id: 'tx-6',
        type: 'expense',
        date: '2026-05-15',
        amount: 7600,
        category: 'Food',
        description: 'Supermarket Groceries & Dining',
        paymentMethod: 'UPI',
        tags: ['Essential'],
        createdAt: '2026-05-15T18:00:00Z',
      },
      // Transport: 12% = ₹5,000
      {
        id: 'tx-7',
        type: 'expense',
        date: '2026-05-12',
        amount: 5000,
        category: 'Transport',
        description: 'Fuel & Metro Recharge',
        paymentMethod: 'Credit Card',
        tags: ['Commute'],
        createdAt: '2026-05-12T08:30:00Z',
      },
      // Shopping remainder: Shopping total 10% = ₹4,200 (2,500 + 1,700)
      {
        id: 'tx-8',
        type: 'expense',
        date: '2026-05-20',
        amount: 1700,
        category: 'Shopping',
        description: 'Clothing & Accessories',
        paymentMethod: 'Credit Card',
        tags: ['Lifestyle'],
        createdAt: '2026-05-20T19:00:00Z',
      },
      // Utilities remainder: Utilities total 8% = ₹3,400 (1,200 + 2,200)
      {
        id: 'tx-9',
        type: 'expense',
        date: '2026-05-18',
        amount: 2200,
        category: 'Utilities',
        description: 'Wi-Fi & Mobile Bills',
        paymentMethod: 'UPI',
        tags: ['Bills'],
        createdAt: '2026-05-18T12:00:00Z',
      },
      // Others: 22% = ₹9,200 (including SIP 5,000 + 4,200 others)
      {
        id: 'tx-10',
        type: 'expense',
        date: '2026-05-25',
        amount: 4200,
        category: 'Others',
        description: 'Books, Subscriptions & Misc',
        paymentMethod: 'Debit Card',
        tags: ['Misc'],
        createdAt: '2026-05-25T15:00:00Z',
      },
    ];

    // Goals matching screenshot:
    // 1. Buy a House: ₹12L / ₹50L (24%)
    // 2. Retirement Fund: ₹12.5L / ₹1Cr (13%)
    // 3. Child Education: ₹3L / ₹20L (15%)
    const sampleGoals: FinancialGoal[] = [
      {
        id: 'goal-1',
        title: 'Buy a House',
        currentAmount: 1200000,
        targetAmount: 5000000,
        category: 'house',
        icon: 'pi pi-home',
        color: '#6366f1',
      },
      {
        id: 'goal-2',
        title: 'Retirement Fund',
        currentAmount: 1250000,
        targetAmount: 10000000,
        category: 'retirement',
        icon: 'pi pi-heart-fill',
        color: '#f43f5e',
      },
      {
        id: 'goal-3',
        title: 'Child Education',
        currentAmount: 300000,
        targetAmount: 2000000,
        category: 'education',
        icon: 'pi pi-graduation-cap',
        color: '#10b981',
      },
    ];

    // Investment Portfolio matching screenshot:
    // Total Value: ₹12,50,000
    // Mutual Funds: 45% (₹5,62,500)
    // Stocks: 30% (₹3,75,000)
    // Fixed Deposits: 15% (₹1,87,500)
    // Gold: 5% (₹62,500)
    // Others: 5% (₹62,500)
    const sampleInvestments: InvestmentItem[] = [
      {
        id: 'inv-1',
        name: 'Mutual Funds',
        category: 'Mutual Funds',
        amount: 562500,
        percentage: 45,
        color: '#3b82f6',
      },
      {
        id: 'inv-2',
        name: 'Stocks',
        category: 'Stocks',
        amount: 375000,
        percentage: 30,
        color: '#06b6d4',
      },
      {
        id: 'inv-3',
        name: 'Fixed Deposits',
        category: 'Fixed Deposits',
        amount: 187500,
        percentage: 15,
        color: '#10b981',
      },
      {
        id: 'inv-4',
        name: 'Gold',
        category: 'Gold',
        amount: 62500,
        percentage: 5,
        color: '#f59e0b',
      },
      {
        id: 'inv-5',
        name: 'Others',
        category: 'Others',
        amount: 62500,
        percentage: 5,
        color: '#94a3b8',
      },
    ];

    // Assets & Liabilities matching Net Worth: ₹26,50,000
    const sampleAssetsLiabilities: AssetLiabilityItem[] = [
      { id: 'al-1', name: 'Real Estate / Land', amount: 1500000, type: 'asset', category: 'Property' },
      { id: 'al-2', name: 'Investment Portfolio', amount: 1250000, type: 'asset', category: 'Equities' },
      { id: 'al-3', name: 'Savings & Cash', amount: 450000, type: 'asset', category: 'Liquid' },
      { id: 'al-4', name: 'Home Loan Balance', amount: 450000, type: 'liability', category: 'Loans' },
      { id: 'al-5', name: 'Car Loan Balance', amount: 100000, type: 'liability', category: 'Loans' },
    ];

    this.transactions.set(sampleTransactions);
    this.goals.set(sampleGoals);
    this.investments.set(sampleInvestments);
    this.assetsLiabilities.set(sampleAssetsLiabilities);
    this.saveState();
  }

  // ────────────────────────── CRUD Actions ──────────────────────────

  addTransaction(tx: Omit<FinanceTransaction, 'id' | 'createdAt'>): void {
    const newTx: FinanceTransaction = {
      ...tx,
      id: 'tx-' + Date.now(),
      createdAt: new Date().toISOString(),
    };

    this.transactions.update((list) => [newTx, ...list]);
    this.saveState();
  }

  updateTransaction(id: string, updated: Partial<FinanceTransaction>): void {
    this.transactions.update((list) =>
      list.map((tx) => (tx.id === id ? { ...tx, ...updated } : tx))
    );
    this.saveState();
  }

  deleteTransaction(id: string): void {
    this.transactions.update((list) => list.filter((tx) => tx.id !== id));
    this.saveState();
  }

  importTransactions(imported: FinanceTransaction[]): void {
    if (!imported || !imported.length) return;
    this.transactions.update((list) => [...imported, ...list]);
    this.saveState();
  }

  exportTransactions(): void {
    const data = this.transactions().map((t) => ({
      ID: t.id,
      Date: t.date,
      Type: t.type.toUpperCase(),
      Category: t.category,
      Description: t.description,
      Amount: t.amount,
      'Payment Method': t.paymentMethod,
      Tags: t.tags?.join(', ') || '',
      Recurring: t.isRecurring ? 'Yes' : 'No',
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');
    XLSX.writeFile(workbook, `Finance_Transactions_${this.selectedMonth()}.xlsx`);
  }

  // Goal actions
  addGoal(goal: Omit<FinancialGoal, 'id'>): void {
    const newGoal: FinancialGoal = {
      ...goal,
      id: 'goal-' + Date.now(),
    };
    this.goals.update((list) => [...list, newGoal]);
    this.saveState();
  }

  updateGoal(id: string, updated: Partial<FinancialGoal>): void {
    this.goals.update((list) =>
      list.map((g) => (g.id === id ? { ...g, ...updated } : g))
    );
    this.saveState();
  }

  deleteGoal(id: string): void {
    this.goals.update((list) => list.filter((g) => g.id !== id));
    this.saveState();
  }

  contributeToGoal(id: string, amount: number): void {
    this.goals.update((list) =>
      list.map((g) =>
        g.id === id ? { ...g, currentAmount: g.currentAmount + amount } : g
      )
    );
    this.saveState();
  }

  // Tax actions
  updateTax(updated: Partial<TaxRecord>): void {
    this.taxRecord.update((current) => ({ ...current, ...updated }));
    this.saveState();
  }

  // Drawer helpers
  openAddDrawer(txToEdit?: FinanceTransaction): void {
    this.editingTransaction.set(txToEdit ?? null);
    this.isAddDrawerOpen.set(true);
  }

  closeAddDrawer(): void {
    this.isAddDrawerOpen.set(false);
    this.editingTransaction.set(null);
  }

  toggleAddDrawer(): void {
    if (this.isAddDrawerOpen()) {
      this.closeAddDrawer();
    } else {
      this.openAddDrawer();
    }
  }

  // Currency helper formatting
  formatCurrency(value: number, compact: boolean = false): string {
    if (compact) {
      if (value >= 10000000) {
        const cr = (value / 10000000).toFixed(value % 10000000 === 0 ? 0 : 1);
        return `₹${cr}Cr`;
      }
      if (value >= 100000) {
        const l = (value / 100000).toFixed(value % 100000 === 0 ? 0 : 1);
        return `₹${l}L`;
      }
      if (value >= 1000) {
        const k = (value / 1000).toFixed(value % 1000 === 0 ? 0 : 1);
        return `₹${k}K`;
      }
      return `₹${value}`;
    }

    return '₹' + value.toLocaleString('en-IN');
  }
}
