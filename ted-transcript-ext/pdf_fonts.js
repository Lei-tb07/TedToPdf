'use strict';
// Bundle fonts with the extension so PDF export also works offline.
let transcriptPdfFontsPromise;
async function loadTranscriptPdfFonts() {
    if (!transcriptPdfFontsPromise) {
        transcriptPdfFontsPromise = (async () => {
            const filenames = ['NotoSansSC-Regular.otf', 'NotoSansSC-Bold.otf'];
            const entries = await Promise.all(filenames.map(async filename => {
                const response = await fetch(chrome.runtime.getURL(`fonts/${filename}`));
                if (!response.ok) throw new Error(`PDF font load failed: ${filename}`);
                const bytes = new Uint8Array(await response.arrayBuffer());
                const chunks = [];
                for (let offset = 0; offset < bytes.length; offset += 32768) {
                    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 32768)));
                }
                return [filename, btoa(chunks.join(''))];
            }));
            return {
                fonts: {
                    Roboto: {
                        normal: 'Roboto-Regular.ttf',
                        bold: 'Roboto-Medium.ttf',
                        italics: 'Roboto-Italic.ttf',
                        bolditalics: 'Roboto-MediumItalic.ttf'
                    },
                    NotoSansSC: {
                        normal: filenames[0],
                        bold: filenames[1],
                        italics: filenames[0],
                        bolditalics: filenames[1]
                    }
                },
                vfs: Object.assign({}, pdfMake.vfs || {}, Object.fromEntries(entries))
            };
        })().catch(error => {
            transcriptPdfFontsPromise = undefined;
            throw error;
        });
    }
    return transcriptPdfFontsPromise;
}
