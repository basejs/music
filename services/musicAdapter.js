// musicAdapter.js
// 适配不同音乐检索站点的统一接口
const hk45Adapter = require('./adapters/hk45Adapter');
const adapter78497 = require('./adapters/78497Adapter');
const eev3Adapter = require('./adapters/eev3Adapter');

class MusicAdapter {
  constructor() {
    // 域名到适配器的映射
    this.adapterMap = new Map([
      ['www.45hk.com', hk45Adapter],
      ['45hk.com', hk45Adapter],
      ['78497.com', adapter78497],
      ['www.78497.com', adapter78497],
      ['www.eev3.com', eev3Adapter],
      ['eev3.com', eev3Adapter],
      // 未来可扩展更多适配器映射
    ]);
    // 本地适配器单独处理一下
    this.adapterMapLocal = new Map([
      ['www.45hk.com', hk45Adapter],
      ['45hk.com', hk45Adapter],
    ]);
  }

  // 检查URL是否属于已适配的网站
  isUrlSupported(url) {
    if (!url) return false;
    
    try {
      const inputUrl = new URL(url);

      // 直接匹配
      return this.adapterMap.has(inputUrl.hostname)
    } catch (e) {
      console.error(e)
      return false;
    }
  }

  // 根据URL获取对应的适配器
  getAdapterByUrl(url) {
    if (!url) return null;
    
    try {
      const urlObj = new URL(url);
      return this.adapterMap.get(urlObj.hostname);
    } catch (e) {
      return null;
    }
  }

  // 搜索音乐
  async searchMusic({ musicName, artistName }) {

    // 遍历启用的网站，按优先级顺序查找有search方法的适配器
    for (const website of this.enabledWebsites) {
      try {
        const siteUrl = new URL(website.website_url);
        const adapter = this.adapterMap.get(siteUrl.hostname);
        
        if (adapter && typeof adapter.search === 'function') {
          return await adapter.search({ musicName, artistName });
        }
      } catch (e) {
        // 忽略URL解析错误，继续下一个
        continue;
      }
    }
    
    throw new Error('音乐检索失败');
  }

  // 提取URL内容
  async extractUrlContent(url) {

    if (!url) {
      throw new Error('URL不能为空');
    }
    
    // 检查是否为支持的网站
    const isSupported = this.isUrlSupported(url);
    if (!isSupported) {
      throw new Error('请参照链接指引输入链接地址');
    }
    
    // 根据域名直接获取对应的适配器
    const adapter = this.getAdapterByUrl(url);
    if (adapter && adapter.extractContent) {
      return adapter.extractContent(url);
    } else {
      console.error(`没有${url}对应的适配器`);
      throw new Error('没有提取到有效的歌曲信息');
    }
  }

  // 适配音乐信息，根据source获取最新的下载链接
  async adaptMusic(existingMusic) {
    if (!existingMusic || !existingMusic.source || !existingMusic.sourceId) {
      console.error(`音乐信息不完整: ${existingMusic.id}`);
      throw new Error('音乐信息不完整');
    }

    // 根据source字段找到对应的适配器
    let adapter = this.adapterMap.get(existingMusic.source);

    if (!adapter) {
      console.error(`未找到source为${existingMusic.source}的适配器`);
      throw new Error(`未找到当前音乐的适配器`);
    }

    // 调用适配器的parseMusicInfo方法获取最新信息
    if (typeof adapter.parseMusicInfo === 'function') {
      return await adapter.parseMusicInfo(existingMusic.sourceId, existingMusic.sourceUrl);
    } else {
      console.error(`source为${existingMusic.source}的适配器不支持parseMusicInfo方法`);
      throw new Error(`适配器缺失解析音乐方法`);
    }
  }
}

// 创建单例实例
const musicAdapter = new MusicAdapter();

module.exports = {
  searchMusic: (params) => musicAdapter.searchMusic(params),
  extractUrlContent: (url) => musicAdapter.extractUrlContent(url),
  isUrlSupported: (url) => musicAdapter.isUrlSupported(url),
  adaptMusic: (existingMusic) => musicAdapter.adaptMusic(existingMusic),
  adapterMap: musicAdapter.adapterMap,
  adapterMapLocal: musicAdapter.adapterMapLocal,
};
