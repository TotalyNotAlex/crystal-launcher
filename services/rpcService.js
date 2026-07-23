const net = require('net');
const path = require('path');
const fs = require('fs');

const CLIENT_ID = '1529954550662824039';
const OP = { HANDSHAKE: 0, FRAME: 1, CLOSE: 2, PING: 3, PONG: 4 };

class RPCService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.activity = null;
    this.retryTimer = null;
  }

  findPipe(id = 0) {
    if (id > 9) return null;
    const p = process.platform === 'win32'
      ? `\\\\?\\pipe\\discord-ipc-${id}`
      : path.join(process.env.XDG_RUNTIME_DIR || '/tmp', `discord-ipc-${id}`);
    return p;
  }

  tryConnect(id = 0) {
    return new Promise((resolve, reject) => {
      const p = this.findPipe(id);
      if (!p) return reject(new Error('no pipe'));
      const sock = net.createConnection(p, () => resolve(sock));
      sock.on('error', () => {
        if (id < 9) resolve(this.tryConnect(id + 1));
        else reject(new Error('no discord'));
      });
    });
  }

  async connect() {
    if (this.connected) return;
    try {
      this.socket = await this.tryConnect(0);
      this.socket.on('close', () => { this.connected = false; });
      this.socket.on('error', () => { this.connected = false; });

      this.#send(OP.HANDSHAKE, { v: 1, client_id: CLIENT_ID });

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('timeout')), 3000);
        this.socket.once('readable', () => {
          const buf = this.socket.read();
          if (buf) {
            const op = buf.readInt32LE(0);
            const len = buf.readInt32LE(4);
            if (len > 0 && op === OP.FRAME) {
              clearTimeout(timeout);
              this.connected = true;
              if (this.activity) this.#setActivity(this.activity);
              resolve();
            }
          }
        });
      });
    } catch {
      this.connected = false;
      this.retryTimer = setTimeout(() => this.connect(), 30000);
    }
  }

  setActivity(activity) {
    this.activity = activity;
    if (!this.connected) return;
    this.#setActivity(activity);
  }

  #setActivity(activity) {
    this.#send(OP.FRAME, {
      cmd: 'SET_ACTIVITY',
      args: { activity, pid: process.pid },
      nonce: String(Date.now()),
    });
  }

  clearActivity() {
    this.activity = null;
    if (!this.connected) return;
    this.#setActivity({});
  }

  disconnect() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    try { this.socket?.end(); this.socket?.destroy(); } catch {}
    this.connected = false;
  }

  #send(op, data) {
    const str = JSON.stringify(data);
    const len = Buffer.byteLength(str);
    const buf = Buffer.alloc(8 + len);
    buf.writeInt32LE(op, 0);
    buf.writeInt32LE(len, 4);
    buf.write(str, 8, len, 'utf8');
    try { this.socket?.write(buf); } catch {}
  }

  setLauncherActivity(view) {
    const labels = {
      play: { state: 'Choosing version', details: 'In Crystal Launcher' },
      mods: { state: 'Browsing mods', details: 'In Crystal Launcher' },
      profiles: { state: 'Managing profiles', details: 'In Crystal Launcher' },
      accounts: { state: 'Managing accounts', details: 'In Crystal Launcher' },
      worlds: { state: 'Browsing worlds', details: 'In Crystal Launcher' },
      servers: { state: 'Browsing servers', details: 'In Crystal Launcher' },
      console: { state: 'Viewing console', details: 'In Crystal Launcher' },
      news: { state: 'Reading news', details: 'In Crystal Launcher' },
      settings: { state: 'Changing settings', details: 'In Crystal Launcher' },
    };
    const l = labels[view] || { state: 'In Crystal Launcher', details: 'In Crystal Launcher' };
    this.setActivity({
      details: l.details,
      state: l.state,
      largeImageKey: 'crystal_logo',
      largeImageText: 'Crystal Launcher',
      startTimestamp: Math.floor(Date.now() / 1000),
      instance: false,
    });
  }
}

module.exports = new RPCService();
