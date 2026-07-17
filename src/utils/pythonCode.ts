export const pythonBotCode = `#!/usr/bin/env python3
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
    today_str = datetime.date.today().strftime("%Y-%m-%d")
    
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
                # 如果文件中的日期是今天，则载入
                if data.get("date") == today_str:
                    history_db = data
                    logger.info(f"成功载入今日已缓存的开奖数据，共 {len(history_db['records'])} 期")
                    return
                else:
                    logger.info("检测到缓存数据为过往日期，正在触发0点清空复位机制...")
            except Exception as e:
                logger.error(f"读取开奖历史文件失败: {e}")
                
    # 否则初始化全新一天的空数据库
    history_db = {
        "date": today_str,
        "records": []
    }
    save_history()

# 保存历史数据到本地
def save_history():
    with open(HISTORY_FILE, 'w', encoding='utf-8') as f:
        json.dump(history_db, f, indent=4, ensure_ascii=False)

# 清除所有今日数据 (每日0点自动或管理员手动调用)
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
    
    # 获取最新的期数
    latest_expect = records[0]["expect"]
    try:
        next_expect = str(int(latest_expect) + 1)
    except:
        next_expect = "下一"
        
    # 组织精美的分析文案
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
            # 1. 跨天检测 (0点自动复位)
            today_str = datetime.date.today().strftime("%Y-%m-%d")
            if history_db["date"] != today_str:
                logger.info(f"检测到日期发生更替 {history_db['date']} -> {today_str}，正在触发0点自动复位...")
                clear_today_data()
                last_processed_expect = None
            
            # 2. 发起 API 请求
            api_url = config.get("api_url", "https://history.macaumarksix.com/history/macaujc3")
            response = requests.get(api_url, timeout=10, verify=False)
            
            if response.status_code == 200:
                res_json = response.json()
                if res_json.get("result") and "data" in res_json:
                    # 按照用户给的 JSON 层级进行安全解析
                    # data 是一个数组，里面是具体的三分六合彩对象，里面还有个 data
                    outer_data = res_json["data"]
                    if isinstance(outer_data, list) and len(outer_data) > 0:
                        inner_data_list = outer_data[0].get("data", [])
                        
                        if isinstance(inner_data_list, list) and len(inner_data_list) > 0:
                            # 按照期号升序存储，确保我们可以正确按照开奖先后加入
                            # 接口返回的通常最新一期在第一位，我们反转一下或进行去重处理
                            incoming_records = []
                            for item in inner_data_list:
                                expect = item.get("expect")
                                open_code = item.get("openCode") # 格式 "20,40,23,09,27,14,18"
                                open_time = item.get("openTime")
                                
                                if expect and open_code:
                                    # 提取第七个球作为特码 (Special Number)
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
                            
                            # 进行增量写入与排重
                            new_count = 0
                            existing_expects = {r["expect"] for r in history_db["records"]}
                            
                            for rec in incoming_records:
                                if rec["expect"] not in existing_expects:
                                    # 插入到最前面
                                    history_db["records"].insert(0, rec)
                                    new_count += 1
                                    
                            # 限制今日最大存储量为 550 期 (三分彩每日最多480期，多存一点没关系)
                            if len(history_db["records"]) > 550:
                                history_db["records"] = history_db["records"][:550]
                                
                            if new_count > 0:
                                # 按期数重新降序排，确保最新期数永远在最前面 records[0]
                                history_db["records"].sort(key=lambda x: x["expect"], reverse=True)
                                save_history()
                                logger.info(f"发现新开奖期！成功录入 {new_count} 期。当前总共录入: {len(history_db['records'])}/50 期")
                                
                                # 触发：检测到最新开奖变化且数据量达到50期，进行自动预测和广播发送
                                latest_record = history_db["records"][0]
                                if last_processed_expect != latest_record["expect"]:
                                    last_processed_expect = latest_record["expect"]
                                    
                                    # 打印最新开出的结果
                                    spec = latest_record["special_num"]
                                    logger.info(f"第 {latest_record['expect']} 期最新开奖结果: {latest_record['open_code']} (特码: {spec} | {get_big_small(spec)} | {get_odd_even(spec)} | {get_color(spec)})")
                                    
                                    # 自动预测下一期
                                    if len(history_db["records"]) >= 50:
                                        next_exp, pred_text = analyze_and_predict()
                                        
                                        # 格式化推送到 Telegram 频道
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
                                        
                                        # 发送广播
                                        channel_id = config.get("channel_id")
                                        if channel_id and channel_id != "@YOUR_CHANNEL_USERNAME":
                                            try:
                                                bot.send_message(channel_id, post_msg, disable_web_page_preview=True)
                                                logger.info(f"已成功将第 {next_exp} 期的统计预测自动广播推送至 {channel_id}")
                                            except Exception as e:
                                                logger.error(f"自动广播推送失败: {e}")
                                                
        except Exception as e:
            logger.error(f"拉取轮询遇到错误: {e}")
            
        time.sleep(5) # 5秒一次轮询

# === Telegram 机器人管理员交互命令 ===

# 权限鉴权辅助函数
def is_admin(user_id):
    admin_id = str(config.get("admin_id", ""))
    if not admin_id:
        return True # 如果没配置，则默认全部放开
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

echo "==== 澳门三分六合彩自动预测机器人启动 ===="

# 1. 检测 Python 环境与依赖
if ! command -v python3 &> /dev/null; then
    echo "❌ 发现手机未安装 Python 3，正在自动安装..."
    pkg update -y && pkg install python -y
fi

# 2. 检测 pyTelegramBotAPI 与 requests
python3 -c "import telebot" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "📦 正在安装 pyTelegramBotAPI 依赖库..."
    pip install pyTelegramBotAPI requests
fi

# 3. 检查配置文件
if [ ! -f "config.json" ]; then
    echo "⚠️ 配置文件 config.json 不存在！正在生成默认模板，请使用 nano 修改..."
    echo '{"bot_token": "", "admin_id": "", "channel_id": "@your_channel_username", "api_url": "https://history.macaumarksix.com/history/macaujc3"}' > config.json
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
