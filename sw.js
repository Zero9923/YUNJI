// sw.js - 允纯机系统服务
self.addEventListener('install', (e) => {
    console.log('允纯机系统已就绪');
    self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
    // 开发阶段暂不拦截缓存，方便调试
    return;
});
