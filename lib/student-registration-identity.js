const crypto = require('node:crypto');
module.exports = function registrationIdentity(db, phone) {
  for (let attempt=0; attempt<10; attempt++) {
    const uid='CZ'+crypto.randomBytes(8).toString('hex').toUpperCase();
    if (!db.get('SELECT id FROM students WHERE uid=?',[uid])) return { uid, nickname:'学员'+phone.slice(-4) };
  }
  throw Error('暂时无法创建学员编号，请重试');
};
