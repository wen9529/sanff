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

  // API Route: Diagnose Telegram Bot status, Webhook conflicts, and group privacy
  app.post('/api/telegram/check_bot', async (req: Request, res: Response) => {
    const { botToken } = req.body;
    if (!botToken) {
      res.status(400).json({ success: false, error: '缺少 botToken 参数' });
      return;
    }

    try {
      // 1. Get Me (identity & permissions)
      const meUrl = `https://api.telegram.org/bot${botToken}/getMe`;
      const meResp = await fetch(meUrl);
      const meData = await meResp.json();

      if (!meResp.ok || !meData.ok) {
        res.status(400).json({
          success: false,
          error: meData.description || 'Token 无效或无法连接 Telegram 服务器',
          details: meData
        });
        return;
      }

      // 2. Get Webhook info
      const hookUrl = `https://api.telegram.org/bot${botToken}/getWebhookInfo`;
      const hookResp = await fetch(hookUrl);
      const hookData = await hookResp.json();

      const botInfo = meData.result;
      const hookInfo = hookData.result || {};

      res.json({
        success: true,
        botInfo: {
          id: botInfo.id,
          username: botInfo.username,
          first_name: botInfo.first_name,
          can_join_groups: botInfo.can_join_groups,
          can_read_all_group_messages: botInfo.can_read_all_group_messages ?? false,
          supports_inline_queries: botInfo.supports_inline_queries
        },
        webhookInfo: {
          url: hookInfo.url || '',
          has_custom_certificate: hookInfo.has_custom_certificate || false,
          pending_update_count: hookInfo.pending_update_count || 0,
          last_error_message: hookInfo.last_error_message || ''
        }
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: `体检诊断请求失败: ${err.message}`
      });
    }
  });

  // API Route: Delete Webhook to fix 409 conflict
  app.post('/api/telegram/delete_webhook', async (req: Request, res: Response) => {
    const { botToken } = req.body;
    if (!botToken) {
      res.status(400).json({ success: false, error: '缺少 botToken 参数' });
      return;
    }

    try {
      const delUrl = `https://api.telegram.org/bot${botToken}/deleteWebhook?drop_pending_updates=true`;
      const delResp = await fetch(delUrl);
      const delData = await delResp.json();

      if (delResp.ok && delData.ok) {
        res.json({ success: true, message: '已成功清除 Webhook 并重置积压更新！' });
      } else {
        res.status(400).json({ success: false, error: delData.description || '清除 Webhook 失败' });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: `操作失败: ${err.message}` });
    }
  });

  // API Route: Proxy request to real Macau Mark Six history API
  app.post('/api/lottery/history', async (req: Request, res: Response) => {
    const { pageSize = 50, pageNum = 1, apiUrl = 'https://history.macaumarksix.com/history/macaujc3' } = req.body;
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*'
        },
        body: JSON.stringify({ pageSize, pageNum })
      });

      if (!response.ok) {
        res.status(response.status).json({
          success: false,
          error: `上游接口 HTTP ${response.status} 错误`
        });
        return;
      }

      const data = await response.json();
      res.json({
        success: true,
        data: data
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: `代理拉取开奖数据失败: ${err.message}`
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
