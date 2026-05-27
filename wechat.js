// wechat.js - 允纯机社交内核：修复图标 / 面具极简列表 / 增加编辑功能

const WeChatApp = {
    db: null,
    data: {
        avatarId: null,
        id: '用户',
        bio: '一厢情愿、心甘情愿',
        currentTab: 'me',
        masks: [] 
    },

    tempFile: null,
    editingMaskId: null, // 记录当前正在编辑的面具ID

    // 1. 初始化数据库
    async initDB() {
        return new Promise(res => {
            const req = indexedDB.open("YCJ_STORE", 1);
            req.onupgradeneeded = e => e.target.result.createObjectStore("assets");
            req.onsuccess = e => { this.db = e.target.result; res(); };
        });
    },

    async saveBlob(id, blob) {
        const tx = this.db.transaction("assets", "readwrite");
        return new Promise(r => { tx.objectStore("assets").put(blob, id); tx.oncomplete = r; });
    },
    async getBlob(id) {
        if(!id) return null;
        const tx = this.db.transaction("assets", "readonly");
        return new Promise(res => { tx.objectStore("assets").get(id).onsuccess = e => res(e.target.result); });
    },

    async init() {
        await this.initDB();
        const saved = JSON.parse(localStorage.getItem('wechat_data')) || {};
        this.data = { ...this.data, ...saved };
        if(!Array.isArray(this.data.masks)) this.data.masks = [];
    },

    async render() {
        await this.init();
        const style = `
            <style>
                #wechat-app { position: fixed; top: 0; left: 0; width: 100%; height: 100dvh; background: #F9F9F9; z-index: 9999; display: none; flex-direction: column; }
                .wc-content { flex: 1; overflow-y: auto; padding: 20px; }
                
                /* 面具列表页 */
                #wc-sub-page { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #F9F9F9; z-index: 10001; display: none; flex-direction: column; }
                .sub-header { padding: 50px 20px 15px; display: flex; align-items: center; justify-content: space-between; background: #FFF; border-bottom: 1px solid #F2F2F2; }
                .sub-header .btn { width: 28px; height: 28px; fill: #666; cursor: pointer; }
                .sub-header .title { font-size: 16px; font-weight: 500; color: #333; letter-spacing: 1px; }

                .mask-list { padding: 15px; overflow-y: auto; flex: 1; }
                .mask-item { background: #FFF; padding: 15px; border-radius: 15px; display: flex; align-items: center; gap: 15px; margin-bottom: 10px; border: 1px solid #F2F2F2; cursor: pointer; }
                .mask-item-avatar { width: 45px; height: 45px; border-radius: 50%; background: #F0F0F0; background-size: cover; background-position: center; flex-shrink: 0; }
                .mask-item-name { flex: 1; font-size: 15px; color: #333; font-weight: 500; }
                .mask-item-del { color: #CCC; font-size: 22px; padding: 5px; cursor: pointer; }

                /* 弹窗 */
                .wc-modal-mask { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.3); z-index: 10002; display: none; align-items: center; justify-content: center; }
                .wc-modal { background: #FFF; width: 85%; border-radius: 28px; padding: 35px 25px; display: flex; flex-direction: column; align-items: center; }
                .modal-avatar-up { width: 85px; height: 85px; border-radius: 50%; background: #F5F5F5; margin-bottom: 25px; display: flex; align-items: center; justify-content: center; background-size: cover; border: 1px solid #EEE; overflow: hidden; }
                .modal-input { width: 100%; border: none; border-bottom: 1px solid #EEE; padding: 12px 0; margin-bottom: 15px; outline: none; font-size: 15px; border-radius: 0; }
                .modal-btns { display: flex; width: 100%; gap: 15px; margin-top: 10px; }
                .m-btn { flex: 1; padding: 14px; text-align: center; border-radius: 14px; font-size: 14px; cursor: pointer; }
                .m-btn.cancel { background: #F5F5F5; color: #999; }
                .m-btn.confirm { background: #1a1a1a !important; color: #FFF !important; }

                /* 个人名片与列表 */
                .wc-me-card { background: #FFF; border-radius: 20px; padding: 25px; display: flex; align-items: flex-start; gap: 20px; border: 1px solid #F0F0F0; margin-top: 40px; }
                .wc-avatar { width: 70px; height: 70px; border-radius: 50%; background: #F0F2F5; background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                .wc-info { flex: 1; }
                .wc-id { font-size: 18px; font-weight: 500; color: #1a1a1a; margin-bottom: 5px; cursor: pointer; }
                .wc-bio { font-size: 13px; color: #999; line-height: 1.5; cursor: pointer; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
                .wc-list { margin-top: 25px; display: flex; flex-direction: column; gap: 12px; }
                .wc-list-item { background: #FFF; padding: 18px 20px; border-radius: 14px; display: flex; align-items: center; gap: 15px; border: 1px solid #F2F2F2; cursor: pointer; }
                .wc-list-icon { width: 22px; height: 22px; fill: #BBB; }
                .wc-list-text { font-size: 15px; color: #444; }

                /* TabBar */
                .wc-tabbar { height: 85px; background: rgba(255,255,255,0.9); backdrop-filter: blur(20px); border-top: 1px solid #F0F0F0; display: flex; justify-content: space-around; align-items: center; padding-bottom: env(safe-area-inset-bottom); }
                .wc-tab { display: flex; flex-direction: column; align-items: center; gap: 6px; color: #BBB; cursor: pointer; }
                .wc-tab.active { color: #1a1a1a; }
                .wc-tab svg { width: 24px; height: 24px; fill: currentColor; }
                .wc-tab span { font-size: 10px; font-weight: 500; }
                
                #wc-busy { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255,255,255,0.7); z-index: 10005; display: none; align-items: center; justify-content: center; letter-spacing: 2px; font-size: 12px; }
            </style>
        `;

        const html = `
            <div id="wc-busy">SAVING...</div>
            <div id="wechat-app">
                <div class="wc-content" id="wc-main-view"></div>
                <div class="wc-tabbar">
                    <div class="wc-tab" onclick="WeChatApp.switchTab('chat')"><svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12l4 4V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg><span>聊天</span></div>
                    <div class="wc-tab" onclick="WeChatApp.switchTab('contacts')"><svg viewBox="0 0 24 24"><path d="M9 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4zm11-4V7h-2v3h-3v2h3v3h2v-3h3v-2h-3z"/></svg><span>通讯录</span></div>
                    <div class="wc-tab" onclick="WeChatApp.switchTab('discovery')"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm4.59-12.42L10 10.74l-3.17 6.84L14 14.41l3.17-6.83h-.58zM12 13.1c-.61 0-1.1-.49-1.1-1.1s.49-1.1 1.1-1.1 1.1.49 1.1 1.1-.49 1.1-1.1 1.1z"/></svg><span>发现</span></div>
                    <div class="wc-tab" onclick="WeChatApp.switchTab('me')"><svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg><span>个人</span></div>
                </div>

                <div id="wc-sub-page">
                    <div class="sub-header">
                        <svg class="btn" onclick="WeChatApp.closeSubPage()" viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
                        <div class="title">我的面具</div>
                        <svg class="btn" onclick="WeChatApp.showModal()" viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                    </div>
                    <div class="mask-list" id="mask-list-view"></div>
                </div>

                <div class="wc-modal-mask" id="mask-modal">
                    <div class="wc-modal">
                        <div class="modal-avatar-up" id="modal-avatar-btn" onclick="document.getElementById('m-picker').click()">
                            <svg viewBox="0 0 24 24"><path fill="#DDD" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                        </div>
                        <input type="text" id="m-name" class="modal-input" placeholder="面具名称">
                        <input type="text" id="m-bio" class="modal-input" placeholder="设定 (不限字数)">
                        <div class="modal-btns">
                            <div class="m-btn cancel" onclick="WeChatApp.hideModal()">取消</div>
                            <div class="m-btn confirm" onclick="WeChatApp.saveMask()">确定</div>
                        </div>
                    </div>
                </div>
            </div>
            <input type="file" id="u-picker" style="display:none" accept="image/*">
            <input type="file" id="m-picker" style="display:none" accept="image/*">
        `;

        document.body.insertAdjacentHTML('beforeend', style + html);
        this.switchTab(this.data.currentTab);
        document.getElementById('u-picker').onchange = e => this.handleFile(e, 'user');
        document.getElementById('m-picker').onchange = e => this.handleFile(e, 'mask');
    },

    async switchTab(tab) {
        this.data.currentTab = tab;
        const view = document.getElementById('wc-main-view');
        const tabs = document.querySelectorAll('.wc-tab');
        const list = ['chat', 'contacts', 'discovery', 'me'];
        tabs.forEach((t, i) => t.classList.toggle('active', list[i] === tab));

        if (tab === 'me') {
            const blob = await this.getBlob(this.data.avatarId);
            const url = blob ? URL.createObjectURL(blob) : null;
            view.innerHTML = this.renderMePage(url);
            this.bindMeEvents();
        } else if (tab === 'contacts') {
            view.innerHTML = this.renderContactsPage();
        } else {
            view.innerHTML = `<div style="padding:100px 0; text-align:center; color:#CCC; font-size:12px; font-weight:300;">COMING SOON</div>`;
        }
    },

    renderMePage(avatarUrl) {
        const bg = avatarUrl ? `style="background-image:url(${avatarUrl})"` : '';
        const icon = avatarUrl ? '' : `<svg viewBox="0 0 24 24"><path fill="#CCC" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
        return `
            <div class="wc-me-card">
                <div class="wc-avatar" id="wc-avatar-btn" ${bg}>${icon}</div>
                <div class="wc-info">
                    <div class="wc-id" onclick="WeChatApp.edit('id')">${this.data.id}</div>
                    <div class="wc-bio" onclick="WeChatApp.edit('bio')">${this.data.bio}</div>
                </div>
            </div>
            <div class="wc-list">
                <!-- 🚀 核心：戏剧面具图标修复 -->
                <div class="wc-list-item" onclick="WeChatApp.openMaskPage()">
                    <svg class="wc-list-icon" viewBox="0 0 24 24"><path d="M21 5c-1.11 0-2.02.82-2.15 1.88a1.05 1.05 0 0 0-.14-.13C17.39 5.48 15.81 5 14.21 5c-1.6 0-3.18.48-4.51 1.75-.1.1-.19.23-.29.35C9.28 6.04 8.27 5 7 5a3 3 0 0 0-3 3c0 1.66 1.34 3 3 3 .35 0 .67-.06.97-.17.67.64 1.46 1.15 2.34 1.48C9.51 13.06 9 14.44 9 16c0 3.31 2.69 6 6 6s6-2.69 6-6c0-1.56-.51-2.94-1.31-3.69.88-.33 1.67-.84 2.34-1.48.3.11.62.17.97.17 1.66 0 3-1.34 3-3a3 3 0 0 0-3-3z"/></svg>
                    <div class="wc-list-text">面具</div>
                </div>
                <div class="wc-list-item"><svg class="wc-list-icon" viewBox="0 0 24 24"><path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8z"/></svg><div class="wc-list-text">钱包</div></div>
                <div class="wc-list-item"><svg class="wc-list-icon" viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z"/></svg><div class="wc-list-text">收藏</div></div>
                <div class="wc-list-item"><svg class="wc-list-icon" viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm0 18c-4.41 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11z"/></svg><div class="wc-list-text">表情</div></div>
            </div>
        `;
    },

    renderContactsPage() {
        return `
            <div style="padding:40px 0 20px; font-size: 22px; font-weight: 300;">CONTACTS</div>
            <div style="display:flex; align-items:center; gap:12px; padding:15px 0; border-bottom:1px solid #F2F2F2;"><div style="width:42px; height:42px; border-radius:12px; background:#D1C1B7; display:flex; align-items:center; justify-content:center; color:#FFF; font-size:12px;">助理</div><div style="font-size:15px; color:#444;">允纯助手</div></div>
            <div style="display:flex; align-items:center; gap:12px; padding:15px 0; border-bottom:1px solid #F2F2F2;"><div style="width:42px; height:42px; border-radius:12px; background:#B7C1D1; display:flex; align-items:center; justify-content:center; color:#FFF; font-size:12px;">文件</div><div style="font-size:15px; color:#444;">文件传输助手</div></div>
        `;
    },

    // --- 面具逻辑 ---
    async openMaskPage() { document.getElementById('wc-sub-page').style.display = 'flex'; await this.renderMaskList(); },
    closeSubPage() { document.getElementById('wc-sub-page').style.display = 'none'; },

    async renderMaskList() {
        const view = document.getElementById('mask-list-view');
        view.innerHTML = this.data.masks.length ? '' : `<div style="text-align:center; padding:50px; color:#DDD; font-size:12px;">暂无面具</div>`;
        for (let m of this.data.masks) {
            const blob = await this.getBlob(m.avatarId);
            const url = blob ? URL.createObjectURL(blob) : '';
            const row = document.createElement('div');
            row.className = 'mask-item';
            // 🚀 核心修复：列表只显示头像和名字，点击可修改
            row.innerHTML = `
                <div class="mask-item-avatar" style="background-image:url(${url})"></div>
                <div class="mask-item-name" onclick="WeChatApp.editMask('${m.id}')">${m.name}</div>
                <div class="mask-item-del" onclick="WeChatApp.deleteMask('${m.id}', event)">×</div>
            `;
            view.appendChild(row);
        }
    },

    // 🚀 核心修复：点击面具列表进入修改模式
    async editMask(id) {
        const mask = this.data.masks.find(m => m.id === id);
        if(!mask) return;
        this.editingMaskId = id;
        this.showModal();
        document.getElementById('m-name').value = mask.name;
        document.getElementById('m-bio').value = mask.bio;
        const blob = await this.getBlob(mask.avatarId);
        if(blob) {
            document.getElementById('modal-avatar-btn').innerHTML = '';
            document.getElementById('modal-avatar-btn').style.backgroundImage = `url(${URL.createObjectURL(blob)})`;
        }
    },

    async saveMask() {
        const name = document.getElementById('m-name').value;
        const bio = document.getElementById('m-bio').value;
        if(!name) return alert('请输入名字');
        document.getElementById('wc-busy').style.display = 'flex';

        if(this.editingMaskId) {
            // 修改已有面具
            const idx = this.data.masks.findIndex(m => m.id === this.editingMaskId);
            if(this.tempFile) {
                const newAvatarId = 'img_' + Date.now();
                await this.saveBlob(newAvatarId, this.tempFile);
                this.data.masks[idx].avatarId = newAvatarId;
            }
            this.data.masks[idx].name = name;
            this.data.masks[idx].bio = bio;
        } else {
            // 新建面具
            const maskId = 'm_' + Date.now();
            const avatarId = this.tempFile ? 'img_' + Date.now() : null;
            if(this.tempFile) await this.saveBlob(avatarId, this.tempFile);
            this.data.masks.push({ id: maskId, name, bio, avatarId });
        }

        this.save(); await this.renderMaskList(); this.hideModal();
        document.getElementById('wc-busy').style.display = 'none';
    },

    async deleteMask(id, e) {
        e.stopPropagation();
        if(confirm('删除？')) {
            const mask = this.data.masks.find(m => m.id === id);
            if(mask.avatarId) { const tx = this.db.transaction("assets", "readwrite"); tx.objectStore("assets").delete(mask.avatarId); }
            this.data.masks = this.data.masks.filter(m => m.id !== id);
            this.save(); await this.renderMaskList();
        }
    },

    handleFile(e, type) {
        const file = e.target.files[0]; if(!file) return;
        this.tempFile = file;
        const url = URL.createObjectURL(file);
        if(type === 'user') {
            const avatarId = 'u_a_' + Date.now();
            this.saveBlob(avatarId, file).then(() => { this.data.avatarId = avatarId; this.save(); this.switchTab('me'); });
        } else {
            const btn = document.getElementById('modal-avatar-btn');
            btn.innerHTML = ''; btn.style.backgroundImage = `url(${url})`;
        }
    },

    showModal() { document.getElementById('mask-modal').style.display = 'flex'; },
    hideModal() { 
        document.getElementById('mask-modal').style.display = 'none'; 
        this.tempFile = null; this.editingMaskId = null;
        document.getElementById('modal-avatar-btn').innerHTML = `<svg viewBox="0 0 24 24"><path fill="#DDD" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`; 
        document.getElementById('modal-avatar-btn').style.backgroundImage = 'none';
        document.getElementById('m-name').value = ''; document.getElementById('m-bio').value = '';
    },
    edit(f) { const v = prompt('修改', this.data[f]); if(v) { this.data[f] = v; this.save(); this.switchTab('me'); } },
    save() { localStorage.setItem('wechat_data', JSON.stringify(this.data)); },
    open() { document.getElementById('wechat-app').style.display = 'flex'; this.switchTab('me'); },
    close() { document.getElementById('wechat-app').style.display = 'none'; },
    bindMeEvents() {
        const btn = document.getElementById('wc-avatar-btn'); let t = null;
        btn.addEventListener('touchstart', () => t = setTimeout(() => document.getElementById('u-picker').click(), 600));
        btn.addEventListener('touchend', () => clearTimeout(t));
    }
};
WeChatApp.render();
