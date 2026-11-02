/* results-updater.js — Sincroniza resultados finalizados desde ESPN al historial local */
(function(){
  "use strict";
  window.AD = window.AD || {};

  var S = window.AD.store;

  // Ligas comunes para buscar resultados
  var LEAGUES = [
    "ita.1",      // Serie A
    "eng.1",      // Premier League
    "esp.1",      // LaLiga
    "ger.1",      // Bundesliga
    "fra.1",      // Ligue 1
    "arg.1",      // Liga Profesional Argentina
    "ned.1",      // Eredivisie
    "por.1",      // Primeira Liga
    "bra.1",      // Brasileirão
    "mex.1",      // Liga MX
    "sco.1",
    "bel.1",
    "tur.1",
    "aut.1",
    "gre.1",
    "rus.1",
    "sui.1",
    "col.1",
    "chi.1",
    "uru.1",
    "per.1",
    "bol.1",
    "ven.1",
    "uefa.champions",
    "uefa.europa",
    "conmebol.libertadores",
    "conmebol.sudamericana"
  ];

  function pad(n){ return n < 10 ? "0"+n : ""+n; }
  function ymd(d){ return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate()); }

  function getESPNUrl(league, date){
    return "https://site.api.espn.com/apis/site/v2/sports/soccer/"+league+"/scoreboard?dates="+ymd(date);
  }

  function normalize(s){
    if(!s) return "";
    s = String(s).toLowerCase();
    try { s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch(e){}
    s = s.replace(/\([^)]*\)/g, " ");
    s = s.replace(/\bfc\b|\bcf\b|\bac\b|\bsc\b|\bssc\b|\bcalcio\b|\bclub\b|\butd\b|\b1907\b|\b1913\b|\b1909\b/g, " ");
    s = s.replace(/[^a-z0-9 ]/g, " ");
    s = s.replace(/\s+/g, " ").trim();
    return s;
  }

  async function fetchDay(league, date){
    try{
      var res = await fetch(getESPNUrl(league, date), {cache:"no-store"});
      if(!res.ok) return [];
      var json = await res.json();
      var ev = json.events || [];
      var out = [];
      for(var i=0; i<ev.length; i++){
        var e = ev[i];
        var comp = e.competitions && e.competitions[0];
        if(!comp) continue;
        var st = comp.status || {};
        // Solo partidos finalizados
        if(!st.type || st.type.completed !== true) continue;
        var c1 = comp.competitors[0], c2 = comp.competitors[1];
        if(!c1 || !c2) continue;
        var home = c1.homeAway === "home" ? c1 : c2;
        var away = c1.homeAway === "away" ? c1 : c2;
        var homeScore = home.score != null ? parseInt(home.score) : NaN;
        var awayScore = away.score != null ? parseInt(away.score) : NaN;
        if(isNaN(homeScore) || isNaN(awayScore)) continue;
        out.push({
          date: (e.date||"").slice(0,10),
          homeName: home.team.displayName || home.team.name || "",
          awayName: away.team.displayName || away.team.name || "",
          homeGoals: homeScore,
          awayGoals: awayScore,
          externalId: e.id,
          league: league
        });
      }
      return out;
    }catch(err){
      console.warn("[results-updater] Error fetching", league, date, err);
      return [];
    }
  }

  function findTeam(name){
    if(!name) return null;
    var teams = (S.state && S.state.teams) ? S.state.teams : [];
    if(!teams.length) return null;

    // 1) findTeamByName nativo
    if(S.findTeamByName){
      try { var t1 = S.findTeamByName(name); if(t1) return t1; } catch(e){}
    }
    if(S.getTeamByName){
      try { var t2 = S.getTeamByName(name); if(t2) return t2; } catch(e){}
    }

    // 2) Por canonicalName
    if(S.canonicalName){
      try {
        var k = S.canonicalName(name);
        if(k){
          for(var i=0; i<teams.length; i++){
            if(S.canonicalName(teams[i].name) === k) return teams[i];
          }
        }
      } catch(e){}
    }

    // 3) Normalizado
    var n1 = normalize(name);
    if(n1){
      for(var j=0; j<teams.length; j++){
        var n2 = normalize(teams[j].name);
        if(!n2) continue;
        if(n2 === n1) return teams[j];
        if(n2.indexOf(n1) !== -1 && n1.length > 4) return teams[j];
        if(n1.indexOf(n2) !== -1 && n2.length > 4) return teams[j];
      }
    }

    return null;
  }

  function matchExists(date, homeId, awayId){
    if(!S.state || !S.state.matches) return false;
    for(var i=0; i<S.state.matches.length; i++){
      var m = S.state.matches[i];
      if(m.date === date && m.homeId === homeId && m.awayId === awayId) return true;
    }
    return false;
  }

  async function syncRecent(days){
    days = days || 3;
    var added = 0, skipped = 0;
    var now = new Date();
    
    for(var l=0; l<LEAGUES.length; l++){
      var lg = LEAGUES[l];
      for(var d=1; d<=days; d++){
        var date = new Date(now.getTime() - d*86400000);
        var list = await fetchDay(lg, date);
        for(var i=0; i<list.length; i++){
          var m = list[i];
          var h = findTeam(m.homeName);
          var a = findTeam(m.awayName);
          if(!h || !a){
            skipped++;
            continue;
          }
          if(h.id === a.id){
            skipped++;
            continue;
          }
          if(matchExists(m.date, h.id, a.id)){
            skipped++;
            continue;
          }
          // Añadir partido
          if(S.importMatch){
            var res = S.importMatch({
              date: m.date,
              homeId: h.id,
              awayId: a.id,
              homeGoals: m.homeGoals,
              awayGoals: m.awayGoals,
              competition: h.league || a.league || "",
              source: "espn-live",
              externalId: m.externalId
            });
            if(res) added++;
            else skipped++;
          }else if(S.addMatch){
            S.addMatch({
              date: m.date,
              homeId: h.id,
              awayId: a.id,
              homeGoals: m.homeGoals,
              awayGoals: m.awayGoals,
              competition: h.league || a.league || "",
              source: "espn-live",
              externalId: m.externalId
            });
            added++;
          }else{
            skipped++;
          }
        }
        // Pequeña pausa para no sobrecargar
        await new Promise(function(r){ setTimeout(r, 200); });
      }
    }
    
    // Limpiar duplicados y unificar si es necesario
    if(S.unifyTeams){
      try{ S.unifyTeams({dedupe:true}); }catch(e){}
    }
    if(S.repairPhantoms){
      try{ S.repairPhantoms(); }catch(e){}
    }
    if(S.saveNow){
      await S.saveNow();
    }
    
    return {added: added, skipped: skipped};
  }

  window.AD.resultsUpdater = {
    syncRecent: syncRecent,
    syncToday: function(){ return syncRecent(1); },
    syncLast3: function(){ return syncRecent(3); },
    syncLast7: function(){ return syncRecent(7); }
  };

  console.log("[results-updater] Cargado");
})();
