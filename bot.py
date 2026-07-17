#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
香港/澳门三分六合彩自动预测 Telegram 机器人 - Termux 专属部署版
- 每5秒自动拉取最新开奖接口 (支持自定源)
- 每天0点自动清空开奖记录重新累积
- 累积满50期后自动启动统计学冷热与均值回归算法，预测下一期的【大小、单双、波色】
- 新期开奖时，自动推送到配置的 Telegram 频道/群组
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

# 禁用未验证 HTTPS 请求的警告
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

# 判断特码大小
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
    "date": "",       
    "records": []     
}

# 加载本地保存的开奖记录
def load_history():
    global history_db
    today_str = datetime.date.today().strftime("%Y-%m-%d")
    
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
                if data.get("date") == today_str:
                    history_db = data
                    logger.info(f"成功载入今日已缓存的开奖数据，共 {len(history_db['records'])} 期")
                    return
                else:
                    logger.info("检测到缓存数据为过往日期，正在触发0点清空复位机制...")
            except Exception as e:
                logger.error(f"读取开奖历史文件失败: {e}")
                
    history_db = {
        "date": today_str,
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
    today_str = datetime.date.today().strftime("%Y-%m-%d")
    history_db = {
        "date": today_str,
        "records": []
    }
    save_history()
    logger.info("=== 今日数据已成功清空清零，重新开始累积计数 ===")

# 基于最新50期开奖记录做统计算法，预测下一期的【大小、单双、波色】
def analyze_and_predict():
    records = history_db["records"]
    if len(records) < 50:
        return None, f"数据不足 (当前仅有: {len(records)}/50 期)，无法进行统计分析预测。"
    
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
        if spec != 49:
            if spec >= 25: big_count += 1
            else: small_count += 1
        if spec % 2 != 0: odd_count += 1
        else: even_count += 1
        if spec in RED_WAVE: red_count += 1
        elif spec in BLUE_WAVE: blue_count += 1
        elif spec in GREEN_WAVE: green_count += 1
        
    pred_big_small = "🔥 大" if big_count < small_count else "❄️ 小"
    pred_odd_even = "⚡ 单" if odd_count < even_count else "🌙 双"
    
    color_stats = [
        {"color": "🔴 红波", "count": red_count},
        {"color": "🔵 蓝波", "count": blue_count},
        {"color": "🟢 绿波", "count": green_count}
    ]
    color_stats.sort(key=lambda x: x["count"])
    pred_color = color_stats[0]["color"] 
    
    latest_expect = records[0]["expect"]
    try:
        next_expect = str(int(latest_expect) + 1)
    except:
        next_expect = "下一"
        
    analysis_report = (
        f"📊 <b>最新50期综合概率分布</b>：\\n"
        f" ├ <b>大小比率</b>: 大 {big_count}次 ({big_count*2}%) | 小 {small_count}次 ({small_count*2}%)\\n"
        f" ├ <b>单双比率</b>: 单 {odd_count}次 ({odd_count*2}%) | 双 {even_count}次 ({even_count*2}%)\\n"
        f" └ <b>波色频率</b>: 红 {red_count}次 | 蓝 {blue_count}次 | 绿 {green_count}次\\n\\n"
        f"🧠 <b>均值回归算法推荐</b> (第 <b>{next_expect}</b> 期)：\\n"
        f" 🎯 <b>推荐大小</b>：【 <b>{pred_big_small}</b> 】<i>(历史冷热对冲)</i>\\n"
        f" 🎯 <b>推荐单双</b>：【 <b>{pred_odd_even}</b> 】<i>(奇偶均衡修正)</i>\\n"
        f" 🎯 <b>推荐波色</b>：【 <b>{pred_color}</b> 】<i>(极限频率回补)</i>"
    )
    
    return next_expect, analysis_report

# 5秒一次的后台开奖数据拉取线程
def fetch_api_loop():
    logger.info("📡 自动拉取开奖记录线程已成功启动...")
    last_processed_expect = None
    
    while True:
        try:
            today_str = datetime.date.today().strftime("%Y-%m-%d")
            if history_db["date"] != today_str:
                logger.info(f"检测到日期发生更替 {history_db['date']} -> {today_str}，正在触发0点自动复位...")
                clear_today_data()
                last_processed_expect = None
            
            api_url = config.get("api_url", "https://history.macaumarksix.com/history/macaujc3")
            response = requests.get(api_url, timeout=10, verify=False)
            
            if response.status_code == 200:
                res_json = response.json()
                if res_json.get("result") and "data" in res_json:
                    outer_data = res_json["data"]
                    if isinstance(outer_data, list) and len(outer_data) > 0:
                        inner_data_list = outer_data[0].get("data", [])
                        
                        if isinstance(inner_data_list, list) and len(inner_data_list) > 0:
                            incoming_records = []
                            for item in inner_data_list:
                                expect = item.get("expect")
                                open_code = item.get("openCode") 
                                open_time = item.get("openTime")
                                
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
                            
                            new_count = 0
                            existing_expects = {r["expect"] for r in history_db["records"]}
                            
                            for rec in incoming_records:
                                if rec["expect"] not in existing_expects:
                                    history_db["records"].insert(0, rec)
                                    new_count += 1
                                    
                            if len(history_db["records"]) > 550:
                                history_db["records"] = history_db["records"][:550]
                                
                            if new_count > 0:
                                history_db["records"].sort(key=lambda x: x["expect"], reverse=True)
                                save_history()
                                logger.info(f"发现新开奖期！成功录入 {new_count} 期。当前总共录入: {len(history_db['records'])}/50 期")
                                
                                latest_record = history_db["records"][0]
                                if last_processed_expect != latest_record["expect"]:
                                    last_processed_expect = latest_record["expect"]
                                    
                                    spec = latest_record["special_num"]
                                    logger.info(f"第 {latest_record['expect']} 期最新开奖结果: {latest_record['open_code']} (特码: {spec} | {get_big_small(spec)} | {get_odd_even(spec)} | {get_color(spec)})")
                                    
                                    if len(history_db["records"]) >= 50:
                                        next_exp, pred_text = analyze_and_predict()
                                        
                                        post_msg = (
                                            f"🔔 <b>澳门三分六合彩 - 开奖广播与下期预测</b> 🔔\\n"
                                            f"━━━━━━━━━━━━━━━━━━━\\n"
                                            f"📅 <b>当前开奖期号</b>：第 <b>{latest_record['expect']}</b> 期\\n"
                                            f"🎰 <b>开奖号码</b>：<code>{latest_record['open_code']}</code>\\n"
                                            f"🎯 <b>特码解析</b>：【 <b>{latest_record['special_num']:02d}</b> 】号 ({get_color(spec)} | {get_big_small(spec)} | {get_odd_even(spec)})\\n"
                                            f"━━━━━━━━━━━━━━━━━━━\\n\\n"
                                            f"{pred_text}\\n\\n"
                                            f"🍀 <i>统计规律仅供参考，请理性娱乐！</i> 🍀"
                                        )
                                        
                                        channel_id = config.get("channel_id")
                                        if channel_id and channel_id != "@YOUR_CHANNEL_USERNAME":
                                            try:
                                                bot.send_message(channel_id, post_msg, disable_web_page_preview=True)
                                                logger.info(f"已成功将第 {next_exp} 期的统计预测自动广播推送至 {channel_id}")
                                            except Exception as e:
                                                logger.error(f"自动广播推送失败: {e}")
                                                
        except Exception as e:
            logger.error(f"拉取轮询遇到错误: {e}")
            
        time.sleep(5) 

# === Telegram 机器人管理员交互命令 ===

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
        "今日开奖数据将在 <b>每日0点</b> 自动触发清零重建。\\n\\n"
        "📊 <b>实时状态命令：</b>\\n"
        "➡️ /status - 查看当前数据累积进度与最新一期开奖情况\\n"
        "➡️ /predict - [全员] 手动运算并获取下一期预测\\n"
        "➡️ /broadcast - [管理员] 强制立即生成当前预测并群发到订阅频道\\n"
        "➡️ /reset - [管理员] 立即手动清空清零今日的所有开奖历史\\n\\n"
        "💡 <i>提示: 本程序专为 Termux 部署打造，无任何前端开销。</i>"
    )
    bot.reply_to(message, welcome_text)

