FROM node:12

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package-lock.json ./
RUN npm ci

# Bundle app source
COPY . .

EXPOSE 8443

CMD [ "npm", "start" ]

