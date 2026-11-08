'use client';
import { useState } from 'react';
import { BrewtualMark } from './brewtual-mark';
import { ThemePicker, appearances } from './appearance';
import { AppIcon } from './app-icon';

const previewSections = {
  personal: { name: 'Personal', caption: 'A little time for you.', tasks: ['Read ten pages', 'Take a little walk', 'A moment of calm'], note: 'A clear mind. A fresh page. Your own pace.' },
  partner: { name: 'Partner', caption: 'Different days. Same team.', tasks: ['Plan our Sunday', 'An evening walk', 'Cook something new'], note: 'Sunday: the farmers’ market, coffee, and nowhere to rush.' },
  group: { name: 'Group', caption: 'Your little cheering section.', tasks: ['Move for 30 minutes', 'The next book-club chapter', 'Make time for a friend'], note: 'Friday’s little plan: bring a book, leave with a story.' },
};

export function Landing({ enter, theme, setTheme }: { enter: () => void; theme: string; setTheme: (value: string) => void }) {
  const [section, setSection] = useState<keyof typeof previewSections>('personal');
  const [checked, setChecked] = useState({ personal: [true, false, true], partner: [false, true, false], group: [true, false, false] });
  const preview = previewSections[section];
  const completed = checked[section].filter(Boolean).length;
  const appearance = appearances.find(item => item.id === theme) ?? appearances[0];
  return <div className="brew-landing" id="top">
    <header className="brew-nav">
      <a className="brand" href="#top" aria-label="Brewtual home"><BrewtualMark/><span>brewtual<span className="brand-period">.</span></span></a>
      <nav aria-label="Website"><a href="#how">The little rituals</a><a href="#together">Your people</a><a href="#themes">Find your mood</a></nav>
      <button className="subtle" onClick={enter}>Come on in <span aria-hidden="true">↗</span></button>
    </header>
    <main>
      <section className="brew-hero">
        <div className="brew-intro"><p className="eyebrow"><span className="brew-dot"/> A LITTLE INTENTION, EVERY DAY</p>
          <h1>Brew better days.<br/><em>One little ritual</em><br/>at a time.</h1>
          <p className="brew-description">A little space for your habits, your people, and the good things you’re growing.</p>
          <p className="brew-supporting">Plan on your own. Share a ritual. Turn little wins into something to look forward to.</p>
          <div className="brew-hero-actions"><button className="primary" onClick={enter}>Find your daily ritual <span aria-hidden="true">↗</span></button><a href="#how">Take a look around <span aria-hidden="true">↓</span></a></div>
          <div className="brew-hero-foot"><span className="brew-avatars" aria-hidden="true"><i>A</i><i>O</i><i>J</i></span><p>Your pace. Your people.<br/><strong>A little better, together.</strong></p></div>
        </div>
        <div className="ritual-stage"><span className="ritual-orbit" aria-hidden="true"/><span className="ritual-flourish" aria-hidden="true">{appearance.symbol}</span><div className="ritual-stage-label"><span>YOUR DAILY CUP OF PROGRESS</span><span>TRY A LITTLE RITUAL ↓</span></div>
          <section className="ritual-preview card" aria-label="Interactive planner preview">
            <header className="ritual-preview-header"><BrewtualMark/><div><strong>Your little space</strong><small>{preview.caption}</small></div><span className="preview-avatar" aria-hidden="true">A</span></header>
            <div className="preview-sections" role="group" aria-label="Preview section">{(Object.keys(previewSections) as (keyof typeof previewSections)[]).map(key => <button key={key} aria-pressed={section===key} onClick={()=>setSection(key)}>{previewSections[key].name}</button>)}</div>
            <div className="ritual-preview-progress"><div><p className="eyebrow">TODAY’S LITTLE RITUALS</p><h2>{completed===3?'Look at you grow.':'A good day, in the making.'}</h2><p><strong>{completed} of 3</strong> little wins collected</p></div><div className="brew-progress-ring" role="img" aria-label={`${completed} of 3 preview rituals complete`} style={{background:`conic-gradient(var(--accent) ${completed/3*360}deg, var(--soft) 0)`}}><span><BrewtualMark/></span></div></div>
            <div className="ritual-preview-tasks">{preview.tasks.map((title,index)=><button key={title} className="ritual-preview-task" aria-label={`Preview: ${title}`} aria-pressed={checked[section][index]} onClick={()=>setChecked(current=>({...current,[section]:current[section].map((done,i)=>i===index?!done:done)}))}><span className="preview-task-symbol"><AppIcon name={index===0?'notes':index===1?'dailies':'together'}/></span><span><strong>{title}</strong><small>{checked[section][index]?'A little promise, kept.':'A little something for today.'}</small></span><span className="preview-task-check">{checked[section][index]&&<AppIcon name="check"/>}</span></button>)}</div>
            <div className="preview-note"><AppIcon name="notes"/><div><p className="eyebrow">{section==='personal'?'A NOTE TO YOURSELF':'A LITTLE PLAN, SHARED'}</p><p>{preview.note}</p></div></div>
            <footer className="ritual-preview-footer"><span>{appearance.symbol} {appearance.name}</span><span>Every little step counts.</span></footer>
          </section>
          <div className="ritual-reward-stamp"><AppIcon name="market"/><span>A coffee. A kind gesture.<br/><strong>A little reason to show up.</strong></span></div>
        </div>
      </section>
      <div className="brew-promises"><span><AppIcon name="tasks"/>Personal by default</span><span><AppIcon name="together"/>Better with your people</span><span><AppIcon name="market"/>Little wins worth celebrating</span></div>
      <section id="how" className="brew-section"><div className="brew-section-heading"><div><p className="eyebrow">LESS PRESSURE. MORE POSSIBILITY.</p><h2>A good routine.<br/>A little good company.</h2></div><p>Start with one small intention.<br/>Let the good things grow from there.</p></div><div className="brew-steps">{[
        ['01','tasks','Make a little room.','A task to finish. A Daily worth repeating. A bigger Goal, one step at a time. It all starts in your Personal space.'],
        ['02','together','Pull up a chair.','Invite your person or bring your friends. Choose which tasks to share, see each other’s progress, and keep a little plan together.'],
        ['03','market','Enjoy the little wins.','Agree on tokens before the work is done. Collect them as you follow through, then enjoy thoughtful rewards from your people.'],
      ].map(([number,icon,title,body])=><article className="card" key={number}><div><span>{number} /</span><AppIcon name={icon}/></div><h3>{title}</h3><p>{body}</p></article>)}</div></section>
      <section id="together" className="brew-section"><div className="brew-section-heading"><div><p className="eyebrow">THERE’S ROOM FOR YOUR KIND OF TOGETHER</p><h2>One little space.<br/>A few ways to belong.</h2></div></div><div className="brew-spaces">{[
        ['tasks','JUST FOR YOU','Your own daily rhythm.','Keep your whole task list in Personal. Share a task when you choose; your private notes always stay yours.','Start with yourself'],
        ['together','YOU + YOUR PERSON','Small rituals. Shared joy.','Make room for evening walks, weekend plans, and thoughtful rewards. Two people, cheering each other on.','Bring your person'],
        ['goals','YOUR FRIEND CIRCLE','A table for your people.','A book club, a big goal, a little encouragement. Create separate groups, each with its own tasks, notes, and reward menu.','Find your people'],
      ].map(([icon,label,title,body,cta])=><article className="card" key={label}><span className="brew-space-symbol"><AppIcon name={icon}/></span><p className="eyebrow">{label}</p><h3>{title}</h3><p>{body}</p><button className="text-button" onClick={enter}>{cta} <span aria-hidden="true">↗</span></button></article>)}</div></section>
      <section className="brew-rewards brew-section"><div><p className="eyebrow">GOOD THINGS, EARNED TOGETHER</p><h2>A little progress.<br/><em>Something to savour.</em></h2><p>A coffee made for you. An evening off dishes. The next movie night, planned. Your people offer the rewards; your little rituals bring them closer.</p><button className="primary" onClick={enter}>Make room for good things <span aria-hidden="true">↗</span></button></div><div className="brew-reward-menu card"><p className="eyebrow">A FEW THINGS ON THE MENU</p><h3>The little-wins club.</h3>{[['Coffee, on me','A slow morning at our favourite place','8'],['You pick the film','Snacks included. Obviously.','15'],['A night off dishes','One less thing on your list','12']].map(([title,detail,tokens])=><div className="brew-menu-item" key={title}><AppIcon name="market"/><div><strong>{title}</strong><small>{detail}</small></div><span>{tokens} <AppIcon name="token"/></span></div>)}<p className="brew-menu-foot">An example menu. Yours is made by your people.</p></div></section>
      <section id="themes" className="brew-section brew-themes"><div className="brew-section-heading"><div><p className="eyebrow">SEVEN ATMOSPHERES. ONE LITTLE HOME.</p><h2>Find your kind of everyday.</h2></div><p>Morning coffee or midnight glow?<br/>Try a mood. Make yourself at home.</p></div><ThemePicker theme={theme} setTheme={setTheme}/></section>
      <section className="brew-note"><span aria-hidden="true">{appearance.symbol}</span><p className="eyebrow">A NOTE FROM BREWTUAL</p><h2>Good days are brewed,<br/><em>not rushed.</em></h2><p>Life isn’t a perfect streak. It’s the little things you come back to, and the people who make coming back feel good.</p><button className="primary" onClick={enter}>Start your little ritual <span aria-hidden="true">↗</span></button></section>
      <section className="brew-faq brew-section"><div><p className="eyebrow">BEFORE YOU SETTLE IN</p><h2>A few little answers.</h2></div><div>{[
        ['Do I need a partner?','You can start entirely on your own. Personal tasks, Dailies, and Goals work without a partner or group. Invite your people whenever you’re ready.'],
        ['What gets shared?','Tasks created in a Partner or Group section appear there and in your Personal view. Personal tasks stay private until you choose where to share them. Members can see shared progress; only the owner can update the task. Private task notes stay personal. Shared notebooks can be edited by everyone in their space.'],
        ['How do tokens and rewards work?','Ask another member to approve tokens for a task before completing it. Approved work earns tokens in that space’s wallet. Redeem them for rewards offered by your people. Each space has its own balance.'],
        ['Can I take it with me?','Yes. Use Brewtual in your phone’s browser or add it to your home screen. Your tasks and shared spaces use the same account on phone and desktop.'],
      ].map(([question,answer])=><details key={question}><summary>{question}<span aria-hidden="true">＋</span></summary><p>{answer}</p></details>)}</div></section>
    </main>
    <footer className="brew-footer"><a className="brand" href="#top"><BrewtualMark/><span>brewtual.</span></a><p>A little intention. A little connection.<br/>A little better, together.</p><a href="#top">Back to the top ↑</a></footer>
  </div>;
}
