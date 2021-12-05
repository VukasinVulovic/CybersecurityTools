const os = require('os');
const { spawn } = require('child_process');

module.exports = {
    device: {
        fromToPort: async(ip, start, end, cb=()=> {}) => {
            const ports = {}
        
            for(let i = start; i <= end; i++) {
                const perc = map(i, start, end, 0, 100);
                cb(`Checking port ${i}, ${perc.toFixed(0)}% done.`);
        
                const c = await quickPortPing(ip, i);
        
                if(c)
                    ports[i] = c;
            }
        
            return ports;
        },
        scanVulnPorts: async ip => {
            return new Promise(async(resolve, reject) => {
                const ports = {}
                const ports_info = {
                    21: 'FTP',
                    22: 'SSH',
                    23: 'Telent',
                    25: 'SMTP',
                    53: 'DNS',
                    80: 'HTTP',
                    110: 'POP3',
                    135: 'Windows RPC',
                    137: 'Windows NetBIOS',
                    138: 'Windows NetBIOS',
                    139: 'Windows NetBIOS',
                    443: 'HTTPS',
                    1433: 'Microsoft SQL Server',
                    1434: 'Microsoft SQL Server'
                }
    
                for(const port of Object.keys(ports_info)) {
                    const c = await quickPortPing(ip, port);
    
                    if(c)
                        ports[port] = c;
                }
    
                resolve(ports);
            });
        }
    },
    network: {
        scanIps: async(fromip, toip) => {
            return new Promise(async(resolve, reject) => {
                fromip = fromip.split('.');
                toip = toip.split('.');
                const ips = [];

                for(let a = Number(fromip[0]); a <= Number(toip[0]); a++) {
                    for(let b = Number(fromip[1]); b <= Number(toip[1]); b++) {
                        for(let c = Number(fromip[2]); c <= Number(toip[2]); c++) {
                            for(let d = Number(fromip[3]); d <= Number(toip[3]); d++) {
                                const ip = [a, b, c, d].join('.');
                                if(await quickPing(ip))
                                    ips.push(ip);
                            }
                        }
                    }  
                }   

                resolve(ips);
            });
        },
        defaultGateway: async() => {
            return new Promise((resolve, reject) => {
                let data = '';
                
                spawn('ip', ('route').split(' '))
                .stdout
                .on('data', chunk => data += chunk)
                .on('end', () => resolve(data.split(' ')[2]));
            });
        }
    }
}

async function quickPing(ip) {
    return new Promise((resolve, reject) => {
        let data = '';
        spawn('ping', (`${ip} -c 1 -w 1`).split(' '))
        .stdout
        .on('data', chunk => data += chunk)
        .on('end', () => resolve(data.includes('100% packet loss') ? false : true));
    });
}

async function quickPortPing(ip, port) {
    return new Promise((resolve, reject) => {
        let data = '';
        spawn('nc', (`-vz ${ip} ${port} -w 1`).split(' '))
        .stderr
        .on('data', chunk => data += chunk)
        .on('end', () => {
            if(data.includes('succeeded')) {
                const type = data.slice(data.indexOf('[')+1, data.indexOf(']'));
                resolve(type.length < 0 ? 'unknown' : type);
            } else 
                resolve(false);
        });
    });
}

function map(v, imin, imax, omin, omax) {
	return (v - imin) * (omax - omin)/(imax - imin) + omin;
}