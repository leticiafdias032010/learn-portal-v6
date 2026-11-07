// Learn by L. D. — conteúdo público (content.json) + progresso local. Sem senhas nem códigos neste arquivo.
const CFG=window.LEARN_CONFIG||{}, SB=(CFG.SUPABASE_URL&&window.supabase)?supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY):null;
let session=null, profile=null, authMode='login';
let currentLang="pt", currentTab="sat-math", isAdmin=false, dbStages=[], posts=[], published={stages:[],posts:[]};
let progress=JSON.parse(localStorage.getItem("learn_progress")||"null")||{xp:{},done:{},completed:[]};
progress.unlocked=progress.unlocked||[];progress.visits=progress.visits||{};progress.reported=progress.reported||{};
const currentUser={isAdmin:false,get xpMap(){return progress.xp},get completedStages(){return progress.completed}};
let CATS=[], SUBJ=[]; const FIXED=['services','extras'];
const DEFAULT_SUBJECTS=[{id:'sat-math',name:'SAT Math',icon:'fa-calculator',color:'blue',kind:'quiz',description:'Álgebra, problemas, geometria e trigonometria do **SAT** Digital.'},{id:'sat-reading',name:'SAT Reading & Writing',icon:'fa-book-open',color:'green',kind:'quiz',description:'Leitura crítica, gramática e vocabulário do **SAT** Digital.'},{id:'excel',name:'Excel',icon:'fa-file-excel',color:'green',kind:'material',description:'Fórmulas, PROCV, tabelas dinâmicas e automações.'}];
const DEF_SET={brand:'Learn by L. D.',contactEmail:CFG.CONTACT_EMAIL,phone:CFG.CONTACT_PHONE,whatsapp:CFG.WHATSAPP,pixKeys:[{label:'E-mail',value:'ldprojectcontact@gmail.com'},{label:'Celular',value:'11947015584'}],forecastDays:3};
let S={...DEF_SET};
const kindOf=c=>(SUBJ.find(s=>s.id===c)||{}).kind||'quiz';
const COLORS={blue:'bg-gradient-to-r from-blue-500 to-indigo-600',green:'bg-gradient-to-r from-emerald-600 to-teal-700',purple:'bg-gradient-to-r from-purple-600 to-indigo-600',orange:'bg-gradient-to-r from-orange-500 to-amber-600',pink:'bg-gradient-to-r from-pink-500 to-rose-600'};
const NAVOFF="w-full text-left px-4 py-3 rounded-2xl font-black flex items-center text-gray-600 gap-3 hover:bg-gray-100 border-2 border-transparent text-xs";
const NAVON="w-full text-left px-4 py-3 rounded-2xl font-black flex items-center gap-3 bg-blue-50 text-blue-600 border-2 border-blue-200 text-xs";
let _n=Date.now(); const nid=()=>++_n;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rich=s=>esc(s).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');
const safeUrl=u=>/^https?:\/\//i.test(u||'')?esc(u):'';
function toEmbed(u){u=u||'';let m=u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
  if(m)return 'https://www.youtube.com/embed/'+m[1]; return safeUrl(u);}
function todayLocal(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function saveProgress(){localStorage.setItem("learn_progress",JSON.stringify(progress)); if(SB&&session)SB.from("progress").upsert({user_id:session.user.id,data:progress});}
async function saveWork(){
  if(!(SB&&isAdmin)){localStorage.setItem("learn_work",JSON.stringify({stages:dbStages,posts}));return;}
  const rows=dbStages.map(s=>{const {id,premium,draft,...d}=s;return{id,premium:!!premium,draft:!!draft,data:d};});
  if(rows.length)await SB.from('stages').upsert(rows);
  const ids=rows.map(r=>r.id), q=SB.from('stages').delete();
  await (ids.length?q.not('id','in','('+ids.join(',')+')'):q.gte('id',0));
  await SB.from('kv').upsert({key:'posts',value:posts});
  SB.functions.invoke('send-emails',{body:{mode:'users'}}).catch(()=>{});
}

window.onload=async()=>{
  const l=localStorage.getItem('site_lang'); if(l) setLanguage(l);
  await initData();
  initUI();
  setInterval(()=>{const f=document.querySelector('iframe.goog-te-banner-frame'); if(f)f.style.display='none'; document.body.style.top='0px';},1000);
};

function initUI(){
  isAdmin=SB?!!(profile&&profile.is_admin):sessionStorage.getItem('learn_admin')==='1'; currentUser.isAdmin=isAdmin;
  const w=JSON.parse(localStorage.getItem('learn_work')||'null');
  const loc=isAdmin&&!SB&&w; dbStages=loc?w.stages:published.stages;
  posts=loc?w.posts:published.posts;
  const $=id=>document.getElementById(id);
  buildSubjects(); applySettings();
  if(isAdmin){
    $('adminBtnLabel').innerText='Sair do Admin';
    ['adminTools','adminPostCard'].forEach(i=>$(i).classList.remove('hidden'));
    $('tabBtn-admin').classList.remove('hidden'); if(SB)renderAdminAll(); loadCurriculum();
    CATS.forEach(c=>{const el=$(`adminCreateStage-${c}`); if(el){el.innerHTML=getStageFormHTML(c); el.classList.remove('hidden');}});
  } else $('xpWidgetContainer').classList.remove('hidden');
  updateUserStats(); CATS.forEach(renderStages); renderPosts(); renderAuthArea();
  if(SB&&session){loadNotifs();setInterval(loadNotifs,60000);if(!isAdmin)checkSurvey();}
  if(!CATS.length)switchTab('services');
}

async function sha(t){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function adminLogin(){
  if(isAdmin){sessionStorage.removeItem('learn_admin');location.reload();return;}
  const pw=prompt('Senha de admin (no primeiro acesso, a senha digitada será criada neste navegador):'); if(!pw)return;
  const h=await sha(pw), st=localStorage.getItem('learn_admin_hash');
  if(!st) localStorage.setItem('learn_admin_hash',h); else if(st!==h){alert('Senha incorreta.');return;}
  sessionStorage.setItem('learn_admin','1'); location.reload();
}

function switchTab(tab){
  currentTab=tab; const ad=document.getElementById('sec-admin'); if(ad)ad.classList.add('hidden');
  [...CATS,...FIXED].forEach(t=>{const s=document.getElementById('sec-'+t),b=document.getElementById('tabBtn-'+t);
    if(s)s.classList.add('hidden'); if(b)b.className="w-full text-left px-4 py-3 rounded-2xl font-black flex items-center text-gray-600 gap-3 hover:bg-gray-100 border-2 border-transparent text-xs";});
  document.getElementById('sec-'+tab).classList.remove('hidden');
  if(CATS.includes(tab)&&!currentUser.isAdmin){progress.visits[tab]=(progress.visits[tab]||0)+1;progress.last=new Date().toISOString();saveProgress();}
  const a=document.getElementById('tabBtn-'+tab); if(a)a.className="w-full text-left px-4 py-3 rounded-2xl font-black flex items-center gap-3 bg-blue-50 text-blue-600 border-2 border-blue-200 text-xs";
  updateUserStats();
}

// Cada questão rende XP uma única vez; ao acertar todas, a etapa conclui e aparece o convite de doação.
function checkMultiAnswer(stageId,qId,sel,category){
  if(currentUser.isAdmin)return;
  const st=dbStages.find(s=>s.id===stageId), q=st.questions.find(i=>i.id===qId), key=stageId+'-'+qId;
  const fb=document.getElementById(`feedbackBox-${stageId}-${qId}`), btn=document.getElementById(`btnOpt-${stageId}-${qId}-${sel}`);
  const base="p-2.5 text-left border rounded-xl font-bold text-xs hover:bg-white flex items-center gap-2";
  if(progress.done[key]){fb.className="p-3 bg-blue-100 text-blue-800 rounded-xl text-xs font-black block";fb.textContent="Você já acertou esta questão (o XP já foi contado).";return;}
  ['A','B','C','D'].forEach(o=>{const b=document.getElementById(`btnOpt-${stageId}-${qId}-${o}`); if(b)b.className=base;});
  if(sel!==q.correctOpt){btn.className="p-2.5 text-left border-2 border-red-400 bg-red-50 text-red-700 rounded-xl font-bold text-xs flex items-center gap-2";
    fb.className="p-3 bg-red-100 text-red-700 rounded-xl text-xs font-black block"; fb.textContent="❌ Resposta incorreta. Tente novamente!"; return;}
  btn.className="p-2.5 text-left border-2 border-emerald-500 bg-emerald-50 text-emerald-800 rounded-xl font-bold text-xs flex items-center gap-2";
  fb.className="p-3 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-black block"; fb.textContent=`✔️ Resposta correta! +${q.xp} XP`;
  progress.done[key]=true; progress.xp[category]=(progress.xp[category]||0)+q.xp;
  const finished=st.questions.every(x=>progress.done[st.id+'-'+x.id])&&!progress.completed.includes(st.id);
  if(finished)progress.completed.push(st.id);
  saveProgress(); updateUserStats();
  if(finished){renderStages(category); setTimeout(openDonationModal,700);}
}

function exportContent(){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify({stages:dbStages.filter(s=>!s.draft),posts},null,1)],{type:'application/json'}));
  a.download='content.json'; a.click();
}
function importContent(ev){
  const f=ev.target.files[0]; if(!f)return;
  f.text().then(t=>{try{const d=JSON.parse(t);
    (d.stages||[]).forEach(s=>{s.id=nid();s.questions=(s.questions||[]).map((q,i)=>({xp:50,...q,id:i+1}));dbStages.push(s);});
    (d.posts||[]).forEach(p=>posts.unshift({...p,id:nid()}));
    Promise.resolve(saveWork()).then(()=>location.reload());}catch(e){alert('JSON inválido: '+e.message);}});
}

