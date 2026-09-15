# Usa uma imagem oficial do Node.js com Linux estável
FROM node:20-slim

# Instala o Google Chrome oficial e todas as dependências de sistema para rodar o Puppeteer
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libxss1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    && wget -q -O - https://google.com | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://google.com stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Cria a pasta do bot dentro do servidor virtual
WORKDIR /usr/src/app

# Copia as configurações de bibliotecas e instala
COPY package*.json ./
RUN npm install

# Copia o código do DJ Azeitona
COPY . .

# Expõe a porta de internet para o Render
EXPOSE 3000

# Comando definitivo que liga o robô
CMD ["node", "index.js"]
