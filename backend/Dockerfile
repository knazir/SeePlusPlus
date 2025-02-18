FROM node:23-alpine

WORKDIR /app

# Copy package.json and package-lock.json and install dependencies
COPY package*.json ./
RUN npm install

# Install Docker CLI inside the container
RUN apk add --no-cache docker-cli

# Copy and build the rest of the code
COPY . .
RUN npm run build

# Open port 3000 and start the server
EXPOSE 3000
# CMD ["npm", "start"]
CMD ["npm", "run", "dev"]

# TODO: Add run command and no-internet network creation command
