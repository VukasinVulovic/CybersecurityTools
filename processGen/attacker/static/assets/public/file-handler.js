let PICKED = false;
let FS = [];

const folders = {
    create: (name) => {
        const fullname = decodeURI(name);
        const container = document.querySelector('.wrapper');
        const a = document.createElement('a');
        const p = document.createElement('p');
        const div = document.createElement('div');
        const img = document.createElement('img');
        div.setAttribute('class', 'folder');
        img.setAttribute('class', 'folder-image');
        p.setAttribute('class', 'folder-name');
        a.setAttribute('class', 'folder-href');
        img.src = '\\src/src/images/folder.png';
        img.draggable = false;
        p.innerText = fullname;
        a.href = `${fullname}/`;
        a.onmouseover = (e) => {
            PICKED = encodeURI(fullname);
        }
        div.appendChild(img);
        div.appendChild(p);
        a.appendChild(div);
        container.appendChild(a);
    },
    remove: () => {
        for(let folder of document.querySelectorAll('.folder')) 
            document.removeChild(folder);
    }
}

const files = {
    create: (name) => {
        const fullname = decodeURI(name);
        const container = document.querySelector('.wrapper');
        const a = document.createElement('a');
        const p = document.createElement('p');
        const img = document.createElement('img');
        const div = document.createElement('div');
        p.setAttribute('class', 'file-name');
        a.setAttribute('class', 'folder-href');
        img.setAttribute('class', 'file-image');
        div.setAttribute('class', 'file');
        img.src = '\\src/src/images/file.png';
        img.alt = fullname;
        img.draggable = false;
        p.innerText = fullname;
        const re = location.href;
        const url = re.slice(re.indexOf('/', 8)+1).replace('explore/', '');
        a.onmouseover = (e) => {
            PICKED = encodeURI(fullname);
        }
        div.appendChild(img);
        div.appendChild(p);
        a.appendChild(div);
        container.appendChild(a);
    },
    remove: () => {
        for(let folder of document.querySelectorAll('.file')) document.removeChild(folder);
    }
}

function listDir(data) {
    document.querySelector('.wrapper').innerHTML = '';
    for(let l of data) {
        if(l.type === 'folder') {
            if(l.name !== 'temp') folders.create(l.name);
        } else if(l.type === 'file') { 
            files.create(l.name);
        }
    }
}