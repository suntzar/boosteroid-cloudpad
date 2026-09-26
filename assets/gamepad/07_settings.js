  // --- SETTINGS: Aba Customizada do CloudPad no Perfil ---
  function injectProfileTab() {
    const menu = document.querySelector('.profile__main-menu');
    const contentWrapper = document.querySelector('.profile__content');
    
    if (!menu || !contentWrapper) return;
    if (document.getElementById('vpad-profile-tab')) return;

    // 1. Cria a Aba Lateral
    const li = document.createElement('li');
    li.innerHTML = `
      <a href="#" id="vpad-profile-tab">
        <svg-icon>
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="6" width="20" height="12" rx="6"></rect>
            <circle cx="6" cy="12" r="1"></circle>
            <circle cx="18" cy="12" r="1"></circle>
            <path d="M10 12h.01M14 12h.01"></path>
          </svg>
        </svg-icon>
        <span>CloudPad</span>
      </a>
    `;
    menu.prepend(li);

    // 2. Cria o Painel Central de Configurações
    const panel = document.createElement('div');
    panel.id = 'vpad-settings-panel';
    panel.className = 'account';
    panel.style.display = 'none';
    
    panel.innerHTML = `
      <h1 class="account__heading">CloudPad Settings</h1>
      <div class="account-content__wrap">
        <div class="content-box__card">
          <h5 class="content-box__head-title">Integração do Controle Virtual</h5>
          
          <div class="content-box__flex-line content-box__switch-connections">
            <div>Teclado Mágico (Shift+Tab)</div>
            <app-switcher id="vpad-setting-steam" class="${homeIsSteam ? '' : 'not-active'}">
              <svg viewBox="0 0 24 14"><rect opacity="0.3" y="2" width="24" height="10" rx="5"></rect><circle cx="17" cy="7" r="7"></circle></svg>
            </app-switcher>
          </div>
          <div class="content-box_flex-line content-box__text">
            <span>Converte o botão HOME para abrir o painel da Steam nativamente (Integrado ao localStorage).</span>
          </div>
          
          <hr>
          
          <div class="content-box__flex-line content-box__switch-connections">
            <div>Vibração Nativa (Haptics)</div>
            <app-switcher id="vpad-setting-haptics" class="not-active">
              <svg viewBox="0 0 24 14"><rect opacity="0.3" y="2" width="24" height="10" rx="5"></rect><circle cx="17" cy="7" r="7"></circle></svg>
            </app-switcher>
          </div>
          <div class="content-box_flex-line content-box__text">
            <span>Ativa o feedback tátil do celular ao pressionar os botões virtuais (Em desenvolvimento).</span>
          </div>

        </div>
      </div>
    `;
    contentWrapper.appendChild(panel);

    const ourTab = document.getElementById('vpad-profile-tab');
    
    // 3. Lógica de Alternância de Abas
    ourTab.addEventListener('click', (e) => {
      e.preventDefault();
      document.body.classList.add('vpad-settings-active');
      panel.style.display = 'block';
      
      menu.querySelectorAll('a').forEach(a => a.classList.remove('active'));
      ourTab.classList.add('active');
    });

    menu.addEventListener('click', (e) => {
      const clickedA = e.target.closest('a');
      if (clickedA && clickedA.id !== 'vpad-profile-tab') {
        document.body.classList.remove('vpad-settings-active');
        panel.style.display = 'none';
        ourTab.classList.remove('active');
      }
    });
    
    // 4. Lógica Funcional dos Toggles
    document.getElementById('vpad-setting-steam').addEventListener('click', function() {
      this.classList.toggle('not-active');
      homeIsSteam = !this.classList.contains('not-active');
      saveLayout();
    });
    
    document.getElementById('vpad-setting-haptics').addEventListener('click', function() {
      this.classList.toggle('not-active');
    });
  }
