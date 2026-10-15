const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const tencentcloud = require('tencentcloud-sdk-nodejs-vod');

const cfg = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'live-config.json'), 'utf8')); } catch (e) { return {}; }
})();

let _client = null;
function client() {
  if (!_client) {
    _client = new tencentcloud.vod.v20180717.Client({
      credential: { secretId: cfg.tencentSecretId, secretKey: cfg.tencentSecretKey },
      region: '',
      profile: { httpProfile: { endpoint: 'vod.tencentcloudapi.com' } }
    });
  }
  return _client;
}

function getVodUrl(fileId) {
  return new Promise((resolve, reject) => {
    if (!cfg.tencentSecretId || !cfg.tencentSecretKey || !fileId) return reject(new Error('missing config or fileId'));
    client().DescribeMediaInfos({ FileIds: [String(fileId)] })
      .then(function(data) {
        const infos = data.MediaInfoSet || [];
        resolve({ url: (infos[0] && infos[0].BasicInfo && infos[0].BasicInfo.MediaUrl) || '' });
      })
      .catch(reject);
  });
}

module.exports = { getVodUrl };
