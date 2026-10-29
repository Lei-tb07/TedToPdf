chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if(msg.type === "savePdf"){
    chrome.downloads.download({
      url: msg.dataUrl || msg.blobUrl,
      filename: msg.filename,
      conflictAction:"uniquify"
    }).then(downloadId=>{
      sendResponse({ok:true, downloadId});
    }).catch(err=>{
      sendResponse({ok:false, error: err.message});
    });
    return true;
  }
});
