// Renderiza el HTML final del informe inyectando los datos personalizados.
// El template usa marcadores {{PLACEHOLDER}} que se reemplazan acá.
import fs from 'fs';
import path from 'path';
import { escapeHTML } from './profiles.js';

let TEMPLATE_CACHE = null;

function loadTemplate() {
  if (TEMPLATE_CACHE) return TEMPLATE_CACHE;
  const templatePath = path.join(process.cwd(), 'template-informe.html');
  TEMPLATE_CACHE = fs.readFileSync(templatePath, 'utf8');
  return TEMPLATE_CACHE;
}

export function renderReportHTML({ meta, profile, scores, content }) {
  let html = loadTemplate();

  const today = new Date().toLocaleDateString('es-AR', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  // Reemplazos básicos
  const basicReplacements = {
    '{{USER_NAME}}': escapeHTML(meta.name),
    '{{PROFILE_NAME}}': escapeHTML(profile.name),
    '{{PROFILE_EMOJI}}': profile.emoji,
    '{{PROFILE_LEMA}}': escapeHTML(profile.lema),
    '{{DATE}}': escapeHTML(today),
    '{{REPORT_ID}}': escapeHTML(meta.report_id || ''),
    '{{SCORE_FOCO}}': String(scores.foco),
    '{{SCORE_RITMO}}': String(scores.ritmo),
    '{{SCORE_ESTRUCTURA}}': String(scores.estructura),
    '{{SCORE_COMUNICACION}}': String(scores.comunicacion),
    '{{REACTION_VALUE}}': escapeHTML(meta.reaction_value || ''),
    '{{REACTION_AVG}}': String(meta.reaction_avg_seconds || 0)
  };
  for (const [k, v] of Object.entries(basicReplacements)) {
    html = html.split(k).join(v);
  }

  // Contenido generado por IA — párrafos simples
  const aiSimpleFields = [
    'intro_paragrafo_1', 'intro_paragrafo_2', 'intro_paragrafo_3', 'intro_paragrafo_4',
    'comunicacion_malinterpretaciones', 'comunicacion_recomendaciones',
    'decisiones_intro', 'decisiones_regla',
    'ambientes_jefe_ideal', 'ambientes_cultura', 'ambientes_entrevista_tips',
    'liderazgo_intro', 'liderazgo_como_dirige', 'liderazgo_como_forma',
    'liderazgo_lo_cuesta', 'liderazgo_recordatorio', 'liderazgo_impacto_12_meses',
    'entrevista_diferencial', 'entrevista_pitch_60_segundos',
    'cierre_paragrafo_1', 'cierre_paragrafo_2'
  ];
  for (const f of aiSimpleFields) {
    const key = '{{' + f.toUpperCase() + '}}';
    html = html.split(key).join(content[f] || '');
  }

  // Listas
  html = html.replace('{{FORTALEZAS_HTML}}', renderInsightBlocks(content.fortalezas, false));
  html = html.replace('{{DESARROLLO_HTML}}', renderInsightBlocks(content.desarrollo, true));
  html = html.replace('{{COMUNICACION_BULLETS}}', renderBulletList(content.comunicacion_bullets, '→'));
  html = html.replace('{{DECISIONES_RINDE_MEJOR}}', renderBulletList(content.decisiones_rinde_mejor, '✓'));
  html = html.replace('{{DECISIONES_SE_TRABA}}', renderBulletList(content.decisiones_se_traba, '!'));
  html = html.replace('{{AMBIENTES_POTENCIA}}', renderSimpleList(content.ambientes_potencia));
  html = html.replace('{{AMBIENTES_DESGASTA}}', renderSimpleList(content.ambientes_desgasta));
  html = html.replace('{{ENTREVISTA_FRASES}}', renderQuoteList(content.entrevista_frases));
  html = html.replace('{{ENTREVISTA_QA}}', renderQABlocks(content.entrevista_qa));
  html = html.replace('{{ENTREVISTA_ERRORES}}', renderBulletList(content.entrevista_errores_comunes, '!'));

  return html;
}

function renderInsightBlocks(items, isWeakness) {
  if (!Array.isArray(items)) return '';
  const cls = isWeakness ? 'weakness' : '';
  const tipKey = isWeakness ? 'accion_concreta' : 'donde_se_nota';
  const tipLabel = isWeakness ? 'Acción concreta' : 'Dónde se nota';
  return items.map((item, i) => `
    <div class="insight-block ${cls}">
      <div class="insight-block-title">
        <span class="insight-block-num">${i + 1}</span>
        ${escapeHTML(item.titulo || '')}
      </div>
      <p class="insight-block-text">${item.descripcion || ''}</p>
      ${item[tipKey] ? `<div class="insight-tip"><strong>${tipLabel}:</strong> ${item[tipKey]}</div>` : ''}
    </div>
  `).join('');
}

function renderBulletList(items, iconChar) {
  if (!Array.isArray(items)) return '';
  return items.map(item => `
    <div class="feature-item">
      <div class="feature-icon">${iconChar}</div>
      <div class="feature-text">${item}</div>
    </div>
  `).join('');
}

function renderSimpleList(items) {
  if (!Array.isArray(items)) return '';
  return items.map(item => `<li>${item}</li>`).join('');
}

function renderQuoteList(items) {
  if (!Array.isArray(items)) return '';
  return items.map(quote => `<div class="quote-box">"${quote.replace(/^"|"$/g, '')}"</div>`).join('');
}

function renderQABlocks(items) {
  if (!Array.isArray(items)) return '';
  return items.map(qa => `
    <div class="qa-block">
      <div class="qa-question">${escapeHTML(qa.pregunta || '')}</div>
      <div class="qa-answer">${qa.respuesta || ''}</div>
      ${qa.por_que_funciona ? `<div class="qa-note"><strong>Por qué funciona:</strong> ${qa.por_que_funciona}</div>` : ''}
    </div>
  `).join('');
}
