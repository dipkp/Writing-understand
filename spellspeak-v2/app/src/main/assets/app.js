(() => {
const $=id=>document.getElementById(id);
const WORD_KEY="spellspeak_v2_words",HIST_KEY="spellspeak_v2_history";
let stats=load(WORD_KEY,{}),history=load(HIST_KEY,[]);
let pageStack=["homePage"];

let wQueue=[],wIndex=0,wCorrect=0,wWrong=0,wWrongWords=[],wForce=false,wForceWord="",wStarted=0;
let dChunks=[],dIndex=0,dCorrect=0,dWrong=0,dWordTotal=0,dWordCorrect=0,dWrongWords=[],dWrongChunks=[],dStarted=0;

const pageMeta={
 homePage:["SpellSpeak","Hear it • spell it • master it"],
 wordSetupPage:["Word Spelling","Prepare your practice"],
 wordPracticePage:["Word Practice","Listen and spell"],
 wordResultPage:["Results","Review your session"],
 dictSetupPage:["Text Dictation","Prepare your text"],
 dictPracticePage:["Dictation Practice","Listen and type"],
 dictResultPage:["Results","Review your dictation"],
 trackerPage:["Word Tracker","Your weak and mastered words"],
 historyPage:["History","Previous practice sessions"],
 backupPage:["Backup & Restore","Keep your progress safe"]
};

function load(k,f){try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(f))}catch{return f}}
function save(){localStorage.setItem(WORD_KEY,JSON.stringify(stats));localStorage.setItem(HIST_KEY,JSON.stringify(history))}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function now(){return new Date().toISOString()}
function parseWords(t){return [...new Set(String(t).split(/\n|,/).map(x=>x.trim()).filter(Boolean))]}
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function norm(s){return String(s).trim().replace(/\s+/g," ").toLowerCase()}
function ensure(w){if(!stats[w])stats[w]={attempts:0,correct:0,wrong:0,streak:0,bestStreak:0,last:null};return stats[w]}
function record(w,good){const s=ensure(w);s.attempts++;s.last=now();if(good){s.correct++;s.streak++;s.bestStreak=Math.max(s.bestStreak,s.streak)}else{s.wrong++;s.streak=0}save()}
function status(s){if(!s||!s.attempts)return"learning";const a=s.correct/s.attempts;if(s.streak>=3&&s.attempts>=3&&a>=.8)return"mastered";if(s.wrong>=2&&a<.7)return"weak";return"learning"}
function weakness(w){const s=ensure(w),a=s.attempts?s.correct/s.attempts:0;return s.wrong*3+(1-a)*5-s.streak}
function currentTitle(){
 const id=document.querySelector(".page.active")?.id||"homePage";
 const m=pageMeta[id]||["SpellSpeak",""];
 $("topTitle").textContent=m[0];$("topSub").textContent=m[1];
 $("backBtn").style.display=id==="homePage"?"none":"grid";
 $("menuBtn").style.display=id==="homePage"?"grid":"none";
}
window.go=(id,push=true)=>{
 document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
 $(id).classList.add("active");
 if(push){if(pageStack[pageStack.length-1]!==id)pageStack.push(id)}
 window.scrollTo(0,0);currentTitle();renderHome();
};
window.menuGo=id=>{closeDrawer();go(id)};
function back(){
 if(pageStack.length>1)pageStack.pop();
 const id=pageStack[pageStack.length-1]||"homePage";
 go(id,false);
}
function openDrawer(){$("drawerShade").classList.add("show")}
function closeDrawer(){$("drawerShade").classList.remove("show")}
$("menuBtn").onclick=openDrawer;$("drawerShade").onclick=e=>{if(e.target===$("drawerShade"))closeDrawer()};$("backBtn").onclick=back;

function speak(text,rate=.82,repeat=1){
 if(!text)return;
 if(window.AndroidTTS&&typeof AndroidTTS.speak==="function"){AndroidTTS.stop();AndroidTTS.speak(text,Number(rate),Number(repeat));return}
 if(!("speechSynthesis" in window))return;
 speechSynthesis.cancel();let n=0;
 const run=()=>{const u=new SpeechSynthesisUtterance(text);u.lang="en-GB";u.rate=Number(rate);u.onend=()=>{n++;if(n<repeat)setTimeout(run,250)};speechSynthesis.speak(u)};run();
}
function stopSpeak(){if(window.AndroidTTS)AndroidTTS.stop();else if(window.speechSynthesis)speechSynthesis.cancel()}

function renderHome(){
 const weak=Object.values(stats).filter(s=>status(s)==="weak").length;
 $("homeWeak").textContent=`${weak} weak`;
 $("homeHistory").textContent=`${history.length} sessions`;
}

