// Núcleo padrão: base dos apps web (celular). Sem regra de nenhum app.
// FONTE: nucleo_padrao/web. Não edite a cópia dentro do app: edite aqui e rode `sincronizar_nucleo_padrao.py`.
'use strict';

const NucleoWeb = (() => {
  const $ = (seletor, raiz) => (raiz || document).querySelector(seletor);
  const MAPA_HTML = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (texto) => String(texto == null ? '' : texto).replace(/[&<>"']/g, (c) => MAPA_HTML[c]);
  const semAcento = (texto) => String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  let relogioToast = null;
  function toast(mensagem) {
    let caixa = $('#toast');
    if (!caixa) { caixa = document.createElement('div'); caixa.id = 'toast'; caixa.className = 'toast'; caixa.setAttribute('role', 'status'); document.body.appendChild(caixa); }
    caixa.textContent = mensagem; caixa.hidden = false;
    clearTimeout(relogioToast); relogioToast = setTimeout(() => { caixa.hidden = true; }, 3500);
  }

  // Sessão: fica só enquanto o app está aberto (sessionStorage), e some quando vence.
  function guardarSessao(chave, token, segundos) {
    try { sessionStorage.setItem(chave, JSON.stringify({ token, ate: Date.now() + segundos * 1000 })); } catch (_) { /* modo privado */ }
  }
  function apagarSessao(chave) { try { sessionStorage.removeItem(chave); } catch (_) { /* sem armazenamento */ } }
  function lerSessao(chave) {
    try {
      const s = JSON.parse(sessionStorage.getItem(chave) || 'null');
      if (s && s.token && s.ate > Date.now()) return s;
    } catch (_) { /* ignora */ }
    apagarSessao(chave);
    return null;
  }

  // Datas: aceita AAAA-MM-DD (com ou sem hora) e DD/MM/AAAA; mostra sempre DD/MM/AAAA.
  function lerData(texto) {
    const t = String(texto || '').trim();
    let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t), a, mes, d;
    if (m) { [a, mes, d] = [+m[1], +m[2], +m[3]]; } else {
      m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(t);
      if (!m) return null;
      [d, mes, a] = [+m[1], +m[2], +m[3]];
    }
    const data = new Date(a, mes - 1, d);
    return data.getFullYear() === a && data.getMonth() === mes - 1 && data.getDate() === d ? data : null;
  }
  function dataBr(texto) {
    const d = lerData(texto);
    return d ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` : '';
  }
  function diasAte(texto, hoje) {
    const d = lerData(texto);
    if (!d) return null;
    const h = hoje || new Date();
    return Math.round((d - new Date(h.getFullYear(), h.getMonth(), h.getDate())) / 86400000);
  }

  class ErroServidor extends Error {
    constructor(codigo, status) { super(codigo); this.codigo = codigo; this.status = status || 0; }
  }
  // Uma chamada ao servidor. Devolve o JSON quando `ok`; senão levanta ErroServidor com o código do servidor ("sem_rede" quando nem chegou).
  async function chamar(base, rota, opcoes) {
    const o = opcoes || {};
    const cabecalhos = {};
    if (o.corpo) cabecalhos['Content-Type'] = 'application/json';
    if (o.token) cabecalhos.Authorization = 'Bearer ' + o.token;
    const parar = new AbortController();
    const relogio = setTimeout(() => parar.abort(), o.tempo || 20000);
    let resposta, dados = null;
    try {
      resposta = await fetch(`${base}/${rota}`, { method: o.metodo || 'GET', headers: cabecalhos, body: o.corpo ? JSON.stringify(o.corpo) : undefined, signal: parar.signal, cache: 'no-store' });
      try { dados = await resposta.json(); } catch (_) { dados = null; }
    } catch (_) {
      throw new ErroServidor('sem_rede');
    } finally {
      clearTimeout(relogio);
    }
    if (!resposta.ok || !dados || dados.ok === false) throw new ErroServidor((dados && dados.erro) || 'servidor', resposta.status);
    return dados;
  }

  function registrarSW(arquivo) {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register(arquivo || 'service-worker.js').catch(() => {});
  }

  return { $, esc, semAcento, toast, guardarSessao, lerSessao, apagarSessao, lerData, dataBr, diasAte, chamar, ErroServidor, registrarSW };
})();
