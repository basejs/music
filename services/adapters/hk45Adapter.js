// hk45Adapter.js
const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });

// 获取域名配置
const DOMAIN_API_URL = process.env.DOMAIN_API_URL;

module.exports = {
  
  // 解析歌曲信息的通用方法
  async parseMusicInfo(mp3Id, url) {
    const formData = new URLSearchParams({ id: mp3Id, type: 'music' });
    const res = await axios.post('http://www.45hk.com/js/play.php', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Origin': 'http://www.45hk.com',
        'Host': 'www.45hk.com',
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
      source: '45hk.com',
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

  // 从搜索结果中找出最相关的歌曲
  findBestMatch(songItems, musicName, artistName) {
    if (!songItems || songItems.length === 0) return null;
    
    // 设置最低相关性阈值，低于此分数的结果被视为不相关
    const MIN_RELEVANCE_THRESHOLD = 20;
    
    const candidates = [];
    songItems.each((index, item) => {
      const $ = cheerio.load(item);
      const mp3A = $('a[target="_mp3"]');
      if (mp3A.length > 0) {
        const text = mp3A.text();
        const link = mp3A.attr('href');
        const id = link.split('/').pop().split('.').shift();
        
        // 计算相关性得分
        let score = 0;
        
        // 使用正则表达式从标题中提取歌曲名和歌手名
        const extractedMusicName = /《(.+?)》/.exec(text)?.[1];
        const extractedArtistName = /(.+?)《/.exec(text)?.[1]?.trim();
        
        // 如果能够从标题中提取到歌曲名
        if (extractedMusicName) {
          const lowerExtractedMusicName = extractedMusicName.toLowerCase();
          const lowerMusicName = musicName.toLowerCase();
          
          // 1. 歌曲名匹配度评分
          if (lowerExtractedMusicName === lowerMusicName) {
            // 完全匹配给最高分
            score += 60;
          } else if (lowerExtractedMusicName.includes(lowerMusicName) || lowerMusicName.includes(lowerExtractedMusicName)) {
            // 部分匹配给中等分数
            score += 40;
          }
        } else {
          // 如果无法提取歌曲名，使用整个文本进行匹配
          const lowerText = text.toLowerCase();
          const lowerMusicName = musicName.toLowerCase();
          
          if (lowerText.includes(lowerMusicName)) {
            score += 30;
          }
        }
        
        // 2. 歌手名匹配度评分（如果提供了歌手名）
        if (artistName && extractedArtistName) {
          const lowerExtractedArtistName = extractedArtistName.toLowerCase();
          const lowerArtistName = artistName.toLowerCase();
          
          if (lowerExtractedArtistName === lowerArtistName) {
            // 完全匹配给最高分
            score += 50;
          } else if (lowerExtractedArtistName.includes(lowerArtistName) || lowerArtistName.includes(lowerExtractedArtistName)) {
            // 部分匹配给中等分数
            score += 30;
          }
        } else if (artistName) {
          // 如果无法提取歌手名但提供了歌手名，使用整个文本进行匹配
          const lowerText = text.toLowerCase();
          const lowerArtistName = artistName.toLowerCase();
          
          if (lowerText.includes(lowerArtistName)) {
            score += 20;
          }
        }
        
        // 3. Live版本降低优先级
        if (text.toLowerCase().includes('live') || text.includes('现场') || text.includes('演唱会')) {
          score -= 15;
        }
        
        candidates.push({ text, link, id, score, extractedMusicName, extractedArtistName });
      }
    });
    
    // 按得分排序
    candidates.sort((a, b) => b.score - a.score);
    
    // 检查最高得分是否达到最低相关性阈值
    if (candidates.length > 0 && candidates[0].score >= MIN_RELEVANCE_THRESHOLD) {
      return candidates[0];
    }
    
    // 如果没有达到最低相关性阈值，返回null表示没有找到相关结果
    return null;
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
  },

  // 具体的检索实现
  async search({ musicName, artistName }) {
    const searchUrl = `http://www.45hk.com/so/${encodeURIComponent(`${musicName}${artistName ? `-${artistName}` : ''}`)}.html`;
    const resp = await axios.get(searchUrl, { timeout: 10000 });
    const pageContent = resp.data;
    if (!pageContent) throw new Error('未找到匹配的歌曲');
    let mp3Text = null;
    let mp3Id = null;
    try {
      const $ = cheerio.load(pageContent);
      const songItems = $('.play_list ul li').slice(0, 10); // 获取前10条结果
      
      if (songItems.length === 0) {
        throw new Error('未找到歌曲');
      }
      
      // 匹配最相关结果
      const bestMatch = this.findBestMatch(songItems, musicName, artistName);
      if (bestMatch) {
        mp3Text = bestMatch.text;
        mp3Id = bestMatch.id;
      }
    } catch (e) {
      throw new Error('未找到歌曲');
    }
    if (!mp3Text || !mp3Id) throw new Error('未找到歌曲');
    
    // 调用通用的歌曲解析方法
    return await this.parseMusicInfo(mp3Id, `http://www.45hk.com/play/${mp3Id}.html`);
  }
};
