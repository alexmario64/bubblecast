// Signal only after the native receiver has established its history baseline.
export async function signalTikTokBaseline(source){
 if(source.platform!=='tiktok'||!source.capture?.feed.ready||source.pageBaselineNotified||source.win.isDestroyed())return;
 const actual=new URL(source.win.webContents.getURL()),expected=new URL(source.url);
 if(actual.origin!==expected.origin||actual.pathname!==expected.pathname)return;
 await source.win.webContents.executeJavaScript('window.__bubblecastTikTokBaselineReady=true;window.dispatchEvent(new Event("bubblecast-tiktok-baseline-ready"));');
 source.pageBaselineNotified=true;
}
