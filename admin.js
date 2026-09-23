let sb, teams=[], matches=[];
const $=id=>document.getElementById(id);

function esc(s){
  return String(s??"").replace(/[&<>"']/g,m=>({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[m]));
}

function init(){
  if(!window.SUPABASE_URL || window.SUPABASE_URL.includes("COLE_AQUI")){
    $("loginMessage").textContent="Preencha config.js com a URL e a chave pública do Supabase.";
    return false;
  }

  sb = supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_ANON_KEY,
    {
      auth:{
        persistSession:true,
        autoRefreshToken:true,
        detectSessionInUrl:true
      }
    }
  );
sb.auth.onAuthStateChange(async (event, session) => {
  if (event === "PASSWORD_RECOVERY") {
    $("loginBox").hidden = true;
    $("panel").hidden = true;
    $("resetBox").hidden = false;
  }
});

$("updatePasswordBtn")?.addEventListener("click", async () => {
  const password = $("newPassword").value;
  const confirmPassword = $("confirmPassword").value;

  if (password.length < 6) {
    $("resetMessage").textContent = "A senha precisa ter pelo menos 6 caracteres.";
    return;
  }

  if (password !== confirmPassword) {
    $("resetMessage").textContent = "As senhas não coincidem.";
    return;
  }

  $("resetMessage").textContent = "Salvando nova senha...";

  const { error } = await sb.auth.updateUser({
    password: password
  });

  if (error) {
    $("resetMessage").textContent = "Erro: " + error.message;
    return;
  }

  $("resetMessage").textContent = "Senha alterada com sucesso!";
  await sb.auth.signOut();

  setTimeout(() => {
    window.location.href = "admin.html";
  }, 1500);
});
  return true;
}

async function login(){
  $("loginMessage").textContent="Entrando...";

  const {error}=await sb.auth.signInWithPassword({
    email:$("email").value,
    password:$("password").value
  });

  if(error){
    $("loginMessage").textContent="E-mail ou senha inválidos.";
    return;
  }

  $("loginMessage").textContent="";
  showPanel();
}

async function showPanel(){
  $("loginBox").hidden=true;
  $("panel").hidden=false;
  await load();
}

async function load(){
  const [
    {data:t,error:te},
    {data:m,error:me},
    {data:s,error:se}
  ]=await Promise.all([
    sb.from("teams").select("*").order("name"),
    sb.from("matches").select("*").order("match_time"),
    sb.from("sponsors").select("*").order("position").order("name")
  ]);

  if(te||me){
    console.error(te||me);
    $("automationMessage").className="danger";
    $("automationMessage").textContent=
      "Banco ainda sem a migração das regras. Execute MIGRACAO_REGRAS_CAMPEONATO.sql no Supabase.";
  }

  teams=t||[];
  matches=m||[];

  refreshTeamOptions();
  renderTeamManager();
  renderMatches(matches);
  renderAdminStandings();

  if(se){
    $("adminSponsors").innerHTML=
      "<p class='danger'>Execute MIGRACAO_PATROCINADORES.sql no Supabase.</p>";
  }else{
    renderSponsors(s||[]);
  }
}

function renderTeamManager(){
  const byCat=[
    ['fem','Feminino'],
    ['masc','Masculino']
  ].map(([cat,label])=>{
    const list=teams.filter(t=>t.category===cat);

    return `
      <div class="team-manage-block">
        <h3>${label}</h3>

        ${
          list.length
            ? list.map(t=>`
              <div class="team-manage-row">

                <input
                  type="text"
                  id="name-${t.id}"
                  value="${esc(t.name)}"
                  placeholder="Nome da equipe">

                <select id="group-${t.id}">
                  <option value="" ${!t.group_code?'selected':''}>
                    Sem chave
                  </option>

                  <option value="A" ${t.group_code==='A'?'selected':''}>
                    Chave A
                  </option>

                  <option value="B" ${t.group_code==='B'?'selected':''}>
                    Chave B
                  </option>
                </select>

                <button
                  class="btn compact secondary"
                  onclick="editTeam('${t.id}')">
                  Salvar alterações
                </button>

                <button
                  class="btn compact red"
                  onclick="deleteTeam('${t.id}')">
                  Excluir
                </button>

              </div>
            `).join('')

            : `<p class="muted">Nenhuma equipe cadastrada.</p>`
        }
      </div>
    `;
  }).join('');

  $("teamManager").innerHTML=
    `<div class="standing-grid">${byCat}</div>`;
}


async function editTeam(id){
  const team=teams.find(t=>t.id===id);
  if(!team)return;

  const name=$(`name-${id}`).value.trim();
  const group_code=$(`group-${id}`).value||null;

  if(!name){
    return alert("Informe o nome da equipe.");
  }

  if(group_code){
    const count=teams.filter(
      t=>t.category===team.category &&
         t.group_code===group_code &&
         t.id!==id
    ).length;

    if(count>=4){
      return alert(`A Chave ${group_code} já possui 4 equipes.`);
    }
  }

  const {error}=await sb
    .from("teams")
    .update({
      name,
      group_code
    })
    .eq("id",id);

  if(error){
    return alert(error.message);
  }

  alert("Equipe alterada com sucesso!");
  await load();
}


async function deleteTeam(id){
  const team=teams.find(t=>t.id===id);
  if(!team)return;

  const confirmar=confirm(
    `Deseja realmente excluir a equipe "${team.name}"?\n\nOs jogos cadastrados envolvendo essa equipe também serão excluídos.`
  );

  if(!confirmar)return;

  const {error:matchesError}=await sb
    .from("matches")
    .delete()
    .or(`team_a.eq.${id},team_b.eq.${id}`);

  if(matchesError){
    return alert(matchesError.message);
  }

  const {error}=await sb
    .from("teams")
    .delete()
    .eq("id",id);

  if(error){
    return alert(error.message);
  }

  alert("Equipe excluída com sucesso!");
  await load();
}


window.editTeam=editTeam;
window.deleteTeam=deleteTeam;

async function updateTeamGroup(id){
  const team=teams.find(t=>t.id===id);
  if(!team)return;

  const group_code=$(`group-${id}`).value||null;

  if(group_code){
    const count=teams.filter(
      t=>t.category===team.category &&
         t.group_code===group_code &&
         t.id!==id
    ).length;

    if(count>=4){
      return alert(`A Chave ${group_code} já possui 4 equipes.`);
    }
  }

  const {error}=await sb
    .from("teams")
    .update({group_code})
    .eq("id",id);

  if(error)return alert(error.message);

  await load();
}

window.updateTeamGroup=updateTeamGroup;

function refreshTeamOptions(){
  const cat=$("matchCategory").value;

  const opts=teams
    .filter(t=>t.category===cat)
    .map(t=>`
      <option value="${t.id}">
        ${esc(t.name)}${t.group_code?` • Chave ${t.group_code}`:""}
      </option>
    `).join("");

  $("teamA").innerHTML=opts;
  $("teamB").innerHTML=opts;
}

async function addTeam(){
  const name=$("teamName").value.trim();
  if(!name)return;

  const category=$("teamCategory").value;
  const group_code=$("teamGroup").value;

  const count=teams.filter(
    t=>t.category===category &&
       t.group_code===group_code
  ).length;

  if(count>=4){
    return alert(`A Chave ${group_code} já possui 4 equipes.`);
  }

  const {error}=await sb
    .from("teams")
    .insert({name,category,group_code});

  if(error)return alert(error.message);

  $("teamName").value="";
  await load();
}

async function addMatch(){
  if(!$("teamA").value ||
     !$("teamB").value ||
     $("teamA").value===$("teamB").value){
    return alert("Escolha equipes diferentes.");
  }

  const {error}=await sb.from("matches").insert({
    category:$("matchCategory").value,
    phase:$("matchPhase").value,
    match_time:$("matchTime").value||null,
    court:$("matchCourt").value||"Quadra 1",
    team_a:$("teamA").value,
    team_b:$("teamB").value,
    sets_a:0,
    sets_b:0,
    status:"Agendado"
  });

  if(error)return alert(error.message);

  await load();
}

function scoreInput(id,set,side,value){
  return `
    <div>
      <label>S${set} ${side}</label>
      <input
        class="set-score"
        type="number"
        min="0"
        id="s${set}${side.toLowerCase()}-${id}"
        value="${Number(value)||0}">
    </div>
  `;
}

function renderMatches(list){
  const map=Object.fromEntries(
    teams.map(t=>[t.id,t.name])
  );

  $("adminMatches").innerHTML=
    list.map(m=>`
      <div class="result-editor result-editor-v2">

        <div class="match-editor-head">
          <b>
            ${esc(map[m.team_a]||"A definir")}
            ×
            ${esc(map[m.team_b]||"A definir")}
          </b>

          <span class="phase-badge">
            ${esc(m.phase||"Grupo")}
          </span>

          <div class="meta">
            ${esc(m.match_time?.slice(0,5)||"--:--")}
            •
            ${esc(m.court||"Quadra")}
          </div>
        </div>

        <div class="set-grid">
          ${scoreInput(m.id,1,"A",m.set1_a)}
          ${scoreInput(m.id,1,"B",m.set1_b)}
          ${scoreInput(m.id,2,"A",m.set2_a)}
          ${scoreInput(m.id,2,"B",m.set2_b)}
          ${scoreInput(m.id,3,"A",m.set3_a)}
          ${scoreInput(m.id,3,"B",m.set3_b)}
        </div>

        <div>
          <label>Status</label>
          <select id="s-${m.id}">
            <option ${m.status==="Agendado"?"selected":""}>Agendado</option>
            <option ${m.status==="Ao vivo"?"selected":""}>Ao vivo</option>
            <option ${m.status==="Finalizado"?"selected":""}>Finalizado</option>
          </select>
        </div>

        <div class="save">
          <button
            class="btn green"
            onclick="saveResult('${m.id}')">
            Salvar resultado
          </button>
        </div>

      </div>
    `).join("")
    ||
    "<p class='muted'>Nenhum jogo cadastrado.</p>";
}

function setWinner(a,b,target){
  if(a===0 && b===0)return 0;
  if(a===b)return 0;

  const high=Math.max(a,b);
  const low=Math.min(a,b);

  if(high<target || high-low<2)return 0;

  return a>b?1:2;
}

function validateFinishedScore(v){
  const w1=setWinner(v.s1a,v.s1b,21);
  const w2=setWinner(v.s2a,v.s2b,21);

  if(!w1||!w2){
    return "Os dois primeiros sets precisam terminar com pelo menos 21 pontos e diferença mínima de 2.";
  }

  let wa=(w1===1)+(w2===1);
  let wb=(w1===2)+(w2===2);

  if(wa===2||wb===2){
    if(v.s3a!==0||v.s3b!==0){
      return "Em uma vitória por 2 a 0, deixe o 3º set zerado.";
    }

    return {
      sets_a:wa,
      sets_b:wb
    };
  }

  const w3=setWinner(v.s3a,v.s3b,15);

  if(!w3){
    return "Com 1 set para cada equipe, o tie-break deve terminar com pelo menos 15 pontos e diferença mínima de 2.";
  }

  wa+=w3===1;
  wb+=w3===2;

  return {
    sets_a:wa,
    sets_b:wb
  };
}

async function saveResult(id){
  const v={
    s1a:+$(`s1a-${id}`).value,
    s1b:+$(`s1b-${id}`).value,
    s2a:+$(`s2a-${id}`).value,
    s2b:+$(`s2b-${id}`).value,
    s3a:+$(`s3a-${id}`).value,
    s3b:+$(`s3b-${id}`).value
  };

  const status=$(`s-${id}`).value;

  let sets_a=0;
  let sets_b=0;

  if(status==="Finalizado"){
    const valid=validateFinishedScore(v);

    if(typeof valid==="string"){
      return alert(valid);
    }

    sets_a=valid.sets_a;
    sets_b=valid.sets_b;

  }else{
    [1,2,3].forEach(n=>{
      const target=n===3?15:21;
      const w=setWinner(
        v[`s${n}a`],
        v[`s${n}b`],
        target
      );

      if(w===1)sets_a++;
      if(w===2)sets_b++;
    });
  }

  const {error}=await sb
    .from("matches")
    .update({
      set1_a:v.s1a,
      set1_b:v.s1b,
      set2_a:v.s2a,
      set2_b:v.s2b,
      set3_a:v.s3a,
      set3_b:v.s3b,
      sets_a,
      sets_b,
      status
    })
    .eq("id",id);

  if(error)return alert(error.message);

  await load();
}

function matchPointTotals(m){
  return {
    a:(m.set1_a||0)+(m.set2_a||0)+(m.set3_a||0),
    b:(m.set1_b||0)+(m.set2_b||0)+(m.set3_b||0)
  };
}

function buildStandings(cat,group){
  let rows=teams
    .filter(t=>t.category===cat && t.group_code===group)
    .map(t=>({
      id:t.id,
      name:t.name,
      j:0,
      v:0,
      p:0,
      pf:0,
      pa:0,
      desempate:false
    }));

  matches
    .filter(
      m=>m.category===cat &&
         (m.phase||"Grupo")==="Grupo" &&
         m.status==="Finalizado"
    )
    .forEach(m=>{
      const a=rows.find(r=>r.id===m.team_a);
      const b=rows.find(r=>r.id===m.team_b);

      if(!a||!b)return;

      const pt=matchPointTotals(m);

      a.j++;
      b.j++;

      a.pf+=pt.a;
      a.pa+=pt.b;

      b.pf+=pt.b;
      b.pa+=pt.a;

      if(m.sets_a===2){
        a.v++;

        if(m.sets_b===0){
          a.p+=3;
        }else{
          a.p+=2;
          b.p+=1;
        }

      }else if(m.sets_b===2){
        b.v++;

        if(m.sets_a===0){
          b.p+=3;
        }else{
          b.p+=2;
          a.p+=1;
        }
      }
    });

  const tieWins=matches.filter(
    m=>m.category===cat &&
       m.phase==="Desempate" &&
       m.status==="Finalizado"
  );

  rows.sort(
    (a,b)=>
      b.p-a.p ||
      ((b.pf-b.pa)-(a.pf-a.pa)) ||
      tieBreakOrder(a,b,tieWins) ||
      a.name.localeCompare(b.name)
  );

  for(let i=0;i<rows.length-1;i++){
    const a=rows[i];
    const b=rows[i+1];

    if(
      a.p===b.p &&
      (a.pf-a.pa)===(b.pf-b.pa) &&
      !hasTieWinner(a.id,b.id,tieWins)
    ){
      a.desempate=true;
      b.desempate=true;
    }
  }

  return rows;
}

function hasTieWinner(a,b,ties){
  return ties.some(
    m=>
      (
        (m.team_a===a && m.team_b===b) ||
        (m.team_a===b && m.team_b===a)
      ) &&
      m.sets_a!==m.sets_b
  );
}

function tieBreakOrder(a,b,ties){
  const m=ties.find(
    x=>
      (x.team_a===a.id && x.team_b===b.id) ||
      (x.team_a===b.id && x.team_b===a.id)
  );

  if(!m)return 0;

  const winner=
    m.sets_a>m.sets_b
      ? m.team_a
      : m.team_b;

  return winner===a.id?-1:1;
}

function renderAdminStandings(){
  const cat=$("autoCategory")?.value||"fem";

  const blocks=["A","B"].map(g=>{
    const rows=buildStandings(cat,g);

    return `
      <div class="mini-standing">
        <h3>Chave ${g}</h3>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Equipe</th>
              <th>J</th>
              <th>Pts</th>
              <th>Saldo pontos</th>
            </tr>
          </thead>

          <tbody>
            ${rows.map((r,i)=>`
              <tr class="${r.desempate?"needs-tiebreak":""}">
                <td>${i+1}</td>
                <td>
                  ${esc(r.name)}
                  ${r.desempate?" ⚠️":""}
                </td>
                <td>${r.j}</td>
                <td><b>${r.p}</b></td>
                <td>${r.pf-r.pa}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }).join("");

  $("adminStandings").innerHTML=
    `<div class="standing-grid">${blocks}</div>
     <p class="muted">
       ⚠️ = empate em pontos e saldo de pontos:
       é necessário cadastrar/finalizar um jogo na fase “Desempate”.
     </p>`;
}

function pairs(arr){
  const out=[];

  for(let i=0;i<arr.length;i++){
    for(let j=i+1;j<arr.length;j++){
      out.push([arr[i],arr[j]]);
    }
  }

  return out;
}

async function generateGroups(){
  const cat=$("autoCategory").value;
  const msg=$("automationMessage");

  const A=teams.filter(
    t=>t.category===cat && t.group_code==="A"
  );

  const B=teams.filter(
    t=>t.category===cat && t.group_code==="B"
  );

  if(A.length!==4||B.length!==4){
    msg.className="danger";
    msg.textContent=
      "Cadastre exatamente 4 equipes na Chave A e 4 na Chave B antes de gerar os jogos.";
    return;
  }

  const existing=matches.filter(
    m=>m.category===cat &&
       (m.phase||"Grupo")==="Grupo"
  );

  const existingKeys=new Set(
    existing.map(
      m=>[m.team_a,m.team_b].sort().join("|")
    )
  );

  const inserts=[
    ...pairs(A),
    ...pairs(B)
  ]
    .filter(([a,b])=>
      !existingKeys.has(
        [a.id,b.id].sort().join("|")
      )
    )
    .map(([a,b])=>({
      category:cat,
      phase:"Grupo",
      team_a:a.id,
      team_b:b.id,
      court:"Quadra 1",
      sets_a:0,
      sets_b:0,
      status:"Agendado"
    }));

  if(!inserts.length){
    msg.className="success";
    msg.textContent=
      "Os 12 jogos da fase de grupos já estão cadastrados.";
    return;
  }

  const {error}=await sb
    .from("matches")
    .insert(inserts);

  if(error)return alert(error.message);

  msg.className="success";
  msg.textContent=
    `${inserts.length} jogo(s) gerado(s). Cada chave ficou no sistema todos-contra-todos.`;

  await load();
}

function qualification(cat){
  const A=buildStandings(cat,"A");
  const B=buildStandings(cat,"B");

  if(A.length!==4||B.length!==4){
    return {
      error:"É necessário ter 4 equipes em cada chave."
    };
  }

  const groupGames=matches.filter(
    m=>m.category===cat &&
       (m.phase||"Grupo")==="Grupo"
  );

  const expected=[
    ...pairs(
      teams.filter(
        t=>t.category===cat &&
           t.group_code==="A"
      )
    ),
    ...pairs(
      teams.filter(
        t=>t.category===cat &&
           t.group_code==="B"
      )
    )
  ].length;

  const finalCount=groupGames.filter(
    m=>m.status==="Finalizado"
  ).length;

  if(expected!==12||finalCount<12){
    return {
      error:
        `Finalize os 12 jogos das chaves antes das semifinais (${finalCount}/12 finalizados).`
    };
  }

  if(
    A.slice(0,2).some(r=>r.desempate) ||
    B.slice(0,2).some(r=>r.desempate)
  ){
    return {
      error:
        "Há empate que afeta a classificação. Finalize o jogo de desempate antes de gerar as semifinais."
    };
  }

  return {A,B};
}

async function generateSemis(){
  const cat=$("autoCategory").value;
  const msg=$("automationMessage");
  const q=qualification(cat);

  if(q.error){
    msg.className="danger";
    msg.textContent=q.error;
    return;
  }

  if(
    matches.some(
      m=>m.category===cat &&
         m.phase==="Semifinal"
    )
  ){
    msg.className="success";
    msg.textContent=
      "As semifinais desta categoria já estão cadastradas.";
    return;
  }

  const inserts=[
    {
      category:cat,
      phase:"Semifinal",
      team_a:q.A[0].id,
      team_b:q.B[1].id,
      court:"Quadra 1",
      status:"Agendado"
    },
    {
      category:cat,
      phase:"Semifinal",
      team_a:q.B[0].id,
      team_b:q.A[1].id,
      court:"Quadra 1",
      status:"Agendado"
    }
  ];

  const {error}=await sb
    .from("matches")
    .insert(inserts);

  if(error)return alert(error.message);

  msg.className="success";
  msg.textContent=
    "Semifinais geradas: 1º A × 2º B e 1º B × 2º A.";

  await load();
}

async function generateFinal(){
  const cat=$("autoCategory").value;
  const msg=$("automationMessage");

  const semis=matches.filter(
    m=>m.category===cat &&
       m.phase==="Semifinal"
  );

  if(
    semis.length!==2 ||
    semis.some(m=>m.status!=="Finalizado")
  ){
    msg.className="danger";
    msg.textContent=
      "Finalize as duas semifinais antes de gerar a final.";
    return;
  }

  if(
    matches.some(
      m=>m.category===cat &&
         m.phase==="Final"
    )
  ){
    msg.className="success";
    msg.textContent=
      "A final desta categoria já está cadastrada.";
    return;
  }

  const winners=semis.map(
    m=>m.sets_a>m.sets_b
      ? m.team_a
      : m.team_b
  );

  const {error}=await sb
    .from("matches")
    .insert({
      category:cat,
      phase:"Final",
      team_a:winners[0],
      team_b:winners[1],
      court:"Quadra 1",
      status:"Agendado"
    });

  if(error)return alert(error.message);

  msg.className="success";
  msg.textContent=
    "Final gerada automaticamente com as vencedoras das semifinais.";

  await load();
}

function safeFileName(name){
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-zA-Z0-9._-]/g,"-")
    .toLowerCase();
}

