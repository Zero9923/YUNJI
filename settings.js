// settings.js - 极致扁平 / 全局字号逻辑修正版

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
            current_font_data: null,

            img_url: 'https://api.openai.com/v1',
            img_key: '',
            img_model: 'dall-e-3',
            img_model_list: ['dall-e-3', 'dall-e-2'],
            img_presets: []
        };
        const saved = JSON.parse(localStorage.getItem('sys_settings')) || {};
        this.config = { ...defaults, ...saved };
        
        // 逻辑修正：初始化时立刻应用字号和字体
        this.applyGlobalStyles();
    },

    render() {
        this.init();
        const style = `
            <style>
                #settings-app {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100dvh;
                    background: #FFFFFF; z-index: 10000; display: none; flex-direction: column;
                    font-family: -apple-system, sans-serif; color: #333;
                }
                .s-header { padding: 60px 25px 30px; display: flex; align-items: flex-end; justify-content: space-between; }
                .s-header h1 { margin: 0; font-size: 24px; font-weight: 300; letter-spacing: 1px; color: #1a1a1a; }
                .s-header h1 .cn { font-size: 14px; color: #999; }
                .s-close { font-size: 13px; color: #999; cursor: pointer; }

                .s-content { flex: 1; overflow-y: auto; padding: 0 25px 100px; }
                .s-accordion { border-bottom: 1px solid #F2F2F2; }
                .s-acc-header { display: flex; align-items: center; justify-content: space-between; padding: 25px 0; cursor: pointer; }
                .s-acc-title { display: flex; align-items: center; font-size: 14px; color: #444; }
                .s-acc-title .cn { font-size: 11px; color: #AAA; margin-left: 5px; }
                .s-acc-icon { font-size: 18px; color: #DDD; transition: transform 0.3s; font-weight: 200; }
                .s-acc-content { display: none; padding: 0 0 35px 0; animation: sFadeIn 0.3s ease; }
                .s-accordion.active .s-acc-content { display: block; }
                .s-accordion.active .s-acc-icon { transform: rotate(45deg); color: #333; }

                .s-row { display: flex; flex-direction: column; margin-bottom: 25px; }
                .s-label { font-size: 11px; color: #BBB; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
                .s-input, .s-select {
                    background: transparent; border: none; border-bottom: 1px solid #EEE;
                    padding: 10px 0; font-size: 16px; color: #333; outline: none; border-radius: 0; width: 100%;
                }
                .s-input:focus { border-bottom-color: #333; }

                .s-color-tag { width: 10px; height: 10px; margin-right: 12px; border-radius: 50%; display: inline-block; }
                .s-btn-group { display: flex; gap: 10px; margin-top: 20px; }
                .s-btn-flat { padding: 10px 15px; font-size: 11px; border: 1px solid #EEE; color: #888; cursor: pointer; background: #fff; }
                .s-btn-dark { background: #333; color: #fff; border: none; }

                .p-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 15px; }
                .p-tag { 
                    padding: 6px 12px; font-size: 11px; background: #F8F8F8; color: #999; 
                    border-radius: 2px; cursor: pointer; border: 1px solid #F0F0F0; display: flex; align-items: center;
                }
                .p-tag .x { margin-left: 8px; color: #CCC; font-size: 14px; }

                .s-footer { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 10px; }
                .s-btn-danger { color: #d9a7a7; border-color: #f2e6e6; }
                @keyframes sFadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
            </style>
        `;

        const html = `
            <div id="settings-app">
                <div class="s-header">
                    <h1>PREFERENCE / <span class="cn">偏好设置</span></h1>
                    <div class="s-close" onclick="SettingsApp.close()">CLOSE</div>
                </div>
                <div class="s-content">
                    
                    <!-- 1. API 设置 -->
                    <div class="s-accordion" onclick="SettingsApp.toggle(this)">
                        <div class="s-acc-header">
                            <div class="s-acc-title"><span class="s-color-tag" style="background:#BDC3C7"></span>API SETTINGS / <span class="cn">API设置</span></div>
                            <div class="s-acc-icon">+</div>
                        </div>
                        <div class="s-acc-content" onclick="event.stopPropagation()">
                            <div class="s-row"><div class="s-label">URL / 地址</div><input type="text" id="api-url" class="s-input" value="${this.config.api_url}"></div>
                            <div class="s-row"><div class="s-label">KEY / 密钥</div><input type="password" id="api-key" class="s-input" value="${this.config.api_key}"></div>
                            <div class="s-row">
                                <div class="s-label">MODEL / 模型</div>
                                <select id="api-model" class="s-select">${this.renderOptions(this.config.model_list, this.config.model)}</select>
                                <div class="s-btn-group"><div class="s-btn-flat" onclick="SettingsApp.fetchModels('api')">FETCH / 获取列表</div></div>
                            </div>
                            <div class="p-list" id="api-presets"></div>
                            <div class="s-btn-group">
                                <div class="s-btn-flat s-btn-dark" onclick="SettingsApp.saveCore('api')">SAVE / 保存</div>
                                <div class="s-btn-flat" onclick="SettingsApp.savePreset('api')">AS PRESET / 存为预设</div>
                            </div>
                        </div>
                    </div>

                    <!-- 2. MiniMax 设置 -->
                    <div class="s-accordion" onclick="SettingsApp.toggle(this)">
                        <div class="s-acc-header">
                            <div class="s-acc-title"><span class="s-color-tag" style="background:#D1C1B7"></span>MINIMAX SETTINGS / <span class="cn">MiniMax设置</span></div>
                            <div class="s-acc-icon">+</div>
                        </div>
                        <div class="s-acc-content" onclick="event.stopPropagation()">
                            <div class="s-row"><div class="s-label">Group ID</div><input type="text" class="s-input" value="${this.config.minimax_group_id}" onchange="SettingsApp.updateField('minimax_group_id', this.value)"></div>
                            <div class="s-row"><div class="s-label">API Key</div><input type="password" class="s-input" value="${this.config.minimax_api_key}" onchange="SettingsApp.updateField('minimax_api_key', this.value)"></div>
                        </div>
                    </div>

                    <!-- 3. 字体设置 -->
                    <div class="s-accordion" onclick="SettingsApp.toggle(this)">
                        <div class="s-acc-header">
                            <div class="s-acc-title"><span class="s-color-tag" style="background:#AAB2A8"></span>TYPOGRAPHY / <span class="cn">字体设置</span></div>
                            <div class="s-acc-icon">+</div>
                        </div>
                        <div class="s-acc-content" onclick="event.stopPropagation()">
                            <div class="s-row">
                                <div class="s-label" id="font-label">Size / ${this.config.font_size}px</div>
                                <input type="range" min="12" max="22" value="${this.config.font_size}" oninput="SettingsApp.updateField('font_size', this.value)">
                            </div>
                            <div class="s-row">
                                <div class="s-label">Upload Font / 上传字体</div>
                                <div class="s-btn-group"><div class="s-btn-flat" onclick="document.getElementById('f-picker').click()">UPLOAD .TTF/.OTF</div></div>
                            </div>
                            <div class="p-list" id="font-presets"></div>
                        </div>
                    </div>

                    <!-- 4. 生图设置 -->
                    <div class="s-accordion" onclick="SettingsApp.toggle(this)">
                        <div class="s-acc-header">
                            <div class="s-acc-title"><span class="s-color-tag" style="background:#B7C1D1"></span>IMAGE GEN / <span class="cn">生图设置</span></div>
                            <div class="s-acc-icon">+</div>
                        </div>
                        <div class="s-acc-content" onclick="event.stopPropagation()">
                            <div class="s-row"><div class="s-label">URL</div><input type="text" id="img-url" class="s-input" value="${this.config.img_url}"></div>
                            <div class="s-row"><div class="s-label">Key</div><input type="password" id="img-key" class="s-input" value="${this.config.img_key}"></div>
                            <div class="s-row">
                                <div class="s-label">Model</div>
                                <select id="img-model" class="s-select">${this.renderOptions(this.config.img_model_list, this.config.img_model)}</select>
                                <div class="s-btn-group"><div class="s-btn-flat" onclick="SettingsApp.fetchModels('img')">FETCH / 获取列表</div></div>
                            </div>
                            <div class="p-list" id="img-presets"></div>
                            <div class="s-btn-group">
                                <div class="s-btn-flat s-btn-dark" onclick="SettingsApp.saveCore('img')">SAVE / 保存</div>
                                <div class="s-btn-flat" onclick="SettingsApp.savePreset('img')">AS PRESET / 存为预设</div>
                            </div>
                        </div>
                    </div>

                    <!-- 5. 数据管理 -->
                    <div class="s-accordion" onclick="SettingsApp.toggle(this)">
                        <div class="s-acc-header">
                            <div class="s-acc-title"><span class="s-color-tag" style="background:#E5E5E5"></span>DATA MANAGEMENT / <span class="cn">数据管理</span></div>
                            <div class="s-acc-icon">+</div>
                        </div>
                        <div class="s-acc-content" onclick="event.stopPropagation()">
                            <div class="s-footer">
                                <div class="s-btn-flat" onclick="SettingsApp.exportData()">EXPORT BACKUP</div>
                                <div class="s-btn-flat" onclick="SettingsApp.importData()">IMPORT BACKUP</div>
                                <div class="s-btn-flat s-btn-danger" style="grid-column: span 2; margin-top:10px" onclick="SettingsApp.clearData()">WIPE ALL DATA</div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
            <input type="file" id="f-picker" style="display:none" accept=".ttf,.otf,.woff">
        `;

        document.body.insertAdjacentHTML('beforeend', style + html);
        this.renderAllPresets();
        document.getElementById('f-picker').onchange = (e) => this.handleFont(e);
    },

    // 逻辑部分
    applyGlobalStyles() {
        let s = document.getElementById('global-dynamic-styles');
        if(!s) {
            s = document.createElement('style');
            s.id = 'global-dynamic-styles';
            document.head.appendChild(s);
        }
        
        const fontFace = this.config.current_font_data 
            ? `@font-face { font-family: 'Custom'; src: url(${this.config.current_font_data}); }` 
            : '';
        const fontFamily = this.config.current_font_data ? "'Custom', sans-serif" : "inherit";

        // 核心逻辑：强制覆盖所有元素的字号和字体
        s.innerHTML = `
            ${fontFace}
            html, body, div, span, input, select, button, .app-name { 
                font-size: ${this.config.font_size}px !important; 
                font-family: ${fontFamily} !important; 
            }
            .s-header h1 { font-size: 24px !important; } /* 排除标题 */
            .s-label, .cn { font-size: 11px !important; } /* 排除小标签 */
        `;
    },

    updateField(k, v) { 
        this.config[k] = v; this.save(); 
        if(k === 'font_size') {
            this.applyGlobalStyles();
            document.getElementById('font-label').innerText = `Size / ${v}px`;
        }
    },

    renderOptions(list, cur) { return (list||[]).map(m => `<option value="${m}" ${m===cur?'selected':''}>${m}</option>`).join(''); },
    renderAllPresets() {
        this.renderPresetList('api-presets', this.config.api_presets, 'api');
        this.renderPresetList('img-presets', this.config.img_presets, 'img');
        this.renderFontPresets();
    },
    renderPresetList(domId, data, type) {
        const list = document.getElementById(domId); if(!list) return;
        list.innerHTML = (data || []).map((p, i) => `
            <div class="p-tag" onclick="SettingsApp.loadPreset('${type}', ${i})">${p.name}<span class="x" onclick="SettingsApp.deletePreset('${type}', ${i}, event)">×</span></div>
        `).join('');
    },
    renderFontPresets() {
        const list = document.getElementById('font-presets'); if(!list) return;
        let h = `<div class="p-tag" onclick="SettingsApp.loadFont(-1)">Default</div>`;
        h += (this.config.font_presets || []).map((f, i) => `
            <div class="p-tag" onclick="SettingsApp.loadFont(${i})">${f.name}<span class="x" onclick="SettingsApp.deleteFont(${i}, event)">×</span></div>
        `).join('');
        list.innerHTML = h;
    },

    toggle(el) {
        const act = el.classList.contains('active');
        document.querySelectorAll('.s-accordion').forEach(a => a.classList.remove('active'));
        if(!act) el.classList.add('active');
    },

    open() { document.getElementById('settings-app').style.display = 'flex'; this.renderAllPresets(); },
    close() { document.getElementById('settings-app').style.display = 'none'; },
    save() { localStorage.setItem('sys_settings', JSON.stringify(this.config)); },
    saveCore(type) {
        this.config[`${type}_url`] = document.getElementById(`${type}-url`).value;
        this.config[`${type}_key`] = document.getElementById(`${type}-key`).value;
        this.config[`${type}_model`] = document.getElementById(`${type}-model`).value;
        this.save(); alert('Saved.');
    },
    savePreset(type) {
        const name = prompt('Name:'); if(!name) return;
        this.config[`${type}_presets`].push({ name, url: document.getElementById(`${type}-url`).value, key: document.getElementById(`${type}-key`).value, model: document.getElementById(`${type}-model`).value });
        this.save(); this.renderAllPresets();
    },
    loadPreset(type, i) {
        const p = this.config[`${type}_presets`][i];
        document.getElementById(`${type}-url`).value = p.url; document.getElementById(`${type}-key`).value = p.key;
        this.config[`${type}_model`] = p.model; this.saveCore(type);
    },
    deletePreset(type, i, e) { e.stopPropagation(); this.config[`${type}_presets`].splice(i, 1); this.save(); this.renderAllPresets(); },

    async fetchModels(type) {
        const url = document.getElementById(`${type}-url`).value.replace(/\/+$/, "");
        const key = document.getElementById(`${type}-key`).value;
        const btn = event.target; btn.innerText = 'WAIT...';
        try {
            const res = await fetch(`${url}/models`, { headers: { 'Authorization': `Bearer ${key}` } });
            const j = await res.json();
            if(j.data) {
                this.config[`${type}_model_list`] = j.data.map(m => m.id);
                document.getElementById(`${type}-model`).innerHTML = this.renderOptions(this.config[`${type}_model_list`], this.config[`${type}_model`]);
                this.save();
            }
        } catch(e) { alert('Fetch Error'); }
        finally { btn.innerText = 'FETCH'; }
    },

    handleFont(e) {
        const file = e.target.files[0]; if(!file) return;
        const r = new FileReader();
        r.onload = (ev) => {
            const name = file.name.split('.')[0];
            this.config.font_presets.push({ name, data: ev.target.result });
            this.save(); this.renderFontPresets();
        };
        r.readAsDataURL(file);
    },
    loadFont(i) {
        if(i===-1) this.config.current_font_data = null;
        else this.config.current_font_data = this.config.font_presets[i].data;
        this.save();
        this.applyGlobalStyles();
    },
    deleteFont(i, e) { e.stopPropagation(); this.config.font_presets.splice(i, 1); this.save(); this.renderFontPresets(); },

    exportData() {
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(localStorage)], {type:'application/json'}));
        a.download = `backup_${Date.now()}.json`; a.click();
    },
    importData() {
        const i = document.createElement('input'); i.type = 'file';
        i.onchange = e => {
            const r = new FileReader(); r.onload = ev => {
                const d = JSON.parse(ev.target.result); Object.keys(d).forEach(k => localStorage.setItem(k, d[k])); location.reload();
            }; r.readAsText(e.target.files[0]);
        }; i.click();
    },
    clearData() { if(confirm('Clear all?')) { localStorage.clear(); location.reload(); } }
};

SettingsApp.render();
