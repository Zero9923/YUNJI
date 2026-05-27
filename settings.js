// settings.js - 允纯机核心内核：极简扁平 / 零卡顿字体逻辑

const SettingsApp = {
    init() {
        const defaults = {
            api_url: 'https://api.openai.com/v1',
            api_key: '',
            model: 'gpt-3.5-turbo',
            model_list: ['gpt-3.5-turbo', 'gpt-4'],
            api_presets: [],
            minimax_group_id: '',
            minimax_api_key: '',
            font_size: 15,
            font_presets: [], 
            current_font_key: null,
            img_url: 'https://api.openai.com/v1',
            img_key: '',
            img_model: 'gpt-4o',
            img_model_list: ['gpt-4o', 'dall-e-3'],
            img_presets: []
        };
        const saved = JSON.parse(localStorage.getItem('sys_settings')) || {};
        this.config = { ...defaults, ...saved };
        
        const fontData = this.config.current_font_key ? localStorage.getItem(this.config.current_font_key) : null;
        this.applyGlobalStyles(fontData);
    },

    applyGlobalStyles(fontData = null) {
        let styleTag = document.getElementById('ycj-global-styles');
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = 'ycj-global-styles';
            document.head.appendChild(styleTag);
        }
        const fontFace = fontData ? `@font-face { font-family: 'YCJCustom'; src: url("${fontData}"); font-display: swap; }` : '';
        const fontFamily = fontData ? "'YCJCustom', sans-serif" : "inherit";

        styleTag.innerHTML = `
            ${fontFace}
            * { 
                font-size: ${this.config.font_size}px !important; 
                font-family: ${fontFamily} !important; 
                line-height: 1.5 !important;
            }
            h1 { font-weight: 300 !important; }
        `;
    },

    render() {
        this.init();
        const style = `
            <style>
                #settings-app { position: fixed; top: 0; left: 0; width: 100%; height: 100dvh; background: #FFFFFF; z-index: 10000; display: none; flex-direction: column; color: #333; }
                .s-header { padding: 60px 25px 30px; display: flex; align-items: flex-end; justify-content: space-between; }
                .s-close { color: #999; cursor: pointer; }
                .s-content { flex: 1; overflow-y: auto; padding: 0 25px 100px; }
                .s-accordion { border-bottom: 1px solid #F2F2F2; }
                .s-acc-header { display: flex; align-items: center; justify-content: space-between; padding: 25px 0; cursor: pointer; }
                .s-acc-title { display: flex; align-items: center; color: #444; }
                .s-acc-icon { color: #DDD; transition: transform 0.3s; font-weight: 200; }
                .s-acc-content { display: none; padding: 0 0 30px 0; }
                .s-accordion.active .s-acc-content { display: block; }
                .s-accordion.active .s-acc-icon { transform: rotate(45deg); color: #333; }
                .s-row { display: flex; flex-direction: column; margin-bottom: 25px; }
                .s-label { color: #BBB; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
                .s-input, .s-select { background: transparent; border: none; border-bottom: 1px solid #EEE; padding: 8px 0; color: #333; outline: none; width: 100%; border-radius:0; }
                .s-btn-group { display: flex; gap: 10px; margin-top: 15px; }
                .s-btn-flat { padding: 10px 15px; border: 1px solid #EEE; color: #888; cursor: pointer; background: #fff; text-align: center; }
                .s-btn-dark { background: #333 !important; color: #fff !important; border: none; }
                .p-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 15px; }
                .p-tag { padding: 5px 10px; background: #F8F8F8; color: #999; border: 1px solid #F0F0F0; display: flex; align-items: center; cursor: pointer; }
                .p-tag .x { margin-left: 8px; color: #CCC; }
                .s-footer { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 10px; }
                
                /* 处理中提示 */
                #s-loader { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255,255,255,0.8); z-index: 10001; display: none; align-items: center; justify-content: center; letter-spacing: 2px; color: #333; }
            </style>
        `;

        const html = `
            <div id="s-loader">PROCESSING...</div>
            <div id="settings-app">
                <div class="s-header"><h1>PREFERENCE / 偏好设置</h1><div class="s-close" onclick="SettingsApp.close()">CLOSE</div></div>
                <div class="s-content">
                    <div class="s-accordion" onclick="SettingsApp.toggle(this)">
                        <div class="s-acc-header"><div class="s-acc-title">API SETTINGS / API设置</div><div class="s-acc-icon">+</div></div>
                        <div class="s-acc-content" onclick="event.stopPropagation()">
                            <div class="s-row"><div class="s-label">URL</div><input type="text" id="api-url" class="s-input" value="${this.config.api_url}"></div>
                            <div class="s-row"><div class="s-label">KEY</div><input type="password" id="api-key" class="s-input" value="${this.config.api_key}"></div>
                            <div class="s-row"><div class="s-label">MODEL</div><select id="api-model" class="s-select">${this.renderOptions(this.config.model_list, this.config.model)}</select>
                            <div class="s-btn-group"><div class="s-btn-flat" onclick="SettingsApp.fetchModels('api')">FETCH</div></div></div>
                            <div class="p-list" id="api-presets"></div>
                            <div class="s-btn-group"><div class="s-btn-flat s-btn-dark" onclick="SettingsApp.saveCore('api')">SAVE</div><div class="s-btn-flat" onclick="SettingsApp.savePreset('api')">PRESET</div></div>
                        </div>
                    </div>

                    <div class="s-accordion" onclick="SettingsApp.toggle(this)">
                        <div class="s-acc-header"><div class="s-acc-title">MINIMAX / MiniMax设置</div><div class="s-acc-icon">+</div></div>
                        <div class="s-acc-content" onclick="event.stopPropagation()">
                            <div class="s-row"><div class="s-label">Group ID</div><input type="text" class="s-input" value="${this.config.minimax_group_id}" onchange="SettingsApp.updateField('minimax_group_id', this.value)"></div>
                            <div class="s-row"><div class="s-label">API Key</div><input type="password" class="s-input" value="${this.config.minimax_api_key}" onchange="SettingsApp.updateField('minimax_api_key', this.value)"></div>
                        </div>
                    </div>

                    <div class="s-accordion" onclick="SettingsApp.toggle(this)">
                        <div class="s-acc-header"><div class="s-acc-title">TYPOGRAPHY / 字体设置</div><div class="s-acc-icon">+</div></div>
                        <div class="s-acc-content" onclick="event.stopPropagation()">
                            <div class="s-row"><div class="s-label" id="font-label">Size / ${this.config.font_size}px</div><input type="range" min="12" max="24" value="${this.config.font_size}" oninput="SettingsApp.updateField('font_size', this.value)"></div>
                            <div class="s-row"><div class="s-label">Import</div><div class="s-btn-group">
                                <div class="s-btn-flat" onclick="document.getElementById('f-picker').click()">UPLOAD / 上传</div>
                                <div class="s-btn-flat s-btn-dark" onclick="SettingsApp.saveFontPreset()">SAVE / 保存预设</div>
                            </div></div>
                            <div class="p-list" id="font-presets"></div>
                        </div>
                    </div>

                    <div class="s-accordion" onclick="SettingsApp.toggle(this)">
                        <div class="s-acc-header"><div class="s-acc-title">IMAGE GEN / 生图设置</div><div class="s-acc-icon">+</div></div>
                        <div class="s-acc-content" onclick="event.stopPropagation()">
                            <div class="s-row"><div class="s-label">URL</div><input type="text" id="img-url" class="s-input" value="${this.config.img_url}"></div>
                            <div class="s-row"><div class="s-label">Key</div><input type="password" id="img-key" class="s-input" value="${this.config.img_key}"></div>
                            <div class="s-row"><div class="s-label">Model</div><select id="img-model" class="s-select">${this.renderOptions(this.config.img_model_list, this.config.img_model)}</select>
                            <div class="s-btn-group"><div class="s-btn-flat" onclick="SettingsApp.fetchModels('img')">FETCH</div></div></div>
                            <div class="p-list" id="img-presets"></div>
                            <div class="s-btn-group"><div class="s-btn-flat s-btn-dark" onclick="SettingsApp.saveCore('img')">SAVE</div><div class="s-btn-flat" onclick="SettingsApp.savePreset('img')">PRESET</div></div>
                        </div>
                    </div>

                    <div class="s-accordion" onclick="SettingsApp.toggle(this)">
                        <div class="s-acc-header"><div class="s-acc-title">DATA / 数据管理</div><div class="s-acc-icon">+</div></div>
                        <div class="s-acc-content" onclick="event.stopPropagation()">
                            <div class="s-footer"><div class="s-btn-flat" onclick="SettingsApp.exportData()">EXPORT</div><div class="s-btn-flat" onclick="SettingsApp.importData()">IMPORT</div>
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
    },

    toggle(el) { const act = el.classList.contains('active'); document.querySelectorAll('.s-accordion').forEach(a => a.classList.remove('active')); if(!act) el.classList.add('active'); },
    open() { document.getElementById('settings-app').style.display = 'flex'; this.renderAllPresets(); },
    close() { document.getElementById('settings-app').style.display = 'none'; },
    save() { localStorage.setItem('sys_settings', JSON.stringify(this.config)); },
    
    updateField(k, v) { 
        this.config[k] = v; this.save(); 
        if(k === 'font_size') { 
            const curFontData = this.config.current_font_key ? localStorage.getItem(this.config.current_font_key) : null;
            this.applyGlobalStyles(curFontData); 
            document.getElementById('font-label').innerText = `Size / ${v}px`; 
        } 
    },

    // 🚀 性能优化：使用临时 Blob URL 预览，不走 Base64
    handleFontFile(e) {
        const file = e.target.files[0]; if(!file) return;
        const blobUrl = URL.createObjectURL(file); // 瞬时完成，不产生长文本
        this.tempFile = file; // 暂存文件对象
        this.applyGlobalStyles(blobUrl); 
        alert('预览中（不卡顿版），满意请点保存');
    },

    // 只有点击保存时才执行重度转换
    saveFontPreset() {
        if(!this.tempFile) return alert('请先上传');
        const name = prompt('Font Name:', this.tempFile.name.split('.')[0]); if(!name) return;
        
        document.getElementById('s-loader').style.display = 'flex';
        
        const reader = new FileReader();
        reader.onload = (ev) => {
            const storageKey = 'font_' + Date.now();
            try {
                localStorage.setItem(storageKey, ev.target.result);
                this.config.font_presets.push({ name, storageKey });
                this.config.current_font_key = storageKey;
                this.save();
                this.renderFontPresets();
                document.getElementById('s-loader').style.display = 'none';
                alert('已存入系统库');
            } catch(e) {
                alert('字体太大，存储失败');
                document.getElementById('s-loader').style.display = 'none';
            }
        };
        // 放在 timeout 里让 UI 有时间显示 loader
        setTimeout(() => reader.readAsDataURL(this.tempFile), 100);
    },

    loadFont(i) {
        if(i === -1) { this.config.current_font_key = null; this.applyGlobalStyles(); }
        else {
            const f = this.config.font_presets[i];
            this.config.current_font_key = f.storageKey;
            this.applyGlobalStyles(localStorage.getItem(f.storageKey));
        }
        this.save();
    },

    deleteFont(i, e) {
        e.stopPropagation();
        localStorage.removeItem(this.config.font_presets[i].storageKey);
        this.config.font_presets.splice(i, 1);
        this.save(); this.renderFontPresets();
    },

    // --- 其余逻辑 ---
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
    exportData() {
        const b = {}; for(let i=0; i<localStorage.length; i++){ const k = localStorage.key(i); b[k] = localStorage.getItem(k); }
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(b)], {type:'application/json'}));
        a.download = `ycj_all_${Date.now()}.json`; a.click();
    },
    importData() {
        const i = document.createElement('input'); i.type = 'file';
        i.onchange = e => {
            const r = new FileReader(); r.onload = ev => {
                const d = JSON.parse(ev.target.result); localStorage.clear(); Object.keys(d).forEach(k => localStorage.setItem(k, d[k])); location.reload();
            }; r.readAsText(e.target.files[0]);
        }; i.click();
    },
    clearData() { if(confirm('Wipe All?')) { localStorage.clear(); location.reload(); } }
};
SettingsApp.render();