function getStageFormHTML(category) {
  let questionsHTML = "";
  if (kindOf(category) !== 'material') {
    questionsHTML = `
      <div class="p-3 bg-white rounded-xl border space-y-3">
        <div class="flex justify-between items-center">
          <span class="text-xs font-black uppercase text-purple-600">Exercícios da Etapa</span>
          <button type="button" onclick="addQuestionField('${category}')" class="px-2.5 py-1 bg-purple-100 text-purple-700 font-bold rounded-lg text-[11px]">+ Adicionar Exercício</button>
        </div>
        <div id="questionsContainer-${category}" class="space-y-3">
          <div class="q-block p-3 bg-gray-50 rounded-xl border space-y-2 relative">
            <input type="text" placeholder="Pergunta do Exercício 1" class="q-title w-full px-3 py-1 border rounded text-xs font-semibold" required>
            <div class="grid grid-cols-2 gap-2">
              <input type="text" placeholder="Opção A" class="q-optA w-full px-2 py-1 border rounded text-xs" required>
              <input type="text" placeholder="Opção B" class="q-optB w-full px-2 py-1 border rounded text-xs" required>
              <input type="text" placeholder="Opção C" class="q-optC w-full px-2 py-1 border rounded text-xs" required>
              <input type="text" placeholder="Opção D" class="q-optD w-full px-2 py-1 border rounded text-xs" required>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <select class="q-correct w-full px-2 py-1 border rounded text-xs font-bold">
                <option value="A">Alternativa A</option><option value="B">Alternativa B</option><option value="C">Alternativa C</option><option value="D">Alternativa D</option>
              </select>
              <input type="number" placeholder="XP" value="50" class="q-xp w-full px-2 py-1 border rounded text-xs font-bold" required>
            </div>
            <textarea placeholder="Explicação da Resposta..." class="q-exp w-full px-3 py-1 border rounded text-xs" required></textarea>
          </div>
        </div>
      </div>
    `;
  }
  return `
    <h3 class="font-fredoka font-bold text-lg text-blue-900 mb-3"><i class="fas fa-plus-circle"></i> Criar Nova Etapa em ${category.toUpperCase()}</h3>
    <form onsubmit="handleCreateStage(event, '${category}')" class="space-y-3">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label class="block text-[11px] font-black uppercase text-gray-600 mb-1">Título da Etapa</label>
          <input type="text" id="stageTitle-${category}" required placeholder="Ex: Etapa 01" class="w-full px-3 py-2 rounded-xl border font-semibold text-xs">
        </div>
        <div>
          <label class="block text-[11px] font-black uppercase text-gray-600 mb-1">Data</label>
          <input type="date" id="stageDate-${category}" required class="w-full px-3 py-2 rounded-xl border font-semibold text-xs bg-white">
        </div>
      </div>
      <div>
        <label class="block text-[11px] font-black uppercase text-gray-600 mb-1">Explicação Teórica</label>
        <textarea id="stageContent-${category}" rows="2" required placeholder="Texto..." class="w-full px-3 py-2 rounded-xl border font-semibold text-xs"></textarea>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input type="url" id="stageImg-${category}" placeholder="URL da Imagem (Opcional)" class="px-3 py-1.5 border rounded-lg text-xs">
        <input type="url" id="stageVideo-${category}" placeholder="URL do Vídeo (Opcional)" class="px-3 py-1.5 border rounded-lg text-xs">
        <input type="url" id="stageFile-${category}" placeholder="URL de Arquivo (Opcional)" class="px-3 py-1.5 border rounded-lg text-xs">
      </div>
      ${questionsHTML}
      <label class="flex items-center gap-2 text-xs font-bold text-gray-700"><input type="checkbox" id="stagePremium-${category}"> 🔒 Conteúdo restrito (só para contas com acesso ativo)</label>
      <button type="submit" class="px-4 py-2 btn-duo-blue text-white font-extrabold rounded-xl text-xs uppercase">Salvar Etapa Completa</button>
    </form>
  `;
}
function addQuestionField(category) {
  const container = document.getElementById(`questionsContainer-${category}`);
  if (!container) return;
  const count = container.querySelectorAll('.q-block').length + 1;
  const div = document.createElement("div");
  div.className = "q-block p-3 bg-gray-50 rounded-xl border space-y-2 relative";
  div.innerHTML = `
    <button type="button" onclick="this.parentElement.remove()" class="absolute top-2 right-2 text-red-500 font-bold text-xs">✖ Excluir</button>
    <input type="text" placeholder="Pergunta do Exercício ${count}" class="q-title w-full px-3 py-1 border rounded text-xs font-semibold" required>
    <div class="grid grid-cols-2 gap-2">
      <input type="text" placeholder="Opção A" class="q-optA w-full px-2 py-1 border rounded text-xs" required>
      <input type="text" placeholder="Opção B" class="q-optB w-full px-2 py-1 border rounded text-xs" required>
      <input type="text" placeholder="Opção C" class="q-optC w-full px-2 py-1 border rounded text-xs" required>
      <input type="text" placeholder="Opção D" class="q-optD w-full px-2 py-1 border rounded text-xs" required>
    </div>
    <div class="grid grid-cols-2 gap-2">
      <select class="q-correct w-full px-2 py-1 border rounded text-xs font-bold">
        <option value="A">Alternativa A</option><option value="B">Alternativa B</option><option value="C">Alternativa C</option><option value="D">Alternativa D</option>
      </select>
      <input type="number" placeholder="XP" value="50" class="q-xp w-full px-2 py-1 border rounded text-xs font-bold" required>
    </div>
    <textarea placeholder="Explicação da Resposta..." class="q-exp w-full px-3 py-1 border rounded text-xs" required></textarea>
  `;
  container.appendChild(div);
}
function handleCreateStage(e, category) {
  e.preventDefault();
  const title = document.getElementById(`stageTitle-${category}`).value.trim();
  const availableFrom = document.getElementById(`stageDate-${category}`).value;
  const content = document.getElementById(`stageContent-${category}`).value.trim();
  const imageUrl = document.getElementById(`stageImg-${category}`).value.trim();
  const videoUrl = document.getElementById(`stageVideo-${category}`).value.trim();
  const fileUrl = document.getElementById(`stageFile-${category}`).value.trim();
  
  const questions = [];
  if (kindOf(category) !== 'material') {
    const qBlocks = document.querySelectorAll(`#questionsContainer-${category} .q-block`);
    qBlocks.forEach((qb, idx) => {
      questions.push({
        id: idx + 1,
        question: qb.querySelector('.q-title').value.trim(),
        optA: qb.querySelector('.q-optA').value.trim(),
        optB: qb.querySelector('.q-optB').value.trim(),
        optC: qb.querySelector('.q-optC').value.trim(),
        optD: qb.querySelector('.q-optD').value.trim(),
        correctOpt: qb.querySelector('.q-correct').value,
        xp: parseInt(qb.querySelector('.q-xp').value) || 50,
        explanation: qb.querySelector('.q-exp').value.trim()
      });
    });
  }
  
  dbStages.push({ id: Date.now(), category, title, availableFrom, content, imageUrl, videoUrl, fileUrl, questions, premium: !!document.getElementById('stagePremium-'+category).checked });
  saveWork();
  renderStages(category);
  e.target.reset();
}
function deleteStage(stageId) {
  if (!confirm("Excluir esta etapa permanentemente?")) return;
  dbStages = dbStages.filter(s => s.id !== stageId);
  saveWork();
  renderStages(currentTab);
}
function renderStages(category) {
  const container = document.getElementById(`stagesFeed-${category}`);
  if (!container) return;
  container.innerHTML = "";
  
  const allStages = dbStages.filter(s => s.category === category && (currentUser.isAdmin || !s.draft));
  const today = todayLocal();
  allStages.sort((a,b)=>String(a.availableFrom).localeCompare(String(b.availableFrom))||a.id-b.id);
  const isAv = st => currentUser.isAdmin || st.availableFrom <= today || progress.unlocked.includes(st.id);
  const availableStages = allStages.filter(isAv), upcoming = allStages.filter(st => !isAv(st));
  
  if (availableStages.length === 0) {
    container.innerHTML = `<div class="card-duo p-6 text-center text-gray-500 font-bold text-sm">Nenhum conteúdo liberado hoje nesta seção.</div>` + endPanel(category, availableStages, upcoming);
    return;
  }
  
  availableStages.forEach((st, idx) => {
    let mediaHTML = "";
    if (st.imageUrl) mediaHTML += `<img src="${safeUrl(st.imageUrl)}" class="rounded-xl max-h-64 object-cover w-full mb-3 border" />`;
    if (st.videoUrl) mediaHTML += `<div class="mb-3"><iframe src="${toEmbed(st.videoUrl)}" class="w-full h-48 rounded-xl border" allowfullscreen></iframe></div>`;
    if (st.fileUrl) mediaHTML += `<div class="mb-3"><a href="${safeUrl(st.fileUrl)}" target="_blank" class="px-4 py-2 bg-blue-50 text-blue-700 font-bold rounded-xl text-xs inline-flex items-center gap-2 border"><i class="fas fa-file-download"></i> Baixar Arquivo</a></div>`;
    
    let questionsHTML = "";
    if (kindOf(category) !== 'material' && st.questions) {
      st.questions.forEach((q, qIdx) => {
        questionsHTML += `
          <div class="p-4 bg-gray-50 border rounded-2xl space-y-3 mb-3">
            <div class="flex items-center justify-between font-bold text-gray-800 text-xs">
              <span>${currentUser.isAdmin&&q.needsReview?'⚠ revisar gabarito · ':''}Exercício ${qIdx + 1}: ${esc(q.question)}</span>
              <span class="text-purple-600 font-black">+${q.xp} XP</span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
              <button onclick="checkMultiAnswer(${st.id}, ${q.id}, 'A', '${category}')" id="btnOpt-${st.id}-${q.id}-A" class="p-2.5 text-left border rounded-xl font-bold text-xs hover:bg-white flex items-center gap-2"><span class="w-5 h-5 bg-gray-200 rounded text-center text-xs font-black">A</span> ${esc(q.optA)}</button>
              <button onclick="checkMultiAnswer(${st.id}, ${q.id}, 'B', '${category}')" id="btnOpt-${st.id}-${q.id}-B" class="p-2.5 text-left border rounded-xl font-bold text-xs hover:bg-white flex items-center gap-2"><span class="w-5 h-5 bg-gray-200 rounded text-center text-xs font-black">B</span> ${esc(q.optB)}</button>
              <button onclick="checkMultiAnswer(${st.id}, ${q.id}, 'C', '${category}')" id="btnOpt-${st.id}-${q.id}-C" class="p-2.5 text-left border rounded-xl font-bold text-xs hover:bg-white flex items-center gap-2"><span class="w-5 h-5 bg-gray-200 rounded text-center text-xs font-black">C</span> ${esc(q.optC)}</button>
              <button onclick="checkMultiAnswer(${st.id}, ${q.id}, 'D', '${category}')" id="btnOpt-${st.id}-${q.id}-D" class="p-2.5 text-left border rounded-xl font-bold text-xs hover:bg-white flex items-center gap-2"><span class="w-5 h-5 bg-gray-200 rounded text-center text-xs font-black">D</span> ${esc(q.optD)}</button>
            </div>
            <div id="feedbackBox-${st.id}-${q.id}" class="hidden p-3 rounded-xl text-xs font-black"></div>
            <button onclick="toggleMultiExp(${st.id}, ${q.id})" class="text-xs font-bold text-purple-600 hover:underline">Ver Explicação da Resposta</button>
            <div id="expBox-${st.id}-${q.id}" class="hidden p-3 bg-purple-50 text-purple-900 rounded-xl text-xs font-semibold border border-purple-200"><strong>Explicação:</strong> ${rich(q.explanation)}</div>
          </div>
        `;
      });
    }

    let statusBadge = "";
    if (kindOf(category) === 'material' || !(st.questions && st.questions.length)) {
      const dn = progress.completed.includes(st.id);
      statusBadge = currentUser.isAdmin ? `<span class="text-xs bg-blue-100 text-blue-700 font-black px-3 py-1 rounded-full">📘 Material</span>` : dn ? `<span class="text-xs bg-emerald-100 text-emerald-700 font-black px-3 py-1 rounded-full">✔️ Concluída</span>` : `<button onclick="completeMaterial(${st.id},'${category}')" class="text-xs bg-blue-100 text-blue-700 font-black px-3 py-1 rounded-full hover:bg-blue-200">✔ Marcar como concluída</button>`;
    } else {
      const isCompleted = currentUser.completedStages && currentUser.completedStages.includes(st.id);
      statusBadge = `<span class="text-xs ${isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-800'} font-black px-3 py-1 rounded-full">${isCompleted ? '✔️ Concluída' : 'Em Progresso'}</span>`;
    }
    
    container.innerHTML += `
      <div class="card-duo p-6 bg-white relative border-l-8 border-l-blue-500 space-y-4">
        <div class="flex justify-between items-center">
          <span class="text-xs font-black uppercase text-blue-600 bg-blue-50 px-2.5 py-1 rounded">ETAPA ${String(idx + 1).padStart(2, '0')}</span>
          <div class="flex items-center gap-2">
            ${currentUser.isAdmin && st.draft ? `<button onclick="publishStage(${st.id})" class="text-xs bg-yellow-100 text-yellow-800 px-2.5 py-1 rounded-lg font-bold">⚠ Rascunho: publicar</button>` : ''}${currentUser.isAdmin ? `<button onclick="deleteStage(${st.id})" class="text-xs bg-red-100 text-red-600 px-2.5 py-1 rounded-lg font-bold hover:bg-red-200"><i class="fas fa-trash"></i> Excluir Etapa</button>` : ''}
            ${statusBadge}
          </div>
        </div>
        <h3 class="font-fredoka text-xl font-bold text-gray-800">${esc(st.title)}</h3>
        <div class="p-4 bg-gray-50 rounded-xl border text-sm font-semibold text-gray-700 leading-relaxed">${rich(st.content)}</div>
        ${mediaHTML}
        <div class="space-y-3">${questionsHTML}</div>
      </div>
    `;
  });
  container.innerHTML += endPanel(category, availableStages, upcoming);
}
function toggleMultiExp(stageId, qId) { document.getElementById(`expBox-${stageId}-${qId}`).classList.toggle("hidden"); }
function updateUserStats() {
  if (currentUser.isAdmin) return;
  const categoryXP = (currentUser.xpMap && currentUser.xpMap[currentTab]) ? currentUser.xpMap[currentTab] : 0;
  const leagueTier = Math.floor(categoryXP / 1000) + 1;
  const currentXPInTier = categoryXP % 1000;
  
  let leagueName = "🥉 Bronze";
  if (categoryXP >= 1000 && categoryXP < 2000) leagueName = "🥈 Prata";
  if (categoryXP >= 2000 && categoryXP < 3000) leagueName = "🥇 Ouro";
  if (categoryXP >= 3000) leagueName = "💎 Diamante";
  
  const headerXP = document.getElementById("headerCategoryXP");
  const headerBadge = document.getElementById("headerCategoryBadge");
  const sbLabel = document.getElementById("sidebarCategoryLabel");
  const lText = document.getElementById("leagueXPText");
  const lBar = document.getElementById("leagueProgressBar");
  const headerContainer = document.getElementById("userStatsHeader");
  
  // REMOVIDA A CATEGORIA 'math' DAQUI!
  if (CATS.includes(currentTab)) {
      if(headerContainer) headerContainer.classList.remove("hidden");
      if(headerXP) headerXP.innerText = `XP ${categoryXP}`;
      if(headerBadge) headerBadge.innerText = `${leagueName} Nível ${leagueTier}`;
      if(sbLabel) sbLabel.innerText = `XP`;
      if(lText) lText.innerText = `${currentXPInTier} / 1000 XP`;
      if(lBar) lBar.style.width = `${(currentXPInTier / 1000) * 100}%`;
  } else {
      if(headerContainer) headerContainer.classList.add("hidden");
  }
}
function renderPosts() {
   const feed = document.getElementById("extrasFeed");
   if (!feed) return;
   feed.innerHTML = "";
   posts.forEach(p => {
     let mediaHTML = "";
     if (p.imageUrl) mediaHTML += `<img src="${safeUrl(p.imageUrl)}" class="rounded-xl max-h-48 object-cover w-full border" />`;
     if (p.videoUrl) mediaHTML += `<div><iframe src="${toEmbed(p.videoUrl)}" class="w-full h-40 rounded-xl border" allowfullscreen></iframe></div>`;
     if (p.linkUrl) mediaHTML += `<div><a href="${safeUrl(p.linkUrl)}" target="_blank" class="text-xs font-bold text-blue-600 hover:underline"><i class="fas fa-external-link-alt"></i> ${safeUrl(p.linkUrl)}</a></div>`;
     feed.innerHTML += `
       <div class="card-duo p-5 bg-white relative space-y-2">
         <div class="flex justify-between items-center">
           <span class="text-xs font-black uppercase text-blue-600 bg-blue-50 px-2.5 py-1 rounded">${esc(p.category)}</span>
           ${currentUser.isAdmin ? `<button onclick="deletePost(${p.id})" class="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded font-bold">Excluir</button>` : ''}
         </div>
         <h3 class="font-bold text-gray-800 text-lg">${esc(p.title)}</h3>
         <p class="text-sm font-semibold text-gray-600">${rich(p.body)}</p>
         ${mediaHTML}
       </div>
     `;
   });
}
function handleCreatePost(e) {
  e.preventDefault();
  const title = document.getElementById("postTitle").value;
  const category = document.getElementById("postCategory").value;
  const body = document.getElementById("postBody").value;
  const imageUrl = document.getElementById("postImg").value;
  const videoUrl = document.getElementById("postVideo").value;
  const linkUrl = document.getElementById("postLink").value;
  posts.unshift({ id: Date.now(), title, category, body, imageUrl, videoUrl, linkUrl });
  saveWork();
  renderPosts(); e.target.reset();
}
function deletePost(postId) {
    if(!confirm("Excluir post?")) return;
    posts = posts.filter(p => p.id !== postId);
    saveWork();
    renderPosts();
}
function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('site_lang', lang);
  ['pt', 'en', 'es'].forEach(l => {
    const btn = document.getElementById(`lang-${l}`);
    if (btn) btn.className = (l === lang) ? "px-2 py-1 rounded-lg bg-white shadow-xs text-gray-800 font-bold" : "px-2 py-1 rounded-lg text-gray-600 font-bold";
  });
  const langMap = { 'pt': 'pt', 'en': 'en', 'es': 'es' };
  const combo = document.querySelector('.goog-te-combo');
  if (combo) { combo.value = langMap[lang]; combo.dispatchEvent(new Event('change')); }
}
function closeDonationModal() { document.getElementById("donationModal").classList.add("hidden"); }
function openDonationModal() {
    document.getElementById("donationModal").classList.remove("hidden");
}
function shareProject() {
    const shareData = {
        title: 'Learn by L. D.',
        text: 'Venha estudar e aprender no portal Learn by L. D.! Material de SAT, Excel, debates semanais e muito mais.',
        url: window.location.href
    };

    if (navigator.share) {
        navigator.share(shareData).catch(err => console.log('Erro ao compartilhar:', err));
    } else {
        // Fallback para computadores que não suportam Web Share API nativo
        navigator.clipboard.writeText(window.location.href).then(() => {
            alert("✨ Link do projeto copiado para a área de transferência! Cole onde quiser para compartilhar.");
        }).catch(() => {
            alert("Erro ao copiar o link.");
        });
    }
}

