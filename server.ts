import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON request body parser
  app.use(express.json());

  // API Route: Test sending prediction to a real Telegram bot
  app.post('/api/telegram/test', async (req: Request, res: Response) => {
    const { botToken, chatId, message } = req.body;

    if (!botToken || !chatId || !message) {
      res.status(400).json({
        success: false,
        error: '缺少必要参数 (botToken, chatId 或 message)'
      });
      return;
    }

    try {
      // Direct request to Telegram Bot API
      const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
      
      const response = await fetch(telegramUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML'
        })
      });

      const data = await response.json();

      if (response.ok && data.ok) {
        res.json({
          success: true,
          message: '测试消息发送成功！',
          data: data.result
        });
      } else {
        res.status(400).json({
          success: false,
          error: data.description || 'Telegram 接口返回错误。',
          details: data
        });
      }
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: `服务器代理请求失败: ${err.message}`
      });
    }
  });

  // Vite middleware or Static files serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Fullstack Server] Running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start fullstack server:', err);
});
