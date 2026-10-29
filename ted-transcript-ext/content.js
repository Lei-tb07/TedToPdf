'use strict';

function normalizeText(text) {
    return String(text ?? "").replace(/\s+/g, ' ').trim();
}

async function waitForTranscriptRoot(timeout = 12000) {
    const start = Date.now();
    while(Date.now() - start < timeout){
        const h4List = document.querySelectorAll('h4');
        for(const h4 of h4List){
            if(h4.textContent.includes('Transcript')){
                const root = h4.closest('section') ||
                    h4.closest('div.mx-auto.mb-10.w-full')?.parentElement;
                if(root) return root;
            }
        }
        await new Promise(r => setTimeout(r, 350));
    }
    throw new Error("未找到Transcript面板，请手动打开文稿");
}

async function getLangSelect(rootSection) {
    const sel = rootSection.querySelector('div.relative.w-full select');
    if (!sel) throw new Error("字幕语言下拉框找不到");
    return sel;
}

function readTranscript(rootSection) {
    const blocks = rootSection.querySelectorAll('div.mb-6.w-full');
    const res = [];
    for(const b of blocks){
        const btns = b.querySelectorAll('[role="button"][aria-label]');
        const lines = [];
        for(const btn of btns){
            const txt = normalizeText(btn.getAttribute('aria-label'));
            if(txt) lines.push(txt);
        }
        if(lines.length) res.push(lines.join(' '));
    }
    return res;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    (async () => {
        try {
            const root = await waitForTranscriptRoot();
            const selectEl = await getLangSelect(root);
            if(msg.type === "checkLangExist"){
                const exist = Array.from(selectEl.options).some(opt => opt.value === msg.val);
                sendResponse({exist});
            }else if(msg.type === "switchLang"){
                selectEl.value = msg.val;
                selectEl.dispatchEvent(new Event('change', {bubbles:true}));
                await new Promise(r=>setTimeout(r,1600));
                sendResponse({ok:true});
            }else if(msg.type === "readTranscript"){
                const paragraphs = readTranscript(root);
                const title = document.title.replace(/\s*[|‑]\s*TED.*/i, "").trim();
                const talkSlug = location.pathname.match(/^\/talks\/([^/]+)/)?.[1] || 'ted-transcript';
                sendResponse({ok:true, paragraphs, title, talkSlug});
            }else{
                sendResponse({ok:false, error:"未知消息类型"});
            }
        } catch (e) {
            sendResponse({ok:false, error:e.message});
        }
    })();
    return true;
});