async function initData(){
  SUBJ=DEFAULT_SUBJECTS.slice();
  if(SB){
    session=(await SB.auth.getSession()).data.session;
    if(session){
      profile=(await SB.from('profiles').select('*').eq('id',session.user.id).maybeSingle()).data;
      const r=(await SB.from('progress').select('data').eq('user_id',session.user.id).maybeSingle()).data?.data;
      if(r){for(const c in r.xp||{})progress.xp[c]=Math.max(progress.xp[c]||0,r.xp[c]);
        Object.assign(progress.done,r.done||{}); progress.unlocked=[...new Set([...progress.unlocked,...(r.unlocked||[])])]; progress.visits={...(r.visits||{}),...progress.visits}; progress.reported={...(r.reported||{}),...progress.reported}; progress.last=progress.last||r.last; progress.completed=[...new Set([...progress.completed,...(r.completed||[])])]; saveProgress();}
    }
    const sb=(await SB.from('subjects').select('*').eq('active',true).order('sort')).data; if(sb&&sb.length)SUBJ=sb;
    const st=(await SB.from('kv').select('value').eq('key','settings').maybeSingle()).data?.value; if(st)S={...DEF_SET,...st};
    const s=(await SB.from('stages').select('*')).data||[];
    published.stages=s.map(r=>({...r.data,id:r.id,premium:r.premium,draft:r.draft}));
    published.posts=(await SB.from('kv').select('value').eq('key','posts').maybeSingle()).data?.value||[];
  } else {
    try{const r=await fetch('content.json?v='+Date.now()); if(r.ok)published=await r.json();}catch(e){}
    published.stages=published.stages||[]; published.posts=published.posts||[];
    if(location.hash==='#admin')document.getElementById('adminBtn').classList.remove('hidden');
  }
}
function renderAuthArea(){
  const a=document.getElementById('authArea');
  if(SB){
    const exp=profile&&profile.expires_at&&new Date()>new Date(profile.expires_at);
    a.innerHTML=session?`<button id="notifBtn" onclick="toggleNotifs()" class="relative text-gray-500 hover:text-blue-600" title="Notificações"><i class="fas fa-bell"></i><span id="notifCount" class="hidden absolute -top-1.5 -right-2 bg-red-500 text-white text-[9px] font-black rounded-full px-1">0</span></button><button onclick="openSurvey(false)" class="text-xs font-black text-gray-600 hover:underline" title="Meu perfil">@${esc(profile?.username||'')}</button>${exp?'<span class="text-[10px] bg-red-100 text-red-600 font-black px-2 py-1 rounded">Acesso expirado: veja Contato</span>':''}<button onclick="logout()" class="text-gray-400 hover:text-red-500" title="Sair"><i class="fas fa-sign-out-alt"></i></button>`
      :`<button onclick="openAuth()" class="bg-green-100 text-green-700 px-3 py-1.5 rounded-xl border border-green-200 font-black text-xs">Entrar / Cadastrar</button>`;
  }
  document.getElementById('contactLinks').innerHTML=`<a href="mailto:${esc(S.contactEmail)}"><i class="fas fa-envelope"></i> ${esc(S.contactEmail)}</a><a href="https://wa.me/${esc(S.whatsapp)}" target="_blank"><i class="fab fa-whatsapp"></i> ${esc(S.phone)}</a>`;
}
const authMsg=t=>{const e=document.getElementById('authError');e.textContent=t;e.classList.remove('hidden');};
function openAuth(){document.getElementById('authModal').classList.remove('hidden');}
function toggleAuth(){authMode=authMode==='login'?'signup':'login';const s=authMode==='signup';
  document.getElementById('authTitle').innerText=s?'Criar conta':'Entrar';document.getElementById('authSubmit').innerText=s?'Cadastrar':'Entrar';
  document.getElementById('authToggle').innerText=s?'Já tenho conta':'Criar conta';document.getElementById('authUsername').classList.toggle('hidden',!s);}
