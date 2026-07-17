import { BallInfo, PredictionResult } from '../types';

// Mark Six official wave colors
export const RED_WAVE = [1, 2, 7, 8, 12, 13, 18, 19, 23, 24, 29, 30, 34, 35, 40, 45, 46];
export const BLUE_WAVE = [3, 4, 9, 10, 14, 15, 20, 25, 26, 31, 36, 37, 41, 42, 47, 48];
export const GREEN_WAVE = [5, 6, 11, 16, 17, 21, 22, 27, 28, 32, 33, 38, 39, 43, 44, 49];

export function getBallColor(num: number): 'red' | 'blue' | 'green' {
  if (RED_WAVE.includes(num)) return 'red';
  if (BLUE_WAVE.includes(num)) return 'blue';
  return 'green';
}

const ZODIAC_LIST = ['马', '蛇', '龙', '兔', '虎', '牛', '鼠', '猪', '狗', '鸡', '猴', '羊'];

export function getZodiac(num: number): string {
  const index = (num - 1) % 12;
  return ZODIAC_LIST[index];
}

export function getFiveElements(num: number): string {
  const METAL_ELEMENT = [2, 3, 10, 11, 24, 25, 32, 33, 40, 41, 48, 49];
  const WOOD_ELEMENT = [6, 7, 14, 15, 22, 23, 36, 37, 44, 45];
  const WATER_ELEMENT = [12, 13, 20, 21, 28, 29, 42, 43];
  const FIRE_ELEMENT = [1, 8, 9, 16, 17, 30, 31, 38, 39, 46, 47];
  
  if (METAL_ELEMENT.includes(num)) return '金';
  if (WOOD_ELEMENT.includes(num)) return '木';
  if (WATER_ELEMENT.includes(num)) return '水';
  if (FIRE_ELEMENT.includes(num)) return '火';
  return '土';
}

export function generateBall(num: number): BallInfo {
  return {
    number: num,
    color: getBallColor(num),
    zodiac: getZodiac(num),
    fiveElements: getFiveElements(num),
  };
}

export function formatNum(num: number): string {
  return num < 10 ? `0${num}` : `${num}`;
}

// Generate a set of 50 mocked recent draws to simulate real stats calculation on the front-end!
export interface MockDrawRecord {
  expect: string;
  openCode: string;
  specialNumber: BallInfo;
  isBig: boolean;
  isOdd: boolean;
}

export function generateMockHistory(): MockDrawRecord[] {
  const history: MockDrawRecord[] = [];
  const baseExpect = 20260717000;
  
  for (let i = 50; i >= 1; i--) {
    const ballsSet = new Set<number>();
    while (ballsSet.size < 7) {
      ballsSet.add(Math.floor(Math.random() * 49) + 1);
    }
    const balls = Array.from(ballsSet);
    const mainNumbersRaw = balls.slice(0, 6).sort((a, b) => a - b);
    const specialRaw = balls[6];
    
    const openCode = [...mainNumbersRaw, specialRaw].map(formatNum).join(',');
    const specialNumber = generateBall(specialRaw);
    
    history.push({
      expect: (baseExpect + i).toString(),
      openCode,
      specialNumber,
      isBig: specialRaw >= 25 && specialRaw !== 49,
      isOdd: specialRaw % 2 !== 0
    });
  }
  
  // Sort reverse (newest first)
  return history.sort((a, b) => b.expect.localeCompare(a.expect));
}

export interface StatisticalSummary {
  bigCount: number;
  smallCount: number;
  oddCount: number;
  evenCount: number;
  redCount: number;
  blueCount: number;
  greenCount: number;
  predictedBigSmall: string;
  predictedOddEven: string;
  predictedColor: string;
  nextExpect: string;
}

