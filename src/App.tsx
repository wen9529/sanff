import React, { useState, useEffect, useMemo } from 'react';
import {
  Terminal,
  Cpu,
  MessageSquare,
  Send,
  FileCode,
  BookOpen,
  Settings,
  Copy,
  Check,
  RefreshCw,
  Download,
  HelpCircle,
  Info,
  Lock,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Zap,
  BarChart3,
  Award,
  Clock,
  Trash2,
  PlusCircle,
  ListFilter,
  CheckCircle,
  Share2,
  TrendingUp,
  TrendingDown,
  Layers,
  Activity,
  Globe
} from 'lucide-react';
import {
  generateMockHistory,
  runStatisticalPrediction,
  calculateProfitLossStats,
  generateTelegramPost,
  formatNum,
  getBallColor,
  RED_WAVE,
  BLUE_WAVE,
  GREEN_WAVE,
  MockDrawRecord,
  StatisticalSummary,
  ProfitLossSummary
} from './utils/predictor';
import { pythonBotCode, defaultJsonConfig, termuxStartScript } from './utils/pythonCode';

export default function App() {
  // Navigation Tabs: 'simulator' | 'code' | 'guide'
  const [activeTab, setActiveTab] = useState<'simulator' | 'code' | 'guide'>('simulator');
  
  // Customization State
  const [mockHistory, setMockHistory] = useState<MockDrawRecord[]>([]);
  const [stats, setStats] = useState<StatisticalSummary | null>(null);
  
  // Real Macau Lottery API sync state
  const [isFetchingReal, setIsFetchingReal] = useState(false);
  const [realDataSuccess, setRealDataSuccess] = useState('');
  const [realDataError, setRealDataError] = useState('');
  const [isRealDataSource, setIsRealDataSource] = useState(false);
  const [autoSyncReal, setAutoSyncReal] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [showHistoryDetail, setShowHistoryDetail] = useState(false);

  // Real Telegram Test state
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  
  // Sending status
  const [sendStatus, setSendStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [sendError, setSendError] = useState('');
  const [sendSuccessMsg, setSendSuccessMsg] = useState('');
  
  // Copied indices for UX feedback
  const [copiedStatus, setCopiedStatus] = useState<{ [key: string]: boolean }>({});

  // Generate initial mock 80 draw history on mount
  useEffect(() => {
    const history = generateMockHistory();
    setMockHistory(history);
  }, []);

  // Recalculate stats whenever mockHistory updates
  useEffect(() => {
    if (mockHistory.length > 0) {
      const calculatedStats = runStatisticalPrediction(mockHistory);
      setStats(calculatedStats);
    } else {
      setStats(null);
    }
  }, [mockHistory]);

  // Compute profit and loss statistics across all available verification history
  const plSummary = useMemo<ProfitLossSummary | null>(() => {
    return calculateProfitLossStats(mockHistory, 30);
  }, [mockHistory]);

  // Fetch real lottery history from Macau official API
  const handleFetchRealData = async () => {
    setIsFetchingReal(true);
    setRealDataError('');
    setRealDataSuccess('');
    try {
      const response = await fetch('/api/lottery/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageSize: 100, pageNum: 1 })
      });
      const res = await response.json();
      if (!response.ok || !res.success) {
        throw new Error(res.error || '获取真实开奖数据失败');
      }

      let rawList: any[] = [];
      const dataObj = res.data;
      if (Array.isArray(dataObj)) {
        rawList = dataObj;
      } else if (dataObj?.data?.list && Array.isArray(dataObj.data.list)) {
        rawList = dataObj.data.list;
      } else if (dataObj?.data?.rows && Array.isArray(dataObj.data.rows)) {
        rawList = dataObj.data.rows;
      } else if (dataObj?.data && Array.isArray(dataObj.data)) {
        rawList = dataObj.data;
      } else if (dataObj?.list && Array.isArray(dataObj.list)) {
        rawList = dataObj.list;
      } else if (dataObj?.rows && Array.isArray(dataObj.rows)) {
        rawList = dataObj.rows;
      } else if (dataObj?.records && Array.isArray(dataObj.records)) {
        rawList = dataObj.records;
      }

      if (!rawList || rawList.length === 0) {
        throw new Error('接口未返回有效的开奖列表数据');
      }

      const parsed: MockDrawRecord[] = [];
      for (const item of rawList) {
        const expect = String(item.expect || item.period || '');
        const openCode = String(item.openCode || item.open_code || '');
        if (!expect || !openCode) continue;

        const balls = openCode.split(',').map((x: string) => parseInt(x.trim())).filter((x: number) => !isNaN(x));
        if (balls.length < 7) continue;

        const specialNum = balls[6];
        parsed.push({
          expect,
          openCode,
          specialNumber: {
            number: specialNum,
            color: getBallColor(specialNum),
            zodiac: '吉',
            fiveElements: '金'
          },
          isBig: specialNum >= 25 && specialNum !== 49,
          isOdd: specialNum % 2 !== 0
        });
      }

      if (parsed.length === 0) {
        throw new Error('解析开奖号码失败，请检查格式');
      }

      // Sort by expect descending (newest first)
      parsed.sort((a, b) => {
        const na = parseInt(a.expect) || 0;
        const nb = parseInt(b.expect) || 0;
        return nb - na;
      });

      setMockHistory(parsed);
      setIsRealDataSource(true);
      const timeStr = new Date().toLocaleTimeString();
      setLastSyncTime(timeStr);
      setRealDataSuccess(`成功同步 ${parsed.length} 期澳门官方实盘数据！最新期号：第 ${parsed[0].expect} 期 (${timeStr})`);
    } catch (err: any) {
      setRealDataError(err.message || '网络请求错误');
    } finally {
      setIsFetchingReal(false);
    }
  };

  // Auto-sync timer for real data
  useEffect(() => {
    if (!autoSyncReal) return;
    handleFetchRealData();
    const timer = setInterval(() => {
      handleFetchRealData();
    }, 25000);
    return () => clearInterval(timer);
  }, [autoSyncReal]);

  // Simulate a new 3-minute draw event
  const handleSimulateNewDraw = () => {
    const nextExpect = stats ? parseInt(stats.nextExpect) : 20260717051;
    
    const ballsSet = new Set<number>();
    while (ballsSet.size < 7) {
      ballsSet.add(Math.floor(Math.random() * 49) + 1);
    }
    const balls = Array.from(ballsSet);
    const mainNumbersRaw = balls.slice(0, 6).sort((a, b) => a - b);
    const specialRaw = balls[6];
    
    const openCode = [...mainNumbersRaw, specialRaw].map(formatNum).join(',');
    
    const newDraw: MockDrawRecord = {
      expect: nextExpect.toString(),
      openCode,
      specialNumber: {
        number: specialRaw,
        color: getBallColor(specialRaw),
        zodiac: '吉', // simplified for mock
        fiveElements: '金' // simplified for mock
      },
      isBig: specialRaw >= 25 && specialRaw !== 49,
      isOdd: specialRaw % 2 !== 0
    };

    // Insert at front (newest first) and keep last 100 for robust backtest & verification
    setMockHistory(prev => {
      const updated = [newDraw, ...prev];
      return updated.slice(0, 100);
    });
  };

  // Clear all data to simulate midnight reset (00:00)
  const handleMidnightReset = () => {
    setMockHistory([]);
    setIsRealDataSource(false);
    setAutoSyncReal(false);
    setRealDataSuccess('');
    setRealDataError('');
  };

  // Fill up to 80 records again
  const handleRegenerateHistory = () => {
    const history = generateMockHistory();
    setMockHistory(history);
    setIsRealDataSource(false);
    setRealDataSuccess('');
    setRealDataError('');
  };

  // Live Telegram direct push test
  const handleSendTestMessage = async () => {
    if (!botToken || !chatId) {
      setSendStatus('error');
      setSendError('请先填写您的 Telegram Bot Token 和 目标 Chat ID！');
      return;
    }
    if (!stats || mockHistory.length < 50) {
      setSendStatus('error');
      setSendError('开奖记录收集未满 50 期，无法生成统计预测帖子。');
      return;
    }

    setSendStatus('loading');
    setSendError('');
    setSendSuccessMsg('');

    const formattedMsg = generateTelegramPost(stats, mockHistory);

    try {
      const response = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          botToken,
          chatId,
          message: formattedMsg,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSendStatus('success');
        setSendSuccessMsg(`✅ 成功向 ${chatId} 发送了一期开奖广播及统计预测！请前往 Telegram 客户端验证。`);
      } else {
        setSendStatus('error');
        setSendError(data.error || '发送失败，请核对 Token 和 Chat ID 是否有效，以及机器人是否已被拉入频道并赋予发布权限。');
      }
    } catch (err: any) {
      setSendStatus('error');
      setSendError(`请求失败: ${err.message}`);
    }
  };

  // Helper: Copy code to clipboard
  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStatus(prev => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setCopiedStatus(prev => ({ ...prev, [id]: false }));
    }, 2000);
  };

  // Helper: Trigger File Download
  const handleDownloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div id="root-layout" className="min-h-screen bg-[#0B0F19] text-slate-100 font-sans antialiased">
      {/* Top Header */}
      <header className="bg-[#111827] border-b border-slate-800 sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-yellow-500 to-amber-600 rounded-xl text-slate-950 shadow-lg shadow-amber-500/10">
              <Terminal className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">三分六合彩 Telegram 自动预测机器人</h1>
                <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20 font-mono font-medium">Termux Python后台版</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">每5秒自动拉取开奖，0点自动重置，集满50期均值回归分析，高精准大小单双波色预测</p>
            </div>
          </div>

          {/* Navigation Control */}
          <div className="flex items-center bg-[#1F2937] p-1 rounded-xl border border-slate-700/60 shadow-inner">
            <button
              onClick={() => setActiveTab('simulator')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'simulator'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              模型运行调试台
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'code'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              Python 脚本获取
            </button>
            <button
              onClick={() => setActiveTab('guide')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'guide'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              手机一键部署指南
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Architectural disclaimer */}
        <div className="mb-6 bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex gap-3.5 items-start">
          <div className="p-1.5 bg-yellow-500/10 text-yellow-400 rounded-lg shrink-0 mt-0.5">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="text-xs text-slate-300 leading-relaxed">
            <span className="font-bold text-yellow-400 text-sm block mb-1">🤖 无前端页面 • 高效低能耗部署方案</span>
            此工具是为 <strong>Android Termux 挂机环境</strong> 深度定制的纯 Python 预测系统。
            在 Termux 部署时，Python 脚本会在后台默默通过 <strong>API 进行无感知长轮询与自动推送</strong>，<strong>没有多余的网页文件和渲染损耗</strong>，极度省电且防崩溃。
            这里作为开发者可视化控制箱，向您直观演示 50 期大数据均值算法对“大小、单双、波色”概率趋势的选择过程。
          </div>
        </div>

        {/* Tab 1: Simulator */}
        {activeTab === 'simulator' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left side: Stats, parameters & tester */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              
              {/* Simulation Controller Panel */}
              <div className="bg-[#111827] rounded-xl border border-slate-800 p-5 shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4.5 h-4.5 text-amber-500" />
                    <h2 className="text-sm font-bold text-white">1. 数据源与开奖调试控制台</h2>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium flex items-center gap-1 ${
                    isRealDataSource
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    <span className="w-1.5 h-1.5 rounded-full animate-ping bg-current" />
                    {isRealDataSource ? '澳门官方实盘数据' : '本地仿真模拟数据'}
                  </span>
                </div>

                <div className="space-y-4">
                  {/* Real-data API Fetch Bar */}
                  <div className="bg-slate-950/80 border border-slate-800/80 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleFetchRealData}
                        disabled={isFetchingReal}
                        className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 disabled:bg-slate-700 text-slate-950 font-bold rounded text-xs flex items-center gap-1.5 transition-all shadow-md shadow-sky-500/10"
                        title="直连澳门六合彩官方接口拉取最近100期实盘历史"
                      >
                        <Globe className={`w-3.5 h-3.5 ${isFetchingReal ? 'animate-spin' : ''}`} />
                        {isFetchingReal ? '正在同步澳门实盘...' : '⚡ 同步澳门官方最新实盘'}
                      </button>

                      <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer select-none hover:text-slate-200">
                        <input
                          type="checkbox"
                          checked={autoSyncReal}
                          onChange={(e) => setAutoSyncReal(e.target.checked)}
                          className="rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500 w-3.5 h-3.5"
                        />
                        <span>25秒自动轮询</span>
                      </label>
                    </div>

                    {lastSyncTime && (
                      <span className="text-[10px] text-slate-500 font-mono">
                        同步于: {lastSyncTime}
                      </span>
                    )}
                  </div>

                  {realDataSuccess && (
                    <div className="text-[11px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-2 rounded-lg flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{realDataSuccess}</span>
                    </div>
                  )}

                  {realDataError && (
                    <div className="text-[11px] bg-rose-500/10 border border-rose-500/30 text-rose-400 px-3 py-2 rounded-lg flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{realDataError}</span>
                    </div>
                  )}

                  {/* Status indicator card */}
                  <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-lg flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-500 block">开奖缓存池期数</span>
                      <strong className="text-lg font-black text-white font-mono">
                        {mockHistory.length} <span className="text-xs font-normal text-slate-400">期</span>
                      </strong>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleSimulateNewDraw}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded text-xs flex items-center gap-1 transition-all"
                        title="产生第51期或更新的开奖号码"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        单期模拟
                      </button>

                      <button
                        onClick={handleRegenerateHistory}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded text-xs flex items-center gap-1 transition-all"
                        title="重置为80期模拟数据"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        重置80期
                      </button>

                      <button
                        onClick={handleMidnightReset}
                        className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded text-xs flex items-center gap-1 transition-all"
                        title="清零今日的所有开奖历史，测试空仓等开开奖逻辑"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        0点清零
                      </button>
                    </div>
                  </div>

                  {mockHistory.length < 50 ? (
                    <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                      <div className="flex gap-2 text-xs text-amber-400 font-bold mb-1">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>预测模型锁定中...</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-normal">
                        当前历史开奖数据仅有 <strong>{mockHistory.length}/50</strong> 期，不满足 50 期的规律统计算法起算条件。
                      </p>
                      <button
                        onClick={handleFetchRealData}
                        className="mt-3 w-full bg-sky-600 hover:bg-sky-500 text-white text-xs py-1.5 rounded font-semibold flex items-center justify-center gap-1.5"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        点击一键拉取澳门官方 100 期实盘解锁
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                        <CheckCircle className="w-4 h-4 shrink-0" />
                        <span>高精度 WMA 多因子模型运作中 (基线 50 期已满足)</span>
                      </div>
                      <span className="font-mono text-slate-400 text-[10px]">
                        可复盘实测: {Math.max(0, mockHistory.length - 50)} 期
                      </span>
                    </div>
                  )}

                  {/* Advanced Multi-Factor Decisive Indicators */}
                  {stats && (
                    <div className="space-y-3 bg-slate-950/40 p-4 rounded-lg border border-slate-800/80 text-[11px]">
                      <div className="text-xs font-bold text-slate-300 border-b border-slate-800/80 pb-1 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        <span>多因子决策模型指标 (对标 bot.py)</span>
                      </div>

                      {/* Big/Small indicators */}
                      <div>
                        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                          <span>大小决策因子得分</span>
                          <span className={`font-mono font-bold ${stats.predictedBigSmall === '大' ? 'text-amber-400' : 'text-sky-400'}`}>
                            当前首选: {stats.predictedBigSmall === '大' ? '🔥 大' : '❄️ 小'}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 text-center text-[9px]">
                          <div className="bg-slate-900 border border-slate-800 p-1.5 rounded">
                            <span className="text-slate-500 block">均值回归</span>
                            <span className="font-mono text-slate-300 font-bold">{stats.bs_mr > 0 ? `+${stats.bs_mr}` : stats.bs_mr}</span>
                          </div>
                          <div className="bg-slate-900 border border-slate-800 p-1.5 rounded">
                            <span className="text-slate-500 block">遗漏补偿</span>
                            <span className="font-mono text-slate-300 font-bold">{stats.bs_om > 0 ? `+${stats.bs_om}` : stats.bs_om}</span>
                          </div>
                          <div className="bg-slate-900 border border-slate-800 p-1.5 rounded">
                            <span className="text-slate-500 block">状态转移</span>
                            <span className="font-mono text-slate-300 font-bold">{stats.bs_tr > 0 ? `+${stats.bs_tr}` : stats.bs_tr}</span>
                          </div>
                        </div>
                      </div>

                      {/* Odd/Even indicators */}
                      <div>
                        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                          <span>单双决策因子得分</span>
                          <span className={`font-mono font-bold ${stats.predictedOddEven === '单' ? 'text-yellow-400' : 'text-purple-400'}`}>
                            当前首选: {stats.predictedOddEven === '单' ? '⚡ 单' : '🌙 双'}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 text-center text-[9px]">
                          <div className="bg-slate-900 border border-slate-800 p-1.5 rounded">
                            <span className="text-slate-500 block">均值回归</span>
                            <span className="font-mono text-slate-300 font-bold">{stats.oe_mr > 0 ? `+${stats.oe_mr}` : stats.oe_mr}</span>
                          </div>
                          <div className="bg-slate-900 border border-slate-800 p-1.5 rounded">
                            <span className="text-slate-500 block">遗漏补偿</span>
                            <span className="font-mono text-slate-300 font-bold">{stats.oe_om > 0 ? `+${stats.oe_om}` : stats.oe_om}</span>
                          </div>
                          <div className="bg-slate-900 border border-slate-800 p-1.5 rounded">
                            <span className="text-slate-500 block">状态转移</span>
                            <span className="font-mono text-slate-300 font-bold">{stats.oe_tr > 0 ? `+${stats.oe_tr}` : stats.oe_tr}</span>
                          </div>
                        </div>
                      </div>

                      {/* Color indicators */}
                      <div>
                        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                          <span>波色决策加权评分</span>
                          <span className="font-mono font-bold text-emerald-400">
                            当前首选: {stats.predictedColor}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 text-center text-[9px]">
                          <div className="bg-slate-900 border border-slate-800 p-1.5 rounded">
                            <span className="text-slate-500 block">🔴 红波评分</span>
                            <span className="font-mono text-rose-400 font-bold">{stats.col_red_score}</span>
                          </div>
                          <div className="bg-slate-900 border border-slate-800 p-1.5 rounded">
                            <span className="text-slate-500 block">🔵 蓝波评分</span>
                            <span className="font-mono text-sky-400 font-bold">{stats.col_blue_score}</span>
                          </div>
                          <div className="bg-slate-900 border border-slate-800 p-1.5 rounded">
                            <span className="text-slate-500 block">🟢 绿波评分</span>
                            <span className="font-mono text-emerald-400 font-bold">{stats.col_green_score}</span>
                          </div>
                        </div>
                      </div>

                    </div>
                  )}

                </div>
              </div>

              {/* 2. Real-time Profit/Loss and Accuracy Dashboard */}
              <div className="bg-[#111827] rounded-xl border border-slate-800 p-5 shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4.5 h-4.5 text-emerald-400" />
                    <h2 className="text-sm font-bold text-white">2. 实盘盈亏与胜率监控大盘</h2>
                  </div>
                  <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
                    实测样本: {plSummary ? `${plSummary.totalEvaluated} 期` : '等待中'}
                  </span>
                </div>

                {plSummary ? (
                  <div className="space-y-4">
                    {/* Top 4 Performance Cards */}
                    <div className="grid grid-cols-2 gap-2.5">
                      {/* Big/Small Card */}
                      <div className="bg-slate-950/70 border border-slate-800/90 p-3 rounded-lg">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-slate-400 font-semibold">🎯 大小盈亏</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {plSummary.bsWins}胜 {plSummary.bsLosses}负 {plSummary.bsTies}和
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between mt-1">
                          <span className="text-lg font-black font-mono text-white">
                            {plSummary.bsWinRate}%
                          </span>
                          <span className={`text-xs font-mono font-bold ${
                            plSummary.bsNetProfit > 0 ? 'text-emerald-400' : plSummary.bsNetProfit < 0 ? 'text-rose-400' : 'text-slate-400'
                          }`}>
                            {plSummary.bsNetProfit > 0 ? `+${plSummary.bsNetProfit}` : plSummary.bsNetProfit} 注
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1 flex justify-between">
                          <span>
                            {plSummary.currBsStreak > 0 ? `连中 ${plSummary.currBsStreak} 期` : plSummary.currBsStreak < 0 ? `连挂 ${Math.abs(plSummary.currBsStreak)} 期` : '持平'}
                          </span>
                          <span>最高 {plSummary.maxBsWinStreak} 连中</span>
                        </div>
                      </div>

                      {/* Odd/Even Card */}
                      <div className="bg-slate-950/70 border border-slate-800/90 p-3 rounded-lg">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-slate-400 font-semibold">⚡ 单双盈亏</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {plSummary.oeWins}胜 {plSummary.oeLosses}负
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between mt-1">
                          <span className="text-lg font-black font-mono text-white">
                            {plSummary.oeWinRate}%
                          </span>
                          <span className={`text-xs font-mono font-bold ${
                            plSummary.oeNetProfit > 0 ? 'text-emerald-400' : plSummary.oeNetProfit < 0 ? 'text-rose-400' : 'text-slate-400'
                          }`}>
                            {plSummary.oeNetProfit > 0 ? `+${plSummary.oeNetProfit}` : plSummary.oeNetProfit} 注
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1 flex justify-between">
                          <span>
                            {plSummary.currOeStreak > 0 ? `连中 ${plSummary.currOeStreak} 期` : plSummary.currOeStreak < 0 ? `连挂 ${Math.abs(plSummary.currOeStreak)} 期` : '持平'}
                          </span>
                          <span>最高 {plSummary.maxOeWinStreak} 连中</span>
                        </div>
                      </div>

                      {/* Color Wave Card */}
                      <div className="bg-slate-950/70 border border-slate-800/90 p-3 rounded-lg">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-slate-400 font-semibold">🌈 波色盈亏 (1:2.94)</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {plSummary.colWins}胜 {plSummary.colLosses}负
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between mt-1">
                          <span className="text-lg font-black font-mono text-white">
                            {plSummary.colWinRate}%
                          </span>
                          <span className={`text-xs font-mono font-bold ${
                            plSummary.colNetProfit > 0 ? 'text-emerald-400' : plSummary.colNetProfit < 0 ? 'text-rose-400' : 'text-slate-400'
                          }`}>
                            {plSummary.colNetProfit > 0 ? `+${plSummary.colNetProfit}` : plSummary.colNetProfit} 注
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1 flex justify-between">
                          <span>
                            {plSummary.currColStreak > 0 ? `连中 ${plSummary.currColStreak} 期` : plSummary.currColStreak < 0 ? `连挂 ${Math.abs(plSummary.currColStreak)} 期` : '持平'}
                          </span>
                          <span>最高 {plSummary.maxColWinStreak} 连中</span>
                        </div>
                      </div>

                      {/* Total Net Profit Card */}
                      <div className={`p-3 rounded-lg border ${
                        plSummary.totalNetProfit > 0
                          ? 'bg-emerald-500/10 border-emerald-500/30'
                          : plSummary.totalNetProfit < 0
                          ? 'bg-rose-500/10 border-rose-500/30'
                          : 'bg-slate-950/70 border-slate-800/90'
                      }`}>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-slate-300 font-semibold">💰 今日累计总净盈亏</span>
                          <span className="text-[9px] px-1 rounded font-bold font-mono text-slate-400">
                            {plSummary.totalNetProfit > 0 ? '🟢 盈利' : plSummary.totalNetProfit < 0 ? '🔴 回撤' : '⚪ 持平'}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between mt-1">
                          <span className={`text-xl font-black font-mono ${
                            plSummary.totalNetProfit > 0 ? 'text-emerald-400' : plSummary.totalNetProfit < 0 ? 'text-rose-400' : 'text-slate-200'
                          }`}>
                            {plSummary.totalNetProfit > 0 ? `+${plSummary.totalNetProfit}` : plSummary.totalNetProfit} <span className="text-xs font-normal">注</span>
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">大小+单双+波色</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          49和局退款零损耗 • 严格对标 bot.py
                        </div>
                      </div>
                    </div>

                    {/* Color Wave Health Distribution - proves balanced recommendation */}
                    {stats && (
                      <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800/70 text-[11px]">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5 text-sky-400" />
                            波色三色出球健康度与模型置信度
                          </span>
                          <span className="text-[10px] text-emerald-400 font-mono">
                            下期推荐: {stats.predictedColor}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                          <div className="bg-rose-500/10 border border-rose-500/20 p-2 rounded">
                            <span className="text-rose-400 font-bold block">🔴 红波</span>
                            <span className="text-slate-300 font-mono">{stats.redCount} 期 ({Math.round(stats.redCount / 50 * 100)}%)</span>
                            <div className="text-[9px] text-slate-500 mt-0.5">置信评分: {stats.col_red_score}</div>
                          </div>
                          <div className="bg-sky-500/10 border border-sky-500/20 p-2 rounded">
                            <span className="text-sky-400 font-bold block">🔵 蓝波</span>
                            <span className="text-slate-300 font-mono">{stats.blueCount} 期 ({Math.round(stats.blueCount / 50 * 100)}%)</span>
                            <div className="text-[9px] text-slate-500 mt-0.5">置信评分: {stats.col_blue_score}</div>
                          </div>
                          <div className="bg-emerald-500/10 border border-emerald-500/20 p-2 rounded">
                            <span className="text-emerald-400 font-bold block">🟢 绿波</span>
                            <span className="text-slate-300 font-mono">{stats.greenCount} 期 ({Math.round(stats.greenCount / 50 * 100)}%)</span>
                            <div className="text-[9px] text-slate-500 mt-0.5">置信评分: {stats.col_green_score}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Toggle and Detailed Verification Table */}
                    <div className="border-t border-slate-800/80 pt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400 font-semibold">逐期实盘预测对错与盈亏复盘</span>
                        <button
                          onClick={() => setShowHistoryDetail(!showHistoryDetail)}
                          className="text-xs text-sky-400 hover:text-sky-300 font-medium underline flex items-center gap-1"
                        >
                          {showHistoryDetail ? '收起明细表' : `展开最近 ${plSummary.recentList.length} 期明细`}
                        </button>
                      </div>

                      {showHistoryDetail && (
                        <div className="mt-3 overflow-y-auto max-h-56 scrollbar-thin border border-slate-800 rounded-lg">
                          <table className="w-full text-left text-[11px] font-mono">
                            <thead className="bg-[#1F2937]/70 text-slate-400 uppercase text-[9px] border-b border-slate-800 sticky top-0">
                              <tr>
                                <th className="px-2.5 py-1.5">期号</th>
                                <th className="px-2.5 py-1.5">特码</th>
                                <th className="px-2.5 py-1.5">大小(测/实)</th>
                                <th className="px-2.5 py-1.5">单双(测/实)</th>
                                <th className="px-2.5 py-1.5">波色(测/实)</th>
                                <th className="px-2.5 py-1.5 text-right">单期盈亏</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50 bg-slate-950/40">
                              {plSummary.recentList.map((row) => {
                                const periodProfit = (row.bs_profit + row.oe_profit + row.col_profit);
                                const roundProfit = Math.round(periodProfit * 100) / 100;
                                return (
                                  <tr key={row.expect} className="hover:bg-slate-800/30">
                                    <td className="px-2.5 py-1.5 text-slate-300 font-bold">{row.expect.slice(-3)}期</td>
                                    <td className="px-2.5 py-1.5">
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                        row.actual_color.includes('红') ? 'bg-rose-500/20 text-rose-400' :
                                        row.actual_color.includes('蓝') ? 'bg-sky-500/20 text-sky-400' :
                                        'bg-emerald-500/20 text-emerald-400'
                                      }`}>
                                        {formatNum(row.specialNum)}
                                      </span>
                                    </td>
                                    <td className="px-2.5 py-1.5">
                                      <span className={row.bs_correct ? 'text-emerald-400' : row.is_bs_tie ? 'text-slate-400' : 'text-rose-400'}>
                                        {row.pred_big_small}/{row.actual_big_small} {row.bs_status}
                                      </span>
                                    </td>
                                    <td className="px-2.5 py-1.5">
                                      <span className={row.oe_correct ? 'text-emerald-400' : 'text-rose-400'}>
                                        {row.pred_odd_even}/{row.actual_odd_even} {row.oe_status}
                                      </span>
                                    </td>
                                    <td className="px-2.5 py-1.5">
                                      <span className={row.color_correct ? 'text-emerald-400' : 'text-rose-400'}>
                                        {row.pred_color}/{row.actual_color} {row.col_status}
                                      </span>
                                    </td>
                                    <td className={`px-2.5 py-1.5 text-right font-bold ${
                                      roundProfit > 0 ? 'text-emerald-400' : roundProfit < 0 ? 'text-rose-400' : 'text-slate-400'
                                    }`}>
                                      {roundProfit > 0 ? `+${roundProfit}` : roundProfit}注
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                  </div>
                ) : (
                  <div className="text-center py-6 text-xs text-slate-500">
                    数据需累积满 51 期后方可自动开启逐期胜率与实盘盈亏统计。
                  </div>
                )}
              </div>

              {/* Bot Direct Sender Test Panel */}
              <div className="bg-[#111827] rounded-xl border border-slate-800 p-5 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Send className="w-4.5 h-4.5 text-sky-400 animate-pulse" />
                    <h2 className="text-sm font-bold text-white">3. Telegram 机器人官方接口测试</h2>
                  </div>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 font-medium">官方网关</span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">
                      Telegram Bot Token <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        value={botToken}
                        onChange={(e) => setBotToken(e.target.value)}
                        placeholder="7123456789:AAH_your_token_here"
                        className="w-full bg-slate-950/60 border border-slate-800 rounded-lg pl-3 pr-8 py-2 text-xs focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 font-mono"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <Lock className="h-3.5 w-3.5 text-slate-600" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">
                      目标 Chat ID (频道公网用户名 / 个人用户ID) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={chatId}
                      onChange={(e) => setChatId(e.target.value)}
                      placeholder="e.g. @my_marksix_predict_channel 或 12345678"
                      className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 font-mono"
                    />
                  </div>

                  {sendStatus !== 'idle' && (
                    <div className={`p-3 rounded-lg border text-xs ${
                      sendStatus === 'loading'
                        ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                        : sendStatus === 'success'
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                          : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                    }`}>
                      {sendStatus === 'loading' && (
                        <div className="flex items-center gap-2">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                          <span>正在发起安全代理，请求 Telegram 接口服务器...</span>
                        </div>
                      )}
                      {sendStatus === 'success' && (
                        <div>
                          <p className="font-bold mb-1">推送成功！</p>
                          <p className="text-[11px] leading-relaxed opacity-90">{sendSuccessMsg}</p>
                        </div>
                      )}
                      {sendStatus === 'error' && (
                        <div>
                          <p className="font-bold mb-1">⚠️ 发送失败：</p>
                          <p className="text-[11px] leading-relaxed opacity-90">{sendError}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    onClick={handleSendTestMessage}
                    disabled={sendStatus === 'loading'}
                    className="w-full mt-2 bg-sky-500 hover:bg-sky-600 disabled:bg-sky-500/40 text-slate-950 font-black py-2.5 px-4 rounded-lg text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-sky-500/10 active:scale-98"
                  >
                    <Send className="w-3.5 h-3.5 fill-current" />
                    🚀 向 Telegram 客户端发送当前统计预测测试
                  </button>
                  <p className="text-[10px] text-slate-500 text-center leading-normal">
                    * 我们已建立中转网关以兼容内网及外网，您可以放心在网页端测试。
                  </p>
                </div>
              </div>

            </div>

            {/* Right side: Telegram Simulated Chat Post preview & Live Draw lists */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              
              {/* Simulated Telegram Post Card */}
              <div className="bg-[#111827] rounded-xl border border-slate-800 shadow-xl overflow-hidden flex flex-col">
                <div className="bg-[#1F2937] px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-400 to-indigo-600 flex items-center justify-center font-bold text-xs text-white shadow-md">
                      澳
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-1">
                        澳门三分彩均值统计预测频道
                        <ShieldCheck className="w-3.5 h-3.5 text-sky-400 fill-current" />
                      </h4>
                      <p className="text-[10px] text-sky-400 font-medium">18,340 subscribers • 自动更新机器人</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (stats && mockHistory.length > 0) {
                        handleCopyText(generateTelegramPost(stats, mockHistory), 'post');
                      }
                    }}
                    className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 active:bg-slate-850 rounded text-[10px] text-slate-300 transition-all font-semibold"
                  >
                    {copiedStatus['post'] ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copiedStatus['post'] ? '已复制' : '复制帖子格式'}
                  </button>
                </div>

                <div className="bg-[#101726] p-4 font-mono text-sm overflow-y-auto max-h-[350px] leading-relaxed border-b border-slate-800 flex justify-center">
                  {stats && mockHistory.length >= 50 ? (
                    <div className="bg-[#17212F] rounded-xl border border-[#223348] p-6 text-slate-100 w-full max-w-sm shadow-md relative">
                      <div className="whitespace-pre-wrap select-text font-medium font-mono tracking-wider">
                        {generateTelegramPost(stats, mockHistory)}
                      </div>
                      <div className="text-[9px] text-slate-500 text-right mt-4 select-none">
                        刚刚 • 👁️ 1.2k
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-slate-500 py-12 flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="w-8 h-8 text-slate-600" />
                      <span>需要累积满 50 期数据方可显示完整自动预测文案。请点击左侧“新开一期”或“一键生成50期”</span>
                    </div>
                  )}
                </div>

                <div className="bg-[#1C2431] px-4 py-2.5 text-[10px] text-slate-400 flex items-center justify-between select-none">
                  <span>💬 评论功能已由管理员禁用</span>
                  <span className="font-bold text-sky-400 flex items-center gap-1 hover:underline cursor-pointer">
                    查看接口源：history.macaumarksix.com <ExternalLink className="w-3 h-3" />
                  </span>
                </div>
              </div>

              {/* Data History Table (Visualizing the 50 periods pool) */}
              <div className="bg-[#111827] rounded-xl border border-slate-800 p-5 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <ListFilter className="w-4.5 h-4.5 text-amber-500" />
                    <h3 className="text-sm font-bold text-white">当前缓存池开奖记录 ({mockHistory.length} 期)</h3>
                  </div>
                  {mockHistory.length > 0 && (
                    <span className="text-[10px] text-slate-400">
                      最新期号：{mockHistory[0].expect}
                    </span>
                  )}
                </div>

                <div className="overflow-y-auto max-h-[220px] scrollbar-thin border border-slate-800 rounded-lg">
                  {mockHistory.length === 0 ? (
                    <div className="text-center py-10 text-xs text-slate-500 font-mono">
                      暂无数据。已执行 0点 清零清空。
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-[#1F2937]/50 text-slate-400 uppercase text-[10px] border-b border-slate-800 sticky top-0">
                        <tr>
                          <th className="px-4 py-2">期号</th>
                          <th className="px-4 py-2">开奖号码</th>
                          <th className="px-4 py-2">特码大小</th>
                          <th className="px-4 py-2">特码单双</th>
                          <th className="px-4 py-2">波色</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-950/20">
                        {mockHistory.map((rec, idx) => {
                          const specNum = rec.specialNumber.number;
                          const colorText = RED_WAVE.includes(specNum) ? 'red' : BLUE_WAVE.includes(specNum) ? 'blue' : 'green';
                          
                          return (
                            <tr key={rec.expect} className={`hover:bg-slate-800/40 transition-colors ${idx === 0 ? 'bg-amber-500/5' : ''}`}>
                              <td className="px-4 py-2 text-slate-300 font-bold">
                                {rec.expect}
                                {idx === 0 && <span className="ml-1 text-[9px] bg-amber-500/10 text-amber-400 px-1 rounded">Latest</span>}
                              </td>
                              <td className="px-4 py-2 text-slate-400">
                                {rec.openCode.split(',').map((n, bIdx) => {
                                  const isSpecial = bIdx === 6;
                                  const nNum = parseInt(n);
                                  const bColor = getBallColor(nNum);
                                  const colorMap = {
                                    red: 'text-rose-400',
                                    blue: 'text-sky-400',
                                    green: 'text-emerald-400'
                                  };
                                  return (
                                    <span key={bIdx} className={`mr-1 ${colorMap[bColor]} ${isSpecial ? 'font-bold underline' : 'opacity-80'}`}>
                                      {n}{isSpecial ? '(特)' : ''}
                                    </span>
                                  );
                                })}
                              </td>
                              <td className="px-4 py-2">
                                <span className={specNum === 49 ? 'text-slate-500' : specNum >= 25 ? 'text-amber-400' : 'text-slate-400'}>
                                  {specNum === 49 ? '和' : specNum >= 25 ? '大' : '小'}
                                </span>
                              </td>
                              <td className="px-4 py-2">
                                <span className={specNum % 2 !== 0 ? 'text-yellow-400' : 'text-slate-400'}>
                                  {specNum % 2 !== 0 ? '单' : '双'}
                                </span>
                              </td>
                              <td className="px-4 py-2">
                                <span className={
                                  colorText === 'red' ? 'text-rose-500' : colorText === 'blue' ? 'text-sky-400' : 'text-emerald-500'
                                }>
                                  {colorText === 'red' ? '🔴红' : colorText === 'blue' ? '🔵蓝' : '🟢绿'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Tab 2: Python Code Download & Preview */}
        {activeTab === 'code' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Column: Script management download */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              <div className="bg-[#111827] rounded-xl border border-slate-800 p-5 shadow-lg">
                <div className="flex items-center gap-2 mb-4">
                  <Terminal className="w-4.5 h-4.5 text-amber-500" />
                  <h3 className="text-sm font-bold text-white">本地打包与一键下载</h3>
                </div>

                <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                  为了让您的机器人在 <strong>Termux</strong> 环境下获得最卓越的低能耗挂机表现，推荐您打包下载以下三款核心文件放进手机对应文件夹。
                </p>

                <div className="space-y-3">
                  {/* bot.py */}
                  <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-lg flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white">bot.py</h4>
                      <p className="text-[10px] text-slate-500">双线程高频长轮询预测主程序</p>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleCopyText(pythonBotCode, 'botpy')}
                        className="p-1.5 bg-slate-850 hover:bg-slate-750 text-slate-300 rounded transition-all"
                        title="复制代码"
                      >
                        {copiedStatus['botpy'] ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleDownloadFile('bot.py', pythonBotCode)}
                        className="p-1.5 bg-slate-850 hover:bg-slate-750 text-slate-300 rounded transition-all"
                        title="下载 bot.py"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* config.json */}
                  <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-lg flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white">config.json</h4>
                      <p className="text-[10px] text-slate-500">群发频道/Bot Token配置文件</p>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleCopyText(defaultJsonConfig, 'configjson')}
                        className="p-1.5 bg-slate-850 hover:bg-slate-750 text-slate-300 rounded transition-all"
                        title="复制代码"
                      >
                        {copiedStatus['configjson'] ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleDownloadFile('config.json', defaultJsonConfig)}
                        className="p-1.5 bg-slate-850 hover:bg-slate-750 text-slate-300 rounded transition-all"
                        title="下载 config.json"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* start.sh */}
                  <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-lg flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white">start.sh</h4>
                      <p className="text-[10px] text-slate-500">nohup 后台挂载守护启动脚本</p>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleCopyText(termuxStartScript, 'startsh')}
                        className="p-1.5 bg-slate-850 hover:bg-slate-750 text-slate-300 rounded transition-all"
                        title="复制代码"
                      >
                        {copiedStatus['startsh'] ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleDownloadFile('start.sh', termuxStartScript)}
                        className="p-1.5 bg-slate-850 hover:bg-slate-750 text-slate-300 rounded transition-all"
                        title="下载 start.sh"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-amber-500/5 border border-amber-500/10 rounded-lg text-[11px] text-amber-400 leading-normal">
                  ⚠️ <strong>安全注意事项：</strong>
                  当您将本项目上传至公共 GitHub 仓库时，请确保在 <code>.gitignore</code> 中添加了 <code>config.json</code>，或保持其中的 Token 为空，防止您的 Telegram Bot 密匙泄露！
                </div>
              </div>
            </div>

            {/* Right Column: Code viewer */}
            <div className="lg:col-span-8 flex flex-col gap-4">
              <div className="bg-[#111827] rounded-xl border border-slate-800 shadow-lg overflow-hidden flex flex-col flex-1">
                <div className="bg-[#1F2937] px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-bold text-slate-200">bot.py 纯后台代码 (无前端开销，完美运行)</span>
                  </div>
                  <button
                    onClick={() => handleCopyText(pythonBotCode, 'bot_core')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-850 rounded text-xs text-slate-300 font-semibold transition-all"
                  >
                    {copiedStatus['bot_core'] ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedStatus['bot_core'] ? '复制成功' : '一键复制代码'}
                  </button>
                </div>

                <div className="p-4 bg-slate-950 font-mono text-[11px] leading-relaxed overflow-auto max-h-[500px] text-slate-300 scrollbar-thin">
                  <pre className="whitespace-pre">{pythonBotCode}</pre>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Tab 3: Detailed Step-by-Step Guide */}
        {activeTab === 'guide' && (
          <div className="max-w-4xl mx-auto bg-[#111827] rounded-xl border border-slate-800 p-6 sm:p-8 shadow-xl">
            <div className="flex items-center gap-2.5 border-b border-slate-800 pb-4 mb-6">
              <BookOpen className="w-5.5 h-5.5 text-amber-500 animate-pulse" />
              <div>
                <h3 className="text-lg font-bold text-white">📱 Android Termux 极简一键挂机部署教程</h3>
                <p className="text-xs text-slate-400">零基础部署，每5秒自动同步开奖，生成高概率均值预测并广播</p>
              </div>
            </div>

            <div className="space-y-6 text-xs text-slate-300 leading-relaxed">
              
              {/* Step 1: Create a Bot */}
              <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-800/80">
                <span className="inline-block bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded text-[10px] mb-2.5">
                  步骤 1
                </span>
                <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
                  通过 @BotFather 申请 Telegram 机器人 Token
                </h4>
                <ol className="list-decimal list-inside space-y-1.5 pl-1 text-slate-300">
                  <li>打开 Telegram 搜索：<a href="https://t.me/BotFather" target="_blank" className="text-sky-400 underline font-semibold">@BotFather</a>。</li>
                  <li>发送命令 <code>/newbot</code>。</li>
                  <li>为机器人设置别名 (如: <code>三分彩预测广播官</code>)。</li>
                  <li>设置唯一的以 <code>_bot</code> 结尾的用户名。</li>
                  <li>复制 BotFather 给你发送的 <strong>API Token</strong>。</li>
                </ol>
              </div>

              {/* Step 2: Acquire Channel Username & Admin ID */}
              <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-800/80">
                <span className="inline-block bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded text-[10px] mb-2.5">
                  步骤 2
                </span>
                <h4 className="text-sm font-bold text-white mb-2">配置您的 Telegram 管理频道 / 群组</h4>
                <ol className="list-decimal list-inside space-y-1.5 pl-1 text-slate-300">
                  <li>新建一个公开 Telegram 频道 (例如 <code>@my_prediction_hub</code>) 或群组。</li>
                  <li>将您的机器人拉入该频道，并<strong>将其设为管理员</strong>，确保勾选了 <strong>“Post Messages (发送消息)”</strong> 权限。</li>
                  <li>向 Telegram 的 <a href="https://t.me/userinfobot" target="_blank" className="text-sky-400 underline font-semibold">@userinfobot</a> 机器人发送任意字符，获取您个人的数字 <code>ID</code>。</li>
                  <li>将这串数字填入 <code>config.json</code> 中的 <code>admin_id</code>。配置后，只有您可以通过个人对话向机器人发送 <code>/broadcast</code> 或 <code>/reset</code> 指令。</li>
                </ol>
              </div>

              {/* Step 3: Git Pull and Termux Setup */}
              <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-800/80">
                <span className="inline-block bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded text-[10px] mb-2.5">
                  步骤 3
                </span>
                <h4 className="text-sm font-bold text-white mb-2">在 Android 手机 Termux 终端配置环境</h4>
                <p className="mb-2 text-slate-400">
                  如果您将本项目代码上传到了 GitHub 仓库，您可以在手机 Termux 终端中直接运行以下一条合并命令进行一键自动部署：
                </p>

                <div className="bg-slate-950 p-4 rounded-lg font-mono text-[10px] leading-relaxed border border-slate-800/80 relative text-slate-300">
                  <button
                    onClick={() => handleCopyText(`pkg update -y && pkg install python git -y\npip install pyTelegramBotAPI requests\ngit clone YOUR_GITHUB_REPOSITORY_URL && cd YOUR_REPO_DIR`, 'termux_cmd')}
                    className="absolute top-2.5 right-2.5 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px]"
                    title="复制代码"
                  >
                    {copiedStatus['termux_cmd'] ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                  <p className="text-amber-500 font-bold mb-1"># 1. 自动更新系统、安装 Python 与 Git</p>
                  <p className="text-slate-200 mb-2">pkg update -y && pkg install python git -y</p>
                  
                  <p className="text-amber-500 font-bold mb-1"># 2. 安装 Python 专属 Telegram Bot 框架</p>
                  <p className="text-slate-200 mb-2">pip install pyTelegramBotAPI requests</p>
                  
                  <p className="text-amber-500 font-bold mb-1"># 3. 克隆您的 GitHub 仓库并进入目录</p>
                  <p className="text-slate-200">git clone <span className="text-slate-500">YOUR_GITHUB_REPOSITORY_URL</span> && cd <span className="text-slate-500">YOUR_REPO_DIR</span></p>
                </div>

                {/* CRITICAL ERROR ASSISTANCE */}
                <div className="mt-4 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-lg">
                  <div className="flex gap-2 text-xs text-rose-400 font-bold mb-1.5 items-center">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                    <span>⚠️ 警惕 Termux 报错: "Unable to locate package pip/pyTelegramBotAPI/requests"</span>
                  </div>
                  <div className="text-[11px] text-slate-300 space-y-1.5 leading-relaxed">
                    <p>
                      <strong>错误原因：</strong>你在 Termux 中运行了类似 <code>pkg install pip...</code> 或 <code>apt install pip...</code> 的指令。
                      在 Linux/Termux 中，<code>pip</code> <strong>不是</strong>系统安装包 (APT/PKG)，而是 Python 内部的工具包。
                    </p>
                    <p className="font-semibold text-rose-300">正确的两步安装流程为：</p>
                    <ol className="list-decimal list-inside space-y-1 pl-1 text-[10.5px]">
                      <li>首先执行: <code className="bg-slate-950 text-emerald-400 px-1 rounded font-mono">pkg install python -y</code> (这会自动安装 python3 和内置 pip)</li>
                      <li>然后执行: <code className="bg-slate-950 text-emerald-400 px-1 rounded font-mono">pip install pyTelegramBotAPI requests</code> (这是通过 pip 安装库，绝对不能带 pkg/apt install)</li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* Step 4: Run backend in silence */}
              <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-800/80">
                <span className="inline-block bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded text-[10px] mb-2.5">
                  步骤 4
                </span>
                <h4 className="text-sm font-bold text-white mb-2">一键挂机启动守护</h4>
                <ol className="list-decimal list-inside space-y-1.5 pl-1 text-slate-300">
                  <li>在目录中使用 <code>nano config.json</code> 填入您的 Bot Token 和 目标频道后保存退出。</li>
                  <li>一键执行挂载，确保即使关闭 SSH、关闭 Termux 窗口，后台依然能 24 小时不断线自动工作：</li>
                  <div className="bg-slate-950 p-3.5 rounded border border-slate-800 font-mono text-[10px] my-2 text-slate-300">
                    <p className="text-slate-500"># 赋予守护启动脚本执行权限</p>
                    <p className="text-slate-200 mb-1">chmod +x start.sh</p>
                    <p className="text-slate-500"># 启动守护机器人进程</p>
                    <p className="text-slate-200">./start.sh</p>
                  </div>
                  <li>可以使用命令 <code>tail -f bot.log</code> 实时查看开奖轮询接口拉取动态。</li>
                </ol>
              </div>

              {/* Step 5: Telegram Chat commands */}
              <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-800/80">
                <span className="inline-block bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded text-[10px] mb-2.5">
                  步骤 5
                </span>
                <h4 className="text-sm font-bold text-white mb-2">管理控制命令一览</h4>
                <p className="mb-2 text-slate-400">
                  只要配置了正确的 <code>admin_id</code>，您就可以直接在 Telegram 与机器人的私聊对话中进行如下高阶操作：
                </p>
                <div className="space-y-2 text-[11px] text-slate-300">
                  <div>• <code>/status</code> - 查询机器人今日已累积开奖期数。开满 50 期即会自动触发全天实时预测逻辑。</div>
                  <div>• <code>/predict</code> - 全员公开命令，机器人回复当前统计学模型预测的下一期大小、单双与波色。</div>
                  <div>• <code>/broadcast</code> - [管理员专属] 立即手动对最新的开奖数据进行模型推演，生成华丽排版后群发到频道中。</div>
                  <div>• <code>/reset</code> - [管理员专属] 紧急强制清空缓存记录，在开奖源异常或需要手动复位时使用。</div>
                </div>
              </div>

            </div>
          </div>
        )}
        
      </main>

      {/* Footer copyright */}
      <footer className="border-t border-slate-800/80 bg-[#0A0D16] py-6 text-center text-xs text-slate-500">
        <p className="flex items-center justify-center gap-1.5 font-medium">
          🍀 澳门三分六合彩自动采集与预测挂机系统 • 100% 绿色安全
        </p>
        <p className="mt-1 opacity-70">
          基于大数据均值回归模型及 python-telegram 多线程技术开发。结果仅供娱乐和概率学术讨论。
        </p>
      </footer>
    </div>
  );
}
