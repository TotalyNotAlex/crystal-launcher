const net = require('net');

function writeVarint(n) {
  const out = [];
  n = n >>> 0;
  do {
    let b = n & 0x7f;
    n >>>= 7;
    if (n) b |= 0x80;
    out.push(b);
  } while (n);
  return Buffer.from(out);
}

function readVarint(buf, off = 0) {
  let n = 0;
  let s = 0;
  let i = off;
  for (;;) {
    if (i >= buf.length) return null;
    const b = buf[i++];
    n |= (b & 0x7f) << s;
    if (!(b & 0x80)) break;
    s += 7;
    if (s > 35) return null;
  }
  return [n >>> 0, i];
}

function mcString(s) {
  const b = Buffer.from(String(s), 'utf8');
  return Buffer.concat([writeVarint(b.length), b]);
}

function packet(id, ...parts) {
  const d = Buffer.concat([writeVarint(id), ...parts]);
  return Buffer.concat([writeVarint(d.length), d]);
}

function extractMotd(desc) {
  if (!desc) return '';
  if (typeof desc === 'string') return desc;
  if (typeof desc.text === 'string') {
    let out = desc.text;
    if (Array.isArray(desc.extra)) {
      for (const part of desc.extra) out += extractMotd(part);
    }
    return out;
  }
  if (Array.isArray(desc)) return desc.map(extractMotd).join('');
  return '';
}

class ServerPingService {
  ping(host, port = 25565, timeout = 4000) {
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      let settled = false;
      const done = (err, result) => {
        if (settled) return;
        settled = true;
        try { sock.destroy(); } catch {}
        if (err) reject(err);
        else resolve(result);
      };

      const sock = net.connect({ host, port: Number(port) || 25565 });
      sock.setTimeout(timeout);
      let buf = Buffer.alloc(0);
      let state = 0;
      let status = null;

      sock.on('connect', () => {
        sock.write(packet(0x00, writeVarint(-1), mcString(host), Buffer.from([(port >> 8) & 0xff, port & 0xff]), writeVarint(1)));
        sock.write(packet(0x00));
        state = 1;
      });

      sock.on('data', (chunk) => {
        buf = Buffer.concat([buf, chunk]);
        try {
          for (;;) {
            const lenInfo = readVarint(buf, 0);
            if (!lenInfo) return;
            const [len, o1] = lenInfo;
            if (buf.length < o1 + len) return;
            const idInfo = readVarint(buf, o1);
            if (!idInfo) return;
            const [id, o2] = idInfo;
            const payload = buf.subarray(o2, o1 + len);

            if (state === 1 && id === 0x00) {
              const slInfo = readVarint(payload, 0);
              if (!slInfo) return;
              const [slen, so] = slInfo;
              status = JSON.parse(payload.subarray(so, so + slen).toString('utf8'));
              const pingPayload = Buffer.alloc(8);
              pingPayload.writeBigInt64BE(BigInt(Date.now()));
              sock.write(packet(0x01, pingPayload));
              state = 2;
              buf = buf.subarray(o1 + len);
              continue;
            }

            if (state === 2 && id === 0x01) {
              const latencyMs = Date.now() - t0;
              const motd = extractMotd(status && status.description);
              done(null, {
                online: true,
                latencyMs,
                version: status && status.version ? status.version.name : null,
                protocol: status && status.version ? status.version.protocol : null,
                players: status && status.players
                  ? { online: status.players.online, max: status.players.max }
                  : null,
                motd: motd.slice(0, 300),
                favicon: status && status.favicon ? status.favicon : null,
                enforcesSecureChat: !!(status && status.enforcesSecureChat),
              });
              return;
            }

            buf = buf.subarray(o1 + len);
          }
        } catch (e) {
          done(e);
        }
      });

      sock.on('timeout', () => done(new Error('timeout')));
      sock.on('error', (err) => done(err));
      sock.on('close', () => {
        if (!settled) {
          if (status) {
            const latencyMs = Date.now() - t0;
            done(null, {
              online: true,
              latencyMs,
              version: status.version ? status.version.name : null,
              protocol: status.version ? status.version.protocol : null,
              players: status.players ? { online: status.players.online, max: status.players.max } : null,
              motd: extractMotd(status.description).slice(0, 300),
              favicon: status.favicon || null,
              enforcesSecureChat: !!status.enforcesSecureChat,
            });
          } else {
            done(new Error('Connection closed'));
          }
        }
      });
    });
  }

  async pingAll(servers) {
    const results = await Promise.all(
      (servers || []).map(async (s) => {
        try {
          const info = await this.ping(s.address, s.port || 25565, 3500);
          return { ...s, ...info };
        } catch (err) {
          return { ...s, online: false, error: err.message || 'Failed' };
        }
      })
    );
    return results;
  }
}

module.exports = new ServerPingService();
