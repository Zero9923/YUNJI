// settings.js - 允纯机极简内核 (大容量存储 / 零卡顿逻辑)

const SettingsApp = {
    db: null,
    // --- 1. 数据库：直接存原始文件 Blob，绝不转文本 ---
    async initDB() {
        return new Promise(res => {
            const req = indexedDB.open("YCJ_STORE", 1);
            req.onupgradeneeded = e => e.target.result.createObjectStore("assets");
            req.onsuccess = e => { this.db = e.target.result; res(); };
        });
    },

    // --- 2. 样式注入：使用 CSS 变量提高性能 ---
    applyStyles(fontBlob = null) {
        let styleTag = document.getElementById('ycj-styles');
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = 'ycj-styles';
            document.head.appendChild(styleTag);
        }

        const fontUrl = fontBlob ? URL.createObjectURL(fontBlob) : '';
        const fontFace = fontBlob ? `@font-face { font-family: 'YCJFont'; src: url("${fontUrl}"); font-display: swap; }` : '';
        
        styleTag.innerHTML = `
            ${fontFace}
            :root { 
                --ycj-fs: ${this.config.font_size}px; 
                --ycj-ff: ${fontBlob ? "'YCJFont', sans-serif" : "inherit"};
            }
            * { 
                font-size: var(--ycj-fs) !important; 
                font-family: var(--ycj-ff) !important; 
            }
            .s-header h1 { font-size: 24px !important; }
            .s-label, .cn, .app-name { font-size: 11px !important; }
            .s-acc-icon, .x { font-size: 18px !important; }
        `;
    },

    // --- 3. 初始化数据 ---
    async init() {
        await this.initDB();
        const defaults = {
            api_url: 'https://api.openai.com/v1', api_key: '', model: 'gpt-3.5-turbo',
            model_list: ['gpt-3.5-turbo', 'gpt-4'], api_presets: [],
            minimax_group_id: '', minimax_api_key: '',
            font_size: 15, current_font_id: null, font_presets: [],
            img_url: 'https://api.openai.com/v1', img_key: '', img_model: 'gpt-4o',
            img_model_list: ['gpt-4o', 'dall-e-3'], img_presets: []
        };
        this.config = { ...defaults, ...(JSON.parse(localStorage.getItem('sys_settings')) || {}) };
        
        if(this.config.current_font_id) {
            const blob = await this.getAsset(this.config.current_font_id);
            this.applyStyles(blob);
        } else {
            this.applyStyles();
        }
    },

    render() {
        this.init().then(() => {
            const style = `
                <style>
                    #settings-app { position: fixed; top: 0; left: 0; width: 100%; height: 100dvh; background: #FFF; z-index: 10000; display: none; flex-direction: column; color: #333; }
                    .s-header { padding: 60px 25px 30px; display: flex; align-items: flex-end; justify-content: space-between; }
                    .s-close { color: #999; cursor: pointer; }
                    .s-content { flex: 1; overflow-y: auto; padding: 0 25px 100px; }
                    .s-accordion { border-bottom: 1px solid #F2F2F2; }
                    .s-acc-header { display: flex; align-items: center; justify-content: space-between; padding: 25px 0; cursor: pointer; }
                    .s-acc-title { display: flex; align-items: center; font-size: 14px; color: #444; }
                    .s-acc-title .cn { font-size: 11px; color: #AAA; margin-left: 5px; }
                    .s-acc-icon { color: #DDD; transition: transform 0.3s; font-weight: 200; }
                    .s-acc-content { display: none; padding: 0 0 35px 0; }
                    .s-accordion.active .s-acc-content { display: block; }
                    .s-accordion.active .s-acc-icon { transform: rotate(45deg); color: #333; }
                    .s-row { display: flex; flex-direction: column; margin-bottom: 25px; }
                    .s-label { color: #BBB; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
                    .s-input, .s-select { background: transparent; border: none; border-bottom: 1px solid #EEE; padding: 10px 0; color: #333; outline: none; border-radius: 0; width: 100%; }
                    .s-color-tag { width: 10px; height: 10px; margin-right: 12px; border-radius: 50%; display: inline-block; }
                    .s-btn-group { display: flex; gap: 10px; margin-top: 20px; }
                    .s-btn-flat { padding: 10px 15px; font-size: 11px; border: 1px solid #EEE; color: #888; cursor: pointer; background: #fff; }
                    .s-btn-dark { background: #333 !important; color: #fff !important; border: none; }
                    .p-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 15px; }
                    .p-tag { padding: 6px 12px; font-size: 11px; background: #F8F8F8; color: #999; border: 1px solid #F0F0F0; display: flex; align-items: center; cursor: pointer; }
                    .p-tag .x { margin-left: 8px; color: #CCC; }
                    .s-footer { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 10px; }
                    #s-busy { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255,255,255,0.7); z-index: 10001; display: none; align-items: center; justify-content: center; letter-spacing: 2px; }
                </style>
            `;
            const html = `
                <div id="s-busy">WORKING...</div>
                <div id="settings-app">
                    <div class="s-header"><h1>PREFERENCE / <span class="cn">偏好设置</span></h1><div class="s-close" onclick="SettingsApp.close()">CLOSE</div></div>
                    <div class="s-content">
                        <div class="s-accordion" onclick="SettingsApp.toggle(this)">
                            <div class="s-acc-header"><div class="s-acc-title"><span class="s-color-tag" style="background:#BDC3C7"></span>API SETTINGS / <span class="cn">API设置</span></div><div class="s-acc-icon">+</div></div>
                            <div class="s-acc-content" onclick="event.stopPropagation()">
                                <div class="s-row"><div class="s-label">URL</div><input type="text" id="api-url" class="s-input" value="${this.config.api_url}"></div>
                                <div class="s-row"><div class="s-label">KEY</div><input type="password" id="api-key" class="s-input" value="${this.config.api_key}"></div>
                                <div class="s-row"><div class="s-label">MODEL</div><select id="api-model" class="s-select">${this.renderOptions(this.config.model_list, this.config.model)}</select>
                                <div class="s-btn-group"><div class="s-btn-flat" onclick="SettingsApp.fetchModels('api')">FETCH</div></div></div>
                                <div class="p-list" id="api-presets"></div>
                                <div class="s-btn-group"><div class="s-btn-flat s-btn-dark" onclick="SettingsApp.saveCore('api')">SAVE</div><div class="s-btn-flat" onclick="SettingsApp.savePreset('api')">AS PRESET</div></div>
                            </div>
                        </div>
                        <div class="s-accordion" onclick="SettingsApp.toggle(this)">
                            <div class="s-acc-header"><div class="s-acc-title"><span class="s-color-tag" style="background:#D1C1B7"></span>MINIMAX / <span class="cn">MiniMax设置</span></div><div class="s-acc-icon">+</div></div>
                            <div class="s-acc-content" onclick="event.stopPropagation()">
                                <div class="s-row"><div class="s-label">Group ID</div><input type="text" class="s-input" value="${this.config.minimax_group_id}" onchange="SettingsApp.updateField('minimax_group_id', this.value)"></div>
                                <div class="s-row"><div class="s-label">API Key</div><input type="password" class="s-input" value="${this.config.minimax_api_key}" onchange="SettingsApp.updateField('minimax_api_key', this.value)"></div>
                            </div>
                        </div>
                        <div class="s-accordion" onclick="SettingsApp.toggle(this)">
                            <div class="s-acc-header"><div class="s-acc-title"><span class="s-color-tag" style="background:#AAB2A8"></span>TYPOGRAPHY / <span class="cn">字体设置</span></div><div class="s-acc-icon">+</div></div>
                            <div class="s-acc-content" onclick="event.stopPropagation()">
                                <div class="s-row"><div class="s-label" id="font-label">Size / ${this.config.font_size}px</div><input type="range" min="12" max="24" value="${this.config.font_size}" oninput="SettingsApp.updateField('font_size', this.value)"></div>
                                <div class="s-row"><div class="s-label">Upload Font / 自动保存</div>
                                <div class="s-btn-group"><div class="s-btn-flat s-btn-dark" onclick="document.getElementById('f-picker').click()">SELECT .TTF/.OTF</div></div></div>
                                <div class="p-list" id="font-presets"></div>
                            </div>
                        </div>
                        <div class="s-accordion" onclick="SettingsApp.toggle(this)">
                            <div class="s-acc-header"><div class="s-acc-title"><span class="s-color-tag" style="background:#B7C1D1"></span>IMAGE GEN / <span class="cn">生图设置</span></div><div class="s-acc-icon">+</div></div>
                            <div class="s-acc-content" onclick="event.stopPropagation()">
                                <div class="s-row"><div class="s-label">URL</div><input type="text" id="img-url" class="s-input" value="${this.config.img_url}"></div>
                                <div class="s-row"><div class="s-label">Key</div><input type="password" id="img-key" class="s-input" value="${this.config.img_key}"></div>
                                <div class="s-row"><div class="s-label">Model</div><select id="img-model" class="s-select">${this.renderOptions(this.config.img_model_list, this.config.img_model)}</select>
                                <div class="s-btn-group"><div class="s-btn-flat" onclick="SettingsApp.fetchModels('img')">FETCH</div></div></div>
                                <div class="p-list" id="img-presets"></div>
                                <div class="s-btn-group"><div class="s-btn-flat s-btn-dark" onclick="SettingsApp.saveCore('img')">SAVE</div><div class="s-btn-flat" onclick="SettingsApp.savePreset('img')">AS PRESET</div></div>
                            </div>
                        </div>
                        <div class="s-accordion" onclick="SettingsApp.toggle(this)">
                            <div class="s-acc-header"><div class="s-acc-title"><span class="s-color-tag" style="background:#E5E5E5"></span>DATA / <span class="cn">数据管理</span></div><div class="s-acc-icon">+</div></div>
                            <div class="s-acc-content" onclick="event.stopPropagation()">
                                <div class="s-footer"><div class="s-btn-flat" onclick="SettingsApp.exportAll()">EXPORT ALL</div><div class="s-btn-flat" onclick="SettingsApp.importAll()">IMPORT ALL</div>
                                <div class="s-btn-flat s-btn-dark" style="grid-column: span 2; margin-top:10px; background:#FF3B30 !important" onclick="SettingsApp.clearData()">WIPE ALL DATA</div></div>
                            </div>
                        </div>
                    </div>
                </div>
                <input type="file" id="f-picker" style="display:none" accept=".ttf,.otf,.woff,.woff2">
            `;
            document.body.insertAdjacentHTML('beforeend', style + html);
            this.renderAllPresets();
            document.getElementById('f-picker').onchange = (e) => this.handleFontFile(e);
        });
    },

    // --- 逻辑处理 ---
    async handleFontFile(e) {
        const file = e.target.files[0]; if(!file) return;
        document.getElementById('s-busy').style.display = 'flex';
        const id = 'f_' + Date.now();
        const name = file.name.split('.')[0];
        
        // 🚀 核心改动：直接存原始 Blob 对象，不卡顿
        const tx = this.db.transaction("assets", "readwrite");
        await new Promise(r => { tx.objectStore("assets").put(file, id); tx.oncomplete = r; });
        
        this.config.font_presets.push({ name, id });
        this.config.current_font_id = id;
        this.save();
        this.applyStyles(file);
        this.renderFontPresets();
        document.getElementById('s-busy').style.display = 'none';
    },

    async loadFont(idx) {
        if(idx === -1) { this.config.current_font_id = null; this.applyStyles(); }
        else {
            const f = this.config.font_presets[idx];
            this.config.current_font_id = f.id;
            const blob = await this.getAsset(f.id);
            this.applyStyles(blob);
        }
        this.save();
    },

    async deleteFont(idx, e) {
        e.stopPropagation();
        const f = this.config.font_presets[idx];
        const tx = this.db.transaction("assets", "readwrite");
        tx.objectStore("assets").delete(f.id);
        this.config.font_presets.splice(idx, 1);
        if(this.config.current_font_id === f.id) this.config.current_font_id = null;
        this.save(); this.renderFontPresets();
    },

    async getAsset(id) {
        const tx = this.db.transaction("assets", "readonly");
        return new Promise(res => { tx.objectStore("assets").get(id).onsuccess = e => res(e.target.result); });
    },

    // 🚀 全备份：支持大容量 IndexedDB 导出
    async exportAll() {
        const data = { local: { ...localStorage }, assets: {} };
        const tx = this.db.transaction("assets", "readonly");
        const store = tx.objectStore("assets");
        const keys = await new Promise(r => store.getAllKeys().onsuccess = e => r(e.target.result));
        
        for(let k of keys) {
            const blob = await this.getAsset(k);
            data.assets[k] = await new Promise(r => {
                const reader = new FileReader(); reader.onload = e => r(e.target.result); reader.readAsDataURL(blob);
            });
        }
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], {type:'application/json'}));
        a.download = `ycj_os_${Date.now()}.json`; a.click();
    },

    async importAll() {
        const i = document.createElement('input'); i.type = 'file';
        i.onchange = e => {
            const r = new FileReader(); r.onload = async ev => {
                const d = JSON.parse(ev.target.result);
                localStorage.clear(); Object.keys(d.local).forEach(k => localStorage.setItem(k, d.local[k]));
                const tx = this.db.transaction("assets", "readwrite");
                const store = tx.objectStore("assets"); store.clear();
                for(let k in d.assets) {
                    const res = await fetch(d.assets[k]); const blob = await res.blob();
                    store.put(blob, k);
                }
                location.reload();
            }; r.readAsText(e.target.files[0]);
        }; i.click();
    },

    // --- 界面渲染辅助 ---
    renderOptions(list, cur) { return (list||[]).map(m => `<option value="${m}" ${m===cur?'selected':''}>${m}</option>`).join(''); },
    renderAllPresets() { this.renderPresetList('api-presets', this.config.api_presets, 'api'); this.renderPresetList('img-presets', this.config.img_presets, 'img'); this.renderFontPresets(); },
    renderPresetList(domId, data, type) {
        const list = document.getElementById(domId); if(!list) return;
        list.innerHTML = (data || []).map((p, i) => `<div class="p-tag" onclick="SettingsApp.loadPreset('${type}', ${i})">${p.name}<span class="x" onclick="SettingsApp.deletePreset('${type}', ${i}, event)">×</span></div>`).join('');
    },
    renderFontPresets() {
        const list = document.getElementById('font-presets'); if(!list) return;
        let h = `<div class="p-tag" onclick="SettingsApp.loadFont(-1)">Default</div>`;
        h += (this.config.font_presets || []).map((f, i) => `<div class="p-tag" onclick="SettingsApp.loadFont(${i})">${f.name}<span class="x" onclick="SettingsApp.deleteFont(${i}, event)">×</span></div>`).join('');
        list.innerHTML = h;
    },
    toggle(el) { const act = el.classList.contains('active'); document.querySelectorAll('.s-accordion').forEach(a => a.classList.remove('active')); if(!act) el.classList.add('active'); },
    open() { document.getElementById('settings-app').style.display = 'flex'; this.renderAllPresets(); },
    close() { document.getElementById('settings-app').style.display = 'none'; },
    save() { localStorage.setItem('sys_settings', JSON.stringify(this.config)); },
    updateField(k, v) { 
        this.config[k] = v; this.save(); 
        if(k === 'font_size') { document.getElementById('ycj-styles').innerHTML = document.getElementById('ycj-styles').innerHTML.replace(/--ycj-fs: \d+px/, `--ycj-fs: ${v}px`); document.getElementById('font-label').innerText = `Size / ${v}px`; }
    },
    saveCore(type) { this.config[`${type}_url`] = document.getElementById(`${type}-url`).value; this.config[`${type}_key`] = document.getElementById(`${type}-key`).value; this.config[`${type}_model`] = document.getElementById(`${type}-model`).value; this.save(); alert('Saved.'); },
    savePreset(type) {
        const name = prompt('Name:'); if(!name) return;
        this.config[`${type}_presets`].push({ name, url: document.getElementById(`${type}-url`).value, key: document.getElementById(`${type}-key`).value, model: document.getElementById(`${type}-model`).value });
        this.save(); this.renderAllPresets();
    },
    loadPreset(type, i) { const p = this.config[`${type}_presets`][i]; document.getElementById(`${type}-url`).value = p.url; document.getElementById(`${type}-key`).value = p.key; this.config[`${type}_model`] = p.model; this.save(); },
    deletePreset(type, i, e) { e.stopPropagation(); this.config[`${type}_presets`].splice(i, 1); this.save(); this.renderAllPresets(); },
    async fetchModels(type) {
        const url = document.getElementById(`${type}-url`).value.replace(/\/+$/, "");
        const key = document.getElementById(`${type}-key`).value;
        const btn = event.target; btn.innerText = 'WAIT...';
        try {
            const res = await fetch(`${url}/models`, { headers: { 'Authorization': `Bearer ${key}` } });
            const json = await res.json();
            if(json.data) {
                this.config[`${type}_model_list`] = json.data.map(m => m.id);
                document.getElementById(`${type}-model`).innerHTML = this.renderOptions(this.config[`${type}_model_list`], this.config[`${type}_model`]);
                this.save();
            }
        } catch(e) { alert('Error'); } finally { btn.innerText = 'FETCH'; }
    },
    clearData() { if(confirm('Wipe All?')) { localStorage.clear(); indexedDB.deleteDatabase("YCJ_STORE"); location.reload(); } }
};
SettingsApp.render();