async function submitAuth(e){
  e.preventDefault(); const em=authEmail.value.trim(), pw=authPassword.value, un=authUsername.value.trim();
  const r=authMode==='signup'?await SB.auth.signUp({email:em,password:pw,options:{data:{username:un||em.split('@')[0]},emailRedirectTo:location.origin}}):await SB.auth.signInWithPassword({email:em,password:pw});
  if(r.error){authMsg(r.error.message);return;}
  if(!r.data.session){authMsg('Conta criada! Confirme o e-mail que enviamos e depois entre.');return;}
  location.reload();
}
async function resetPw(){const em=authEmail.value.trim(); if(!em){authMsg('Digite seu e-mail primeiro.');return;}
  await SB.auth.resetPasswordForEmail(em,{redirectTo:location.origin}); authMsg('Se o e-mail existir, enviamos o link de recuperação.');}
async function logout(){await SB.auth.signOut(); location.reload();}
async function renderAdminUsers(){
  const tb=document.getElementById('adminUserTable'); tb.innerHTML=''; const now=new Date();
  const {data}=await SB.from('profiles').select('*').order('username');
  (data||[]).filter(u=>!u.is_admin).forEach(u=>{
    const exp=u.expires_at?new Date(u.expires_at):null, ex=exp&&now>exp, tr=document.createElement('tr'); tr.className='border-b border-gray-100';
    tr.innerHTML=`<td class="py-3 font-bold"><button onclick="openUser('${u.id}')" class="underline text-blue-600">@${esc(u.username)}</button><div class="text-[10px] text-gray-400">${esc(u.email)}</div></td>
      <td class="py-3"><span class="text-xs ${ex?'bg-red-100 text-red-600':'bg-emerald-100 text-emerald-600'} font-black px-2.5 py-1 rounded">${exp?(ex?'Expirado':'Até '+exp.toLocaleDateString('pt-BR')):'Ilimitado'}</span></td>
      <td class="py-3 flex gap-2"><input type="date" id="exp-${u.id}" class="px-2 py-1 text-xs border rounded-lg"><button onclick="setAccess('${u.id}')" class="px-2.5 py-1 btn-duo-yellow text-gray-900 text-xs font-bold rounded-lg">Definir</button></td>`;
    tb.appendChild(tr);});
}
async function setAccess(id){
  const v=document.getElementById('exp-'+id).value;
  const {error}=await SB.from('profiles').update({expires_at:v?new Date(v+'T23:59:59').toISOString():null}).eq('id',id);
  if(error)alert(error.message); renderAdminUsers();
}

