__dirname = `${process.cwd()}\\resources\\handlers`;
const { spawn } = require('child_process');

module.exports = () => {
  return new Promise((resolve, reject) => {
    const child = spawn('check.exe', [], {
      cwd: `${__dirname}\\user_input_handler\\check_caps`
    });    

    child.stdout.on('data', data => {
      const status = data.toString().includes('true');
      resolve(status);
    });
  });
}