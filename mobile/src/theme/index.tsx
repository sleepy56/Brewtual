import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {Platform} from 'react-native';

export type ThemeName = 'midnight' | 'dawn' | 'plum' | 'ocean';
export type Theme = {name: ThemeName; description: string; isDark: boolean; bg: string; surface: string; surface2: string; text: string; muted: string; border: string; accent: string; accentText: string; accentSoft: string; heroBg: string; heroText: string; heroMuted: string; success: string; warning: string; danger: string; focus: string; purple: string; shadow: string; serif: string; sans: string};
export const themes: Record<ThemeName, Theme> = {
  midnight: {name:'midnight',description:'Black, cyan & coffee',isDark:true,bg:'#08090b',surface:'#101114',surface2:'#18191d',text:'#f1f0ec',muted:'#a7a9af',border:'#2b2d32',accent:'#79e4ed',accentText:'#071518',accentSoft:'#18282c',heroBg:'#171b20',heroText:'#f1f0ec',heroMuted:'#b5a08f',success:'#79e4ed',warning:'#d9ae89',danger:'#ffb7ac',focus:'#8deaf2',purple:'#c79a77',shadow:'#00000012',serif:Platform.select({ios:'Georgia',android:'serif',default:'Georgia'})!,sans:Platform.select({ios:'System',android:'sans-serif',default:'Arial'})!},
  dawn: {name:'dawn',description:'Soft & light',isDark:false,bg:'#f7f4ec',surface:'#fffdf8',surface2:'#eeeee3',text:'#29382f',muted:'#59685d',border:'#b9c6b8',accent:'#365f45',accentText:'#fffdf7',accentSoft:'#e2ebe0',heroBg:'#dbe6c9',heroText:'#293e21',heroMuted:'#4a6040',success:'#345b42',warning:'#78541b',danger:'#a33c36',focus:'#6c491b',purple:'#6b508e',shadow:'#26332610',serif:Platform.select({ios:'Georgia',android:'serif',default:'Georgia'})!,sans:Platform.select({ios:'System',android:'sans-serif',default:'Arial'})!},
  plum: {name:'plum',description:'Calm & dark',isDark:true,bg:'#211b27',surface:'#2c2434',surface2:'#382d43',text:'#f4edf5',muted:'#bfb0c9',border:'#51445f',accent:'#dac2ec',accentText:'#372343',accentSoft:'#463451',heroBg:'#d9c5e5',heroText:'#3c2948',heroMuted:'#644e70',success:'#c3dfc8',warning:'#ecd29d',danger:'#ffb7bd',focus:'#eacf99',purple:'#dac2ec',shadow:'#00000018',serif:Platform.select({ios:'Georgia',android:'serif',default:'Georgia'})!,sans:Platform.select({ios:'System',android:'sans-serif',default:'Arial'})!},
  ocean: {name:'ocean',description:'Calm & dark',isDark:true,bg:'#141f29',surface:'#1d2c38',surface2:'#293a48',text:'#edf3f4',muted:'#a8bec9',border:'#405b6c',accent:'#b5dce8',accentText:'#213c4b',accentSoft:'#294652',heroBg:'#b8dbe4',heroText:'#254250',heroMuted:'#466774',success:'#badeca',warning:'#f0d5aa',danger:'#ffbdb3',focus:'#efd39f',purple:'#c7cbee',shadow:'#0000001c',serif:Platform.select({ios:'Georgia',android:'serif',default:'Georgia'})!,sans:Platform.select({ios:'System',android:'sans-serif',default:'Arial'})!},
};
const KEY='@pair-habits/theme';
type ContextValue={theme:Theme;themeName:ThemeName;setTheme:(name:ThemeName)=>void;ready:boolean;persistenceError:boolean};
const ThemeContext=createContext<ContextValue|undefined>(undefined);
export function ThemeProvider({children}:{children:React.ReactNode}) {
 const [name,setName]=useState<ThemeName>('midnight'); const [ready,setReady]=useState(false); const [persistenceError,setPersistenceError]=useState(false);
 const changedDuringHydration=useRef(false); const writes=useRef<Promise<void>>(Promise.resolve());
 useEffect(()=>{let live=true; AsyncStorage.getItem(KEY).then(v=>{if(live&&!changedDuringHydration.current&&v&&Object.prototype.hasOwnProperty.call(themes,v))setName(v as ThemeName)}).catch(()=>{if(live)setPersistenceError(true)}).finally(()=>{if(live)setReady(true)});return()=>{live=false}},[]);
 const setTheme=useCallback((next:ThemeName)=>{if(!Object.prototype.hasOwnProperty.call(themes,next))return;changedDuringHydration.current=true;setName(next);writes.current=writes.current.then(()=>AsyncStorage.setItem(KEY,next)).then(()=>{setPersistenceError(false)}).catch(()=>{setPersistenceError(true)});},[]);
 const value=useMemo(()=>({theme:themes[name],themeName:name,setTheme,ready,persistenceError}),[name,setTheme,ready,persistenceError]);
 return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
export function useTheme(){const value=useContext(ThemeContext);if(!value)throw new Error('useTheme must be used within ThemeProvider');return value}
