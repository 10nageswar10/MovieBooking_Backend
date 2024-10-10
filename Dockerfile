# Use an official Node.js runtime as the base image
FROM node:18-slim

# Install dependencies for installing Chrome
RUN apt-get update && \
    apt-get install -y wget gnupg ca-certificates --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Add Google's signing key and store it in a keyring file
RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | \
    gpg --dearmor -o /usr/share/keyrings/google-chrome-archive-keyring.gpg

# Add the Chrome repository using the keyring file
RUN echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome-archive-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" \
    > /etc/apt/sources.list.d/google-chrome.list

# Install Google Chrome
RUN apt-get update && \
    apt-get install -y google-chrome-stable --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./

# Install Puppeteer dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port your app runs on (adjust if different)
EXPOSE 3000

# Define environment variable for Puppeteer executable path
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Start the application
CMD ["npm", "start"]
