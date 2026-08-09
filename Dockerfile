# Usa imagem Node enxuta
FROM node:20-slim

# Evita que o Puppeteer baixe o Chromium duplicado (vamos usar o do sistema)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true
ENV PUPPETEER_EXECUTABLE_PATH /usr/bin/google-chrome-stable

# Instala o Google Chrome e dependências de sistema necessárias
RUN apt-get update && apt-get install -y \
  wget \
  gnupg \
  ca-certificates \
  fonts-liberation \
  libappindicator3-1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdbus-1-3 \
  libgdk-pixbuf2.0-0 \
  libnspr4 \
  libnss3 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  xdg-utils \
  --no-install-recommends && \
  wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - && \
  echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list && \
  apt-get update && \
  apt-get install -y google-chrome-stable --no-install-recommends && \
  rm -rf /var/lib/apt/lists/*

# Define pasta de trabalho
WORKDIR /app

# Copia arquivos e instala dependências do Node
COPY package*.json ./
RUN npm install

# Copia o resto do código
COPY . .

# Expõe a porta do Express
EXPOSE 3000

# Comando para iniciar
CMD ["node", "bot.js"]
