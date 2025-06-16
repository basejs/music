// hk45Adapter.js
const axios = require('axios');
const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });

// 获取域名配置
const DOMAIN_API_URL = process.env.DOMAIN_API_URL;

module.exports = {
  
  // 解析歌曲信息的通用方法
  async parseMusicInfo(mp3Id, url) {
    const formData = new URLSearchParams({ id: mp3Id, type: 'music' });
    const res = await axios.post('https://www.eev3.com/js/play.php', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Origin': 'https://www.eev3.com',
        'Host': 'www.eev3.com',
        'Referer': url,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 10000,
      httpsAgent: agent
    });
    const musicInfo = res.data;
    if (!musicInfo || typeof musicInfo === 'string') throw new Error('未匹配到歌曲信息');
    
    // 使用正则表达式从标题中提取歌曲名和歌手名
    const extractedMusicName = /《(.+?)》/.exec(musicInfo.title)?.[1];
    const extractedArtistName = /(.+?)《/.exec(musicInfo.title)?.[1]?.trim();
    
    const result = {
      musicName: extractedMusicName,
      artistName: extractedArtistName,
      title: musicInfo.title,
      lrc: undefined,
      cover: musicInfo.pic,
      downloadUrl: musicInfo.url,
      source: 'eev3.com',
      sourceId: mp3Id,
      sourceUrl: url,
      createTime: new Date(),
      updateTime: new Date(),
      status: 0,
      isDelete: 0
    };

    if (musicInfo.lkid) {
      try {
        const lrcRes = await axios.get(`https://js.eev3.com/lrc.php?cid=${musicInfo.lkid}`);
        const lrc = lrcRes.data?.lrc?.replace(/www\.45hk\.com/g, '随身听');
        result.lrc = lrc;
      } catch (e) {
        console.error(e);
      }
    }
    
    // 入库
    return result
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
