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
