# Usa a imagem oficial do Puppeteer que já vem com Node.js e Chrome instalados de fábrica
FROM ghcr.io/puppeteer/puppeteer:22.12.0

# Define a pasta do bot dentro do servidor virtual
WORKDIR /usr/src/app

# Copia as configurações de bibliotecas e altera as permissões para o usuário padrão da imagem
COPY --chown=puppeteer:puppeteer package*.json ./

# Instala as bibliotecas de forma limpa
RUN npm ci

# Copia o resto do código do DJ Azeitona
COPY --chown=puppeteer:puppeteer . .

# Expõe a porta de internet para o Render mandar o sinal
EXPOSE 3000

# Executa o bot usando o usuário seguro do Puppeteer
CMD ["node", "index.js"]
