  // --- INIT: Inicialização e Eventos Globais ---
  
  // Função para forçar um clique num elemento nativo do Boosteroid
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

  function initGamepad() {
    renderUI();
    initEditLogic();
    initInputs();

    const toggleBtn = document.getElementById('vpad-toggle-btn');
    const controlsContainer = document.getElementById('vpad-controls-container');

    // Botões de Interação Nativa do Boosteroid
    document.getElementById('vpad-exit-btn').addEventListener('click', (e) => {
      silenceEvent(e);
      clickNativeBoosteroidElement('close-session-control');
    }, { capture: true });

    document.getElementById('vpad-mic-btn').addEventListener('click', (e) => {
      silenceEvent(e);
      clickNativeBoosteroidElement('mic-control');
    }, { capture: true });

    document.getElementById('vpad-kb-btn').addEventListener('click', (e) => {
      silenceEvent(e);
      clickNativeBoosteroidElement('keyboard-control');
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

    setTimeout(notifyConnected, 400);
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initGamepad); } 
  else { initGamepad(); }
