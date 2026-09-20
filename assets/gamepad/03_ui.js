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
    up: `<svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>`,
    down: `<svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>`,
    left: `<svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>`,
    right: `<svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>`,
    menu: `<svg viewBox="0 0 24 24"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
    view: `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>`,
    home: `<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`
  };

  function renderUI() {
    if (document.getElementById('vpad-root')) return;

    const style = document.createElement('style');
    style.textContent = `
      #vpad-root { position: fixed; inset: 0; z-index: 2147483647; pointer-events: none; user-select: none; -webkit-user-select: none; touch-action: none; overflow: hidden; font-family: system-ui, sans-serif; }
      
      .vpad-glass-btn { display: flex; align-items: center; justify-content: center; gap: 6px; background: rgba(255, 255, 255, 0.15); border: 2px solid rgba(255, 255, 255, 0.35); color: #fff; font-weight: 700; backdrop-filter: blur(var(--blur-val, 4px)); transition: background 0.1s; pointer-events: auto; touch-action: none; }
      .vpad-glass-btn:active, .vpad-glass-btn.active-press { background: rgba(255, 255, 255, 0.45); }
      .vpad-glass-btn svg { stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
      
      #vpad-top-bar { position: absolute; top: calc(10px + env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); display: flex; gap: 10px; pointer-events: auto; }
      .vpad-top-btn { padding: 8px 16px; font-size: 11px; border-radius: 24px; transition: border-color 0.2s, color 0.2s, background 0.2s; }
      .vpad-top-btn svg { width: 14px; height: 14px; }
      .vpad-top-btn.is-off { border-color: rgba(255,100,100,0.6); color: #ffbaba; background: rgba(80,0,0,0.4); }
      .vpad-top-btn.is-edit { border-color: #ffeb3b; color: #ffeb3b; }
      
      #vpad-edit-panel { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); background: rgba(20, 20, 25, 0.85); border: 1px solid rgba(255,255,255,0.2); border-radius: 16px; padding: 0; display: none; flex-direction: column; pointer-events: auto; backdrop-filter: blur(8px); z-index: 9999; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
      #vpad-edit-panel.visible { display: flex; }
      #vpad-edit-header { background: rgba(255, 255, 255, 0.1); padding: 10px; text-align: center; font-size: 10px; font-weight: bold; color: #aaa; text-transform: uppercase; border-radius: 16px 16px 0 0; cursor: move; touch-action: none; border-bottom: 1px solid rgba(255,255,255,0.1); }
      
      /* Grid ajustado para 6 botões */
      .vpad-edit-body { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 16px; }
      .vpad-edit-btn { padding: 10px 8px; border-radius: 12px; font-size: 9px; flex-direction: column; gap: 4px; text-align: center; }
      .vpad-edit-btn svg { width: 16px; height: 16px; }
      
      .vpad-hidden { display: none !important; }
      
      /* A Opacidade agora é controlada na raiz de cada elemento flutuante */
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
