const scanNetwork = require('./index');

(async() => {
    const end = 10;

    const d_gateway = await scanNetwork.network.defaultGateway();

    let e = d_gateway.split('.');
    e[3] = end;

    const ips = await scanNetwork.network.scanIps(d_gateway, e.join('.'));

    const v_ips = await scanNetwork.device.scanVulnPorts(ips[0]);
    

    console.log('ips: ', ips, `\nfound vauln ports for ip ${ips[0]}: `, v_ips);
})();