'use strict';

module.exports = {
  load () {
    // execute when package loaded
    Editor.log("IAP package loaded");
  },

  unload () {
    // execute when package unloaded
    Editor.log("IAP package unloaded");
  },

  // register your ipc messages here
  messages: {
    'say-hello' () {
      Editor.log('Hello World!');
    }
  },
};
