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
  
  // Advanced pattern indicators (values from -100 to +100 or 0 to 100)
  bs_mr: number;
  bs_om: number;
  bs_tr: number;
  oe_mr: number;
  oe_om: number;
  oe_tr: number;
  col_red_score: number;
  col_blue_score: number;
  col_green_score: number;
}

export function runStatisticalPrediction(history: MockDrawRecord[]): StatisticalSummary {
  if (history.length < 50) {
    return {
      bigCount: 0, smallCount: 0, oddCount: 0, evenCount: 0, redCount: 0, blueCount: 0, greenCount: 0,
      predictedBigSmall: "小", predictedOddEven: "双", predictedColor: "🔴 红波", nextExpect: "20260717051",
      bs_mr: 0, bs_om: 0, bs_tr: 0, oe_mr: 0, oe_om: 0, oe_tr: 0, col_red_score: 0, col_blue_score: 0, col_green_score: 0
    };
  }

  const targetRecords = history.slice(0, 50);

  // 1. Basic Stats Counts
  let bigCount = 0;
  let smallCount = 0;
  let oddCount = 0;
  let evenCount = 0;
  let redCount = 0;
  let blueCount = 0;
  let greenCount = 0;

  targetRecords.forEach(rec => {
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

  // 2. Omission analysis
  let bigOmission = 0;
  let smallOmission = 0;
  let oddOmission = 0;
  let evenOmission = 0;
  let redOmission = 0;
  let blueOmission = 0;
  let greenOmission = 0;

  // Big / Small omission
  for (let i = 0; i < targetRecords.length; i++) {
    const spec = targetRecords[i].specialNumber.number;
    if (spec === 49) continue;
    if (spec >= 25) break;
    smallOmission++;
  }
  for (let i = 0; i < targetRecords.length; i++) {
    const spec = targetRecords[i].specialNumber.number;
    if (spec === 49) continue;
    if (spec < 25) break;
    bigOmission++;
  }

  // Odd / Even omission
  for (let i = 0; i < targetRecords.length; i++) {
    const spec = targetRecords[i].specialNumber.number;
    if (spec % 2 !== 0) break;
    oddOmission++;
  }
  for (let i = 0; i < targetRecords.length; i++) {
    const spec = targetRecords[i].specialNumber.number;
    if (spec % 2 === 0) break;
    evenOmission++;
  }

  // Color omission
  for (let i = 0; i < targetRecords.length; i++) {
    const spec = targetRecords[i].specialNumber.number;
    if (RED_WAVE.includes(spec)) break;
    redOmission++;
  }
  for (let i = 0; i < targetRecords.length; i++) {
    const spec = targetRecords[i].specialNumber.number;
    if (BLUE_WAVE.includes(spec)) break;
    blueOmission++;
  }
  for (let i = 0; i < targetRecords.length; i++) {
    const spec = targetRecords[i].specialNumber.number;
    if (GREEN_WAVE.includes(spec)) break;
    greenOmission++;
  }

  // 3. Markov chain transitions
  let bigToBig = 0;
  let bigToSmall = 0;
  let smallToBig = 0;
  let smallToSmall = 0;

  let oddToOdd = 0;
  let oddToEven = 0;
  let evenToOdd = 0;
  let evenToEven = 0;

  let redToRed = 0;
  let redToBlue = 0;
  let redToGreen = 0;
  let blueToRed = 0;
  let blueToBlue = 0;
  let blueToGreen = 0;
  let greenToRed = 0;
  let greenToBlue = 0;
  let greenToGreen = 0;

  for (let i = targetRecords.length - 2; i >= 0; i--) {
    const prevRec = targetRecords[i + 1];
    const currRec = targetRecords[i];

    const pSpec = prevRec.specialNumber.number;
    const cSpec = currRec.specialNumber.number;

    // Big/Small transitions
    if (pSpec !== 49 && cSpec !== 49) {
      if (pSpec >= 25) {
        if (cSpec >= 25) bigToBig++;
        else bigToSmall++;
      } else {
        if (cSpec >= 25) smallToBig++;
        else smallToSmall++;
      }
    }

    // Odd/Even transitions
    if (pSpec % 2 !== 0) {
      if (cSpec % 2 !== 0) oddToOdd++;
      else oddToEven++;
    } else {
      if (cSpec % 2 !== 0) evenToOdd++;
      else evenToEven++;
    }

    // Color transitions
    const pColor = RED_WAVE.includes(pSpec) ? 'red' : BLUE_WAVE.includes(pSpec) ? 'blue' : 'green';
    const cColor = RED_WAVE.includes(cSpec) ? 'red' : BLUE_WAVE.includes(cSpec) ? 'blue' : 'green';

    if (pColor === 'red') {
      if (cColor === 'red') redToRed++;
      else if (cColor === 'blue') redToBlue++;
      else redToGreen++;
    } else if (pColor === 'blue') {
      if (cColor === 'red') blueToRed++;
      else if (cColor === 'blue') blueToBlue++;
      else blueToGreen++;
    } else {
      if (cColor === 'red') greenToRed++;
      else if (cColor === 'blue') greenToBlue++;
      else greenToGreen++;
    }
  }

  // 4. Combined Weight Decisions
  const bs_mr = (smallCount - bigCount) / 50.0;
  const bs_om = (bigOmission - smallOmission) * 0.1;
  const latestSpec = targetRecords[0].specialNumber.number;
  let bs_tr = 0.0;
  if (latestSpec !== 49) {
    if (latestSpec >= 25) {
      bs_tr = bigToBig > bigToSmall ? 0.5 : -0.5;
    } else {
      bs_tr = smallToBig > smallToSmall ? 0.5 : -0.5;
    }
  }
  const bs_score = 0.35 * bs_mr + 0.35 * bs_om + 0.30 * bs_tr;
  const predictedBigSmall = bs_score >= 0 ? '大' : '小';

  // Odd/Even score
  const oe_mr = (evenCount - oddCount) / 50.0;
  const oe_om = (oddOmission - evenOmission) * 0.1;
  let oe_tr = 0.0;
  if (latestSpec % 2 !== 0) {
    oe_tr = oddToOdd > oddToEven ? 0.5 : -0.5;
  } else {
    oe_tr = evenToOdd > evenToEven ? 0.5 : -0.5;
  }
  const oe_score = 0.35 * oe_mr + 0.35 * oe_om + 0.30 * oe_tr;
  const predictedOddEven = oe_score >= 0 ? '单' : '双';

  // Color scores
  const mr_red = (50 - redCount) / 50.0;
  const mr_blue = (50 - blueCount) / 50.0;
  const mr_green = (50 - greenCount) / 50.0;

  const om_red_score = redOmission * 0.15;
  const om_blue_score = blueOmission * 0.15;
  const om_green_score = greenOmission * 0.15;

  const latestColor = RED_WAVE.includes(latestSpec) ? 'red' : BLUE_WAVE.includes(latestSpec) ? 'blue' : 'green';
  let tr_red = 0, tr_blue = 0, tr_green = 0;
  if (latestColor === 'red') {
    const total_tr = Math.max(1, redToRed + redToBlue + redToGreen);
    tr_red = redToRed / total_tr;
    tr_blue = redToBlue / total_tr;
    tr_green = redToGreen / total_tr;
  } else if (latestColor === 'blue') {
    const total_tr = Math.max(1, blueToRed + blueToBlue + blueToGreen);
    tr_red = blueToRed / total_tr;
    tr_blue = blueToBlue / total_tr;
    tr_green = blueToGreen / total_tr;
  } else {
    const total_tr = Math.max(1, greenToRed + greenToBlue + greenToGreen);
    tr_red = greenToRed / total_tr;
    tr_blue = greenToBlue / total_tr;
    tr_green = greenToGreen / total_tr;
  }

  const score_red = 0.35 * mr_red + 0.35 * om_red_score + 0.30 * tr_red;
  const score_blue = 0.35 * mr_blue + 0.35 * om_blue_score + 0.30 * tr_blue;
  const score_green = 0.35 * mr_green + 0.35 * om_green_score + 0.30 * tr_green;

  const colorScores = [
    { name: '红波', score: score_red, emoji: '🔴' },
    { name: '蓝波', score: score_blue, emoji: '🔵' },
    { name: '绿波', score: score_green, emoji: '🟢' }
  ];
  colorScores.sort((a, b) => b.score - a.score);
  const predictedColor = `${colorScores[0].emoji} ${colorScores[0].name}`;

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
    nextExpect,
    
    bs_mr: Math.round(bs_mr * 100),
    bs_om: Math.round(bs_om * 100),
    bs_tr: Math.round(bs_tr * 100),
    oe_mr: Math.round(oe_mr * 100),
    oe_om: Math.round(oe_om * 100),
    oe_tr: Math.round(oe_tr * 100),
    col_red_score: Math.round(score_red * 100),
    col_blue_score: Math.round(score_blue * 100),
    col_green_score: Math.round(score_green * 100)
  };
}

export interface VerificationResult {
  expect: string;
  specialNum: number;
  pred_big_small: string;
  pred_odd_even: string;
  pred_color: string;
  actual_big_small: string;
  actual_odd_even: string;
  actual_color: string;
  bs_correct: boolean;
  oe_correct: boolean;
  color_correct: boolean;
}

export function verifyPredictionAtIndex(history: MockDrawRecord[], index: number): VerificationResult | null {
  if (history.length < index + 51) return null;
  
  const subHistory = history.slice(index + 1);
  const stats = runStatisticalPrediction(subHistory);
  
  const actualRecord = history[index];
  const actualSpec = actualRecord.specialNumber.number;
  const actualBigSmall = actualSpec === 49 ? '和' : actualSpec >= 25 ? '大' : '小';
  const actualOddEven = actualSpec % 2 !== 0 ? '单' : '双';
  const actualColor = RED_WAVE.includes(actualSpec) ? '红波' : BLUE_WAVE.includes(actualSpec) ? '蓝波' : '绿波';
  
  // Clean predicted prefixes
  const predBigSmall = stats.predictedBigSmall.replace("🔥 ", "").replace("❄️ ", "");
  const predOddEven = stats.predictedOddEven.replace("⚡ ", "").replace("🌙 ", "");
  const predColor = stats.predictedColor.replace("🔴 ", "").replace("🔵 ", "").replace("🟢 ", "").replace("波", "") + "波";
  
  const bs_correct = (actualSpec === 49) ? false : (predBigSmall === actualBigSmall);
  const oe_correct = (predOddEven === actualOddEven);
  const color_correct = (predColor === actualColor);
  
  return {
    expect: actualRecord.expect,
    specialNum: actualSpec,
    pred_big_small: predBigSmall,
    pred_odd_even: predOddEven,
    pred_color: predColor,
    actual_big_small: actualBigSmall,
    actual_odd_even: actualOddEven,
    actual_color: actualColor,
    bs_correct,
    oe_correct,
    color_correct
  };
}

// Generate the beautiful Telegram channel HTML post matching the user's design exactly
export function generateTelegramPost(stats: StatisticalSummary, history: MockDrawRecord[]): string {
  if (history.length === 0) return "";
  
  const latestRecord = history[0];
  const expect = latestRecord.expect;
  
  // Format balls: 1, 2, 3, 4, 5, 6,   7
  const balls = latestRecord.openCode.split(',');
  let balls_formatted = "";
  if (balls.length >= 7) {
    balls_formatted = balls.slice(0, 6).join('，') + '，   ' + balls[6];
  } else {
    balls_formatted = latestRecord.openCode;
  }
  
  // Verify previous prediction (prediction at index 0)
  const res = verifyPredictionAtIndex(history, 0);
  
  let pred_bs = "无";
  let pred_oe = "无";
  let pred_col = "无";
  let bs_status = "无";
  let oe_status = "无";
  let col_status = "无";
  
  if (res) {
    pred_bs = res.pred_big_small;
    pred_oe = res.pred_odd_even;
    pred_col = res.pred_color;
    bs_status = res.bs_correct ? "对√" : "错×";
    oe_status = res.oe_correct ? "对√" : "错×";
    col_status = res.color_correct ? "对√" : "错×";
  }
  
  const next_bs = stats.predictedBigSmall.replace("🔥 ", "").replace("❄️ ", "");
  const next_oe = stats.predictedOddEven.replace("⚡ ", "").replace("🌙 ", "");
  const next_col = stats.predictedColor.replace("🔴 ", "").replace("🔵 ", "").replace("🟢 ", "").replace("波", "") + "波";
  
  const predRow = `${pred_bs}     ${pred_oe}      ${pred_col}`;
  const statusRow = `${bs_status}   ${oe_status}   ${col_status}`;
  const nextRow = `${next_bs}     ${next_oe}      ${next_col}`;
  
  return `第${expect}期开奖结果
${balls_formatted}
上期预测结果
${predRow}
${statusRow}
下期第${stats.nextExpect}期预测结果
${nextRow}`;
}