async function addSponsor(){
  const name=$("sponsorName").value.trim();
  const file=$("sponsorLogo").files[0];
  const position=
    Number($("sponsorPosition").value)||0;
  const message=$("sponsorMessage");

  if(!name){
    return alert("Informe o nome do patrocinador.");
  }

  if(!file){
    return alert("Escolha a imagem da logo.");
  }

  if(file.size>5*1024*1024){
    return alert("A logo deve ter no máximo 5 MB.");
  }

  message.className="muted";
  message.textContent="Enviando logo...";
  $("addSponsorBtn").disabled=true;

  const path=
    `${crypto.randomUUID()}-${safeFileName(file.name)}`;

  const {error:uploadError}=await sb
    .storage
    .from("patrocinadores")
    .upload(
      path,
      file,
      {
        cacheControl:"3600",
        upsert:false,
        contentType:file.type||undefined
      }
    );

  if(uploadError){
    $("addSponsorBtn").disabled=false;
    message.className="danger";
    message.textContent=uploadError.message;
    return;
  }

  const {data:publicData}=sb
    .storage
    .from("patrocinadores")
    .getPublicUrl(path);

  const {error}=await sb
    .from("sponsors")
    .insert({
      name,
      logo_url:publicData.publicUrl,
      logo_path:path,
      position
    });

  if(error){
    await sb
      .storage
      .from("patrocinadores")
      .remove([path]);

    $("addSponsorBtn").disabled=false;
    message.className="danger";
    message.textContent=error.message;
    return;
  }

  $("sponsorName").value="";
  $("sponsorLogo").value="";
  $("sponsorPosition").value="0";
  $("addSponsorBtn").disabled=false;

  message.className="success";
  message.textContent=
    "Patrocinador cadastrado com sucesso.";

  await load();
}

