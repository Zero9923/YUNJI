// wechat.js - 允纯机社交内核：修复面具保存逻辑 / 深度数据兼容

const WeChatApp = {
    // 1. 健壮的初始化：防止旧数据导致 push 失败
    initData() {
        const defaults = {
            avatar: null,
            id: '用户',
            bio: '一厢情愿、心甘情愿',
            currentTab: 'me',
            masks: [] // 确保列表一定存在
        };
        const saved = JSON.parse(localStorage.getItem('wechat_data')) || {};
        // 核心修复：用新默认值补全旧数据
        this.data = { ...defaults, ...saved };
        if (!Array.isArray(this.data.masks)) this.data.masks = [];
    },

    tempMaskAvatar: null,

    render() {
        this.initData();
        const style = `
            <style>
                #wechat-app {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100dvh;
                    background: #F9F9F9; z-index: 9999; display: none; flex-direction: column;
                    font-family: -apple-system, sans-serif;
                }
                .wc-content { flex: 1; overflow-y: auto; position: relative; padding: 20px; }

                /* --- 面具子页 --- */
                #wc-sub-page {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: #F9F9F9; z-index: 10001; display: none; flex-direction: column;
                }
                .sub-header {
                    padding: 50px 20px 15px; display: flex; align-items: center; justify-content: space-between;
                    background: #FFF; border-bottom: 1px solid #F2F2F2;
                }
                .sub-header .btn { width: 28px; height: 28px; fill: #666; cursor: pointer; }
                .sub-header .title { font-size: 16px; font-weight: 500; color: #333; }

                .mask-list { padding: 15px; flex: 1; overflow-y: auto; }
                .mask-item {
                    background: #FFF; padding: 12px 15px; border-radius: 12px;
                    display: flex; align-items: center; gap: 12px; margin-bottom: 10px;
                    border: 1px solid #F2F2F2;
                }
                .mask-item-avatar { width: 45px; height: 45px; border-radius: 50%; background: #EEE; background-size: cover; background-position: center; flex-shrink: 0; }
                .mask-item-info { flex: 1; }
                .mask-item-name { font-size: 15px; color: #333; }
                .mask-item-del { color: #CCC; font-size: 20px; padding: 5px; cursor: pointer; }

                /* --- 弹窗 --- */
                .wc-modal-mask {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(0,0,0,0.3); z-index: 10002;
                    display: none; align-items: center; justify-content: center;
                }
                .wc-modal {
                    background: #FFF; width: 80%; border-radius: 24px; padding: 30px 20px;
                    display: flex; flex-direction: column; align-items: center;
                    animation: modalPop 0.3s cubic-bezier(0.15, 1, 0.3, 1);
                }
                @keyframes modalPop { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
                
                .modal-avatar-up {
                    width: 80px; height: 80px; border-radius: 50%; background: #F5F5F5;
                    margin-bottom: 25px; display: flex; align-items: center; justify-content: center;
                    background-size: cover; background-position: center; border: 1px solid #EEE;
                }
                .modal-avatar-up svg { width: 35px; fill: #DDD; }
                
                .modal-input {
                    width: 100%; border: none; border-bottom: 1px solid #EEE;
                    padding: 12px 0; margin-bottom: 15px; outline: none; font-size: 15px; border-radius: 0;
                }
                .modal-btns { display: flex; width: 100%; gap: 15px; margin-top: 15px; }
                .m-btn { flex: 1; padding: 13px; text-align: center; border-radius: 12px; font-size: 14px; cursor: pointer; }
                .m-btn.cancel { background: #F5F5F5; color: #999; }
                .m-btn.confirm { background: #333; color: #FFF; }

                /* --- 个人主页 --- */
                .wc-me-card { background: #FFF; border-radius: 20px; padding: 25px; display: flex; align-items: flex-start; gap: 20px; border: 1px solid #F0F0F0; margin-top: 40px; }
                .wc-avatar { width: 70px; height: 70px; border-radius: 50%; background: #F0F2F5; background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                .wc-avatar svg { width: 35px; fill: #CCC; }
                .wc-id { font-size: 18px; font-weight: 500; cursor: pointer; color: #1a1a1a; margin-bottom: 5px; }
                .wc-bio { font-size: 13px; color: #999; line-height: 1.5; cursor: pointer; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
                
                .wc-list { margin-top: 25px; display: flex; flex-direction: column; gap: 10px; }
                .wc-list-item { background: #FFF; padding: 16px 20px; border-radius: 12px; display: flex; align-items: center; gap: 15px; border: 1px solid #F2F2F2; cursor: pointer; }
                .wc-list-icon { width: 22px; height: 22px; fill: #BBB; }
                .wc-list-text { font-size: 14px; color: #555; }

                /* 底部 Tab */
                .wc-tabbar { height: 85px; background: rgba(255,255,255,0.9); backdrop-filter: blur(20px); border-top: 1px solid #F0F0F0; display: flex; justify-content: space-around; align-items: center; padding-bottom: env(safe-area-inset-bottom); }
                .wc-tab { display: flex; flex-direction: column; align-items: center; gap: 5px; color: #BBB; cursor: pointer; }
                .wc-tab.active { color: #333; }
                .wc-tab svg { width: 24px; height: 24px; fill: currentColor; }
                .wc-tab span { font-size: 10px; }
            </style>
        `;

        const html = `
            <div id="wechat-app">
                <div class="wc-content" id="wc-main-view"></div>

                <div class="wc-tabbar">
                    <div class="wc-tab" onclick="WeChatApp.switchTab('chat')"><svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12l4 4V4c0-1.1-.9-2-2-2z"/></svg><span>聊天</span></div>
                    <div class="wc-tab" onclick="WeChatApp.switchTab('contacts')"><svg viewBox="0 0 24 24"><path d="M9 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4zm11-4V7h-2v3h-3v2h3v3h2v-3h3v-2h-3z"/></svg><span>通讯录</span></div>
                    <div class="wc-tab" onclick="WeChatApp.switchTab('discovery')"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4.59 16.42L10 10.74l3.17-6.84L14 14.41l-3.17 6.83h.58zM12 13.1c-.61 0-1.1-.49-1.1-1.1s.49-1.1 1.1-1.1 1.1.49 1.1 1.1-.49 1.1-1.1 1.1z"/></svg><span>发现</span></div>
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
                        <div class="modal-avatar-up" id="modal-avatar-btn" onclick="document.getElementById('modal-picker').click()">
                            <svg viewBox="0 0 24 24"><path d="M3 4V1h2v3h3v2H5v3H3V6H0V4h3zm3 6V7h3V4h7l1.83 2H21c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V10h3zm7 9c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5z"/></svg>
                        </div>
                        <input type="text" id="m-name" class="modal-input" placeholder="面具名称">
                        <input type="text" id="m-bio" class="modal-input" placeholder="设定 (最多三行)">
                        <div class="modal-btns">
                            <div class="m-btn cancel" onclick="WeChatApp.hideModal()">取消</div>
                            <div class="m-btn confirm" onclick="WeChatApp.addMask()">确定</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <input type="file" id="wc-avatar-picker" style="display:none" accept="image/*">
            <input type="file" id="modal-picker" style="display:none" accept="image/*">
        `;

        document.body.insertAdjacentHTML('beforeend', style + html);
        this.switchTab(this.data.currentTab);
        this.initEvents();
    },

    initEvents() {
        document.getElementById('wc-avatar-picker').onchange = (e) => this.handleAvatar(e, 'user');
        document.getElementById('modal-picker').onchange = (e) => this.handleAvatar(e, 'mask');
    },

    switchTab(tab) {
        this.data.currentTab = tab;
        const view = document.getElementById('wc-main-view');
        const tabs = document.querySelectorAll('.wc-tab');
        const list = ['chat', 'contacts', 'discovery', 'me'];
        tabs.forEach((t, i) => t.classList.toggle('active', list[i] === tab));

        if (tab === 'me') {
            view.innerHTML = this.renderMePage();
            this.bindMeEvents();
        } else if (tab === 'contacts') {
            view.innerHTML = this.renderContactsPage();
        } else {
            view.innerHTML = `<div style="padding:100px 0; text-align:center; color:#CCC; font-size:12px; letter-spacing:1px;">COMING SOON</div>`;
        }
    },

    renderMePage() {
        const avatarStyle = this.data.avatar ? `background-image:url(${this.data.avatar})` : '';
        const defaultIcon = this.data.avatar ? '' : `<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
        
        return `
            <div class="wc-me-card">
                <div class="wc-avatar" id="wc-avatar-btn" style="${avatarStyle}">${defaultIcon}</div>
                <div class="wc-info">
                    <div class="wc-id" onclick="WeChatApp.edit('id')">${this.data.id}</div>
                    <div class="wc-bio" onclick="WeChatApp.edit('bio')">${this.data.bio}</div>
                </div>
            </div>
            <div class="wc-list">
                <div class="wc-list-item" onclick="WeChatApp.openMaskPage()">
                    <svg class="wc-list-icon" viewBox="0 0 24 24"><path d="M21 5c-1.11 0-2.02.82-2.15 1.88a1.05 1.05 0 0 0-.14-.13C17.39 5.48 15.81 5 14.21 5c-1.6 0-3.18.48-4.51 1.75-.1.1-.19.23-.29.35C9.28 6.04 8.27 5 7 5a3 3 0 0 0-3 3c0 1.66 1.34 3 3 3 .35 0 .67-.06.97-.17.67.64 1.46 1.15 2.34 1.48C9.51 13.06 9 14.44 9 16c0 3.31 2.69 6 6 6s6-2.69 6-6c0-1.56-.51-2.94-1.31-3.69.88-.33 1.67-.84 2.34-1.48.3.11.62.17.97.17 1.66 0 3-1.34 3-3a3 3 0 0 0-3-3z"/></svg>
                    <div class="wc-list-text">面具</div>
                </div>
                <div class="wc-list-item"><svg class="wc-list-icon" viewBox="0 0 24 24"><path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg><div class="wc-list-text">钱包</div></div>
                <div class="wc-list-item"><svg class="wc-list-icon" viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z"/></svg><div class="wc-list-text">收藏</div></div>
                <div class="wc-list-item"><svg class="wc-list-icon" viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11z"/></svg><div class="wc-list-text">表情</div></div>
            </div>
        `;
    },

    renderContactsPage() {
        return `
            <div style="padding:40px 0 20px; font-size: 22px; font-weight: 300; letter-spacing:1px; color:#1a1a1a;">CONTACTS</div>
            <div style="display:flex; align-items:center; gap:12px; padding:15px 0; border-bottom:1px solid #F2F2F2;">
                <div style="width:42px; height:42px; border-radius:12px; background:#D1C1B7; display:flex; align-items:center; justify-content:center; color:#FFF; font-size:12px;">助理</div>
                <div style="font-size:15px; color:#444;">允纯助手</div>
            </div>
            <div style="display:flex; align-items:center; gap:12px; padding:15px 0; border-bottom:1px solid #F2F2F2;">
                <div style="width:42px; height:42px; border-radius:12px; background:#B7C1D1; display:flex; align-items:center; justify-content:center; color:#FFF; font-size:12px;">文件</div>
                <div style="font-size:15px; color:#444;">文件传输助手</div>
            </div>
        `;
    },

    openMaskPage() {
        document.getElementById('wc-sub-page').style.display = 'flex';
        this.renderMaskList();
    },
    closeSubPage() { document.getElementById('wc-sub-page').style.display = 'none'; },
    
    renderMaskList() {
        const listView = document.getElementById('mask-list-view');
        listView.innerHTML = this.data.masks.length ? '' : `<div style="text-align:center; padding:50px; color:#DDD; font-size:13px;">暂无面具</div>`;
        this.data.masks.forEach((m, index) => {
            const row = document.createElement('div');
            row.className = 'mask-item';
            row.innerHTML = `
                <div class="mask-item-avatar" style="background-image:url(${m.avatar})"></div>
                <div class="mask-item-info"><div class="mask-item-name">${m.name}</div></div>
                <div class="mask-item-del" onclick="WeChatApp.deleteMask(${index}, event)">×</div>
            `;
            listView.appendChild(row);
        });
    },

    showModal() { document.getElementById('mask-modal').style.display = 'flex'; },
    hideModal() { 
        document.getElementById('mask-modal').style.display = 'none'; 
        this.tempMaskAvatar = null;
        document.getElementById('modal-avatar-btn').innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 4V1h2v3h3v2H5v3H3V6H0V4h3zm3 6V7h3V4h7l1.83 2H21c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V10h3zm7 9c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5z"/></svg>`;
        document.getElementById('modal-avatar-btn').style.backgroundImage = 'none';
        document.getElementById('m-name').value = ''; document.getElementById('m-bio').value = '';
    },

    // 🚀 核心修复：确保数据保存和渲染流程完整
    addMask() {
        const name = document.getElementById('m-name').value;
        const bio = document.getElementById('m-bio').value;
        if(!name) return alert('请输入名字');
        
        // 再次确认 masks 数组存在
        if(!this.data.masks) this.data.masks = [];
        
        this.data.masks.push({ id: Date.now(), name, bio, avatar: this.tempMaskAvatar || '' });
        this.save();
        this.renderMaskList();
        this.hideModal();
    },

    deleteMask(index, e) {
        e.stopPropagation();
        if(confirm('删除面具？')) { this.data.masks.splice(index, 1); this.save(); this.renderMaskList(); }
    },

    bindMeEvents() {
        const avatarBtn = document.getElementById('wc-avatar-btn');
        let timer = null;
        avatarBtn.addEventListener('touchstart', () => timer = setTimeout(() => document.getElementById('wc-avatar-picker').click(), 600));
        avatarBtn.addEventListener('touchend', () => clearTimeout(timer));
    },

    handleAvatar(e, type) {
        const file = e.target.files[0]; if(!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            if(type === 'user') {
                this.data.avatar = ev.target.result; this.save(); this.switchTab('me');
            } else {
                this.tempMaskAvatar = ev.target.result;
                const btn = document.getElementById('modal-avatar-btn');
                btn.innerHTML = ''; btn.style.backgroundImage = `url(${ev.target.result})`;
            }
        };
        reader.readAsDataURL(file);
    },

    edit(field) {
        const val = prompt(`更改${field === 'id' ? 'ID' : '文案'}:`, this.data[field]);
        if (val) { this.data[field] = val; this.save(); this.switchTab('me'); }
    },

    save() { localStorage.setItem('wechat_data', JSON.stringify(this.data)); },
    open() { document.getElementById('wechat-app').style.display = 'flex'; },
    close() { document.getElementById('wechat-app').style.display = 'none'; }
};

WeChatApp.render();
