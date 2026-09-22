#!/data/data/com.termux/files/usr/bin/bash
# 自动守护启动机器人脚本 - start.sh
# 运行指令: bash start.sh

echo "=========================================="
echo "==== 澳门三分六合彩自动预测机器人启动 ===="
echo "=========================================="

# 1. 开启后台唤醒锁（防止手机休眠导致网络中断、Bot无反应）
if command -v termux-wake-lock &> /dev/null; then
    termux-wake-lock
    echo "⚡ 已开启 Termux 唤醒锁 (termux-wake-lock)，防止手机待机断网休眠。"
fi

# 2. 检测 Python 环境与依赖
if ! command -v python3 &> /dev/null; then
    echo "❌ 发现手机未安装 Python 3，正在自动安装..."
    pkg update -y && pkg install python -y
fi

# 3. 检测 pyTelegramBotAPI 与 requests
python3 -c "import telebot, requests" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "📦 正在使用 pip 安装依赖库 (pyTelegramBotAPI, requests)..."
    pip install pyTelegramBotAPI requests urllib3
fi

# 4. 检查配置文件
if [ ! -f "config.json" ]; then
    echo "⚠️ 配置文件 config.json 不存在！正在生成默认模板..."
    if [ -f "config.json.example" ]; then
        cp config.json.example config.json
        echo "已从 config.json.example 复制默认配置。"
    else
        echo '{"bot_token": "填入你的_Telegram_Bot_Token", "admin_id": "填入你的_Telegram用户数字ID", "channel_id": "@填入你的频道公网用户名_或_群组ID", "api_url": "https://history.macaumarksix.com/history/macaujc3", "proxy": "", "telegram_api_endpoint": ""}' > config.json
    fi
    echo "=========================================="
    echo "💡 [提示] 请先编辑 config.json 文件配置你的 Token 与 ID！"
    echo "手机编辑指令: nano config.json"
    echo "=========================================="
    nano config.json
fi

# 5. 校验 config.json 是否已填入有效 Token（防止空配置导致静默退出并产生“无反应”假象）
python3 -c '
import json, sys
try:
    with open("config.json", "r", encoding="utf-8") as f:
        c = json.load(f)
    tok = str(c.get("bot_token", "")).strip()
    if not tok or tok in ["YOUR_TELEGRAM_BOT_TOKEN", "填入你的_Telegram_Bot_Token"]:
        print("TOKEN_NOT_CONFIGURED")
        sys.exit(1)
except Exception as e:
    print(f"JSON_ERROR: {e}")
    sys.exit(1)
' 2>/dev/null

if [ $? -ne 0 ]; then
    echo "❌ 错误: 您尚未在 config.json 中配置有效的 bot_token！"
    echo "👉 请运行命令配置: nano config.json"
    echo "将 bot_token 修改为您在 @BotFather 申请的真实 Token，保存后重新执行 bash start.sh"
    exit 1
fi

# 6. 清理旧的僵尸 bot 进程（避免双进程冲突导致 409 Conflict 并引发“bot无反应”）
OLD_PIDS=$(pgrep -f "python.*bot.py" | grep -v $$)
if [ -n "$OLD_PIDS" ]; then
    echo "🔄 检测到已有正在运行的机器人进程 ($OLD_PIDS)，正在重启重置..."
    kill -9 $OLD_PIDS 2>/dev/null
    sleep 1
fi

# 7. 后台启动与健康守护
echo "🚀 正在启动机器人长轮询守护进程..."
nohup python3 bot.py > bot.log 2>&1 &
BOT_PID=$!

# 等待 2 秒检测进程是否真正存活
sleep 2

if kill -0 $BOT_PID 2>/dev/null; then
    echo "=========================================="
    echo "✅ 机器人已成功启动并在后台安全挂机！(PID: $BOT_PID)"
    echo "📄 实时日志监控: tail -f bot.log"
    echo "🛑 停止运行脚本: pkill -f bot.py"
    echo "=========================================="
    echo "📋 启动初期日志截取："
    tail -n 8 bot.log
else
    echo "=========================================="
    echo "❌ 启动失败！机器人进程异常退出，原因排查日志："
    echo "------------------------------------------"
    cat bot.log | tail -n 15
    echo "------------------------------------------"
    echo "💡 常见原因："
    echo "  1. 大陆网络连不上 api.telegram.org -> 请在 config.json 配置 proxy 代理地址；"
    echo "  2. Token 填错或过期 -> 请检查 @BotFather 提供的 Token。"
    exit 1
fi
