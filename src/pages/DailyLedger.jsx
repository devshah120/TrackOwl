import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Filter, ChevronDown, LayoutDashboard, Calendar, Truck, Settings, LogOut, Menu, X, Bell, TrendingUp, TrendingDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AiOutlineFullscreen, AiOutlineFullscreenExit } from 'react-icons/ai';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Topbar } from '../components/Topbar';
import { ledger } from '../services/api';

export function DailyLedger() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [activeView, setActiveView] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [filterType, setFilterType] = useState('month');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.log('Fullscreen request failed:', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };


  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'trips', label: 'Trips & Documents', icon: Calendar },
    { id: 'ledger', label: 'Daily Ledger', icon: Calendar },
    { id: 'fleet', label: 'Fleet & Drivers', icon: Truck },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleMenuClick = (itemId) => {
    if (itemId === 'dashboard') {
      navigate('/dashboard/dashboard');
    } else if (itemId === 'trips') {
      navigate('/trips-and-documents');
    } else if (itemId === 'ledger') {
      navigate('/daily-ledger');
    } else if (itemId === 'fleet') {
      navigate('/fleet-and-drivers');
    } else if (itemId === 'settings') {
      navigate('/settings');
    }
  };

  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await ledger.list();
        if (!cancelled) setLedgerEntries(res.entries);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load ledger entries');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const getDateRange = () => {
    const today = new Date();
    let start, end;

    switch (filterType) {
      case 'month':
        start = new Date(selectedMonth + '-01');
        end = new Date(new Date(start).setMonth(start.getMonth() + 1));
        end.setDate(0);
        break;
      case 'lastweek':
        end = new Date(today);
        start = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'custom':
        start = fromDate ? new Date(fromDate) : new Date(0);
        end = toDate ? new Date(toDate) : today;
        break;
      default:
        start = new Date(0);
        end = today;
    }

    return { start, end };
  };

  const { start: rangeStart, end: rangeEnd } = getDateRange();

  const filteredEntries = ledgerEntries.filter((entry) => {
    const matchesSearch =
      entry.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.category.toLowerCase().includes(searchQuery.toLowerCase());

    const entryDate = new Date(entry.date);
    const dateMatch = entryDate >= rangeStart && entryDate <= rangeEnd;

    if (activeView === 'all') return matchesSearch && dateMatch;
    if (activeView === 'income') return matchesSearch && dateMatch && entry.type === 'income';
    if (activeView === 'expense') return matchesSearch && dateMatch && entry.type === 'expense';
    return matchesSearch && dateMatch;
  });

  const calculateStats = () => {
    const filteredForStats = ledgerEntries.filter(e => {
      const entryDate = new Date(e.date);
      return entryDate >= rangeStart && entryDate <= rangeEnd;
    });
    const income = filteredForStats
      .filter(e => e.type === 'income')
      .reduce((sum, e) => sum + e.amount, 0);
    const expenses = filteredForStats
      .filter(e => e.type === 'expense')
      .reduce((sum, e) => sum + e.amount, 0);
    const collected = income;
    const netProfit = income - expenses;

    return { income, expenses, collected, netProfit };
  };

  const stats = calculateStats();

  const getChartData = () => {
    const filteredForStats = ledgerEntries.filter(e => {
      const entryDate = new Date(e.date);
      return entryDate >= rangeStart && entryDate <= rangeEnd;
    });

    // Daily income/expense chart data
    const dailyData = {};
    filteredForStats.forEach(entry => {
      const day = String(entry.date).slice(0, 10);
      if (!dailyData[day]) {
        dailyData[day] = { date: day, income: 0, expense: 0 };
      }
      if (entry.type === 'income') {
        dailyData[day].income += entry.amount;
      } else {
        dailyData[day].expense += entry.amount;
      }
    });

    const dailyChartData = Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));

    // Category breakdown data
    const categoryData = {};
    filteredForStats.forEach(entry => {
      if (!categoryData[entry.category]) {
        categoryData[entry.category] = { name: entry.category, value: 0 };
      }
      categoryData[entry.category].value += entry.amount;
    });

    const categoryChartData = Object.values(categoryData);

    return { dailyChartData, categoryChartData };
  };

  const { dailyChartData, categoryChartData } = getChartData();

  const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const getTypeColor = (type) => {
    return type === 'income' ? 'text-green-600' : 'text-red-600';
  };

  const getTypeSign = (type) => {
    return type === 'income' ? '+' : '−';
  };

  const handleDeleteEntry = async (id) => {
    try {
      await ledger.remove(id);
      setLedgerEntries((prev) => prev.filter((entry) => (entry._id || entry.id) !== id));
    } catch (err) {
      setError(err.message || 'Failed to delete entry');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <Topbar />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 w-full space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Daily Ledger</h1>
              <p className="text-slate-600 mt-1">Track your income, expenses, and profits</p>
            </div>
            <button
              onClick={() => navigate('/add-ledger-entry')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Entry
            </button>
          </div>

          {/* Enhanced Date Filter */}
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <label className="block text-sm font-medium text-slate-700 mb-3">Filter by Date</label>

            {/* Filter Type Dropdown */}
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-3">
              <div>
                <label className="block text-sm text-slate-600 mb-2">Select Filter Type:</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="month">By Month</option>
                  <option value="lastweek">Last Week</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>

              {/* Filter-specific Input */}
              {filterType === 'month' && (
                <div>
                  <label className="block text-sm text-slate-600 mb-2">Select Month:</label>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {filterType === 'custom' && (
                <>
                  <div>
                    <label className="block text-sm text-slate-600 mb-2">From Date:</label>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="hidden md:block text-slate-500">To</div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-2">To Date:</label>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

              {filterType === 'lastweek' && (
                <div className="text-sm text-slate-600">
                Showing entries from the last 7 days
                </div>
              )}
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Monthly Freight Total */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Monthly Freight Total</p>
                  <p className="text-2xl font-bold text-slate-900 mt-2">₹{stats.income.toLocaleString()}</p>
                  <p className="text-xs text-slate-500 mt-1">All trips billed that month</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-600" />
              </div>
            </div>

            {/* Monthly Collected */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Monthly Collected</p>
                  <p className="text-2xl font-bold text-slate-900 mt-2">₹{stats.collected.toLocaleString()}</p>
                  <p className="text-xs text-slate-500 mt-1">Payments received</p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-600" />
              </div>
            </div>

            {/* Monthly Expenses */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Monthly Expenses</p>
                  <p className="text-2xl font-bold text-slate-900 mt-2">₹{stats.expenses.toLocaleString()}</p>
                  <p className="text-xs text-slate-500 mt-1">All costs that month</p>
                </div>
                <TrendingDown className="w-8 h-8 text-red-600" />
              </div>
            </div>

            {/* Net Profit / Loss */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Net Profit / Loss</p>
                  <p className={`text-2xl font-bold mt-2 ${stats.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ₹{Math.abs(stats.netProfit).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Monthly bottom line</p>
                </div>
                {stats.netProfit >= 0 ? (
                  <TrendingUp className="w-8 h-8 text-green-600" />
                ) : (
                  <TrendingDown className="w-8 h-8 text-red-600" />
                )}
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Income vs Expenses Chart */}
            <div className="bg-gradient-to-br from-white to-slate-50 rounded-lg border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-slate-900">Daily Income vs Expenses</h2>
                <p className="text-sm text-slate-500 mt-1">Income and expense comparison</p>
              </div>
              {dailyChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={dailyChartData} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      tick={{ fill: '#64748b', fontSize: 12 }}
                    />
                    <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                    <Tooltip
                      formatter={(value) => `₹${value.toLocaleString()}`}
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                    <Legend
                      wrapperStyle={{ paddingTop: '20px' }}
                      iconType="square"
                    />
                    <Bar dataKey="income" fill="#10b981" name="Income" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="expense" fill="#ef4444" name="Expense" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center py-20">
                  <p className="text-slate-500">No data available</p>
                </div>
              )}
            </div>

            {/* Category Breakdown Pie Chart */}
            <div className="bg-gradient-to-br from-white to-slate-50 rounded-lg border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-slate-900">Category Breakdown</h2>
                <p className="text-sm text-slate-500 mt-1">Distribution by category</p>
              </div>
              {categoryChartData.length > 0 ? (
                <div className="flex flex-col gap-4">
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={categoryChartData}
                        cx="35%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={75}
                        innerRadius={35}
                        fill="#8884d8"
                        dataKey="value"
                        paddingAngle={2}
                      >
                        {categoryChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => `₹${value.toLocaleString()}`}
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 gap-2">
                    {categoryChartData.map((entry, index) => (
                      <div key={entry.name} className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-sm text-slate-700">
                          {entry.name}: <span className="font-semibold">₹{(entry.value / 1000).toFixed(1)}k</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center py-20">
                  <p className="text-slate-500">No data available</p>
                </div>
              )}
            </div>

          </div>

          {/* View Tabs and Search */}
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveView('all')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeView === 'all'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  All Entries View
                </button>
                <button
                  onClick={() => setActiveView('income')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeView === 'income'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Income Only View
                </button>
                <button
                  onClick={() => setActiveView('expense')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeView === 'expense'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Expense Only View
                </button>
              </div>
              <div className="flex-1 md:flex-initial relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search entries..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-12 text-slate-500">Loading ledger entries...</div>
          ) : (
          <>
          {/* Entries Table */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Date</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Type</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Category</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Description</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Payment Method</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Amount</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredEntries.map((entry) => {
                    const entryId = entry._id || entry.id;
                    return (
                    <tr key={entryId} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-700">{String(entry.date).slice(0, 10)}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`font-medium ${getTypeColor(entry.type)}`}>
                          {entry.type === 'income' ? 'Income' : 'Expense'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">{entry.category}</td>
                      <td className="px-6 py-4 text-sm text-slate-700">{entry.description}</td>
                      <td className="px-6 py-4 text-sm text-slate-700">{entry.paymentMethod}</td>
                      <td className="px-6 py-4 text-sm font-semibold">
                        <span className={getTypeColor(entry.type)}>
                          {getTypeSign(entry.type)}₹{entry.amount.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => navigate(`/add-ledger-entry/${entryId}`)}
                            className="p-2 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteEntry(entryId)}
                            className="p-2 hover:bg-red-50 text-red-600 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {filteredEntries.length === 0 && (
            <div className="text-center py-12">
              <p className="text-slate-500">No entries found for the selected filters.</p>
            </div>
          )}
          </>
          )}
        </div>
      </main>

    </div>
  );
}
