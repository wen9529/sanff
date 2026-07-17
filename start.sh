#!/data/data/com.termux/files/usr/bin/bash
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
