const path = require('path');
const fs = require('fs');

const translations = {};

function loadLanguage(lang) {
  const filePath = path.join(__dirname, '..', 'lang', `${lang}.json`);
  try {
    if (fs.existsSync(filePath)) {
      translations[lang] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return translations[lang];
    }
  } catch {}
  return null;
}

function getTranslation(lang, key, params) {
  if (!translations[lang]) loadLanguage(lang);
  let text = translations[lang]?.[key];
  if (!text) {
    if (lang !== 'en') return getTranslation('en', key, params);
    return key;
  }
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, v);
    }
  }
  return text;
}

function getAvailableLanguages() {
  const langDir = path.join(__dirname, '..', 'lang');
  try {
    return fs.readdirSync(langDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace('.json', ''));
  } catch {
    return ['en'];
  }
}

loadLanguage('en');
loadLanguage('de');

module.exports = { getTranslation, getAvailableLanguages, loadLanguage };
