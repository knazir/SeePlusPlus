FROM node:16-alpine

WORKDIR /app

# Copy package.json and install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy the rest of the code
COPY . .

# Set environment to development and start the app
ENV PORT=8080
ENV CHOKIDAR_USEPOLLING=true
ENV WATCHPACK_POLLING=true
CMD ["npm", "start"]

# TODO: Figure out how to toggle this on for non-dev
# Use Nginx to serve the React app
# FROM nginx:alpine

# Remove default Nginx static files
# RUN rm -rf /usr/share/nginx/html/*

# Copy React build files to Nginx
# COPY --from=builder /app/build /usr/share/nginx/html

# Expose port 80
# EXPOSE 80

# Start Nginx
# CMD ["nginx", "-g", "daemon off;"] 