const sampleWords=["accommodation","achievement","advertisement","agriculture","analysis","appropriate","available","beautiful","beginning","business","category","committee","communication","convenient","definitely","development","environment","especially","government","independent","knowledge","necessary","opportunity","percentage","population","preferred","professional","recommend","restaurant","separate","successful","technology","temperature","university","vegetable"];
$("sampleWordsBtn").onclick=()=>{$("wordList").value=sampleWords.join("\n")};
$("clearWordsBtn").onclick=()=>{$("wordList").value=""};

$("startWordBtn").onclick=()=>{
 let words=parseWords($("wordList").value);
 if(!words.length){alert("Please add at least one word.");return}
 if($("wordShuffle").checked)words=shuffle(words);
 const size=Number($("wordSize").value);if(size>0)words=words.slice(0,size);
 startWordSession(words);
};
function startWordSession(words){
 wQueue=[...words];wIndex=0;wCorrect=0;wWrong=0;wWrongWords=[];wForce=false;wForceWord="";wStarted=Date.now();
 updateWordUI();go("wordPracticePage");
 setTimeout(()=>{if($("wordAuto").checked)speakWord()},260);
}
function wCur(){return wQueue[wIndex]}
function speakWord(){speak(wForce?wForceWord:wCur(),Number($("wordRate").value),Number($("wordRepeat").value))}
function updateWordUI(){
 const total=wQueue.length,done=Math.min(wIndex,total);
 $("wordCounter").textContent=`Word ${Math.min(wIndex+1,total)} of ${total}`;
 $("wordProgress").style.width=(total?done/total*100:0)+"%";
 $("wordCorrectStat").textContent=wCorrect;$("wordWrongStat").textContent=wWrong;
 $("wordRemainStat").textContent=Math.max(total-wIndex,0);
 const n=wCorrect+wWrong;$("wordAccStat").textContent=n?Math.round(wCorrect/n*100)+"%":"0%";
}
function clearWordPrompt(){$("wordAnswer").value="";$("wordFeedback").textContent="";$("wordFeedback").className="feedback"}
$("wordSpeak").onclick=$("wordReplay").onclick=speakWord;
$("wordCheck").onclick=checkWord;
$("wordAnswer").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();checkWord()}});
function checkWord(){
 const expected=wForce?wForceWord:wCur();if(!expected)return;
 const typed=$("wordAnswer").value;if(!typed.trim()){showWF("Type the spelling first.",false);return}
 if(wForce){
   if(norm(typed)===norm(expected)){showWF("✓ Corrected",true);wForce=false;wForceWord="";setTimeout(nextWord,550)}
   else showWF("Type the correct spelling before continuing.",false);
   return;
 }
 const good=norm(typed)===norm(expected);record(expected,good);
 if(good){wCorrect++;if($("wordMode").value==="learning")showWF("✓ Correct",true);setTimeout(nextWord,$("wordMode").value==="learning"?550:120)}
 else{
   wWrong++;wWrongWords.push(expected);
   if($("wordMode").value==="learning"){
     showWF(`✗ Correct spelling: ${expected}`,false);
     if($("wordRetype").checked){wForce=true;wForceWord=expected;$("wordAnswer").value="";$("wordAnswer").focus()}
     else setTimeout(nextWord,1300);
   }else setTimeout(nextWord,120);
 }
 updateWordUI();
}
function showWF(t,g){$("wordFeedback").textContent=t;$("wordFeedback").className="feedback "+(g?"good":"bad")}
$("wordSkip").onclick=()=>{const w=wCur();if(!w)return;record(w,false);wWrong++;wWrongWords.push(w);updateWordUI();nextWord()};
$("wordEnd").onclick=()=>{if(confirm("End this practice now?"))finishWord()};
function nextWord(){
 wIndex++;clearWordPrompt();
 if(wIndex>=wQueue.length){finishWord();return}
 updateWordUI();$("wordAnswer").focus();if($("wordAuto").checked)setTimeout(speakWord,180);
}
function finishWord(){
 stopSpeak();
 const total=wCorrect+wWrong,acc=total?Math.round(wCorrect/total*100):0,uniq=[...new Set(wWrongWords)];
 history.push({date:now(),type:"Word Spelling",total,correct:wCorrect,wrong:wWrong,accuracy:acc,wrongWords:uniq,duration:Math.round((Date.now()-wStarted)/1000)});
 if(history.length>100)history=history.slice(-100);save();
 $("wordResultScore").textContent=acc+"%";$("wordResultSub").textContent=`${wCorrect} correct • ${wWrong} wrong`;
 $("wordResultMistakes").innerHTML=uniq.length?uniq.map(w=>`<span class="chip weak">${esc(w)}</span>`).join(""):`<span class="chip">No wrong words 🎉</span>`;
 $("wordRetryBtn").style.display=uniq.length?"inline-flex":"none";
 go("wordResultPage");
}
$("wordRetryBtn").onclick=()=>{const u=[...new Set(wWrongWords)];if(u.length)startWordSession(u)};

