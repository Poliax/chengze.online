const session = require('express-session');
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'data', 'sessions.json');

class FileStore extends session.MemoryStore {
  constructor() {
    super();
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(FILE)) {
        const obj = JSON.parse(fs.readFileSync(FILE, 'utf8'));
        this.sessions = obj || {};
      }
    } catch (e) {}
  }

  save() {
    try {
      fs.writeFileSync(FILE, JSON.stringify(this.sessions));
    } catch (e) {}
  }

  set(sid, sess, cb) {
    super.set(sid, sess, () => {
      this.save();
      if (cb) cb();
    });
  }

  destroy(sid, cb) {
    super.destroy(sid, () => {
      this.save();
      if (cb) cb();
    });
  }
}

module.exports = FileStore;