// ===== Gerador automático (Gemini, camada gratuita) =====
const CURRICULUM={
 'sat-math':["Linear equations in one variable","Linear equations in two variables","Linear functions","Systems of two linear equations","Linear inequalities","Equivalent expressions","Nonlinear equations in one variable and systems","Nonlinear functions","Ratios, rates, proportional relationships and units","Percentages","One-variable data: distributions and measures of center and spread","Two-variable data: models and scatterplots","Probability and conditional probability","Inference from sample statistics and margin of error","Evaluating statistical claims","Area and volume","Lines, angles and triangles","Right triangles and trigonometry","Circles"],
 'sat-reading':["Words in context","Text structure and purpose","Cross-text connections","Central ideas and details","Command of evidence (textual)","Command of evidence (quantitative)","Inferences","Boundaries (sentence structure)","Form, structure and sense (verbs, agreement, pronouns)","Transitions","Rhetorical synthesis"],
 'excel':["Interface, células e referências","Fórmulas básicas: SOMA, MÉDIA, MÁXIMO, MÍNIMO","Referências relativas e absolutas ($)","Função SE e SES","PROCV e PROCX","ÍNDICE e CORRESP","SOMASE, CONT.SE e CONT.SES","Formatação condicional","Tabelas, filtros e classificação","Tabelas dinâmicas","Gráficos","Validação de dados","Funções de texto","Funções de data e hora","Limpeza de dados","Atalhos de teclado essenciais"]};
const sleep=ms=>new Promise(r=>setTimeout(r,ms)), $g=id=>document.getElementById(id);
const glog=t=>{$g('genLog').textContent+=t+'\n';};
function loadCurriculum(){$g('genTopics').value=(CURRICULUM[$g('genCat').value]||[]).join('\n'); $g('genKey').value=localStorage.getItem('learn_gemini_key')||'';
  if(!$g('genStart').value)$g('genStart').value=todayLocal();}
function genPrompt(cat,topics){
  const sj=SUBJ.find(s=>s.id===cat)||{name:cat,kind:'quiz',gen_prompt:''}, extra=sj.gen_prompt?(' Instruções da área: '+sj.gen_prompt+'.'):'';
  const base=`Responda SOMENTE com JSON válido: {"stages":[{"title":"","content":"","questions":[]}]} com UMA etapa para cada tópico, na ordem. Tudo ORIGINAL (não copie material protegido). Use **negrito** para destaques e \\n para quebras de linha.${extra} Tópicos:\n- ${topics.join('\n- ')}\n`;
  if(sj.kind==='material'||cat==='excel')return `Você é professor de ${sj.name} para iniciantes. ${base}Em "content" (português do Brasil): explicação simples, exemplo, passo a passo, erros comuns e um "Exercício prático" com a resposta ao final. Deixe "questions": [].`;
  const q=`Cada etapa: "content" em português do Brasil (teoria curta, exemplo resolvido, erro comum, dica) e 5 questões de múltipla escolha com distratores baseados em erros comuns: {"question":"","optA":"","optB":"","optC":"","optD":"","correctOpt":"A|B|C|D","xp":50,"explanation":"passo a passo em português"`;
  if(cat==='sat-math')return `Você é professor de SAT Math. ${base}${q},"answerExpr":"valor numérico da resposta como expressão aritmética (ex: 15/4), ou vazio se não numérica"} (enunciados e alternativas em inglês, formato SAT Digital).`;
  if(cat==='sat-reading')return `Você é professor de SAT Reading & Writing. ${base}${q}} (enunciados e alternativas em inglês, cada questão com seu próprio trecho curto ORIGINAL de 2 a 4 frases).`;
  return `Você é professor de ${sj.name}. ${base}${q},"answerExpr":"valor numérico como expressão aritmética, ou vazio"}.`;
}
function numOf(x){let s=String(x??'').replace(/\s/g,'').replace(/,/g,'.').replace(/\^/g,'**').replace(/√/g,'sqrt');
  if(!s||/[^0-9+\-*/().sqrt]/.test(s)||/[^0-9+\-*/().]/.test(s.replace(/sqrt/g,'')))return null;
  try{const v=Function('"use strict";return ('+s.replace(/sqrt/g,'Math.sqrt')+')')();return Number.isFinite(v)?v:null;}catch(e){return null;}}
function cleanStage(st,cat){let dropped=0;
  st.questions=(Array.isArray(st.questions)?st.questions:[]).filter(q=>{
    if(!q.question||!['A','B','C','D'].includes(q.correctOpt)||!q.optA||!q.optB||!q.optC||!q.optD){dropped++;return false;}
    const e=numOf(q.answerExpr), g=numOf(q['opt'+q.correctOpt]);
    if(q.answerExpr&&e!==null&&g!==null){if(Math.abs(e-g)>1e-6){dropped++;return false;}} else q.needsReview=true;
    delete q.answerExpr;return true;}).map((q,k)=>({xp:50,...q,id:k+1}));
  return dropped;}
