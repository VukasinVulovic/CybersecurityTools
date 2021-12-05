const ws = new WebSocket(`ws://${location.host}`);

ws.onopen = () => {
    const button = document.querySelector('.send');
    const std_out = document.querySelector('.std-out');
    button.onclick = () => {
        const std = document.querySelector('.std-in').value;
        ws.send(`{
            "action": "execute",
            "platform": "web",
            "cmd": "${encodeURIComponent(std)}"
        }`);
    }
    ws.onmessage = (d) => {
        const response = JSON.parse(d.data);
        console.log(response);
        std_out.innerText = response['std']
    }
}