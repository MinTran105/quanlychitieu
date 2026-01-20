
import React, { useState, useEffect, useRef } from 'react';
import { SpendingEntry, Category, SpendingSummary } from './types';
import { parseSpendingInput } from './services/geminiService';
import StatsCards from './components/StatsCards';
import Charts from './components/Charts';
import CalendarView from './components/CalendarView';

const App: React.FC = () => {
  const [entries, setEntries] = useState<SpendingEntry[]>([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  // Dashboard Date Filter State
  const [dashStartDate, setDashStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1); // Mặc định ngày mùng 1 đầu tháng
    return date.toISOString().split('T')[0];
  });
  const [dashEndDate, setDashEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]; // Mặc định hôm nay
  });

  const [isRetroactive, setIsRetroactive] = useState(false);
  const [retroDate, setRetroDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'summary' | 'settings'>('dashboard');
  
  // History Tab State
  const [historySubTab, setHistorySubTab] = useState<'calendar' | 'list'>('calendar');
  const [viewDate, setViewDate] = useState(new Date()); // For Calendar View
  const [listFilterMonth, setListFilterMonth] = useState(new Date().getMonth() + 1); // For List View
  const [listFilterYear, setListFilterYear] = useState(new Date().getFullYear()); // For List View

  // Budget State
  const [monthlyBudget, setMonthlyBudget] = useState<number>(() => {
    const saved = localStorage.getItem('spending_monthly_budget');
    return saved ? parseInt(saved, 10) : 0;
  });

  // Dark Mode State
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('spending_dark_mode') === 'true');

  // Modal states
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType, setExportType] = useState<'month' | 'year' | 'custom'>('month');
  const [selectedExportMonth, setSelectedExportMonth] = useState(new Date().getMonth() + 1);
  const [selectedExportYear, setSelectedExportYear] = useState(new Date().getFullYear());
  const [customExportStart, setCustomExportStart] = useState('');
  const [customExportEnd, setCustomExportEnd] = useState('');
  
  // Text Backup Modal State
  const [showTextBackupModal, setShowTextBackupModal] = useState(false);
  const [textBackupMode, setTextBackupMode] = useState<'export' | 'import'>('export');
  const [textBackupValue, setTextBackupValue] = useState('');
  const [copyStatus, setCopyStatus] = useState('Sao chép');

  const [deleteConfirm, setDeleteConfirm] = useState<{show: boolean; type: 'single' | 'all'; id?: string;}>({ show: false, type: 'single' });

  // Ref for file input
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('spending_entries');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const migrated = parsed.map((e: any) => ({
          ...e,
          type: e.type || (e.category === "Thu nhập" ? 'income' : 'expense')
        }));
        setEntries(migrated);
      } catch (e) {
        console.error("Failed to load entries", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('spending_entries', JSON.stringify(entries));
  }, [entries]);

  useEffect(() => {
    localStorage.setItem('spending_monthly_budget', monthlyBudget.toString());
  }, [monthlyBudget]);

  useEffect(() => {
    // Force update DOM immediately
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('spending_dark_mode', isDarkMode.toString());
  }, [isDarkMode]);

  const handleSpeech = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Trình duyệt không hỗ trợ giọng nói.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputText(prev => prev ? `${prev}, ${transcript}` : transcript);
    };
    recognition.start();
  };

  const generateId = () => Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

  const handleAddSpending = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    setIsProcessing(true);
    try {
      const parts = inputText.split(',').map(p => p.trim()).filter(p => p.length > 0);
      const targetDate = isRetroactive ? retroDate : new Date().toISOString().split('T')[0];
      const results = await Promise.all(parts.map(async (part) => {
        const parsed = await parseSpendingInput(part);
        return { 
          id: generateId(), 
          date: targetDate, 
          amount: parsed.amount, 
          category: parsed.category, 
          type: parsed.type, 
          description: parsed.description, 
          originalText: part 
        };
      }));
      setEntries(prev => [...results, ...prev]);
      setInputText('');
    } catch (error) {
      alert("Lỗi xử lý AI: " + error);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
  };

  // --- LOGIC TÍNH TOÁN DASHBOARD ---
  const summary: SpendingSummary = (() => {
    const today = new Date().toISOString().split('T')[0];
    const filteredEntries = entries.filter(e => e.date >= dashStartDate && e.date <= dashEndDate);
    
    const monthlyExpense = filteredEntries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
    const monthlyIncome = filteredEntries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
    const monthlySaving = filteredEntries.filter(e => e.type === 'saving').reduce((s, e) => s + e.amount, 0);
    const monthlyInvestment = filteredEntries.filter(e => e.type === 'investment').reduce((s, e) => s + e.amount, 0);
    
    const remainingBalance = (monthlyBudget + monthlyIncome) - (monthlyExpense + monthlySaving + monthlyInvestment);

    // Calculate days passed in the selected range
    const start = new Date(dashStartDate);
    const end = new Date(dashEndDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    const averageDaily = monthlyExpense / Math.max(1, diffDays);

    return {
      dailyTotal: entries.filter(e => e.date === today && e.type === 'expense').reduce((s, e) => s + e.amount, 0),
      monthlyExpense,
      monthlyIncome,
      monthlySaving,
      monthlyInvestment,
      monthlyBudget,
      remainingBalance,
      averageDaily,
      byCategory: filteredEntries.filter(e => e.type === 'expense').reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + e.amount;
        return acc;
      }, {} as Record<Category, number>)
    };
  })();

  const getMonthlyReport = () => {
    const months: Record<string, { income: number, expense: number, saving: number, investment: number }> = {};
    entries.forEach(e => {
      const m = e.date.slice(0, 7);
      if (!months[m]) months[m] = { income: 0, expense: 0, saving: 0, investment: 0 };
      
      if (e.type === 'income') months[m].income += e.amount;
      else if (e.type === 'expense') months[m].expense += e.amount;
      else if (e.type === 'saving') months[m].saving += e.amount;
      else if (e.type === 'investment') months[m].investment += e.amount;
    });
    return Object.entries(months).sort((a, b) => b[0].localeCompare(a[0])); // Sort DESC (Mới nhất lên đầu)
  };

  const getFilteredListEntries = () => {
    const targetPrefix = `${listFilterYear}-${String(listFilterMonth).padStart(2, '0')}`;
    return entries.filter(e => e.date.startsWith(targetPrefix)).sort((a,b) => b.date.localeCompare(a.date));
  };

  const handleExecuteExport = () => {
     let filtered = entries;
     let fileName = `Bao_cao_${exportType}`;

     if (exportType === 'month') {
       const monthStr = `${selectedExportYear}-${String(selectedExportMonth).padStart(2, '0')}`;
       filtered = entries.filter(e => e.date.startsWith(monthStr));
       fileName += `_${selectedExportMonth}_${selectedExportYear}`;
     } else if (exportType === 'year') {
       filtered = entries.filter(e => e.date.startsWith(`${selectedExportYear}`));
       fileName += `_${selectedExportYear}`;
     } else if (exportType === 'custom') {
        if (!customExportStart || !customExportEnd) return alert("Vui lòng chọn ngày bắt đầu và kết thúc");
        filtered = entries.filter(e => e.date >= customExportStart && e.date <= customExportEnd);
        fileName += `_tu_${customExportStart}_den_${customExportEnd}`;
     }

     if (filtered.length === 0) return alert("Không có dữ liệu trong khoảng thời gian này");
     
     const totalIncome = filtered.filter(e => e.type === 'income').reduce((sum, e) => sum + e.amount, 0);
     const totalExpense = filtered.filter(e => e.type === 'expense').reduce((sum, e) => sum + e.amount, 0);
     const totalSaving = filtered.filter(e => e.type === 'saving').reduce((sum, e) => sum + e.amount, 0);
     const totalInvest = filtered.filter(e => e.type === 'investment').reduce((sum, e) => sum + e.amount, 0);

     let csv = "\uFEFFNgày,Mô tả,Loại,Danh mục,Số tiền\n";
     filtered.sort((a,b) => a.date.localeCompare(b.date));

     filtered.forEach(e => csv += `${e.date},${e.description.replace(/,/g, ' ')},${e.type},${e.category},${e.amount}\n`);
     csv += `\nTổng thu,,,${totalIncome}\n`;
     csv += `Tổng chi,,,${totalExpense}\n`;
     csv += `Tổng tiết kiệm,,,${totalSaving}\n`;
     csv += `Tổng đầu tư,,,${totalInvest}\n`;
     
     const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
     const link = document.createElement("a");
     link.href = URL.createObjectURL(blob);
     link.download = `${fileName}.csv`;
     link.click();
     setShowExportModal(false);
  };

  const handleBackup = () => {
    const dataStr = JSON.stringify(entries, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_chitieu_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRestore = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsedData = JSON.parse(content);
        if (Array.isArray(parsedData)) {
          const valid = parsedData.every(item => item.date && item.amount && item.type);
          if (valid) {
             if (confirm(`Tìm thấy ${parsedData.length} giao dịch. Bạn có muốn ghi đè dữ liệu hiện tại không?`)) {
               setEntries(parsedData);
               alert("Khôi phục dữ liệu thành công!");
             }
          } else {
            alert("File không đúng định dạng dữ liệu chi tiêu.");
          }
        } else {
          alert("File không hợp lệ.");
        }
      } catch (error) {
        alert("Lỗi đọc file backup.");
      }
    };
    reader.readAsText(file);
    event.target.value = ''; 
  };
  
  const handleOpenTextBackup = (mode: 'export' | 'import') => {
      setTextBackupMode(mode);
      if (mode === 'export') {
          setTextBackupValue(JSON.stringify(entries));
          setCopyStatus('Sao chép');
      } else {
          setTextBackupValue('');
      }
      setShowTextBackupModal(true);
  };

  const handleCopyText = () => {
      navigator.clipboard.writeText(textBackupValue);
      setCopyStatus('Đã chép!');
      setTimeout(() => setCopyStatus('Sao chép'), 2000);
  };

  const handleExecuteTextRestore = () => {
      try {
          if (!textBackupValue.trim()) return;
          const parsedData = JSON.parse(textBackupValue);
          if (Array.isArray(parsedData) && parsedData.every(item => item.date && item.amount)) {
               if (confirm(`Tìm thấy ${parsedData.length} giao dịch. Ghi đè ngay?`)) {
                   setEntries(parsedData);
                   alert("Thành công!");
                   setShowTextBackupModal(false);
               }
          } else {
              alert("Dữ liệu không hợp lệ.");
          }
      } catch (e) {
          alert("Lỗi định dạng JSON.");
      }
  };

  const confirmDelete = () => {
    if (deleteConfirm.type === 'single' && deleteConfirm.id) {
       setEntries(prev => prev.filter(e => e.id !== deleteConfirm.id));
    } else if (deleteConfirm.type === 'all') {
       setEntries([]);
    }
    setDeleteConfirm({ show: false, type: 'single' });
  };


  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'} flex flex-col items-center`}>
      
      {/* 1. HEADER (Sticky) */}
      <header className={`sticky top-0 z-40 w-full backdrop-blur-xl border-b transition-colors duration-300 ${isDarkMode ? 'bg-slate-950/80 border-slate-800' : 'bg-white/80 border-slate-200 shadow-sm'}`}>
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-lg shadow-lg ${isDarkMode ? 'bg-blue-600 text-white shadow-blue-900/20' : 'bg-blue-600 text-white shadow-blue-200'}`}>
              <i className="fa-solid fa-wallet"></i>
            </div>
            <h1 className="font-bold text-xl tracking-tight">Quản lý Chi tiêu</h1>
          </div>
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all duration-300 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-yellow-400 hover:bg-slate-700' : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'}`}
          >
            <i className={`fa-solid ${isDarkMode ? 'fa-sun' : 'fa-moon'} text-base`}></i>
          </button>
        </div>
      </header>

      <main className="w-full max-w-4xl px-4 py-6 pb-28">
        
        {/* 2. INPUT SECTION (Improved UX with Floating Card) */}
        <section className={`relative group mb-8 rounded-3xl transition-all duration-300 ${isDarkMode ? 'bg-slate-900 border border-slate-800 shadow-none' : 'bg-white border border-slate-200 shadow-lg shadow-slate-200/50'}`}>
          <form onSubmit={handleAddSpending} className="p-4">
             <div className="flex gap-3">
                <div className="flex-1 relative">
                  {/* Left-side Microphone Button */}
                  <button 
                    type="button" 
                    onClick={handleSpeech} 
                    className={`absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full transition-all z-10 ${isListening ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  >
                    <i className="fa-solid fa-microphone"></i>
                  </button>

                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Nhập chi tiêu (Ví dụ: Ăn sáng 30k...)"
                    className={`w-full pl-14 pr-4 py-3.5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-colors font-medium ${isDarkMode ? 'bg-slate-950 text-slate-100 placeholder-slate-600 border border-slate-800' : 'bg-slate-50 text-slate-900 placeholder-slate-400 border border-slate-200 focus:bg-white'}`}
                  />
                </div>
                <button type="submit" disabled={isProcessing || !inputText.trim()} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95">
                   <i className={`fa-solid ${isProcessing ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
                </button>
             </div>
             
             {/* Collapsible/Extra options line */}
             <div className="flex items-center justify-between mt-3 px-1">
                <div className={`flex items-center gap-2 transition-all overflow-hidden ${isRetroactive ? 'max-w-xs opacity-100' : 'max-w-0 opacity-0'}`}>
                  <input 
                    type="date" 
                    value={retroDate} 
                    onChange={(e) => setRetroDate(e.target.value)} 
                    className={`text-xs px-3 py-1.5 rounded-lg border outline-none font-medium ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-100 border-slate-200 text-slate-700'}`} 
                  />
                </div>
                {/* Improved Retroactive Button Visibility */}
                <button 
                  type="button" 
                  onClick={() => setIsRetroactive(!isRetroactive)} 
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border flex items-center gap-2 transition-all ml-auto 
                    ${isRetroactive 
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20' 
                      : (isDarkMode ? 'bg-slate-800 text-orange-400 border-slate-700 hover:bg-slate-700' : 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100')
                    }`}
                >
                   <i className="fa-solid fa-clock-rotate-left"></i> {isRetroactive ? 'Đang chọn ngày cũ' : 'Ghi bù ngày khác'}
                </button>
             </div>
          </form>
        </section>

        {/* 3. MAIN CONTENT TABS */}
        
        {/* === DASHBOARD TAB === */}
        {activeTab === 'dashboard' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Toolbar: Date Range + Export */}
            <div className="flex flex-col sm:flex-row gap-3 mb-8">
               <div className={`flex-1 flex items-center p-1.5 rounded-2xl border transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <div className="w-8 h-8 flex items-center justify-center text-slate-400"><i className="fa-regular fa-calendar"></i></div>
                  <input 
                    type="date" 
                    value={dashStartDate} 
                    onChange={(e) => setDashStartDate(e.target.value)} 
                    className={`flex-1 bg-transparent outline-none text-sm font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}
                  />
                  <div className="px-2 text-slate-300"><i className="fa-solid fa-arrow-right text-xs"></i></div>
                  <input 
                    type="date" 
                    value={dashEndDate} 
                    onChange={(e) => setDashEndDate(e.target.value)} 
                    className={`flex-1 bg-transparent outline-none text-sm font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}
                  />
               </div>
               <button 
                  onClick={() => {
                    setExportType('custom');
                    setCustomExportStart(dashStartDate);
                    setCustomExportEnd(dashEndDate);
                    setShowExportModal(true);
                  }}
                  className={`px-5 py-3 sm:py-0 rounded-2xl font-bold text-sm border transition-colors flex items-center justify-center gap-2 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm'}`}
               >
                 <i className="fa-solid fa-file-export"></i> Xuất
               </button>
            </div>

            <StatsCards summary={summary} monthlyBudget={monthlyBudget} setMonthlyBudget={setMonthlyBudget} isDarkMode={isDarkMode} />
            <Charts entries={entries.filter(e => e.date >= dashStartDate && e.date <= dashEndDate)} isDarkMode={isDarkMode} />
          </div>
        )}

        {/* ... (Other tabs remain largely same structure, just class tweaks handled by parent dark/light logic) ... */}
        {activeTab === 'history' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* History Toolbar */}
            <div className={`p-2 rounded-2xl border flex flex-col sm:flex-row gap-3 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
              
              {/* Toggle View */}
              <div className={`flex p-1 rounded-xl ${isDarkMode ? 'bg-slate-950' : 'bg-slate-100'}`}>
                <button onClick={() => setHistorySubTab('calendar')} className={`flex-1 sm:flex-none px-5 py-2 rounded-lg text-xs font-bold transition-all ${historySubTab === 'calendar' ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-800 dark:text-blue-400' : 'text-slate-500'}`}>
                  Lịch
                </button>
                <button onClick={() => setHistorySubTab('list')} className={`flex-1 sm:flex-none px-5 py-2 rounded-lg text-xs font-bold transition-all ${historySubTab === 'list' ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-800 dark:text-blue-400' : 'text-slate-500'}`}>
                  Chi tiết
                </button>
              </div>

              {/* Filters */}
              {historySubTab === 'list' && (
                <div className="flex flex-1 gap-2">
                   <select 
                      value={listFilterMonth} 
                      onChange={(e) => setListFilterMonth(Number(e.target.value))}
                      className={`flex-1 px-3 py-2 rounded-xl outline-none text-sm font-medium border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`}
                    >
                      {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>Tháng {i+1}</option>)}
                    </select>
                    <select 
                      value={listFilterYear} 
                      onChange={(e) => setListFilterYear(Number(e.target.value))}
                      className={`flex-1 px-3 py-2 rounded-xl outline-none text-sm font-medium border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`}
                    >
                      {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
              )}

              {/* Export Button */}
              <button onClick={() => { setExportType('month'); setShowExportModal(true); }} className={`sm:ml-auto px-4 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all ${isDarkMode ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-50'}`}>
                <i className="fa-solid fa-file-excel text-green-600"></i> Xuất Excel
              </button>
            </div>

            {historySubTab === 'calendar' ? (
              <CalendarView entries={entries} currentDate={viewDate} setCurrentDate={setViewDate} isDarkMode={isDarkMode} />
            ) : (
              <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                 <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className={`text-[10px] font-bold uppercase tracking-widest border-b ${isDarkMode ? 'bg-slate-800/50 text-slate-500 border-slate-800' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                      <tr>
                        <th className="px-5 py-4 whitespace-nowrap">Ngày</th>
                        <th className="px-5 py-4">Mô tả</th>
                        <th className="px-5 py-4 text-right">Số tiền</th>
                        <th className="px-5 py-4 text-center w-10"></th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                      {getFilteredListEntries().map(entry => (
                        <tr key={entry.id} className={`${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'} transition-colors`}>
                          <td className="px-5 py-4 text-sm whitespace-nowrap align-top text-slate-500 font-medium">{entry.date.split('-').reverse().slice(0, 2).join('/')}</td>
                          <td className="px-5 py-4 align-top">
                            <div className={`text-sm font-semibold mb-1.5 ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{entry.description}</div>
                            <span className={`text-[10px] px-2 py-0.5 rounded-md border uppercase font-bold tracking-wide
                              ${entry.type === 'income' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 
                                entry.type === 'saving' ? 'bg-purple-500/10 text-purple-600 border-purple-500/20' : 
                                entry.type === 'investment' ? 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' : 
                                'bg-slate-500/10 text-slate-500 border-slate-500/20'}`}>{entry.category}</span>
                          </td>
                          <td className={`px-5 py-4 text-sm font-bold text-right align-top ${entry.type === 'income' ? 'text-emerald-600' : (isDarkMode ? 'text-slate-200' : 'text-slate-900')}`}>
                            {entry.type === 'income' ? '+' : '-'}{formatCurrency(entry.amount).replace('₫', '')}
                          </td>
                          <td className="px-5 py-4 text-center align-top">
                            <button onClick={() => { setDeleteConfirm({show: true, type: 'single', id: entry.id}) }} className="text-slate-300 hover:text-red-500 transition-colors p-1"><i className="fa-solid fa-trash-can"></i></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* === SUMMARY TAB === */}
        {activeTab === 'summary' && (
          <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <h2 className="text-lg font-bold flex items-center gap-2 text-slate-500 uppercase tracking-wider text-xs">
              <i className="fa-solid fa-clock-rotate-left"></i> Báo cáo theo tháng
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {getMonthlyReport().map(([month, data]) => (
                <div key={month} className={`relative overflow-hidden p-6 rounded-3xl border transition-all hover:-translate-y-1 hover:shadow-lg duration-300 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-[0_4px_20px_rgb(0,0,0,0.03)]'}`}>
                  <div className="flex justify-between items-start mb-6 relative z-10">
                    <div>
                      <h3 className="font-bold text-xl">T{month.split('-')[1]} <span className="text-sm font-normal text-slate-400">/{month.split('-')[0]}</span></h3>
                    </div>
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${data.income >= (data.expense + data.saving + data.investment) ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-red-500/10 text-red-600 border-red-500/20'}`}>
                      {data.income >= (data.expense + data.saving + data.investment) ? 'DƯ' : 'THÂM'}
                    </span>
                  </div>
                  
                  <div className="space-y-3 relative z-10">
                    <div className="flex justify-between text-xs items-center">
                      <span className="text-slate-500 font-medium">Thu nhập</span>
                      <span className="font-bold text-emerald-600 text-sm">+{formatCurrency(data.income)}</span>
                    </div>
                    <div className="flex justify-between text-xs items-center">
                      <span className="text-slate-500 font-medium">Chi tiêu</span>
                      <span className="font-bold text-red-600 text-sm">-{formatCurrency(data.expense)}</span>
                    </div>
                    <div className="flex justify-between text-xs items-center">
                       <span className="text-slate-500 font-medium">Tích lũy</span>
                       <span className="font-bold text-purple-600 text-sm">{formatCurrency(data.saving + data.investment)}</span>
                    </div>
                    <div className={`mt-4 pt-4 border-t flex justify-between font-bold text-base ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                      <span>Ròng:</span>
                      <span className={data.income - (data.expense + data.saving + data.investment) >= 0 ? 'text-blue-500' : 'text-red-500'}>
                        {formatCurrency(data.income - (data.expense + data.saving + data.investment))}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* === SETTINGS TAB === */}
        {activeTab === 'settings' && (
           <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
            
            {/* 1. ĐỒNG BỘ NHANH (Copy/Paste) - PRIMARY */}
            <div className={`p-6 rounded-3xl border relative overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
              <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
              <div className="flex items-center gap-4 mb-5">
                 <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl"><i className="fa-solid fa-arrows-rotate"></i></div>
                 <div>
                   <h3 className="font-bold text-lg">Đồng bộ nhanh</h3>
                   <p className="text-xs text-slate-500">Chuyển dữ liệu giữa điện thoại & máy tính dễ dàng</p>
                 </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                 <button 
                    onClick={() => handleOpenTextBackup('export')} 
                    className={`p-4 rounded-2xl border text-left transition-all group ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-slate-50 border-slate-200 hover:bg-blue-50 hover:border-blue-200'}`}
                 >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm group-hover:scale-110 transition-transform"><i className="fa-regular fa-copy"></i></div>
                      <span className="font-bold text-sm">Copy dữ liệu đi</span>
                    </div>
                    <p className="text-[10px] text-slate-500 pl-11">Lấy mã dữ liệu để gửi sang máy khác</p>
                 </button>

                 <button 
                    onClick={() => handleOpenTextBackup('import')} 
                    className={`p-4 rounded-2xl border text-left transition-all group ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-slate-50 border-slate-200 hover:bg-emerald-50 hover:border-emerald-200'}`}
                 >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-sm group-hover:scale-110 transition-transform"><i className="fa-regular fa-paste"></i></div>
                      <span className="font-bold text-sm">Dán dữ liệu vào</span>
                    </div>
                    <p className="text-[10px] text-slate-500 pl-11">Nhập mã dữ liệu từ máy khác vào đây</p>
                 </button>
              </div>
            </div>

            {/* 2. SAO LƯU FILE (SECONDARY) */}
            <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
              <div className="flex items-center gap-4 mb-4">
                 <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center text-lg"><i className="fa-solid fa-file-arrow-down"></i></div>
                 <div>
                   <h3 className="font-bold text-base">Sao lưu File (Nâng cao)</h3>
                   <p className="text-xs text-slate-500">Lưu trữ dữ liệu dạng tập tin .json</p>
                 </div>
              </div>
              
              <div className="flex gap-3">
                 <button onClick={handleBackup} className={`flex-1 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all ${isDarkMode ? 'bg-transparent border-slate-700 hover:bg-slate-800' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                    <i className="fa-solid fa-download"></i> Tải file về
                 </button>
                 <button onClick={() => fileInputRef.current?.click()} className={`flex-1 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all ${isDarkMode ? 'bg-transparent border-slate-700 hover:bg-slate-800' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                    <i className="fa-solid fa-upload"></i> Đọc file lên
                 </button>
                 <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleRestore} />
              </div>
            </div>

            {/* 3. DANGER ZONE */}
            <div className={`p-6 rounded-3xl border border-red-100 ${isDarkMode ? 'bg-slate-900 border-red-900/20' : 'bg-red-50/50'}`}>
               <h3 className="font-bold text-red-600 mb-2 flex items-center gap-2"><i className="fa-solid fa-triangle-exclamation"></i> Vùng nguy hiểm</h3>
               <p className="text-xs text-slate-500 mb-4">Hành động này sẽ xóa toàn bộ dữ liệu trên thiết bị này và không thể khôi phục.</p>
               <button onClick={() => { if(confirm('Xóa toàn bộ dữ liệu? Hành động này không thể hoàn tác!')) setEntries([]) }} className="w-full py-3 bg-white border border-red-200 text-red-600 rounded-xl font-bold hover:bg-red-50 transition-colors shadow-sm">
                 Xóa sạch dữ liệu
               </button>
            </div>
          </section>
        )}
      </main>

      {/* --- MODALS --- */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className={`${isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'} rounded-3xl shadow-2xl w-full max-w-xs p-6 animate-in zoom-in-95 duration-200`}>
             {/* ... Same delete modal structure ... */}
             <div className="text-center">
              <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl"><i className="fa-solid fa-trash"></i></div>
              <h3 className="text-lg font-bold mb-2">Xác nhận xóa?</h3>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setDeleteConfirm({ show: false, type: 'single' })} className="flex-1 py-3 font-bold rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400">Hủy</button>
                <button onClick={confirmDelete} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg hover:bg-red-700">Xóa</button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {showExportModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className={`${isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'} rounded-3xl shadow-2xl w-full max-w-sm p-6`}>
             {/* ... Same export modal logic, simplified classes ... */}
             <div className="flex justify-between items-center mb-6">
               <h3 className="text-lg font-bold">Xuất báo cáo Excel</h3>
               <button onClick={() => setShowExportModal(false)} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500"><i className="fa-solid fa-xmark"></i></button>
            </div>
            
            <div className={`${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'} p-1.5 rounded-2xl mb-6 grid grid-cols-3 gap-1`}>
              {['month', 'year', 'custom'].map((type) => (
                <button 
                  key={type}
                  onClick={() => setExportType(type as any)} 
                  className={`py-2.5 rounded-xl text-xs font-bold capitalize transition-all ${exportType === type ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-400'}`}
                >
                  {type === 'month' ? 'Tháng' : type === 'year' ? 'Năm' : 'Tùy chọn'}
                </button>
              ))}
            </div>
            
            <div className="mb-8 space-y-4">
              {exportType === 'month' && (
                 <div className="flex gap-3">
                  <select value={selectedExportMonth} onChange={(e) => setSelectedExportMonth(Number(e.target.value))} className={`flex-1 px-4 py-3.5 border rounded-2xl outline-none font-bold text-sm ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                    {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>Tháng {i+1}</option>)}
                  </select>
                  <select value={selectedExportYear} onChange={(e) => setSelectedExportYear(Number(e.target.value))} className={`flex-1 px-4 py-3.5 border rounded-2xl outline-none font-bold text-sm ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                    {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                 </div>
              )}
              {exportType === 'year' && (
                <select value={selectedExportYear} onChange={(e) => setSelectedExportYear(Number(e.target.value))} className={`w-full px-4 py-3.5 border rounded-2xl outline-none font-bold text-sm ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                  {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>Năm {y}</option>)}
                </select>
              )}
              {exportType === 'custom' && (
                 <div className="space-y-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-slate-500 uppercase">Từ ngày</span>
                      <input type="date" value={customExportStart} onChange={(e) => setCustomExportStart(e.target.value)} className={`w-full px-3 py-3 border rounded-xl outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-slate-500 uppercase">Đến ngày</span>
                      <input type="date" value={customExportEnd} onChange={(e) => setCustomExportEnd(e.target.value)} className={`w-full px-3 py-3 border rounded-xl outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`} />
                    </div>
                 </div>
              )}
            </div>

            <button onClick={handleExecuteExport} className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
              <i className="fa-solid fa-download"></i> Tải về Excel
            </button>
          </div>
        </div>
      )}

      {/* --- TEXT BACKUP MODAL --- */}
      {showTextBackupModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className={`${isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'} rounded-3xl shadow-2xl w-full max-w-sm p-6 flex flex-col h-[500px]`}>
            <div className="flex justify-between items-center mb-4">
               <h3 className="text-lg font-bold flex items-center gap-2">
                 {textBackupMode === 'export' ? <i className="fa-solid fa-copy text-blue-500"></i> : <i className="fa-solid fa-paste text-emerald-500"></i>}
                 {textBackupMode === 'export' ? 'Copy dữ liệu đi' : 'Dán dữ liệu vào'}
               </h3>
               <button onClick={() => setShowTextBackupModal(false)} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500"><i className="fa-solid fa-xmark"></i></button>
            </div>
            
            <p className="text-xs text-slate-500 mb-2">
              {textBackupMode === 'export' 
                ? 'Copy toàn bộ đoạn mã bên dưới rồi gửi qua Zalo/Mess cho chính mình.' 
                : 'Dán đoạn mã bạn đã copy từ máy kia vào ô bên dưới.'}
            </p>

            <textarea 
              value={textBackupValue}
              onChange={(e) => setTextBackupValue(e.target.value)}
              readOnly={textBackupMode === 'export'}
              className={`flex-1 w-full p-4 rounded-2xl text-[10px] font-mono mb-4 resize-none outline-none border focus:ring-2 focus:ring-blue-500/50 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
              placeholder={textBackupMode === 'import' ? 'Ví dụ: [{"id":"123","amount":50000...}]' : ''}
            ></textarea>

            {textBackupMode === 'export' ? (
              <button onClick={handleCopyText} className={`w-full py-4 font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 ${copyStatus === 'Đã chép!' ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                <i className={`fa-solid ${copyStatus === 'Đã chép!' ? 'fa-check' : 'fa-copy'}`}></i> {copyStatus}
              </button>
            ) : (
              <button onClick={handleExecuteTextRestore} className="w-full py-4 bg-emerald-600 text-white font-bold rounded-2xl shadow-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
                <i className="fa-solid fa-file-import"></i> Khôi phục ngay
              </button>
            )}
          </div>
        </div>
      )}

      {/* --- NAVIGATION (Vietnamese) --- */}
      <nav className={`fixed bottom-0 left-0 right-0 border-t pb-safe pt-2 px-6 flex justify-between items-center z-50 transition-colors duration-300 ${isDarkMode ? 'bg-slate-950/90 border-slate-800 backdrop-blur-md' : 'bg-white/90 border-slate-200 backdrop-blur-md'}`}>
        {[
          { id: 'dashboard', icon: 'fa-house', label: 'Trang chủ' },
          { id: 'history', icon: 'fa-layer-group', label: 'Lịch sử' },
          { id: 'summary', icon: 'fa-chart-pie', label: 'Báo cáo' },
          { id: 'settings', icon: 'fa-sliders', label: 'Cài đặt' },
        ].map((item) => (
          <button 
            key={item.id}
            onClick={() => setActiveTab(item.id as any)} 
            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-300 ${activeTab === item.id ? 'text-blue-600 -translate-y-1' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <i className={`fa-solid ${item.icon} text-xl ${activeTab === item.id ? 'drop-shadow-md' : ''}`}></i>
            <span className={`text-[10px] font-bold ${activeTab === item.id ? 'opacity-100' : 'opacity-0 scale-0 hidden'}`}>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default App;