async function geminiCall(prompt){
  const key=localStorage.getItem('learn_gemini_key'); if(!key)throw new Error('Cole sua chave gratuita do Google AI Studio.');
  const model=CFG.GEMINI_MODEL||'gemini-2.5-flash';
  for(let a=0;a<4;a++){
    const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},
      body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{responseMimeType:'application/json',temperature:0.7}})});
    if(r.status===429){glog('Limite gratuito: aguardando...');await sleep(20000*(a+1));continue;}
    if(!r.ok)throw new Error('API '+r.status+': '+(await r.text()).slice(0,160));
    return JSON.parse((await r.json()).candidates[0].content.parts[0].text);}
  throw new Error('Limite gratuito atingido. Tente mais tarde ou use "Copiar prompt".');}
const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
function addDraft(st,cat,i){const d=new Date($g('genStart').value+'T12:00:00');d.setDate(d.getDate()+i*(+$g('genStep').value||1));
  const dr=cleanStage(st,cat); Object.assign(st,{id:nid(),category:cat,availableFrom:ymd(d),draft:true,premium:false,imageUrl:'',videoUrl:'',fileUrl:''});
  if(kindOf(cat)==='material')st.questions=[]; dbStages.push(st); return dr;}
async function runGenerator(){
  const cat=$g('genCat').value, topics=$g('genTopics').value.split('\n').map(t=>t.trim()).filter(Boolean); $g('genLog').textContent='';
  for(let i=0;i<topics.length;i++){
    try{const out=await geminiCall(genPrompt(cat,[topics[i]])); const st=(out.stages||[out])[0];
      const dr=addDraft(st,cat,i); await saveWork(); renderStages(cat); glog(`✔ ${topics[i]}${dr?` (${dr} questão(ões) descartada(s) por gabarito/formato)`:''}`); await sleep(7000);
    }catch(e){glog('✖ '+topics[i]+': '+e.message); if(/Limite|chave/.test(e.message))break;}}
  glog('Fim. Revise os rascunhos em cada seção e publique.');}
function copyGenPrompt(){const t=genPrompt($g('genCat').value,$g('genTopics').value.split('\n').map(x=>x.trim()).filter(Boolean));
  navigator.clipboard.writeText(t).then(()=>glog('Prompt copiado. Cole em um chat de IA gratuito e traga o JSON.'));}
async function importPasted(){
  try{const raw=$g('genPaste').value, d=JSON.parse(raw.slice(raw.indexOf('{'),raw.lastIndexOf('}')+1)), cat=$g('genCat').value;
    (d.stages||[]).forEach((st,i)=>addDraft(st,st.category||cat,i)); await saveWork(); location.reload();}
  catch(e){glog('JSON inválido: '+e.message);}}
async function publishStage(id){const s=dbStages.find(x=>x.id===id); if(!s)return; s.draft=false; await saveWork(); renderStages(s.category);}
async function publishAllDrafts(){if(!confirm('Publicar TODOS os rascunhos? Você revisou as questões marcadas?'))return;
  dbStages.forEach(s=>s.draft=false); await saveWork(); CATS.forEach(renderStages);}

