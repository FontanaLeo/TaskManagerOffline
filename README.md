# TaskFlow — Lista de Tarefas PWA
//Lembrando que isso e um trabalho de faculdade que utilizei IA, porem a logica foi estruturada por mim, quero tambem dizer que eu refatoraria bastante coisa, por conta dos tamanhos dos files, porem ficou muito intuitivo, so instalar e rodar com o Live Server

> Projeto acadêmico demonstrando os fundamentos de **Progressive Web Apps (PWA)** com HTML5, CSS3 e JavaScript Vanilla.

---

## Índice

1. [O que é uma PWA?](#1-o-que-é-uma-pwa)
2. [Como o Service Worker funciona](#2-como-o-service-worker-funciona)
3. [Lifecycle do Service Worker](#3-lifecycle-do-service-worker)
4. [Cache API vs localStorage](#4-cache-api-vs-localstorage)
5. [Por que HTTPS é obrigatório](#5-por-que-https-é-obrigatório)
6. [Fluxo offline/cache detalhado](#6-fluxo-offlinecache-detalhado)
7. [Estrutura do projeto](#7-estrutura-do-projeto)
8. [Como executar localmente](#8-como-executar-localmente)
9. [Como testar offline no DevTools](#9-como-testar-offline-no-devtools)
10. [Como instalar a PWA no navegador](#10-como-instalar-a-pwa-no-navegador)
11. [Funcionalidades implementadas](#11-funcionalidades-implementadas)
12. [Tecnologias utilizadas](#12-tecnologias-utilizadas)

---

## 1. O que é uma PWA?

Uma **Progressive Web App (PWA)** é uma aplicação web que usa tecnologias modernas do navegador para se comportar como um aplicativo nativo — sem precisar de uma loja de aplicativos.

O conceito foi criado pelo Google em 2015 e se baseia em três pilares:

| Pilar | Descrição |
|---|---|
| **Confiável** | Funciona offline ou com conexão instável |
| **Rápida** | Carrega instantaneamente, animações fluidas |
| **Engajante** | Pode ser instalada, parece app nativo |

### Critérios para ser uma PWA

Para ser considerada uma PWA, a aplicação precisa:

- ✅ Ser servida em **HTTPS** (ou `localhost` para desenvolvimento)
- ✅ Ter um **`manifest.json`** válido com nome, ícones e modo de exibição
- ✅ Ter um **Service Worker** registrado e ativo
- ✅ Ser **responsiva** (funcionar em qualquer tamanho de tela)

### PWA vs App Nativo vs Site Comum

| | Site Comum | PWA | App Nativo |
|---|:---:|:---:|:---:|
| Funciona offline | ❌ | ✅ | ✅ |
| Instalável | ❌ | ✅ | ✅ |
| Loja de apps | ❌ | ❌ | ✅ |
| Atualização automática | ✅ | ✅ | ❌ |
| Acesso a hardware | Limitado | Parcial | ✅ |
| Custo de desenvolvimento | Baixo | Baixo | Alto |
| Multiplataforma | ✅ | ✅ | ❌ |

---

## 2. Como o Service Worker funciona

O **Service Worker (SW)** é um script JavaScript que o navegador executa em **segundo plano**, completamente separado da página web. Ele funciona como um proxy programável entre o aplicativo e a rede.

```
┌─────────────────────────────────────────────────────────────┐
│                    ARQUITETURA PWA                          │
│                                                             │
│   ┌─────────────┐         ┌─────────────────────────────┐  │
│   │   Página    │ ◄──────►│      Service Worker         │  │
│   │  (HTML/JS)  │         │  (proxy entre app e rede)   │  │
│   └─────────────┘         └────────────┬────────────────┘  │
│                                        │                    │
│                            ┌───────────┴──────────┐        │
│                            ▼                      ▼        │
│                      ┌─────────┐          ┌─────────────┐  │
│                      │  Cache  │          │    Rede     │  │
│                      │  (API)  │          │  (Internet) │  │
│                      └─────────┘          └─────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Características do Service Worker

- **Não tem acesso ao DOM** — não pode manipular HTML diretamente
- **Roda em thread separada** — não bloqueia a UI
- **É persistente** — continua ativo mesmo com a aba fechada
- **Intercepts requests** — captura TODA requisição feita pelo app
- **Programável** — você decide o que fazer com cada requisição

---

## 3. Lifecycle do Service Worker

Este é o conceito mais importante de uma PWA. O SW passa por estados bem definidos:

```
REGISTRO
   │
   ▼
DOWNLOAD
(navegador baixa o arquivo service-worker.js)
   │
   ▼
┌──────────────────────────────────────────┐
│  FASE 1: INSTALL                         │
│  ─────────────────────────────────────   │
│  • Evento: self.addEventListener         │
│    ('install', handler)                  │
│  • O que faz:                            │
│    - Cria/abre o cache                   │
│    - Baixa e armazena os arquivos        │
│      essenciais (App Shell)              │
│  • Duração: até que cache.addAll()       │
│    resolva ou falhe                      │
│  • Falha: se QUALQUER arquivo não        │
│    puder ser baixado, install falha      │
└──────────────────────────────────────────┘
   │
   ▼
WAITING
(aguarda abas com versão antiga fecharem)
   │ (ou skipWaiting() para pular)
   ▼
┌──────────────────────────────────────────┐
│  FASE 2: ACTIVATE                        │
│  ─────────────────────────────────────   │
│  • Evento: self.addEventListener         │
│    ('activate', handler)                 │
│  • O que faz:                            │
│    - Remove caches de versões antigas    │
│    - Assume controle das páginas         │
│      (clients.claim())                   │
│  • Importante: limpar caches antigos     │
│    aqui libera espaço e evita            │
│    recursos desatualizados               │
└──────────────────────────────────────────┘
   │
   ▼
┌──────────────────────────────────────────┐
│  FASE 3: FETCH (interceptação contínua)  │
│  ─────────────────────────────────────   │
│  • Evento: self.addEventListener         │
│    ('fetch', handler)                    │
│  • O que faz:                            │
│    - Intercepta TODA requisição GET      │
│    - Aplica a estratégia de cache        │
│    - Retorna resposta do cache ou rede   │
│  • Estratégia implementada:              │
│    Cache First (cache primeiro)          │
└──────────────────────────────────────────┘
   │
   ▼ (nova versão detectada)
REDUNDANT
(versão anterior descartada, nova assume)
```

### Quando o SW é atualizado?

O navegador verifica por uma nova versão do `service-worker.js` a cada:
- Visita ao app
- 24 horas (verificação em background)

Se o arquivo mudou (mesmo que 1 byte), uma nova versão entra no processo de install.

---

## 4. Cache API vs localStorage

São duas tecnologias de armazenamento completamente diferentes:

### Cache API (usado pelo Service Worker)

```javascript
// Abre ou cria um cache com nome específico
const cache = await caches.open('meu-cache-v1');

// Armazena arquivos (requests + responses HTTP)
await cache.addAll(['/index.html', '/style.css', '/app.js']);

// Busca um recurso no cache
const response = await caches.match('/index.html');
```

| Característica | Cache API |
|---|---|
| **Para quê** | Arquivos estáticos (HTML, CSS, JS, imagens) |
| **Controlado por** | Service Worker |
| **Formato** | Request/Response HTTP completo |
| **Limite** | Dezenas a centenas de MB |
| **Acesso** | Via `caches` API |

### localStorage (usado pelo app.js)

```javascript
// Salva dados como string JSON
localStorage.setItem('tarefas', JSON.stringify(minhasTarefas));

// Recupera dados
const dados = JSON.parse(localStorage.getItem('tarefas'));

// Remove dados
localStorage.removeItem('tarefas');
```

| Característica | localStorage |
|---|---|
| **Para quê** | Dados do usuário (tarefas, preferências) |
| **Controlado por** | JavaScript da página |
| **Formato** | Strings (JSON serializado) |
| **Limite** | ~5-10 MB por origem |
| **Acesso** | Síncrono, via `localStorage` |

### Resumo visual

```
Cache API     →  "Arquivos do app"   →  Service Worker cuida
localStorage  →  "Dados do usuário"  →  JavaScript cuida
```

---

## 5. Por que HTTPS é obrigatório

O Service Worker tem um **poder enorme**: interceptar 100% das requisições do app. Isso inclui:

- Todas as chamadas à API
- Autenticação e cookies
- Dados pessoais transmitidos

Se fosse possível registrar um SW em HTTP, um atacante **Man-in-the-Middle** poderia:

```
Usuário → Rede não segura → Atacante injeta SW malicioso → App corrompido
         ↑ Intercepta tudo, modifica respostas, roubo de dados
```

Com HTTPS:

```
Usuário → HTTPS (criptografado) → Servidor → SW legítimo ✅
         ↑ Impossível injetar SW falso
```

**Exceção para desenvolvimento:** `localhost` é permitido sem HTTPS porque:
- Só acessível na sua própria máquina
- Impossível para atacantes externos
- Facilita o desenvolvimento

---

## 6. Fluxo offline/cache detalhado

### Primeiro acesso (online)

```
1. Usuário acessa o app pela 1ª vez
      │
2. Navegador baixa index.html, style.css, app.js
      │
3. app.js registra o Service Worker
      │
4. SW entra na fase INSTALL
      │
5. SW abre o cache e baixa TODOS os arquivos do App Shell:
   • index.html, style.css, app.js
   • manifest.json, icons/icon-192.png, icons/icon-512.png
      │
6. SW entra na fase ACTIVATE (limpa caches antigos)
      │
7. App está PRONTO PARA OFFLINE ✅
```

### Segundo acesso em diante (pode ser offline)

```
1. Usuário acessa o app (com ou sem internet)
      │
2. SW intercepta a requisição de index.html
      │
3. Verifica no cache → ENCONTRADO ✅
      │
4. Retorna index.html DO CACHE (sem tocar na rede)
      │
5. Mesmo processo para style.css, app.js, ícones
      │
6. Tarefas carregadas do localStorage (não precisa de rede)
      │
7. App carrega INSTANTANEAMENTE, mesmo offline 🚀
```

### Estratégia Cache First (implementada)

```
Requisição chega
      │
      ▼
Tem no cache?
   ├── SIM → Retorna do cache imediatamente ⚡
   └── NÃO → Busca na rede
                │
                ├── Sucesso → Salva no cache + retorna resposta ✅
                └── Falha   → Retorna index.html como fallback ⚠️
```

---

## 7. Estrutura do projeto

```
pwa-todo/
│
├── index.html          # Estrutura HTML da aplicação
│                       # Contém: meta tags PWA, link para manifest,
│                         estrutura semântica, acessibilidade
│
├── style.css           # Estilos da aplicação
│                       # Contém: variáveis CSS, layout responsivo,
│                         animações, design system completo
│
├── app.js              # Lógica JavaScript
│                       # Contém: CRUD de tarefas, localStorage,
│                         registro do SW, instalação PWA, UI helpers
│
├── manifest.json       # Manifesto da PWA
│                       # Contém: nome, ícones, cores, modo standalone
│                         Define o app como instalável
│
├── service-worker.js   # Service Worker
│                       # Contém: eventos install/activate/fetch,
│                         estratégia Cache First, fallback offline
│
├── icons/
│   ├── icon-192.png    # Ícone 192×192 (Android, Chrome)
│   └── icon-512.png    # Ícone 512×512 (Splash screen, Play Store)
│
└── README.md           # Esta documentação
```

---

## 8. Como executar localmente

### Opção A — VS Code com Live Server (recomendado)

1. Instale a extensão **Live Server** no VS Code
2. Abra a pasta `pwa-todo` no VS Code
3. Clique com o botão direito em `index.html`
4. Selecione **"Open with Live Server"**
5. O app abre em `http://127.0.0.1:5500`

> **Por que Live Server?** Ele serve os arquivos via HTTP (não via `file://`), o que é necessário para o Service Worker funcionar.

### Opção B — Python (sem instalação extra)

```bash
# Na pasta pwa-todo, execute:
python3 -m http.server 8080

# Acesse: http://localhost:8080
```

### Opção C — Node.js com http-server

```bash
# Instala o servidor (uma vez)
npm install -g http-server

# Na pasta pwa-todo:
http-server -p 8080

# Acesse: http://localhost:8080
```

---

## 9. Como testar offline no DevTools

### Passo a passo no Chrome/Edge

1. **Abra o app** no navegador (`http://localhost:5500`)

2. **Abra o DevTools** → `F12` ou `Ctrl+Shift+I`

3. **Verificar o Service Worker:**
   - Vá em **Application** → **Service Workers**
   - Deve aparecer `service-worker.js` com status **"activated and is running"**

4. **Verificar o cache:**
   - Vá em **Application** → **Cache Storage**
   - Expanda `taskflow-cache-v1`
   - Deve listar todos os arquivos do App Shell

5. **Simular modo offline:**
   - Vá em **Application** → **Service Workers**
   - Marque a checkbox **"Offline"**
   - OU vá em **Network** → selecione **"Offline"** no dropdown de throttling

6. **Recarregue a página** com `Ctrl+R`
   - O app deve carregar normalmente!
   - As tarefas salvas devem aparecer

7. **Adicione uma tarefa offline:**
   - Digite uma tarefa e clique em adicionar
   - A tarefa é salva no `localStorage` normalmente

8. **Inspecionar o localStorage:**
   - Vá em **Application** → **Local Storage** → `http://localhost:5500`
   - Deve mostrar a chave `taskflow_tasks` com as tarefas em JSON

### Dica: ver os logs do Service Worker

No DevTools:
- **Application** → **Service Workers** → clique em "inspect" (popup)
- Console separado mostra todos os logs `[SW] ...`

---

## 10. Como instalar a PWA no navegador

### No Chrome (Desktop)

1. Acesse o app em `http://localhost:5500`
2. Aguarde alguns segundos (o navegador verifica os critérios)
3. Um **banner de instalação** aparece na parte superior do app
4. Clique em **"Instalar"**
5. OU: clique no ícone de **instalar** (⊕) na barra de endereços
6. O app abre em janela standalone (sem barra do navegador) ✅

### No Android (Chrome)

1. Acesse o app via HTTPS em um servidor real
2. Toque nos **3 pontinhos** → **"Adicionar à tela inicial"**
3. Confirme o nome e toque em **"Adicionar"**
4. Ícone aparece na tela inicial como app nativo ✅

### No iOS (Safari)

1. Acesse o app via HTTPS
2. Toque no botão de **compartilhamento** (quadrado com seta)
3. Selecione **"Adicionar à tela de início"**
4. Toque em **"Adicionar"** ✅

> **Nota:** iOS Safari tem suporte limitado a PWAs comparado ao Chrome Android.

---

## 11. Funcionalidades implementadas

### Core
- ✅ Adicionar tarefas (Enter ou botão)
- ✅ Marcar/desmarcar tarefas como concluídas
- ✅ Remover tarefas individualmente
- ✅ Persistência no localStorage
- ✅ Funcionamento offline após 1º acesso
- ✅ Instalável no dispositivo

### PWA
- ✅ manifest.json completo
- ✅ Service Worker com lifecycle completo
- ✅ Estratégia Cache First
- ✅ Indicador de status online/offline
- ✅ Banner de instalação personalizado
- ✅ Indicador visual do SW (ponto colorido)

### UX/UI
- ✅ Filtros: Todas / Pendentes / Concluídas
- ✅ Contador de tarefas por categoria
- ✅ Anel de progresso animado
- ✅ Botão "Limpar concluídas"
- ✅ Toast de feedback em todas as ações
- ✅ Contador de caracteres no input
- ✅ Animações de entrada e saída
- ✅ Data/hora relativa nas tarefas
- ✅ Design responsivo (mobile-first)
- ✅ Painel de diagnóstico PWA no rodapé
- ✅ Acessibilidade (ARIA labels, focus visible)

---

## 12. Tecnologias utilizadas

| Tecnologia | Uso |
|---|---|
| **HTML5** | Estrutura semântica, meta tags PWA |
| **CSS3** | Custom properties, Grid, Flexbox, animações |
| **JavaScript ES6+** | async/await, arrow functions, destructuring |
| **Service Worker API** | Cache, intercept, lifecycle |
| **Cache API** | Armazenamento de recursos estáticos |
| **localStorage API** | Persistência dos dados do usuário |
| **Web App Manifest** | Metadados para instalação |
| **beforeinstallprompt** | Captura do prompt de instalação |
| **navigator.onLine** | Detecção de status de conexão |

---

## Referências

- [web.dev — Progressive Web Apps](https://web.dev/explore/progressive-web-apps)
- [MDN — Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [MDN — Web App Manifests](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [Google Developers — PWA Checklist](https://web.dev/pwa-checklist/)

---

*Projeto desenvolvido para fins acadêmicos — demonstração de conceitos fundamentais de PWA.*
