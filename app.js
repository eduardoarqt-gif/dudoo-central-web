// Central Dudoo no celular: primeira entrega, SÓ CONSULTA (licenças e vencimentos).
// Entra com o código do Google Authenticator + PIN (cadastrados na Central do computador). Nenhum dado fica guardado no aparelho.
'use strict';

const BASE = 'https://www.eduardoschmidt.arq.br/_functions';
const VERSAO = '1';                                   // igual ao número do cache em service-worker.js
const CHAVE_SESSAO = 'dudoo-central-web-sessao';
const DIAS_AVISO = 30;
const ERROS = {
  nao_configurado: 'O acesso pelo celular ainda não foi cadastrado. Na Central do computador: Configurações → Acesso pelo celular.',
  credenciais_invalidas: 'Código ou PIN incorretos.',
  bloqueado_temporariamente: 'Muitas tentativas erradas: o acesso fica bloqueado por 15 minutos.',
  sessao_invalida: 'Sua sessão terminou. Entre de novo.',
  sem_rede: 'Não consegui falar com o servidor. Confira a internet.',
};

const { $, esc, semAcento, dataBr, diasAte, lerData } = NucleoWeb;
let licencas = null, filtro = 'todas', busca = '', relogioSessao = null;

const mensagemDoErro = (erro) => ERROS[erro && erro.codigo] || 'O servidor não respondeu como esperado. Tente de novo em instantes.';
const sessao = () => NucleoWeb.lerSessao(CHAVE_SESSAO);

function botoesDoTopo(dentro) {
  $('#btn-atualizar').hidden = !dentro;
  $('#btn-sair').hidden = !dentro;
}

// Fim da sessão (venceu ou "Sair"): apaga a sessão E os dados da tela.
function encerrar(aviso) {
  clearTimeout(relogioSessao);
  NucleoWeb.apagarSessao(CHAVE_SESSAO);
  licencas = null; busca = ''; filtro = 'todas';
  telaEntrar(aviso);
}

function vigiarSessao() {
  clearTimeout(relogioSessao);
  const s = sessao();
  if (s) relogioSessao = setTimeout(() => encerrar(ERROS.sessao_invalida), Math.max(0, s.ate - Date.now()));
}

function telaEntrar(aviso) {
  botoesDoTopo(false);
  $('#sub-topo').textContent = `Acesso do dono · versão ${VERSAO}`;
  $('#palco').innerHTML = `
    <form class="card caixa" id="form-entrar" novalidate>
      <label for="codigo">Código do Google Authenticator</label>
      <input id="codigo" name="codigo" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6 números" title="O código de 6 números que muda a cada 30 segundos">
      <label for="pin">PIN</label>
      <input id="pin" name="pin" type="password" inputmode="numeric" autocomplete="off" maxlength="12" title="O PIN criado na Central do computador">
      <p class="m erro" id="erro-entrar" role="alert">${esc(aviso || '')}</p>
      <button class="b p largo" type="submit" title="Entrar na Central">Entrar</button>
    </form>`;
  $('#form-entrar').addEventListener('submit', entrar);
}

async function entrar(evento) {
  evento.preventDefault();
  const codigo = $('#codigo').value.replace(/\D/g, ''), pin = $('#pin').value.trim();
  const aviso = $('#erro-entrar'), botao = $('#form-entrar button');
  if (codigo.length !== 6 || !/^\d{6,12}$/.test(pin)) { aviso.textContent = 'Digite o código de 6 números e o PIN.'; return; }
  botao.disabled = true; botao.textContent = 'Entrando…'; aviso.textContent = '';
  try {
    const r = await NucleoWeb.chamar(BASE, 'central_mobile_entrar', { metodo: 'POST', corpo: { codigo, pin } });
    NucleoWeb.guardarSessao(CHAVE_SESSAO, r.token, Number(r.expira_em_segundos) || 900);
    vigiarSessao();
    await carregar();
  } catch (erro) {
    aviso.textContent = mensagemDoErro(erro); $('#codigo').value = ''; botao.disabled = false; botao.textContent = 'Entrar';
  }
}

