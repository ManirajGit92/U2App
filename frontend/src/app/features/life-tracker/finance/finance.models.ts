export type TransactionType = 'expense' | 'income' | 'transfer';

export interface FinanceTransaction {
  id: string;
  type: TransactionType;
  date: string; // YYYY-MM-DD
  amount: number;
  category: string;
  description: string;
  paymentMethod: string;
  tags?: string[];
  receiptName?: string;
  receiptSize?: string;
  isRecurring?: boolean;
  createdAt: string;
}

export interface FinancialGoal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string;
  category: 'house' | 'retirement' | 'education' | 'car' | 'travel' | 'emergency' | 'other';
  icon: string;
  color: string;
}

export interface InvestmentItem {
  id: string;
  name: string;
  category: 'Mutual Funds' | 'Stocks' | 'Fixed Deposits' | 'Gold' | 'Others';
  amount: number;
  percentage: number;
  color: string;
}

export interface AssetLiabilityItem {
  id: string;
  name: string;
  amount: number;
  type: 'asset' | 'liability';
  category: string;
}

export interface TaxRecord {
  financialYear: string;
  taxableIncome: number;
  estimatedTax: number;
  paidTax: number;
  balance: number;
  completionPercent: number;
  regime: 'new' | 'old';
  deductions80C: number;
  deductions80D: number;
  hra: number;
  standardDeduction: number;
}

export interface ProfitLossMonth {
  month: string;
  revenue: number;
  cost: number;
  profit: number;
}

export interface MonthlyComparison {
  month: string;
  income: number;
  expense: number;
}

export interface CategoryBreakdown {
  name: string;
  percentage: number;
  amount: number;
  color: string;
}

export interface IncomeSourceBreakdown {
  name: string;
  percentage: number;
  amount: number;
  color: string;
}
