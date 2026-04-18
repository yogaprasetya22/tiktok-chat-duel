const { WebcastPushConnection } = require('tiktok-live-connector');
try {
  const client1 = new WebcastPushConnection('some_user');
  console.log("Constructor 1 works");
} catch(e) { console.log("Constructor 1 failed", e.message); }

try {
  const client2 = new WebcastPushConnection('some_user', {});
  console.log("Constructor 2 works");
} catch(e) { console.log("Constructor 2 failed", e.message); }

try {
  const client3 = new WebcastPushConnection({uniqueId: 'some_user'});
  console.log("Constructor 3 works");
} catch(e) { console.log("Constructor 3 failed", e.message); }
