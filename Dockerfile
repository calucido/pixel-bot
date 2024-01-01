FROM node:12

# Create app directory
WORKDIR /app

# Copy both package.json and package-lock.json
COPY package*.json ./
RUN npm ci

# Bundle app source
COPY . .

EXPOSE 8443

CMD [ "npm", "start" ]

