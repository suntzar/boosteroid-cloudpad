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
