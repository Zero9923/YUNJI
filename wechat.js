// wechat.js - 允纯机社交内核：支持聊天列表跳转 + 消息预览版

const WeChatApp = {
    db: null,
    data: {
        avatarId: null, id: '用户', bio: '一厢情愿、心甘情愿',
        currentTab: 'chat', 
        masks: [],    
        contacts: [], 
        collapsedGroups: [],
        activeChats: [],
        messages: {}, // 新增：用于存储每个角色的聊天记录 { contactId: [ {role, content, timestamp}, ... ] }
        favorites: [], // 新增：收藏
        selectedChatGroup: '全部', // 聊天列表当前选中的分组
        chatSearchQuery: ''        // 聊天列表搜索
    },

    tempFile: null,
    editingId: null, 
    editingMaskId: null,
    contextTarget: null, 
    searchQuery: '',

    async initDB() {
        return new Promise(res => {
            const req = indexedDB.open("YCJ_STORE", 1);
            req.onupgradeneeded = e => { if(!e.target.result.objectStoreNames.contains("assets")) e.target.result.createObjectStore("assets"); };
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
        return new Promise(res => { 
            const req = tx.objectStore("assets").get(id);
            req.onsuccess = () => res(req.result);
            req.onerror = () => res(null);
        });
    },

    async init() {
        await this.initDB();
        const saved = JSON.parse(localStorage.getItem('wechat_data')) || {};
        this.data = { ...this.data, ...saved };
        if(!Array.isArray(this.data.masks)) this.data.masks = [];
        if(!Array.isArray(this.data.contacts)) this.data.contacts = [];
        if(!Array.isArray(this.data.activeChats)) this.data.activeChats = [];
        if(!Array.isArray(this.data.favorites)) this.data.favorites = [];
        if(!this.data.messages) this.data.messages = {};
        if(!this.data.selectedChatGroup) this.data.selectedChatGroup = '全部';
    },

    async render() {
        await this.init();
        const style = `
            <style>
                #wechat-app { position: fixed; top: 0; left: 0; width: 100%; height: 100dvh; background: #F9F9F9; z-index: 9999; display: none; flex-direction: column; font-family: -apple-system, sans-serif; }
                .wc-header, .sub-header { padding: 55px 20px 15px; display: flex; align-items: center; justify-content: space-between; background: #FFF; border-bottom: 1px solid #F2F2F2; position: sticky; top: 0; z-index: 100; }
                .wc-header .btn, .sub-header .btn { width: 26px; height: 28px; fill: #666; cursor: pointer; }
                .wc-header .title, .sub-header .title { font-size: 16px; font-weight: 500; color: #333; flex: 1; text-align: center; letter-spacing: 1px; }
                .wc-content { flex: 1; overflow-y: auto; position: relative; }

                .wc-plus-menu { position: fixed; top: 90px; right: 15px; background: #4C4C4C; border-radius: 12px; display: none; flex-direction: column; z-index: 10006; min-width: 150px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
                .wc-plus-menu::after { content: ""; position: absolute; top: -8px; right: 12px; border-left: 8px solid transparent; border-right: 8px solid transparent; border-bottom: 8px solid #4C4C4C; }
                .wc-plus-item { color: #FFF; padding: 14px 18px; font-size: 15px; display: flex; align-items: center; gap: 12px; border-bottom: 0.5px solid #5a5a5a; cursor: pointer; }
                .wc-plus-item:last-child { border-bottom: none; }
                .wc-plus-item svg { width: 20px; height: 20px; fill: #FFF; }

                .wc-me-card { background: #FFF; border-radius: 20px; padding: 25px; display: flex; align-items: flex-start; gap: 20px; border: 1px solid #F0F0F0; margin: 20px; }
                .wc-avatar { width: 70px; height: 70px; border-radius: 50%; background: #F0F2F5; background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; }
                .wc-id { font-size: 18px; font-weight: 500; color: #1a1a1a; margin-bottom: 5px; cursor: pointer; }
                .wc-bio { font-size: 13px; color: #999; line-height: 1.5; cursor: pointer; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
                .wc-list { padding: 0 20px 30px; display: flex; flex-direction: column; gap: 10px; }
                .wc-list-item { background: #FFF; padding: 16px 20px; border-radius: 15px; display: flex; align-items: center; gap: 15px; border: 1px solid #F2F2F2; cursor: pointer; }
                .wc-list-icon { width: 22px; height: 22px; fill: #BBB; }
                
                .wc-search-bar { padding: 15px 20px; }
                .wc-search-input { width: 100%; height: 38px; background: #EEE; border-radius: 12px; border: none; padding: 0 15px; font-size: 14px; outline: none; }
                .wc-func-row { background: #FFF; padding: 12px 20px; display: flex; align-items: center; gap: 15px; border-bottom: 1px solid #F9F9F9; cursor: pointer; }
                .wc-func-icon { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                .wc-group-header { padding: 8px 20px; background: #F2F2F2; font-size: 11px; color: #AAA; display: flex; justify-content: space-between; cursor: pointer; }
                .wc-contact-item { background: #FFF; padding: 12px 20px; display: flex; align-items: center; gap: 15px; border-bottom: 1px solid #F9F9F9; }
                .wc-c-avatar { width: 44px; height: 44px; border-radius: 12px; background: #F0F0F0; background-size: cover; background-position: center; flex-shrink: 0; }

                /* 聊天页改版样式 */
                .wc-chat-top-search { padding: 12px 18px 8px; }
                .wc-chat-search-box { background: #FFF; height: 40px; border-radius: 10px; display: flex; align-items: center; padding: 0 12px; border: 1px solid #EAEAEA; }
                .wc-chat-search-box input { border: none; background: transparent; flex: 1; height: 100%; outline: none; font-size: 14px; color: #333; }
                .wc-chat-filter-row { display: flex; overflow-x: auto; padding: 6px 18px 14px; gap: 10px; scrollbar-width: none; }
                .wc-chat-filter-row::-webkit-scrollbar { display: none; }
                .wc-filter-pill { padding: 6px 15px; border-radius: 20px; background: #FFF; border: 1px solid #EEE; color: #666; font-size: 13px; white-space: nowrap; cursor: pointer; }
                .wc-filter-pill.active { background: #1a1a1a; color: #FFF; border-color: #1a1a1a; }
                .wc-chat-card-list { padding: 0 16px 30px; }
                .wc-chat-card { display: flex; align-items: center; padding: 14px; background: #FFF; border-radius: 16px; margin-bottom: 12px; border: 1px solid #F2F2F2; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.02); }
                .wc-chat-avatar { width: 48px; height: 48px; border-radius: 10px; background: #F0F0F0; background-size: cover; background-position: center; flex-shrink: 0; }
                .wc-chat-info { flex: 1; margin-left: 12px; overflow: hidden; }
                .wc-chat-name { font-size: 15px; color: #333; font-weight: 500; margin-bottom: 4px; }
                .wc-chat-msg { font-size: 13px; color: #999; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

                /* 收藏项样式 */
                .fav-item { background: #FFF; padding: 15px; border-radius: 15px; border: 1px solid #F2F2F2; margin-bottom: 10px; position: relative; }
                .fav-item:active { background: #F5F5F5; }
                .fav-date { font-size: 11px; color: #BBB; margin-bottom: 6px; }
                .fav-text { font-size: 14px; color: #333; line-height: 1.5; word-wrap: break-word; }

                .wc-tabbar { height: 85px; background: rgba(255,255,255,0.9); backdrop-filter: blur(20px); border-top: 1px solid #F0F0F0; display: flex; justify-content: space-around; align-items: center; padding-bottom: env(safe-area-inset-bottom); }
                .wc-tab { display: flex; flex-direction: column; align-items: center; gap: 6px; color: #BBB; cursor: pointer; }
                .wc-tab.active { color: #1a1a1a; }
                .wc-tab svg { width: 24px; height: 24px; fill: currentColor; }
                .wc-tab span { font-size: 10px; }

                .wc-modal-mask { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10002; display: none; align-items: center; justify-content: center; }
                .wc-modal { background: #FFF; width: 90%; max-height: 85vh; border-radius: 28px; padding: 25px; display: flex; flex-direction: column; box-shadow: 0 10px 40px rgba(0,0,0,0.2); }
                .modal-scroll { flex: 1; overflow-y: auto; }
                .modal-avatar-up { width: 85px; height: 85px; border-radius: 20px; background: #F8F8F8; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; background-size: cover; border: 1px solid #EEE; flex-shrink: 0; }
                .modal-label { font-size: 12px; color: #AAA; margin: 10px 0 5px; display: block; }
                .modal-input, .modal-select { width: 100%; border: none; border-bottom: 1px solid #F0F0F0; padding: 12px 0; outline: none; font-size: 15px; background: transparent; }
                .modal-textarea { width: 100%; height: 180px; border: 1px solid #F0F0F0; border-radius: 12px; padding: 12px; margin-top: 5px; outline: none; font-size: 14px; resize: none; background: #FAFAFA; font-family: inherit; line-height: 1.6; }
                .modal-btns { display: flex; gap: 10px; margin-top: 20px; }
                .m-btn { flex: 1; padding: 15px; text-align: center; border-radius: 15px; font-size: 15px; font-weight: 500; cursor: pointer; }
                
                .picker-item { display: flex; align-items: center; padding: 12px 20px; background: #FFF; border-bottom: 1px solid #F9F9F9; cursor: pointer; }
                .picker-avatar { width: 40px; height: 40px; border-radius: 10px; background: #EEE; background-size: cover; background-position: center; flex-shrink: 0; }
                .picker-name { margin-left: 15px; font-size: 15px; color: #333; }

                #wc-sub-page { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #F9F9F9; z-index: 10001; display: none; flex-direction: column; }
                .mask-list { flex: 1; overflow-y: auto; padding: 20px; }
                .mask-item { background: #FFF; padding: 15px; border-radius: 15px; display: flex; align-items: center; gap: 15px; margin-bottom: 10px; border: 1px solid #F2F2F2; position: relative; }
                .mask-item-avatar { width: 48px; height: 48px; border-radius: 50%; background: #EEE; background-size: cover; background-position: center; flex-shrink: 0; }
                .mask-item-name { flex: 1; font-size: 16px; color: #333; font-weight: 500; }
                .mask-item-del { color: #CCC; font-size: 24px; padding: 5px 12px; cursor: pointer; z-index: 10; }

                #wc-context-menu { position: fixed; z-index: 10005; background: #FFF; border-radius: 12px; width: 135px; display: none; flex-direction: column; box-shadow: 0 10px 30px rgba(0,0,0,0.1); border: 1px solid #EEE; overflow: hidden; }
                .context-item { padding: 12px; font-size: 14px; text-align: center; border-bottom: 0.5px solid #EEE; color: #333; cursor: pointer; }
                .context-item:active { background: #F5F5F5; }
            </style>
        `;

        const html = `
            <div id="wc-busy" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(255,255,255,0.9);z-index:10008;display:none;align-items:center;justify-content:center;flex-direction:column;gap:15px;">
                <div style="width:35px;height:35px;border:3px solid #F3F3F3;border-top:3px solid #1a1a1a;border-radius:50%;animation:wc-spin 1s linear infinite;"></div>
                <div style="font-size:14px;color:#1a1a1a">处理中...</div>
            </div>
            <style>@keyframes wc-spin { to { transform: rotate(360deg); } }</style>
            
            <div id="wechat-app">
                <div class="wc-header">
                    <svg class="btn" onclick="WeChatApp.close()" viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
                    <div class="title" id="wc-header-title">允纯机</div>
                    <svg class="btn" id="wc-add-btn" onclick="WeChatApp.togglePlusMenu(event)" viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                </div>

                <div id="wc-plus-menu" class="wc-plus-menu"></div>

                <div class="wc-content" id="wc-main-view"></div>
                <div class="wc-tabbar">
                    <div class="wc-tab" onclick="WeChatApp.switchTab('chat')"><svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12l4 4V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg><span>聊天</span></div>
                    <div class="wc-tab" onclick="WeChatApp.switchTab('contacts')"><svg viewBox="0 0 24 24"><path d="M9 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4zm11-4V7h-2v3h-3v2h3v3h2v-3h3v-2h-3z"/></svg><span>通讯录</span></div>
                    <div class="wc-tab" onclick="WeChatApp.switchTab('discovery')"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm4.59-12.42L10 10.74l-3.17 6.84L14 14.41l3.17-6.83h-.58zM12 13.1c-.61 0-1.1-.49-1.1-1.1s.49-1.1 1.1-1.1 1.1.49 1.1 1.1-.49 1.1-1.1 1.1z"/></svg><span>发现</span></div>
                    <div class="wc-tab" onclick="WeChatApp.switchTab('me')"><svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg><span>个人</span></div>
                </div>

                <div class="wc-modal-mask" id="chat-picker-modal">
                    <div class="wc-modal" style="padding:0; overflow:hidden; display:flex; flex-direction:column; max-height:70vh; width:85%;">
                        <div style="padding:20px; text-align:center; font-size:16px; font-weight:500; border-bottom:1px solid #F0F0F0;">发起聊天</div>
                        <div class="modal-scroll" id="chat-picker-list" style="padding:10px 0; background:#F9F9F9;"></div>
                        <div style="padding:16px; text-align:center; color:#666; border-top:1px solid #F0F0F0; font-size:15px; cursor:pointer;" onclick="document.getElementById('chat-picker-modal').style.display='none'">取消</div>
                    </div>
                </div>

                <div class="wc-modal-mask" id="contact-modal">
                    <div class="wc-modal">
                        <div class="modal-scroll">
                            <div class="modal-avatar-up" id="c-avatar-btn" onclick="document.getElementById('c-picker').click()"><svg viewBox="0 0 24 24" style="width:36px;fill:#DDD"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></div>
                            <span class="modal-label">名称</span>
                            <input type="text" id="c-name" class="modal-input" placeholder="输入角色名">
                            <span class="modal-label">分组</span>
                            <input type="text" id="c-group" class="modal-input" placeholder="如：导入、好友">
                            <span class="modal-label">绑定 User 面具</span>
                            <select id="c-user-bind" class="modal-select"></select>
                            <span class="modal-label">人设设定</span>
                            <textarea id="c-bio" class="modal-textarea" placeholder="输入详细的角色设定..."></textarea>
                        </div>
                        <div class="modal-btns">
                            <div class="m-btn" style="background:#F5F5F5;color:#999" onclick="WeChatApp.hideContactModal()">取消</div>
                            <div class="m-btn" style="background:#1a1a1a;color:#FFF" onclick="WeChatApp.saveContact()">保存角色</div>
                        </div>
                    </div>
                </div>

                <div id="wc-sub-page">
                    <div class="sub-header">
                        <svg class="btn" onclick="WeChatApp.closeSubPage()" viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
                        <div class="title" id="wc-sub-title">我的面具</div>
                        <svg class="btn" id="wc-sub-add-btn" onclick="WeChatApp.showUserModal()" viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                    </div>
                    <div class="mask-list" id="mask-list-view"></div>
                </div>

                <div class="wc-modal-mask" id="user-mask-modal">
                    <div class="wc-modal">
                        <div class="modal-scroll">
                            <div class="modal-avatar-up" id="um-avatar-btn" onclick="document.getElementById('um-picker').click()"><svg viewBox="0 0 24 24" style="width:36px;fill:#DDD"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></div>
                            <input type="text" id="um-name" class="modal-input" placeholder="面具名称">
                            <textarea id="um-bio" class="modal-textarea" placeholder="输入面具背景设定..."></textarea>
                        </div>
                        <div class="modal-btns"><div class="m-btn" style="background:#F5F5F5;color:#999" onclick="WeChatApp.hideUserModal()">取消</div><div class="m-btn" style="background:#1a1a1a;color:#FFF" onclick="WeChatApp.saveUserMask()">确定</div></div>
                    </div>
                </div>

                <div id="wc-context-menu">
                    <div class="context-item" id="ctx-edit" onclick="WeChatApp.handleCtxEdit()">编辑</div>
                    <div class="context-item" id="ctx-clear" onclick="WeChatApp.handleCtxClear()">清除聊天记录</div>
                    <div class="context-item" id="ctx-delete" style="color:red" onclick="WeChatApp.handleCtxDelete()">删除</div>
                </div>
            </div>
            <input type="file" id="u-picker" style="display:none" accept="image/*">
            <input type="file" id="c-picker" style="display:none" accept="image/*">
            <input type="file" id="um-picker" style="display:none" accept="image/*">
            <input type="file" id="import-picker" style="display:none" accept=".json,.png">
        `;

        document.body.insertAdjacentHTML('beforeend', style + html);
        this.switchTab(this.data.currentTab);
        document.getElementById('u-picker').onchange = e => this.handleFile(e, 'user');
        document.getElementById('c-picker').onchange = e => this.handleFile(e, 'contact');
        document.getElementById('um-picker').onchange = e => this.handleFile(e, 'user-mask');
        document.getElementById('import-picker').onchange = e => this.handleImport(e);
    },

    togglePlusMenu(e) {
        e.stopPropagation();
        const menu = document.getElementById('wc-plus-menu');
        if (this.data.currentTab === 'chat') {
            menu.innerHTML = `
                <div class="wc-plus-item" onclick="WeChatApp.showChatPicker()">
                    <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12l4 4V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>
                    <span>发起聊天</span>
                </div>
                <div class="wc-plus-item" onclick="alert('群聊功能开发中')">
                    <svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3s-3,1.34-3,3S14.34,11,16,11z M7,11c1.66,0,3-1.34,3-3S8.66,5,7,5S4,6.34,4,8 S5.34,11,7,11z M7,13c-2.33,0-7,1.17-7,3.5V19h14v-2.5C14,14.17,9.33,13,7,13z M16,13c-0.29,0-0.62,0.02-0.97,0.05 c1.16,0.84,1.97,1.97,1.97,3.45V19h6v-2.5C23,14.17,18.33,13,16,13z"/></svg>
                    <span>创建群聊</span>
                </div>
            `;
        } else {
            menu.innerHTML = `
                <div class="wc-plus-item" onclick="WeChatApp.menuAddContact()">
                    <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                    <span>添加角色</span>
                </div>
                <div class="wc-plus-item" onclick="document.getElementById('import-picker').click()">
                    <svg viewBox="0 0 24 24"><path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>
                    <span>导入角色卡</span>
                </div>
            `;
        }
        menu.style.display = (menu.style.display === 'flex') ? 'none' : 'flex';
        if (menu.style.display === 'flex') {
            const h = () => { menu.style.display='none'; document.removeEventListener('click',h); };
            setTimeout(()=>document.addEventListener('click', h), 10);
        }
    },

    menuAddContact() { document.getElementById('wc-plus-menu').style.display='none'; this.showContactModal(); },

    showChatPicker() {
        document.getElementById('wc-plus-menu').style.display = 'none';
        const list = document.getElementById('chat-picker-list');
        const availableContacts = this.data.contacts.filter(c => !this.data.activeChats.includes(c.id));
        if (availableContacts.length === 0) {
            list.innerHTML = `<div style="padding:40px 20px; text-align:center; color:#CCC; font-size:14px;">没有可添加的好友了</div>`;
        } else {
            list.innerHTML = '';
            for (let c of availableContacts) {
                const row = document.createElement('div');
                row.className = 'picker-item';
                row.onclick = () => this.addChat(c.id);
                row.innerHTML = `<div class="picker-avatar" id="picker-av-${c.id}"></div><div class="picker-name">${c.name}</div>`;
                list.appendChild(row);
                this.getBlob(c.avatarId).then(b => { 
                    const el = document.getElementById(`picker-av-${c.id}`); 
                    if(b && el) el.style.backgroundImage = `url(${URL.createObjectURL(b)})`; 
                });
            }
        }
        document.getElementById('chat-picker-modal').style.display = 'flex';
    },

    addChat(id) {
        this.data.activeChats.push(id);
        this.save();
        document.getElementById('chat-picker-modal').style.display = 'none';
        this.switchTab('chat');
    },

    async switchTab(tab) {
        this.data.currentTab = tab; 
        const view = document.getElementById('wc-main-view'); 
        const title = document.getElementById('wc-header-title'); 
        const addBtn = document.getElementById('wc-add-btn');
        addBtn.style.visibility = (tab === 'contacts' || tab === 'chat') ? 'visible' : 'hidden';
        title.innerText = {chat:'聊天', contacts:'通讯录', discovery:'发现', me:'个人'}[tab];
        document.querySelectorAll('.wc-tab').forEach((t, i) => t.classList.toggle('active', ['chat','contacts','discovery','me'][i] === tab));
        
        if (tab === 'me') { const blob = await this.getBlob(this.data.avatarId); view.innerHTML = this.renderMePage(blob ? URL.createObjectURL(blob) : null); this.bindMeEvents(); }
        else if (tab === 'contacts') { view.innerHTML = await this.renderContactsPage(); this.bindSearchEvent(); }
        else if (tab === 'chat') { view.innerHTML = await this.renderChatPage(); }
        else { view.innerHTML = `<div style="text-align:center;padding:100px;color:#CCC">开发中</div>`; }
    },

    // --- 聊天页改版 UI 渲染 ---
    async renderChatPage() {
        if (!this.data.activeChats || this.data.activeChats.length === 0) {
            return `<div style="text-align:center;padding:120px 20px;color:#CCC;font-size:14px;">暂无聊天，点击右上角 + 发起聊天</div>`;
        }

        // 提取所有活跃好友所属的分组，用于横向气泡过滤
        const activeContacts = this.data.activeChats.map(id => this.data.contacts.find(c => c.id === id)).filter(i => i);
        const uniqueGroups = ['全部', ...new Set(activeContacts.map(c => c.group || '其他'))];

        let h = `
            <div class="wc-chat-top-search">
                <div class="wc-chat-search-box">
                    <svg style="width:18px;fill:#BBB;margin-right:8px;" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                    <input type="text" id="chat-list-search" placeholder="搜索聊天记录" value="${this.data.chatSearchQuery || ''}" oninput="WeChatApp.handleChatSearch(this.value)">
                </div>
            </div>
            <div class="wc-chat-filter-row">
        `;

        uniqueGroups.forEach(g => {
            const isActive = this.data.selectedChatGroup === g;
            h += `<div class="wc-filter-pill ${isActive ? 'active' : ''}" onclick="WeChatApp.filterChatByGroup('${g}')">${g}</div>`;
        });
        h += `</div><div class="wc-chat-card-list">`;

        const query = (this.data.chatSearchQuery || '').toLowerCase();
        for (let id of this.data.activeChats) {
            const c = this.data.contacts.find(i => i.id === id);
            if (!c) continue;

            const msgs = this.data.messages[id] || [];
            const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1].content : '[暂无消息记录]';

            const groupMatch = this.data.selectedChatGroup === '全部' || (c.group || '其他') === this.data.selectedChatGroup;
            const searchMatch = c.name.toLowerCase().includes(query) || lastMsg.toLowerCase().includes(query);

            if (groupMatch && searchMatch) {
                h += `
                    <div class="wc-chat-card" onclick="ChatRoom.open('${c.id}')" ontouchstart="WeChatApp.startChatPress(event, '${c.id}')" ontouchend="WeChatApp.endCPress()">
                        <div class="wc-chat-avatar" id="chat-av-${c.id}"></div>
                        <div class="wc-chat-info">
                            <div class="wc-chat-name">${c.name}</div>
                            <div class="wc-chat-msg">${lastMsg}</div>
                        </div>
                    </div>
                `;
                this.getBlob(c.avatarId).then(b => { 
                    const el=document.getElementById(`chat-av-${c.id}`); 
                    if(b && el) el.style.backgroundImage = `url(${URL.createObjectURL(b)})`; 
                });
            }
        }
        h += `</div>`;
        return h;
    },

    handleChatSearch(val) { this.data.chatSearchQuery = val; this.switchTab('chat'); },
    filterChatByGroup(g) { this.data.selectedChatGroup = g; this.switchTab('chat'); },

    startCPress(e, id) { 
        this.contextTarget = { type: 'contact', id }; 
        this.pressTimer = setTimeout(() => { 
            const m = document.getElementById('wc-context-menu'); 
            document.getElementById('ctx-edit').style.display = 'block';
            document.getElementById('ctx-clear').style.display = 'none';
            const p = e.touches ? e.touches[0] : e; 
            m.style.display = 'flex'; 
            m.style.left = Math.min(p.clientX, window.innerWidth-140)+'px'; 
            m.style.top = p.clientY+'px'; 
            this.bindGlobalMenuHide();
        }, 600); 
    },
    startChatPress(e, id) { 
        this.contextTarget = { type: 'chat', id }; 
        this.pressTimer = setTimeout(() => { 
            const m = document.getElementById('wc-context-menu'); 
            document.getElementById('ctx-edit').style.display = 'none';
            document.getElementById('ctx-clear').style.display = 'block';
            const p = e.touches ? e.touches[0] : e; 
            m.style.display = 'flex'; 
            m.style.left = Math.min(p.clientX, window.innerWidth-140)+'px'; 
            m.style.top = p.clientY+'px'; 
            this.bindGlobalMenuHide();
        }, 600); 
    },
    bindGlobalMenuHide() {
        const m = document.getElementById('wc-context-menu');
        const h = () => { m.style.display='none'; document.removeEventListener('click',h); };
        setTimeout(()=>document.addEventListener('click', h), 10);
    },
    endCPress() { clearTimeout(this.pressTimer); },
    handleCtxEdit() {
        document.getElementById('wc-context-menu').style.display='none';
        if(this.contextTarget?.type === 'contact') this.showContactModal(this.contextTarget.id);
    },
    handleCtxClear() {
        document.getElementById('wc-context-menu').style.display='none';
        if(this.contextTarget?.type === 'chat' && confirm('清除与该角色的聊天记录？')) {
            this.data.messages[this.contextTarget.id] = [];
            this.save(); this.switchTab('chat');
        }
    },
    handleCtxDelete() {
        document.getElementById('wc-context-menu').style.display='none';
        if(this.contextTarget?.type === 'contact') {
            if(confirm('删除好友？')) { 
                this.data.contacts = this.data.contacts.filter(i=>i.id!==this.contextTarget.id); 
                this.data.activeChats = this.data.activeChats.filter(id => id !== this.contextTarget.id);
                this.save(); this.switchTab('contacts'); 
            }
        } else if (this.contextTarget?.type === 'chat') {
            if(confirm('删除此聊天？')) {
                this.data.activeChats = this.data.activeChats.filter(id => id !== this.contextTarget.id);
                this.save(); this.switchTab('chat');
            }
        }
    },

    async handleImport(e) {
        const file = e.target.files[0];
        if(!file) return;
        document.getElementById('wc-busy').style.display = 'flex';
        try {
            let data = null;
            if (file.type === "application/json" || file.name.endsWith('.json')) {
                data = JSON.parse(await file.text());
            } else if (file.type === "image/png") {
                data = await this.extractPngData(file);
            }
            if (data) await this.saveImportedChar(data, file.type === "image/png" ? file : null);
        } catch (err) {
            alert("导入失败：数据格式不正确");
        }
        document.getElementById('wc-busy').style.display = 'none';
        e.target.value = '';
    },

    decodeBase64UTF8(s) {
        const b = atob(s);
        const u = new Uint8Array(b.length);
        for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
        return new TextDecoder('utf-8').decode(u);
    },

    async extractPngData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const buffer = new Uint8Array(reader.result);
                if (buffer[0] !== 0x89 || buffer[1] !== 0x50) return reject("无效PNG");
                let offset = 8;
                while (offset < buffer.length) {
                    const len = (buffer[offset] << 24) | (buffer[offset+1] << 16) | (buffer[offset+2] << 8) | buffer[offset+3];
                    const type = String.fromCharCode(buffer[offset+4], buffer[offset+5], buffer[offset+6], buffer[offset+7]);
                    if (type === 'tEXt' || type === 'iTXt') {
                        const chunk = buffer.slice(offset + 8, offset + 8 + len);
                        const text = new TextDecoder('utf-8').decode(chunk);
                        if (text.includes('chara')) {
                            const raw = text.substring(text.indexOf('chara') + 5);
                            const b64Idx = raw.indexOf('eyJ');
                            const jsonIdx = raw.indexOf('{');
                            try {
                                if (b64Idx !== -1 && (jsonIdx === -1 || b64Idx < jsonIdx)) {
                                    const b64 = raw.substring(b64Idx).replace(/[^a-zA-Z0-9+/=]/g, '');
                                    resolve(JSON.parse(this.decodeBase64UTF8(b64))); return;
                                } else if (jsonIdx !== -1) {
                                    resolve(JSON.parse(raw.substring(jsonIdx, raw.lastIndexOf('}') + 1))); return;
                                }
                            } catch(e) {}
                        }
                    }
                    offset += len + 12;
                }
                reject("未找到数据");
            };
            reader.readAsArrayBuffer(file);
        });
    },

    async saveImportedChar(raw, avatarBlob) {
        const char = raw.data || raw; 
        const name = char.name || char.display_name || "未命名";
        const bio = [char.description, char.personality, char.mes_example].filter(i=>i).join('\n\n');
        let aid = null;
        if (avatarBlob) { aid = 'c_a_' + Date.now(); await this.saveBlob(aid, avatarBlob); }
        const p = { id: 'c_'+Date.now(), name, bio, group: '导入', userId: '', avatarId: aid };
        this.data.contacts.push(p);
        this.save();
        if(this.data.currentTab === 'contacts') this.switchTab('contacts');
        alert(`成功导入: ${name}`);
    },

    async renderContactsPage() {
        let h = `
            <div class="wc-search-bar"><input type="text" class="wc-search-input" id="c-search" placeholder="搜索好友" value="${this.searchQuery}"></div>
            <div class="wc-func-row"><div class="wc-func-icon" style="background:#FA9D3B"><svg style="width:22px;fill:#FFF" viewBox="0 0 24 24"><path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></div><div class="wc-list-text" style="font-size:15px;">新的朋友</div></div>
            <div class="wc-func-row"><div class="wc-func-icon" style="background:#07C160"><svg style="width:22px;fill:#FFF" viewBox="0 0 24 24"><path d="M16 11c1.66,0,3-1.34,3-3s-1.34-3-3-3s-3,1.34-3,3S14.34,11,16,11z M7,11c1.66,0,3-1.34,3-3S8.66,5,7,5S4,6.34,4,8 S5.34,11,7,11z M7,13c-2.33,0-7,1.17-7,3.5V19h14v-2.5C14,14.17,9.33,13,7,13z M16,13c-0.29,0-0.62,0.02-0.97,0.05 c1.16,0.84,1.97,1.97,1.97,3.45V19h6v-2.5C23,14.17,18.33,13,16,13z"/></svg></div><div class="wc-list-text" style="font-size:15px;">群聊</div></div>
        `;
        const f = this.data.contacts.filter(c => c.name.toLowerCase().includes(this.searchQuery.toLowerCase()));
        const groups = {}; f.forEach(c => { const g = c.group || '其他'; if(!groups[g]) groups[g] = []; groups[g].push(c); });
        for(let g in groups) {
            const isCol = this.data.collapsedGroups.includes(g); h += `<div class="wc-group-header" onclick="WeChatApp.toggleGroup('${g}')"><span>${g}</span><span>${isCol?'展开':'收起'}</span></div>`;
            if(!isCol) { 
                for(let c of groups[g]) { 
                    h += `<div class="wc-contact-item" id="c-row-${c.id}" ontouchstart="WeChatApp.startCPress(event, '${c.id}')" ontouchend="WeChatApp.endCPress()"><div class="wc-c-avatar" id="c-av-${c.id}"></div><div class="wc-c-name" style="font-size:15px;">${c.name}</div></div>`; 
                    this.getBlob(c.avatarId).then(b => { const el=document.getElementById(`c-av-${c.id}`); if(b && el) el.style.backgroundImage = `url(${URL.createObjectURL(b)})`; }); 
                } 
            }
        }
        return h;
    },

    renderMePage(avatarUrl) {
        const bg = avatarUrl ? `style="background-image:url(${avatarUrl})"` : '';
        return `<div class="wc-me-card"><div class="wc-avatar" id="wc-avatar-btn" ${bg}>${avatarUrl?'':'<svg viewBox="0 0 24 24" style="width:40px;fill:#CCC"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>'}</div><div class="wc-info"><div class="wc-id" onclick="WeChatApp.edit('id')">${this.data.id}</div><div class="wc-bio" onclick="WeChatApp.edit('bio')">${this.data.bio}</div></div></div><div class="wc-list"><div class="wc-list-item" onclick="WeChatApp.openMaskPage()"><svg class="wc-list-icon" viewBox="0 0 24 24"><path d="M21 5c-1.11 0-2.02.82-2.15 1.88a1.05 1.05 0 0 0-.14-.13C17.39 5.48 15.81 5 14.21 5c-1.6 0-3.18.48-4.51 1.75-.1.1-.19.23-.29.35C9.28 6.04 8.27 5 7 5a3 3 0 0 0-3 3c0 1.66 1.34 3 3 3 .35 0 .67-.06.97-.17.67.64 1.46 1.15 2.34 1.48C9.51 13.06 9 14.44 9 16c0 3.31 2.69 6 6 6s6-2.69 6-6c0-1.56-.51-2.94-1.31-3.69.88-.33 1.67-.84 2.34-1.48.3.11.62.17.97.17 1.66 0 3-1.34 3-3a3 3 0 0 0-3-3z"/></svg><div class="wc-list-text">面具</div></div><div class="wc-list-item"><svg class="wc-list-icon" viewBox="0 0 24 24"><path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8z"/></svg><div class="wc-list-text">钱包</div></div><div class="wc-list-item" onclick="WeChatApp.openFavPage()"><svg class="wc-list-icon" viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z"/></svg><div class="wc-list-text">收藏</div></div><div class="wc-list-item"><svg class="wc-list-icon" viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm0 18c-4.41 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11z"/></svg><div class="wc-list-text">表情</div></div></div>`;
    },

    // --- 收藏夹功能渲染 ---
    openFavPage() {
        const subTitle = document.getElementById('wc-sub-title');
        subTitle.innerText = "我的收藏";
        document.getElementById('wc-sub-add-btn').style.display = 'none'; 
        document.getElementById('wc-sub-page').style.display = 'flex';
        this.renderFavList();
    },

    renderFavList() {
        const view = document.getElementById('mask-list-view'); 
        if (!view) return;
        if (this.data.favorites.length === 0) {
            view.innerHTML = `<div style="text-align:center;padding:100px;color:#CCC">暂无收藏</div>`;
            return;
        }
        let h = '';
        this.data.favorites.sort((a,b) => b.favTime - a.favTime).forEach((fav, index) => {
            const time = new Date(fav.favTime).toLocaleString();
            h += `<div class="fav-item" ontouchstart="WeChatApp.startFavPress(event, ${index})" ontouchend="WeChatApp.endCPress()"><div class="fav-date">${fav.fromName} · ${time}</div><div class="fav-text">${fav.content}</div></div>`;
        });
        view.innerHTML = h;
    },

    startFavPress(e, index) {
        this.pressTimer = setTimeout(() => {
            if(confirm('删除该收藏？')) { this.data.favorites.splice(index, 1); this.save(); this.renderFavList(); }
        }, 800);
    },

    async renderMaskList() {
        const view = document.getElementById('mask-list-view');
        if(!view) return;
        view.innerHTML = this.data.masks.length ? '' : `<div style="text-align:center;padding:50px;color:#DDD;font-size:12px;">暂无面具</div>`;
        for(let m of this.data.masks) {
            const row = document.createElement('div');
            row.className = 'mask-item';
            row.onclick = () => this.editUserMask(m.id);
            row.innerHTML = `<div class="mask-item-avatar" id="mask-av-${m.id}"></div><div class="mask-item-name">${m.name}</div><div class="mask-item-del" onclick="event.stopPropagation(); WeChatApp.delUserMask('${m.id}', event)">×</div>`;
            view.appendChild(row);
            this.getBlob(m.avatarId).then(blob => {
                const el = document.getElementById(`mask-av-${m.id}`);
                if(blob && el) el.style.backgroundImage = `url(${URL.createObjectURL(blob)})`;
            });
        }
    },

    bindSearchEvent() { const i = document.getElementById('c-search'); if(i) i.oninput = e => { this.searchQuery = e.target.value; this.switchTab('contacts'); }; },
    showContactModal(id = null) { document.getElementById('contact-modal').style.display='flex'; const s = document.getElementById('c-user-bind'); s.innerHTML = '<option value="">绑定User面具</option>' + this.data.masks.map(m=>`<option value="${m.id}">${m.name}</option>`).join(''); if(id) { const c = this.data.contacts.find(i=>i.id===id); this.editingId = id; document.getElementById('c-name').value = c.name; document.getElementById('c-bio').value = c.bio; document.getElementById('c-group').value = c.group; s.value = c.userId || ''; this.getBlob(c.avatarId).then(b => { if(b) { const btn = document.getElementById('c-avatar-btn'); btn.innerHTML=''; btn.style.backgroundImage=`url(${URL.createObjectURL(b)})`; } }); } },
    hideContactModal() { document.getElementById('contact-modal').style.display='none'; this.editingId=null; this.tempFile=null; document.getElementById('c-avatar-btn').style.backgroundImage='none'; document.getElementById('c-avatar-btn').innerHTML='<svg viewBox="0 0 24 24" style="width:36px;fill:#DDD"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>'; ['c-name','c-bio','c-group'].forEach(k=>document.getElementById(k).value=''); },
    async saveContact() { const name = document.getElementById('c-name').value; if(!name) return; const aid = this.tempFile ? 'c_a_'+Date.now() : (this.editingId?this.data.contacts.find(i=>i.id===this.editingId).avatarId:null); if(this.tempFile) await this.saveBlob(aid, this.tempFile); const p = { id: this.editingId||'c_'+Date.now(), name, bio: document.getElementById('c-bio').value, group: document.getElementById('c-group').value||'其他', userId: document.getElementById('c-user-bind').value, avatarId: aid }; if(this.editingId) this.data.contacts = this.data.contacts.map(i=>i.id===this.editingId?p:i); else this.data.contacts.push(p); this.save(); await this.switchTab('contacts'); this.hideContactModal(); },
    handleFile(e, type) { const file = e.target.files[0]; if(!file) return; this.tempFile = file; const url = URL.createObjectURL(file); const btnId = {user:'wc-avatar-btn', contact:'c-avatar-btn', 'user-mask':'um-avatar-btn'}[type]; const btn = document.getElementById(btnId); btn.innerHTML = ''; btn.style.backgroundImage = `url(${url})`; if(type === 'user') { const id = 'u_a_'+Date.now(); this.saveBlob(id, file).then(() => { this.data.avatarId = id; this.save(); this.switchTab('me'); }); } },
    toggleGroup(n) { if(this.data.collapsedGroups.includes(n)) this.data.collapsedGroups = this.data.collapsedGroups.filter(i=>i!==n); else this.data.collapsedGroups.push(n); this.save(); this.switchTab('contacts'); },
    openMaskPage() { document.getElementById('wc-sub-title').innerText = "我的面具"; document.getElementById('wc-sub-add-btn').style.display = 'block'; document.getElementById('wc-sub-page').style.display='flex'; this.renderMaskList(); },
    closeSubPage() { document.getElementById('wc-sub-page').style.display='none'; },
    showUserModal() { document.getElementById('user-mask-modal').style.display='flex'; },
    hideUserModal() { document.getElementById('user-mask-modal').style.display='none'; this.editingMaskId=null; this.tempFile=null; document.getElementById('um-avatar-btn').style.backgroundImage='none'; document.getElementById('um-name').value=''; document.getElementById('um-bio').value=''; },
    async editUserMask(id) { const m = this.data.masks.find(i=>i.id===id); if(!m) return; this.editingMaskId = id; this.showUserModal(); document.getElementById('um-name').value = m.name; document.getElementById('um-bio').value = m.bio; const b = await this.getBlob(m.avatarId); if(b) { document.getElementById('um-avatar-btn').innerHTML=''; document.getElementById('um-avatar-btn').style.backgroundImage=`url(${URL.createObjectURL(b)})`; } },
    async saveUserMask() { const name = document.getElementById('um-name').value; if(!name) return; const aid = this.tempFile ? 'um_a_'+Date.now() : (this.editingMaskId?this.data.masks.find(i=>i.id===this.editingMaskId).avatarId:null); if(this.tempFile) await this.saveBlob(aid, this.tempFile); const p = { id: this.editingMaskId||'mk_'+Date.now(), name, bio: document.getElementById('um-bio').value, avatarId: aid }; if(this.editingMaskId) this.data.masks = this.data.masks.map(i=>i.id===this.editingMaskId?p:i); else this.data.masks.push(p); this.save(); this.renderMaskList(); this.hideUserModal(); },
    delUserMask(id, e) { if(confirm('删除面具？')) { this.data.masks = this.data.masks.filter(i=>i.id!==id); this.save(); this.renderMaskList(); } },
    edit(f) { const v = prompt('修改', this.data[f]); if(v) { this.data[f] = v; this.save(); this.switchTab('me'); } },
    save() { localStorage.setItem('wechat_data', JSON.stringify(this.data)); },
    open() { document.getElementById('wechat-app').style.display = 'flex'; this.switchTab('chat'); },
    close() { document.getElementById('wechat-app').style.display = 'none'; },
    bindMeEvents() { const btn = document.getElementById('wc-avatar-btn'); if(!btn) return; let t = null; btn.ontouchstart = () => t = setTimeout(() => document.getElementById('u-picker').click(), 600); btn.ontouchend = () => clearTimeout(t); }
};
WeChatApp.render();
