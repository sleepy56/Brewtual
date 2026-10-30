'use client';
import { useEffect, useState } from 'react';
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
export function InstallApp() {
 const [prompt,setPrompt]=useState<InstallEvent|null>(null),[help,setHelp]=useState(false);
 useEffect(()=>{
   if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js').catch(()=>{});
   const listener=(e:Event)=>{e.preventDefault();setPrompt(e as InstallEvent);};
   window.addEventListener('beforeinstallprompt',listener);
   return ()=>window.removeEventListener('beforeinstallprompt',listener);
 },[]);
 return <div className="install-widget"><button className="subtle" onClick={async()=>{if(prompt){setPrompt(null);try{await prompt.prompt();await prompt.userChoice;}catch{setHelp(true);}}else setHelp(!help);}}>↓ Get the phone app</button>{help&&<div className="install-help" role="status"><button aria-label="Close installation help" onClick={()=>setHelp(false)}>×</button><h3>Take your little rituals with you.</h3><p>iPhone: open this site in Safari, tap Share, then Add to Home Screen and enable Open as Web App.</p><p>Android: open in Chrome, tap the menu, then Install app or Add to Home screen.</p><p className="small muted">Use your deployed HTTPS website address on your phone. Internet is needed for account and shared progress.</p></div>}</div>;
}
