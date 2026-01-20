
import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { SpendingEntry, Category } from '../types';

interface ChartsProps {
  entries: SpendingEntry[];
  isDarkMode: boolean;
}

// Updated brighter colors for Light mode / Clear contrast for Dark mode
const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1'];

const Charts: React.FC<ChartsProps> = ({ entries, isDarkMode }) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [viewMonths, setViewMonths] = useState(12);

  const timelineData = useMemo(() => {
    if (entries.length === 0) return [];
    
    // Sort entries by date
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    const firstDate = new Date(sorted[0].date);
    const lastDate = new Date(sorted[sorted.length - 1].date);
    const diffTime = Math.abs(lastDate.getTime() - firstDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 35) {
        // Show Daily
        const dates = new Set(entries.map(e => e.date));
        const dateArray = Array.from(dates).sort();
        return dateArray.map((date: string) => {
            const dayEntries = entries.filter(e => e.date === date);
            return {
                name: date.split('-').slice(2).join('/'), // DD
                fullDate: date,
                expense: dayEntries.filter(e => e.type === 'expense').reduce((sum, e) => sum + e.amount, 0),
                income: dayEntries.filter(e => e.type === 'income').reduce((sum, e) => sum + e.amount, 0),
            };
        });
    } else {
        // Show Monthly Aggregation
        const months: Record<string, { income: number, expense: number }> = {};
        entries.forEach(e => {
            const mKey = e.date.slice(0, 7); // YYYY-MM
            if (!months[mKey]) months[mKey] = { income: 0, expense: 0 };
            if (e.type === 'income') months[mKey].income += e.amount;
            else if (e.type === 'expense') months[mKey].expense += e.amount;
        });
        return Object.entries(months).sort((a, b) => a[0].localeCompare(b[0])).map(([key, val]) => ({
            name: `T${key.split('-')[1]}`,
            fullDate: key,
            income: val.income,
            expense: val.expense
        }));
    }
  }, [entries]);

  const categoryData = Object.values(Category)
    .filter(cat => cat !== Category.INCOME && cat !== Category.SAVING && cat !== Category.INVESTMENT)
    .map(cat => ({
      name: cat,
      value: entries.filter(e => e.category === cat && e.type === 'expense').reduce((sum, e) => sum + e.amount, 0)
    }))
    .filter(d => d.value > 0);

  return (
    <div className="space-y-8 mb-8">
      {/* Top Row: Timeline & Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`p-6 rounded-3xl border transition-colors h-80 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-[0_4px_20px_rgb(0,0,0,0.03)]'}`}>
          <h3 className={`text-sm font-bold mb-6 flex items-center gap-2 uppercase tracking-wide ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            <i className="fa-solid fa-chart-column"></i> Diễn biến Thu - Chi
          </h3>
          <ResponsiveContainer width="100%" height="80%">
            <BarChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#f1f5f9'} />
              <XAxis 
                dataKey="name" 
                tick={{fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b', fontWeight: 600}} 
                axisLine={false}
                tickLine={false}
                dy={10}
              />
              <YAxis 
                tick={{fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b'}} 
                tickFormatter={(val) => `${val/1000}k`} 
                axisLine={false}
                tickLine={false}
              />
              <Tooltip 
                formatter={(value: number) => new Intl.NumberFormat('vi-VN').format(value) + ' ₫'}
                contentStyle={{ 
                  borderRadius: '16px', 
                  border: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0', 
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                  backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                  color: isDarkMode ? '#f1f5f9' : '#0f172a',
                  padding: '12px'
                }}
                cursor={{fill: isDarkMode ? '#334155' : '#f1f5f9', opacity: 0.4}}
              />
              <Bar dataKey="income" name="Thu nhập" fill="#10b981" radius={[4, 4, 0, 0]} barSize={12} />
              <Bar dataKey="expense" name="Chi tiêu" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className={`p-6 rounded-3xl border transition-colors h-80 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-[0_4px_20px_rgb(0,0,0,0.03)]'}`}>
          <h3 className={`text-sm font-bold mb-6 flex items-center gap-2 uppercase tracking-wide ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
             <i className="fa-solid fa-chart-pie"></i> Cơ cấu chi tiêu
          </h3>
          <ResponsiveContainer width="100%" height="80%">
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => new Intl.NumberFormat('vi-VN').format(value) + ' ₫'}
                contentStyle={{ 
                   borderRadius: '16px', 
                   border: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0', 
                   boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                   backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                   color: isDarkMode ? '#f1f5f9' : '#0f172a',
                   padding: '12px'
                 }}
              />
              <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px', fontWeight: 500 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Charts;
