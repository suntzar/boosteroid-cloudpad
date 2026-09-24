# Boosteroid CloudPad

Uma aplicação Android nativa e Userscript, desenvolvida do zero para entregar uma experiência otimizada de Cloud Gaming no Boosteroid. Focada em performance, usabilidade e ausência de distrações visuais.

Projeto construído inteiramente via Termux (sem dependência de Android Studio ou Gradle).

## Recursos Principais

*   **Controle Virtual XInput Completo:** Dual sticks virtuais precisos, D-Pad, Gatilhos (LT/RT), Bumpers (LB/RB) e cliques dos analógicos (L3/R3).
*   **Auto-Toggle Inteligente:** O overlay identifica o roteamento da aplicação (SPA) e habilita o controle virtual automaticamente apenas durante as sessões ativas de streaming.
*   **Modo de Edição (Drag & Drop):** Redimensione, reposicione, altere a opacidade e o desfoque de cada componente individualmente. O layout é persistido no armazenamento local (`localStorage`).
*   **Emulação de Teclado Avançada:** Interceptação do botão "HOME" para injeção de eventos de teclado (Shift+Tab), acionando a interface da Steam nativamente na nuvem.
*   **Integração de Hardware (Ponte Java-JS):** Suporte completo à captação de Microfone (WebRTC), leitura segura da Área de Transferência via `JavascriptInterface` nativa e interceptação de controles internos do Boosteroid através de `MutationObserver`.
*   **Tema Material You (MD3):** Interface polida, cantos arredondados, remoção de banners e bloqueio de poluição visual/elementos redundantes da dashboard padrão do serviço.
*   **Immersive Mode (Android):** Ocultação da barra de navegação e preenchimento total da tela (`layoutInDisplayCutoutMode`), com suporte a rotação livre irrestrita (`fullSensor`).
*   **Cross-Platform:** Disponível como aplicativo Android nativo ou como Userscript independente para navegadores desktop (Tampermonkey/Violentmonkey).

## Autenticação e Segurança

O aplicativo suporta nativamente o "Sign in with Google" (OAuth). A restrição de segurança padrão imposta pelo Google em ambientes WebView (`disallowed_useragent`) foi solucionada através de um bypass dinâmico de User-Agent, garantindo a autenticação segura do usuário sem a necessidade de expor ou manipular cookies e tokens de sessão.

## Como Compilar Localmente (Via Termux)

O projeto suporta a compilação do APK nativo e a geração do Userscript de forma independente diretamente pelo terminal.

### 1. Preparação do Ambiente
Instale as dependências e realize o download do Android SDK:
```bash
bash setup.sh
```

Conceda permissão de armazenamento (necessário para exportar o APK para sua galeria/downloads):
```bash
termux-setup-storage
```

### 2. Compilar o Aplicativo Android (APK)
Execute a pipeline de compilação:
```bash
bash build.sh
```
O pacote final assinado estará disponível em: `build/apk/boosteroid-pad.apk`.

### 3. Compilar o Userscript (Navegadores Desktop)
Gere o script em arquivo único (`bundle`):
```bash
bash build_userscript.sh
```
O arquivo final para injeção no Tampermonkey estará disponível em: `dist/boosteroid-cloudpad.user.js`.

## Licença

MIT License

