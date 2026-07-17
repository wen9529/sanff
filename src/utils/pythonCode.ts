export const pythonBotCode = `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
香港/澳门三分六合彩自动预测 Telegram 机器人 - Termux 专属部署版
- 每5秒自动拉取最新开奖接口 (支持自定源)
- 每天0点自动清空开奖记录重新累积
- 累积满50期后自动启动统计学冷热与均值回归算法，预测下一期的【大小、单双、波色】
- 新期开奖时，自动推送到配置 of Telegram 频道/群组
"""

import os
import sys
import json
import time
import datetime
import logging
import threading
import requests
import telebot
from telebot import types

# 禁用未验证 HTTPS 请求的警告 (在 Termux 环境下可能因证书链不完整导致请求报错，此举增强兼容性)
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# 配置日志
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# 文件存储配置
CONFIG_FILE = 'config.json'
HISTORY_FILE = 'history.json'

# 六合彩波色数据字典
RED_WAVE = [1, 2, 7, 8, 12, 13, 18, 19, 23, 24, 29, 30, 34, 35, 40, 45, 46]
BLUE_WAVE = [3, 4, 9, 10, 14, 15, 20, 25, 26, 31, 36, 37, 41, 42, 47, 48]
GREEN_WAVE = [5, 6, 11, 16, 17, 21, 22, 27, 28, 32, 33, 38, 39, 43, 44, 49]

# 获取号码的波色
def get_color(num):
    if num in RED_WAVE: return "🔴 红波"
    if num in BLUE_WAVE: return "🔵 蓝波"
    return "🟢 绿波"

# 判断特码大小 (六合彩 1-24 为小，25-48 为大，49 为和)
def get_big_small(num):
    if num == 49:
        return "和"
    return "🔥 大" if num >= 25 else "❄️ 小"

# 判断单双
def get_odd_even(num):
    return "⚡ 单" if num % 2 != 0 else "🌙 双"

# 默认基础配置
default_config = {
    "bot_token": "YOUR_TELEGRAM_BOT_TOKEN",
    "admin_id": "YOUR_TELEGRAM_ADMIN_CHAT_ID",
    "channel_id": "@YOUR_CHANNEL_USERNAME",
    "api_url": "https://history.macaumarksix.com/history/macaujc3"
}

def load_config():
    if not os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(default_config, f, indent=4, ensure_ascii=False)
        logger.info(f"已创建默认配置文件 {CONFIG_FILE}，请先配置它！")
        return default_config
    with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
        try:
            return json.load(f)
        except Exception as e:
            logger.error(f"解析 config.json 失败: {e}")
            return default_config

config = load_config()

# 检查 Token 是否配置
if config["bot_token"] == "YOUR_TELEGRAM_BOT_TOKEN" or not config["bot_token"]:
    print("❌ 错误: 请先在 config.json 中配置您的 Telegram Bot Token！")
    print("您可以使用 Termux 中的命令修改: nano config.json")
    sys.exit(1)

# 初始化 Bot
bot = telebot.TeleBot(config["bot_token"], parse_mode='HTML')

# 内存数据结构，保存当日历史记录
history_db = {
    "date": "",       # 用于跨天清理，格式: YYYY-MM-DD
    "records": []     # 存放开奖结果字典列表，按期数倒序排 (最新在前)
}

# 加载本地保存的开奖记录
def load_history():
    global history_db
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
                if data.get("date") and isinstance(data.get("records"), list):
                    history_db = data
                    logger.info(f"成功载入已缓存的开奖数据，日期: {history_db['date']}，共 {len(history_db['records'])} 期")
                    return
            except Exception as e:
                logger.error(f"读取开奖历史文件失败: {e}")
                
    history_db = {
        "date": "",
        "records": []
    }
    save_history()

# 保存历史数据到本地
def save_history():
    with open(HISTORY_FILE, 'w', encoding='utf-8') as f:
        json.dump(history_db, f, indent=4, ensure_ascii=False)

# 清除所有今日数据
def clear_today_data():
    global history_db
    history_db = {
        "date": history_db.get("date", ""),
        "records": []
    }
    save_history()
    logger.info("=== 今日数据已成功清空清零，重新开始累积计数 ===")

# 基于最新50期开奖记录做统计算法，预测下一期的【大小、单双、波色】
def analyze_and_predict():
    records = history_db["records"]
    if len(records) < 50:
        return None, None
    
    # 仅提取最近50期
    target_records = records[:50]
    
    big_count = 0
    small_count = 0
    odd_count = 0
    even_count = 0
    red_count = 0
    blue_count = 0
    green_count = 0
    
    for r in target_records:
        spec = r.get("special_num", 0)
        # 大小统计
        if spec != 49:
            if spec >= 25: big_count += 1
            else: small_count += 1
        # 单双
        if spec % 2 != 0: odd_count += 1
        else: even_count += 1
        # 波色
        if spec in RED_WAVE: red_count += 1
        elif spec in BLUE_WAVE: blue_count += 1
        elif spec in GREEN_WAVE: green_count += 1
        
    # === 统计预测模型：均值回归 (Regression to the Mean) ===
    # 核心算法：在样本总量充足时，出现频率明显低于期望均值的属性在下期出现的概率偏高。
    
    # 大小预测
    pred_big_small = "🔥 大" if big_count < small_count else "❄️ 小"
    # 单双预测
    pred_odd_even = "⚡ 单" if odd_count < even_count else "🌙 双"
    
    # 波色预测 (找出开出次数最少的那种颜色作为冷门回归推荐)
    color_stats = [
        {"color": "🔴 红波", "count": red_count},
        {"color": "🔵 蓝波", "count": blue_count},
        {"color": "🟢 绿波", "count": green_count}
    ]
    color_stats.sort(key=lambda x: x["count"])
    pred_color = color_stats[0]["color"] # 开得最少的
    
    latest_expect = records[0]["expect"]
    try:
        next_expect = str(int(latest_expect) + 1)
    except:
        next_expect = "下一"
        
    stats = {
        "big_count": big_count,
        "small_count": small_count,
        "odd_count": odd_count,
        "even_count": even_count,
        "red_count": red_count,
        "blue_count": blue_count,
        "green_count": green_count,
        "pred_big_small": pred_big_small,
        "pred_odd_even": pred_odd_even,
        "pred_color": pred_color
    }
    
    return next_expect, stats

# 获取今日已开期数进度的辅助函数 (以期号最后3位为准，如20260717357代表第357期)
def get_today_progress(expect_str):
    if expect_str and len(expect_str) >= 11 and expect_str[-3:].isdigit():
        return int(expect_str[-3:])
    return None

# 格式化精美的开奖及预测广播
def format_broadcast_message(latest_record, stats, next_expect):
    spec = latest_record["special_num"]
    open_code = latest_record["open_code"]
    expect = latest_record["expect"]
    
    # 解析号码球
    balls = [b.strip() for b in open_code.split(",")]
    if len(balls) >= 7:
        balls_formatted = "  ".join([f"<code>{b}</code>" for b in balls[:6]]) + f"  ➕  <code><b>{balls[6]}</b></code>"
    else:
        balls_formatted = f"<code>{open_code}</code>"
        
    # 获取今日已开期数进度
    today_progress = get_today_progress(expect)
    if today_progress:
        progress_text = f"已开出 <b>{today_progress}</b> / 480 期 (今日首期: <code>001</code>)"
    else:
        progress_text = f"已装载 <b>{len(history_db['records'])}</b> 期"
        
    msg = (
        f"🎰 <b>澳门三分六合彩 · 实时开奖广播</b> 🎰\\n"
        f"━━━━━━━━━━━━━━━━━━━\\n"
        f"📅 <b>当前开奖期号</b>：<code>第 {expect} 期</code>\\n"
        f"⏱️ <b>今日开奖进度</b>：{progress_text}\\n"
        f"━━━━━━━━━━━━━━━━━━━\\n"
        f"🔴 🔵 🟢 <b>最新中奖号码</b> 🟢 🔵 🔴\\n\\n"
        f"👉  {balls_formatted}\\n\\n"
        f"🔮 <b>特码解析</b>：【 <b>{spec:02d}</b> 】号 · {get_color(spec)} · {get_big_small(spec)} · {get_odd_even(spec)}\\n"
        f"━━━━━━━━━━━━━━━━━━━\\n"
        f"📊 <b>历史 50 期冷热数据统计</b>\\n"
        f" ├ <b>大小比率</b>：大 {stats['big_count']} 次 ({stats['big_count']*2}%) | 小 {stats['small_count']} 次 ({stats['small_count']*2}%)\\n"
        f" ├ <b>单双比率</b>：单 {stats['odd_count']} 次 ({stats['odd_count']*2}%) | 双 {stats['even_count']} 次 ({stats['even_count']*2}%)\\n"
        f" └ <b>波色频率</b>：🔴 红 {stats['red_count']} 次 | 🔵 蓝 {stats['blue_count']} 次 | 🟢 绿 {stats['green_count']} 次\\n"
        f"━━━━━━━━━━━━━━━━━━━\\n"
        f"🧠 <b>智能均值回归算法推荐</b>\\n"
        f"🎯 <b>下期预测期数</b>：<code>第 {next_expect} 期</code>\\n\\n"
        f"👉 <b>推荐大小</b>：【 <code>{stats['pred_big_small']}</code> 】 <i>(历史冷热对冲)</i>\\n"
        f"👉 <b>推荐单双</b>：【 <code>{stats['pred_odd_even']}</code> 】 <i>(奇偶均衡修正)</i>\\n"
        f"👉 <b>推荐波色</b>：【 <code>{stats['pred_color']}</code> 】 <i>(极限频率回补)</i>\\n"
        f"━━━━━━━━━━━━━━━━━━━\\n"
        f"🍀 <i>统计规律基于大数定律，仅供参考，请理性娱乐！</i>"
    )
    return msg

# 格式化精美的手动预测结果
def format_predict_message(stats, next_expect):
    msg = (
        f"🔮 <b>澳门三分六合彩 · 下期推荐中心</b> 🔮\\n"
        f"━━━━━━━━━━━━━━━━━━━\\n"
        f"🎯 <b>预测目标期数</b>：<code>第 {next_expect} 期</code>\\n"
        f"━━━━━━━━━━━━━━━━━━━\\n"
        f"📊 <b>冷热概率分布 (50期)</b>\\n"
        f" ├ <b>大小比率</b>：大 {stats['big_count']} 次 ({stats['big_count']*2}%) | 小 {stats['small_count']} 次 ({stats['small_count']*2}%)\\n"
        f" ├ <b>单双比率</b>：单 {stats['odd_count']} 次 ({stats['odd_count']*2}%) | 双 {stats['even_count']} 次 ({stats['even_count']*2}%)\\n"
        f" └ <b>波色频率</b>：🔴 红 {stats['red_count']} 次 | 🔵 蓝 {stats['blue_count']} 次 | 🟢 绿 {stats['green_count']} 次\\n"
        f"━━━━━━━━━━━━━━━━━━━\\n"
        f"🧠 <b>均值回归算法预测推荐</b>\\n"
        f" 👉 <b>大小推荐</b>：【 <code>{stats['pred_big_small']}</code> 】\\n"
        f" 👉 <b>单双推荐</b>：【 <code>{stats['pred_odd_even']}</code> 】\\n"
        f" 👉 <b>波色推荐</b>：【 <code>{stats['pred_color']}</code> 】\\n"
        f"━━━━━━━━━━━━━━━━━━━\\n"
        f"🍀 <i>统计规律仅供参考，合理控制！</i>"
    )
    return msg

# 格式化精美的状态监控消息
def format_status_message(total, date_str, latest_record):
    if total > 0:
        latest_expect = latest_record["expect"]
        today_progress = get_today_progress(latest_expect)
        if today_progress:
            progress_text = f"已装载 <b>{today_progress}</b> / 480 期 (今日首期: <code>001</code>)"
        else:
            progress_text = f"已装载 <b>{total}</b> 期"
        latest_text = f"<code>第 {latest_expect} 期 [{latest_record['open_code']}]</code>"
    else:
        progress_text = f"已装载 <b>0</b> 期"
        latest_text = "今日暂无开奖记录录入"
        
    status_text = (
        f"⚙️ <b>机器人数据监控中心</b>\\n"
        f"━━━━━━━━━━━━━━━━━━━\\n"
        f"📅 <b>当前缓存日期</b>：<code>{date_str}</code>\\n"
        f"📊 <b>今日录入进度</b>：{progress_text}\\n"
        f"🎰 <b>最新开奖结果</b>：{latest_text}\\n"
        f"📡 <b>系统轮询状态</b>：🟢 正常运行中 (每 5s/次)\\n"
        f"📢 <b>广播发送渠道</b>：<code>{config.get('channel_id')}</code>\\n"
        f"━━━━━━━━━━━━━━━━━━━"
    )
    return status_text

# 获取记录日期的辅助函数
def extract_record_date(rec_dict):
    open_time = rec_dict.get("open_time") or rec_dict.get("openTime") or ""
    if open_time and len(open_time) >= 10:
        return open_time[:10]
    expect = rec_dict.get("expect") or ""
    if expect and len(expect) >= 8 and expect[:8].isdigit():
        return f"{expect[:4]}-{expect[4:6]}-{expect[6:8]}"
    return ""

# 提取 API 响应记录列表的辅助函数
def extract_raw_records(res_json):
    if not isinstance(res_json, dict):
        return []
    
    # 结构 1: 直接 POST 响应结构 (res_json["data"]["records"])
    data_val = res_json.get("data")
    if isinstance(data_val, dict):
        records = data_val.get("records")
        if isinstance(records, list):
            return records
            
    # 结构 2: 折叠的列表结构 (res_json["data"][0]["data"])
    if isinstance(data_val, list) and len(data_val) > 0:
        first_item = data_val[0]
        if isinstance(first_item, dict):
            records = first_item.get("data")
            if isinstance(records, list):
                return records
                
    # 结构 3: 顶层 "records"
    records = res_json.get("records")
    if isinstance(records, list):
        return records
        
    return []

# 5秒一次的后台开奖数据拉取线程
def fetch_api_loop():
    logger.info("📡 自动拉取开奖记录线程已成功启动...")
    last_processed_expect = None
    is_first_fetch = True
    
    while True:
        try:
            api_url = config.get("api_url", "https://history.macaumarksix.com/history/macaujc3")
            
            # 在启动首次加载时，请求 500 条历史记录，确保无缝抓取今日所有的开奖历史记录 (全天共 480 期)
            # 后续轮询每次只需拉取 30 条，轻量化节省流量
            page_size = 500 if is_first_fetch else 30
            payload = {
                "pageSize": page_size,
                "pageNum": 1
            }
            headers = {
                "Content-Type": "application/json"
            }
            
            # 必须使用 POST 请求避免 405 Method Not Allowed 错误
            response = requests.post(api_url, json=payload, headers=headers, timeout=12, verify=False)
            
            if response.status_code == 200:
                res_json = response.json()
                raw_items = extract_raw_records(res_json)
                
                if isinstance(raw_items, list) and len(raw_items) > 0:
                    # 1. 解构并转化记录字段
                    incoming_records = []
                    for item in raw_items:
                        expect = item.get("expect")
                        open_code = item.get("openCode") or item.get("open_code")
                        open_time = item.get("openTime") or item.get("open_time")
                        
                        if expect and open_code:
                            try:
                                balls = [int(x.strip()) for x in open_code.split(",")]
                                if len(balls) >= 7:
                                    special_num = balls[6]
                                    incoming_records.append({
                                        "expect": str(expect),
                                        "open_code": open_code,
                                        "special_num": special_num,
                                        "open_time": open_time
                                    })
                            except Exception as e:
                                logger.error(f"提取球数据错误 expect {expect}: {e}")
                    
                    if incoming_records:
                        # 确保按期数降序排列（最新在最前）
                        incoming_records.sort(key=lambda x: x["expect"], reverse=True)
                        
                        # 2. 时区免疫：以 API 传回的最新期数日期作为当前日期
                        latest_api_rec = incoming_records[0]
                        latest_date = extract_record_date(latest_api_rec)
                        
                        if not history_db.get("date"):
                            history_db["date"] = latest_date
                            logger.info(f"💾 初始化今日开奖数据缓存日期为: {latest_date}")
                        
                        # 如果检测到 API 的最新开奖属于新的一天 (跨天)
                        elif latest_date and latest_date > history_db["date"]:
                            logger.info(f"🚨 时区同步检测：开奖日期发生跨天变动 {history_db['date']} -> {latest_date}，自动触发0点清零复位...")
                            clear_today_data()
                            history_db["date"] = latest_date
                            save_history()
                            last_processed_expect = None
                        
                        # 3. 筛选并追加属于当前日期的历史数据 (确保今日所有记录完整并且绝对剔除隔天记录)
                        new_count = 0
                        existing_expects = {r["expect"] for r in history_db["records"]}
                        
                        for rec in incoming_records:
                            rec_date = extract_record_date(rec)
                            if rec_date == history_db["date"]:
                                if rec["expect"] not in existing_expects:
                                    history_db["records"].append(rec)
                                    new_count += 1
                        
                        # 4. 重新进行降序排序和持久化
                        if new_count > 0:
                            history_db["records"].sort(key=lambda x: x["expect"], reverse=True)
                            
                            # 最多保留 550 期数据
                            if len(history_db["records"]) > 550:
                                history_db["records"] = history_db["records"][:550]
                                
                            save_history()
                            logger.info(f"✅ 录入新数据：成功捕获并保存了 {new_count} 期开奖记录。当前今日累积录入期数: {len(history_db['records'])} 期")
                        
                        # 5. 首次拉取成功后，关闭 cold-start 大包获取开关
                        if is_first_fetch:
                            is_first_fetch = False
                            
                        # 6. 新期触发预测与 Telegram 推送
                        if len(history_db["records"]) > 0:
                            latest_record = history_db["records"][0]
                            if last_processed_expect != latest_record["expect"]:
                                last_processed_expect = latest_record["expect"]
                                
                                spec = latest_record["special_num"]
                                logger.info(f"🎯 第 {latest_record['expect']} 期最新开奖结果: {latest_record['open_code']} (特码: {spec:02d} | {get_color(spec)} | {get_big_small(spec)} | {get_odd_even(spec)})")
                                
                                # 只有今日累积开奖期数达到 50 期以上，才发出包含下期预测的广播
                                if len(history_db["records"]) >= 50:
                                    next_exp, stats = analyze_and_predict()
                                    post_msg = format_broadcast_message(latest_record, stats, next_exp)
                                    
                                    channel_id = config.get("channel_id")
                                    if channel_id and channel_id != "@YOUR_CHANNEL_USERNAME":
                                        try:
                                            bot.send_message(channel_id, post_msg, disable_web_page_preview=True)
                                            logger.info(f"📣 [广播] 已成功将第 {next_exp} 期的统计预测自动推送至频道 {channel_id}")
                                        except Exception as e:
                                            logger.error(f"❌ [广播] 自动广播推送失败: {e}")
                                else:
                                    logger.info(f"⏳ 当前今日累积仅有 {len(history_db['records'])}/50 期开奖，未达到统计学预测阈值，略过下期预测推送。")
                                    
        except Exception as e:
            logger.error(f"📡 拉取轮询遇到错误: {e}")
            
        time.sleep(5) # 5秒一次轮询

# === Telegram 机器人管理员交互命令 ===

# 权限鉴权辅助函数
def is_admin(user_id):
    admin_id = str(config.get("admin_id", ""))
    if not admin_id:
        return True 
    return str(user_id) == admin_id

@bot.message_handler(commands=['start', 'help'])
def send_welcome(message):
    welcome_text = (
        "🤖 <b>澳门三分六合彩统计学预测机器人管理员</b>\\n\\n"
        "程序已在 Termux 后台稳定启动，每5秒主动拉取最新开奖源。\\n"
        "今日开奖数据将在 <b>每日0点</b> 自动触发清零重建，确保每日统计均值无滞后偏移。\\n\\n"
        "📊 <b>实时状态命令：</b>\\n"
        "➡️ /status - 查看当前数据累积进度与最新一期开奖情况\\n"
        "➡️ /predict - [全员] 手动运算并获取下一期【大小、单双、波色】预测\\n"
        "➡️ /broadcast - [管理员] 强制立即生成当前预测并群发到订阅频道\\n"
        "➡️ /reset - [管理员] 立即手动清空清零今日的所有开奖历史\\n\\n"
        "💡 <i>提示: 本程序专为 Termux 部署打造，无任何前端开销，极度省电。</i>"
    )
    bot.reply_to(message, welcome_text)

@bot.message_handler(commands=['status'])
def handle_status(message):
    total = len(history_db["records"])
    date_str = history_db["date"]
    latest_record = history_db["records"][0] if total > 0 else None
    
    status_text = format_status_message(total, date_str, latest_record)
    bot.reply_to(message, status_text)

@bot.message_handler(commands=['predict'])
def handle_predict(message):
    total = len(history_db["records"])
    if total < 50:
        bot.reply_to(message, f"⚠️ 数据收集不足以启动均值统计分析！当前今日收集: <b>{total}/50</b> 期，请稍等数分钟。")
        return
        
    next_exp, stats = analyze_and_predict()
    resp = format_predict_message(stats, next_exp)
    bot.reply_to(message, resp)

@bot.message_handler(commands=['broadcast'])
def handle_broadcast(message):
    if not is_admin(message.from_user.id):
        bot.reply_to(message, "❌ 权限拒绝：此命令仅限配置的管理员 ID 使用。")
        return
        
    total = len(history_db["records"])
    if total < 50:
        bot.reply_to(message, f"❌ 无法广播：当前累积开奖仅 <code>{total}/50</code> 期，未达到预测阈值！")
        return
        
    target_chat = config.get("channel_id")
    if not target_chat or target_chat == "@YOUR_CHANNEL_USERNAME":
        bot.reply_to(message, "⚠️ 未在 config.json 中配置有效的频道ID！正在发回到当前对话做模拟。")
        target_chat = message.chat.id
        
    bot.send_message(message.chat.id, "⏳ 正在分析冷热趋势...")
    
    try:
        next_exp, stats = analyze_and_predict()
        latest_record = history_db["records"][0]
        post_msg = format_broadcast_message(latest_record, stats, next_exp)
        
        sent = bot.send_message(target_chat, post_msg, disable_web_page_preview=True)
        bot.send_message(message.chat.id, f"✅ 已成功向 {target_chat} 推送第 {next_exp} 期预测！(消息ID: {sent.message_id})")
    except Exception as e:
        bot.reply_to(message, f"❌ 推送失败: {e}")

@bot.message_handler(commands=['reset'])
def handle_reset(message):
    if not is_admin(message.from_user.id):
        bot.reply_to(message, "❌ 权限拒绝：此命令仅限配置的管理员 ID 使用。")
        return
        
    clear_today_data()
    bot.reply_to(message, "✅ <b>手动清零成功！</b>今日的缓存历史开奖数据已被彻底清除，正在开始全新累加记数。")


if __name__ == '__main__':
    # 1. 载入本地持久化开奖缓存
    load_history()
    
    # 2. 启动 5秒/次 API 异步拉取轮询守护线程
    t = threading.Thread(target=fetch_api_loop, daemon=True)
    t.start()
    
    # 3. 启动 Telegram 机器人主线程 Polling
    print("==========================================")
    print("🤖 澳门三分六合彩自动预测机器人已启动！")
    print(f"📡 监听接口：{config.get('api_url')}")
    print(f"👥 管理员 ID：{config.get('admin_id') or '未配置(所有人均可管理员操作)'}")
    print(f"📢 广播目标：{config.get('channel_id')}")
    print("🚀 正在 Termux 下建立长轮询连接，随时可以关闭 SSH 终端挂机运行。")
    print("==========================================")
    
    try:
        bot.infinity_polling(timeout=20, long_polling_timeout=25)
    except Exception as e:
        logger.error(f"Telegram Polling 遇到故障退出: {e}")
`

