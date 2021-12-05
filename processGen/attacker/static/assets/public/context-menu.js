const container = document.querySelector('.wrapper');

window.addEventListener('click', (e) => {
    if(container.querySelector('.select-menu')) 
        container.removeChild(container.querySelector('.select-menu'));
});

window.addEventListener('contextmenu', createContextMenu);

const contextmenu_items = {
    container: [
        {
            name: 'Upload file',
            icon: 'fa fa-upload',
            f: (e) => {
                document.querySelector('.select-menu').style.height = '50px';
                const form = document.createElement('form');
                const input = document.createElement('input');
                const submit = document.createElement('button');
                input.type = 'file';
                input.name = 'file';
                input.multiple = false;
                input.style.display = 'none';
                submit.type = 'submit';
                submit.style.display = 'none';
                form.style.display = 'none';
                form.target = 'print';
                form.method = 'post';
                form.enctype = 'multipart/form-data';
                form.action = `/sendFile?url=${location.pathname}`;
                form.onsubmit = () => {
                    const iframe = document.createElement('iframe');
                    iframe.name = 'print';
                    iframe.setAttribute('style', 'width:0; height 0;');
                    document.body.appendChild(iframe);
                }
                form.appendChild(input);
                form.appendChild(submit);
                container.appendChild(form);
                input.click();
                input.onchange = () => {
                    submit.click();
                    container.removeChild(form);
                }
            }
        }
    ],
    on_folder: [
        {
            name: 'Download folder',
            icon: 'fa fa-floppy-o',
            f: () => {
                document.querySelector('.select-menu').style.height = '100px';
                ws.send(`{
                    "platform": "web",
                    "action": "save",
                    "url": "${location.pathname}/${PICKED}"
                }`);
            }
        },
        {
            name: 'Delete folder',
            icon: 'fa fa-bitbucket',
            f: (e) => {
                ws.send(`{
                    "platform": "web",
                    "action": "delete",
                    "url": "${location.pathname}/${PICKED}"
                }`);
            }
        }
    ],
    on_file: [
        {
            name: 'Download file',
            icon: 'fa fa-floppy-o',
            f: (e) => {
                ws.send(`{
                    "platform": "web",
                    "action": "save",
                    "url": "${location.pathname}/${PICKED}"
                }`);
            }
        },
        {
            name: 'Delete file',
            icon: 'fa fa-bitbucket',
            f: (e) => {
                ws.send(`{
                    "platform": "web",
                    "action": "delete",
                    "url": "${location.pathname}/${PICKED}"
                }`);
            }
        }
    ]
}

function createContextMenu(e) {
    e.preventDefault();
    SELECTED = e.target;
    let pos = 'container';
    if( e.target.classList[0] === 'folder' || 
        e.target.classList[0] === 'folder-image' ) pos = 'on_folder';
    if( e.target.classList[0] === 'file' || 
        e.target.classList[0] === 'file-image' ) pos = 'on_file';
    if(!container.querySelector('.select-menu')) {
        const nav = document.createElement('nav');
        nav.setAttribute('class', 'select-menu');
        for(let item of contextmenu_items[pos]) {
            const span = document.createElement('span');
            span.setAttribute('class', 'select-menu-option');
            const i = document.createElement('span');
            i.setAttribute('class', item.icon);
            span.appendChild(i);
            span.innerHTML += ` ${item.name}`;
            span.onclick = (e) => item.f(e);
            nav.appendChild(span);
        }
        e.pageX = e.clientX +
            (document.documentElement && document.documentElement.scrollLeft || document.body && document.body.scrollLeft || 0) -
            (document.documentElement && document.documentElement.clientLeft || document.body && document.body.clientLeft || 0);
        e.pageY = e.clientY +
            (document.documentElement && document.documentElement.scrollTop  || document.body && document.body.scrollTop  || 0) -
            (document.documentElement && document.documentElement.clientTop  || document.body && document.body.clientTop  || 0 );
        nav.style.left = `${e.pageX}px`;    
        nav.style.top = `${e.pageY}px`;
        container.appendChild(nav);
        if( e.target.classList[0] === 'folder' || 
        e.target.classList[0] === 'folder-image' ) {
            document.querySelector('.select-menu').style.width = '205px';
            document.querySelector('.select-menu').style.height = '80px';
        }
        if( e.target.classList[0] === 'file' || 
        e.target.classList[0] === 'file-image' ) {
            document.querySelector('.select-menu').style.width = '205px';
            document.querySelector('.select-menu').style.height = '80px';   
        }
    } else container.removeChild(container.querySelector('.select-menu'));
}
