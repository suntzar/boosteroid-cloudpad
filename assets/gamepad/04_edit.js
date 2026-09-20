  // --- EDIT MODE: Drag & Drop, Redimensionamento, Opacidade, Blur ---
  let activeEditElement = null;
  let dragData = null;
  let panelDrag = null;

  function initEditLogic() {
    const editToggleBtn = document.getElementById('vpad-edit-toggle-btn');
    const editPanel = document.getElementById('vpad-edit-panel');
    
    // Atualiza o estado do texto do botão Blur com base no botão selecionado
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

    // Modificadores Visuais e Físicos
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

    // Painel Flutuante Drag
    const editHeader = document.getElementById('vpad-edit-header');
    editHeader.addEventListener('touchstart', (e) => {
      silenceEvent(e);
      const touch = e.touches[0]; const rect = editPanel.getBoundingClientRect();
      editPanel.style.left = `${rect.left}px`; editPanel.style.top = `${rect.top}px`; editPanel.style.transform = 'none';
      panelDrag = { id: touch.identifier, startX: touch.clientX, startY: touch.clientY, startLeft: rect.left, startTop: rect.top };
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

    // Seleção e Arrastar de Botões
    document.addEventListener('touchstart', (e) => {
      if (!isEditMode || e.target.closest('#vpad-edit-panel')) return;
      const el = e.target.closest('.vpad-element');
      if (activeEditElement && activeEditElement !== el) activeEditElement.classList.remove('selected');
      if (!el) { activeEditElement = null; return; }
      
      silenceEvent(e);
      activeEditElement = el; 
      activeEditElement.classList.add('selected');
      updatePanelState(); // Sincroniza o toggle BLUR ON/OFF com o botão recém-tocado

      const touch = e.touches[0]; const rect = el.getBoundingClientRect();
      dragData = { id: touch.identifier, startX: touch.clientX, startY: touch.clientY, startLeft: rect.left, startTop: rect.top };
    }, { capture: true, passive: false });

    document.addEventListener('touchmove', (e) => {
      if (!isEditMode || !dragData || !activeEditElement) return; silenceEvent(e);
      for (let touch of e.changedTouches) {
        if (touch.identifier === dragData.id) {
          const newLeft = ((dragData.startLeft + (touch.clientX - dragData.startX)) / window.innerWidth) * 100;
          const newTop = ((dragData.startTop + (touch.clientY - dragData.startY)) / window.innerHeight) * 100;
          activeEditElement.style.left = `${newLeft}vw`; activeEditElement.style.top = `${newTop}vh`;
        }
      }
    }, { capture: true, passive: false });

    document.addEventListener('touchend', (e) => {
      if (!isEditMode || !dragData) return;
      for (let touch of e.changedTouches) { if (touch.identifier === dragData.id) dragData = null; }
    }, { capture: true });
  }
