const net = require('net');
const path = require('path');
const fs = require('fs');

const CLIENT_ID = '1357924680';

class RPCService {
  constructor() {
    this.client = null;
    this.connected = false;
    this.activity = null;
    this.retryTimer = null;
    this._nonce = 0;
  }

  findPipe() {
    if (process.platform === 'win32') {
      for (let i = 0; i < 10; i++) {
        const p = `\\\\?\\pipe\\discord-ipc-${i}`;
        try { fs.accessSync(p); return p; } catch {}
      }
      return '\\\\?\\pipe\\discord-ipc-0';
    }
    const runtime = process.env.XDG_RUNTIME_DIR;
    if (runtime) {
      for (let i = 0; i < 10; i++) {
        const p = path.join(runtime, `discord-ipc-${i}`);
        if (fs.existsSync(p)) return p;
      }
    }
    return path.join(process.env.TMPDIR || '/tmp', 'discord-ipc-0');
  }

  async connect() {
    if (this.connected) return;
    try {
      this.client = new net.Socket();
      const pipePath = this.findPipe();
      await new Promise((resolve, reject) => {
        this.client.connect(pipePath, () => {
          this.handshake().then(resolve).catch(reject);
        });
        this.client.on('error', (e) => reject(e));
        setTimeout(() => reject(new Error('timeout')), 2000);
      });
      this.connected = true;
      if (this.activity) this.setActivity(this.activity);
    } catch {
      this.connected = false;
      this.retryTimer = setTimeout(() => this.connect(), 30000);
    }
  }

  handshake() {
    return new Promise((resolve, reject) => {
      const data = this.#encode(0, { v: 1, client_id: CLIENT_ID });
      this.client.write(data);
      this.client.once('data', (buf) => {
        try {
          const op = buf.readUInt32LE(0);
          if (op === 2) resolve();
          else reject(new Error('handshake failed'));
        } catch { reject(new Error('handshake parse error')); }
      });
      setTimeout(() => reject(new Error('handshake timeout')), 2000);
    });
  }

  setActivity(activity) {
    this.activity = activity;
    if (!this.connected) return;
    const nonce = ++this._nonce;
    const data = this.#encode(1, {
      cmd: 'SET_ACTIVITY',
      args: { activity, pid: process.pid },
      nonce: String(nonce),
    });
    try { this.client?.write(data); } catch {}
  }

  clearActivity() {
    this.activity = null;
    if (!this.connected) return;
    const nonce = ++this._nonce;
    const data = this.#encode(1, {
      cmd: 'SET_ACTIVITY',
      args: { activity: {}, pid: process.pid },
      nonce: String(nonce),
    });
    try { this.client?.write(data); } catch {}
  }

  disconnect() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.clearActivity();
    setTimeout(() => {
      try { this.client?.destroy(); } catch {}
      this.connected = false;
    }, 100);
  }

  #encode(op, payload) {
    const str = JSON.stringify(payload);
    const buf = Buffer.alloc(8 + str.length);
    buf.writeUInt32LE(op, 0);
    buf.writeUInt32LE(str.length, 4);
    buf.write(str, 8, str.length, 'utf8');
    return buf;
  }
}

module.exports = new RPCService();
