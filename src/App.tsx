import React, { useState, useEffect } from 'react';
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
  Share2
} from 'lucide-react';
import {
  generateMockHistory,
  runStatisticalPrediction,
  generateTelegramPost,
  formatNum,
  getBallColor,
  RED_WAVE,
  BLUE_WAVE,
  GREEN_WAVE,
  MockDrawRecord,
  StatisticalSummary
} from './utils/predictor';
import { pythonBotCode, defaultJsonConfig, termuxStartScript } from './utils/pythonCode';

export default function App() {
  // Navigation Tabs: 'simulator' | 'code' | 'guide'
  const [activeTab, setActiveTab] = useState<'simulator' | 'code' | 'guide'>('simulator');
  
  // Customization State
  const [mockHistory, setMockHistory] = useState<MockDrawRecord[]>([]);
  const [stats, setStats] = useState<StatisticalSummary | null>(null);
  
  // Real Telegram Test state
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  
  // Sending status
  const [sendStatus, setSendStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [sendError, setSendError] = useState('');
  const [sendSuccessMsg, setSendSuccessMsg] = useState('');
  
  // Copied indices for UX feedback
  const [copiedStatus, setCopiedStatus] = useState<{ [key: string]: boolean }>({});

  // Generate initial mock 50 draw history on mount
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

    // Insert at front (newest first) and keep last 50
    setMockHistory(prev => {
      const updated = [newDraw, ...prev];
      return updated.slice(0, 50);
    });
  };

  // Clear all data to simulate midnight reset (00:00)
  const handleMidnightReset = () => {
    setMockHistory([]);
  };

  // Fill up to 50 records again
  const handleRegenerateHistory = () => {
    const history = generateMockHistory();
    setMockHistory(history);
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

    const formattedMsg = generateTelegramPost(stats, mockHistory[0]);

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
                    <h2 className="text-sm font-bold text-white">1. 三分钟自动模拟调试</h2>
                  </div>
                  <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
                    开奖周期: 3分钟/期
                  </span>
                </div>

                <div className="space-y-4">
                  {/* Status indicator card */}
                  <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-lg flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-500 block">今日开奖累积情况</span>
                      <strong className="text-lg font-black text-white font-mono">
                        {mockHistory.length} <span className="text-xs font-normal text-slate-400">/ 50 期</span>
                      </strong>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleSimulateNewDraw}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded text-xs flex items-center gap-1 transition-all"
                        title="产生第51期或更新的开奖号码"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        新开奖一期
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
                        onClick={handleRegenerateHistory}
                        className="mt-3 w-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs py-1.5 rounded border border-slate-700 font-semibold"
                      >
                        ⚡ 一键生成 50 期开奖记录以解锁预测
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                      <div className="flex gap-2 text-xs text-emerald-400 font-bold mb-1">
                        <CheckCircle className="w-4 h-4 shrink-0" />
                        <span>预测算法已成功激活！</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-normal">
                        开奖数据累积已满 50 期。算法通过对过去 50 期特殊球开奖的大数据统计，筛选最低频次属性进行<strong>对冲冷号回归推荐</strong>。
                      </p>
                    </div>
                  )}

                  {/* Frequency progress bars */}
                  {stats && (
                    <div className="space-y-2 bg-slate-950/30 p-3.5 rounded-lg border border-slate-800/50 text-[11px]">
                      <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span>大小比重分布 (不含49和值)</span>
                        <span className="font-mono text-white">大 {stats.bigCount} : 小 {stats.smallCount}</span>
                      </div>
                      <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden flex border border-slate-800">
                        <div className="bg-amber-500 h-full transition-all" style={{ width: `${(stats.bigCount / (stats.bigCount + stats.smallCount)) * 100}%` }}></div>
                        <div className="bg-sky-500 h-full transition-all" style={{ width: `${(stats.smallCount / (stats.bigCount + stats.smallCount)) * 100}%` }}></div>
                      </div>

                      <div className="flex items-center justify-between text-slate-400 pt-1.5 mb-1">
                        <span>单双比重分布</span>
                        <span className="font-mono text-white">单 {stats.oddCount} : 双 {stats.evenCount}</span>
                      </div>
                      <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden flex border border-slate-800">
                        <div className="bg-yellow-400 h-full transition-all" style={{ width: `${(stats.oddCount / (stats.oddCount + stats.evenCount)) * 100}%` }}></div>
                        <div className="bg-purple-500 h-full transition-all" style={{ width: `${(stats.evenCount / (stats.oddCount + stats.evenCount)) * 100}%` }}></div>
                      </div>

                      <div className="flex items-center justify-between text-slate-400 pt-1.5 mb-1">
                        <span>波色频率分布</span>
                        <span className="font-mono text-white text-[10px]">红 {stats.redCount} | 蓝 {stats.blueCount} | 绿 {stats.greenCount}</span>
                      </div>
                      <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden flex border border-slate-800">
                        <div className="bg-rose-500 h-full transition-all" style={{ width: `${(stats.redCount / (stats.redCount + stats.blueCount + stats.greenCount)) * 100}%` }}></div>
                        <div className="bg-sky-500 h-full transition-all" style={{ width: `${(stats.blueCount / (stats.redCount + stats.blueCount + stats.greenCount)) * 100}%` }}></div>
                        <div className="bg-emerald-500 h-full transition-all" style={{ width: `${(stats.greenCount / (stats.redCount + stats.blueCount + stats.greenCount)) * 100}%` }}></div>
                      </div>
                    </div>
                  )}

                </div>
              </div>

              {/* Bot Direct Sender Test Panel */}
              <div className="bg-[#111827] rounded-xl border border-slate-800 p-5 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Send className="w-4.5 h-4.5 text-sky-400 animate-pulse" />
                    <h2 className="text-sm font-bold text-white">2. Telegram 机器人官方接口测试</h2>
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
                        handleCopyText(generateTelegramPost(stats, mockHistory[0]), 'post');
                      }
                    }}
                    className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 active:bg-slate-850 rounded text-[10px] text-slate-300 transition-all font-semibold"
                  >
                    {copiedStatus['post'] ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copiedStatus['post'] ? '已复制' : '复制帖子格式'}
                  </button>
                </div>

                <div className="bg-[#101726] p-4 font-mono text-[11px] overflow-y-auto max-h-[350px] leading-relaxed border-b border-slate-800">
                  {stats && mockHistory.length >= 50 ? (
                    <div className="bg-[#17212F] rounded-xl border border-[#223348] p-4 text-slate-100 max-w-full shadow-md relative">
                      <div className="whitespace-pre-wrap select-text">
                        <div className="text-center font-bold text-xs text-yellow-400 mb-2">🔔 <b>澳门三分六合彩 - 开奖广播与下期预测</b> 🔔</div>
                        <div className="text-slate-400 mb-1">📅 <b>当前开奖期号</b>：第 <b>{mockHistory[0].expect}</b> 期</div>
                        <div className="text-slate-400 mb-1">🎰 <b>开奖号码</b>：<code>{mockHistory[0].openCode}</code></div>
                        <div className="text-slate-400 mb-3">🎯 <b>特码解析</b>：【 <b>{formatNum(mockHistory[0].specialNumber.number)}</b> 】号 ({RED_WAVE.includes(mockHistory[0].specialNumber.number) ? '🔴' : BLUE_WAVE.includes(mockHistory[0].specialNumber.number) ? '🔵' : '🟢'} | {mockHistory[0].specialNumber.number === 49 ? '和' : mockHistory[0].specialNumber.number >= 25 ? '大' : '小'} | {mockHistory[0].specialNumber.number % 2 !== 0 ? '单' : '双'})</div>
                        
                        <div className="border-t border-slate-850 my-2.5"></div>
                        <div className="text-slate-200 font-bold mb-1.5">📊 <b>最新50期综合概率分布</b>：</div>
                        <div className="text-[10px] text-slate-400 space-y-0.5 ml-2">
                          <div> ├ <b>大小比率</b>: 大 {stats.bigCount}次 ({stats.bigCount * 2}%) | 小 {stats.smallCount}次 ({stats.smallCount * 2}%)</div>
                          <div> ├ <b>单双比率</b>: 单 {stats.oddCount}次 ({stats.oddCount * 2}%) | 双 {stats.evenCount}次 ({stats.evenCount * 2}%)</div>
                          <div> └ <b>波色频率</b>: 红 {stats.redCount}次 | 蓝 {stats.blueCount}次 | 绿 {stats.greenCount}次</div>
                        </div>

                        <div className="border-t border-slate-850 my-2.5"></div>
                        <div className="text-slate-200 font-bold mb-1.5">🧠 <b>均值回归算法推荐</b> (第 <b>{stats.nextExpect}</b> 期)：</div>
                        <div className="text-[10px] ml-2 space-y-1">
                          <div> 🎯 <b>推荐大小</b>：【 <strong className="text-amber-400">{stats.predictedBigSmall === '大' ? '🔥 大' : '❄️ 小'}</strong> 】<i>(历史冷热对冲)</i></div>
                          <div> 🎯 <b>推荐单双</b>：【 <strong className="text-amber-400">{stats.predictedOddEven === '单' ? '⚡ 单' : '🌙 双'}</strong> 】<i>(奇偶均衡修正)</i></div>
                          <div> 🎯 <b>推荐波色</b>：【 <strong className="text-emerald-400">{stats.predictedColor}</strong> 】<i>(极限频率回补)</i></div>
                        </div>

                        <div className="border-t border-slate-850 my-2.5"></div>
                        <div className="text-center font-bold text-emerald-400 mt-2">🍀 <i>统计规律仅供参考，请理性娱乐！</i> 🍀</div>
                      </div>
                      <div className="text-[9px] text-slate-500 text-right mt-2 select-none">
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
