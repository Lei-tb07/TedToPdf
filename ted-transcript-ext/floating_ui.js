'use strict';

(function mountFloatingExporter() {
    if (document.getElementById('tedtopdf-root')) return;

    const host = document.createElement('div');
    host.id = 'tedtopdf-root';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
        <style>
            :host {
                position: fixed;
                right: 22px;
                bottom: 22px;
                z-index: 2147483647;
                width: 54px;
                height: 54px;
                color: #17212f;
                font-family: Arial, "Microsoft YaHei", sans-serif;
                font-size: 14px;
                line-height: 1.4;
            }
            * { box-sizing: border-box; }
            button, select { font: inherit; }
            button:focus-visible, select:focus-visible {
                outline: 3px solid #146ca8;
                outline-offset: 2px;
            }
            #launcher {
                display: grid;
                place-items: center;
                width: 54px;
                height: 54px;
                padding: 0;
                border: 2px solid #fff;
                border-radius: 50%;
                background: #dc3545;
                color: #fff;
                box-shadow: 0 3px 12px #0004;
                font-size: 14px;
                font-weight: 700;
                cursor: pointer;
            }
            #launcher:hover { background: #bf2636; }
            #panel {
                position: absolute;
                right: 0;
                bottom: 68px;
                width: min(356px, calc(100vw - 32px));
                max-height: calc(100vh - 112px);
                overflow: auto;
                padding: 20px;
                border: 1px solid #dce2e9;
                border-radius: 8px;
                background: #fff;
                box-shadow: 0 8px 28px #0003;
            }
            #panel[hidden] { display: none; }
            .header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding-bottom: 14px;
                margin-bottom: 18px;
                border-bottom: 1px solid #e3e8ed;
            }
            h2 { margin: 0; font-size: 21px; line-height: 1.2; font-weight: 700; }
            #close {
                flex: 0 0 32px;
                width: 32px;
                height: 32px;
                padding: 0;
                border: 0;
                border-radius: 4px;
                background: transparent;
                color: #4b5563;
                font-size: 26px;
                line-height: 1;
                cursor: pointer;
            }
            #close:hover { background: #f0f2f5; }
            label { display: block; margin: 0 0 6px; color: #455365; font-weight: 600; }
            select {
                display: block;
                width: 100%;
                min-height: 48px;
                margin-bottom: 16px;
                padding: 8px 12px;
                border: 1px solid #cbd5df;
                border-radius: 6px;
                background: #fff;
                color: #17212f;
                font-size: 16px;
            }
            #download {
                width: 100%;
                min-height: 48px;
                margin-top: 6px;
                padding: 9px 14px;
                border: 0;
                border-radius: 6px;
                background: #dc3545;
                color: #fff;
                font-size: 16px;
                font-weight: 700;
                cursor: pointer;
            }
            #download:hover { background: #bf2636; }
            #download:disabled { opacity: .55; cursor: wait; }
            #status { min-height: 20px; margin: 12px 0 0; color: #455365; overflow-wrap: anywhere; }
            #status[data-state="error"] { color: #a82030; }
            @media (max-width: 480px) {
                :host { right: 16px; bottom: 16px; }
                #panel { bottom: 66px; }
            }
        </style>
        <section id="panel" aria-label="TedToPDF" hidden>
            <div class="header">
                <h2>TedToPDF</h2>
                <button id="close" type="button" aria-label="关闭面板" title="关闭面板">&times;</button>
            </div>
            <label for="lang1">语言 1</label>
            <select id="lang1">
                <option value="en">English</option>
                <option value="zh-cn">中文 (简体)</option>
            </select>
            <label for="lang2">语言 2</label>
            <select id="lang2">
                <option value="">不使用第二语言</option>
                <option value="en">English</option>
                <option value="zh-cn">中文 (简体)</option>
            </select>
            <button id="download" type="button">下载 PDF</button>
            <p id="status" role="status" aria-live="polite"></p>
        </section>
        <button id="launcher" type="button" aria-label="打开 TedToPDF" aria-controls="panel" aria-expanded="false" title="打开 TedToPDF">PDF</button>
    `;
    document.documentElement.appendChild(host);

    const panel = shadow.getElementById('panel');
    const launcher = shadow.getElementById('launcher');
    const close = shadow.getElementById('close');
    const lang1 = shadow.getElementById('lang1');
    const lang2 = shadow.getElementById('lang2');
    const download = shadow.getElementById('download');
    const status = shadow.getElementById('status');

    function setOpen(open) {
        panel.hidden = !open;
        launcher.setAttribute('aria-expanded', String(open));
        if (open) lang1.focus();
        else launcher.focus();
    }

    function setStatus(message, isError = false) {
        status.textContent = message;
        status.dataset.state = isError ? 'error' : '';
    }

    function fontRuns(text) {
        const value = String(text);
        const cjk = /[\u2e80-\u2eff\u3000-\u303f\u31c0-\u31ef\u3200-\u32ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\ufe30-\ufe4f\uff00-\uffef\u{20000}-\u{2fa1f}]+/gu;
        const runs = [];
        let offset = 0;
        for (const match of value.matchAll(cjk)) {
            if (match.index > offset) runs.push({ text: value.slice(offset, match.index), font: 'Roboto' });
            runs.push({ text: match[0], font: 'NotoSansSC' });
            offset = match.index + match[0].length;
        }
        if (offset < value.length) runs.push({ text: value.slice(offset), font: 'Roboto' });
        return runs.length ? runs : [{ text: value, font: 'Roboto' }];
    }

    async function readLanguage(value) {
        const root = await waitForTranscriptRoot();
        const select = await getLangSelect(root);
        if (![...select.options].some(option => option.value === value)) {
            throw new Error(`该视频不支持【${value === 'en' ? 'English' : '中文 (简体)'}】字幕`);
        }
        if (select.value !== value) {
            select.value = value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            await new Promise(resolve => setTimeout(resolve, 1600));
        }
        const paragraphs = readTranscript(await waitForTranscriptRoot());
        if (!paragraphs.length) throw new Error('字幕为空，请先打开 TED 的 Transcript 文稿面板');
        return paragraphs;
    }

    function makeDocument(title, first, second) {
        const content = [{ text: fontRuns(title), fontSize: 20, bold: true, margin: [0, 0, 0, 18] }];
        const count = Math.max(first.length, second.length);
        for (let i = 0; i < count; i++) {
            if (first[i]) {
                content.push({
                    text: fontRuns(first[i]), fontSize: 15, lineHeight: 1.4,
                    margin: [0, 0, 0, second[i] ? 4 : 9]
                });
            }
            if (second[i]) {
                content.push({
                    text: fontRuns(second[i]), fontSize: 15, color: '#444444',
                    lineHeight: 1.4, margin: [0, 0, 0, 9]
                });
            }
        }
        return {
            pageSize: 'A4',
            pageMargins: [24, 42, 24, 36],
            content,
            defaultStyle: { font: 'Roboto', fontSize: 15, lineHeight: 1.4 },
            footer: (current, total) => ({
                text: `${current} / ${total}`, alignment: 'center', fontSize: 9
            })
        };
    }

    launcher.addEventListener('click', () => setOpen(panel.hidden));
    close.addEventListener('click', () => setOpen(false));
    shadow.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !panel.hidden) setOpen(false);
    });
    document.addEventListener('pointerdown', event => {
        if (!panel.hidden && !event.composedPath().includes(host)) {
            panel.hidden = true;
            launcher.setAttribute('aria-expanded', 'false');
        }
    });

    download.addEventListener('click', async () => {
        download.disabled = true;
        lang1.disabled = true;
        lang2.disabled = true;
        let originalLanguage;
        try {
            if (typeof pdfMake === 'undefined' || typeof pdfMake.createPdf !== 'function') {
                throw new Error('PDF 库未加载');
            }
            const root = await waitForTranscriptRoot();
            originalLanguage = (await getLangSelect(root)).value;
            setStatus('正在读取字幕...');
            const first = await readLanguage(lang1.value);
            const second = lang2.value && lang2.value !== lang1.value
                ? await readLanguage(lang2.value)
                : [];
            const slug = location.pathname.match(/^\/talks\/([^/]+)/)?.[1] || 'ted-transcript';
            const filename = `${slug.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')}.pdf`;

            setStatus('正在生成 PDF...');
            const { fonts, vfs } = await loadTranscriptPdfFonts();
            const pdf = pdfMake.createPdf(makeDocument(slug, first, second), undefined, fonts, vfs);
            const base64 = await new Promise((resolve, reject) => {
                try { pdf.getBase64(resolve); } catch (error) { reject(error); }
            });
            const response = await chrome.runtime.sendMessage({
                type: 'savePdf',
                dataUrl: `data:application/pdf;base64,${base64}`,
                filename
            });
            if (!response?.ok) throw new Error(response?.error || 'PDF 下载失败');
            setStatus('PDF 已加入下载队列');
        } catch (error) {
            console.error('TedToPDF export failed', error);
            setStatus(error.message || 'PDF 导出失败', true);
        } finally {
            if (originalLanguage) {
                try {
                    const select = await getLangSelect(await waitForTranscriptRoot(1000));
                    if (select.value !== originalLanguage) {
                        select.value = originalLanguage;
                        select.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                } catch (error) {
                    console.warn('Could not restore transcript language', error);
                }
            }
            download.disabled = false;
            lang1.disabled = false;
            lang2.disabled = false;
        }
    });
})();
