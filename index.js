const express = require('express');
const cors = require('cors');
require('dotenv').config();

// 引用复制到本地的 musicAdapter
const musicAdapter = require('./services/musicAdapter');

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 健康检查接口
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'music-bridge-service' });
});

// 提取音乐内容接口
app.post('/api/extract-content', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'URL参数不能为空'
      });
    }

    console.log('extract-content', url)

    const result = await musicAdapter.extractUrlContent(url);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('提取内容失败:', error);
    res.status(400).json({
      success: false,
      message: error.message || '提取内容失败'
    });
  }
});

// 检查URL是否支持
app.post('/api/check-url', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'URL参数不能为空'
      });
    }

    const isSupported = await musicAdapter.isUrlSupported(url);
    
    res.json({
      success: true,
      data: { isSupported }
    });
  } catch (error) {
    console.error('检查URL失败:', error);
    res.status(400).json({
      success: false,
      message: error.message || '检查URL失败'
    });
  }
});

// 适配音乐接口
app.post('/api/adapt-music', async (req, res) => {
  try {
    const { id, source, sourceId, sourceUrl } = req.body;
    
    if (!id || !source || !sourceId || !sourceUrl) {
      return res.status(400).json({
        success: false,
        message: '音乐信息不完整'
      });
    }

    console.log('adapt-music', id, sourceUrl)

    const result = await musicAdapter.adaptMusic({ id, source, sourceId, sourceUrl });
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('适配音乐失败:', error);
    res.status(400).json({
      success: false,
      message: error.message || '适配音乐失败'
    });
  }
});

// 错误处理中间件
app.use((error, req, res, next) => {
  console.error('服务器错误:', error);
  res.status(500).json({
    success: false,
    message: '服务器内部错误'
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在'
  });
});

app.listen(PORT, () => {
  console.log(`音乐桥接服务启动成功，端口: ${PORT}`);
});

module.exports = app;