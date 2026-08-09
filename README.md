


```markdown
# 🤖 Getflix Engagement Bot

Bot de automação para testes de performance e simulação de navegação no site [Getflix](https://getflix-phi.vercel.app/).

## 📋 Sobre o Projeto

Este bot utiliza **Puppeteer** com plugins de stealth e ghost-cursor para simular o comportamento de um usuário real navegando no site Getflix. Ele foi desenvolvido para testes de carga, performance e experiência do usuário em ambientes controlados.

### Funcionalidades

- 🕵️ **Stealth Mode** – Camuflagem avançada para evitar detecção
- 🖱️ **Movimentos Realistas** – Ghost-cursor com curvas de Bezier
- 🌐 **Proxies Dinâmicos** – Rota IPs automaticamente usando proxies HTTP/HTTPS
- ⏱️ **Timeout Global** – Proteção contra travamentos (15s)
- 🎯 **Validação de Proxies** – Testa antes de abrir o navegador (economiza recursos)
- 💾 **Persistência** – Mantém proxies que funcionaram para uso futuro
- 🔄 **Fila e Rate Limit** – Máx. 2 execuções a cada 30 segundos
- 🐳 **Docker Ready** – Container otimizado para deploy no Render
- 📊 **Monitoramento** – Endpoint `/health` para verificar status

## 🚀 Tecnologias

- Node.js (v20+)
- Express.js
- Puppeteer Extra + Stealth Plugin
- Ghost Cursor
- Axios + HttpsProxyAgent
- Docker

## 📦 Instalação

### Local (sem Docker)

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/getflix-bot.git
cd getflix-bot

# Instale as dependências
npm install

# Execute
npm start
```

### Docker

```bash
# Build da imagem
docker build -t getflix-bot .

# Roda o container
docker run -p 3000:3000 getflix-bot
```

## 🔧 Configuração

### Variáveis de Ambiente

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `PORT` | Porta do servidor | `3000` |
| `ENABLE_AD_CLICKS` | Ativa cliques em anúncios (`true`/`false`) | `false` |

### Endpoints

| Rota | Método | Descrição |
|------|--------|-----------|
| `/health` | GET | Status do servidor e métricas |
| `/api/engajar` | POST | Dispara o bot (resposta 202 - fila) |

### Exemplo de requisição

```bash
curl -X POST http://localhost:3000/api/engajar
```

## 📁 Estrutura do Projeto

```
getflix-bot/
├── bot.js              # Código principal
├── Dockerfile          # Configuração Docker
├── package.json        # Dependências
├── README.md           # Documentação
└── .dockerignore       # Arquivos ignorados no build
```

## 🐳 Dockerfile

O Dockerfile utiliza a imagem `node:20-slim` e instala o Google Chrome estável, otimizando o Puppeteer para ambientes de produção.

```dockerfile
FROM node:20-slim
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true
ENV PUPPETEER_EXECUTABLE_PATH /usr/bin/google-chrome-stable
# ... (instala dependências)
CMD ["node", "bot.js"]
```

## 📊 Monitoramento

O endpoint `/health` retorna:

```json
{
  "status": "online",
  "uptime_seconds": 3600,
  "working_proxies_count": 15,
  "is_processing": false
}
```

## ⚠️ Avisos

- O bot foi projetado para **testes próprios**. Use de forma ética.
- Cliques em anúncios podem ser desativados via variável `ENABLE_AD_CLICKS`.
- Proxies públicos são instáveis – considere usar proxies pagos para maior confiabilidade.
- O site alvo deve ser seu ou você deve ter autorização para realizar testes.

## 🤝 Contribuição

Sugestões e melhorias são bem-vindas! Abra uma issue ou pull request.

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

**Desenvolvido para fins de aprendizado e testes de performance.** 🚀
```

---

## 📄 Versão resumida (se preferir algo mais enxuto)

```markdown
# Getflix Engagement Bot

Bot de automação para testes de performance no Getflix usando Puppeteer, proxies dinâmicos e stealth mode.

## Funcionalidades
- Navegação realista com ghost-cursor
- Validação e rotação de proxies
- Timeout global e fila de execução
- Deploy via Docker no Render

## Uso
```bash
npm install
npm start
```

## Endpoints
- `/health` – Status do servidor
- `/api/engajar` – Dispara o bot
```

---

Escolha a versão que mais combina com seu projeto e ajuste os links conforme necessário (URL do repositório, seu usuário, etc.). 🚀
