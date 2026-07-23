const net = require('net');
const path = require('path');
const fs = require('fs');

const CLIENT_ID = '1357924680';
const DISCORD_IPC = process.env.XDG_RUNTIME_DIR
  ? path.join(process.env.XDG_RUNTIME_DIR, 'discord-ipc-0')
  : process.platform === 'win32'
    ? '\\\\?\\pipe\\discord-ipc-0'
    : path.join(os.tmpdir(), 'discord-ipc-0');

class RPCService {
  constructor() {
    this.client = null;
    this.connected = false;
    this.activity = null;
    this.retryTimer = null;
  }

  async connect() {
    if (this.connected) return;
    try {
      this.client = new net.Socket();
      await new Promise((resolve, reject) => {
        this.client.connect(DISCORD_IPC, () => {
          this.connected = true;
          this.handshake();
          resolve();
        });
        this.client.on('error', reject);
        setTimeout(() => reject(new Error('timeout')), 2000);
      });
    } catch {
      this.connected = false;
      this.retryTimer = setTimeout(() => this.connect(), 30000);
    }
  }

  handshake() {
    if (!this.client) return;
    const data = this.encode(0, { v: 1, client_id: CLIENT_ID });
    this.client.write(data);
    this.client.once('data', (buf) => {
      const op = buf.readUInt32LE(4);
      if (op === 2) this.connected = true;
    });
    this.client.on('data', (buf) => this.handleMessage(buf));
  }

  handleMessage(buf) {
    try {
      const op = buf.readUInt32LE(4);
      const len = buf.readUInt32LE(8);
      if (len > 0) {
        const str = buf.toString('utf8', 12, 12 + len);
        const msg = JSON.parse(str);
        if (msg.evt === 'ACTIVITY_JOIN') this.onJoin?.(msg.data.secret);
      }
    } catch {}
  }

  setActivity(activity) {
    this.activity = activity;
    if (!this.connected) return;
    const data = this.encode(1, { cmd: 'SET_ACTIVITY', args: { activity, pid: process.pid } });
    try { this.client?.write(data); } catch {}
  }

  clearActivity() {
    this.activity = null;
    this.setActivity({});
  }

  disconnect() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    try { this.client?.destroy(); } catch {}
    this.connected = false;
  }

  encode(op, payload) {
    const str = JSON.stringify(payload);
    const buf = Buffer.alloc(12 + str.length);
    buf.writeUInt32LE(op, 0);
    buf.writeUInt32LE(0, 4);
    buf.writeUInt32LE(str.length, 8);
    buf.write(str, 12, str.length, 'utf8');
    return buf;
  }
}

module.exports = new RPCService();
