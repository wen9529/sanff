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

export function getDynamicWeights(history: MockDrawRecord[]) {
  // Base default weights
  let bs_weights = { mr: 0.35, om: 0.35, tr: 0.30 };
  let oe_weights = { mr: 0.35, om: 0.35, tr: 0.30 };
  let col_weights = { mr: 0.35, om: 0.35, tr: 0.30 };

  const backtestCount = Math.min(15, history.length - 52);
  if (backtestCount <= 0) {
    return { bs_weights, oe_weights, col_weights };
  }

  let bs_mr_hits = 0, bs_om_hits = 0, bs_tr_hits = 0;
  let oe_mr_hits = 0, oe_om_hits = 0, oe_tr_hits = 0;
  let col_mr_hits = 0, col_om_hits = 0, col_tr_hits = 0;

  for (let k = 1; k <= backtestCount; k++) {
    const subHistory = history.slice(k + 1);
    const actualRecord = history[k];
    const actualSpec = actualRecord.specialNumber.number;
    if (actualSpec === 49) continue; // Skip ties for simplicity

    const actualBS = actualSpec >= 25 ? '大' : '小';
    const actualOE = actualSpec % 2 !== 0 ? '单' : '双';
    const actualCol = RED_WAVE.includes(actualSpec) ? 'red' : BLUE_WAVE.includes(actualSpec) ? 'blue' : 'green';

    const window = subHistory.slice(0, 50);
    if (window.length < 50) continue;

    // --- BIG/SMALL ---
    let bCount = 0, sCount = 0;
    window.forEach(r => {
      const sp = r.specialNumber.number;
      if (sp !== 49) {
        if (sp >= 25) bCount++;
        else sCount++;
      }
    });
    const predBS_mr = sCount >= bCount ? '大' : '小';
    if (predBS_mr === actualBS) bs_mr_hits++;

    let bOm = 0, sOm = 0;
    for (let j = 0; j < window.length; j++) {
      const sp = window[j].specialNumber.number;
      if (sp === 49) continue;
      if (sp >= 25) break;
      sOm++;
    }
    for (let j = 0; j < window.length; j++) {
      const sp = window[j].specialNumber.number;
      if (sp === 49) continue;
      if (sp < 25) break;
      bOm++;
    }
    const predBS_om = bOm >= sOm ? '大' : '小';
    if (predBS_om === actualBS) bs_om_hits++;

    let bToB = 0, bToS = 0, sToB = 0, sToS = 0;
    for (let j = window.length - 2; j >= 0; j--) {
      const pSpec = window[j + 1].specialNumber.number;
      const cSpec = window[j].specialNumber.number;
      if (pSpec !== 49 && cSpec !== 49) {
        if (pSpec >= 25) {
          if (cSpec >= 25) bToB++; else bToS++;
        } else {
          if (cSpec >= 25) sToB++; else sToS++;
        }
      }
    }
    const latestSp = window[0].specialNumber.number;
    let predBS_tr = '大';
    if (latestSp !== 49) {
      if (latestSp >= 25) {
        predBS_tr = bToB > bToS ? '大' : '小';
      } else {
        predBS_tr = sToB > sToS ? '大' : '小';
      }
    }
    if (predBS_tr === actualBS) bs_tr_hits++;

    // --- ODD/EVEN ---
    let oCount = 0, eCount = 0;
    window.forEach(r => {
      if (r.specialNumber.number % 2 !== 0) oCount++; else eCount++;
    });
    const predOE_mr = eCount >= oCount ? '单' : '双';
    if (predOE_mr === actualOE) oe_mr_hits++;

    let oOm = 0, eOm = 0;
    for (let j = 0; j < window.length; j++) {
      if (window[j].specialNumber.number % 2 !== 0) break;
      oOm++;
    }
    for (let j = 0; j < window.length; j++) {
      if (window[j].specialNumber.number % 2 === 0) break;
      eOm++;
    }
    const predOE_om = oOm >= eOm ? '单' : '双';
    if (predOE_om === actualOE) oe_om_hits++;

    let oToO = 0, oToE = 0, eToO = 0, eToE = 0;
    for (let j = window.length - 2; j >= 0; j--) {
      const pSpec = window[j + 1].specialNumber.number;
      const cSpec = window[j].specialNumber.number;
      if (pSpec % 2 !== 0) {
        if (cSpec % 2 !== 0) oToO++; else oToE++;
      } else {
        if (cSpec % 2 !== 0) eToO++; else eToE++;
      }
    }
    let predOE_tr = '单';
    if (latestSp % 2 !== 0) {
      predOE_tr = oToO > oToE ? '单' : '双';
    } else {
      predOE_tr = eToO > eToE ? '单' : '双';
    }
    if (predOE_tr === actualOE) oe_tr_hits++;

    // --- COLOR ---
    let rCount = 0, bBlueCount = 0, gCount = 0;
    window.forEach(r => {
      const sp = r.specialNumber.number;
      if (RED_WAVE.includes(sp)) rCount++;
      else if (BLUE_WAVE.includes(sp)) bBlueCount++;
      else gCount++;
    });
    const minColor_mr = (rCount <= bBlueCount && rCount <= gCount) ? 'red' : (bBlueCount <= rCount && bBlueCount <= gCount) ? 'blue' : 'green';
    if (minColor_mr === actualCol) col_mr_hits++;

    let rOm = 0, bOmCol = 0, gOm = 0;
    for (let j = 0; j < window.length; j++) {
      if (RED_WAVE.includes(window[j].specialNumber.number)) break;
      rOm++;
    }
    for (let j = 0; j < window.length; j++) {
      if (BLUE_WAVE.includes(window[j].specialNumber.number)) break;
      bOmCol++;
    }
    for (let j = 0; j < window.length; j++) {
      if (GREEN_WAVE.includes(window[j].specialNumber.number)) break;
      gOm++;
    }
    const maxColor_om = (rOm >= bOmCol && rOm >= gOm) ? 'red' : (bOmCol >= rOm && bOmCol >= gOm) ? 'blue' : 'green';
    if (maxColor_om === actualCol) col_om_hits++;

    let colRToR = 0, colRToB = 0, colRToG = 0;
    let colBToR = 0, colBToB = 0, colBToG = 0;
    let colGToR = 0, colGToB = 0, colGToG = 0;
    for (let j = window.length - 2; j >= 0; j--) {
      const pS = window[j + 1].specialNumber.number;
      const cS = window[j].specialNumber.number;
      const pC = RED_WAVE.includes(pS) ? 'red' : BLUE_WAVE.includes(pS) ? 'blue' : 'green';
      const cC = RED_WAVE.includes(cS) ? 'red' : BLUE_WAVE.includes(cS) ? 'blue' : 'green';
      if (pC === 'red') {
        if (cC === 'red') colRToR++; else if (cC === 'blue') colRToB++; else colRToG++;
      } else if (pC === 'blue') {
        if (cC === 'red') colBToR++; else if (cC === 'blue') colBToB++; else colBToG++;
      } else {
        if (cC === 'red') colGToR++; else if (cC === 'blue') colGToB++; else colGToG++;
      }
    }
    const latestCol = RED_WAVE.includes(latestSp) ? 'red' : BLUE_WAVE.includes(latestSp) ? 'blue' : 'green';
    let maxColor_tr = 'red';
    if (latestCol === 'red') {
      maxColor_tr = (colRToR >= colRToB && colRToR >= colRToG) ? 'red' : (colRToB >= colRToR && colRToB >= colRToG) ? 'blue' : 'green';
    } else if (latestCol === 'blue') {
      maxColor_tr = (colBToR >= colBToB && colBToR >= colBToG) ? 'red' : (colBToB >= colBToR && colBToB >= colBToG) ? 'blue' : 'green';
    } else {
      maxColor_tr = (colGToR >= colGToB && colGToR >= colGToG) ? 'red' : (colGToB >= colGToR && colGToB >= colGToG) ? 'blue' : 'green';
    }
    if (maxColor_tr === actualCol) col_tr_hits++;
  }

  const bs_tot = bs_mr_hits + bs_om_hits + bs_tr_hits + 3;
  bs_weights = {
    mr: (bs_mr_hits + 1) / bs_tot,
    om: (bs_om_hits + 1) / bs_tot,
    tr: (bs_tr_hits + 1) / bs_tot
  };

  const oe_tot = oe_mr_hits + oe_om_hits + oe_tr_hits + 3;
  oe_weights = {
    mr: (oe_mr_hits + 1) / oe_tot,
    om: (oe_om_hits + 1) / oe_tot,
    tr: (oe_tr_hits + 1) / oe_tot
  };

  const col_tot = col_mr_hits + col_om_hits + col_tr_hits + 3;
  col_weights = {
    mr: (col_mr_hits + 1) / col_tot,
    om: (col_om_hits + 1) / col_tot,
    tr: (col_tr_hits + 1) / col_tot
  };

  return { bs_weights, oe_weights, col_weights };
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

  // Use dynamic weights from backtesting
  const { bs_weights, oe_weights, col_weights } = getDynamicWeights(history);

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
  const bs_score = bs_weights.mr * bs_mr + bs_weights.om * bs_om + bs_weights.tr * bs_tr;
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
  const oe_score = oe_weights.mr * oe_mr + oe_weights.om * oe_om + oe_weights.tr * oe_tr;
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

  const score_red = col_weights.mr * mr_red + col_weights.om * om_red_score + col_weights.tr * tr_red;
  const score_blue = col_weights.mr * mr_blue + col_weights.om * om_blue_score + col_weights.tr * tr_blue;
  const score_green = col_weights.mr * mr_green + col_weights.om * om_green_score + col_weights.tr * tr_green;

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
    
    bs_mr: Math.round(bs_weights.mr * bs_mr * 100),
    bs_om: Math.round(bs_weights.om * bs_om * 100),
    bs_tr: Math.round(bs_weights.tr * bs_tr * 100),
    oe_mr: Math.round(oe_weights.mr * oe_mr * 100),
    oe_om: Math.round(oe_weights.om * oe_om * 100),
    oe_tr: Math.round(oe_weights.tr * oe_tr * 100),
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

