// ==UserScript==
// @name         Boosteroid CloudPad
// @namespace    https://github.com/SEU_USUARIO/boosteroid-cloudpad
// @version      8.0
// @description  Controle Virtual XInput, HUD editável, Tema MD3 e Otimizações para o Boosteroid.
// @author       Seu Nome / Comunidade
// @match        ://cloud.boosteroid.com/
// @icon         https://cloud.boosteroid.com/favicon.ico
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  if (window.self !== window.top && !document.querySelector('canvas, video')) return;

  function silenceEvent(e) {
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
  }
  // --- CORE: Estado do Gamepad e Interceptação Segura ---

  // 🚀 INTERCEPTAÇÃO DA ÁREA DE TRANSFERÊNCIA (CLIPBOARD) 🚀
  if (window.AndroidClipboard) {
    try {
      const nativeClipboard = {
        readText: async () => window.AndroidClipboard.getClipboardText(),
        writeText: async () => {} 
      };
      Object.defineProperty(navigator, 'clipboard', { value: nativeClipboard, configurable: true });
    } catch(e) {
      if (navigator.clipboard) navigator.clipboard.readText = async () => window.AndroidClipboard.getClipboardText();
    }
  }

  let isGamepadEnabled = false;
  let isEditMode = false;

  const virtualGamepad = {
    id: "Xbox 360 Controller (XInput STANDARD GAMEPAD)",
    index: 0, connected: true, timestamp: performance.now(), mapping: "standard",
    axes: [0.0, 0.0, 0.0, 0.0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0.0 }))
  };

  const GP = {
    A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7,
    SELECT: 8, START: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15, HOME: 16
  };

  // 🚀 CORREÇÃO: Salva a função nativa para não "cegar" o navegador para controles físicos
  const nativeGetGamepads = navigator.getGamepads ? navigator.getGamepads.bind(navigator) : () => [];

  navigator.getGamepads = function () {
    const physicalPads = nativeGetGamepads() || [];
    const result = [null, null, null, null];
    
    // 1. Mantém os controles físicos reais intocados nos seus respectivos slots
    for (let i = 0; i < 4; i++) {
      if (physicalPads[i]) {
        result[i] = physicalPads[i];
      }
    }

    // 2. Injeta o controle virtual apenas no primeiro slot vazio disponível
    if (isGamepadEnabled) {
      virtualGamepad.timestamp = performance.now();
      let emptySlot = result.findIndex(p => p === null);
      if (emptySlot !== -1) {
        virtualGamepad.index = emptySlot;
        result[emptySlot] = virtualGamepad;
      }
    }
    
    return result;
  };

  function notifyConnected() {
    virtualGamepad.connected = true;
    try { window.dispatchEvent(new GamepadEvent('gamepadconnected', { gamepad: virtualGamepad })); } 
    catch (e) { let ev = new Event('gamepadconnected'); ev.gamepad = virtualGamepad; window.dispatchEvent(ev); }
  }

  function notifyDisconnected() {
    virtualGamepad.connected = false;
    try { window.dispatchEvent(new GamepadEvent('gamepaddisconnected', { gamepad: virtualGamepad })); } 
    catch (e) { let ev = new Event('gamepaddisconnected'); ev.gamepad = virtualGamepad; window.dispatchEvent(ev); }
  }

  function resetInputs() {
    virtualGamepad.axes = [0.0, 0.0, 0.0, 0.0];
    virtualGamepad.buttons.forEach(b => { b.pressed = false; b.value = 0.0; });
  }
  // --- LAYOUT E CONFIGURAÇÕES: Posições e Comportamentos ---
  let homeIsSteam = true; // Estado global para o comportamento do botão HOME

  const defaultLayout = {
    'vpad-el-lt': { left: '4vw', top: '8vh', scale: 1 },
    'vpad-el-lb': { left: '16vw', top: '8vh', scale: 1 },
    'vpad-el-rt': { left: '86vw', top: '8vh', scale: 1 },
    'vpad-el-rb': { left: '74vw', top: '8vh', scale: 1 },
    'vpad-el-menus': { left: '40vw', top: '8vh', scale: 1 },
    'vpad-el-dpad': { left: '6vw', top: '50vh', scale: 1 },
    'vpad-el-abxy': { left: '78vw', top: '50vh', scale: 1 },
    'vpad-el-l3': { left: '22vw', top: '78vh', scale: 1 },
    'vpad-el-r3': { left: '65vw', top: '78vh', scale: 1 },
    'vpad-el-touch-l': { left: '3vw', top: '45vh', scale: 1 },
    'vpad-el-touch-r': { left: '62vw', top: '45vh', scale: 1 }
  };

  function saveLayout() {
    const layout = {};
    document.querySelectorAll('.vpad-element').forEach(el => {
      layout[el.id] = {
        left: el.style.left, top: el.style.top,
        scale: el.style.getPropertyValue('--scale') || 1,
        opacity: el.style.getPropertyValue('--opacity') || 1,
        blur: el.style.getPropertyValue('--blur-val') || '4px'
      };
    });
    localStorage.setItem('vpad-layout-v1', JSON.stringify(layout));
    localStorage.setItem('vpad-config-v1', JSON.stringify({ homeIsSteam }));
  }

  function loadLayout() {
    let saved = null; let savedConfig = null;
    try { saved = JSON.parse(localStorage.getItem('vpad-layout-v1')); } catch (e) {}
    try { savedConfig = JSON.parse(localStorage.getItem('vpad-config-v1')); } catch (e) {}
    
    const layout = saved || defaultLayout;
    if (savedConfig && savedConfig.homeIsSteam !== undefined) homeIsSteam = savedConfig.homeIsSteam;
    
    for (let id in layout) {
      const el = document.getElementById(id);
      if (el) {
        el.style.left = layout[id].left; el.style.top = layout[id].top;
        el.style.setProperty('--scale', layout[id].scale !== undefined ? layout[id].scale : 1);
        el.style.setProperty('--opacity', layout[id].opacity !== undefined ? layout[id].opacity : 1);
        el.style.setProperty('--blur-val', layout[id].blur !== undefined ? layout[id].blur : '4px');
      }
    }
  }

  function resetLayout() {
    localStorage.removeItem('vpad-layout-v1');
    loadLayout();
  }
  // --- UI: Ícones, Estilos e Construção do DOM ---
  const ICON = {
    pad: `<svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="6"/><circle cx="6" cy="12" r="1"/><circle cx="18" cy="12" r="1"/><path d="M10 12h.01M14 12h.01"/></svg>`,
    screen: `<svg viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>`,
    edit: `<svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>`,
    plus: `<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    minus: `<svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    reset: `<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><polyline points="3 3 3 8 8 8"/></svg>`,
    eye: `<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
    eyeOff: `<svg viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`,
    drop: `<svg viewBox="0 0 24 24"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`,
    keyboard: `<svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2" ry="2"/><line x1="6" y1="9" x2="6" y2="9"/><line x1="10" y1="9" x2="10" y2="9"/><line x1="14" y1="9" x2="14" y2="9"/><line x1="18" y1="9" x2="18" y2="9"/><line x1="6" y1="13" x2="6" y2="13"/><line x1="10" y1="13" x2="10" y2="13"/><line x1="14" y1="13" x2="14" y2="13"/><line x1="18" y1="13" x2="18" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>`,
    up: `<svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>`,
    down: `<svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>`,
    left: `<svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>`,
    right: `<svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>`,
    menu: `<svg viewBox="0 0 24 24"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
    view: `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>`,
    home: `<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`,
    back: `<svg viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`,
    clipboard: `<svg viewBox="0 0 24 24"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>`,
    mic: `<svg viewBox="0 0 24 24"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>`,
    micOff: `<svg viewBox="0 0 24 24"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>`,
    keyboardTop: `<svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"/><line x1="6" y1="8" x2="6" y2="8"/><line x1="10" y1="8" x2="10" y2="8"/><line x1="14" y1="8" x2="14" y2="8"/><line x1="18" y1="8" x2="18" y2="8"/><line x1="6" y1="12" x2="6" y2="12"/><line x1="10" y1="12" x2="10" y2="12"/><line x1="14" y1="12" x2="14" y2="12"/><line x1="18" y1="12" x2="18" y2="12"/><line x1="8" y1="16" x2="16" y2="16"/></svg>`,
    power: `<svg viewBox="0 0 24 24"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>`
  };

  function renderUI() {
    if (document.getElementById('vpad-root')) return;

    const style = document.createElement('style');
    style.textContent = `
      #vpad-root { position: fixed; inset: 0; z-index: 2147483647; pointer-events: none; user-select: none; -webkit-user-select: none; touch-action: none; overflow: hidden; font-family: system-ui, sans-serif; }
      
      .vpad-glass-btn { display: flex; align-items: center; justify-content: center; gap: 6px; background: rgba(255, 255, 255, 0.15); border: 2px solid rgba(255, 255, 255, 0.35); color: #fff; font-weight: 700; backdrop-filter: blur(var(--blur-val, 4px)); transition: background 0.1s, border-color 0.2s, color 0.2s; pointer-events: auto; touch-action: none; }
      .vpad-glass-btn:active, .vpad-glass-btn.active-press { background: rgba(255, 255, 255, 0.45); }
      .vpad-glass-btn svg { stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; transition: inherit; }
      
      #vpad-top-bar { position: absolute; top: calc(10px + env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); display: flex; gap: 8px; pointer-events: auto; flex-wrap: wrap; justify-content: center; width: max-content; max-width: 95vw; }
      .vpad-top-btn { padding: 6px 12px; font-size: 10px; border-radius: 24px; white-space: nowrap; }
      .vpad-top-btn svg { width: 14px; height: 14px; }
      .vpad-top-btn.is-off { border-color: rgba(255,100,100,0.6); color: #ffbaba; background: rgba(80,0,0,0.4); }
      .vpad-top-btn.is-edit { border-color: #ffeb3b; color: #ffeb3b; }
      .vpad-top-btn.is-danger { border-color: #ff6b6b; color: #ff6b6b; }
      
      #vpad-edit-panel { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); background: rgba(20, 20, 25, 0.85); border: 1px solid rgba(255,255,255,0.2); border-radius: 16px; padding: 0; display: none; flex-direction: column; pointer-events: auto; backdrop-filter: blur(8px); z-index: 9999; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
      #vpad-edit-panel.visible { display: flex; }
      #vpad-edit-header { background: rgba(255, 255, 255, 0.1); padding: 10px; text-align: center; font-size: 10px; font-weight: bold; color: #aaa; text-transform: uppercase; border-radius: 16px 16px 0 0; cursor: move; touch-action: none; border-bottom: 1px solid rgba(255,255,255,0.1); }
      
      .vpad-edit-body { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 16px; }
      .vpad-edit-btn { padding: 10px 8px; border-radius: 12px; font-size: 9px; flex-direction: column; gap: 4px; text-align: center; }
      .vpad-edit-btn svg { width: 16px; height: 16px; }
      .vpad-edit-btn.wide { grid-column: 1 / -1; flex-direction: row; font-size: 11px; padding: 10px; }
      
      .vpad-hidden { display: none !important; }
      .vpad-element { position: absolute; opacity: var(--opacity, 1); transform: scale(var(--scale, 1)); transform-origin: center center; pointer-events: auto; touch-action: none; }
      .vpad-element.edit-mode-active { border: 2px dashed rgba(255, 255, 255, 0.3); background: rgba(255, 255, 255, 0.05); border-radius: 12px; }
      .vpad-element.edit-mode-active.selected { border-color: #ffeb3b; background: rgba(255, 235, 59, 0.2); z-index: 1000; }
      
      .vpad-btn-round { width: 50px; height: 50px; border-radius: 50%; font-size: 16px; letter-spacing: 1px; }
      .vpad-btn-round svg { width: 22px; height: 22px; }
      .vpad-btn-rect { width: 75px; height: 45px; border-radius: 10px; font-size: 14px; }
      .vpad-btn-small { width: 45px; height: 35px; border-radius: 20px; font-size: 11px; }
      .vpad-btn-small svg { width: 14px; height: 14px; }
      
      #vpad-el-menus { display: flex; gap: 12px; }
      .vpad-cluster-grid { position: relative; width: 140px; height: 140px; }
      .vpad-cluster-grid .btn-top { position: absolute; top: 0; left: 45px; }
      .vpad-cluster-grid .btn-bottom { position: absolute; bottom: 0; left: 45px; }
      .vpad-cluster-grid .btn-left { position: absolute; top: 45px; left: 0; }
      .vpad-cluster-grid .btn-right { position: absolute; top: 45px; right: 0; }
      
      .vpad-touch-zone { width: 35vw; height: 50vh; }
      .vpad-stick-base { position: absolute; width: 110px; height: 110px; border-radius: 50%; background: rgba(255, 255, 255, 0.08); border: 2px solid rgba(255, 255, 255, 0.25); pointer-events: none; backdrop-filter: blur(var(--blur-val, 0px)); transition: opacity 0.2s; }
      .vpad-stick-knob { position: absolute; width: 46px; height: 46px; border-radius: 50%; background: rgba(255, 255, 255, 0.5); top: 50%; left: 50%; transform: translate(-50%, -50%); pointer-events: none; }
    `;
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.id = 'vpad-root';
    root.innerHTML = `
      <div id="vpad-top-bar">
        <div id="vpad-exit-btn" class="vpad-glass-btn vpad-top-btn is-danger">${ICON.power} SAIR</div>
        <div id="vpad-clipboard-btn" class="vpad-glass-btn vpad-top-btn">${ICON.clipboard} COLAR</div>
        <div id="vpad-mic-btn" class="vpad-glass-btn vpad-top-btn">${ICON.micOff} MIC OFF</div>
        <div id="vpad-kb-btn" class="vpad-glass-btn vpad-top-btn">${ICON.keyboardTop} TECLADO</div>
        <div id="vpad-toggle-btn" class="vpad-glass-btn vpad-top-btn">${ICON.pad} ON</div>
        <div id="vpad-fullscreen-btn" class="vpad-glass-btn vpad-top-btn">${ICON.screen} ECRÃ</div>
        <div id="vpad-edit-toggle-btn" class="vpad-glass-btn vpad-top-btn">${ICON.edit} EDITAR</div>
      </div>
      
      <div id="vpad-edit-panel">
        <div id="vpad-edit-header">≡ ARRASTAR PAINEL</div>
        <div class="vpad-edit-body">
          <div id="vpad-edit-minus" class="vpad-glass-btn vpad-edit-btn">${ICON.minus} TAM -</div>
          <div id="vpad-edit-plus" class="vpad-glass-btn vpad-edit-btn">${ICON.plus} TAM +</div>
          <div id="vpad-edit-reset" class="vpad-glass-btn vpad-edit-btn">${ICON.reset} REPOR</div>
          <div id="vpad-edit-op-minus" class="vpad-glass-btn vpad-edit-btn">${ICON.eyeOff} OPAC -</div>
          <div id="vpad-edit-op-plus" class="vpad-glass-btn vpad-edit-btn">${ICON.eye} OPAC +</div>
          <div id="vpad-edit-blur" class="vpad-glass-btn vpad-edit-btn">${ICON.drop} BLUR ON</div>
          <div id="vpad-edit-home-mode" class="vpad-glass-btn vpad-edit-btn wide"></div>
        </div>
      </div>
      
      <div id="vpad-controls-container">
        <div class="vpad-element vpad-touch-zone" id="vpad-el-touch-l"><div id="vpad-stick-base-l" class="vpad-stick-base"><div id="vpad-stick-knob-l" class="vpad-stick-knob"></div></div></div>
        <div class="vpad-element vpad-touch-zone" id="vpad-el-touch-r"><div id="vpad-stick-base-r" class="vpad-stick-base"><div id="vpad-stick-knob-r" class="vpad-stick-knob"></div></div></div>
        <div class="vpad-element" id="vpad-el-lt"><div class="vpad-glass-btn vpad-btn-rect" id="vpad-btn-lt">LT</div></div>
        <div class="vpad-element" id="vpad-el-lb"><div class="vpad-glass-btn vpad-btn-rect" id="vpad-btn-lb">LB</div></div>
        <div class="vpad-element" id="vpad-el-rt"><div class="vpad-glass-btn vpad-btn-rect" id="vpad-btn-rt">RT</div></div>
        <div class="vpad-element" id="vpad-el-rb"><div class="vpad-glass-btn vpad-btn-rect" id="vpad-btn-rb">RB</div></div>
        <div class="vpad-element" id="vpad-el-menus">
          <div class="vpad-glass-btn vpad-btn-small" id="vpad-btn-select">${ICON.view}</div>
          <div class="vpad-glass-btn vpad-btn-small" id="vpad-btn-home">${ICON.home}</div>
          <div class="vpad-glass-btn vpad-btn-small" id="vpad-btn-start">${ICON.menu}</div>
        </div>
        <div class="vpad-element vpad-cluster-grid" id="vpad-el-dpad">
          <div class="vpad-glass-btn vpad-btn-round btn-top" id="vpad-btn-up">${ICON.up}</div>
          <div class="vpad-glass-btn vpad-btn-round btn-bottom" id="vpad-btn-down">${ICON.down}</div>
          <div class="vpad-glass-btn vpad-btn-round btn-left" id="vpad-btn-left">${ICON.left}</div>
          <div class="vpad-glass-btn vpad-btn-round btn-right" id="vpad-btn-right">${ICON.right}</div>
        </div>
        <div class="vpad-element" id="vpad-el-l3"><div class="vpad-glass-btn vpad-btn-small" id="vpad-btn-l3">L3</div></div>
        <div class="vpad-element vpad-cluster-grid" id="vpad-el-abxy">
          <div class="vpad-glass-btn vpad-btn-round btn-top" id="vpad-btn-y">Y</div>
          <div class="vpad-glass-btn vpad-btn-round btn-bottom" id="vpad-btn-a">A</div>
          <div class="vpad-glass-btn vpad-btn-round btn-left" id="vpad-btn-x">X</div>
          <div class="vpad-glass-btn vpad-btn-round btn-right" id="vpad-btn-b">B</div>
        </div>
        <div class="vpad-element" id="vpad-el-r3"><div class="vpad-glass-btn vpad-btn-small" id="vpad-btn-r3">R3</div></div>
      </div>
    `;
    document.body.appendChild(root);
    loadLayout();
  }
  // --- EDIT MODE: Drag & Drop, Redimensionamento, Opacidade, Blur e Modo Home ---
  let activeEditElement = null;
  let dragData = null;
  let panelDrag = null;

  function initEditLogic() {
    const editToggleBtn = document.getElementById('vpad-edit-toggle-btn');
    const editPanel = document.getElementById('vpad-edit-panel');
    const homeModeBtn = document.getElementById('vpad-edit-home-mode');

    homeModeBtn.innerHTML = homeIsSteam ? `${ICON.keyboard} HOME: SHIFT+TAB` : `${ICON.pad} HOME: NATIVO`;
    
    function updatePanelState() {
      if (!activeEditElement) return;
      let currentBlur = activeEditElement.style.getPropertyValue('--blur-val');
      let isBlurOn = currentBlur === '' || currentBlur === '4px';
      if (currentBlur === '0px') isBlurOn = false;
      document.getElementById('vpad-edit-blur').innerHTML = isBlurOn ? `${ICON.drop} BLUR ON` : `${ICON.drop} BLUR OFF`;
    }

    editToggleBtn.addEventListener('click', (e) => {
      silenceEvent(e);
      isEditMode = !isEditMode;
      const elements = document.querySelectorAll('.vpad-element');
      
      if (isEditMode) {
        editToggleBtn.classList.add('is-edit'); editPanel.classList.add('visible');
        resetInputs();
        elements.forEach(el => el.classList.add('edit-mode-active'));
      } else {
        editToggleBtn.classList.remove('is-edit'); editPanel.classList.remove('visible');
        if (activeEditElement) activeEditElement.classList.remove('selected');
        activeEditElement = null;
        elements.forEach(el => el.classList.remove('edit-mode-active'));
        saveLayout();
      }
    }, { capture: true });

    homeModeBtn.addEventListener('click', (e) => {
      silenceEvent(e);
      homeIsSteam = !homeIsSteam;
      homeModeBtn.innerHTML = homeIsSteam ? `${ICON.keyboard} HOME: SHIFT+TAB` : `${ICON.pad} HOME: NATIVO`;
      saveLayout();
    });

    document.getElementById('vpad-edit-plus').addEventListener('click', (e) => { silenceEvent(e); if (activeEditElement) { let s = parseFloat(activeEditElement.style.getPropertyValue('--scale')) || 1; activeEditElement.style.setProperty('--scale', Math.min(2.5, s + 0.1)); }});
    document.getElementById('vpad-edit-minus').addEventListener('click', (e) => { silenceEvent(e); if (activeEditElement) { let s = parseFloat(activeEditElement.style.getPropertyValue('--scale')) || 1; activeEditElement.style.setProperty('--scale', Math.max(0.4, s - 0.1)); }});
    document.getElementById('vpad-edit-op-plus').addEventListener('click', (e) => { silenceEvent(e); if (activeEditElement) { let o = parseFloat(activeEditElement.style.getPropertyValue('--opacity')); if (isNaN(o)) o = 1; activeEditElement.style.setProperty('--opacity', Math.min(1.0, o + 0.1).toFixed(1)); }});
    document.getElementById('vpad-edit-op-minus').addEventListener('click', (e) => { silenceEvent(e); if (activeEditElement) { let o = parseFloat(activeEditElement.style.getPropertyValue('--opacity')); if (isNaN(o)) o = 1; activeEditElement.style.setProperty('--opacity', Math.max(0.1, o - 0.1).toFixed(1)); }});

    document.getElementById('vpad-edit-blur').addEventListener('click', (e) => {
      silenceEvent(e);
      if (!activeEditElement) return;
      let currentBlur = activeEditElement.style.getPropertyValue('--blur-val');
      let isBlurOn = currentBlur === '' || currentBlur === '4px';
      if (currentBlur === '0px') isBlurOn = false;

      if (isBlurOn) {
        activeEditElement.style.setProperty('--blur-val', '0px');
        document.getElementById('vpad-edit-blur').innerHTML = `${ICON.drop} BLUR OFF`;
      } else {
        activeEditElement.style.setProperty('--blur-val', '4px');
        document.getElementById('vpad-edit-blur').innerHTML = `${ICON.drop} BLUR ON`;
      }
    });

    document.getElementById('vpad-edit-reset').addEventListener('click', (e) => { silenceEvent(e); resetLayout(); });

    /* --- CORREÇÃO DO TELETRANSPORTE (PAINEL FLUTUANTE) --- */
    const editHeader = document.getElementById('vpad-edit-header');
    editHeader.addEventListener('touchstart', (e) => {
      silenceEvent(e);
      const touch = e.touches[0]; 
      
      let currentLeft = parseFloat(editPanel.style.left);
      let currentTop = parseFloat(editPanel.style.top);
      
      // Se ainda não tiver left/top definidos (centralizado nativamente), pega o centro
      if (isNaN(currentLeft)) currentLeft = window.innerWidth / 2;
      if (isNaN(currentTop)) currentTop = window.innerHeight / 2;

      editPanel.style.left = `${currentLeft}px`; 
      editPanel.style.top = `${currentTop}px`; 
      editPanel.style.transform = 'none'; // Trava o transform
      
      panelDrag = { id: touch.identifier, startX: touch.clientX, startY: touch.clientY, startLeft: currentLeft, startTop: currentTop };
    }, { passive: false });

    editHeader.addEventListener('touchmove', (e) => {
      if (!panelDrag) return; silenceEvent(e);
      for (let touch of e.changedTouches) {
        if (touch.identifier === panelDrag.id) {
          editPanel.style.left = `${panelDrag.startLeft + (touch.clientX - panelDrag.startX)}px`;
          editPanel.style.top = `${panelDrag.startTop + (touch.clientY - panelDrag.startY)}px`;
        }
      }
    }, { passive: false });
    editHeader.addEventListener('touchend', () => { panelDrag = null; }, { capture: true });

    /* --- CORREÇÃO DO TELETRANSPORTE (BOTÕES DO GAMEPAD) --- */
    document.addEventListener('touchstart', (e) => {
      if (!isEditMode || e.target.closest('#vpad-edit-panel')) return;
      const el = e.target.closest('.vpad-element');
      if (activeEditElement && activeEditElement !== el) activeEditElement.classList.remove('selected');
      if (!el) { activeEditElement = null; return; }
      
      silenceEvent(e);
      activeEditElement = el; 
      activeEditElement.classList.add('selected');
      updatePanelState(); 

      const touch = e.touches[0]; 
      
      // Lemos o CSS inline real do elemento e convertemos, ignorando o bounding box que tem escala
      let startLeftVW = parseFloat(el.style.left) || 0;
      let startTopVH = parseFloat(el.style.top) || 0;
      
      dragData = { 
        id: touch.identifier, 
        startX: touch.clientX, 
        startY: touch.clientY, 
        startLeftVW: startLeftVW, 
        startTopVH: startTopVH 
      };
    }, { capture: true, passive: false });

    document.addEventListener('touchmove', (e) => {
      if (!isEditMode || !dragData || !activeEditElement) return; silenceEvent(e);
      for (let touch of e.changedTouches) {
        if (touch.identifier === dragData.id) {
          // Calcula o delta em px e converte direto para vw/vh
          const dxVW = ((touch.clientX - dragData.startX) / window.innerWidth) * 100;
          const dyVH = ((touch.clientY - dragData.startY) / window.innerHeight) * 100;
          activeEditElement.style.left = `${dragData.startLeftVW + dxVW}vw`; 
          activeEditElement.style.top = `${dragData.startTopVH + dyVH}vh`;
        }
      }
    }, { capture: true, passive: false });

    document.addEventListener('touchend', (e) => {
      if (!isEditMode || !dragData) return;
      for (let touch of e.changedTouches) { if (touch.identifier === dragData.id) dragData = null; }
    }, { capture: true });
  }
  // --- INPUT: Analógicos, Botões Digitais e Emulação de Teclado Avançada ---
  
  function simulateKey(eventName, key, code, keyCode, shiftKey) {
    // Procura elementos específicos de stream (Boosteroid usa video ou canvas em wrappers específicos)
    const target = document.querySelector('video, canvas, #game-stream, .stream-container') || document.body;
    
    const event = new KeyboardEvent(eventName, {
      key: key, code: code, keyCode: keyCode, which: keyCode,
      shiftKey: shiftKey, bubbles: true, cancelable: true, composed: true
    });
    
    // Hacks pesados para contornar a segurança de engines de cloud gaming que validam keyCode real
    Object.defineProperties(event, {
      keyCode: { get: () => keyCode },
      which: { get: () => keyCode }
    });
    
    target.dispatchEvent(event);
  }

  function setupStick(zoneId, baseId, knobId, axisX, axisY) {
    const zone = document.getElementById(zoneId); const base = document.getElementById(baseId); const knob = document.getElementById(knobId);
    const MAX_RADIUS = 45; let touchId = null; let originX = 0, originY = 0;

    function park() { base.style.left = '50%'; base.style.top = '50%'; base.style.transform = 'translate(-50%, -50%)'; knob.style.transform = 'translate(-50%, -50%)'; }
    park();

    zone.addEventListener('touchstart', (e) => {
      if (!isGamepadEnabled || isEditMode) return; silenceEvent(e); if (touchId !== null) return;
      const touch = e.changedTouches[0]; touchId = touch.identifier; originX = touch.clientX; originY = touch.clientY;
      const rect = zone.getBoundingClientRect();
      base.style.left = `${originX - rect.left}px`; base.style.top = `${originY - rect.top}px`;
      knob.style.transform = `translate(-50%, -50%)`;
    }, { passive: false, capture: true });

    zone.addEventListener('touchmove', (e) => {
      if (!isGamepadEnabled || isEditMode) return; silenceEvent(e);
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchId) {
          let dx = e.changedTouches[i].clientX - originX; let dy = e.changedTouches[i].clientY - originY;
          const dist = Math.hypot(dx, dy);
          if (dist > MAX_RADIUS) { dx = (dx/dist)*MAX_RADIUS; dy = (dy/dist)*MAX_RADIUS; }
          knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
          virtualGamepad.axes[axisX] = parseFloat((dx / MAX_RADIUS).toFixed(3)); virtualGamepad.axes[axisY] = parseFloat((dy / MAX_RADIUS).toFixed(3));
          break;
        }
      }
    }, { passive: false, capture: true });

    const reset = (e) => {
      if (!isGamepadEnabled || isEditMode) return; silenceEvent(e);
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchId) { touchId = null; park(); virtualGamepad.axes[axisX] = 0.0; virtualGamepad.axes[axisY] = 0.0; break; }
      }
    };
    zone.addEventListener('touchend', reset, { passive: false, capture: true });
    zone.addEventListener('touchcancel', reset, { passive: false, capture: true });
  }

  function bindBtn(id, gpIndex) {
    const el = document.getElementById(id); if (!el) return;
    const setBtn = (pressed) => {
      if (!isGamepadEnabled || isEditMode) return;

      // Interceptação do Botão Home para Shift+Tab no Boosteroid
      if (gpIndex === GP.HOME && homeIsSteam) {
        if (pressed) {
          simulateKey('keydown', 'Shift', 'ShiftLeft', 16, true);
          simulateKey('keydown', 'Tab', 'Tab', 9, true);
        } else {
          simulateKey('keyup', 'Tab', 'Tab', 9, true);
          simulateKey('keyup', 'Shift', 'ShiftLeft', 16, false);
        }
      } else {
        virtualGamepad.buttons[gpIndex].pressed = pressed; 
        virtualGamepad.buttons[gpIndex].value = pressed ? 1.0 : 0.0;
      }

      if (pressed) el.classList.add('active-press'); else el.classList.remove('active-press');
    };

    el.addEventListener('touchstart', (e) => { if(!isEditMode){ silenceEvent(e); setBtn(true); } }, { passive: false, capture: true });
    el.addEventListener('touchend', (e) => { if(!isEditMode){ silenceEvent(e); setBtn(false); } }, { passive: false, capture: true });
    el.addEventListener('touchcancel', (e) => { if(!isEditMode){ silenceEvent(e); setBtn(false); } }, { passive: false, capture: true });
  }

  function initInputs() {
    setupStick('vpad-el-touch-l', 'vpad-stick-base-l', 'vpad-stick-knob-l', 0, 1);
    setupStick('vpad-el-touch-r', 'vpad-stick-base-r', 'vpad-stick-knob-r', 2, 3);
    
    bindBtn('vpad-btn-a', GP.A); bindBtn('vpad-btn-b', GP.B); bindBtn('vpad-btn-x', GP.X); bindBtn('vpad-btn-y', GP.Y);
    bindBtn('vpad-btn-up', GP.UP); bindBtn('vpad-btn-down', GP.DOWN); bindBtn('vpad-btn-left', GP.LEFT); bindBtn('vpad-btn-right', GP.RIGHT);
    bindBtn('vpad-btn-lt', GP.LT); bindBtn('vpad-btn-rt', GP.RT); bindBtn('vpad-btn-lb', GP.LB); bindBtn('vpad-btn-rb', GP.RB);
    bindBtn('vpad-btn-select', GP.SELECT); bindBtn('vpad-btn-home', GP.HOME); bindBtn('vpad-btn-start', GP.START);
    bindBtn('vpad-btn-l3', GP.L3); bindBtn('vpad-btn-r3', GP.R3);
  }
  // --- INIT: Inicialização e Eventos Globais ---
  
  function clickNativeBoosteroidElement(id) {
    const el = document.getElementById(id);
    if (el) {
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      el.click();
      el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    }
  }

  function setupMicSync() {
    const nativeMic = document.getElementById('mic-control');
    const vpadMic = document.getElementById('vpad-mic-btn');
    if (!vpadMic) return;

    if (nativeMic) {
      const updateMicUI = () => {
        const isEnabled = nativeMic.getAttribute('aria-pressed') === 'true';
        if (isEnabled) {
          vpadMic.innerHTML = `${ICON.mic} MIC ON`;
          vpadMic.style.borderColor = '#4caf50';
          vpadMic.style.color = '#4caf50';
        } else {
          vpadMic.innerHTML = `${ICON.micOff} MIC OFF`;
          vpadMic.style.borderColor = ''; 
          vpadMic.style.color = '';
        }
      };

      updateMicUI(); 
      const observer = new MutationObserver(updateMicUI);
      observer.observe(nativeMic, { attributes: true, attributeFilter: ['aria-pressed', 'class'] });
    } else {
      setTimeout(setupMicSync, 1000);
    }
  }

  function initGamepad() {
    renderUI();
    initEditLogic();
    initInputs();

    const toggleBtn = document.getElementById('vpad-toggle-btn');
    const controlsContainer = document.getElementById('vpad-controls-container');

    // Aplica o estado inicial da UI refletindo a inicialização "OFF"
    if (!isGamepadEnabled) {
      toggleBtn.innerHTML = `${ICON.pad} OFF`; 
      toggleBtn.classList.add('is-off'); 
      controlsContainer.classList.add('vpad-hidden');
    }

    document.getElementById('vpad-exit-btn').addEventListener('click', (e) => {
      silenceEvent(e); clickNativeBoosteroidElement('close-session-control');
    }, { capture: true });

    document.getElementById('vpad-clipboard-btn').addEventListener('click', (e) => {
      silenceEvent(e); clickNativeBoosteroidElement('paste-control');
    }, { capture: true });

    document.getElementById('vpad-mic-btn').addEventListener('click', (e) => {
      silenceEvent(e); clickNativeBoosteroidElement('mic-control');
    }, { capture: true });

    document.getElementById('vpad-kb-btn').addEventListener('click', (e) => {
      silenceEvent(e); clickNativeBoosteroidElement('keyboard-control');
    }, { capture: true });

    toggleBtn.addEventListener('click', (e) => {
      silenceEvent(e);
      if (isEditMode) return;
      isGamepadEnabled = !isGamepadEnabled;
      if (isGamepadEnabled) {
        toggleBtn.innerHTML = `${ICON.pad} ON`; toggleBtn.classList.remove('is-off'); controlsContainer.classList.remove('vpad-hidden'); notifyConnected();
      } else {
        toggleBtn.innerHTML = `${ICON.pad} OFF`; toggleBtn.classList.add('is-off'); controlsContainer.classList.add('vpad-hidden'); resetInputs(); notifyDisconnected();
      }
    }, { capture: true });

    document.getElementById('vpad-fullscreen-btn').addEventListener('click', (e) => {
      silenceEvent(e);
      if (!document.fullscreenElement) { document.documentElement.requestFullscreen().catch(() => {}); } else { document.exitFullscreen(); }
    }, { capture: true });

    // 🚀 AUTO-TOGGLE INTELIGENTE BASEADO NA URL 🚀
    let wasInStream = false;
    
    function checkStreamState() {
      // Checa se a URL contém "streaming" indicando que a sessão do jogo foi aberta
      const isStream = window.location.href.includes('streaming');
      
      if (isStream && !wasInStream) {
        wasInStream = true;
        // O usuário acabou de entrar no jogo, liga o controle automaticamente
        if (!isGamepadEnabled && !isEditMode) {
          isGamepadEnabled = true;
          toggleBtn.innerHTML = `${ICON.pad} ON`; 
          toggleBtn.classList.remove('is-off'); 
          controlsContainer.classList.remove('vpad-hidden'); 
          notifyConnected();
        }
      } else if (!isStream && wasInStream) {
        wasInStream = false;
        // O usuário saiu do jogo e voltou pro catálogo, esconde o controle automaticamente
        if (isGamepadEnabled && !isEditMode) {
          isGamepadEnabled = false;
          toggleBtn.innerHTML = `${ICON.pad} OFF`; 
          toggleBtn.classList.add('is-off'); 
          controlsContainer.classList.add('vpad-hidden'); 
          resetInputs(); 
          notifyDisconnected();
        }
      }
    }
    
    // Roda a verificação a cada 1 segundo (a melhor prática para SPAs que não recarregam a página)
    setInterval(checkStreamState, 1000);
    checkStreamState();

    setupMicSync();
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initGamepad); } 
  else { initGamepad(); }
  // --- TAMPERMONKEY SPECIFIC: Injeção do Tema MD3 ---
  if (!window.AndroidClipboard) {
    const injectTheme = () => {
      if(document.getElementById('injected-md3-theme')) return;
      const style = document.createElement('style');
      style.id = 'injected-md3-theme';
      style.innerHTML = window.atob('LyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0KICAgVEVNQSBNQVRFUklBTCBZT1UgKE1EMykgUEFSQSBCT09TVEVST0lEIENMT1VEUEFECiAgIERlc2NyacOnw6NvOiBFc3RpbGl6YcOnw6NvIGNvbXBsZXRhIGRhIGludGVyZmFjZSB3ZWIgZG8gQm9vc3Rlcm9pZC4KICAgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi8KCi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0KICAgMS4gUkVTRVQgVklTVUFMIEUgQUpVU1RFUyBERSBFU1BBw4dBTUVOVE8gR0xPQkFMCiAgID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi8KLyogT2N1bHRhIG9zIGJhbm5lcnMgbmF0aXZvcyBkbyBwYWluZWwgZSBhcyBhYmFzIGRhIGxvamEgRmFuYXRpY2FsICovCmFwcC1kYXNoYm9hcmQtYmFubmVyLApkYXNoYm9hcmQtYmFubmVyLW5hdmlnYXRpb25zLAouZGFzaGJvYXJkX19iYW5uZXItd3JhcHBlciwKYm9keSAudGFicy0tZmFuYXRpY2FsIHsKICBkaXNwbGF5OiBub25lICFpbXBvcnRhbnQ7CiAgaGVpZ2h0OiAwICFpbXBvcnRhbnQ7CiAgbWFyZ2luOiAwICFpbXBvcnRhbnQ7CiAgb3BhY2l0eTogMCAhaW1wb3J0YW50OwogIHBvaW50ZXItZXZlbnRzOiBub25lICFpbXBvcnRhbnQ7Cn0KCi8qIEdhcmFudGUgdW0gcmVzcGlybyBzdXBlcmlvciBwYXJhIGEgYmlibGlvdGVjYSBkZSBqb2dvcywgZXZpdGFuZG8gY29sYXIgbm8gdG9wbyAqLwpib2R5IC5kYXNoYm9hcmQgLmxpYnJhcnksCmJvZHkgI2Rhc2hib2FyZC1saWJyYXJ5LApib2R5IGxpYnJhcnkgewogIG1hcmdpbi10b3A6IDMwcHggIWltcG9ydGFudDsKfQoKLyogQ2VudHJhbGl6YSBlIGFsaW5oYSBwZXJmZWl0YW1lbnRlIGFzIGFiYXMgZGUgbmF2ZWdhw6fDo28gbmEgbWVzbWEgbGluaGEgKi8KYm9keSBmaWx0ZXItbGlzdCB0YWJzLnRhYnMsCmJvZHkgLnRhYnMudGFicywKYm9keSAudGFicy1pbm5lci50YWJzLWlubmVyIHsKICBhbGlnbi1pdGVtczogY2VudGVyICFpbXBvcnRhbnQ7Cn0KCi8qIEFkaWNpb25hIHVtIHBhZGRpbmcgY29uZm9ydMOhdmVsIChyZXNwaXJvKSBuYSBiYXJyYSBkZSBjb250cm9sZSBkZSBmaWx0cm9zICovCmZpbHRlci1jb250cm9sbGVyLXdpZGdldCB7CiAgcGFkZGluZy10b3A6IDE2cHggIWltcG9ydGFudDsKICBwYWRkaW5nLWJvdHRvbTogMTZweCAhaW1wb3J0YW50Owp9CgovKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09CiAgIDIuIFBBTEVUQSBERSBDT1JFUyBNQVRFUklBTCBZT1UgKEdPTEQgJiBEQVJLIFRIRU1FKQogICA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovCjpyb290LAoqIHsKICAvKiBDb3JlcyBQcmluY2lwYWlzIChBbWFyZWxvIERvdXJhZG8gUHJlbWl1bSBlIE1hcnJvbSBFc2N1cm8pICovCiAgLS1tZC1zeXMtY29sb3ItcHJpbWFyeTogI2Y1YzgwMCAhaW1wb3J0YW50OwogIC0tbWQtc3lzLWNvbG9yLW9uLXByaW1hcnk6ICM1MjM0MTMgIWltcG9ydGFudDsKICAtLW1kLXN5cy1jb2xvci1wcmltYXJ5LWNvbnRhaW5lcjogI2Y1YzgwMCAhaW1wb3J0YW50OwogIC0tbWQtc3lzLWNvbG9yLW9uLXByaW1hcnktY29udGFpbmVyOiAjNTIzNDEzICFpbXBvcnRhbnQ7CgogIC8qIEZ1bmRvcyBlIFN1cGVyZsOtY2llcyAoR3JhZml0ZSBQcm9mdW5kbykgKi8KICAtLW1kLXN5cy1jb2xvci1iYWNrZ3JvdW5kOiAjMUMxQjFGICFpbXBvcnRhbnQ7CiAgLS1tZC1zeXMtY29sb3Itb24tYmFja2dyb3VuZDogI0U2RTFFNSAhaW1wb3J0YW50OwogIC0tbWQtc3lzLWNvbG9yLXN1cmZhY2U6ICMxQzFCMUYgIWltcG9ydGFudDsKICAtLW1kLXN5cy1jb2xvci1zdXJmYWNlLXZhcmlhbnQ6ICM0OTQ1NEYgIWltcG9ydGFudDsKCiAgLyogQ29udGFpbmVycyBlIENvbnRvcm5vcyAqLwogIC0tbWQtc3lzLWNvbG9yLXN1cmZhY2UtY29udGFpbmVyOiAjMkIyOTMwICFpbXBvcnRhbnQ7CiAgLS1tZC1zeXMtY29sb3Itc3VyZmFjZS1jb250YWluZXItaGlnaDogIzM2MzQzQiAhaW1wb3J0YW50OwogIC0tbWQtc3lzLWNvbG9yLW91dGxpbmU6ICM5MzhGOTkgIWltcG9ydGFudDsKfQoKLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PQogICAzLiBGVU5ETywgQ0FCRcOHQUxITyBFIFBBSU7DiUlTIERFIElORk9STUHDh8ODTwogICA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovCi8qIEFwbGljYSBvIGZ1bmRvIGVzY3VybyBnbG9iYWwgZSBmb3LDp2EgYSBmb250ZSBwYWRyw6NvIGRvIHNpc3RlbWEgb3BlcmFjaW9uYWwgKi8KaHRtbCwKYm9keSwKYm9keSBhcHAtcm9vdCwKYm9keSAubWFpbi1hcHAsCmJvZHkgLndyYXBwZXIsCmJvZHkgLmRhc2hib2FyZCB7CiAgYmFja2dyb3VuZDogdmFyKC0tbWQtc3lzLWNvbG9yLWJhY2tncm91bmQpICFpbXBvcnRhbnQ7CiAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tbWQtc3lzLWNvbG9yLWJhY2tncm91bmQpICFpbXBvcnRhbnQ7CiAgYmFja2dyb3VuZC1pbWFnZTogbm9uZSAhaW1wb3J0YW50OwogIGNvbG9yOiB2YXIoLS1tZC1zeXMtY29sb3Itb24tYmFja2dyb3VuZCkgIWltcG9ydGFudDsKICBmb250LWZhbWlseTogc3lzdGVtLXVpLCBSb2JvdG8sIHNhbnMtc2VyaWYgIWltcG9ydGFudDsKfQoKLyogRXN0aWxpemEgbyBjYWJlw6dhbGhvIHN1cGVyaW9yLCByZW1vdmVuZG8gc29icmFzIGUgYWRpY2lvbmFuZG8gdW1hIGxpbmhhIGRpdmlzw7NyaWEgbGltcGEgKi8KYm9keSAuaGVhZGVyLmhlYWRlciB7CiAgYmFja2dyb3VuZDogdmFyKC0tbWQtc3lzLWNvbG9yLXN1cmZhY2UpICFpbXBvcnRhbnQ7CiAgYmFja2dyb3VuZC1pbWFnZTogbm9uZSAhaW1wb3J0YW50OwogIGJvcmRlci1ib3R0b206IDFweCBzb2xpZCB2YXIoLS1tZC1zeXMtY29sb3Itc3VyZmFjZS12YXJpYW50KSAhaW1wb3J0YW50Owp9Cgpib2R5IC5oZWFkZXI6OmJlZm9yZSwKYm9keSAuaGVhZGVyOjphZnRlciB7CiAgZGlzcGxheTogbm9uZSAhaW1wb3J0YW50Owp9CgovKiBQYWluZWwgZGEgYmFycmEgZGUgcGVzcXVpc2EgZSBtZW51cyBkcm9wZG93biAoZnVuZG8gbGltcG8pICovCmJvZHkgLmNvbW1hbmQtcGFsZXR0ZV9fcGFuZWwgewogIGJhY2tncm91bmQ6IHZhcigtLW1kLXN5cy1jb2xvci1zdXJmYWNlKSAhaW1wb3J0YW50Owp9CgovKiBDb3J0aW5hcy9CYWNrZHJvcHMgZG9zIG1lbnVzIGRlIGZpbHRybyBhYmVydG9zICovCmZpbHRlci1jb250cm9sbGVyLXdpZGdldCB7CiAgLS1maWx0ZXJzLWJhY2tkcm9wOiB2YXIoLS1tZC1zeXMtY29sb3ItYmFja2dyb3VuZCkgIWltcG9ydGFudDsKfQoKLyogUGFpbsOpaXMgY29tIGluZm9ybWHDp8O1ZXMgZG9zIGpvZ29zIChHcmFkaWVudGUgdHJhbnNsw7pjaWRvIHN1YXZlKSAqLwphcHBsaWNhdGlvbi1pbmZvLAphcHBsaWNhdGlvbi1zaG9ydC1pbmZvIHsKICBiYWNrZ3JvdW5kOiBsaW5lYXItZ3JhZGllbnQoMTgwZGVnLCB2YXIoLS1hcHBsaWNhdGlvbi11bmRlci1ldWxhLXBhbmVsLXRvcCwgcmdiYSgyOCwgMjcsIDMxLCAuNykpIDAlLCB2YXIoLS1hcHBsaWNhdGlvbi11bmRlci1ldWxhLXBhbmVsLWJvdHRvbSwgcmdiYSgyOCwgMjcsIDMxLCAuNykpIDEwMCUpICFpbXBvcnRhbnQ7Cn0KCi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0KICAgNC4gQk9Uw5VFUywgQUJBUywgU0VMRUNUUyBFIEZJTFRST1MgKFBJTEwgU0hBUEVTKQogICA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovCi8qIEJvdMO1ZXMgUHJpbmNpcGFpcyBEZXN0YWNhZG9zIChFeDogSm9nYXIsIEFzc2luYXIpICovCmJvZHkgLnByaW1hcnktYnV0dG9uLnByaW1hcnktYnV0dG9uLApib2R5IC5idXR0b24tcHJpbWFyeS5idXR0b24tcHJpbWFyeSB7CiAgYmFja2dyb3VuZDogdmFyKC0tbWQtc3lzLWNvbG9yLXByaW1hcnkpICFpbXBvcnRhbnQ7CiAgYmFja2dyb3VuZC1pbWFnZTogbm9uZSAhaW1wb3J0YW50OwogIGNvbG9yOiB2YXIoLS1tZC1zeXMtY29sb3Itb24tcHJpbWFyeSkgIWltcG9ydGFudDsKICBib3JkZXItcmFkaXVzOiAxMDBweCAhaW1wb3J0YW50OwogIHRleHQtdHJhbnNmb3JtOiBub25lICFpbXBvcnRhbnQ7CiAgZm9udC13ZWlnaHQ6IDcwMCAhaW1wb3J0YW50OwogIGJveC1zaGFkb3c6IG5vbmUgIWltcG9ydGFudDsKICBib3JkZXI6IG5vbmUgIWltcG9ydGFudDsKfQoKYm9keSAucHJpbWFyeS1idXR0b246OmJlZm9yZSwKYm9keSAuYnV0dG9uLXByaW1hcnk6OmJlZm9yZSwKYm9keSAucHJpbWFyeS1idXR0b246OmFmdGVyLApib2R5IC5idXR0b24tcHJpbWFyeTo6YWZ0ZXIgewogIGRpc3BsYXk6IG5vbmUgIWltcG9ydGFudDsKfQoKLyogQmFycmEgZGUgUGVzcXVpc2EgKElucHV0KSAqLwpib2R5IC5jb21tYW5kLXBhbGV0dGVfX3RyaWdnZXIuY29tbWFuZC1wYWxldHRlX190cmlnZ2VyIHsKICBiYWNrZ3JvdW5kOiB2YXIoLS1tZC1zeXMtY29sb3Itc3VyZmFjZS1jb250YWluZXItaGlnaCkgIWltcG9ydGFudDsKICBib3JkZXItcmFkaXVzOiAxMDBweCAhaW1wb3J0YW50OwogIGJvcmRlcjogbm9uZSAhaW1wb3J0YW50Owp9CgovKiBCb3TDtWVzIFNlY3VuZMOhcmlvcywgQWJhcyAoQmlibGlvdGVjYS9Mb2phKSBlIEJvdMOjbyBkZSBMaW1wYXIgRmlsdHJvcyAqLwpib2R5IC50YWItYnV0dG9uLnRhYi1idXR0b24sCmJvZHkgLnNlY29uZGFyeS1idXR0b24sCmJvZHkgLmFwcGxpY2F0aW9uX19jb250cm9scy1zdG9yZSwKYm9keSAuZmlsdGVyLW1lbnUtYnV0dG9uLmZpbHRlci1tZW51LWJ1dHRvbiB7CiAgYm9yZGVyLXJhZGl1czogMTAwcHggIWltcG9ydGFudDsKICBib3JkZXI6IDBweCBzb2xpZCB2YXIoLS1tZC1zeXMtY29sb3Itc3VyZmFjZS12YXJpYW50KSAhaW1wb3J0YW50OwogIGJhY2tncm91bmQtY29sb3I6IHZhcigtLW1kLXN5cy1jb2xvci1zdXJmYWNlLWNvbnRhaW5lcikgIWltcG9ydGFudDsKICBjb2xvcjogdmFyKC0tbWQtc3lzLWNvbG9yLW9uLWJhY2tncm91bmQpICFpbXBvcnRhbnQ7CiAgdGV4dC10cmFuc2Zvcm06IG5vbmUgIWltcG9ydGFudDsKICBmb250LXdlaWdodDogNTAwICFpbXBvcnRhbnQ7CiAgZGlzcGxheTogZmxleCAhaW1wb3J0YW50OwogIGFsaWduLWl0ZW1zOiBjZW50ZXIgIWltcG9ydGFudDsKICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlciAhaW1wb3J0YW50OwogIG1pbi1oZWlnaHQ6IDQwcHggIWltcG9ydGFudDsKICBwYWRkaW5nOiAwIDIwcHggIWltcG9ydGFudDsKICBtYXJnaW46IDAgIWltcG9ydGFudDsKICBib3gtc2hhZG93OiBub25lICFpbXBvcnRhbnQ7Cn0KCmJvZHkgLnRhYi1idXR0b246OmJlZm9yZSwKYm9keSAudGFiLWJ1dHRvbjo6YWZ0ZXIgewogIGRpc3BsYXk6IG5vbmUgIWltcG9ydGFudDsKfQoKLyogRXN0YWRvcyBkZSBTZWxlw6fDo28gKFF1YW5kbyB1bWEgQWJhIG91IEZpbHRybyBlc3TDoSBhdGl2bykgKi8KYm9keSAudGFiLWJ1dHRvbi0tYWN0aXZlLnRhYi1idXR0b24tLWFjdGl2ZSwKYm9keSAuZmlsdGVyLW1lbnUtYnV0dG9uLS1hY3RpdmUuZmlsdGVyLW1lbnUtYnV0dG9uLS1hY3RpdmUsCmJvZHkgLmZpbHRlci1tZW51LWJ1dHRvbi0taXNEaXJ0eS5maWx0ZXItbWVudS1idXR0b24tLWlzRGlydHkgewogIGJhY2tncm91bmQ6IHZhcigtLW1kLXN5cy1jb2xvci1wcmltYXJ5LWNvbnRhaW5lcikgIWltcG9ydGFudDsKICBjb2xvcjogdmFyKC0tbWQtc3lzLWNvbG9yLW9uLXByaW1hcnktY29udGFpbmVyKSAhaW1wb3J0YW50OwogIGJvcmRlci1jb2xvcjogdHJhbnNwYXJlbnQgIWltcG9ydGFudDsKfQoKLyogRm9yw6dhIMOtY29uZXMgU1ZHIGludGVybm9zIGEgaGVyZGFyZW0gYSBjb3IgZG8gdGV4dG8gY29ycmV0YW1lbnRlICovCmJvZHkgLmZpbHRlci1tZW51LWJ1dHRvbi5maWx0ZXItbWVudS1idXR0b24gcCB7CiAgY29sb3I6IGluaGVyaXQgIWltcG9ydGFudDsKfQoKYm9keSAuZmlsdGVyLW1lbnUtYnV0dG9uLmZpbHRlci1tZW51LWJ1dHRvbiBzdmcgewogIGZpbGw6IGN1cnJlbnRDb2xvciAhaW1wb3J0YW50OwogIGNvbG9yOiBjdXJyZW50Q29sb3IgIWltcG9ydGFudDsKfQoKLyogRHJvcGRvd25zIC8gU2VsZWN0cyAoTGlzdGFzIGRlIFBsYXRhZm9ybWFzKSAqLwpib2R5IC5zZWxlY3Quc2VsZWN0IHsKICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudCAhaW1wb3J0YW50OwogIGJveC1zaGFkb3c6IG5vbmUgIWltcG9ydGFudDsKICBib3JkZXI6IG5vbmUgIWltcG9ydGFudDsKfQoKYm9keSAuc2VsZWN0X19tYWluLnNlbGVjdF9fbWFpbiB7CiAgYmFja2dyb3VuZDogdmFyKC0tbWQtc3lzLWNvbG9yLXN1cmZhY2UtdmFyaWFudCkgIWltcG9ydGFudDsKICBib3JkZXItcmFkaXVzOiAxMDBweCAhaW1wb3J0YW50OwogIGJvcmRlcjogbm9uZSAhaW1wb3J0YW50Owp9CgovKiBGaWx0cm9zIGVtIENoZWNrYm94IChUcmFuc2Zvcm1hZG9zIGVtICJDaGlwcyIgZG8gTUQzKSAqLwpib2R5IC5jaGVja2JveC1idXR0b24uY2hlY2tib3gtYnV0dG9uIHsKICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1tZC1zeXMtY29sb3Itc3VyZmFjZS1jb250YWluZXIpICFpbXBvcnRhbnQ7CiAgYm9yZGVyOiAwcHggc29saWQgdmFyKC0tbWQtc3lzLWNvbG9yLXN1cmZhY2UtdmFyaWFudCkgIWltcG9ydGFudDsKICBib3JkZXItcmFkaXVzOiAxMDBweCAhaW1wb3J0YW50OwogIGJveC1zaGFkb3c6IG5vbmUgIWltcG9ydGFudDsKICBwYWRkaW5nOiAwIDE2cHggIWltcG9ydGFudDsKICBoZWlnaHQ6IGF1dG8gIWltcG9ydGFudDsKICBtaW4taGVpZ2h0OiA0MHB4ICFpbXBvcnRhbnQ7CiAgZGlzcGxheTogZmxleCAhaW1wb3J0YW50OwogIGFsaWduLWl0ZW1zOiBjZW50ZXIgIWltcG9ydGFudDsKfQoKYm9keSAuY2hlY2tib3gtYnV0dG9uLmFjdGl2ZS5jaGVja2JveC1idXR0b24gewogIGJhY2tncm91bmQ6IHZhcigtLW1kLXN5cy1jb2xvci1wcmltYXJ5LWNvbnRhaW5lcikgIWltcG9ydGFudDsKICBib3JkZXItY29sb3I6IHRyYW5zcGFyZW50ICFpbXBvcnRhbnQ7Cn0KCmJvZHkgLmNoZWNrYm94X19jaGVja21hcmsgewogIGRpc3BsYXk6IG5vbmUgIWltcG9ydGFudDsKICAvKiBFc2NvbmRlIG8gcXVhZHJhZG8gbmF0aXZvIGRvIGNoZWNrYm94ICovCn0KCmJvZHkgLmNoZWNrYm94X19sYWJlbCB7CiAgcGFkZGluZy1sZWZ0OiAwICFpbXBvcnRhbnQ7CiAgY29sb3I6IHZhcigtLW1kLXN5cy1jb2xvci1vbi1iYWNrZ3JvdW5kKSAhaW1wb3J0YW50OwogIGZvbnQtd2VpZ2h0OiA1MDAgIWltcG9ydGFudDsKfQoKYm9keSAuY2hlY2tib3gtYnV0dG9uLmFjdGl2ZS5jaGVja2JveC1idXR0b24gLmNoZWNrYm94X19sYWJlbCB7CiAgY29sb3I6IHZhcigtLW1kLXN5cy1jb2xvci1vbi1wcmltYXJ5LWNvbnRhaW5lcikgIWltcG9ydGFudDsKfQoKLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PQogICA1LiBDQVJUw5VFUyBERSBKT0dPUyBFIEdBTEVSSUEKICAgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqLwovKiBMaW1wYSBmdW5kb3MgZSBib3JkYXMgb3JpZ2luYWlzIGRhcyBjYXBhcyBkb3Mgam9nb3MgKi8KYm9keSAuc3RvcmUtaXRlbV9faW1hZ2UsCmJvZHkgLnN0b3JlLWl0ZW1fX292ZXJsYXksCmJvZHkgLnN0b3JlLWl0ZW1fX2luc3RhbGwtc2hvd2Nhc2UgewogIGJhY2tncm91bmQ6IHZhcigtLW1kLXN5cy1jb2xvci1zdXJmYWNlLWNvbnRhaW5lcikgIWltcG9ydGFudDsKICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1tZC1zeXMtY29sb3Itc3VyZmFjZS1jb250YWluZXIpICFpbXBvcnRhbnQ7CiAgYmFja2dyb3VuZC1pbWFnZTogbm9uZSAhaW1wb3J0YW50OwogIGJvcmRlci1yYWRpdXM6IDAgIWltcG9ydGFudDsKICBib3gtc2hhZG93OiBub25lICFpbXBvcnRhbnQ7CiAgYm9yZGVyOiBub25lICFpbXBvcnRhbnQ7Cn0KCi8qIEFwbGljYSBhIGJvcmRhIGVzcGVzc2EgZSBjYW50b3MgYXJyZWRvbmRhZG9zIG5vIGNhcnTDo28gcHJpbmNpcGFsIGRvIGpvZ28gKi8KYm9keSAuc3RvcmUtaXRlbV9fc3VyZmFjZSB7CiAgYmFja2dyb3VuZDogdmFyKC0tbWQtc3lzLWNvbG9yLXN1cmZhY2UtY29udGFpbmVyKSAhaW1wb3J0YW50OwogIGJvcmRlcjogM3B4IHNvbGlkIHZhcigtLW1kLXN5cy1jb2xvci1zdXJmYWNlLXZhcmlhbnQpICFpbXBvcnRhbnQ7CiAgYm9yZGVyLXJhZGl1czogMjRweCAhaW1wb3J0YW50OwogIG92ZXJmbG93OiBoaWRkZW4gIWltcG9ydGFudDsKfQoKLyogRXN0aWxvIGVtIGZvcm1hdG8gZGUgcMOtbHVsYSBwYXJhIGl0ZW5zIGRhIHZpc3VhbGl6YcOnw6NvIG1vYmlsZSAqLwouc3RvcmUtaXRlbV9fbW9iaWxlIHsKICBib3JkZXItcmFkaXVzOiAxMDBweCAhaW1wb3J0YW50Owp9CgovKiBSZW1vdmUgYXJ0ZWZhdG9zIGUgYm90w7VlcyByZWR1bmRhbnRlcyBwb3IgY2ltYSBkYXMgY2FwYXMgKi8KYm9keSAuc3RvcmUtaXRlbV9faW5zdGFsbC1zaG93Y2FzZTo6YmVmb3JlLApib2R5IC5zdG9yZS1pdGVtX19pbnN0YWxsLXNob3djYXNlOjphZnRlciwKYm9keSAuc3RvcmUtaXRlbV9fbW9iaWxlLWxpbmtzLApib2R5IC5pdGVtLWdhbWUtaW4tLWFkZCAuc3RvcmUtaXRlbV9fc3VyZmFjZTo6YmVmb3JlIHsKICBkaXNwbGF5OiBub25lICFpbXBvcnRhbnQ7Cn0KCi8qIEFuaW1hw6fDo28gc3VhdmUgZGUgZmx1dHVhw6fDo28gYW8gcGFzc2FyIG8gbW91c2Ugb3UgdG9jYXIgKi8KYm9keSAuc3RvcmUtaXRlbS5zdG9yZS1pdGVtIHsKICB0cmFuc2l0aW9uOiB0cmFuc2Zvcm0gMC4ycyBlYXNlICFpbXBvcnRhbnQ7Cn0KCmJvZHkgLnN0b3JlLWl0ZW06aG92ZXIgLnN0b3JlLWl0ZW1fX3N1cmZhY2UsCmJvZHkgLnN0b3JlLWl0ZW0uc3RvcmUtaXRlbS0taG92ZXJlZCAuc3RvcmUtaXRlbV9fc3VyZmFjZSB7CiAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC00cHgpICFpbXBvcnRhbnQ7CiAgYm94LXNoYWRvdzogMCA4cHggMTZweCByZ2JhKDAsIDAsIDAsIDAuNCkgIWltcG9ydGFudDsKICBiYWNrZ3JvdW5kOiB2YXIoLS1tZC1zeXMtY29sb3Itc3VyZmFjZS1jb250YWluZXItaGlnaCkgIWltcG9ydGFudDsKICBiYWNrZ3JvdW5kLWltYWdlOiBub25lICFpbXBvcnRhbnQ7Cn0KCi8qIEVzY3VyZWNlIGEgaW1hZ2VtIHBhcmEgZGFyIGNvbnRyYXN0ZSBhbyB0w610dWxvIHF1YW5kbyB0b2NhZG8gKi8KYm9keSAuc3RvcmUtaXRlbV9fb3ZlcmxheSB7CiAgYmFja2dyb3VuZDogcmdiYSgyOCwgMjcsIDMxLCAwLjUpICFpbXBvcnRhbnQ7Cn0KCmJvZHkgLnN0b3JlLWl0ZW06aG92ZXIgLnN0b3JlLWl0ZW1fX292ZXJsYXkgewogIGJhY2tncm91bmQ6IHJnYmEoMjgsIDI3LCAzMSwgMC44NSkgIWltcG9ydGFudDsKfQoKLyogVMOtdHVsb3MgZG9zIGpvZ29zIG1haXMgbGVnw612ZWlzIGUgc2VtIHNvbWJyYXMgY2Fmb25hcyAqLwpib2R5IC5pdGVtLWdhbWUtaW5fX2NvbnRlbnQgaDQgewogIGNvbG9yOiB2YXIoLS1tZC1zeXMtY29sb3Itb24tYmFja2dyb3VuZCkgIWltcG9ydGFudDsKICBmb250LXdlaWdodDogNjAwICFpbXBvcnRhbnQ7CiAgdGV4dC1zaGFkb3c6IG5vbmUgIWltcG9ydGFudDsKfQoKLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PQogICA2LiBCQURHRVMsIEVUSVFVRVRBUyBFIFBMQVRBRk9STUFTCiAgID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi8KLyogUGFkcm9uaXphIGFzIGV0aXF1ZXRhcyBkZSAiTm92byIsICJTdGVhbSIsICJFcGljIiBjb20gdmlzdWFsIHDDrWx1bGEgZSBjb3IgbmV1dHJhICovCmJvZHkgLmFwcC1iYWRnZSwKYm9keSAuc3RvcmUtaXRlbV9fbmV3LWxhYmVsLApib2R5IC5ob3BwZXJfX2JhZGdlLApib2R5IC5zdG9yZS1pdGVtX19wbGF0Zm9ybSwKYm9keSAuYnV0dG9uLXVuZGVyLmJ1dHRvbi11bmRlciB7CiAgYmFja2dyb3VuZDogdmFyKC0tbWQtc3lzLWNvbG9yLXN1cmZhY2UtdmFyaWFudCkgIWltcG9ydGFudDsKICBiYWNrZ3JvdW5kLWltYWdlOiBub25lICFpbXBvcnRhbnQ7CiAgY29sb3I6IHZhcigtLW1kLXN5cy1jb2xvci1vbi1iYWNrZ3JvdW5kKSAhaW1wb3J0YW50OwogIGJvcmRlcjogbm9uZSAhaW1wb3J0YW50OwogIGJvcmRlci1yYWRpdXM6IDEwMHB4ICFpbXBvcnRhbnQ7Cn0KCmJvZHkgLmFwcC1iYWRnZSAuYXBwLWJhZGdlX190ZXh0IHsKICBjb2xvcjogdmFyKC0tbWQtc3lzLWNvbG9yLW9uLWJhY2tncm91bmQpICFpbXBvcnRhbnQ7Cn0KCi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0KICAgNy4gTElNUEVaQSBERSBJTlRFUkZBQ0UgKFJFTU/Dh8ODTyBERSBCQU5ORVJTIEUgUE9MVUnDh8ODTykKICAgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqLwovKiBPY3VsdGEgb3MgIlVwc3Ryb25hdXRzIiAoTWFzb3RlcyksIFByb21vw6fDtWVzIGUgU2Vsb3MgZGUgRGVzY29udG8gKi8KY2xvdWQtaG9wcGVyLWl0ZW0sCi5ob3BwZXItaXRlbSwKLmhvcHBlciwKYm9keSBjYXJkLXByb21vLApib2R5IC5zdG9yZS1pdGVtX19wcm9tbywKYm9keSAuc3RvcmUtaXRlbV9fcHJvbW8tdGV4dCwKYm9keSAuc3RvcmUtaXRlbV9fZGlzY291bnRzIHsKICBkaXNwbGF5OiBub25lICFpbXBvcnRhbnQ7CiAgb3BhY2l0eTogMCAhaW1wb3J0YW50OwogIHBvaW50ZXItZXZlbnRzOiBub25lICFpbXBvcnRhbnQ7CiAgd2lkdGg6IDAgIWltcG9ydGFudDsKICBoZWlnaHQ6IDAgIWltcG9ydGFudDsKICBtYXJnaW46IDAgIWltcG9ydGFudDsKICBwYWRkaW5nOiAwICFpbXBvcnRhbnQ7CiAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQgIWltcG9ydGFudDsKICBiYWNrZ3JvdW5kLWltYWdlOiBub25lICFpbXBvcnRhbnQ7Cn0KCi8qIE9jdWx0YSBCb3TDo28gZG8gU3Vwb3J0ZSAoQ2FudG8gZGEgdGVsYSkgKi8KI2JvdGJ1dHRvbiB7CiAgZGlzcGxheTogbm9uZSAhaW1wb3J0YW50Owp9CgovKiBPY3VsdGEgQXZpc28gRmx1dHVhbnRlIGRlIENvb2tpZXMgKENvb2tpZVllcykgKi8KLmNreS1idG4tcmV2aXNpdC13cmFwcGVyLAouY2t5LXJldmlzaXQtYm90dG9tLWxlZnQgewogIGRpc3BsYXk6IG5vbmUgIWltcG9ydGFudDsKfQoKLyogT2N1bHRhIEJhcnJhIFN1cGVyaW9yIGluc2lzdGluZG8gcGFyYSBiYWl4YXIgbyBhcHAgbmF0aXZvICovCi5kb3dubG9hZF9fYXBwIHsKICBkaXNwbGF5OiBub25lICFpbXBvcnRhbnQ7Cn0KCi8qIExpbXBhIGVmZWl0b3MgZSBwYXJ0w61jdWxhcyBkZSBuZW9uIGRvIGJvdMOjbyAiTWFnaWMiICovCmJvZHkgLm1hZ2ljLWJ1dHRvbi5tYWdpYy1idXR0b24gewogIGJhY2tncm91bmQ6IHZhcigtLW1kLXN5cy1jb2xvci1wcmltYXJ5KSAhaW1wb3J0YW50OwogIGNvbG9yOiB2YXIoLS1tZC1zeXMtY29sb3Itb24tcHJpbWFyeSkgIWltcG9ydGFudDsKICBib3JkZXItcmFkaXVzOiAxMDBweCAhaW1wb3J0YW50OwogIGJveC1zaGFkb3c6IG5vbmUgIWltcG9ydGFudDsKfQoKYm9keSAubWFnaWMtYnV0dG9uX19nbG93LApib2R5IC5tYWdpYy1idXR0b25fX2ZpbGwsCmJvZHkgLm1hZ2ljLWJ1dHRvbl9fc2hpbW1lciwKYm9keSAubWFnaWMtYnV0dG9uX19yaW5nLApib2R5IC5tYWdpYy1idXR0b25fX3NwYXJrcyB7CiAgZGlzcGxheTogbm9uZSAhaW1wb3J0YW50Owp9CgovKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09CiAgIDguIENPTlRST0xFUyBERSBIT1ZFUiBOT1MgQ0FSVMOVRVMgKEpPR0FSIEUgUkVNT1ZFUikKICAgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqLwovKiBBanVzdGEgYSBiYXJyYSBkZSBib3TDtWVzIGZsdXR1YW50ZXMgcGFyYSBuw6NvIGVuY29zdGFyIG5hcyBib3JkYXMgZG8gY2FydMOjbyAqLwpib2R5IC5zdG9yZS1pdGVtX19idXR0b25zLnN0b3JlLWl0ZW1fX2J1dHRvbnMgewogIGJvdHRvbTogMTZweCAhaW1wb3J0YW50OwogIHBhZGRpbmc6IDAgMTZweCAhaW1wb3J0YW50OwogIGdhcDogOHB4ICFpbXBvcnRhbnQ7CiAganVzdGlmeS1jb250ZW50OiBjZW50ZXIgIWltcG9ydGFudDsKICBmbGV4LXdyYXA6IG5vd3JhcCAhaW1wb3J0YW50OwogIHdpZHRoOiAxMDAlICFpbXBvcnRhbnQ7CiAgYm94LXNpemluZzogYm9yZGVyLWJveCAhaW1wb3J0YW50Owp9CgovKiBGb3LDp2EgbyBCb3TDo28gZGUgSm9nYXIgYSBvY3VwYXIgbyBlc3Bhw6dvIHJlc3RhbnRlIChGbGV4IEdyb3cpICovCmJvZHkgLnN0b3JlLWl0ZW1fX2NvbnRyb2wtYnV0dG9uLS1wbGF5LnN0b3JlLWl0ZW1fX2NvbnRyb2wtYnV0dG9uLS1wbGF5IHsKICBmbGV4LWdyb3c6IDEgIWltcG9ydGFudDsKICBtYXJnaW46IDAgIWltcG9ydGFudDsKICB3aWR0aDogYXV0byAhaW1wb3J0YW50Owp9CgovKiBGb3JtYXRhIG8gQm90w6NvIGRlIFJlbW92ZXIgZGEgQmlibGlvdGVjYSBwYXJhIHNlciB1bSBjw61yY3VsbyBwZXJmZWl0byAqLwpib2R5IC5zdG9yZS1pdGVtX19jb250cm9sLWJ1dHRvbi0tc2Vjb25kYXJ5LnN0b3JlLWl0ZW1fX2NvbnRyb2wtYnV0dG9uLS1zZWNvbmRhcnkgewogIGZsZXg6IDAgMCA0MHB4ICFpbXBvcnRhbnQ7CiAgd2lkdGg6IDQwcHggIWltcG9ydGFudDsKICBoZWlnaHQ6IDQwcHggIWltcG9ydGFudDsKICBtYXJnaW46IDAgIWltcG9ydGFudDsKfQoKLyogSW5qZcOnw6NvIGRlIMONY29uZSBkZSBMaXhlaXJhIG5vIGJvdMOjbyBkZSByZW1vdmVyLCBvY3VsdGFuZG8gbyBoaWZlbiAoLSkgb3JpZ2luYWwgKi8KYm9keSAuc3RvcmUtaXRlbV9fY29udHJvbC1idXR0b24tLXNlY29uZGFyeSAuc2Vjb25kYXJ5LWJ1dHRvbiB7CiAgYmFja2dyb3VuZDogdmFyKC0tbWQtc3lzLWNvbG9yLXN1cmZhY2UtdmFyaWFudCkgIWltcG9ydGFudDsKICBjb2xvcjogdHJhbnNwYXJlbnQgIWltcG9ydGFudDsKICBib3JkZXI6IG5vbmUgIWltcG9ydGFudDsKICBib3JkZXItcmFkaXVzOiAxMDBweCAhaW1wb3J0YW50OwogIHdpZHRoOiAxMDAlICFpbXBvcnRhbnQ7CiAgaGVpZ2h0OiAxMDAlICFpbXBvcnRhbnQ7CiAgcGFkZGluZzogMCAhaW1wb3J0YW50OwogIHBvc2l0aW9uOiByZWxhdGl2ZSAhaW1wb3J0YW50OwogIGJveC1zaGFkb3c6IG5vbmUgIWltcG9ydGFudDsKICB0cmFuc2l0aW9uOiBiYWNrZ3JvdW5kIDAuMnMgZWFzZSAhaW1wb3J0YW50Owp9Cgpib2R5IC5zdG9yZS1pdGVtX19jb250cm9sLWJ1dHRvbi0tc2Vjb25kYXJ5IC5zZWNvbmRhcnktYnV0dG9uOmhvdmVyIHsKICBiYWNrZ3JvdW5kOiB2YXIoLS1tZC1zeXMtY29sb3Itb3V0bGluZSkgIWltcG9ydGFudDsKfQoKYm9keSAuc3RvcmUtaXRlbV9fY29udHJvbC1idXR0b24tLXNlY29uZGFyeSAuc2Vjb25kYXJ5LWJ1dHRvbjo6YWZ0ZXIgewogIGNvbnRlbnQ6ICIiICFpbXBvcnRhbnQ7CiAgcG9zaXRpb246IGFic29sdXRlICFpbXBvcnRhbnQ7CiAgaW5zZXQ6IDAgIWltcG9ydGFudDsKICBtYXJnaW46IGF1dG8gIWltcG9ydGFudDsKICB3aWR0aDogMjBweCAhaW1wb3J0YW50OwogIGhlaWdodDogMjBweCAhaW1wb3J0YW50OwogIGJhY2tncm91bmQtY29sb3I6IHZhcigtLW1kLXN5cy1jb2xvci1vbi1iYWNrZ3JvdW5kKSAhaW1wb3J0YW50OwogIC13ZWJraXQtbWFzazogdXJsKCJkYXRhOmltYWdlL3N2Zyt4bWwsJTNDc3ZnIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zycgdmlld0JveD0nMCAwIDI0IDI0JyUzRSUzQ3BhdGggZD0nTTYgMTljMCAxLjEuOSAyIDIgMmg4YzEuMSAwIDItLjkgMi0yVjdINnYxMnpNMTkgNGgtMy41bC0xLTFoLTVsLTEgMUg1djJoMTRWNHonLyUzRSUzQy9zdmclM0UiKSBuby1yZXBlYXQgY2VudGVyIC8gY29udGFpbiAhaW1wb3J0YW50OwogIG1hc2s6IHVybCgiZGF0YTppbWFnZS9zdmcreG1sLCUzQ3N2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCAyNCAyNCclM0UlM0NwYXRoIGQ9J002IDE5YzAgMS4xLjkgMiAyIDJoOGMxLjEgMCAyLS45IDItMlY3SDZ2MTJ6TTE5IDRoLTMuNWwtMS0xaC01bC0xIDFINXYyaDE0VjR6Jy8lM0UlM0Mvc3ZnJTNFIikgbm8tcmVwZWF0IGNlbnRlciAvIGNvbnRhaW4gIWltcG9ydGFudDsKICBkaXNwbGF5OiBibG9jayAhaW1wb3J0YW50Owp9CgovKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09CiAgIDkuIE9WRVJMQVlTIE5BVElWT1MgREEgU0VTU8ODTyBERSBKT0dPCiAgID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi8KLyogT2N1bHRhIG9zIGJvdMO1ZXMgbW9iaWxlIGRvIHByw7NwcmlvIEJvb3N0ZXJvaWQsIGxpYmVyYW5kbyBhIHRlbGEgcGFyYSBub3NzbyBHYW1lcGFkIFZpcnR1YWwgKi8KI21lbnUubV9tZW51X3dyYXBwZXIgewogIG9wYWNpdHk6IDAgIWltcG9ydGFudDsKICBwb2ludGVyLWV2ZW50czogbm9uZSAhaW1wb3J0YW50OwogIHRyYW5zZm9ybTogc2NhbGUoMCkgIWltcG9ydGFudDsKICB6LWluZGV4OiAtOTk5OSAhaW1wb3J0YW50Owp9CgovKiBPY3VsdGEgYWxlcnRhcyBuYXRpdm9zICgiVG9xdWUgbmEgdGVsYSIsICJBdmlzbyBkZSByZWRlIGZyYWNhIikgcXVlIHBvbHVlbSBhIFVJIGR1cmFudGUgbyBqb2dvICovCi5pcGhvbmVfdGFwX21lc3NhZ2UsCi5tX2xhbl93cmFwcGVyIHsKICBkaXNwbGF5OiBub25lICFpbXBvcnRhbnQ7Cn0KCi8qIFJlbW92ZSBhIHByb3ByaWVkYWRlIHN0aWNreSAocXVlIGNhdXNhIGJ1Z3MgdmlzdWFpcyBubyB0b3BvKSBkYSBiYXJyYSBkZSBmaWx0cm8gbmF0aXZhICovCmZpbHRlci1jb250cm9sbGVyLXdpZGdldC5lbGVtZW50LXN0aWNreSB7CiAgcG9zaXRpb246IHN0YXRpYyAhaW1wb3J0YW50Owp9LyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0KICAgVEVNQSBNQVRFUklBTCBZT1UgKE1EMykgLSBQw4FHSU5BIERFIFBFUkZJTCBFIENPTkZJR1VSQcOHw5VFUwogICBEZXNjcmnDp8OjbzogRXN0aWxpemHDp8OjbyBwcmVtaXVtIGUgY29ycmXDp8OjbyByZXNwb25zaXZhIGRlIHRvZGFzIGFzIGNvbnRhcyBlIGFqdXN0ZXMuCiAgID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovCgovKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09CiAgIDEuIExBWU9VVCBHRVJBTCBFIE5BVkVHQcOHw4NPIFJFU1BPTlNJVkEgKFNJREVCQVIpCiAgID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi8KYm9keSAucHJvZmlsZSAud3JhcHBlciB7CiAgZGlzcGxheTogZmxleCAhaW1wb3J0YW50OwogIG1heC13aWR0aDogMTAwJSAhaW1wb3J0YW50OwogIHBhZGRpbmc6IDAgIWltcG9ydGFudDsKICBnYXA6IDI0cHggIWltcG9ydGFudDsKICBib3gtc2l6aW5nOiBib3JkZXItYm94ICFpbXBvcnRhbnQ7Cn0KCmJvZHkgLmFjY291bnRfX2hlYWRpbmcgewogIGNvbG9yOiB2YXIoLS1tZC1zeXMtY29sb3Itb24tYmFja2dyb3VuZCkgIWltcG9ydGFudDsKICBmb250LXNpemU6IDI4cHggIWltcG9ydGFudDsKICBwYWRkaW5nOiAyNHB4IDEycHggMTZweCAxMnB4ICFpbXBvcnRhbnQ7CiAgZm9udC13ZWlnaHQ6IDcwMCAhaW1wb3J0YW50OwogIG1hcmdpbjogMCAhaW1wb3J0YW50OwogIGxldHRlci1zcGFjaW5nOiAtMC41cHggIWltcG9ydGFudDsKfQoKLyogTmF2ZWdhw6fDo28gSG9yaXpvbnRhbCBNb2JpbGUgKi8KQG1lZGlhIChtYXgtd2lkdGg6IDkwMHB4KSB7CiAgYm9keSAucHJvZmlsZSAud3JhcHBlciB7CiAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uICFpbXBvcnRhbnQ7CiAgICBnYXA6IDAgIWltcG9ydGFudDsKICB9CgogIGJvZHkgc2lkZWJhciB7CiAgICB3aWR0aDogMTAwJSAhaW1wb3J0YW50OwogICAgaGVpZ2h0OiBhdXRvICFpbXBvcnRhbnQ7CiAgICBwb3NpdGlvbjogc3RpY2t5ICFpbXBvcnRhbnQ7CiAgICB0b3A6IDAgIWltcG9ydGFudDsKICAgIHotaW5kZXg6IDEwMCAhaW1wb3J0YW50OwogICAgYmFja2dyb3VuZDogdmFyKC0tbWQtc3lzLWNvbG9yLWJhY2tncm91bmQpICFpbXBvcnRhbnQ7CiAgICBib3JkZXItYm90dG9tOiAxcHggc29saWQgdmFyKC0tbWQtc3lzLWNvbG9yLXN1cmZhY2UtdmFyaWFudCkgIWltcG9ydGFudDsKICB9CgogIGJvZHkgLnByb2ZpbGVfX25hdmlnYXRpb24gewogICAgd2lkdGg6IDEwMCUgIWltcG9ydGFudDsKICAgIHBhZGRpbmc6IDAgIWltcG9ydGFudDsKICB9CgogIGJvZHkgLnByb2ZpbGVfX25hdmlnYXRpb24tZ3JhZGllbnQgewogICAgZGlzcGxheTogbm9uZSAhaW1wb3J0YW50OwogIH0KCiAgYm9keSAucHJvZmlsZV9fbWFpbi1tZW51IHsKICAgIGRpc3BsYXk6IGZsZXggIWltcG9ydGFudDsKICAgIGZsZXgtZGlyZWN0aW9uOiByb3cgIWltcG9ydGFudDsKICAgIGp1c3RpZnktY29udGVudDogZmxleC1zdGFydCAhaW1wb3J0YW50OwogICAgb3ZlcmZsb3cteDogYXV0byAhaW1wb3J0YW50OwogICAgZ2FwOiA4cHggIWltcG9ydGFudDsKICAgIHBhZGRpbmc6IDEycHggMTZweCAhaW1wb3J0YW50OwogICAgbWFyZ2luOiAwICFpbXBvcnRhbnQ7CiAgICAtd2Via2l0LW92ZXJmbG93LXNjcm9sbGluZzogdG91Y2ggIWltcG9ydGFudDsKICB9CgogIGJvZHkgLnByb2ZpbGVfX21haW4tbWVudSBsaSB7CiAgICBmbGV4OiAwIDAgYXV0byAhaW1wb3J0YW50OwogICAgd2lkdGg6IGF1dG8gIWltcG9ydGFudDsKICAgIG1hcmdpbjogMCAhaW1wb3J0YW50OwogIH0KCiAgYm9keSAucHJvZmlsZV9fbWFpbi1tZW51IGEgewogICAgZGlzcGxheTogZmxleCAhaW1wb3J0YW50OwogICAgYWxpZ24taXRlbXM6IGNlbnRlciAhaW1wb3J0YW50OwogICAgcGFkZGluZzogOHB4IDE2cHggIWltcG9ydGFudDsKICAgIGJvcmRlci1yYWRpdXM6IDEwMHB4ICFpbXBvcnRhbnQ7CiAgICBiYWNrZ3JvdW5kOiB2YXIoLS1tZC1zeXMtY29sb3Itc3VyZmFjZS1jb250YWluZXIpICFpbXBvcnRhbnQ7CiAgICBjb2xvcjogdmFyKC0tbWQtc3lzLWNvbG9yLW9uLWJhY2tncm91bmQpICFpbXBvcnRhbnQ7CiAgICB3aGl0ZS1zcGFjZTogbm93cmFwICFpbXBvcnRhbnQ7CiAgICBmb250LXdlaWdodDogNTAwICFpbXBvcnRhbnQ7CiAgfQoKICBib2R5IC5wcm9maWxlX19tYWluLW1lbnUgYS5hY3RpdmUgewogICAgYmFja2dyb3VuZDogdmFyKC0tbWQtc3lzLWNvbG9yLXByaW1hcnktY29udGFpbmVyKSAhaW1wb3J0YW50OwogICAgY29sb3I6IHZhcigtLW1kLXN5cy1jb2xvci1vbi1wcmltYXJ5LWNvbnRhaW5lcikgIWltcG9ydGFudDsKICB9CgogIGJvZHkgLnByb2ZpbGVfX21haW4tbWVudSBhIHN2ZyB7CiAgICBtYXJnaW4tYm90dG9tOiAwICFpbXBvcnRhbnQ7CiAgICBtYXJnaW4tcmlnaHQ6IDhweCAhaW1wb3J0YW50OwogIH0KCiAgYm9keSAucHJvZmlsZV9fbWFpbi1tZW51IGEuYWN0aXZlIHN2ZyBwYXRoLAogIGJvZHkgLnByb2ZpbGVfX21haW4tbWVudSBhLmFjdGl2ZSBzdmcgZWxsaXBzZSwKICBib2R5IC5wcm9maWxlX19tYWluLW1lbnUgYS5hY3RpdmUgc3ZnIHJlY3QgewogICAgZmlsbDogdmFyKC0tbWQtc3lzLWNvbG9yLW9uLXByaW1hcnktY29udGFpbmVyKSAhaW1wb3J0YW50OwogIH0KfQoKLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PQogICAyLiBQQURST05JWkHDh8ODTyBERSBDQVJEUyBFIENPTlRBSU5FUlMgKE1EMykKICAgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqLwpib2R5IC5hY2NvdW50X19jb250ZW50LApib2R5IC5hY2NvdW50LWNvbnRlbnRfX3dyYXAgewogIG1heC13aWR0aDogMTAwJSAhaW1wb3J0YW50OwogIHBhZGRpbmc6IDAgOHB4ICFpbXBvcnRhbnQ7CiAgYm94LXNpemluZzogYm9yZGVyLWJveCAhaW1wb3J0YW50Owp9Cgpib2R5IC5jb250ZW50LWJveF9fY2FyZCwKYm9keSAuc3luYy1wbGF0Zm9ybSwKYm9keSAuaG90a2V5LXNldHRpbmcsCmJvZHkgLmFjY291bnQtZGlzY29yZCwKYm9keSAuZ3VpZGUtY2FyZCB7CiAgYmFja2dyb3VuZDogdmFyKC0tbWQtc3lzLWNvbG9yLXN1cmZhY2UtY29udGFpbmVyKSAhaW1wb3J0YW50OwogIGJvcmRlci1yYWRpdXM6IDI0cHggIWltcG9ydGFudDsKICBib3JkZXI6IG5vbmUgIWltcG9ydGFudDsKICBib3gtc2hhZG93OiBub25lICFpbXBvcnRhbnQ7CiAgcGFkZGluZzogMjBweCAhaW1wb3J0YW50OwogIG1hcmdpbi1ib3R0b206IDE2cHggIWltcG9ydGFudDsKICBib3gtc2l6aW5nOiBib3JkZXItYm94ICFpbXBvcnRhbnQ7Cn0KCi8qIFJlbW92ZSBlc3RpbG9zIGRlIGNvbnRhaW5lcnMgcGFyYSBldml0YXIgZHVwbG8gcGFkZGluZyAqLwpib2R5IC5jb25uZWN0LWFjY291bnRfX2NhcmQsCmJvZHkgLmd1aWRlLWlubmVyIHsKICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudCAhaW1wb3J0YW50OwogIHBhZGRpbmc6IDAgIWltcG9ydGFudDsKICBtYXJnaW46IDAgIWltcG9ydGFudDsKICBib3gtc2hhZG93OiBub25lICFpbXBvcnRhbnQ7Cn0KCi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0KICAgMy4gQ0FCRcOHQUxIT1MsIFTDjVRVTE9TIEUgQk9Uw5VFUyBERSBBw4fDg08gKEVESVRBUiBQRVJGSUwpCiAgID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi8KYm9keSAuY29udGVudC1ib3hfX2hlYWQgewogIGRpc3BsYXk6IGZsZXggIWltcG9ydGFudDsKICBmbGV4LWRpcmVjdGlvbjogcm93LXJldmVyc2UgIWltcG9ydGFudDsKICBmbGV4LXdyYXA6IHdyYXAgIWltcG9ydGFudDsKICBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtZW5kICFpbXBvcnRhbnQ7CiAgYWxpZ24taXRlbXM6IGNlbnRlciAhaW1wb3J0YW50OwogIGdhcDogMTZweCAhaW1wb3J0YW50OwogIG1hcmdpbi1ib3R0b206IDE2cHggIWltcG9ydGFudDsKICB3aWR0aDogMTAwJSAhaW1wb3J0YW50Owp9Cgpib2R5IC5jb250ZW50LWJveF9faGVhZC1pbmZvIHsKICBkaXNwbGF5OiBmbGV4ICFpbXBvcnRhbnQ7CiAgYWxpZ24taXRlbXM6IGNlbnRlciAhaW1wb3J0YW50OwogIGZsZXgtd3JhcDogd3JhcCAhaW1wb3J0YW50OwogIGdhcDogMTJweCAhaW1wb3J0YW50OwogIGZsZXgtZ3JvdzogMSAhaW1wb3J0YW50Owp9Cgpib2R5IC5jb250ZW50LWJveF9faGVhZC1jb250cm9scyB7CiAgZGlzcGxheTogZmxleCAhaW1wb3J0YW50OwogIGZsZXgtd3JhcDogd3JhcCAhaW1wb3J0YW50OwogIGdhcDogMTJweCAhaW1wb3J0YW50Owp9Cgpib2R5IC5jb250ZW50LWJveF9faGVhZC10aXRsZSwKYm9keSAuc3luYy1wbGF0Zm9ybV9fdGl0bGUsCmJvZHkgLmFjY291bnQtY29udGVudF9fZGlzY29yZC10aXRsZSB7CiAgY29sb3I6IHZhcigtLW1kLXN5cy1jb2xvci1wcmltYXJ5KSAhaW1wb3J0YW50OwogIGZvbnQtd2VpZ2h0OiA2MDAgIWltcG9ydGFudDsKICBmb250LXNpemU6IDEzcHggIWltcG9ydGFudDsKICB0ZXh0LXRyYW5zZm9ybTogdXBwZXJjYXNlICFpbXBvcnRhbnQ7CiAgbGV0dGVyLXNwYWNpbmc6IDAuNXB4ICFpbXBvcnRhbnQ7CiAgbWFyZ2luLWJvdHRvbTogMCAhaW1wb3J0YW50Owp9Cgpib2R5IC5jb250ZW50LWJveF9fdGV4dCwKYm9keSAucHJvZmlsZS1kYXRhX19vdGhlci10ZXh0LApib2R5IC5ob3RrZXktc2V0dGluZ19fZGVzY3JpcHRpb24sCmJvZHkgLmNvbm5lY3QtYWNjb3VudF9faW5mby10ZXh0LApib2R5IC5zeW5jLXBsYXRmb3JtX190b3AtY2FwdGlvbiB7CiAgY29sb3I6IHZhcigtLW1kLXN5cy1jb2xvci1vdXRsaW5lKSAhaW1wb3J0YW50OwogIGZvbnQtc2l6ZTogMTNweCAhaW1wb3J0YW50OwogIGxpbmUtaGVpZ2h0OiAxLjUgIWltcG9ydGFudDsKfQoKYm9keSAuY29ubmVjdC1hY2NvdW50X190ZXh0LApib2R5IC5jb25uZWN0LWFjY291bnRfX2luZm8gewogIHBhZGRpbmc6IDAgOHB4ICFpbXBvcnRhbnQ7Cn0KCmJvZHkgLnByb2ZpbGUtZGF0YV9fbmFtZSwKYm9keSAuc3Vic2NyaXB0aW9uLWNhcmRfX3RpdGxlLApib2R5IC5zeW5jLXBsYXRmb3JtX191c2VybmFtZSBwIHsKICBjb2xvcjogdmFyKC0tbWQtc3lzLWNvbG9yLW9uLWJhY2tncm91bmQpICFpbXBvcnRhbnQ7CiAgZm9udC13ZWlnaHQ6IDYwMCAhaW1wb3J0YW50Owp9CgovKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09CiAgIDQuIFRPR0dMRVMgTUQzIEUgQkFER0VTCiAgID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi8KYm9keSBhcHAtc3dpdGNoZXIgewogIGRpc3BsYXk6IGlubGluZS1mbGV4ICFpbXBvcnRhbnQ7CiAgYWxpZ24taXRlbXM6IGNlbnRlciAhaW1wb3J0YW50OwogIGN1cnNvcjogcG9pbnRlciAhaW1wb3J0YW50Owp9Cgpib2R5IGFwcC1zd2l0Y2hlciBzdmcgewogIHdpZHRoOiA0NHB4ICFpbXBvcnRhbnQ7CiAgaGVpZ2h0OiAyNnB4ICFpbXBvcnRhbnQ7CiAgZGlzcGxheTogYmxvY2sgIWltcG9ydGFudDsKfQoKYm9keSBhcHAtc3dpdGNoZXIgc3ZnIHJlY3QsCmJvZHkgYXBwLXN3aXRjaGVyIHN2ZyBjaXJjbGUgewogIHRyYW5zaXRpb246IGFsbCAwLjNzIGN1YmljLWJlemllcigwLjIsIDAuOCwgMC4yLCAxKSAhaW1wb3J0YW50Owp9Cgpib2R5IGFwcC1zd2l0Y2hlciBzdmc6bm90KC5ub3QtYWN0aXZlKSByZWN0IHsKICBmaWxsOiB2YXIoLS1tZC1zeXMtY29sb3ItcHJpbWFyeSkgIWltcG9ydGFudDsKICBvcGFjaXR5OiAwLjQgIWltcG9ydGFudDsKfQoKYm9keSBhcHAtc3dpdGNoZXIgc3ZnOm5vdCgubm90LWFjdGl2ZSkgY2lyY2xlIHsKICBmaWxsOiB2YXIoLS1tZC1zeXMtY29sb3ItcHJpbWFyeSkgIWltcG9ydGFudDsKfQoKYm9keSBhcHAtc3dpdGNoZXIgc3ZnLm5vdC1hY3RpdmUgcmVjdCB7CiAgZmlsbDogdmFyKC0tbWQtc3lzLWNvbG9yLXN1cmZhY2UtdmFyaWFudCkgIWltcG9ydGFudDsKICBvcGFjaXR5OiAxICFpbXBvcnRhbnQ7Cn0KCmJvZHkgYXBwLXN3aXRjaGVyIHN2Zy5ub3QtYWN0aXZlIGNpcmNsZSB7CiAgZmlsbDogdmFyKC0tbWQtc3lzLWNvbG9yLW91dGxpbmUpICFpbXBvcnRhbnQ7Cn0KCmJvZHkgLnBsYXktcG9zc2liaWxpdHktLXRydWUgewogIGJhY2tncm91bmQ6ICMwRjUyMjMgIWltcG9ydGFudDsKICBjb2xvcjogIzZERDU4QyAhaW1wb3J0YW50OwogIHBhZGRpbmc6IDRweCAxMnB4ICFpbXBvcnRhbnQ7CiAgYm9yZGVyLXJhZGl1czogMTAwcHggIWltcG9ydGFudDsKICBmb250LXdlaWdodDogNzAwICFpbXBvcnRhbnQ7CiAgZm9udC1zaXplOiAxMXB4ICFpbXBvcnRhbnQ7CiAgbGV0dGVyLXNwYWNpbmc6IDAuNXB4ICFpbXBvcnRhbnQ7CiAgdGV4dC10cmFuc2Zvcm06IHVwcGVyY2FzZSAhaW1wb3J0YW50OwogIG1hcmdpbjogMCAhaW1wb3J0YW50Owp9CgovKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09CiAgIDUuIEEgTUlOSEEgU1VCU0NSScOHw4NPCiAgID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi8KYm9keSAuc3Vic2NyaXB0aW9uLWNhcmRfX2N1cnJlbnQgewogIGRpc3BsYXk6IGZsZXggIWltcG9ydGFudDsKICBmbGV4LWRpcmVjdGlvbjogY29sdW1uICFpbXBvcnRhbnQ7CiAgZ2FwOiAxNnB4ICFpbXBvcnRhbnQ7Cn0KCmJvZHkgLnN1YnNjcmlwdGlvbi1jYXJkX19oZWFkZXIgewogIGRpc3BsYXk6IGZsZXggIWltcG9ydGFudDsKICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW4gIWltcG9ydGFudDsKICBhbGlnbi1pdGVtczogZmxleC1zdGFydCAhaW1wb3J0YW50OwogIGZsZXgtd3JhcDogd3JhcCAhaW1wb3J0YW50OwogIGdhcDogMTJweCAhaW1wb3J0YW50Owp9Cgpib2R5IC5zdWJzY3JpcHRpb24tY2FyZF9fc3RhdHVzIHsKICBiYWNrZ3JvdW5kOiB2YXIoLS1tZC1zeXMtY29sb3Itc3VyZmFjZS12YXJpYW50KSAhaW1wb3J0YW50OwogIGNvbG9yOiB2YXIoLS1tZC1zeXMtY29sb3Itb24tYmFja2dyb3VuZCkgIWltcG9ydGFudDsKICBwYWRkaW5nOiA0cHggMTJweCAhaW1wb3J0YW50OwogIGJvcmRlci1yYWRpdXM6IDEwMHB4ICFpbXBvcnRhbnQ7CiAgZm9udC1zaXplOiAxMXB4ICFpbXBvcnRhbnQ7CiAgZm9udC13ZWlnaHQ6IDcwMCAhaW1wb3J0YW50OwogIGxldHRlci1zcGFjaW5nOiAwLjVweCAhaW1wb3J0YW50OwogIHRleHQtdHJhbnNmb3JtOiB1cHBlcmNhc2UgIWltcG9ydGFudDsKfQoKYm9keSAuc3Vic2NyaXB0aW9uLWNhcmRfX2Zvb3RlciB7CiAgZGlzcGxheTogZmxleCAhaW1wb3J0YW50OwogIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbiAhaW1wb3J0YW50OwogIGFsaWduLWl0ZW1zOiBjZW50ZXIgIWltcG9ydGFudDsKICBmbGV4LXdyYXA6IHdyYXAgIWltcG9ydGFudDsKICBnYXA6IDE2cHggIWltcG9ydGFudDsKICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudCAhaW1wb3J0YW50OwogIHBhZGRpbmc6IDAgIWltcG9ydGFudDsKICBib3JkZXI6IG5vbmUgIWltcG9ydGFudDsKfQoKLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PQogICA2LiBMSUdBw4fDlUVTIEUgU1RSRUFNSU5HIChCT1TDlUVTIEUgTElNUEVaQSBERSDDjUNPTkVTKQogICA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovCmJvZHkgLnN5bmMtcGxhdGZvcm0gewogIGRpc3BsYXk6IGZsZXggIWltcG9ydGFudDsKICBmbGV4LWRpcmVjdGlvbjogY29sdW1uICFpbXBvcnRhbnQ7CiAgZ2FwOiAxNnB4ICFpbXBvcnRhbnQ7Cn0KCmJvZHkgLnN5bmMtcGxhdGZvcm1fX2lubmVyIHsKICBwYWRkaW5nLWxlZnQ6IG5vbmUgIWltcG9ydGFudDsKICBwYWRkaW5nLXJpZ2h0OiBub25lICFpbXBvcnRhbnQ7CiAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQgIWltcG9ydGFudDsKICBib3gtc2hhZG93OiBub25lICFpbXBvcnRhbnQ7Cn0KCmJvZHkgLnN5bmMtcGxhdGZvcm1fX2JvZHksCmJvZHkgLmNvbnRlbnQtYm94X19mbGV4LWxpbmUgewogIGRpc3BsYXk6IGZsZXggIWltcG9ydGFudDsKICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW4gIWltcG9ydGFudDsKICBhbGlnbi1pdGVtczogY2VudGVyICFpbXBvcnRhbnQ7CiAgZmxleC13cmFwOiB3cmFwICFpbXBvcnRhbnQ7CiAgZ2FwOiAxNnB4ICFpbXBvcnRhbnQ7Cn0KCmJvZHkgLnN5bmMtcGxhdGZvcm1fX2xlZnQtc2lkZSB7CiAgZGlzcGxheTogZmxleCAhaW1wb3J0YW50OwogIGFsaWduLWl0ZW1zOiBjZW50ZXIgIWltcG9ydGFudDsKICBnYXA6IDEycHggIWltcG9ydGFudDsKfQoKLyogQm90w7VlcyBUb25hbCBNRDMgcGFkcm9uaXphZG9zICovCmJvZHkgLnN5bmMtcGxhdGZvcm1fX2J1dHRvbiwKYm9keSAuY29udGVudC1ib3hfX2NvbnRyb2wtYnRuLApib2R5IC5zdWJzY3JpcHRpb24tY2FyZF9faW5mby1idXR0b24sCmJvZHkgLmhvdGtleS1zZXR0aW5nX19yZXNldC1idG4gewogIGJhY2tncm91bmQ6IHZhcigtLW1kLXN5cy1jb2xvci1zdXJmYWNlLXZhcmlhbnQpICFpbXBvcnRhbnQ7CiAgY29sb3I6IHZhcigtLW1kLXN5cy1jb2xvci1vbi1iYWNrZ3JvdW5kKSAhaW1wb3J0YW50OwogIGJvcmRlci1yYWRpdXM6IDEwMHB4ICFpbXBvcnRhbnQ7CiAgcGFkZGluZzogMTBweCAyMHB4ICFpbXBvcnRhbnQ7CiAgZm9udC13ZWlnaHQ6IDYwMCAhaW1wb3J0YW50OwogIGZvbnQtc2l6ZTogMTNweCAhaW1wb3J0YW50OwogIGRpc3BsYXk6IGZsZXggIWltcG9ydGFudDsKICBhbGlnbi1pdGVtczogY2VudGVyICFpbXBvcnRhbnQ7CiAganVzdGlmeS1jb250ZW50OiBjZW50ZXIgIWltcG9ydGFudDsKICBnYXA6IDhweCAhaW1wb3J0YW50OwogIGJvcmRlcjogbm9uZSAhaW1wb3J0YW50OwogIGJveC1zaGFkb3c6IG5vbmUgIWltcG9ydGFudDsKICBoZWlnaHQ6IGF1dG8gIWltcG9ydGFudDsKICBtYXJnaW46IDAgIWltcG9ydGFudDsKICB3aWR0aDogbWF4LWNvbnRlbnQgIWltcG9ydGFudDsKICBmbGV4OiBub25lICFpbXBvcnRhbnQ7CiAgdGV4dC10cmFuc2Zvcm06IG5vbmUgIWltcG9ydGFudDsKfQoKYm9keSAuc3luYy1wbGF0Zm9ybV9fYnV0dG9ucyB7CiAgZGlzcGxheTogZmxleCAhaW1wb3J0YW50OwogIGdhcDogMTJweCAhaW1wb3J0YW50OwogIGZsZXgtd3JhcDogd3JhcCAhaW1wb3J0YW50OwogIGp1c3RpZnktY29udGVudDogZmxleC1lbmQgIWltcG9ydGFudDsKfQoKLyogVGV4dG8gZG9zIEJvdMO1ZXMgKi8KYm9keSAuc3luYy1wbGF0Zm9ybV9fYnV0dG9uIHAsCmJvZHkgLmNvbnRlbnQtYm94X19jb250cm9sLWJ0biBzcGFuIHsKICBjb2xvcjogdmFyKC0tbWQtc3lzLWNvbG9yLW9uLWJhY2tncm91bmQpICFpbXBvcnRhbnQ7CiAgbWFyZ2luOiAwICFpbXBvcnRhbnQ7CiAgdGV4dC10cmFuc2Zvcm06IGNhcGl0YWxpemUgIWltcG9ydGFudDsKfQoKLyogUkVNT8OHw4NPIFRPVEFMIERPUyDDjUNPTkVTIFJPU0FTL1FVRUJSQURPUyBOT1MgQk9Uw5VFUyBERSBBw4fDg08gKi8KYm9keSAuc3luYy1wbGF0Zm9ybV9fYnV0dG9uIGltZywKYm9keSAuc3luYy1wbGF0Zm9ybV9fYnV0dG9uIHN2Zy1pY29uLApib2R5IC5jb250ZW50LWJveF9fY29udHJvbHMtLXBiIC5jb250ZW50LWJveF9fY29udHJvbC1idG4gaW1nLApib2R5IC5jb250ZW50LWJveF9fY29udHJvbHMtLXBiIC5jb250ZW50LWJveF9fY29udHJvbC1idG4gc3ZnLWljb24gewogIGRpc3BsYXk6IG5vbmUgIWltcG9ydGFudDsKfQoKLyogTWFudMOpbSBvcyDDrWNvbmVzIGZ1bmNpb25haXMgKEVkaXRhciBQZXJmaWwsIEFsdGVyYXIgU2VuaGEpIGNvbSBhIGNvciBjb3JyZXRhICovCmJvZHkgLmNvbnRlbnQtYm94X19jb250cm9sLWJ0biBzdmcgcGF0aCB7CiAgZmlsbDogdmFyKC0tbWQtc3lzLWNvbG9yLW9uLWJhY2tncm91bmQpICFpbXBvcnRhbnQ7Cn0KCmJvZHkgLnN5bmMtcGxhdGZvcm1fX3RvcCB7CiAgZGlzcGxheTogZmxleCAhaW1wb3J0YW50OwogIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW4gIWltcG9ydGFudDsKICBnYXA6IDRweCAhaW1wb3J0YW50OwogIHBhZGRpbmctdG9wOiAxMnB4ICFpbXBvcnRhbnQ7CiAgYm9yZGVyLXRvcDogMXB4IHNvbGlkIHZhcigtLW1kLXN5cy1jb2xvci1zdXJmYWNlLXZhcmlhbnQpICFpbXBvcnRhbnQ7Cn0KCi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0KICAgNy4gQ09OVsONVklPIEUgUk9EQVDDiQogICA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovCmJvZHkgLmFjY291bnQtZGlzY29yZCB7CiAgZGlzcGxheTogZmxleCAhaW1wb3J0YW50OwogIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbiAhaW1wb3J0YW50OwogIGFsaWduLWl0ZW1zOiBjZW50ZXIgIWltcG9ydGFudDsKICB0ZXh0LWRlY29yYXRpb246IG5vbmUgIWltcG9ydGFudDsKICBwYWRkaW5nOiAxNnB4IDIwcHggIWltcG9ydGFudDsKfQoKYm9keSAuYWNjb3VudC1kaXNjb3JkOmhvdmVyIHsKICBiYWNrZ3JvdW5kOiB2YXIoLS1tZC1zeXMtY29sb3Itc3VyZmFjZS1jb250YWluZXItaGlnaCkgIWltcG9ydGFudDsKfQoKYm9keSAuYWNjb3VudC1kaXNjb3JkX19pbm5lciB7CiAgZGlzcGxheTogZmxleCAhaW1wb3J0YW50OwogIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbiAhaW1wb3J0YW50OwogIGFsaWduLWl0ZW1zOiBjZW50ZXIgIWltcG9ydGFudDsKICB3aWR0aDogMTAwJSAhaW1wb3J0YW50OwogIGdhcDogMTZweCAhaW1wb3J0YW50Owp9Cgpib2R5IC5hY2NvdW50LWRpc2NvcmRfX2lubmVyIGgzIHsKICBjb2xvcjogdmFyKC0tbWQtc3lzLWNvbG9yLW9uLWJhY2tncm91bmQpICFpbXBvcnRhbnQ7CiAgZm9udC13ZWlnaHQ6IDYwMCAhaW1wb3J0YW50OwogIGZvbnQtc2l6ZTogMTRweCAhaW1wb3J0YW50OwogIG1hcmdpbjogMCAhaW1wb3J0YW50Owp9Cgpib2R5IC5hY2NvdW50LWRpc2NvcmRfX2lubmVyIGltZyB7CiAgaGVpZ2h0OiAzMnB4ICFpbXBvcnRhbnQ7CiAgd2lkdGg6IGF1dG8gIWltcG9ydGFudDsKICBvYmplY3QtZml0OiBjb250YWluICFpbXBvcnRhbnQ7Cn0KCmJvZHkgLmZvb3RlciB7CiAgZGlzcGxheTogZmxleCAhaW1wb3J0YW50OwogIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW4gIWltcG9ydGFudDsKICBhbGlnbi1pdGVtczogY2VudGVyICFpbXBvcnRhbnQ7CiAgZ2FwOiAyNHB4ICFpbXBvcnRhbnQ7CiAgcGFkZGluZzogMjRweCAhaW1wb3J0YW50Owp9Cgpib2R5IC5mb290ZXJfX21lbnUgewogIGRpc3BsYXk6IGZsZXggIWltcG9ydGFudDsKICBnYXA6IDE2cHggIWltcG9ydGFudDsKICBmbGV4LXdyYXA6IHdyYXAgIWltcG9ydGFudDsKICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlciAhaW1wb3J0YW50OwogIHBhZGRpbmc6IDAgIWltcG9ydGFudDsKICBsaXN0LXN0eWxlOiBub25lICFpbXBvcnRhbnQ7Cn0KCmJvZHkgLmZvb3Rlcl9fbWVudSBhIHsKICBjb2xvcjogdmFyKC0tbWQtc3lzLWNvbG9yLW91dGxpbmUpICFpbXBvcnRhbnQ7CiAgdGV4dC1kZWNvcmF0aW9uOiBub25lICFpbXBvcnRhbnQ7CiAgZm9udC1zaXplOiAxM3B4ICFpbXBvcnRhbnQ7CiAgZm9udC13ZWlnaHQ6IDUwMCAhaW1wb3J0YW50OwogIHRyYW5zaXRpb246IGNvbG9yIDAuMnMgIWltcG9ydGFudDsKfQoKYm9keSAuZm9vdGVyX19tZW51IGE6aG92ZXIgewogIGNvbG9yOiB2YXIoLS1tZC1zeXMtY29sb3ItcHJpbWFyeSkgIWltcG9ydGFudDsKfQoKYm9keSAuZm9vdGVyX19kZWxldGUtYWNjb3VudCB7CiAgYmFja2dyb3VuZDogI2U1MmIyYiAhaW1wb3J0YW50OwogIGNvbG9yOiAjZmZmYmZiICFpbXBvcnRhbnQ7CiAgYm9yZGVyOiAzcHggc29saWQgIzZkMGQwMCAhaW1wb3J0YW50OwogIGJvcmRlci1yYWRpdXM6IDEwMHB4ICFpbXBvcnRhbnQ7CiAgcGFkZGluZzogMTBweCAyNHB4ICFpbXBvcnRhbnQ7CiAgZm9udC13ZWlnaHQ6IDYwMCAhaW1wb3J0YW50OwogIGZvbnQtc2l6ZTogMTVweCAhaW1wb3J0YW50OwogIHRleHQtdHJhbnNmb3JtOiBub25lICFpbXBvcnRhbnQ7CiAgY3Vyc29yOiBwb2ludGVyICFpbXBvcnRhbnQ7CiAgdGV4dC1kZWNvcmF0aW9uLWxpbmU6IHVuZGVybGluZSAhaW1wb3J0YW50OwogIG1hcmdpbi1ib3R0b206IDEwcHggIWltcG9ydGFudDsKICBtYXJnaW4tbGVmdDogMHB4ICFpbXBvcnRhbnQ7CiAgbGluZS1oZWlnaHQ6IDE0cHggIWltcG9ydGFudDsKfQoKLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PQogICA4LiBERVRBTEhFUyBHRVJBSVMKICAgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqLwpib2R5IC5zZWxlY3RfX21haW4uc2VsZWN0X19tYWluIHsKICBiYWNrZ3JvdW5kOiB2YXIoLS1tZC1zeXMtY29sb3Itc3VyZmFjZS12YXJpYW50KSAhaW1wb3J0YW50OwogIGJvcmRlci1yYWRpdXM6IDEwMHB4ICFpbXBvcnRhbnQ7CiAgcGFkZGluZzogMTBweCAyMHB4ICFpbXBvcnRhbnQ7CiAgY29sb3I6IHZhcigtLW1kLXN5cy1jb2xvci1vbi1iYWNrZ3JvdW5kKSAhaW1wb3J0YW50OwogIGZvbnQtd2VpZ2h0OiA1MDAgIWltcG9ydGFudDsKfQoKYm9keSBociB7CiAgYm9yZGVyLWNvbG9yOiB2YXIoLS1tZC1zeXMtY29sb3Itc3VyZmFjZS12YXJpYW50KSAhaW1wb3J0YW50OwogIG1hcmdpbjogMjRweCAwICFpbXBvcnRhbnQ7CiAgb3BhY2l0eTogMC41ICFpbXBvcnRhbnQ7Cn0KCmJvZHkgLndhcm5pbmcgewogIGJhY2tncm91bmQ6IHJnYmEoMjQ1LCAyMDAsIDAsIDAuMSkgIWltcG9ydGFudDsKICBib3JkZXI6IDFweCBzb2xpZCByZ2JhKDI0NSwgMjAwLCAwLCAwLjIpICFpbXBvcnRhbnQ7CiAgYm9yZGVyLXJhZGl1czogMTZweCAhaW1wb3J0YW50OwogIHBhZGRpbmc6IDE2cHggIWltcG9ydGFudDsKICBtYXJnaW4tdG9wOiAxNnB4ICFpbXBvcnRhbnQ7CiAgZGlzcGxheTogZmxleCAhaW1wb3J0YW50OwogIGFsaWduLWl0ZW1zOiBmbGV4LXN0YXJ0ICFpbXBvcnRhbnQ7CiAgZ2FwOiAxMnB4ICFpbXBvcnRhbnQ7Cn0KCmJvZHkgLndhcm5pbmcgcCB7CiAgbWFyZ2luOiAwICFpbXBvcnRhbnQ7CiAgZm9udC1zaXplOiAxM3B4ICFpbXBvcnRhbnQ7CiAgY29sb3I6IHZhcigtLW1kLXN5cy1jb2xvci1vbi1iYWNrZ3JvdW5kKSAhaW1wb3J0YW50OwogIGxpbmUtaGVpZ2h0OiAxLjUgIWltcG9ydGFudDsKfQoKYm9keSAud2FybmluZyBzdmcgcGF0aCB7CiAgZmlsbDogdmFyKC0tbWQtc3lzLWNvbG9yLXByaW1hcnkpICFpbXBvcnRhbnQ7Cn0KCi8qIENvcnJlw6fDtWVzIGVzcGVjw61maWNhcyBwYXJhIE1vYmlsZSAqLwpAbWVkaWEgKG1heC13aWR0aDogNjAwcHgpIHsKICBib2R5IC51c2VyLWluZm8gLmNvbnRlbnQtYm94X19jYXJkIHsKICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW4gIWltcG9ydGFudDsKICAgIGFsaWduLWl0ZW1zOiBjZW50ZXIgIWltcG9ydGFudDsKICAgIHRleHQtYWxpZ246IGNlbnRlciAhaW1wb3J0YW50OwogIH0KCiAgYm9keSAudXNlci1pbmZvX19wcm9maWxlLWltZyB7CiAgICBtYXJnaW4tcmlnaHQ6IDAgIWltcG9ydGFudDsKICAgIG1hcmdpbi1ib3R0b206IDE2cHggIWltcG9ydGFudDsKICB9CgogIGJvZHkgLnVzZXItaW5mb19fcHJvZmlsZS1kYXRhIHsKICAgIGFsaWduLWl0ZW1zOiBjZW50ZXIgIWltcG9ydGFudDsKICAgIHdpZHRoOiAxMDAlICFpbXBvcnRhbnQ7CiAgfQoKICBib2R5IC5wcm9maWxlLWRhdGFfX3NvY2lhbHMtaXRlbSwKICBib2R5IC5wcm9maWxlLWRhdGFfX290aGVyLWl0ZW0gewogICAganVzdGlmeS1jb250ZW50OiBjZW50ZXIgIWltcG9ydGFudDsKICB9CgogIGJvZHkgLnN5bmMtcGxhdGZvcm1fX2JvZHkgewogICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbiAhaW1wb3J0YW50OwogICAgYWxpZ24taXRlbXM6IGZsZXgtc3RhcnQgIWltcG9ydGFudDsKICAgIGdhcDogMjBweCAhaW1wb3J0YW50OwogIH0KCiAgYm9keSAuc3luYy1wbGF0Zm9ybV9fYnV0dG9ucyB7CiAgICB3aWR0aDogMTAwJSAhaW1wb3J0YW50OwogICAganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuICFpbXBvcnRhbnQ7CiAgfQoKICBib2R5IC5zeW5jLXBsYXRmb3JtX19idXR0b24gewogICAgZmxleDogMSAhaW1wb3J0YW50OwogICAganVzdGlmeS1jb250ZW50OiBjZW50ZXIgIWltcG9ydGFudDsKICB9Cn0=');
      document.head.appendChild(style);
    };
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', injectTheme); } 
    else { injectTheme(); }
  }
})();
