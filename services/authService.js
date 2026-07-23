const axios = require('axios');
const { BrowserWindow } = require('electron');

const CLIENT_ID = '00000000402b5328';
const REDIRECT_URI = 'https://login.live.com/oauth20_desktop.srf';

class AuthService {
  async loginWithMicrosoft(onStatusUpdate) {
    return new Promise((resolve, reject) => {
      let authWindow = new BrowserWindow({
        width: 520,
        height: 640,
        title: 'Microsoft Login - Crystal Launcher',
        autoHideMenuBar: true,
        resizable: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      const authUrl = `https://login.live.com/oauth20_authorize.srf?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=XboxLive.signin%20offline_access&prompt=select_account`;

      let codeHandled = false;

      const handleNavigation = async (event, urlStr) => {
        if (urlStr.startsWith(REDIRECT_URI) && !codeHandled) {
          try {
            const urlObj = new URL(urlStr);
            const code = urlObj.searchParams.get('code');
            const error = urlObj.searchParams.get('error');

            if (code) {
              codeHandled = true;
              if (onStatusUpdate) onStatusUpdate('Exchanging tokens...');
              if (!authWindow.isDestroyed()) authWindow.close();

              const account = await this.authenticateWithCode(code, onStatusUpdate);
              resolve(account);
            } else if (error) {
              codeHandled = true;
              if (!authWindow.isDestroyed()) authWindow.close();
              reject(new Error(`Login error: ${error}`));
            }
          } catch (err) {
            if (!authWindow.isDestroyed()) authWindow.close();
            reject(err);
          }
        }
      };

      authWindow.webContents.on('will-redirect', (event, newUrl) => handleNavigation(event, newUrl));
      authWindow.webContents.on('did-navigate', (event, newUrl) => handleNavigation(event, newUrl));

      authWindow.on('closed', () => {
        if (!codeHandled) reject(new Error('Login window was closed.'));
      });

      if (onStatusUpdate) onStatusUpdate('Opening Microsoft login...');
      authWindow.loadURL(authUrl);
    });
  }

  async authenticateWithCode(code, onStatusUpdate) {
    try {
      const msTokenRes = await axios.post(
        'https://login.live.com/oauth20_token.srf',
        new URLSearchParams({
          client_id: CLIENT_ID,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: REDIRECT_URI,
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const msAccessToken = msTokenRes.data.access_token;
      const msRefreshToken = msTokenRes.data.refresh_token;

      if (onStatusUpdate) onStatusUpdate('Authenticating with Xbox Live...');
      const xblRes = await axios.post(
        'https://user.auth.xboxlive.com/user/authenticate',
        {
          Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: `d=${msAccessToken}` },
          RelyingParty: 'http://auth.xboxlive.com',
          TokenType: 'JWT',
        },
        { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } }
      );

      const xblToken = xblRes.data.Token;
      const userHash = xblRes.data.DisplayClaims.xui[0].uhs;
      const xuid = xblRes.data.DisplayClaims.xui[0]?.xid || userHash;

      if (onStatusUpdate) onStatusUpdate('Authenticating with XSTS...');
      const xstsRes = await axios.post(
        'https://xsts.auth.xboxlive.com/xsts/authorize',
        {
          Properties: { SandboxId: 'RETAIL', UserTokens: [xblToken] },
          RelyingParty: 'rp://api.minecraftservices.com/',
          TokenType: 'JWT',
        },
        { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } }
      );

      const xstsToken = xstsRes.data.Token;

      if (onStatusUpdate) onStatusUpdate('Logging into Minecraft...');
      const mcRes = await axios.post(
        'https://api.minecraftservices.com/authentication/login_with_xbox',
        { identityToken: `XBL3.0 x=${userHash};${xstsToken}` },
        { headers: { 'Content-Type': 'application/json' } }
      );

      const mcAccessToken = mcRes.data.access_token;

      if (onStatusUpdate) onStatusUpdate('Fetching profile...');
      const profileRes = await axios.get('https://api.minecraftservices.com/minecraft/profile', {
        headers: { Authorization: `Bearer ${mcAccessToken}` },
      });

      return {
        id: profileRes.data.id,
        name: profileRes.data.name,
        accessToken: mcAccessToken,
        refreshToken: msRefreshToken,
        xuid: xuid,
        skins: profileRes.data.skins,
        capes: profileRes.data.capes,
        avatarUrl: `https://mc-heads.net/avatar/${profileRes.data.name}/64`,
        type: 'microsoft',
      };
    } catch (err) {
      if (err.response?.data) {
        const detail = typeof err.response.data === 'string' ? err.response.data : JSON.stringify(err.response.data);
        throw new Error(`Auth failed (${err.response.status}): ${detail}`);
      }
      throw err;
    }
  }

  async refreshMicrosoftToken(refreshToken) {
    if (!refreshToken) return null;
    try {
      const msTokenRes = await axios.post(
        'https://login.live.com/oauth20_token.srf',
        new URLSearchParams({
          client_id: CLIENT_ID,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
          redirect_uri: REDIRECT_URI,
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const msAccessToken = msTokenRes.data.access_token;
      const newRefreshToken = msTokenRes.data.refresh_token || refreshToken;

      const xblRes = await axios.post(
        'https://user.auth.xboxlive.com/user/authenticate',
        {
          Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: `d=${msAccessToken}` },
          RelyingParty: 'http://auth.xboxlive.com',
          TokenType: 'JWT',
        },
        { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } }
      );

      const xblToken = xblRes.data.Token;
      const userHash = xblRes.data.DisplayClaims.xui[0].uhs;
      const xuid = xblRes.data.DisplayClaims.xui[0]?.xid || userHash;

      const xstsRes = await axios.post(
        'https://xsts.auth.xboxlive.com/xsts/authorize',
        {
          Properties: { SandboxId: 'RETAIL', UserTokens: [xblToken] },
          RelyingParty: 'rp://api.minecraftservices.com/',
          TokenType: 'JWT',
        },
        { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } }
      );

      const xstsToken = xstsRes.data.Token;

      const mcRes = await axios.post(
        'https://api.minecraftservices.com/authentication/login_with_xbox',
        { identityToken: `XBL3.0 x=${userHash};${xstsToken}` },
        { headers: { 'Content-Type': 'application/json' } }
      );

      const mcAccessToken = mcRes.data.access_token;

      const profileRes = await axios.get('https://api.minecraftservices.com/minecraft/profile', {
        headers: { Authorization: `Bearer ${mcAccessToken}` },
      });

      return {
        id: profileRes.data.id,
        name: profileRes.data.name,
        accessToken: mcAccessToken,
        refreshToken: newRefreshToken,
        xuid: xuid,
        skins: profileRes.data.skins,
        capes: profileRes.data.capes,
        avatarUrl: `https://mc-heads.net/avatar/${profileRes.data.name}/64`,
        type: 'microsoft',
      };
    } catch (err) {
      console.warn('Token refresh failed:', err.message);
      return null;
    }
  }

  createOfflineAccount(username) {
    const cleanName = username.trim() || 'Player';
    return {
      id: 'offline-' + Date.now(),
      name: cleanName,
      accessToken: 'offline_token',
      avatarUrl: `https://mc-heads.net/avatar/${cleanName}/64`,
      type: 'offline',
    };
  }
}

module.exports = new AuthService();
