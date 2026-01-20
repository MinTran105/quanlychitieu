
import React from 'react';
import { SpendingSummary } from '../types';

interface StatsCardsProps {
  summary: SpendingSummary;
  monthlyBudget: number;
  setMonthlyBudget: (value: number) => void;
  isDarkMode: boolean;
}

const StatsCards: React.FC<StatsCardsProps> = ({ summary, isDarkMode }) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  // Logic: Cân đối Thu - Chi (Net Cash Flow)
  const netCashFlow = summary.monthlyIncome - summary.monthlyExpense;
  const isPositive = netCashFlow >= 0;
  
  // Logic: Tỷ trọng Chi / Thu
  // Nếu chưa có thu nhập thì mặc định là 0% (hoặc 100% nếu đã tiêu mà không có thu)
  let expenseRatio = 0;
  if (summary.monthlyIncome > 0) {
    expenseRatio = Math.round((summary.monthlyExpense / summary.monthlyIncome) * 100);
  } else if (summary.monthlyExpense > 0) {
    expenseRatio = 100; // Tiêu mà không có thu thì coi như max
  }

  // Màu sắc cảnh báo cho thanh tỷ trọng
  let ratioColorClass = 'bg-emerald-300';
  if (expenseRatio > 80) ratioColorClass = 'bg-red-300';
  else if (expenseRatio > 50) ratioColorClass = 'bg-orange-300';

  // Dynamic color cho thẻ Hero
  const cardColor = isPositive ? 'from-blue-600 to-cyan-500' : 'from-red-600 to-orange-600';

  return (
    <div className="space-y-4 mb-8">
      {/* SECTION 1: HERO - CÂN ĐỐI THU CHI */}
      <div className={`relative overflow-hidden p-6 rounded-3xl shadow-lg shadow-blue-500/20 transition-all bg-gradient-to-br ${cardColor} text-white`}>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <span className="text-white/90 text-xs font-bold uppercase tracking-wider flex items-center gap-2 mb-2 opacity-90">
              <i className="fa-solid fa-scale-balanced"></i> Cân đối Thu - Chi
            </span>
            <span className="text-4xl font-bold tracking-tight block mb-1">
              {formatCurrency(netCashFlow)}
            </span>
            <span className="text-xs text-white/80 font-medium">
              {isPositive 
                ? 'Dư ra sau chi tiêu (Chưa trừ tiết kiệm)' 
                : 'Cảnh báo: Chi tiêu vượt quá Thu nhập!'}
            </span>
          </div>

          {/* Tỷ trọng Chi / Thu (Thay thế cho Budget) */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 p-3 rounded-2xl flex items-center gap-3 w-full md:w-auto min-w-[180px]">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white text-lg">
              <i className="fa-solid fa-chart-pie"></i>
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] uppercase font-bold text-white/80">Đã tiêu</span>
                <span className="text-sm font-bold text-white">{expenseRatio}% <span className="text-[9px] font-normal opacity-80">thu nhập</span></span>
              </div>
              {/* Progress Bar */}
              <div className="w-full h-1.5 bg-black/20 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${ratioColorClass}`} 
                  style={{ width: `${Math.min(100, expenseRatio)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Background Decoration */}
        <div className="absolute -right-6 -bottom-12 text-white/10 text-9xl transform rotate-12 pointer-events-none">
          <i className={`fa-solid ${isPositive ? 'fa-wallet' : 'fa-triangle-exclamation'}`}></i>
        </div>
      </div>

      {/* SECTION 2: CASH FLOW (IN vs OUT) */}
      <div className="grid grid-cols-2 gap-4">
        {/* Income */}
        <div className={`group p-5 rounded-3xl border transition-all hover:-translate-y-1 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-[0_4px_20px_rgb(0,0,0,0.03)]'}`}>
          <div className="flex justify-between items-start mb-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg ${isDarkMode ? 'bg-emerald-500/10 text-emerald-500' : 'bg-emerald-50 text-emerald-500'}`}>
              <i className="fa-solid fa-arrow-trend-up"></i>
            </div>
          </div>
          <div>
             <span className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Thu nhập</span>
            <span className="block text-2xl font-bold text-emerald-600">{formatCurrency(summary.monthlyIncome).replace('₫', '')}</span>
          </div>
        </div>

        {/* Expense */}
        <div className={`group p-5 rounded-3xl border transition-all hover:-translate-y-1 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-[0_4px_20px_rgb(0,0,0,0.03)]'}`}>
          <div className="flex justify-between items-start mb-3">
             <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg ${isDarkMode ? 'bg-red-500/10 text-red-500' : 'bg-red-50 text-red-500'}`}>
              <i className="fa-solid fa-arrow-trend-down"></i>
            </div>
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Chi tiêu</span>
            <span className="block text-2xl font-bold text-red-600">{formatCurrency(summary.monthlyExpense).replace('₫', '')}</span>
          </div>
        </div>
      </div>

      {/* SECTION 3: ALLOCATION & TRACKING */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Savings */}
        <div className={`p-4 rounded-3xl border flex items-center gap-4 transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-[0_4px_20px_rgb(0,0,0,0.03)]'}`}>
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-lg ${isDarkMode ? 'bg-purple-500/10 text-purple-600' : 'bg-purple-50 text-purple-600'}`}>
            <i className="fa-solid fa-piggy-bank"></i>
          </div>
          <div>
            <span className="text-slate-400 text-[10px] font-bold uppercase block mb-0.5">Tiết kiệm</span>
            <span className={`text-lg font-bold ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>{formatCurrency(summary.monthlySaving)}</span>
          </div>
        </div>

        {/* Investment */}
        <div className={`p-4 rounded-3xl border flex items-center gap-4 transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-[0_4px_20px_rgb(0,0,0,0.03)]'}`}>
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-lg ${isDarkMode ? 'bg-indigo-500/10 text-indigo-600' : 'bg-indigo-50 text-indigo-600'}`}>
            <i className="fa-solid fa-chart-line"></i>
          </div>
          <div>
            <span className="text-slate-400 text-[10px] font-bold uppercase block mb-0.5">Đầu tư</span>
            <span className={`text-lg font-bold ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>{formatCurrency(summary.monthlyInvestment)}</span>
          </div>
        </div>

        {/* Average Daily */}
        <div className={`p-4 rounded-3xl border flex items-center gap-4 transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-[0_4px_20px_rgb(0,0,0,0.03)]'}`}>
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-lg ${isDarkMode ? 'bg-cyan-500/10 text-cyan-500' : 'bg-cyan-50 text-cyan-600'}`}>
            <i className="fa-solid fa-calendar-day"></i>
          </div>
          <div>
            <span className="text-slate-400 text-[10px] font-bold uppercase block mb-0.5">Trung bình / ngày</span>
            <span className={`text-lg font-bold ${isDarkMode ? 'text-cyan-400' : 'text-cyan-600'}`}>{formatCurrency(summary.averageDaily)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsCards;
