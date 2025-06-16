// hk45Adapter.js
const axios = require('axios');

// 获取域名配置
const DOMAIN_API_URL = process.env.DOMAIN_API_URL;
const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });

module.exports = {
  
  // 解析歌曲信息的通用方法
  async parseMusicInfo(mp3Id, url) {
    const formData = new URLSearchParams({ id: mp3Id, type: 'dance' });
    const res = await axios.post('http://www.78497.com/style/js/play.php', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Referer': url || 'http://www.78497.com',
        'Origin': 'http://www.78497.com',
        'Host': 'www.78497.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000,
      httpsAgent: agent
    });
    const musicInfo = res.data;
    if (!musicInfo || typeof musicInfo === 'string') throw new Error('未匹配到歌曲信息');

    return {
      musicName: musicInfo.name,
      artistName: musicInfo.singer,
      title: musicInfo.title,
      lrc: musicInfo.lrc?.replace(/时代音乐网/g, '').replace(/www\.78497\.com/, '随身听'),
      cover: musicInfo.pic,
      downloadUrl: musicInfo.url,
      source: '78497.com',
      sourceUrl: url,
      sourceId: mp3Id,
      createTime: new Date(),
      updateTime: new Date(),
      status: 0,
      isDelete: 0
    };
  },

  // 提取URL内容
  async extractContent(url) {
    // 验证URL格式并提取mp3Id
    const urlObj = new URL(url);
      
    // 从路径中提取mp3Id，例如 /mp3/mdhmwk.html -> mdhmwk
    const pathMatch = urlObj.pathname.match(/\/mp3\/(.+?)\.html$/);
    if (!pathMatch) {
      throw new Error('无效的链接地址');
    }
    
    const mp3Id = pathMatch[1];
    // 调用通用的歌曲解析方法
    return await this.parseMusicInfo(mp3Id, url);
  }
};
