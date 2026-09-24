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

  // 🔴 Alterado para iniciar desabilitado por padrão
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

  navigator.getGamepads = function () {
    if (!isGamepadEnabled) return [null, null, null, null];
    virtualGamepad.timestamp = performance.now();
    return [virtualGamepad, null, null, null];
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
      style.innerHTML = window.atob('LyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0KICAgVEVNQSBNQVRFUklBTCBZT1UgKE1EMykgUEFSQSBCT09TVEVST0lEIENMT1VEUEFECiAgIERlc2NyacOnw6NvOiBFc3RpbGl6YcOnw6NvIGNvbXBsZXRhIGRhIGludGVyZmFjZSB3ZWIgZG8gQm9vc3Rlcm9pZC4KICAgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi8KCi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0KICAgMS4gUkVTRVQgVklTVUFMIEUgQUpVU1RFUyBERSBFU1BBw4dBTUVOVE8gR0xPQkFMCiAgID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi8KLyogT2N1bHRhIG9zIGJhbm5lcnMgbmF0aXZvcyBkbyBwYWluZWwgZSBhcyBhYmFzIGRhIGxvamEgRmFuYXRpY2FsICovCmFwcC1kYXNoYm9hcmQtYmFubmVyLApkYXNoYm9hcmQtYmFubmVyLW5hdmlnYXRpb25zLAouZGFzaGJvYXJkX19iYW5uZXItd3JhcHBlciwKYm9keSAudGFicy0tZmFuYXRpY2FsIHsKICBkaXNwbGF5OiBub25lICFpbXBvcnRhbnQ7CiAgaGVpZ2h0OiAwICFpbXBvcnRhbnQ7CiAgbWFyZ2luOiAwICFpbXBvcnRhbnQ7CiAgb3BhY2l0eTogMCAhaW1wb3J0YW50OwogIHBvaW50ZXItZXZlbnRzOiBub25lICFpbXBvcnRhbnQ7Cn0KCi8qIEdhcmFudGUgdW0gcmVzcGlybyBzdXBlcmlvciBwYXJhIGEgYmlibGlvdGVjYSBkZSBqb2dvcywgZXZpdGFuZG8gY29sYXIgbm8gdG9wbyAqLwpib2R5IC5kYXNoYm9hcmQgLmxpYnJhcnksCmJvZHkgI2Rhc2hib2FyZC1saWJyYXJ5LApib2R5IGxpYnJhcnkgewogIG1hcmdpbi10b3A6IDMwcHggIWltcG9ydGFudDsKfQoKLyogQ2VudHJhbGl6YSBlIGFsaW5oYSBwZXJmZWl0YW1lbnRlIGFzIGFiYXMgZGUgbmF2ZWdhw6fDo28gbmEgbWVzbWEgbGluaGEgKi8KYm9keSBmaWx0ZXItbGlzdCB0YWJzLnRhYnMsCmJvZHkgLnRhYnMudGFicywKYm9keSAudGFicy1pbm5lci50YWJzLWlubmVyIHsKICBhbGlnbi1pdGVtczogY2VudGVyICFpbXBvcnRhbnQ7IAp9CgovKiBBZGljaW9uYSB1bSBwYWRkaW5nIGNvbmZvcnTDoXZlbCAocmVzcGlybykgbmEgYmFycmEgZGUgY29udHJvbGUgZGUgZmlsdHJvcyAqLwpmaWx0ZXItY29udHJvbGxlci13aWRnZXQgewogIHBhZGRpbmctdG9wOiAxNnB4ICFpbXBvcnRhbnQ7CiAgcGFkZGluZy1ib3R0b206IDE2cHggIWltcG9ydGFudDsgCn0KCi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0KICAgMi4gUEFMRVRBIERFIENPUkVTIE1BVEVSSUFMIFlPVSAoR09MRCAmIERBUksgVEhFTUUpCiAgID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi8KOnJvb3QsICogewogIC8qIENvcmVzIFByaW5jaXBhaXMgKEFtYXJlbG8gRG91cmFkbyBQcmVtaXVtIGUgTWFycm9tIEVzY3VybykgKi8KICAtLW1kLXN5cy1jb2xvci1wcmltYXJ5OiAjZjVjODAwICFpbXBvcnRhbnQ7CiAgLS1tZC1zeXMtY29sb3Itb24tcHJpbWFyeTogIzUyMzQxMyAhaW1wb3J0YW50OwogIC0tbWQtc3lzLWNvbG9yLXByaW1hcnktY29udGFpbmVyOiAjZjVjODAwICFpbXBvcnRhbnQ7CiAgLS1tZC1zeXMtY29sb3Itb24tcHJpbWFyeS1jb250YWluZXI6ICM1MjM0MTMgIWltcG9ydGFudDsKICAKICAvKiBGdW5kb3MgZSBTdXBlcmbDrWNpZXMgKEdyYWZpdGUgUHJvZnVuZG8pICovCiAgLS1tZC1zeXMtY29sb3ItYmFja2dyb3VuZDogIzFDMUIxRiAhaW1wb3J0YW50OwogIC0tbWQtc3lzLWNvbG9yLW9uLWJhY2tncm91bmQ6ICNFNkUxRTUgIWltcG9ydGFudDsKICAtLW1kLXN5cy1jb2xvci1zdXJmYWNlOiAjMUMxQjFGICFpbXBvcnRhbnQ7CiAgLS1tZC1zeXMtY29sb3Itc3VyZmFjZS12YXJpYW50OiAjNDk0NTRGICFpbXBvcnRhbnQ7CiAgCiAgLyogQ29udGFpbmVycyBlIENvbnRvcm5vcyAqLwogIC0tbWQtc3lzLWNvbG9yLXN1cmZhY2UtY29udGFpbmVyOiAjMkIyOTMwICFpbXBvcnRhbnQ7CiAgLS1tZC1zeXMtY29sb3Itc3VyZmFjZS1jb250YWluZXItaGlnaDogIzM2MzQzQiAhaW1wb3J0YW50OwogIC0tbWQtc3lzLWNvbG9yLW91dGxpbmU6ICM5MzhGOTkgIWltcG9ydGFudDsKfQoKLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PQogICAzLiBGVU5ETywgQ0FCRcOHQUxITyBFIFBBSU7DiUlTIERFIElORk9STUHDh8ODTwogICA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovCi8qIEFwbGljYSBvIGZ1bmRvIGVzY3VybyBnbG9iYWwgZSBmb3LDp2EgYSBmb250ZSBwYWRyw6NvIGRvIHNpc3RlbWEgb3BlcmFjaW9uYWwgKi8KaHRtbCwgYm9keSwgYm9keSBhcHAtcm9vdCwgYm9keSAubWFpbi1hcHAsIGJvZHkgLndyYXBwZXIsIGJvZHkgLmRhc2hib2FyZCB7CiAgYmFja2dyb3VuZDogdmFyKC0tbWQtc3lzLWNvbG9yLWJhY2tncm91bmQpICFpbXBvcnRhbnQ7CiAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tbWQtc3lzLWNvbG9yLWJhY2tncm91bmQpICFpbXBvcnRhbnQ7CiAgYmFja2dyb3VuZC1pbWFnZTogbm9uZSAhaW1wb3J0YW50OyAKICBjb2xvcjogdmFyKC0tbWQtc3lzLWNvbG9yLW9uLWJhY2tncm91bmQpICFpbXBvcnRhbnQ7CiAgZm9udC1mYW1pbHk6IHN5c3RlbS11aSwgUm9ib3RvLCBzYW5zLXNlcmlmICFpbXBvcnRhbnQ7Cn0KCi8qIEVzdGlsaXphIG8gY2FiZcOnYWxobyBzdXBlcmlvciwgcmVtb3ZlbmRvIHNvYnJhcyBlIGFkaWNpb25hbmRvIHVtYSBsaW5oYSBkaXZpc8OzcmlhIGxpbXBhICovCmJvZHkgLmhlYWRlci5oZWFkZXIgewogIGJhY2tncm91bmQ6IHZhcigtLW1kLXN5cy1jb2xvci1zdXJmYWNlKSAhaW1wb3J0YW50OwogIGJhY2tncm91bmQtaW1hZ2U6IG5vbmUgIWltcG9ydGFudDsKICBib3JkZXItYm90dG9tOiAxcHggc29saWQgdmFyKC0tbWQtc3lzLWNvbG9yLXN1cmZhY2UtdmFyaWFudCkgIWltcG9ydGFudDsKfQpib2R5IC5oZWFkZXI6OmJlZm9yZSwgYm9keSAuaGVhZGVyOjphZnRlciB7IAogIGRpc3BsYXk6IG5vbmUgIWltcG9ydGFudDsgCn0KCi8qIFBhaW5lbCBkYSBiYXJyYSBkZSBwZXNxdWlzYSBlIG1lbnVzIGRyb3Bkb3duIChmdW5kbyBsaW1wbykgKi8KYm9keSAuY29tbWFuZC1wYWxldHRlX19wYW5lbCB7CiAgYmFja2dyb3VuZDogdmFyKC0tbWQtc3lzLWNvbG9yLXN1cmZhY2UpICFpbXBvcnRhbnQ7Cn0KCi8qIENvcnRpbmFzL0JhY2tkcm9wcyBkb3MgbWVudXMgZGUgZmlsdHJvIGFiZXJ0b3MgKi8KZmlsdGVyLWNvbnRyb2xsZXItd2lkZ2V0IHsKICAtLWZpbHRlcnMtYmFja2Ryb3A6IHZhcigtLW1kLXN5cy1jb2xvci1iYWNrZ3JvdW5kKSAhaW1wb3J0YW50Owp9CgovKiBQYWluw6lpcyBjb20gaW5mb3JtYcOnw7VlcyBkb3Mgam9nb3MgKEdyYWRpZW50ZSB0cmFuc2zDumNpZG8gc3VhdmUpICovCmFwcGxpY2F0aW9uLWluZm8sCmFwcGxpY2F0aW9uLXNob3J0LWluZm8gewogIGJhY2tncm91bmQ6IGxpbmVhci1ncmFkaWVudCgxODBkZWcsIHZhcigtLWFwcGxpY2F0aW9uLXVuZGVyLWV1bGEtcGFuZWwtdG9wLCByZ2JhKDI4LCAyNywgMzEsIC43KSkgMCUsIHZhcigtLWFwcGxpY2F0aW9uLXVuZGVyLWV1bGEtcGFuZWwtYm90dG9tLCByZ2JhKDI4LCAyNywgMzEsIC43KSkgMTAwJSkgIWltcG9ydGFudDsKfQoKLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PQogICA0LiBCT1TDlUVTLCBBQkFTLCBTRUxFQ1RTIEUgRklMVFJPUyAoUElMTCBTSEFQRVMpCiAgID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi8KLyogQm90w7VlcyBQcmluY2lwYWlzIERlc3RhY2Fkb3MgKEV4OiBKb2dhciwgQXNzaW5hcikgKi8KYm9keSAucHJpbWFyeS1idXR0b24ucHJpbWFyeS1idXR0b24sIApib2R5IC5idXR0b24tcHJpbWFyeS5idXR0b24tcHJpbWFyeSB7CiAgYmFja2dyb3VuZDogdmFyKC0tbWQtc3lzLWNvbG9yLXByaW1hcnkpICFpbXBvcnRhbnQ7CiAgYmFja2dyb3VuZC1pbWFnZTogbm9uZSAhaW1wb3J0YW50OwogIGNvbG9yOiB2YXIoLS1tZC1zeXMtY29sb3Itb24tcHJpbWFyeSkgIWltcG9ydGFudDsKICBib3JkZXItcmFkaXVzOiAxMDBweCAhaW1wb3J0YW50OwogIHRleHQtdHJhbnNmb3JtOiBub25lICFpbXBvcnRhbnQ7CiAgZm9udC13ZWlnaHQ6IDcwMCAhaW1wb3J0YW50OwogIGJveC1zaGFkb3c6IG5vbmUgIWltcG9ydGFudDsKICBib3JkZXI6IG5vbmUgIWltcG9ydGFudDsKfQpib2R5IC5wcmltYXJ5LWJ1dHRvbjo6YmVmb3JlLCBib2R5IC5idXR0b24tcHJpbWFyeTo6YmVmb3JlLApib2R5IC5wcmltYXJ5LWJ1dHRvbjo6YWZ0ZXIsIGJvZHkgLmJ1dHRvbi1wcmltYXJ5OjphZnRlciB7IAogIGRpc3BsYXk6IG5vbmUgIWltcG9ydGFudDsgCn0KCi8qIEJhcnJhIGRlIFBlc3F1aXNhIChJbnB1dCkgKi8KYm9keSAuY29tbWFuZC1wYWxldHRlX190cmlnZ2VyLmNvbW1hbmQtcGFsZXR0ZV9fdHJpZ2dlciB7CiAgYmFja2dyb3VuZDogdmFyKC0tbWQtc3lzLWNvbG9yLXN1cmZhY2UtY29udGFpbmVyLWhpZ2gpICFpbXBvcnRhbnQ7CiAgYm9yZGVyLXJhZGl1czogMTAwcHggIWltcG9ydGFudDsKICBib3JkZXI6IG5vbmUgIWltcG9ydGFudDsKfQoKLyogQm90w7VlcyBTZWN1bmTDoXJpb3MsIEFiYXMgKEJpYmxpb3RlY2EvTG9qYSkgZSBCb3TDo28gZGUgTGltcGFyIEZpbHRyb3MgKi8KYm9keSAudGFiLWJ1dHRvbi50YWItYnV0dG9uLApib2R5IC5zZWNvbmRhcnktYnV0dG9uLApib2R5IC5hcHBsaWNhdGlvbl9fY29udHJvbHMtc3RvcmUsCmJvZHkgLmZpbHRlci1tZW51LWJ1dHRvbi5maWx0ZXItbWVudS1idXR0b24gewogIGJvcmRlci1yYWRpdXM6IDEwMHB4ICFpbXBvcnRhbnQ7CiAgYm9yZGVyOiAwcHggc29saWQgdmFyKC0tbWQtc3lzLWNvbG9yLXN1cmZhY2UtdmFyaWFudCkgIWltcG9ydGFudDsgCiAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tbWQtc3lzLWNvbG9yLXN1cmZhY2UtY29udGFpbmVyKSAhaW1wb3J0YW50OwogIGNvbG9yOiB2YXIoLS1tZC1zeXMtY29sb3Itb24tYmFja2dyb3VuZCkgIWltcG9ydGFudDsKICB0ZXh0LXRyYW5zZm9ybTogbm9uZSAhaW1wb3J0YW50OwogIGZvbnQtd2VpZ2h0OiA1MDAgIWltcG9ydGFudDsKICBkaXNwbGF5OiBmbGV4ICFpbXBvcnRhbnQ7CiAgYWxpZ24taXRlbXM6IGNlbnRlciAhaW1wb3J0YW50OwogIGp1c3RpZnktY29udGVudDogY2VudGVyICFpbXBvcnRhbnQ7CiAgbWluLWhlaWdodDogNDBweCAhaW1wb3J0YW50OwogIHBhZGRpbmc6IDAgMjBweCAhaW1wb3J0YW50OwogIG1hcmdpbjogMCAhaW1wb3J0YW50OwogIGJveC1zaGFkb3c6IG5vbmUgIWltcG9ydGFudDsKfQpib2R5IC50YWItYnV0dG9uOjpiZWZvcmUsIGJvZHkgLnRhYi1idXR0b246OmFmdGVyIHsgCiAgZGlzcGxheTogbm9uZSAhaW1wb3J0YW50OyAKfQoKLyogRXN0YWRvcyBkZSBTZWxlw6fDo28gKFF1YW5kbyB1bWEgQWJhIG91IEZpbHRybyBlc3TDoSBhdGl2bykgKi8KYm9keSAudGFiLWJ1dHRvbi0tYWN0aXZlLnRhYi1idXR0b24tLWFjdGl2ZSwKYm9keSAuZmlsdGVyLW1lbnUtYnV0dG9uLS1hY3RpdmUuZmlsdGVyLW1lbnUtYnV0dG9uLS1hY3RpdmUsCmJvZHkgLmZpbHRlci1tZW51LWJ1dHRvbi0taXNEaXJ0eS5maWx0ZXItbWVudS1idXR0b24tLWlzRGlydHkgewogIGJhY2tncm91bmQ6IHZhcigtLW1kLXN5cy1jb2xvci1wcmltYXJ5LWNvbnRhaW5lcikgIWltcG9ydGFudDsKICBjb2xvcjogdmFyKC0tbWQtc3lzLWNvbG9yLW9uLXByaW1hcnktY29udGFpbmVyKSAhaW1wb3J0YW50OwogIGJvcmRlci1jb2xvcjogdHJhbnNwYXJlbnQgIWltcG9ydGFudDsKfQoKLyogRm9yw6dhIMOtY29uZXMgU1ZHIGludGVybm9zIGEgaGVyZGFyZW0gYSBjb3IgZG8gdGV4dG8gY29ycmV0YW1lbnRlICovCmJvZHkgLmZpbHRlci1tZW51LWJ1dHRvbi5maWx0ZXItbWVudS1idXR0b24gcCB7IGNvbG9yOiBpbmhlcml0ICFpbXBvcnRhbnQ7IH0KYm9keSAuZmlsdGVyLW1lbnUtYnV0dG9uLmZpbHRlci1tZW51LWJ1dHRvbiBzdmcgeyBmaWxsOiBjdXJyZW50Q29sb3IgIWltcG9ydGFudDsgY29sb3I6IGN1cnJlbnRDb2xvciAhaW1wb3J0YW50OyB9CgovKiBEcm9wZG93bnMgLyBTZWxlY3RzIChMaXN0YXMgZGUgUGxhdGFmb3JtYXMpICovCmJvZHkgLnNlbGVjdC5zZWxlY3QgewogIGJhY2tncm91bmQ6IHRyYW5zcGFyZW50ICFpbXBvcnRhbnQ7CiAgYm94LXNoYWRvdzogbm9uZSAhaW1wb3J0YW50OwogIGJvcmRlcjogbm9uZSAhaW1wb3J0YW50Owp9CmJvZHkgLnNlbGVjdF9fbWFpbi5zZWxlY3RfX21haW4gewogIGJhY2tncm91bmQ6IHZhcigtLW1kLXN5cy1jb2xvci1zdXJmYWNlLXZhcmlhbnQpICFpbXBvcnRhbnQ7CiAgYm9yZGVyLXJhZGl1czogMTAwcHggIWltcG9ydGFudDsKICBib3JkZXI6IG5vbmUgIWltcG9ydGFudDsKfQoKLyogRmlsdHJvcyBlbSBDaGVja2JveCAoVHJhbnNmb3JtYWRvcyBlbSAiQ2hpcHMiIGRvIE1EMykgKi8KYm9keSAuY2hlY2tib3gtYnV0dG9uLmNoZWNrYm94LWJ1dHRvbiB7CiAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tbWQtc3lzLWNvbG9yLXN1cmZhY2UtY29udGFpbmVyKSAhaW1wb3J0YW50OwogIGJvcmRlcjogMHB4IHNvbGlkIHZhcigtLW1kLXN5cy1jb2xvci1zdXJmYWNlLXZhcmlhbnQpICFpbXBvcnRhbnQ7IAogIGJvcmRlci1yYWRpdXM6IDEwMHB4ICFpbXBvcnRhbnQ7CiAgYm94LXNoYWRvdzogbm9uZSAhaW1wb3J0YW50OwogIHBhZGRpbmc6IDAgMTZweCAhaW1wb3J0YW50OwogIGhlaWdodDogYXV0byAhaW1wb3J0YW50OwogIG1pbi1oZWlnaHQ6IDQwcHggIWltcG9ydGFudDsKICBkaXNwbGF5OiBmbGV4ICFpbXBvcnRhbnQ7CiAgYWxpZ24taXRlbXM6IGNlbnRlciAhaW1wb3J0YW50Owp9CmJvZHkgLmNoZWNrYm94LWJ1dHRvbi5hY3RpdmUuY2hlY2tib3gtYnV0dG9uIHsKICBiYWNrZ3JvdW5kOiB2YXIoLS1tZC1zeXMtY29sb3ItcHJpbWFyeS1jb250YWluZXIpICFpbXBvcnRhbnQ7CiAgYm9yZGVyLWNvbG9yOiB0cmFuc3BhcmVudCAhaW1wb3J0YW50Owp9CmJvZHkgLmNoZWNrYm94X19jaGVja21hcmsgeyBkaXNwbGF5OiBub25lICFpbXBvcnRhbnQ7IC8qIEVzY29uZGUgbyBxdWFkcmFkbyBuYXRpdm8gZG8gY2hlY2tib3ggKi8gfQpib2R5IC5jaGVja2JveF9fbGFiZWwgewogIHBhZGRpbmctbGVmdDogMCAhaW1wb3J0YW50OwogIGNvbG9yOiB2YXIoLS1tZC1zeXMtY29sb3Itb24tYmFja2dyb3VuZCkgIWltcG9ydGFudDsKICBmb250LXdlaWdodDogNTAwICFpbXBvcnRhbnQ7Cn0KYm9keSAuY2hlY2tib3gtYnV0dG9uLmFjdGl2ZS5jaGVja2JveC1idXR0b24gLmNoZWNrYm94X19sYWJlbCB7CiAgY29sb3I6IHZhcigtLW1kLXN5cy1jb2xvci1vbi1wcmltYXJ5LWNvbnRhaW5lcikgIWltcG9ydGFudDsKfQoKLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PQogICA1LiBDQVJUw5VFUyBERSBKT0dPUyBFIEdBTEVSSUEKICAgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqLwovKiBMaW1wYSBmdW5kb3MgZSBib3JkYXMgb3JpZ2luYWlzIGRhcyBjYXBhcyBkb3Mgam9nb3MgKi8KYm9keSAuc3RvcmUtaXRlbV9faW1hZ2UsCmJvZHkgLnN0b3JlLWl0ZW1fX292ZXJsYXksCmJvZHkgLnN0b3JlLWl0ZW1fX2luc3RhbGwtc2hvd2Nhc2UgewogIGJhY2tncm91bmQ6IHZhcigtLW1kLXN5cy1jb2xvci1zdXJmYWNlLWNvbnRhaW5lcikgIWltcG9ydGFudDsKICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1tZC1zeXMtY29sb3Itc3VyZmFjZS1jb250YWluZXIpICFpbXBvcnRhbnQ7CiAgYmFja2dyb3VuZC1pbWFnZTogbm9uZSAhaW1wb3J0YW50OyAKICBib3JkZXItcmFkaXVzOiAwICFpbXBvcnRhbnQ7CiAgYm94LXNoYWRvdzogbm9uZSAhaW1wb3J0YW50OwogIGJvcmRlcjogbm9uZSAhaW1wb3J0YW50Owp9CgovKiBBcGxpY2EgYSBib3JkYSBlc3Blc3NhIGUgY2FudG9zIGFycmVkb25kYWRvcyBubyBjYXJ0w6NvIHByaW5jaXBhbCBkbyBqb2dvICovCmJvZHkgLnN0b3JlLWl0ZW1fX3N1cmZhY2UgewogIGJhY2tncm91bmQ6IHZhcigtLW1kLXN5cy1jb2xvci1zdXJmYWNlLWNvbnRhaW5lcikgIWltcG9ydGFudDsKICBib3JkZXI6IDNweCBzb2xpZCB2YXIoLS1tZC1zeXMtY29sb3Itc3VyZmFjZS12YXJpYW50KSAhaW1wb3J0YW50OwogIGJvcmRlci1yYWRpdXM6IDI0cHggIWltcG9ydGFudDsKICBvdmVyZmxvdzogaGlkZGVuICFpbXBvcnRhbnQ7Cn0KCi8qIEVzdGlsbyBlbSBmb3JtYXRvIGRlIHDDrWx1bGEgcGFyYSBpdGVucyBkYSB2aXN1YWxpemHDp8OjbyBtb2JpbGUgKi8KLnN0b3JlLWl0ZW1fX21vYmlsZSB7CiAgYm9yZGVyLXJhZGl1czogMTAwcHggIWltcG9ydGFudDsKfQoKLyogUmVtb3ZlIGFydGVmYXRvcyBlIGJvdMO1ZXMgcmVkdW5kYW50ZXMgcG9yIGNpbWEgZGFzIGNhcGFzICovCmJvZHkgLnN0b3JlLWl0ZW1fX2luc3RhbGwtc2hvd2Nhc2U6OmJlZm9yZSwKYm9keSAuc3RvcmUtaXRlbV9faW5zdGFsbC1zaG93Y2FzZTo6YWZ0ZXIsCmJvZHkgLnN0b3JlLWl0ZW1fX21vYmlsZS1saW5rcywKYm9keSAuaXRlbS1nYW1lLWluLS1hZGQgLnN0b3JlLWl0ZW1fX3N1cmZhY2U6OmJlZm9yZSB7CiAgZGlzcGxheTogbm9uZSAhaW1wb3J0YW50Owp9CgovKiBBbmltYcOnw6NvIHN1YXZlIGRlIGZsdXR1YcOnw6NvIGFvIHBhc3NhciBvIG1vdXNlIG91IHRvY2FyICovCmJvZHkgLnN0b3JlLWl0ZW0uc3RvcmUtaXRlbSB7IHRyYW5zaXRpb246IHRyYW5zZm9ybSAwLjJzIGVhc2UgIWltcG9ydGFudDsgfQpib2R5IC5zdG9yZS1pdGVtOmhvdmVyIC5zdG9yZS1pdGVtX19zdXJmYWNlLApib2R5IC5zdG9yZS1pdGVtLnN0b3JlLWl0ZW0tLWhvdmVyZWQgLnN0b3JlLWl0ZW1fX3N1cmZhY2UgewogIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtNHB4KSAhaW1wb3J0YW50OwogIGJveC1zaGFkb3c6IDAgOHB4IDE2cHggcmdiYSgwLDAsMCwwLjQpICFpbXBvcnRhbnQ7CiAgYmFja2dyb3VuZDogdmFyKC0tbWQtc3lzLWNvbG9yLXN1cmZhY2UtY29udGFpbmVyLWhpZ2gpICFpbXBvcnRhbnQ7CiAgYmFja2dyb3VuZC1pbWFnZTogbm9uZSAhaW1wb3J0YW50Owp9CgovKiBFc2N1cmVjZSBhIGltYWdlbSBwYXJhIGRhciBjb250cmFzdGUgYW8gdMOtdHVsbyBxdWFuZG8gdG9jYWRvICovCmJvZHkgLnN0b3JlLWl0ZW1fX292ZXJsYXkgewogIGJhY2tncm91bmQ6IHJnYmEoMjgsIDI3LCAzMSwgMC41KSAhaW1wb3J0YW50Owp9CmJvZHkgLnN0b3JlLWl0ZW06aG92ZXIgLnN0b3JlLWl0ZW1fX292ZXJsYXkgeyAKICBiYWNrZ3JvdW5kOiByZ2JhKDI4LCAyNywgMzEsIDAuODUpICFpbXBvcnRhbnQ7IAp9CgovKiBUw610dWxvcyBkb3Mgam9nb3MgbWFpcyBsZWfDrXZlaXMgZSBzZW0gc29tYnJhcyBjYWZvbmFzICovCmJvZHkgLml0ZW0tZ2FtZS1pbl9fY29udGVudCBoNCB7CiAgY29sb3I6IHZhcigtLW1kLXN5cy1jb2xvci1vbi1iYWNrZ3JvdW5kKSAhaW1wb3J0YW50OwogIGZvbnQtd2VpZ2h0OiA2MDAgIWltcG9ydGFudDsKICB0ZXh0LXNoYWRvdzogbm9uZSAhaW1wb3J0YW50OyAKfQoKLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PQogICA2LiBCQURHRVMsIEVUSVFVRVRBUyBFIFBMQVRBRk9STUFTCiAgID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi8KLyogUGFkcm9uaXphIGFzIGV0aXF1ZXRhcyBkZSAiTm92byIsICJTdGVhbSIsICJFcGljIiBjb20gdmlzdWFsIHDDrWx1bGEgZSBjb3IgbmV1dHJhICovCmJvZHkgLmFwcC1iYWRnZSwgCmJvZHkgLnN0b3JlLWl0ZW1fX25ldy1sYWJlbCwgCmJvZHkgLmhvcHBlcl9fYmFkZ2UsCmJvZHkgLnN0b3JlLWl0ZW1fX3BsYXRmb3JtLApib2R5IC5idXR0b24tdW5kZXIuYnV0dG9uLXVuZGVyIHsKICBiYWNrZ3JvdW5kOiB2YXIoLS1tZC1zeXMtY29sb3Itc3VyZmFjZS12YXJpYW50KSAhaW1wb3J0YW50OwogIGJhY2tncm91bmQtaW1hZ2U6IG5vbmUgIWltcG9ydGFudDsKICBjb2xvcjogdmFyKC0tbWQtc3lzLWNvbG9yLW9uLWJhY2tncm91bmQpICFpbXBvcnRhbnQ7CiAgYm9yZGVyOiBub25lICFpbXBvcnRhbnQ7CiAgYm9yZGVyLXJhZGl1czogMTAwcHggIWltcG9ydGFudDsKfQpib2R5IC5hcHAtYmFkZ2UgLmFwcC1iYWRnZV9fdGV4dCB7CiAgY29sb3I6IHZhcigtLW1kLXN5cy1jb2xvci1vbi1iYWNrZ3JvdW5kKSAhaW1wb3J0YW50Owp9CgovKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09CiAgIDcuIExJTVBFWkEgREUgSU5URVJGQUNFIChSRU1Pw4fDg08gREUgQkFOTkVSUyBFIFBPTFVJw4fDg08pCiAgID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi8KLyogT2N1bHRhIG9zICJVcHN0cm9uYXV0cyIgKE1hc290ZXMpLCBQcm9tb8Onw7VlcyBlIFNlbG9zIGRlIERlc2NvbnRvICovCmNsb3VkLWhvcHBlci1pdGVtLCAKLmhvcHBlci1pdGVtLCAKLmhvcHBlciwKYm9keSBjYXJkLXByb21vLApib2R5IC5zdG9yZS1pdGVtX19wcm9tbywKYm9keSAuc3RvcmUtaXRlbV9fcHJvbW8tdGV4dCwKYm9keSAuc3RvcmUtaXRlbV9fZGlzY291bnRzIHsKICBkaXNwbGF5OiBub25lICFpbXBvcnRhbnQ7CiAgb3BhY2l0eTogMCAhaW1wb3J0YW50OwogIHBvaW50ZXItZXZlbnRzOiBub25lICFpbXBvcnRhbnQ7CiAgd2lkdGg6IDAgIWltcG9ydGFudDsKICBoZWlnaHQ6IDAgIWltcG9ydGFudDsKICBtYXJnaW46IDAgIWltcG9ydGFudDsKICBwYWRkaW5nOiAwICFpbXBvcnRhbnQ7CiAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQgIWltcG9ydGFudDsKICBiYWNrZ3JvdW5kLWltYWdlOiBub25lICFpbXBvcnRhbnQ7Cn0KCi8qIE9jdWx0YSBCb3TDo28gZG8gU3Vwb3J0ZSAoQ2FudG8gZGEgdGVsYSkgKi8KI2JvdGJ1dHRvbiB7CiAgZGlzcGxheTogbm9uZSAhaW1wb3J0YW50Owp9CgovKiBPY3VsdGEgQXZpc28gRmx1dHVhbnRlIGRlIENvb2tpZXMgKENvb2tpZVllcykgKi8KLmNreS1idG4tcmV2aXNpdC13cmFwcGVyLAouY2t5LXJldmlzaXQtYm90dG9tLWxlZnQgewogIGRpc3BsYXk6IG5vbmUgIWltcG9ydGFudDsKfQoKLyogT2N1bHRhIEJhcnJhIFN1cGVyaW9yIGluc2lzdGluZG8gcGFyYSBiYWl4YXIgbyBhcHAgbmF0aXZvICovCi5kb3dubG9hZF9fYXBwIHsKICBkaXNwbGF5OiBub25lICFpbXBvcnRhbnQ7Cn0KCi8qIExpbXBhIGVmZWl0b3MgZSBwYXJ0w61jdWxhcyBkZSBuZW9uIGRvIGJvdMOjbyAiTWFnaWMiICovCmJvZHkgLm1hZ2ljLWJ1dHRvbi5tYWdpYy1idXR0b24gewogIGJhY2tncm91bmQ6IHZhcigtLW1kLXN5cy1jb2xvci1wcmltYXJ5KSAhaW1wb3J0YW50OwogIGNvbG9yOiB2YXIoLS1tZC1zeXMtY29sb3Itb24tcHJpbWFyeSkgIWltcG9ydGFudDsKICBib3JkZXItcmFkaXVzOiAxMDBweCAhaW1wb3J0YW50OwogIGJveC1zaGFkb3c6IG5vbmUgIWltcG9ydGFudDsKfQpib2R5IC5tYWdpYy1idXR0b25fX2dsb3csIApib2R5IC5tYWdpYy1idXR0b25fX2ZpbGwsCmJvZHkgLm1hZ2ljLWJ1dHRvbl9fc2hpbW1lciwKYm9keSAubWFnaWMtYnV0dG9uX19yaW5nLApib2R5IC5tYWdpYy1idXR0b25fX3NwYXJrcyB7CiAgZGlzcGxheTogbm9uZSAhaW1wb3J0YW50Owp9CgovKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09CiAgIDguIENPTlRST0xFUyBERSBIT1ZFUiBOT1MgQ0FSVMOVRVMgKEpPR0FSIEUgUkVNT1ZFUikKICAgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqLwovKiBBanVzdGEgYSBiYXJyYSBkZSBib3TDtWVzIGZsdXR1YW50ZXMgcGFyYSBuw6NvIGVuY29zdGFyIG5hcyBib3JkYXMgZG8gY2FydMOjbyAqLwpib2R5IC5zdG9yZS1pdGVtX19idXR0b25zLnN0b3JlLWl0ZW1fX2J1dHRvbnMgewogIGJvdHRvbTogMTZweCAhaW1wb3J0YW50OwogIHBhZGRpbmc6IDAgMTZweCAhaW1wb3J0YW50OwogIGdhcDogOHB4ICFpbXBvcnRhbnQ7CiAganVzdGlmeS1jb250ZW50OiBjZW50ZXIgIWltcG9ydGFudDsKICBmbGV4LXdyYXA6IG5vd3JhcCAhaW1wb3J0YW50OwogIHdpZHRoOiAxMDAlICFpbXBvcnRhbnQ7CiAgYm94LXNpemluZzogYm9yZGVyLWJveCAhaW1wb3J0YW50Owp9CgovKiBGb3LDp2EgbyBCb3TDo28gZGUgSm9nYXIgYSBvY3VwYXIgbyBlc3Bhw6dvIHJlc3RhbnRlIChGbGV4IEdyb3cpICovCmJvZHkgLnN0b3JlLWl0ZW1fX2NvbnRyb2wtYnV0dG9uLS1wbGF5LnN0b3JlLWl0ZW1fX2NvbnRyb2wtYnV0dG9uLS1wbGF5IHsKICBmbGV4LWdyb3c6IDEgIWltcG9ydGFudDsKICBtYXJnaW46IDAgIWltcG9ydGFudDsKICB3aWR0aDogYXV0byAhaW1wb3J0YW50Owp9CgovKiBGb3JtYXRhIG8gQm90w6NvIGRlIFJlbW92ZXIgZGEgQmlibGlvdGVjYSBwYXJhIHNlciB1bSBjw61yY3VsbyBwZXJmZWl0byAqLwpib2R5IC5zdG9yZS1pdGVtX19jb250cm9sLWJ1dHRvbi0tc2Vjb25kYXJ5LnN0b3JlLWl0ZW1fX2NvbnRyb2wtYnV0dG9uLS1zZWNvbmRhcnkgewogIGZsZXg6IDAgMCA0MHB4ICFpbXBvcnRhbnQ7CiAgd2lkdGg6IDQwcHggIWltcG9ydGFudDsKICBoZWlnaHQ6IDQwcHggIWltcG9ydGFudDsKICBtYXJnaW46IDAgIWltcG9ydGFudDsKfQoKLyogSW5qZcOnw6NvIGRlIMONY29uZSBkZSBMaXhlaXJhIG5vIGJvdMOjbyBkZSByZW1vdmVyLCBvY3VsdGFuZG8gbyBoaWZlbiAoLSkgb3JpZ2luYWwgKi8KYm9keSAuc3RvcmUtaXRlbV9fY29udHJvbC1idXR0b24tLXNlY29uZGFyeSAuc2Vjb25kYXJ5LWJ1dHRvbiB7CiAgYmFja2dyb3VuZDogdmFyKC0tbWQtc3lzLWNvbG9yLXN1cmZhY2UtdmFyaWFudCkgIWltcG9ydGFudDsKICBjb2xvcjogdHJhbnNwYXJlbnQgIWltcG9ydGFudDsgCiAgYm9yZGVyOiBub25lICFpbXBvcnRhbnQ7CiAgYm9yZGVyLXJhZGl1czogMTAwcHggIWltcG9ydGFudDsgCiAgd2lkdGg6IDEwMCUgIWltcG9ydGFudDsKICBoZWlnaHQ6IDEwMCUgIWltcG9ydGFudDsKICBwYWRkaW5nOiAwICFpbXBvcnRhbnQ7CiAgcG9zaXRpb246IHJlbGF0aXZlICFpbXBvcnRhbnQ7CiAgYm94LXNoYWRvdzogbm9uZSAhaW1wb3J0YW50OwogIHRyYW5zaXRpb246IGJhY2tncm91bmQgMC4ycyBlYXNlICFpbXBvcnRhbnQ7Cn0KYm9keSAuc3RvcmUtaXRlbV9fY29udHJvbC1idXR0b24tLXNlY29uZGFyeSAuc2Vjb25kYXJ5LWJ1dHRvbjpob3ZlciB7CiAgYmFja2dyb3VuZDogdmFyKC0tbWQtc3lzLWNvbG9yLW91dGxpbmUpICFpbXBvcnRhbnQ7Cn0KYm9keSAuc3RvcmUtaXRlbV9fY29udHJvbC1idXR0b24tLXNlY29uZGFyeSAuc2Vjb25kYXJ5LWJ1dHRvbjo6YWZ0ZXIgewogIGNvbnRlbnQ6ICIiICFpbXBvcnRhbnQ7CiAgcG9zaXRpb246IGFic29sdXRlICFpbXBvcnRhbnQ7CiAgaW5zZXQ6IDAgIWltcG9ydGFudDsKICBtYXJnaW46IGF1dG8gIWltcG9ydGFudDsKICB3aWR0aDogMjBweCAhaW1wb3J0YW50OwogIGhlaWdodDogMjBweCAhaW1wb3J0YW50OwogIGJhY2tncm91bmQtY29sb3I6IHZhcigtLW1kLXN5cy1jb2xvci1vbi1iYWNrZ3JvdW5kKSAhaW1wb3J0YW50OwogIC13ZWJraXQtbWFzazogdXJsKCJkYXRhOmltYWdlL3N2Zyt4bWwsJTNDc3ZnIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zycgdmlld0JveD0nMCAwIDI0IDI0JyUzRSUzQ3BhdGggZD0nTTYgMTljMCAxLjEuOSAyIDIgMmg4YzEuMSAwIDItLjkgMi0yVjdINnYxMnpNMTkgNGgtMy41bC0xLTFoLTVsLTEgMUg1djJoMTRWNHonLyUzRSUzQy9zdmclM0UiKSBuby1yZXBlYXQgY2VudGVyIC8gY29udGFpbiAhaW1wb3J0YW50OwogIG1hc2s6IHVybCgiZGF0YTppbWFnZS9zdmcreG1sLCUzQ3N2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCAyNCAyNCclM0UlM0NwYXRoIGQ9J002IDE5YzAgMS4xLjkgMiAyIDJoOGMxLjEgMCAyLS45IDItMlY3SDZ2MTJ6TTE5IDRoLTMuNWwtMS0xaC01bC0xIDFINXYyaDE0VjR6Jy8lM0UlM0Mvc3ZnJTNFIikgbm8tcmVwZWF0IGNlbnRlciAvIGNvbnRhaW4gIWltcG9ydGFudDsKICBkaXNwbGF5OiBibG9jayAhaW1wb3J0YW50Owp9CgovKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09CiAgIDkuIE9WRVJMQVlTIE5BVElWT1MgREEgU0VTU8ODTyBERSBKT0dPCiAgID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi8KLyogT2N1bHRhIG9zIGJvdMO1ZXMgbW9iaWxlIGRvIHByw7NwcmlvIEJvb3N0ZXJvaWQsIGxpYmVyYW5kbyBhIHRlbGEgcGFyYSBub3NzbyBHYW1lcGFkIFZpcnR1YWwgKi8KI21lbnUubV9tZW51X3dyYXBwZXIgewogIG9wYWNpdHk6IDAgIWltcG9ydGFudDsKICBwb2ludGVyLWV2ZW50czogbm9uZSAhaW1wb3J0YW50OwogIHRyYW5zZm9ybTogc2NhbGUoMCkgIWltcG9ydGFudDsKICB6LWluZGV4OiAtOTk5OSAhaW1wb3J0YW50Owp9CgovKiBPY3VsdGEgYWxlcnRhcyBuYXRpdm9zICgiVG9xdWUgbmEgdGVsYSIsICJBdmlzbyBkZSByZWRlIGZyYWNhIikgcXVlIHBvbHVlbSBhIFVJIGR1cmFudGUgbyBqb2dvICovCi5pcGhvbmVfdGFwX21lc3NhZ2UsCi5tX2xhbl93cmFwcGVyIHsKICBkaXNwbGF5OiBub25lICFpbXBvcnRhbnQ7Cn0KCi8qIFJlbW92ZSBhIHByb3ByaWVkYWRlIHN0aWNreSAocXVlIGNhdXNhIGJ1Z3MgdmlzdWFpcyBubyB0b3BvKSBkYSBiYXJyYSBkZSBmaWx0cm8gbmF0aXZhICovCmZpbHRlci1jb250cm9sbGVyLXdpZGdldC5lbGVtZW50LXN0aWNreSB7CiAgcG9zaXRpb246IHN0YXRpYyAhaW1wb3J0YW50Owp9Ci8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09CiAgIFRFTUEgTUFURVJJQUwgWU9VIChNRDMpIC0gUMOBR0lOQSBERSBQRVJGSUwgRSBDT05GSUdVUkHDh8OVRVMKICAgRGVzY3Jpw6fDo286IEVzdGlsaXphw6fDo28gcHJlbWl1bSBlIGNvcnJlw6fDo28gcmVzcG9uc2l2YSBkZSB0b2RhcyBhcyBjb250YXMgZSBhanVzdGVzLgogICA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqLwoKLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PQogICAxLiBMQVlPVVQgR0VSQUwgRSBOQVZFR0HDh8ODTyBSRVNQT05TSVZBIChTSURFQkFSKQogICA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovCmJvZHkgLnByb2ZpbGUgLndyYXBwZXIgewogIGRpc3BsYXk6IGZsZXggIWltcG9ydGFudDsKICBtYXgtd2lkdGg6IDEwMCUgIWltcG9ydGFudDsKICBwYWRkaW5nOiAwICFpbXBvcnRhbnQ7CiAgZ2FwOiAyNHB4ICFpbXBvcnRhbnQ7CiAgYm94LXNpemluZzogYm9yZGVyLWJveCAhaW1wb3J0YW50Owp9Cgpib2R5IC5hY2NvdW50X19oZWFkaW5nIHsKICBjb2xvcjogdmFyKC0tbWQtc3lzLWNvbG9yLW9uLWJhY2tncm91bmQpICFpbXBvcnRhbnQ7CiAgZm9udC1zaXplOiAyOHB4ICFpbXBvcnRhbnQ7CiAgcGFkZGluZzogMjRweCAxMnB4IDE2cHggMTJweCAhaW1wb3J0YW50OwogIGZvbnQtd2VpZ2h0OiA3MDAgIWltcG9ydGFudDsKICBtYXJnaW46IDAgIWltcG9ydGFudDsKICBsZXR0ZXItc3BhY2luZzogLTAuNXB4ICFpbXBvcnRhbnQ7Cn0KCi8qIE5hdmVnYcOnw6NvIEhvcml6b250YWwgTW9iaWxlICovCkBtZWRpYSAobWF4LXdpZHRoOiA5MDBweCkgewogIGJvZHkgLnByb2ZpbGUgLndyYXBwZXIgeyBmbGV4LWRpcmVjdGlvbjogY29sdW1uICFpbXBvcnRhbnQ7IGdhcDogMCAhaW1wb3J0YW50OyB9CiAgYm9keSBzaWRlYmFyIHsKICAgIHdpZHRoOiAxMDAlICFpbXBvcnRhbnQ7IGhlaWdodDogYXV0byAhaW1wb3J0YW50OwogICAgcG9zaXRpb246IHN0aWNreSAhaW1wb3J0YW50OyB0b3A6IDAgIWltcG9ydGFudDsgei1pbmRleDogMTAwICFpbXBvcnRhbnQ7CiAgICBiYWNrZ3JvdW5kOiB2YXIoLS1tZC1zeXMtY29sb3ItYmFja2dyb3VuZCkgIWltcG9ydGFudDsKICAgIGJvcmRlci1ib3R0b206IDFweCBzb2xpZCB2YXIoLS1tZC1zeXMtY29sb3Itc3VyZmFjZS12YXJpYW50KSAhaW1wb3J0YW50OwogIH0KICBib2R5IC5wcm9maWxlX19uYXZpZ2F0aW9uIHsgd2lkdGg6IDEwMCUgIWltcG9ydGFudDsgcGFkZGluZzogMCAhaW1wb3J0YW50OyB9CiAgYm9keSAucHJvZmlsZV9fbmF2aWdhdGlvbi1ncmFkaWVudCB7IGRpc3BsYXk6IG5vbmUgIWltcG9ydGFudDsgfQogIAogIGJvZHkgLnByb2ZpbGVfX21haW4tbWVudSB7CiAgICBkaXNwbGF5OiBmbGV4ICFpbXBvcnRhbnQ7IGZsZXgtZGlyZWN0aW9uOiByb3cgIWltcG9ydGFudDsKICAgIGp1c3RpZnktY29udGVudDogZmxleC1zdGFydCAhaW1wb3J0YW50OyBvdmVyZmxvdy14OiBhdXRvICFpbXBvcnRhbnQ7CiAgICBnYXA6IDhweCAhaW1wb3J0YW50OyBwYWRkaW5nOiAxMnB4IDE2cHggIWltcG9ydGFudDsgbWFyZ2luOiAwICFpbXBvcnRhbnQ7CiAgICAtd2Via2l0LW92ZXJmbG93LXNjcm9sbGluZzogdG91Y2ggIWltcG9ydGFudDsKICB9CiAgYm9keSAucHJvZmlsZV9fbWFpbi1tZW51IGxpIHsgZmxleDogMCAwIGF1dG8gIWltcG9ydGFudDsgd2lkdGg6IGF1dG8gIWltcG9ydGFudDsgbWFyZ2luOiAwICFpbXBvcnRhbnQ7IH0KICBib2R5IC5wcm9maWxlX19tYWluLW1lbnUgYSB7CiAgICBkaXNwbGF5OiBmbGV4ICFpbXBvcnRhbnQ7IGFsaWduLWl0ZW1zOiBjZW50ZXIgIWltcG9ydGFudDsKICAgIHBhZGRpbmc6IDhweCAxNnB4ICFpbXBvcnRhbnQ7IGJvcmRlci1yYWRpdXM6IDEwMHB4ICFpbXBvcnRhbnQ7CiAgICBiYWNrZ3JvdW5kOiB2YXIoLS1tZC1zeXMtY29sb3Itc3VyZmFjZS1jb250YWluZXIpICFpbXBvcnRhbnQ7CiAgICBjb2xvcjogdmFyKC0tbWQtc3lzLWNvbG9yLW9uLWJhY2tncm91bmQpICFpbXBvcnRhbnQ7CiAgICB3aGl0ZS1zcGFjZTogbm93cmFwICFpbXBvcnRhbnQ7IGZvbnQtd2VpZ2h0OiA1MDAgIWltcG9ydGFudDsKICB9CiAgYm9keSAucHJvZmlsZV9fbWFpbi1tZW51IGEuYWN0aXZlIHsKICAgIGJhY2tncm91bmQ6IHZhcigtLW1kLXN5cy1jb2xvci1wcmltYXJ5LWNvbnRhaW5lcikgIWltcG9ydGFudDsKICAgIGNvbG9yOiB2YXIoLS1tZC1zeXMtY29sb3Itb24tcHJpbWFyeS1jb250YWluZXIpICFpbXBvcnRhbnQ7CiAgfQogIGJvZHkgLnByb2ZpbGVfX21haW4tbWVudSBhIHN2ZyB7IG1hcmdpbi1ib3R0b206IDAgIWltcG9ydGFudDsgbWFyZ2luLXJpZ2h0OiA4cHggIWltcG9ydGFudDsgfQogIGJvZHkgLnByb2ZpbGVfX21haW4tbWVudSBhLmFjdGl2ZSBzdmcgcGF0aCwKICBib2R5IC5wcm9maWxlX19tYWluLW1lbnUgYS5hY3RpdmUgc3ZnIGVsbGlwc2UsCiAgYm9keSAucHJvZmlsZV9fbWFpbi1tZW51IGEuYWN0aXZlIHN2ZyByZWN0IHsKICAgIGZpbGw6IHZhcigtLW1kLXN5cy1jb2xvci1vbi1wcmltYXJ5LWNvbnRhaW5lcikgIWltcG9ydGFudDsKICB9Cn0KCi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0KICAgMi4gUEFEUk9OSVpBw4fDg08gREUgQ0FSRFMgRSBDT05UQUlORVJTIChNRDMpCiAgID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi8KYm9keSAuYWNjb3VudF9fY29udGVudCwKYm9keSAuYWNjb3VudC1jb250ZW50X193cmFwIHsKICBtYXgtd2lkdGg6IDEwMCUgIWltcG9ydGFudDsKICBwYWRkaW5nOiAwIDhweCAhaW1wb3J0YW50OwogIGJveC1zaXppbmc6IGJvcmRlci1ib3ggIWltcG9ydGFudDsKfQoKYm9keSAuY29udGVudC1ib3hfX2NhcmQsCmJvZHkgLnN5bmMtcGxhdGZvcm0sCmJvZHkgLmhvdGtleS1zZXR0aW5nLApib2R5IC5hY2NvdW50LWRpc2NvcmQsCmJvZHkgLmNvbm5lY3QtYWNjb3VudF9fY2FyZCwKYm9keSAuZ3VpZGUtaW5uZXIgewogIGJhY2tncm91bmQ6IHZhcigtLW1kLXN5cy1jb2xvci1zdXJmYWNlLWNvbnRhaW5lcikgIWltcG9ydGFudDsKICBib3JkZXItcmFkaXVzOiAyNHB4ICFpbXBvcnRhbnQ7CiAgYm9yZGVyOiBub25lICFpbXBvcnRhbnQ7CiAgYm94LXNoYWRvdzogbm9uZSAhaW1wb3J0YW50OwogIHBhZGRpbmc6IDIwcHggIWltcG9ydGFudDsKICBtYXJnaW4tYm90dG9tOiAxNnB4ICFpbXBvcnRhbnQ7CiAgYm94LXNpemluZzogYm9yZGVyLWJveCAhaW1wb3J0YW50Owp9Cgpib2R5IC5jb250ZW50LWJveF9faGVhZC10aXRsZSwKYm9keSAuc3luYy1wbGF0Zm9ybV9fdGl0bGUsCmJvZHkgLmFjY291bnQtY29udGVudF9fZGlzY29yZC10aXRsZSB7CiAgY29sb3I6IHZhcigtLW1kLXN5cy1jb2xvci1wcmltYXJ5KSAhaW1wb3J0YW50OwogIGZvbnQtd2VpZ2h0OiA2MDAgIWltcG9ydGFudDsgZm9udC1zaXplOiAxM3B4ICFpbXBvcnRhbnQ7CiAgdGV4dC10cmFuc2Zvcm06IHVwcGVyY2FzZSAhaW1wb3J0YW50OyBsZXR0ZXItc3BhY2luZzogMC41cHggIWltcG9ydGFudDsKICBtYXJnaW4tYm90dG9tOiAxNnB4ICFpbXBvcnRhbnQ7IHBhZGRpbmctbGVmdDogOHB4ICFpbXBvcnRhbnQ7Cn0KCmJvZHkgLmNvbnRlbnQtYm94X190ZXh0LCBib2R5IC5wcm9maWxlLWRhdGFfX290aGVyLXRleHQsCmJvZHkgLmhvdGtleS1zZXR0aW5nX19kZXNjcmlwdGlvbiwgYm9keSAuY29ubmVjdC1hY2NvdW50X19pbmZvLXRleHQsCmJvZHkgLnN5bmMtcGxhdGZvcm1fX3RvcC1jYXB0aW9uIHsKICBjb2xvcjogdmFyKC0tbWQtc3lzLWNvbG9yLW91dGxpbmUpICFpbXBvcnRhbnQ7CiAgZm9udC1zaXplOiAxM3B4ICFpbXBvcnRhbnQ7IGxpbmUtaGVpZ2h0OiAxLjUgIWltcG9ydGFudDsKfQpib2R5IC5wcm9maWxlLWRhdGFfX25hbWUsIGJvZHkgLnN1YnNjcmlwdGlvbi1jYXJkX190aXRsZSwKYm9keSAuc3luYy1wbGF0Zm9ybV9fdXNlcm5hbWUgcCB7CiAgY29sb3I6IHZhcigtLW1kLXN5cy1jb2xvci1vbi1iYWNrZ3JvdW5kKSAhaW1wb3J0YW50OyBmb250LXdlaWdodDogNjAwICFpbXBvcnRhbnQ7Cn0KCi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0KICAgMy4gVE9HR0xFUyBNRDMgRSBCQURHRVMKICAgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqLwpib2R5IGFwcC1zd2l0Y2hlciB7IGRpc3BsYXk6IGlubGluZS1mbGV4ICFpbXBvcnRhbnQ7IGFsaWduLWl0ZW1zOiBjZW50ZXIgIWltcG9ydGFudDsgY3Vyc29yOiBwb2ludGVyICFpbXBvcnRhbnQ7IH0KYm9keSBhcHAtc3dpdGNoZXIgc3ZnIHsgd2lkdGg6IDQ0cHggIWltcG9ydGFudDsgaGVpZ2h0OiAyNnB4ICFpbXBvcnRhbnQ7IGRpc3BsYXk6IGJsb2NrICFpbXBvcnRhbnQ7IH0KYm9keSBhcHAtc3dpdGNoZXIgc3ZnIHJlY3QsIGJvZHkgYXBwLXN3aXRjaGVyIHN2ZyBjaXJjbGUgeyB0cmFuc2l0aW9uOiBhbGwgMC4zcyBjdWJpYy1iZXppZXIoMC4yLCAwLjgsIDAuMiwgMSkgIWltcG9ydGFudDsgfQoKYm9keSBhcHAtc3dpdGNoZXIgc3ZnOm5vdCgubm90LWFjdGl2ZSkgcmVjdCB7IGZpbGw6IHZhcigtLW1kLXN5cy1jb2xvci1wcmltYXJ5KSAhaW1wb3J0YW50OyBvcGFjaXR5OiAwLjQgIWltcG9ydGFudDsgfQpib2R5IGFwcC1zd2l0Y2hlciBzdmc6bm90KC5ub3QtYWN0aXZlKSBjaXJjbGUgeyBmaWxsOiB2YXIoLS1tZC1zeXMtY29sb3ItcHJpbWFyeSkgIWltcG9ydGFudDsgfQpib2R5IGFwcC1zd2l0Y2hlciBzdmcubm90LWFjdGl2ZSByZWN0IHsgZmlsbDogdmFyKC0tbWQtc3lzLWNvbG9yLXN1cmZhY2UtdmFyaWFudCkgIWltcG9ydGFudDsgb3BhY2l0eTogMSAhaW1wb3J0YW50OyB9CmJvZHkgYXBwLXN3aXRjaGVyIHN2Zy5ub3QtYWN0aXZlIGNpcmNsZSB7IGZpbGw6IHZhcigtLW1kLXN5cy1jb2xvci1vdXRsaW5lKSAhaW1wb3J0YW50OyB9CgovKiBCYWRnZSAiUE9ERSBKT0dBUiIgKFNhaSBvIFZlcmRlIE5lb24sIGVudHJhIG8gU29mdCBHcmVlbiBNRDMpICovCmJvZHkgLnBsYXktcG9zc2liaWxpdHktLXRydWUgewogIGJhY2tncm91bmQ6ICMwRjUyMjMgIWltcG9ydGFudDsgLyogVmVyZGUgRXNjdXJvIEZ1bmRvICovCiAgY29sb3I6ICM2REQ1OEMgIWltcG9ydGFudDsgLyogVmVyZGUgQ2xhcm8gVGV4dG8gKi8KICBwYWRkaW5nOiA0cHggMTJweCAhaW1wb3J0YW50OwogIGJvcmRlci1yYWRpdXM6IDEwMHB4ICFpbXBvcnRhbnQ7CiAgZm9udC13ZWlnaHQ6IDcwMCAhaW1wb3J0YW50OwogIGZvbnQtc2l6ZTogMTFweCAhaW1wb3J0YW50OwogIGxldHRlci1zcGFjaW5nOiAwLjVweCAhaW1wb3J0YW50OwogIHRleHQtdHJhbnNmb3JtOiB1cHBlcmNhc2UgIWltcG9ydGFudDsKfQoKLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PQogICA0LiBBIE1JTkhBIFNVQlNDUknDh8ODTwogICA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovCmJvZHkgLnN1YnNjcmlwdGlvbi1jYXJkX19jdXJyZW50IHsgZGlzcGxheTogZmxleCAhaW1wb3J0YW50OyBmbGV4LWRpcmVjdGlvbjogY29sdW1uICFpbXBvcnRhbnQ7IGdhcDogMTZweCAhaW1wb3J0YW50OyB9CmJvZHkgLnN1YnNjcmlwdGlvbi1jYXJkX19oZWFkZXIgeyBkaXNwbGF5OiBmbGV4ICFpbXBvcnRhbnQ7IGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbiAhaW1wb3J0YW50OyBhbGlnbi1pdGVtczogZmxleC1zdGFydCAhaW1wb3J0YW50OyBmbGV4LXdyYXA6IHdyYXAgIWltcG9ydGFudDsgZ2FwOiAxMnB4ICFpbXBvcnRhbnQ7IH0KYm9keSAuc3Vic2NyaXB0aW9uLWNhcmRfX3N0YXR1cyB7IGJhY2tncm91bmQ6IHZhcigtLW1kLXN5cy1jb2xvci1zdXJmYWNlLXZhcmlhbnQpICFpbXBvcnRhbnQ7IGNvbG9yOiB2YXIoLS1tZC1zeXMtY29sb3Itb24tYmFja2dyb3VuZCkgIWltcG9ydGFudDsgcGFkZGluZzogNHB4IDEycHggIWltcG9ydGFudDsgYm9yZGVyLXJhZGl1czogMTAwcHggIWltcG9ydGFudDsgZm9udC1zaXplOiAxMXB4ICFpbXBvcnRhbnQ7IGZvbnQtd2VpZ2h0OiA3MDAgIWltcG9ydGFudDsgbGV0dGVyLXNwYWNpbmc6IDAuNXB4ICFpbXBvcnRhbnQ7IHRleHQtdHJhbnNmb3JtOiB1cHBlcmNhc2UgIWltcG9ydGFudDsgfQpib2R5IC5zdWJzY3JpcHRpb24tY2FyZF9fZm9vdGVyIHsgZGlzcGxheTogZmxleCAhaW1wb3J0YW50OyBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW4gIWltcG9ydGFudDsgYWxpZ24taXRlbXM6IGNlbnRlciAhaW1wb3J0YW50OyBmbGV4LXdyYXA6IHdyYXAgIWltcG9ydGFudDsgZ2FwOiAxNnB4ICFpbXBvcnRhbnQ7IGJhY2tncm91bmQ6IHRyYW5zcGFyZW50ICFpbXBvcnRhbnQ7IHBhZGRpbmc6IDAgIWltcG9ydGFudDsgYm9yZGVyOiBub25lICFpbXBvcnRhbnQ7IH0KCi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0KICAgNS4gTElHQcOHw5VFUyAoU1RFQU0sIFhCT1gsIFdPVCwgWU9VVFVCRSkgRSBCT1TDlUVTCiAgID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi8KYm9keSAuc3luYy1wbGF0Zm9ybSwgYm9keSAuY29ubmVjdC1hY2NvdW50X19jYXJkIHsgZGlzcGxheTogZmxleCAhaW1wb3J0YW50OyBmbGV4LWRpcmVjdGlvbjogY29sdW1uICFpbXBvcnRhbnQ7IGdhcDogMTZweCAhaW1wb3J0YW50OyB9CmJvZHkgLnN5bmMtcGxhdGZvcm1fX2JvZHksIGJvZHkgLmNvbnRlbnQtYm94X19mbGV4LWxpbmUgeyBkaXNwbGF5OiBmbGV4ICFpbXBvcnRhbnQ7IGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbiAhaW1wb3J0YW50OyBhbGlnbi1pdGVtczogY2VudGVyICFpbXBvcnRhbnQ7IGZsZXgtd3JhcDogd3JhcCAhaW1wb3J0YW50OyBnYXA6IDE2cHggIWltcG9ydGFudDsgfQpib2R5IC5zeW5jLXBsYXRmb3JtX19sZWZ0LXNpZGUgeyBkaXNwbGF5OiBmbGV4ICFpbXBvcnRhbnQ7IGFsaWduLWl0ZW1zOiBjZW50ZXIgIWltcG9ydGFudDsgZ2FwOiAxMnB4ICFpbXBvcnRhbnQ7IH0KCi8qIE8gU0VHUkVET1MgRE9TIEJPVMOVRVM6IEZvcsOnYSBhIE7Dg08gZXN0aWNhcmVtIGUgcGFkcm9uaXphIGEgZXN0w6l0aWNhICovCmJvZHkgLnN5bmMtcGxhdGZvcm1fX2J1dHRvbiwgYm9keSAuY29udGVudC1ib3hfX2NvbnRyb2wtYnRuLCAKYm9keSAuc3Vic2NyaXB0aW9uLWNhcmRfX2luZm8tYnV0dG9uLCBib2R5IC5ob3RrZXktc2V0dGluZ19fcmVzZXQtYnRuIHsKICBiYWNrZ3JvdW5kOiB2YXIoLS1tZC1zeXMtY29sb3Itc3VyZmFjZS12YXJpYW50KSAhaW1wb3J0YW50OwogIGNvbG9yOiB2YXIoLS1tZC1zeXMtY29sb3Itb24tYmFja2dyb3VuZCkgIWltcG9ydGFudDsKICBib3JkZXItcmFkaXVzOiAxMDBweCAhaW1wb3J0YW50OyBwYWRkaW5nOiAxMHB4IDIwcHggIWltcG9ydGFudDsKICBmb250LXdlaWdodDogNjAwICFpbXBvcnRhbnQ7IGZvbnQtc2l6ZTogMTNweCAhaW1wb3J0YW50OwogIGRpc3BsYXk6IGZsZXggIWltcG9ydGFudDsgYWxpZ24taXRlbXM6IGNlbnRlciAhaW1wb3J0YW50OyBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlciAhaW1wb3J0YW50OwogIGdhcDogOHB4ICFpbXBvcnRhbnQ7IGJvcmRlcjogbm9uZSAhaW1wb3J0YW50OyBib3gtc2hhZG93OiBub25lICFpbXBvcnRhbnQ7CiAgaGVpZ2h0OiBhdXRvICFpbXBvcnRhbnQ7IG1hcmdpbjogMCAhaW1wb3J0YW50OwogIHdpZHRoOiBtYXgtY29udGVudCAhaW1wb3J0YW50OyAvKiBJTVBFREUgQk9Uw5VFUyBERSBFU1RJQ0FSRU0gKi8KICBmbGV4OiBub25lICFpbXBvcnRhbnQ7IC8qIElNUEVERSBCT1TDlUVTIERFIEVTVElDQVJFTSAqLwogIHRleHQtdHJhbnNmb3JtOiBub25lICFpbXBvcnRhbnQ7IC8qIFJlbW92ZSBvIEFMTCBDQVBTIGZlaW8gZG8gQm9vc3Rlcm9pZCAqLwp9CmJvZHkgLnN5bmMtcGxhdGZvcm1fX2J1dHRvbnMgeyBkaXNwbGF5OiBmbGV4ICFpbXBvcnRhbnQ7IGdhcDogMTJweCAhaW1wb3J0YW50OyBmbGV4LXdyYXA6IHdyYXAgIWltcG9ydGFudDsganVzdGlmeS1jb250ZW50OiBmbGV4LWVuZCAhaW1wb3J0YW50OyB9CgovKiBGb3JtYXRhw6fDo28gZmluYSBkZSDDrWNvbmVzIGRlbnRybyBkb3MgYm90w7VlcyAqLwpib2R5IC5zeW5jLXBsYXRmb3JtX19idXR0b24gcCwgYm9keSAuY29udGVudC1ib3hfX2NvbnRyb2wtYnRuIHNwYW4geyBjb2xvcjogdmFyKC0tbWQtc3lzLWNvbG9yLW9uLWJhY2tncm91bmQpICFpbXBvcnRhbnQ7IG1hcmdpbjogMCAhaW1wb3J0YW50OyB0ZXh0LXRyYW5zZm9ybTogY2FwaXRhbGl6ZSAhaW1wb3J0YW50OyB9CmJvZHkgLmNvbnRlbnQtYm94X19jb250cm9sLWJ0biBzdmcgcGF0aCB7IGZpbGw6IHZhcigtLW1kLXN5cy1jb2xvci1vbi1iYWNrZ3JvdW5kKSAhaW1wb3J0YW50OyB9CmJvZHkgLnN5bmMtcGxhdGZvcm1fX2J1dHRvbiBpbWcsIGJvZHkgLmNvbnRlbnQtYm94X19jb250cm9sLWJ0biBpbWcgeyAKICB3aWR0aDogMThweCAhaW1wb3J0YW50OyBoZWlnaHQ6IDE4cHggIWltcG9ydGFudDsgb2JqZWN0LWZpdDogY29udGFpbiAhaW1wb3J0YW50OwogIGZpbHRlcjogYnJpZ2h0bmVzcygwKSBpbnZlcnQoMSkgb3BhY2l0eSgwLjkpICFpbXBvcnRhbnQ7IC8qIFJlbW92ZSBhcyBjb3JlcyBlc3RyYW5oYXMgb3JpZ2luYWlzIChjb21vIG8gcm9zYSkgKi8KfQoKLyogVHJhdGFtZW50byB2aXN1YWwgcGFyYSBCb3TDtWVzIGRlIEVycm8vRGVzY29uZWN0YXIgKi8KYm9keSAuc3luYy1wbGF0Zm9ybV9fYnV0dG9uOmZpcnN0LWNoaWxkIHAsCmJvZHkgLmNvbnRlbnQtYm94X19jb250cm9scy0tcGIgLmNvbnRlbnQtYm94X19jb250cm9sLWJ0biBzcGFuIHsgY29sb3I6ICNmZmI0YWIgIWltcG9ydGFudDsgfQpib2R5IC5zeW5jLXBsYXRmb3JtX19idXR0b246Zmlyc3QtY2hpbGQgaW1nIHsgZmlsdGVyOiBpbnZlcnQoNzUlKSBzZXBpYSgyMSUpIHNhdHVyYXRlKDE0NzYlKSBodWUtcm90YXRlKDMwOWRlZykgYnJpZ2h0bmVzcygxMDElKSBjb250cmFzdCgxMDUlKSAhaW1wb3J0YW50OyB9CmJvZHkgLmNvbnRlbnQtYm94X19jb250cm9scy0tcGIgLmNvbnRlbnQtYm94X19jb250cm9sLWJ0biBzdmcgcGF0aCB7IGZpbGw6ICNmZmI0YWIgIWltcG9ydGFudDsgfQoKYm9keSAuc3luYy1wbGF0Zm9ybV9fdG9wIHsgZGlzcGxheTogZmxleCAhaW1wb3J0YW50OyBmbGV4LWRpcmVjdGlvbjogY29sdW1uICFpbXBvcnRhbnQ7IGdhcDogNHB4ICFpbXBvcnRhbnQ7IHBhZGRpbmctdG9wOiAxMnB4ICFpbXBvcnRhbnQ7IGJvcmRlci10b3A6IDFweCBzb2xpZCB2YXIoLS1tZC1zeXMtY29sb3Itc3VyZmFjZS12YXJpYW50KSAhaW1wb3J0YW50OyB9CgovKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09CiAgIDYuIENPTlbDjVZJTyAoRElTQ09SRCBFIFRFTEVHUkFNKQogICA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovCmJvZHkgLmFjY291bnQtZGlzY29yZCB7IGRpc3BsYXk6IGZsZXggIWltcG9ydGFudDsganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuICFpbXBvcnRhbnQ7IGFsaWduLWl0ZW1zOiBjZW50ZXIgIWltcG9ydGFudDsgdGV4dC1kZWNvcmF0aW9uOiBub25lICFpbXBvcnRhbnQ7IHBhZGRpbmc6IDE2cHggMjBweCAhaW1wb3J0YW50OyB9CmJvZHkgLmFjY291bnQtZGlzY29yZDpob3ZlciB7IGJhY2tncm91bmQ6IHZhcigtLW1kLXN5cy1jb2xvci1zdXJmYWNlLWNvbnRhaW5lci1oaWdoKSAhaW1wb3J0YW50OyB9CmJvZHkgLmFjY291bnQtZGlzY29yZF9faW5uZXIgeyBkaXNwbGF5OiBmbGV4ICFpbXBvcnRhbnQ7IGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbiAhaW1wb3J0YW50OyBhbGlnbi1pdGVtczogY2VudGVyICFpbXBvcnRhbnQ7IHdpZHRoOiAxMDAlICFpbXBvcnRhbnQ7IGdhcDogMTZweCAhaW1wb3J0YW50OyB9CmJvZHkgLmFjY291bnQtZGlzY29yZF9faW5uZXIgaDMgeyBjb2xvcjogdmFyKC0tbWQtc3lzLWNvbG9yLW9uLWJhY2tncm91bmQpICFpbXBvcnRhbnQ7IGZvbnQtd2VpZ2h0OiA2MDAgIWltcG9ydGFudDsgZm9udC1zaXplOiAxNHB4ICFpbXBvcnRhbnQ7IG1hcmdpbjogMCAhaW1wb3J0YW50OyB9Ci8qIEdhcmFudGUgcXVlIGEgbG9nbyBkbyBEaXNjb3JkL1RlbGVncmFtIG7Do28gZGlzdG9yw6dhICovCmJvZHkgLmFjY291bnQtZGlzY29yZF9faW5uZXIgaW1nIHsgaGVpZ2h0OiAzMnB4ICFpbXBvcnRhbnQ7IHdpZHRoOiBhdXRvICFpbXBvcnRhbnQ7IG9iamVjdC1maXQ6IGNvbnRhaW4gIWltcG9ydGFudDsgfQoKLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PQogICA3LiBST0RBUMOJIChGT09URVIpCiAgID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi8KYm9keSAuZm9vdGVyIHsgZGlzcGxheTogZmxleCAhaW1wb3J0YW50OyBmbGV4LWRpcmVjdGlvbjogY29sdW1uICFpbXBvcnRhbnQ7IGFsaWduLWl0ZW1zOiBjZW50ZXIgIWltcG9ydGFudDsgZ2FwOiAyNHB4ICFpbXBvcnRhbnQ7IHBhZGRpbmc6IDI0cHggIWltcG9ydGFudDsgfQpib2R5IC5mb290ZXJfX21lbnUgeyBkaXNwbGF5OiBmbGV4ICFpbXBvcnRhbnQ7IGdhcDogMTZweCAhaW1wb3J0YW50OyBmbGV4LXdyYXA6IHdyYXAgIWltcG9ydGFudDsganVzdGlmeS1jb250ZW50OiBjZW50ZXIgIWltcG9ydGFudDsgcGFkZGluZzogMCAhaW1wb3J0YW50OyBsaXN0LXN0eWxlOiBub25lICFpbXBvcnRhbnQ7IH0KYm9keSAuZm9vdGVyX19tZW51IGEgeyBjb2xvcjogdmFyKC0tbWQtc3lzLWNvbG9yLW91dGxpbmUpICFpbXBvcnRhbnQ7IHRleHQtZGVjb3JhdGlvbjogbm9uZSAhaW1wb3J0YW50OyBmb250LXNpemU6IDEzcHggIWltcG9ydGFudDsgZm9udC13ZWlnaHQ6IDUwMCAhaW1wb3J0YW50OyB0cmFuc2l0aW9uOiBjb2xvciAwLjJzICFpbXBvcnRhbnQ7IH0KYm9keSAuZm9vdGVyX19tZW51IGE6aG92ZXIgeyBjb2xvcjogdmFyKC0tbWQtc3lzLWNvbG9yLXByaW1hcnkpICFpbXBvcnRhbnQ7IH0KLyogUmVmaW5hIG8gYm90w6NvIGRlICJFbGltaW5hciBDb250YSIgcGFyYSBzZXIgdW0gYm90w6NvIE91dGxpbmVkIGRlIEVycm8gKi8KYm9keSAuZm9vdGVyX19kZWxldGUtYWNjb3VudCB7CiAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQgIWltcG9ydGFudDsKICBjb2xvcjogI2ZmYjRhYiAhaW1wb3J0YW50OwogIGJvcmRlcjogMXB4IHNvbGlkICNmZmI0YWIgIWltcG9ydGFudDsKICBib3JkZXItcmFkaXVzOiAxMDBweCAhaW1wb3J0YW50OwogIHBhZGRpbmc6IDEwcHggMjRweCAhaW1wb3J0YW50OwogIGZvbnQtd2VpZ2h0OiA2MDAgIWltcG9ydGFudDsKICBmb250LXNpemU6IDEzcHggIWltcG9ydGFudDsKICB0ZXh0LXRyYW5zZm9ybTogbm9uZSAhaW1wb3J0YW50OwogIGN1cnNvcjogcG9pbnRlciAhaW1wb3J0YW50Owp9CgovKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09CiAgIDguIERFVEFMSEVTIERFIExBWU9VVCBFIEZPUk1TIChBVkFUQVIgRSBEUk9QRE9XTikKICAgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqLwpib2R5IC5zZWxlY3RfX21haW4uc2VsZWN0X19tYWluIHsgYmFja2dyb3VuZDogdmFyKC0tbWQtc3lzLWNvbG9yLXN1cmZhY2UtdmFyaWFudCkgIWltcG9ydGFudDsgYm9yZGVyLXJhZGl1czogMTAwcHggIWltcG9ydGFudDsgcGFkZGluZzogMTBweCAyMHB4ICFpbXBvcnRhbnQ7IGNvbG9yOiB2YXIoLS1tZC1zeXMtY29sb3Itb24tYmFja2dyb3VuZCkgIWltcG9ydGFudDsgZm9udC13ZWlnaHQ6IDUwMCAhaW1wb3J0YW50OyB9CmJvZHkgaHIgeyBib3JkZXItY29sb3I6IHZhcigtLW1kLXN5cy1jb2xvci1zdXJmYWNlLXZhcmlhbnQpICFpbXBvcnRhbnQ7IG1hcmdpbjogMjRweCAwICFpbXBvcnRhbnQ7IG9wYWNpdHk6IDAuNSAhaW1wb3J0YW50OyB9Cgpib2R5IC53YXJuaW5nIHsgYmFja2dyb3VuZDogcmdiYSgyNDUsIDIwMCwgMCwgMC4xKSAhaW1wb3J0YW50OyBib3JkZXI6IDFweCBzb2xpZCByZ2JhKDI0NSwgMjAwLCAwLCAwLjIpICFpbXBvcnRhbnQ7IGJvcmRlci1yYWRpdXM6IDE2cHggIWltcG9ydGFudDsgcGFkZGluZzogMTZweCAhaW1wb3J0YW50OyBtYXJnaW4tdG9wOiAxNnB4ICFpbXBvcnRhbnQ7IGRpc3BsYXk6IGZsZXggIWltcG9ydGFudDsgYWxpZ24taXRlbXM6IGZsZXgtc3RhcnQgIWltcG9ydGFudDsgZ2FwOiAxMnB4ICFpbXBvcnRhbnQ7IH0KYm9keSAud2FybmluZyBwIHsgbWFyZ2luOiAwICFpbXBvcnRhbnQ7IGZvbnQtc2l6ZTogMTNweCAhaW1wb3J0YW50OyBjb2xvcjogdmFyKC0tbWQtc3lzLWNvbG9yLW9uLWJhY2tncm91bmQpICFpbXBvcnRhbnQ7IGxpbmUtaGVpZ2h0OiAxLjUgIWltcG9ydGFudDsgfQpib2R5IC53YXJuaW5nIHN2ZyBwYXRoIHsgZmlsbDogdmFyKC0tbWQtc3lzLWNvbG9yLXByaW1hcnkpICFpbXBvcnRhbnQ7IH0KCi8qIENvcnJlw6fDtWVzIGVzcGVjw61maWNhcyBwYXJhIE1vYmlsZSAoVGVsYXMgcGVxdWVuYXMpICovCkBtZWRpYSAobWF4LXdpZHRoOiA2MDBweCkgewogIGJvZHkgLnVzZXItaW5mbyAuY29udGVudC1ib3hfX2NhcmQgeyBmbGV4LWRpcmVjdGlvbjogY29sdW1uICFpbXBvcnRhbnQ7IGFsaWduLWl0ZW1zOiBjZW50ZXIgIWltcG9ydGFudDsgdGV4dC1hbGlnbjogY2VudGVyICFpbXBvcnRhbnQ7IH0KICBib2R5IC51c2VyLWluZm9fX3Byb2ZpbGUtaW1nIHsgbWFyZ2luLXJpZ2h0OiAwICFpbXBvcnRhbnQ7IG1hcmdpbi1ib3R0b206IDE2cHggIWltcG9ydGFudDsgfQogIGJvZHkgLnVzZXItaW5mb19fcHJvZmlsZS1kYXRhIHsgYWxpZ24taXRlbXM6IGNlbnRlciAhaW1wb3J0YW50OyB3aWR0aDogMTAwJSAhaW1wb3J0YW50OyB9CiAgYm9keSAucHJvZmlsZS1kYXRhX19zb2NpYWxzLWl0ZW0sIGJvZHkgLnByb2ZpbGUtZGF0YV9fb3RoZXItaXRlbSB7IGp1c3RpZnktY29udGVudDogY2VudGVyICFpbXBvcnRhbnQ7IH0KICBib2R5IC5jb250ZW50LWJveF9faGVhZC1jb250cm9scyB7IHdpZHRoOiAxMDAlICFpbXBvcnRhbnQ7IGp1c3RpZnktY29udGVudDogY2VudGVyICFpbXBvcnRhbnQ7IH0KICBib2R5IC5zeW5jLXBsYXRmb3JtX19ib2R5IHsgZmxleC1kaXJlY3Rpb246IGNvbHVtbiAhaW1wb3J0YW50OyBhbGlnbi1pdGVtczogZmxleC1zdGFydCAhaW1wb3J0YW50OyBnYXA6IDIwcHggIWltcG9ydGFudDsgfQogIGJvZHkgLnN5bmMtcGxhdGZvcm1fX2J1dHRvbnMgeyB3aWR0aDogMTAwJSAhaW1wb3J0YW50OyBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW4gIWltcG9ydGFudDsgfQogIGJvZHkgLnN5bmMtcGxhdGZvcm1fX2J1dHRvbiB7IGZsZXg6IDEgIWltcG9ydGFudDsganVzdGlmeS1jb250ZW50OiBjZW50ZXIgIWltcG9ydGFudDsgfQp9Cg==');
      document.head.appendChild(style);
    };
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', injectTheme); } 
    else { injectTheme(); }
  }
})();
