const { ipcRenderer } = require('electron');
ipcRenderer.send('#ready', '');

ipcRenderer.on('new_achievement', (e, message) => {
    new Audio('./static/assets/sfx/sound.mp3').play();
    const data = JSON.parse(message);
    const title = document.querySelector('.title');
    const text = document.querySelector('.text');
    const icon = document.querySelector('.icon');
    title.innerHTML = data['title'];
    text.innerHTML = data['text'];
    icon.src = data['icon'];
});