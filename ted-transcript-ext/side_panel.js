'use strict';
function initPopup() {
    const lang1Sel = document.getElementById('lang1Sel');
    const lang2Sel = document.getElementById('lang2Sel');
    const genBtn = document.getElementById('genBtn');
    const infoBox = document.getElementById('info');

    if (!lang1Sel || !lang2Sel || !genBtn || !infoBox) {
        console.error('缺少页面元素：lang1Sel、lang2Sel、genBtn 或 info');
        return;
    }

    function initFixedSelect() {
        lang1Sel.replaceChildren(
            new Option('English', 'en'),
            new Option('中文 (简体)', 'zh-cn')
        );
        lang1Sel.value = 'en';

        lang2Sel.replaceChildren(
            new Option('不使用第二语言', ''),
            new Option('English', 'en'),
            new Option('中文 (简体)', 'zh-cn')
        );
        lang2Sel.value = '';
    }

    function normalizeParagraphs(paragraphs) {
        return (Array.isArray(paragraphs) ? paragraphs : [])
            .map(text => String(text).replace(/\s+/g, ' ').trim())
            .filter(Boolean);
    }

    function fontRuns(text) {
        const cjkPattern = /[\u2e80-\u2eff\u3000-\u303f\u31c0-\u31ef\u3200-\u32ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\ufe30-\ufe4f\uff00-\uffef\u{20000}-\u{2fa1f}]+/gu;
        const runs = [];
        let offset = 0;
        for (const match of String(text).matchAll(cjkPattern)) {
            if (match.index > offset) {
                runs.push({ text: String(text).slice(offset, match.index), font: 'Roboto' });
            }
            runs.push({ text: match[0], font: 'NotoSansSC' });
            offset = match.index + match[0].length;
        }
        if (offset < String(text).length) {
            runs.push({ text: String(text).slice(offset), font: 'Roboto' });
        }
        return runs.length ? runs : [{ text: String(text), font: 'Roboto' }];
    }

    async function getActiveTab() {
        const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true
        });
        if (!tab?.id) {
            throw new Error('没有找到当前浏览器标签页，请切换到 TED 演讲页面后重试');
        }
        return tab;
    }


    async function sendToTab(tabId, message) {
        let response;
        try {
            response = await chrome.tabs.sendMessage(tabId, message);
        } catch (error) {
            console.error('TED 页面消息发送失败', error);
            throw new Error(`无法连接当前标签页脚本（${error.message}）。请确认当前标签页是 TED 演讲页面、扩展已获准访问 ted.com，然后刷新 TED 页面`);
        }
        if (!response) {
            throw new Error('页面脚本未响应：请确认当前是 TED 演讲页面、网站访问权限已开启，并刷新页面');
        }
        return response;
    }

    async function isLangAvailable(tabId, val) {
        const response = await sendToTab(tabId, {
            type: 'checkLangExist',
            val
        });
        return response.exist === true;
    }

    async function readLanguage(tabId, val) {
        let response = await sendToTab(tabId, {
            type: 'switchLang',
            val
        });
        if (!response.ok) {
            throw new Error(response.error || '切换字幕语言失败');
        }

        response = await sendToTab(tabId, {
            type: 'readTranscript'
        });
        if (!response.ok) {
            throw new Error(response.error || '读取字幕失败');
        }

        const paragraphs = normalizeParagraphs(response.paragraphs);
        if (!paragraphs.length) {
            throw new Error('字幕为空，请确认 Transcript 文稿面板已加载');
        }
        return {
            paragraphs,
            title: response.title || 'TED Transcript',
            talkSlug: response.talkSlug || 'ted-transcript'
        };
    }

    genBtn.onclick = async () => {
        const L1Val = lang1Sel.value;
        const L1Text = lang1Sel.selectedOptions[0]?.text || L1Val;
        const L2Val = lang2Sel.value;
        const L2Text = lang2Sel.selectedOptions[0]?.text || L2Val;

        let blobUrl = null;
        genBtn.disabled = true;
        infoBox.textContent = '正在校验字幕语言……';

        try {
            if (!L1Val) {
                throw new Error('请选择语言 1');
            }
            if (typeof pdfMake === 'undefined' || typeof pdfMake.createPdf !== 'function') {
                throw new Error('PDF 库未加载，请检查 pdfmake 文件');
            }

            const tab = await getActiveTab();

            if (!(await isLangAvailable(tab.id, L1Val))) {
                throw new Error(`该视频不支持【${L1Text}】字幕`);
            }
            const useSecondLanguage = Boolean(L2Val && L2Val !== L1Val);
            if (useSecondLanguage && !(await isLangAvailable(tab.id, L2Val))) {
                throw new Error(`该视频不支持【${L2Text}】字幕`);
            }

            infoBox.textContent = '正在切换语言、读取字幕，请稍候……';
            const first = await readLanguage(tab.id, L1Val);
            const text1 = first.paragraphs;
            const title = first.talkSlug;
            let text2 = [];
            if (useSecondLanguage) {
                const second = await readLanguage(tab.id, L2Val);
                text2 = second.paragraphs;
            }

            const content = [
                {
                    text: fontRuns(title),
                    fontSize: 20,
                    bold: true,
                    margin: [0, 0, 0, 18]
                }
            ];

            if (!text2.length) {
                for (const p of text1) {
                    content.push({
                        text: fontRuns(p),
                        fontSize: 15,
                        lineHeight: 1.4,
                        margin: [0, 0, 0, 9]
                    });
                }
            } else {
                const maxLen = Math.max(text1.length, text2.length);
                for (let i = 0; i < maxLen; i++) {
                    if (text1[i]) {
                        content.push({
                            text: fontRuns(text1[i]),
                            fontSize: 15,
                            lineHeight: 1.4,
                            margin: [0, 0, 0, text2[i] ? 4 : 9]
                        });
                    }
                    if (text2[i]) {
                        content.push({
                            text: fontRuns(text2[i]),
                            fontSize: 15,
                            color: '#444444',
                            lineHeight: 1.4,
                            margin: [0, 0, 0, 9]
                        });
                    }
                }
            }

            const docDef = {
                pageSize: 'A4',
                pageMargins: [24, 42, 24, 36],
                content,
                defaultStyle: {
                    font: 'Roboto',
                    fontSize: 15,
                    lineHeight: 1.4
                },
                footer: (currentPage, totalPages) => ({
                    text: `${currentPage} / ${totalPages}`,
                    alignment: 'center',
                    fontSize: 9
                })
            };

            infoBox.textContent = '正在生成 PDF……';
            const { fonts, vfs } = await loadTranscriptPdfFonts();
            const pdfDoc = pdfMake.createPdf(docDef, undefined, fonts, vfs);
            const blob = await new Promise((resolve, reject) => {
                try {
                    pdfDoc.getBlob(resolve);
                } catch (err) {
                    reject(err);
                }
            });
            blobUrl = URL.createObjectURL(blob);

            const safeFilename = String(first.talkSlug)
                .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
                .trim() || 'ted-transcript';

            const bgResp = await chrome.runtime.sendMessage({
                type: 'savePdf',
                blobUrl,
                filename: `${safeFilename}.pdf`
            });

            if (!bgResp?.ok) {
                throw new Error(bgResp?.error || '后台下载失败');
            }
            infoBox.textContent = 'PDF 已加入下载队列';
            const tempUrl = blobUrl;
            setTimeout(() => URL.revokeObjectURL(tempUrl), 60000);
            blobUrl = null;

        } catch (err) {
            infoBox.textContent = `操作失败：${err.message || err}`;
            console.error(err);
        } finally {
            if (blobUrl) URL.revokeObjectURL(blobUrl);
            genBtn.disabled = false;
        }
    };

    initFixedSelect();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPopup, { once: true });
} else {
    initPopup();
}
