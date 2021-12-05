const ws = new WebSocket(`ws://${location.host}`);

ws.onopen = () => {
    ws.send(`{
        "action": "list",
        "url": "${location.pathname}",
        "platform": "web"
    }`);
    ws.onmessage = (d) => {
        const response = JSON.parse(d.data);
        console.log(response);
        switch(response['action']) {
            case 'list':
                listDir(response.data);
                for(let f of response.data) 
                    FS.push(f.name);
                break;
            case 'saved':
                alert('File saved!');
                break;
            case 'deleted':
                location.reload();
                break;
            case 'downloaded':
                location.reload();
                break;
        }
    }
}
