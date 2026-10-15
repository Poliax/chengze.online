// Protocol implementation supplied by Tencent RTC, retained under its MIT license.
const { Api } = require('./vendor/TLSSigAPIv2');
const TTL = 6 * 60 * 60;
module.exports = function tickets(appId, key, userId, roomId, role) {
 for(const value of [appId,roomId])if(!Number.isInteger(value)||value<1||value>4294967294)throw Error('Invalid TRTC application or room');
 if(typeof key!=='string'||key.length<16)throw Error('TRTC signing key unavailable');
 if(typeof userId!=='string'||!/^[a-zA-Z0-9_-]{1,32}$/.test(userId))throw Error('Invalid TRTC user');
 if(!['teacher','audience'].includes(role))throw Error('Invalid TRTC permission role');
 const api=new Api(appId,key);
 const permission=role==='teacher'?255:170; // Audience: enter + receive audio, video, substream; no publish/create.
 return {userSig:api.genUserSig(userId,TTL),privateMapKey:api.genPrivateMapKey(userId,TTL,roomId,permission),expire:TTL};
};