export const defaultJsonConfig = `{
    "bot_token": "填入你的_Telegram_Bot_Token",
    "admin_id": "填入你的_Telegram用户数字ID",
    "channel_id": "@填入你的频道公网用户名_或_群组ID",
    "api_url": "https://history.macaumarksix.com/history/macaujc3"
}`

export const termuxStartScript = `#!/data/data/com.termux/files/usr/bin/bash
# 自动守护启动机器人脚本 - start.sh
# 运行指令: bash start.sh

echo "=========================================="
echo "==== 澳门三分六合彩自动预测机器人启动 ===="
echo "=========================================="

# 1. 检测 Python 环境与依赖
if ! command -v python3 &> /dev/null; then
    echo "❌ 发现手机未安装 Python 3，正在自动安装..."
    pkg update -y && pkg install python -y
fi

# 2. 检测 pyTelegramBotAPI 与 requests
python3 -c "import telebot" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "📦 正在使用 pip 安装 pyTelegramBotAPI 与 requests 依赖库..."
    pip install pyTelegramBotAPI requests
fi

# 3. 检查配置文件
if [ ! -f "config.json" ]; then
    echo "⚠️ 配置文件 config.json 不存在！正在生成默认模板..."
    if [ -f "config.json.example" ]; then
        cp config.json.example config.json
        echo "已从 config.json.example 复制默认配置。"
    else
        echo '{"bot_token": "填入你的_Telegram_Bot_Token", "admin_id": "填入你的_Telegram用户数字ID", "channel_id": "@填入你的频道公网用户名_或_群组ID", "api_url": "https://history.macaumarksix.com/history/macaujc3"}' > config.json
    fi
    echo "=========================================="
    echo "💡 [提示] 请先编辑 config.json 文件配置你的 Token 与 ID！"
    echo "手机编辑指令: nano config.json"
    echo "=========================================="
    nano config.json
fi

# 4. 后台不挂断挂机启动
echo "🚀 正在使用 nohup 将机器人挂入后台安全长连接守护..."
nohup python3 bot.py > bot.log 2>&1 &

echo "=========================================="
echo "✅ 机器人已放入后台挂机！即使断开SSH，机器人依然在运行。"
echo "📄 实时日志监控: tail -f bot.log"
echo "🛑 停止运行脚本: killall python3"
echo "=========================================="
`
