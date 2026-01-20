
export enum Category {
  FOOD = "Ăn uống",
  HANG_OUT = "Đi chơi & Giải trí",
  SHOPPING = "Mua sắm",
  INCOME = "Thu nhập",
  SAVING = "Tiết kiệm",
  INVESTMENT = "Đầu tư",
  LOAN_DEBT = "Nợ & Vay",
  OTHER = "Khác"
}

export type TransactionType = 'income' | 'expense' | 'saving' | 'investment';

export interface SpendingEntry {
  id: string;
  date: string;
  amount: number;
  category: Category;
  type: TransactionType;
  description: string;
  originalText?: string;
}

export interface SpendingSummary {
  dailyTotal: number;
  monthlyExpense: number;
  monthlyIncome: number;
  monthlySaving: number;
  monthlyInvestment: number;
  monthlyBudget: number;
  remainingBalance: number;
  averageDaily: number;
  byCategory: Record<Category, number>;
}