function renderSponsors(sponsors){
  $("adminSponsors").innerHTML=
    sponsors.length
      ? sponsors.map(s=>`
        <div class="sponsor-admin-item">
          <img
            src="${esc(s.logo_url)}"
            alt="Logo ${esc(s.name)}">

          <div class="sponsor-admin-info">
            <b>${esc(s.name)}</b>
            <span>
              Ordem: ${Number(s.position)||0}
            </span>
          </div>

          <button
            class="btn red compact"
            onclick="deleteSponsor('${s.id}')">
            Excluir
          </button>
        </div>
      `).join("")
      : "<p class='muted'>Nenhum patrocinador cadastrado.</p>";
}

async function deleteSponsor(id){
  if(!confirm("Excluir este patrocinador?"))return;

  const {data,error}=await sb
    .from("sponsors")
    .select("logo_path")
    .eq("id",id)
    .single();

  if(error)return alert(error.message);

  const {error:deleteError}=await sb
    .from("sponsors")
    .delete()
    .eq("id",id);

  if(deleteError)return alert(deleteError.message);

  if(data?.logo_path){
    await sb
      .storage
      .from("patrocinadores")
      .remove([data.logo_path]);
  }

  await load();
}

window.saveResult=saveResult;
window.deleteSponsor=deleteSponsor;

document.addEventListener(
  "DOMContentLoaded",
  async()=>{
    if(!init())return;

    /*
      Segurança:
      sempre encerra qualquer sessão anterior.
      A área Admin começa obrigatoriamente
      na tela de login.
    */
    await sb.auth.signOut({
      scope:"local"
    }).catch(()=>{});

    $("loginBox").hidden=false;
    $("panel").hidden=true;

    $("loginBtn").onclick=login;
    $("addTeamBtn").onclick=addTeam;
    $("addMatchBtn").onclick=addMatch;
    $("addSponsorBtn").onclick=addSponsor;

    $("generateGroupsBtn").onclick=generateGroups;
    $("generateSemisBtn").onclick=generateSemis;
    $("generateFinalBtn").onclick=generateFinal;

    $("matchCategory").onchange=
      refreshTeamOptions;

    $("autoCategory").onchange=
      renderAdminStandings;

    $("logoutBtn").onclick=async()=>{
      await sb.auth.signOut();
      location.reload();
    };
  }
);