@bot.message_handler(commands=['status'])
def handle_status(message):
    total = len(history_db["records"])
    date_str = history_db["date"]
    
    if total > 0:
        latest = history_db["records"][0]
        latest_text = f"第 <code>{latest['expect']}</code> 期 (结果: <code>{latest['open_code']}</code>)"
    else:
        latest_text = "今日暂无开奖记录录入"
        
    status_text = (
        "📊 <b>机器人当前数据状态监控</b>：\\n\\n"
        f"📅 <b>当前缓存日期</b>: <code>{date_str}</code>\\n"
        f"📈 <b>已录入期数</b>: <code>{total}</code> / 50 (够50期即开通预测)\\n"
        f"🎰 <b>最新开奖结果</b>: {latest_text}\\n"
        f"📡 <b>API 轮询频率</b>: 5秒/次\\n"
        f"📢 <b>广播发送频道</b>: <code>{config.get('channel_id')}</code>"
    )
    bot.reply_to(message, status_text)

@bot.message_handler(commands=['predict'])
def handle_predict(message):
    total = len(history_db["records"])
    if total < 50:
        bot.reply_to(message, f"⚠️ 数据收集不足以启动均值统计分析！当前收集: <b>{total}/50</b> 期，请稍等数分钟。")
        return
        
    next_exp, pred_text = analyze_and_predict()
    resp = (
        f"✨ <b>澳门三分六合彩预测中心</b> ✨\\n"
        f"🎯 <b>目标预测期数</b>：第 <b>{next_exp}</b> 期\\n"
        f"━━━━━━━━━━━━━━━━━━━\\n"
        f"{pred_text}"
    )
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
        next_exp, pred_text = analyze_and_predict()
        latest_record = history_db["records"][0]
        spec = latest_record["special_num"]
        
        post_msg = (
            f"🔔 <b>澳门三分六合彩 - 开奖广播与下期预测</b> 🔔\\n"
            f"━━━━━━━━━━━━━━━━━━━\\n"
            f"📅 <b>当前开奖期号</b>：第 <b>{latest_record['expect']}</b> 期\\n"
            f"🎰 <b>开奖号码</b>：<code>{latest_record['open_code']}</code>\\n"
            f"🎯 <b>特码解析</b>：【 <b>{latest_record['special_num']:02d}</b> 】号 ({get_color(spec)} | {get_big_small(spec)} | {get_odd_even(spec)})\\n"
            f"━━━━━━━━━━━━━━━━━━━\\n\\n"
            f"{pred_text}\\n\\n"
            f"🍀 <i>统计规律仅供参考，请理性娱乐！</i> 🍀"
        )
        
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
    load_history()
    
    t = threading.Thread(target=fetch_api_loop, daemon=True)
    t.start()
    
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