const dictSample="Many people believe that technology has made everyday life more convenient. However, others argue that excessive dependence on digital devices can reduce face-to-face communication and create new challenges.";
$("dictSampleBtn").onclick=()=>{$("dictText").value=dictSample};
$("dictClearBtn").onclick=()=>{$("dictText").value=""};
function splitText(text,target){
 const words=String(text).replace(/\s+/g," ").trim().split(" ").filter(Boolean),chunks=[];
 for(let i=0;i<words.length;i+=target)chunks.push(words.slice(i,i+target).join(" "));
 return chunks;
}
$("startDictBtn").onclick=()=>{
 const chunks=splitText($("dictText").value,Number($("dictChunk").value));
 if(!chunks.length){alert("Please paste some text first.");return}
 startDictSession(chunks);
};
function startDictSession(chunks){
 dChunks=[...chunks];dIndex=0;dCorrect=0;dWrong=0;dWordTotal=0;dWordCorrect=0;dWrongWords=[];dWrongChunks=[];dStarted=Date.now();
 updateDictUI();go("dictPracticePage");setTimeout(()=>{if($("dictAuto").checked)speakDict()},260);
}
function dCur(){return dChunks[dIndex]}
function speakDict(){speak(dCur(),Number($("dictRate").value),Number($("dictRepeat").value))}
$("dictSpeak").onclick=$("dictReplay").onclick=speakDict;
function tokenize(s){return String(s).toLowerCase().replace(/[^\w'\s]/g," ").split(/\s+/).filter(Boolean)}
function compareWords(exp,typed){
 const e=tokenize(exp),t=tokenize(typed),m=Math.max(e.length,t.length);let good=0,bad=[];
 for(let i=0;i<m;i++){if(e[i]&&t[i]&&e[i]===t[i])good++;else if(e[i])bad.push(e[i])}
 return {total:e.length,good,bad};
}
function updateDictUI(){
 const total=dChunks.length,done=Math.min(dIndex,total);
 $("dictCounter").textContent=`Chunk ${Math.min(dIndex+1,total)} of ${total}`;
 $("dictProgress").style.width=(total?done/total*100:0)+"%";
 $("dictCorrectStat").textContent=dCorrect;$("dictWrongStat").textContent=dWrong;$("dictRemainStat").textContent=Math.max(total-dIndex,0);
 $("dictAccStat").textContent=dWordTotal?Math.round(dWordCorrect/dWordTotal*100)+"%":"0%";
}
$("dictCheck").onclick=checkDict;
function checkDict(){
 const exp=dCur(),typed=$("dictAnswer").value;if(!typed.trim()){showDF("Type what you heard first.",false);return}
 const exact=norm(exp)===norm(typed),cmp=compareWords(exp,typed);
 dWordTotal+=cmp.total;dWordCorrect+=cmp.good;
 if(exact){dCorrect++}
 else{dWrong++;dWrongChunks.push(exp);dWrongWords.push(...cmp.bad);if($("dictTrack").checked)[...new Set(cmp.bad)].forEach(w=>record(w,false))}
 updateDictUI();
 if($("dictMode").value==="instant")showDF(exact?"✓ Correct":`✗ ${cmp.good}/${cmp.total} words matched`,exact);
 setTimeout(nextDict,$("dictMode").value==="instant"?1000:120);
}
function showDF(t,g){$("dictFeedback").textContent=t;$("dictFeedback").className="feedback "+(g?"good":"bad")}
$("dictSkip").onclick=()=>{const exp=dCur();if(!exp)return;const ws=tokenize(exp);dWrong++;dWrongChunks.push(exp);dWrongWords.push(...ws);dWordTotal+=ws.length;updateDictUI();nextDict()};
$("dictEnd").onclick=()=>{if(confirm("End this dictation now?"))finishDict()};
function nextDict(){
 dIndex++;$("dictAnswer").value="";$("dictFeedback").textContent="";
 if(dIndex>=dChunks.length){finishDict();return}
 updateDictUI();$("dictAnswer").focus();if($("dictAuto").checked)setTimeout(speakDict,180);
}
function finishDict(){
 stopSpeak();const acc=dWordTotal?Math.round(dWordCorrect/dWordTotal*100):0,uniq=[...new Set(dWrongWords)];
 history.push({date:now(),type:"Text Dictation",total:dCorrect+dWrong,correct:dCorrect,wrong:dWrong,accuracy:acc,wrongWords:uniq,duration:Math.round((Date.now()-dStarted)/1000)});
 if(history.length>100)history=history.slice(-100);save();
 $("dictResultScore").textContent=acc+"%";$("dictResultSub").textContent=`${dCorrect} chunks correct • ${dWrong} chunks wrong`;
 $("dictResultMistakes").innerHTML=uniq.length?uniq.map(w=>`<span class="chip weak">${esc(w)}</span>`).join(""):`<span class="chip">No problem words 🎉</span>`;
 $("dictRetryBtn").style.display=dWrongChunks.length?"inline-flex":"none";go("dictResultPage");
}
$("dictRetryBtn").onclick=()=>{if(dWrongChunks.length)startDictSession([...dWrongChunks])};

function renderTracker(){
 let rows=Object.entries(stats),q=$("trackSearch").value.trim().toLowerCase(),f=$("trackFilter").value,srt=$("trackSort").value;
 if(q)rows=rows.filter(([w])=>w.toLowerCase().includes(q));
 if(f!=="all")rows=rows.filter(([,s])=>status(s)===f);
 rows.sort((a,b)=>{
  if(srt==="az")return a[0].localeCompare(b[0]);
  if(srt==="mistakes")return b[1].wrong-a[1].wrong;
  if(srt==="recent")return String(b[1].last||"").localeCompare(String(a[1].last||""));
  return weakness(b[0])-weakness(a[0]);
 });
 if(!rows.length){$("trackerTable").innerHTML=`<div class="empty">No tracked words yet.</div>`;return}
 $("trackerTable").innerHTML=`<div class="table-wrap"><table><thead><tr><th>Word</th><th>Status</th><th>Accuracy</th><th>Wrong</th><th>Streak</th></tr></thead><tbody>${
 rows.map(([w,s])=>{const st=status(s),acc=s.attempts?Math.round(s.correct/s.attempts*100):0;return `<tr><td><b>${esc(w)}</b></td><td><span class="status ${st}">${st}</span></td><td>${acc}%</td><td>${s.wrong}</td><td>${s.streak}</td></tr>`}).join("")
 }</tbody></table></div>`;
}
["trackSearch","trackFilter","trackSort"].forEach(id=>$(id).addEventListener(id==="trackSearch"?"input":"change",renderTracker));
$("copyWeakBtn").onclick=async()=>{const t=Object.keys(stats).filter(w=>status(stats[w])==="weak").join("\n");if(!t){alert("No weak words yet.");return}try{await navigator.clipboard.writeText(t);alert("Weak words copied.")}catch{alert(t)}};
$("resetTrackerBtn").onclick=()=>{if(confirm("Delete all tracked word progress?")){stats={};save();renderTracker();renderHome()}};

function renderHistory(){
 if(!history.length){$("historyList").innerHTML=`<div class="card empty">No sessions yet.</div>`;return}
 $("historyList").innerHTML=[...history].reverse().map(h=>`<div class="history-item"><div class="history-top"><div><h3>${esc(h.type)}</h3><p>${new Date(h.date).toLocaleString()} • ${Math.round((h.duration||0)/60)} min</p></div><div class="history-score">${h.accuracy}%</div></div><p style="margin-top:10px">${h.correct}/${h.total} correct • ${h.wrong} wrong • ${(h.wrongWords||[]).length} problem words</p></div>`).join("");
}
$("clearHistoryBtn").onclick=()=>{if(confirm("Delete all session history?")){history=[];save();renderHistory();renderHome()}};

$("exportBtn").onclick=()=>{
 const blob=new Blob([JSON.stringify({app:"SpellSpeak",version:2,stats,history},null,2)],{type:"application/json"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="spellspeak-backup.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$("importFile").addEventListener("change",async e=>{
 const f=e.target.files[0];if(!f)return;
 try{const d=JSON.parse(await f.text());if(!d||typeof d.stats!=="object")throw 0;stats=d.stats;if(Array.isArray(d.history))history=d.history;save();renderTracker();renderHistory();renderHome();alert("Backup restored.")}catch{alert("Invalid backup file.")}e.target.value="";
});

document.addEventListener("visibilitychange",()=>{if(document.hidden)stopSpeak()});
window.addEventListener("popstate",back);

renderTracker();renderHistory();renderHome();currentTitle();
})();