// ===== Áreas dinâmicas, configurações, fim de etapas =====
function buildSubjects(){
  CATS=SUBJ.map(s=>s.id);
  $g('subjectNav').innerHTML=SUBJ.map((s,i)=>`<button onclick="switchTab('${esc(s.id)}')" id="tabBtn-${esc(s.id)}" class="${i?NAVOFF:NAVON}"><i class="fas ${esc(s.icon)} text-base"></i> <span>${esc(s.name)}</span></button>`).join('');
  $g('subjectSections').innerHTML=SUBJ.map((s,i)=>`<section id="sec-${esc(s.id)}" class="${i?'hidden ':''}space-y-6"><div class="card-duo p-6 text-white border-none shadow-lg ${COLORS[s.color]||COLORS.blue}"><h1 class="font-fredoka text-2xl font-bold mb-2">${esc(s.name)}</h1><p class="text-xs font-semibold leading-relaxed opacity-90">${rich(s.description)}</p></div><div id="adminCreateStage-${esc(s.id)}" class="hidden card-duo p-6 bg-blue-50 border-blue-200"></div><div id="stagesFeed-${esc(s.id)}" class="space-y-4"></div></section>`).join('');
  $g('genCat').innerHTML=SUBJ.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
  currentTab=CATS[0]||'services';
}
function applySettings(){
  document.title=S.brand; $g('brandName').textContent=S.brand.toUpperCase(); $g('footBrand').textContent=S.brand;
  $g('svcMail').href=`mailto:${S.contactEmail}?subject=${encodeURIComponent('Solicitação de Serviço / Projeto - '+S.brand)}`; $g('svcMailTxt').textContent=S.contactEmail;
  $g('svcWa').href=`https://wa.me/${S.whatsapp}?text=${encodeURIComponent('Olá, gostaria de solicitar um projeto/serviço!')}`; $g('svcPhoneTxt').textContent=S.phone;
}
function showPixKey(){
  $g('pixList').innerHTML=(S.pixKeys||[]).map((k,i)=>`<div><p class="text-xs font-bold text-gray-700">${esc(k.label)}:</p><input id="pix-${i}" readonly value="${esc(k.value)}" class="w-full px-4 py-3 border-2 border-green-200 bg-green-50 rounded-xl text-center font-black text-green-800 text-base"><button onclick="copyPixKey(${i})" id="pixBtn-${i}" class="text-xs font-extrabold text-blue-600 hover:underline">Copiar chave</button></div>`).join('');
  $g('pixArea').classList.remove('hidden');
}
function copyPixKey(i){
  const v=S.pixKeys[i].value;
  (navigator.clipboard?navigator.clipboard.writeText(v):Promise.reject()).catch(()=>{const e=$g('pix-'+i);e.select();document.execCommand('copy');});
  const b=$g('pixBtn-'+i); b.textContent='✔ Copiada!'; setTimeout(()=>b.textContent='Copiar chave',2500);
}
const fmtDate=d=>{const p=String(d).split('-');return p.length===3?p[2]+'/'+p[1]:d;};
function completeMaterial(id,cat){
  if(progress.completed.includes(id))return; progress.completed.push(id); saveProgress(); renderStages(cat); setTimeout(openDonationModal,700);
}
function unlockStage(id,cat){ if(!progress.unlocked.includes(id))progress.unlocked.push(id); saveProgress(); renderStages(cat); }
function endPanel(cat,av,up){
  if(currentUser.isAdmin)return '';
  const done=av.length>0&&av.every(s=>progress.completed.includes(s.id));
  if(!(done||(av.length===0&&up.length>0)))return '';
  if(done)reportFinished(cat,up.length===0,av.length);
  const note=session?'Você será avisado(a) aqui no sino quando liberar mais.':'Crie uma conta (opcional) para ser avisado(a) quando liberar mais.';
  if(up.length)return `<div class="card-duo p-6 border-l-8 border-l-emerald-500 space-y-3"><h3 class="font-fredoka text-xl font-bold text-gray-800">${done?'🎉 Você concluiu tudo que está liberado!':'⏳ Em breve nesta área'}</h3><p class="text-xs font-semibold text-gray-500">Próximas etapas programadas:</p>${up.slice(0,5).map(s=>`<div class="flex items-center justify-between gap-2 p-3 bg-gray-50 border rounded-xl text-xs font-bold"><span>${esc(s.title)} <span class="text-gray-400">• libera em ${fmtDate(s.availableFrom)}</span></span><button onclick="unlockStage(${s.id},'${esc(cat)}')" class="px-3 py-1.5 btn-duo-green text-white rounded-lg text-[11px] font-extrabold uppercase">Adiantar</button></div>`).join('')}<p class="text-[11px] font-bold text-gray-400">${note}</p></div>`;
  return `<div class="card-duo p-6 border-l-8 border-l-yellow-400 space-y-2"><h3 class="font-fredoka text-xl font-bold text-gray-800">🏁 Você chegou ao fim, por enquanto</h3><p class="text-sm font-semibold text-gray-600">Aguarde atualização: previsão de ${S.forecastDays||3} dias.</p><p class="text-[11px] font-bold text-gray-400">A administradora já foi avisada. ${note}</p></div>`;
}
async function reportFinished(cat,noMore,marker){
  if(progress.reported[cat]===marker)return; progress.reported[cat]=marker; saveProgress();
  if(!SB)return;
  let anon=localStorage.getItem('learn_anon'); if(!anon){anon=(crypto.randomUUID?crypto.randomUUID():String(Date.now()));localStorage.setItem('learn_anon',anon);}
  const {error}=await SB.from('finished_events').insert({user_id:session?session.user.id:null,anon_id:anon,subject:cat,no_more:noMore,marker});
  if(!error&&noMore)SB.functions.invoke('send-emails',{body:{mode:'admin_alert'}}).catch(()=>{});
}
// ===== Notificações =====
let notifs=[];
async function loadNotifs(){
  const {data}=await SB.from('notifications').select('*').order('created_at',{ascending:false}).limit(30); notifs=data||[];
  const n=notifs.filter(x=>!x.read).length, c=document.getElementById('notifCount'); if(c){c.textContent=n;c.classList.toggle('hidden',!n);}
}
function toggleNotifs(){
  const p=$g('notifPanel'); p.classList.toggle('hidden'); if(p.classList.contains('hidden'))return;
  p.innerHTML=notifs.length?notifs.map(n=>`<div class="p-2 rounded-xl text-xs ${n.read?'bg-gray-50':'bg-blue-50'}"><b>${esc(n.title)}</b><div class="text-gray-600 font-semibold">${esc(n.body)}</div><div class="text-[10px] text-gray-400">${new Date(n.created_at).toLocaleString('pt-BR')}</div></div>`).join('')+'<button onclick="markRead()" class="w-full text-[11px] font-black text-blue-600 py-1">Marcar todas como lidas</button>':'<p class="p-3 text-xs text-gray-400 font-bold">Sem notificações.</p>';
}
async function markRead(){await SB.from('notifications').update({read:true}).eq('user_id',session.user.id).eq('read',false);await loadNotifs();$g('notifPanel').classList.add('hidden');}
// ===== Pesquisa / perfil =====
let svRating=0;
function drawStars(){$g('svStars').innerHTML=[1,2,3,4,5].map(n=>`<button type="button" onclick="svRating=${n};drawStars()" class="${n<=svRating?'text-yellow-400':'text-gray-300'}">★</button>`).join('');}
async function checkSurvey(){const {data}=await SB.from('survey').select('user_id').eq('user_id',session.user.id).maybeSingle(); if(!data&&!sessionStorage.getItem('sv_skip'))openSurvey(true);}
async function openSurvey(first){
  const v=(await SB.from('survey').select('*').eq('user_id',session.user.id).maybeSingle()).data||{};
  $g('svInterests').innerHTML=SUBJ.map(s=>`<label class="px-3 py-1.5 border-2 rounded-xl cursor-pointer"><input type="checkbox" class="svI" value="${esc(s.id)}" ${(v.interests||[]).includes(s.id)?'checked':''}> ${esc(s.name)}</label>`).join('');
  $g('svGoal').value=v.goal||''; $g('svSource').value=v.source||''; $g('svGender').value=v.gender||''; $g('svAge').value=v.age||''; $g('svNat').value=v.nationality||''; $g('svFeedback').value=v.feedback||''; $g('svIdeas').value=v.ideas||'';
  $g('svNotifC').checked=!!v.notify_content; $g('svNotifE').checked=!!v.notify_extras; $g('svNotifM').checked=!!v.notify_email; svRating=v.rating||0; drawStars();
  $g('surveyTitle').textContent=first?'Bem-vindo(a)! Conta pra gente 💙':'Meu perfil e pesquisa';
  $g('svProgress').innerHTML='<h3 class="font-black text-sm mt-4">Meu progresso</h3>'+activityHTML(progress);
  $g('surveyErr').classList.add('hidden'); $g('surveyModal').classList.remove('hidden');
}
function closeSurvey(){$g('surveyModal').classList.add('hidden');sessionStorage.setItem('sv_skip','1');}
async function saveSurvey(e){
  e.preventDefault();
  const interests=[...document.querySelectorAll('.svI:checked')].map(x=>x.value);
  if(!interests.length||!svRating){const el=$g('surveyErr');el.textContent='Escolha ao menos uma matéria e dê sua nota em estrelas.';el.classList.remove('hidden');return;}
  const row={user_id:session.user.id,interests,goal:$g('svGoal').value.trim()||null,source:$g('svSource').value||null,gender:$g('svGender').value||null,age:parseInt($g('svAge').value)||null,nationality:$g('svNat').value.trim()||null,rating:svRating,feedback:$g('svFeedback').value.trim()||null,ideas:$g('svIdeas').value.trim()||null,notify_content:$g('svNotifC').checked,notify_extras:$g('svNotifE').checked,notify_email:$g('svNotifM').checked,updated_at:new Date().toISOString()};
  const {error}=await SB.from('survey').upsert(row); if(error){alert(error.message);return;}
  $g('surveyModal').classList.add('hidden'); alert('Salvo! Obrigado(a) 💙');
}
function activityHTML(pr){
  pr=pr||{}; const rows=SUBJ.map(s=>{
    const st=published.stages.filter(x=>x.category===s.id&&!x.draft).sort((a,b)=>String(a.availableFrom).localeCompare(String(b.availableFrom)));
    const dn=st.filter(x=>(pr.completed||[]).includes(x.id));
    return `<tr class="border-b"><td class="py-1 font-bold">${esc(s.name)}</td><td>${(pr.xp||{})[s.id]||0} XP</td><td>${dn.length}/${st.length}</td><td>${esc(dn.length?dn[dn.length-1].title:'-')}</td><td>${(pr.visits||{})[s.id]||0}</td></tr>`;}).join('');
  return `<div class="overflow-x-auto"><table class="w-full text-left text-[11px] font-semibold"><thead><tr class="text-gray-400 uppercase"><th>Área</th><th>XP</th><th>Etapas</th><th>Última concluída</th><th>Acessos</th></tr></thead><tbody>${rows}</tbody></table></div>`+(pr.last?`<p class="text-[10px] text-gray-400 font-bold mt-1">Último acesso: ${new Date(pr.last).toLocaleString('pt-BR')}</p>`:'');
}
// ===== Painel admin: estatísticas, usuário, configurações, áreas, admins =====
async function renderAdminAll(){renderAdminUsers();renderStats();fillSettings();renderSubjList();renderAdminList();}
async function openUser(id){
  const [p,s,pr]=await Promise.all([SB.from('profiles').select('*').eq('id',id).maybeSingle(),SB.from('survey').select('*').eq('user_id',id).maybeSingle(),SB.from('progress').select('data').eq('user_id',id).maybeSingle()]);
  const u=p.data||{}, v=s.data, d=pr.data?.data||{}, nm=i=>(SUBJ.find(x=>x.id===i)||{}).name||i;
  $g('userBody').innerHTML=`<h2 class="text-xl font-black font-fredoka">@${esc(u.username)}</h2><p class="text-xs text-gray-500 font-bold">${esc(u.email)} · ${u.expires_at?'acesso até '+new Date(u.expires_at).toLocaleDateString('pt-BR'):'acesso ilimitado'}</p>`
   +(v?`<div class="mt-3 text-xs font-semibold space-y-1"><p><b>Matérias:</b> ${esc((v.interests||[]).map(nm).join(', '))}</p><p><b>Objetivo:</b> ${esc(v.goal||'-')}</p><p><b>Conheceu por:</b> ${esc(v.source||'-')}</p><p><b>Gênero:</b> ${esc(v.gender||'-')} · <b>Idade:</b> ${v.age||'-'} · <b>Nacionalidade:</b> ${esc(v.nationality||'-')}</p><p><b>Avaliação:</b> ${'⭐'.repeat(v.rating)}</p><p><b>Críticas/conselhos:</b> ${esc(v.feedback||'-')}</p><p><b>Ideias:</b> ${esc(v.ideas||'-')}</p><p><b>Avisos:</b> etapas ${v.notify_content?'sim':'não'} · extras ${v.notify_extras?'sim':'não'} · e-mail ${v.notify_email?'sim':'não'}</p></div>`:'<p class="mt-3 text-xs text-gray-400 font-bold">Ainda não respondeu a pesquisa.</p>')
   +'<h3 class="mt-4 font-black text-sm">Atividade</h3>'+activityHTML(d);
  $g('userModal').classList.remove('hidden');
}
async function renderStats(){
  const [pf,sv,pr]=await Promise.all([SB.from('profiles').select('id,is_admin'),SB.from('survey').select('*'),SB.from('progress').select('user_id,data')]);
  const users=(pf.data||[]).filter(u=>!u.is_admin), V=sv.data||[], P=pr.data||[], nm=i=>(SUBJ.find(x=>x.id===i)||{}).name||i;
  const count=(arr,f)=>{const o={};arr.forEach(x=>{const k=f(x);if(k)o[k]=(o[k]||0)+1;});return o;};
  const bars=o=>{const m=Math.max(1,...Object.values(o));return Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k,v])=>`<div class="mb-1"><div class="flex justify-between"><span>${esc(k)}</span><span>${v}</span></div><div class="h-2 bg-gray-200 rounded"><div class="h-2 bg-blue-500 rounded" style="width:${v/m*100}%"></div></div></div>`).join('')||'<span class="text-gray-400">sem dados</span>';};
  const avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(1):'-';
  const interests={}; V.forEach(s=>(s.interests||[]).forEach(i=>{interests[nm(i)]=(interests[nm(i)]||0)+1;}));
  const byS={}; P.forEach(p=>((p.data||{}).completed||[]).forEach(id=>{const st=published.stages.find(x=>x.id===id);if(st){const n=nm(st.category);byS[n]=(byS[n]||0)+1;}}));
  const active=P.filter(p=>((p.data||{}).completed||[]).length).length;
  const box=(t,b)=>`<div class="p-3 bg-gray-50 border rounded-xl"><p class="uppercase text-[10px] text-gray-400 mb-1">${t}</p>${b}</div>`;
  const cm=V.filter(s=>s.feedback||s.ideas).slice(-5).reverse().map(s=>`<p class="mb-1">• ${esc(s.ideas||s.feedback)}</p>`).join('')||'<span class="text-gray-400">sem comentários</span>';
  $g('adminStats').innerHTML=box('Resumo',`<p>${users.length} contas · ${V.length} pesquisas</p><p>Nota média: ⭐ ${avg(V.map(s=>s.rating))}</p><p>Idade média: ${avg(V.map(s=>s.age).filter(Boolean))}</p><p>${active} contas com etapas concluídas</p><p>${V.filter(s=>s.notify_content).length} querem avisos de etapas · ${V.filter(s=>s.notify_extras).length} de extras</p>`)
   +box('Como conheceram',bars(count(V,s=>s.source)))+box('Matérias de interesse',bars(interests))+box('Etapas concluídas por área',bars(byS))+box('Gênero',bars(count(V,s=>s.gender)))+box('Nacionalidade',bars(count(V,s=>(s.nationality||'').trim())))+box('Últimas ideias e críticas',cm);
}
function fillSettings(){
  $g('stBrand').value=S.brand; $g('stEmail').value=S.contactEmail; $g('stPhone').value=S.phone; $g('stWa').value=S.whatsapp;
  $g('stPix').value=(S.pixKeys||[]).map(k=>k.label+'|'+k.value).join('\n'); $g('stDays').value=S.forecastDays||3; $g('stUrl').value=S.siteUrl||location.origin;
}
async function saveSettings(){
  const v={brand:$g('stBrand').value.trim()||DEF_SET.brand,contactEmail:$g('stEmail').value.trim(),phone:$g('stPhone').value.trim(),whatsapp:$g('stWa').value.replace(/\D/g,''),
    pixKeys:$g('stPix').value.split('\n').map(l=>l.trim()).filter(Boolean).map(l=>{const [a,...b]=l.split('|');return b.length?{label:a.trim(),value:b.join('|').trim()}:{label:'Chave PIX',value:a.trim()};}),
    forecastDays:+$g('stDays').value||3,siteUrl:$g('stUrl').value.trim()};
  const {error}=await SB.from('kv').upsert({key:'settings',value:v}); if(error){alert(error.message);return;}
  S={...DEF_SET,...v}; applySettings(); renderAuthArea(); alert('Configurações salvas. O site já está atualizado.');
}
let _subjAll=[];
async function renderSubjList(){
  _subjAll=(await SB.from('subjects').select('*').order('sort')).data||[];
  $g('subjList').innerHTML=_subjAll.map(s=>`<div class="flex items-center justify-between p-2 bg-gray-50 border rounded-xl text-xs font-bold"><span><i class="fas ${esc(s.icon)}"></i> ${esc(s.name)} <span class="text-gray-400">(${esc(s.id)} · ${s.kind}${s.active?'':' · oculta'})</span></span><span class="flex gap-3"><button onclick="editSubject('${esc(s.id)}')" class="text-blue-600">Editar</button><button onclick="toggleSubject('${esc(s.id)}',${!s.active})" class="text-red-500">${s.active?'Ocultar':'Mostrar'}</button></span></div>`).join('');
}
function editSubject(id){const s=_subjAll.find(x=>x.id===id); if(!s)return; $g('sbId').value=s.id;$g('sbName').value=s.name;$g('sbIcon').value=s.icon;$g('sbColor').value=s.color;$g('sbKind').value=s.kind;$g('sbSort').value=s.sort;$g('sbDesc').value=s.description;$g('sbGen').value=s.gen_prompt||'';}
async function saveSubject(){
  const id=$g('sbId').value.trim().toLowerCase().replace(/[^a-z0-9-]/g,'-'), name=$g('sbName').value.trim(); if(!id||!name){alert('Informe id e nome.');return;}
  const {error}=await SB.from('subjects').upsert({id,name,icon:$g('sbIcon').value.trim()||'fa-book',color:$g('sbColor').value,kind:$g('sbKind').value,sort:+$g('sbSort').value||0,description:$g('sbDesc').value,gen_prompt:$g('sbGen').value,active:true});
  if(error){alert(error.message);return;} location.reload();
}
async function toggleSubject(id,a){await SB.from('subjects').update({active:a}).eq('id',id);location.reload();}
async function renderAdminList(){
  const {data}=await SB.from('admin_emails').select('email');
  $g('adminList').innerHTML=(data||[]).map(a=>`<div class="flex justify-between p-2 bg-gray-50 border rounded-xl text-xs font-bold"><span>${esc(a.email)}</span><button onclick="removeAdmin('${esc(a.email)}')" class="text-red-500">Remover</button></div>`).join('');
}
async function addAdmin(){const e=$g('adNew').value.trim().toLowerCase(); if(!e)return; const {error}=await SB.rpc('make_admin',{p_email:e}); if(error)alert(error.message); $g('adNew').value=''; renderAdminList();}
async function removeAdmin(e){if(!confirm('Remover o admin '+e+'?'))return; const {error}=await SB.rpc('remove_admin',{p_email:e}); if(error)alert(error.message); renderAdminList();}
async function saveMail(){
  const k=$g('bvKey').value.trim(), s=$g('bvSender').value.trim();
  if(s)await SB.rpc('save_private',{k:'sender_email',v:s}); if(k)await SB.rpc('save_private',{k:'brevo_key',v:k});
  $g('bvKey').value=''; $g('mailLog').textContent='Salvo.';
}
async function sendPending(){
  const a=await SB.functions.invoke('send-emails',{body:{mode:'admin_alert'}}), u=await SB.functions.invoke('send-emails',{body:{mode:'users'}});
  $g('mailLog').textContent='Alertas: '+JSON.stringify(a.data||a.error?.message)+'\nUsuários: '+JSON.stringify(u.data||u.error?.message);
}
