const DiscordRPC = require('discord-rpc');
const clientId = '1357924680';

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
      this.client = new DiscordRPC.Client({ transport: 'ipc' });
      await this.client.login({ clientId });
      this.connected = true;
      this.client.on('disconnected', () => { this.connected = false; });
      if (this.activity) this.setActivity(this.activity);
    } catch {
      this.connected = false;
      this.retryTimer = setTimeout(() => this.connect(), 30000);
    }
  }

  setActivity(activity) {
    this.activity = activity;
    if (!this.connected || !this.client) return;
    try { this.client.setActivity(activity); } catch {}
  }

  clearActivity() {
    this.activity = null;
    if (!this.connected || !this.client) return;
    try { this.client.clearActivity(); } catch {}
  }

  disconnect() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.clearActivity();
    setTimeout(() => {
      try { this.client?.destroy(); } catch {}
      this.connected = false;
    }, 100);
  }
}

module.exports = new RPCService();