export function runStatisticalPrediction(history: MockDrawRecord[]): StatisticalSummary {
  let bigCount = 0;
  let smallCount = 0;
  let oddCount = 0;
  let evenCount = 0;
  let redCount = 0;
  let blueCount = 0;
  let greenCount = 0;

  history.forEach(rec => {
    const specNum = rec.specialNumber.number;
    
    // Big/Small
    if (specNum !== 49) {
      if (specNum >= 25) bigCount++;
      else smallCount++;
    }
    
    // Odd/Even
    if (specNum % 2 !== 0) oddCount++;
    else evenCount++;
    
    // Color Wave
    if (RED_WAVE.includes(specNum)) redCount++;
    else if (BLUE_WAVE.includes(specNum)) blueCount++;
    else if (GREEN_WAVE.includes(specNum)) greenCount++;
  });

  // Calculate Regression to Mean
  const predictedBigSmall = bigCount < smallCount ? '大' : '小';
  const predictedOddEven = oddCount < evenCount ? '单' : '双';
  
  const colors = [
    { name: '红波', count: redCount, emoji: '🔴' },
    { name: '蓝波', count: blueCount, emoji: '🔵' },
    { name: '绿波', count: greenCount, emoji: '🟢' }
  ];
  colors.sort((a, b) => a.count - b.count);
  const predictedColor = `${colors[0].emoji} ${colors[0].name}`;

  const latestExpect = history[0]?.expect || "20260717050";
  const nextExpect = (parseInt(latestExpect) + 1).toString();

  return {
    bigCount,
    smallCount,
    oddCount,
    evenCount,
    redCount,
    blueCount,
    greenCount,
    predictedBigSmall,
    predictedOddEven,
    predictedColor,
    nextExpect
  };
}

// Generate the beautiful Telegram channel HTML post
export function generateTelegramPost(stats: StatisticalSummary, latestRecord: MockDrawRecord, subtitle = '每日黄金预测'): string {
  const specNum = latestRecord.specialNumber.number;
  const specColorEmoji = RED_WAVE.includes(specNum) ? '🔴' : BLUE_WAVE.includes(specNum) ? '🔵' : '🟢';
  const specBigSmall = specNum === 49 ? '和' : specNum >= 25 ? '大' : '小';
  const specOddEven = specNum % 2 !== 0 ? '单' : '双';

  return `🔔 <b>澳门三分六合彩 - 开奖广播与下期预测</b> 🔔
━━━━━━━━━━━━━━━━━━━
📅 <b>当前开奖期号</b>：第 <b>${latestRecord.expect}</b> 期
🎰 <b>开奖号码</b>：<code>${latestRecord.openCode}</code>
🎯 <b>特码解析</b>：【 <b>${formatNum(specNum)}</b> 】号 (${specColorEmoji} | ${specBigSmall} | ${specOddEven})
━━━━━━━━━━━━━━━━━━━

📊 <b>最新50期综合概率分布</b>：
 ├ <b>大小比率</b>: 大 ${stats.bigCount}次 (${stats.bigCount * 2}%) | 小 ${stats.smallCount}次 (${stats.smallCount * 2}%)
 ├ <b>单双比率</b>: 单 ${stats.oddCount}次 (${stats.oddCount * 2}%) | 双 ${stats.evenCount}次 (${stats.evenCount * 2}%)
 └ <b>波色频率</b>: 红 ${stats.redCount}次 | 蓝 ${stats.blueCount}次 | 绿 ${stats.greenCount}次

🧠 <b>均值回归算法推荐</b> (第 <b>${stats.nextExpect}</b> 期)：
 🎯 <b>推荐大小</b>：【 <b>${stats.predictedBigSmall === '大' ? '🔥 大' : '❄️ 小'}</b> 】<i>(历史冷热对冲)</i>
 🎯 <b>推荐单双</b>：【 <b>${stats.predictedOddEven === '单' ? '⚡ 单' : '🌙 双'}</b> 】<i>(奇偶均衡修正)</i>
 🎯 <b>推荐波色</b>：【 <b>${stats.predictedColor}</b> 】<i>(极限频率回补)</i>

🍀 <i>统计规律仅供参考，请理性娱乐！</i> 🍀`;
}
