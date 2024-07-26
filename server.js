const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });
const path = require('path');

const clients = {};
let adminClient = null;

wss.on('connection', (ws) => {
    let userId = null;

    ws.on('message', (message) => {
        const parsedMessage = JSON.parse(message);
        console.log("msg", parsedMessage);

        if (parsedMessage.type === 'registerAdmin') {
            adminClient = ws;
            console.log('Admin connected');
            return;
        }

        if (parsedMessage.type === 'registerUser') {
            userId = generateUniqueId();
            clients[userId] = ws;
            ws.send(JSON.stringify({ type: 'userId', userId }));
            console.log(`New user connected: ${userId}`);
            return;
        }

        if (parsedMessage.type === 'existingUser') {
            userId = parsedMessage.userId;
            clients[userId] = ws;
            console.log(`Existing user reconnected: ${userId}`);
            return;
        }

        if (parsedMessage.type === 'message') {
            if (parsedMessage.role === 'user' && adminClient) {
                adminClient.send(JSON.stringify({ type: 'message', role: 'user', userId: parsedMessage.userId, message: parsedMessage.message }));
            } else if (parsedMessage.role === 'admin' && clients[parsedMessage.userId]) {
                clients[parsedMessage.userId].send(JSON.stringify({ type: 'message', role: 'admin', message: parsedMessage.message }));
            }
        }
    });

    ws.on('close', () => {
        if (userId) {
            delete clients[userId];
            console.log(`User disconnected: ${userId}`);
        }
        if (ws === adminClient) {
            adminClient = null;
            console.log('Admin disconnected');
        }
    });
});

function generateUniqueId() {
    return 'user-' + Math.random().toString(36).substr(2, 9);
}

server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

    if (pathname === '/ws') {
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    } else {
        socket.destroy();
    }
});

// Serve static files from the current directory
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

server.listen(5000, () => {
    console.log('Server is listening on port 5000');
});