async function carregar() {
  const s = sessao();
  if (!s) { encerrar(ERROS.sessao_invalida); return; }
  botoesDoTopo(true);
  $('#btn-atualizar').disabled = true;
  if (!licencas) { $('#sub-topo').textContent = ''; $('#palco').innerHTML = '<p class="vazio">Buscando as licenças…</p>'; }
  try {
    const r = await NucleoWeb.chamar(BASE, 'central_mobile_licencas', { token: s.token });
    if (!sessao()) return;                            // saiu enquanto buscava: não mostra nada
    licencas = r.licencas || [];
    const agora = new Date();
    $('#sub-topo').textContent = `Atualizado às ${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')} · versão ${VERSAO}`;
    telaLicencas();
  } catch (erro) {
    if (erro.codigo === 'sessao_invalida') { encerrar(ERROS.sessao_invalida); return; }
    if (licencas) NucleoWeb.toast(mensagemDoErro(erro));
    else $('#palco').innerHTML = `<div class="card caixa"><p class="erro">${esc(mensagemDoErro(erro))}</p><p class="m">Toque em Atualizar para tentar de novo.</p></div>`;
  } finally {
    $('#btn-atualizar').disabled = false;
  }
}

function situacao(licenca, hoje) {
  const dias = diasAte(licenca.valida_ate, hoje);
  if (dias === null) return { chave: 'sem', texto: 'Sem validade', classe: '' };
  if (dias < 0) return { chave: 'vencidas', texto: dias === -1 ? 'Venceu ontem' : `Vencida há ${-dias} dias`, classe: 'erro' };
  if (dias <= DIAS_AVISO) return { chave: 'vencendo', texto: dias === 0 ? 'Vence hoje' : dias === 1 ? 'Vence amanhã' : `Vence em ${dias} dias`, classe: 'alerta' };
  return { chave: 'emdia', texto: 'Em dia', classe: 'ok' };
}

// Quem vence primeiro aparece primeiro; licença sem validade fica no fim.
function ordenar(lista) {
  const quando = (l) => { const d = lerData(l.valida_ate); return d ? d.getTime() : Infinity; };
  return [...lista].sort((a, b) => (quando(a) - quando(b)) || String(a.cliente).localeCompare(String(b.cliente), 'pt-BR'));
}

function telaLicencas() {
  const conta = (chave) => licencas.filter((l) => situacao(l).chave === chave).length;
  const kpi = (chave, numero, nome, dica) => `<button type="button" class="kpi${filtro === chave ? ' on' : ''}" data-filtro="${chave}" aria-pressed="${filtro === chave}" title="${dica}"><b>${numero}</b><span>${nome}</span></button>`;
  $('#palco').innerHTML = `
    <div class="kpis">
      ${kpi('todas', licencas.length, 'Licenças', 'Mostrar todas')}
      ${kpi('vencendo', conta('vencendo'), `Vencem em ${DIAS_AVISO} dias`, 'Mostrar só as que estão para vencer')}
      ${kpi('vencidas', conta('vencidas'), 'Vencidas', 'Mostrar só as vencidas')}
    </div>
    <input id="busca" type="search" placeholder="Buscar por cliente ou código" autocomplete="off" title="Digite parte do nome ou do código">
    <div id="lista"></div>`;
  const campo = $('#busca');
  campo.value = busca;
  campo.addEventListener('input', () => { busca = campo.value; desenharLista(); });
  document.querySelectorAll('[data-filtro]').forEach((b) => b.addEventListener('click', () => { filtro = b.dataset.filtro; telaLicencas(); }));
  desenharLista();
}

function cartao(l) {
  const s = situacao(l);
  const vagas = Number(l.limite_usuarios) || 0;
  const detalhes = [l.plano, vagas ? `${vagas} ${vagas === 1 ? 'usuário' : 'usuários'}` : '', l.perfil].filter(Boolean).join(' · ');
  const validade = dataBr(l.valida_ate);
  return `<article class="card">
    <div class="linha"><div class="t">${esc(l.cliente || 'Sem nome')}</div><span class="pill ${s.classe}">${esc(s.texto)}</span></div>
    <div class="m">${esc(l.codigo)}${validade ? ' · válida até ' + validade : ''}</div>
    ${detalhes ? `<div class="m">${esc(detalhes)}</div>` : ''}
  </article>`;
}

function desenharLista() {
  const termo = semAcento(busca).trim();
  const itens = ordenar(licencas.filter((l) => (filtro === 'todas' || situacao(l).chave === filtro)
    && (!termo || semAcento(`${l.cliente} ${l.codigo}`).includes(termo))));
  $('#lista').innerHTML = itens.length ? itens.map(cartao).join('') : '<p class="vazio">Nenhuma licença aqui.</p>';
}

$('#btn-atualizar').addEventListener('click', carregar);
$('#btn-sair').addEventListener('click', () => encerrar(''));
document.addEventListener('visibilitychange', () => {          // o iPhone pausa o relógio com o app em segundo plano
  if (document.visibilityState === 'visible' && licencas && !sessao()) encerrar(ERROS.sessao_invalida);
});
NucleoWeb.registrarSW('service-worker.js');
if (sessao()) { vigiarSessao(); carregar(); } else telaEntrar('');
