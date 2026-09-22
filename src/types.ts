export interface BotConfig {
  botToken: string;
  chatId: string;
  adminId: string;
  autoSchedule: boolean;
  scheduleTime: string;
  algorithm: 'frequency' | 'monte_carlo' | 'zodiac' | 'gemini';
}

export interface BallInfo {
  number: number;
  color: 'red' | 'blue' | 'green';
  zodiac: string;
  fiveElements: string;
}

export interface PredictionResult {
  drawNumber: number;
  mainNumbers: BallInfo[];
  specialNumber: BallInfo;
  analysisText: string;
  createdAt: string;
}
