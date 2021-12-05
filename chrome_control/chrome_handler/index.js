__dirname = `${process.cwd()}\\chrome_handler`;
const { exec, spawn } = require('child_process');
const os = require('os');
const fs = require('fs-extra');
const puppeteer = require('puppeteer-core');
const locateChrome = () => {
  return new Promise((resolve, reject) => {
    let path = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
    if(fs.existsSync(path))
      resolve(path);
    else {
      path = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
      if(fs.existsSync(path))
        resolve(path);
      else
        reject('No chrome found.');
    }
  });
}

module.exports = initBrowser;

async function initBrowser() {
  return new Promise(async(resolve, reject) => {
    const chrome_exe = await locateChrome();
    let user_dir = `C:\\Users\\${os.userInfo()['username']}\\AppData\\Local\\Google\\Chrome\\User Data`; 
    const state = await chromeRunning();

    if(state) {
      await((() => {
        return new Promise((resolve, reject) => 
          fs.copy(user_dir, `${__dirname}\\%temp%`, resolve));
      })());
      user_dir = `${__dirname}\\%temp%`;
    }

    const browser = await puppeteer.launch({
      ignoreDefaultArgs: true,
      args: [
        '/min',
        '/new-window',
        'https://mail.google.com/mail/u/3/?pli=1#inbox',
        '--no-pings',
        '--disable-session-crashed-bubble',
        '--disable-infobars',
        '--window-size=640,480',
        '--window-position=0,-479',
        '--noerrordialogs',
        '--mute-audio',
        '--disable-notifications',
        '--remote-debugging-port=9222',
        `--user-data-dir=${user_dir}`
      ],
      headless: false,
      executablePath: chrome_exe
    });
    
    const pid = browser.process()['pid'];
    hideWindow(pid);
    regainFocus();

    const page = (await browser.pages())[0];

    return resolve({
      browser: browser,
      page: page,
      end: async() => {
        return new Promise(async(resolve, reject) => {
          if(state) {
            // await centerWindow();
            fs.remove(`${__dirname}\\%temp%`, resolve);
            await browser.close();
          } else {
            await browser.close();
            // await centerWindow();
            return resolve(0);
          }
        });
      }
    });
  });
}

async function regainFocus() {
  return new Promise((resolve, reject) => {
    exec('cmdow.exe /T', {
      cwd: `${__dirname}\\bin`
    }, (error, stdout, stderr) => {
      if(error)
        return reject(error);

      const prev_window = (() => {
        const out = stdout.split(/\n\r|\n/).slice(1);
        const line = out[0].replace(/\s\s+/g, ' ');
        const first_part = line.slice(12);
        return Number(first_part.slice(0, first_part.indexOf(' '))); //pid
      })();
      exec(`cscript switch.vbs ${prev_window}`, {
        cwd: `${__dirname}\\bin`
      }, (error, stdout, stderr) => {
        if(error)
          return reject(error);
        resolve(stdout);
      });
    });
  });
}

// async function centerWindow() {
//   return new Promise(async(resolve, reject) => {
//     const chrome_exe = await locateChrome();
//     let chrome_path = chrome_exe.replace(/\\/g, '\\\\');
//     chrome_path = chrome_path.slice(0, chrome_path.lastIndexOf('\\\\'));
//     const s = exec('chrome.exe about:blank --new-window --start-maximized --headless', { // --headless
//       cwd: chrome_path
//     }, async(error, stdout, stderr) => {
//       if(error)
//         return reject(error);
//         await closeWindow(s['pid']);
//       resolve(stdout);
//     });
//   });
// }

// async function redrawWindow(pid) {
//   return new Promise((resolve, reject) => {
//     exec(`nircmd.exe win close process /${pid}`, {
//       cwd: `${__dirname}\\bin`
//     }, (error, stdout, stderr) => {
//       if(error)
//         return reject(error);
//       resolve(stdout);
//     });
//   });
// }

// async function closeWindow(pid) {
//   return new Promise((resolve, reject) => {
//     exec(`nircmd.exe win close process /${pid}`, {
//       cwd: `${__dirname}\\bin`
//     }, (error, stdout, stderr) => {
//       if(error)
//         return reject(error);
//       resolve(stdout);
//     });
//   });
// }

async function hideWindow(pid) {
  return new Promise((resolve, reject) => {
    exec(`nircmd.exe win hide process /${pid}`, {
      cwd: `${__dirname}\\bin`
    }, (error, stdout, stderr) => {
      if(error)
        return reject(error);
      resolve(stdout);
    });
  });
}

async function chromeRunning() {
  return new Promise((resolve, reject) => {
    exec('tasklist', {
      cwd: `${__dirname}\\bin`
    }, (error, stdout, stderr) => {
      if(error)
        return reject(error);
      resolve(stdout.includes('chrome.exe'));
    });
  });
}